import {createServer} from 'node:https';
import {readFileSync,statSync} from 'node:fs';
import {isIP} from 'node:net';
import {api} from '../api.mjs';
import {mobileService} from './service.mjs';
import {tariffConfig} from '../energy-intelligence.mjs';
export function gatewayConfig(env={}){
 if(env.HS_MOBILE_ENABLED!=='1')return null;
 const origin=new URL(env.HS_MOBILE_ORIGIN||''),host=env.HS_MOBILE_BIND||'127.0.0.1';
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||isIP(host)!==4||host==='0.0.0.0'||!(/^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)))throw Error('Trusted HTTPS origin and explicit private IPv4 bind required');
 const port=Number(env.HS_MOBILE_PORT||8443);
 if(!Number.isInteger(port)||port<1024||port>65535||Number(origin.port||443)!==port)throw Error('Origin and listener port must match');
 const keyPath=env.HS_MOBILE_TLS_KEY,certPath=env.HS_MOBILE_TLS_CERT;
 if(!keyPath||!certPath||(process.platform!=='win32'&&(statSync(keyPath).mode&0o077)))throw Error('Private TLS key required');
 return {origin:origin.origin,host,port,key:readFileSync(keyPath),cert:readFileSync(certPath)};
}
export function makeGateway(db,config,tariff=tariffConfig(),service=mobileService(db)){
 let start=Date.now(),count=0,pairs=0;
 const routes=new Set(['rooms','devices','latest','history','energy','energy/report']);
 return createServer({key:config.key,cert:config.cert,minVersion:'TLSv1.2',requestTimeout:15000,headersTimeout:10000},async(req,res)=>{
 const json=(status,data)=>res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Strict-Transport-Security':'max-age=31536000'}).end(JSON.stringify(data));
 try{
 if(!req.socket.encrypted||req.headers.host!==new URL(config.origin).host||req.headers.origin||req.headers.cookie)return json(403,{error:'Native HTTPS only'});
 const now=Date.now();if(now-start>=60000){start=now;count=0;pairs=0;}if(++count>600)return json(429,{error:'Rate limited'});
 const u=new URL(req.url,config.origin);if(u.origin!==config.origin)return json(403,{error:'Invalid origin'});
 if(u.pathname==='/mobile/v1/status'&&req.method==='GET')return json(200,{protocol:1,pairing:true});
 if(u.pathname==='/mobile/v1/pair'&&req.method==='POST'){
 if(++pairs>10)return json(429,{error:'Rate limited'});
 if((req.headers['content-type']||'').split(';')[0]!=='application/json')return json(415,{error:'JSON required'});
 let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>4096)return json(413,{error:'Too large'});chunks.push(c);}
 try{return json(200,service.redeem(JSON.parse(Buffer.concat(chunks).toString())));}catch{service.audit('mobile_pairing_rejected');return json(403,{error:'Pairing rejected'});}
 }
 const d=service.authenticate(req.headers.authorization);if(!d)return json(401,{error:'Credential invalid or expired'});
 if(u.pathname==='/mobile/v1/session'&&req.method==='GET')return json(200,{id:d.id,household:d.household_id,name:d.name,expires:d.expires,scope:'read'});
 if(u.pathname==='/mobile/v1/session'&&req.method==='DELETE'){service.revoke(d.id,d.user_id);return json(200,{ok:true});}
 if(req.method!=='GET')return json(405,{error:'Read only'});
 const path=u.pathname.slice('/mobile/v1/'.length);if(!u.pathname.startsWith('/mobile/v1/')||!routes.has(path))return json(404,{error:'Not found'});
 if(u.searchParams.has('household')&&u.searchParams.get('household')!==d.household_id){service.audit('mobile_household_denied',d.user_id);return json(403,{error:'Household denied'});}
 const internal=new URL('/api/'+path,'http://localhost');internal.search=u.search;internal.searchParams.set('household',d.household_id);
 const result=api(db,internal,now,tariff);return json(result.status,result.data);
 }catch{return json(400,{error:'Request rejected'});}
 });
}
