import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {createAuth} from '../auth/service.mjs';
const digest=s=>createHash('sha256').update(s).digest('hex'),secret=()=>randomBytes(32).toString('hex'),valid=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
export function mobileService(db,clock=Date.now){
 const auth=createAuth(db,undefined,clock);
 const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}};
 const user=id=>db.prepare('SELECT id,role FROM users WHERE id=?').get(id);
 const permitted=(id,h)=>{const u=user(id);return !!u&&auth.allowed(u,h);};
 function issue(owner,{userId,household}){
 if(owner?.role!=='owner'||user(owner.id)?.role!=='owner'||typeof userId!=='string'||typeof household!=='string'||!permitted(userId,household))throw Error('Not authorised');
 return tx(()=>{const now=clock(),code=secret();db.prepare('DELETE FROM mobile_pairings WHERE expires<=? OR user_id=?').run(now,userId);
 if(db.prepare('SELECT count(*) n FROM mobile_pairings').get().n>=100)throw Error('Pairing limit');
 db.prepare('INSERT INTO mobile_pairings VALUES(?,?,?,?)').run(digest(code),userId,household,now+5*60000);auth.audit('mobile_pairing_issued',owner.id);return {code,expires:now+5*60000};});
 }
 function redeem({code,name}){
 if(!valid(code)||typeof name!=='string'||!name.trim()||name.length>80)throw Error('Invalid pairing');
 return tx(()=>{const now=clock(),p=db.prepare('SELECT * FROM mobile_pairings WHERE hash=? AND expires>?').get(digest(code),now);
 if(!p||!permitted(p.user_id,p.household_id))throw Error('Invalid pairing');
 if(db.prepare('SELECT count(*) n FROM mobile_credentials WHERE user_id=? AND revoked=0 AND expires>?').get(p.user_id,now).n>=10)throw Error('Device limit');
 const token=secret(),id=randomUUID(),expires=now+30*86400000;
 db.prepare('DELETE FROM mobile_pairings WHERE hash=?').run(digest(code));
 db.prepare('INSERT INTO mobile_credentials(id,hash,user_id,household_id,name,created,expires) VALUES(?,?,?,?,?,?,?)').run(id,digest(token),p.user_id,p.household_id,name.trim(),now,expires);auth.audit('mobile_paired',p.user_id,id);return {token,id,household:p.household_id,expires};});
 }
 function authenticate(header){if(typeof header!=='string'||!header.startsWith('Bearer '))return null;const token=header.slice(7);if(!valid(token))return null;
 const d=db.prepare('SELECT id,user_id,household_id,name,expires FROM mobile_credentials WHERE hash=? AND revoked=0 AND expires>?').get(digest(token),clock());return d&&permitted(d.user_id,d.household_id)?d:null;}
 function revoke(id,actor){const row=db.prepare('SELECT user_id FROM mobile_credentials WHERE id=?').get(id);if(!row)return false;
 db.prepare('UPDATE mobile_credentials SET revoked=1 WHERE id=?').run(id);auth.audit('mobile_revoked',actor,id);return true;}
 return {issue,redeem,authenticate,revoke,list:()=>db.prepare('SELECT id,user_id,household_id,name,created,expires,revoked FROM mobile_credentials ORDER BY created DESC LIMIT 200').all(),users:()=>db.prepare('SELECT id,email,role FROM users ORDER BY email').all(),audit:auth.audit};
}
