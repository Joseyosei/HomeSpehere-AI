import {randomBytes,randomUUID,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt),DAY=86400000;
const digest=s=>createHash('sha256').update(s).digest('hex');
const random=()=>randomBytes(32).toString('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&timingSafeEqual(Buffer.from(digest(a),'hex'),Buffer.from(digest(b),'hex'));
const params={N:32768,r:8,p:3,maxmem:64*1024*1024};
export async function hashPassword(password,salt=randomBytes(16).toString('hex')){
 const hash=await derive(password,salt,64,params);
 return 'scrypt$'+salt+'$'+hash.toString('hex');
}
export async function verifyPassword(password,stored){
 const [kind,salt,hash]=stored.split('$');if(kind!=='scrypt'||! /^[a-f0-9]{32}$/.test(salt)||! /^[a-f0-9]{128}$/.test(hash))return false;
 return equal(await hashPassword(password,salt),stored);
}
export function authConfig(env={}){
 const setup=env.HS_SETUP_TOKEN||'';
 if(setup&&(setup.length<32||setup.length>256))throw Error('Setup token must be 32–256 characters');
 return {setup,secureCookie:env.HS_SECURE_COOKIE==='1'};
}
export function createAuth(db,config=authConfig(),clock=Date.now){
 const audit=(event,user=null,detail='')=>db.prepare('INSERT INTO security_audit(ts,event,user_id,detail) VALUES(?,?,?,?)').run(clock(),event,user,detail);
 const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}};
 function valid(email,password){
 return typeof email==='string'&&email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&typeof password==='string'&&password.length>=12&&password.length<=128;
 }
 const normalize=email=>email.trim().toLowerCase();
 const count=()=>db.prepare('SELECT count(*) n FROM users').get().n;
 const getUser=id=>db.prepare('SELECT id,email,role FROM users WHERE id=?').get(id);
 const households=user=>user.role==='owner'?db.prepare('SELECT id,name FROM households ORDER BY id').all():db.prepare('SELECT h.id,h.name FROM households h JOIN memberships m ON m.household_id=h.id WHERE m.user_id=? ORDER BY h.id').all(user.id);
 const allowed=(user,household)=>households(user).some(h=>h.id===household);
 async function register(body,owner=null){
 const email=typeof body?.email==='string'?normalize(body.email):null,password=body?.password;
 if(!valid(email,password))throw Error('Invalid registration');
 if(owner?.role!=='owner'&&(!config.setup||!equal(body.setupToken,config.setup)||count()!==0))throw Error('Registration not authorised');
 const hash=await hashPassword(password);
 return tx(()=>{
 const bootstrap=!owner;
 if(bootstrap&&count()!==0)throw Error('Setup closed');
 if(!bootstrap&&getUser(owner.id)?.role!=='owner')throw Error('Registration not authorised');
 if(count()>=100)throw Error('Account limit');
 const id=randomUUID(),role=bootstrap?'owner':'viewer';
 if(!bootstrap&&(!Array.isArray(body.households)||!body.households.length||body.households.length>20||new Set(body.households).size!==body.households.length||body.households.some(h=>typeof h!=='string'||!allowed(owner,h))))throw Error('Invalid memberships');
 db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,email,hash,role,clock());
 if(!bootstrap)for(const h of body.households)db.prepare('INSERT INTO memberships VALUES(?,?)').run(id,h);
 audit('account_created',owner?.id??id,role);return getUser(id);
 });
 }
 async function login(body){
 const email=typeof body?.email==='string'?normalize(body.email):null,password=body?.password;
 if(!valid(email,password)){audit('login_failed');return null;}
 const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
 const dummy='scrypt$'+'0'.repeat(32)+'$'+'0'.repeat(128);
 const verified=await verifyPassword(password,user?.password_hash??dummy);
 if(!user||!verified){audit('login_failed');return null;}
 return tx(()=>{const now=clock(),token=random(),csrf=random();
 db.prepare('DELETE FROM sessions WHERE expires<=?').run(now);
 db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
 db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(digest(token),user.id,csrf,now,now+DAY);
 audit('login_success',user.id);return {token,csrf,user:getUser(user.id)};});
 }
 function session(cookie){
 if(typeof cookie!=='string')return null;
 const values=cookie.split(';').map(x=>x.trim()).filter(x=>x.startsWith('hs_session='));
 if(values.length!==1)return null;
 const token=values[0].slice(11);if(!/^[a-f0-9]{64}$/.test(token))return null;
 const row=db.prepare('SELECT s.hash,s.csrf,s.expires,u.id,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>?').get(digest(token),clock());
 return row??null;
 }
 function logout(s){db.prepare('DELETE FROM sessions WHERE hash=?').run(s.hash);audit('logout',s.id);}
 function cookie(token){return 'hs_session='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+(token?86400:0)+(config.secureCookie?'; Secure':'');}
 return {register,login,session,logout,cookie,households,allowed,audit,csrf:(s,value)=>equal(s.csrf,value),setupAvailable:()=>count()===0&&!!config.setup,logs:()=>db.prepare('SELECT id,ts,event,user_id,detail FROM security_audit ORDER BY id DESC LIMIT 100').all()};
}
