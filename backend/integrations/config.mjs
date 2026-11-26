import {readFileSync,statSync} from 'node:fs';
import {metrics} from '../db.mjs';
export function config(env=process.env){
 const allowInsecure=env.HS_ALLOW_INSECURE==='1';
 function endpoint(key,secure,plain){
  if(!env[key])return null;
  const u=new URL(env[key]);if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||!(u.protocol===secure||(allowInsecure&&u.protocol===plain)))throw Error('Invalid integration endpoint: '+key);
  return u.origin==='null'?u.href:u.origin;
 }
 function secret(key){
  if(env[key]&&env[key+'_FILE'])throw Error('Choose one secret source: '+key);
  if(env[key+'_FILE']){
   const path=env[key+'_FILE'];const s=statSync(path);
   if(!s.isFile()||s.size>8192||(process.platform!=='win32'&&(s.mode&0o077)))throw Error('Secret file must be private: '+key);
   return readFileSync(path,'utf8').trim();
  }
  return env[key]||undefined;
 }
 const haUrl=endpoint('HS_HA_URL','https:','http:'),mqttUrl=endpoint('HS_MQTT_URL','mqtts:','mqtt:');
 const token=secret('HS_HA_TOKEN'),password=secret('HS_MQTT_PASSWORD');
 if(haUrl&&!token)throw Error('Home Assistant token required');
 const poll=Number(env.HS_HA_POLL_MS??15000);
 if(!Number.isInteger(poll)||poll<5000||poll>300000)throw Error('Invalid poll interval');
 const mappings=JSON.parse(env.HS_MAPPINGS??'[]');
 if(!Array.isArray(mappings)||mappings.length>200)throw Error('Invalid mapping list');
 const keys=new Set(),targets=new Set();
 for(const m of mappings){
  if(!m||!['ha','mqtt'].includes(m.adapter)||typeof m.key!=='string'||m.key.length>256||!m.key||/[+#\u0000]/.test(m.key)||!Object.hasOwn(metrics,m.metric)||!/^[-a-zA-Z0-9_]{1,64}$/.test(m.device)||typeof m.name!=='string'||!m.name.trim()||m.name.length>100)throw Error('Invalid sensor mapping');
  if(m.adapter==='ha'&&!/^sensor\.[a-z0-9_]+$/.test(m.key))throw Error('Expected sensor entity ID');
  const key=m.adapter+':'+m.key,target=m.device+':'+m.metric;
  if(keys.has(key)||targets.has(target))throw Error('Duplicate mapping');
  keys.add(key);targets.add(target);
 }
 return {haUrl,token,mqttUrl,username:env.HS_MQTT_USERNAME,password,poll,mappings};
}
