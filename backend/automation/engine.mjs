import {randomUUID} from 'node:crypto';
import {metrics} from '../db.mjs';
const MIN=60000;
const light=/^light\.[a-z0-9_]{1,100}$/;
export function automationConfig(env={}){
 const entities=JSON.parse(env.HS_AUTOMATION_LIGHTS||'[]');
 if(!Array.isArray(entities)||entities.length>50||entities.some(e=>typeof e!=='string'||!light.test(e))||new Set(entities).size!==entities.length)throw Error('Invalid light allowlist');
 const live=env.HS_AUTOMATION_LIVE==='1',token=env.HS_AUTOMATION_ADMIN_TOKEN||'';
 if(token&&(token.length<32||token.length>256))throw Error('Automation admin token must be 32–256 characters');
 let url=null,haToken=null;
 if(live){
 const u=new URL(env.HS_AUTOMATION_HA_URL||'');
 if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||!env.HS_AUTOMATION_HA_TOKEN||!token||!entities.length)throw Error('Live automation requires HTTPS, separate HA credential, admin token and allowlist');
 url=u.origin;haToken=env.HS_AUTOMATION_HA_TOKEN;
 }
 return {entities,live,token,url,haToken};
}
export function createEngine(db,config=automationConfig(),{fetcher=fetch,clock=Date.now}={}){
 let active=null;
 const audit=(event,rule=null,job=null,detail='')=>db.prepare('INSERT INTO automation_audit(ts,event,rule_id,job_id,detail) VALUES(?,?,?,?,?)').run(clock(),event,rule,job,detail);
 const stopped=()=>Boolean(db.prepare('SELECT stopped FROM automation_state WHERE id=1').get().stopped);
 const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}};
 // Every restart is fail-closed; never replay a potentially dispatched command.
 tx(()=>{db.prepare('UPDATE automation_state SET stopped=1').run();db.prepare("UPDATE automation_jobs SET state='uncertain' WHERE state='executing'").run();db.prepare("UPDATE automation_jobs SET state='cancelled' WHERE state='pending'").run();audit('startup_disarmed');});
 function validate(b){
 if(!b||typeof b.name!=='string'||!b.name.trim()||b.name.length>100||!['schedule','condition'].includes(b.kind)||!light.test(b.entity??'')||!config.entities.includes(b.entity)||!['turn_on','turn_off'].includes(b.action))throw Error('Invalid rule or non-allowlisted light');
 let spec;
 if(b.kind==='schedule'){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time??''))throw Error('Invalid UTC time');spec={time:b.time};}
 else{
 if(typeof b.device!=='string'||!Object.hasOwn(metrics,b.metric)||!['gt','lt'].includes(b.operator)||typeof b.threshold!=='number'||!Number.isFinite(b.threshold)||Math.abs(b.threshold)>1e9)throw Error('Invalid condition');
 const d=db.prepare('SELECT source FROM devices WHERE id=?').get(b.device);
 if(!d||(config.live&&d.source!=='live'))throw Error('Invalid sensor source');
 spec={device:b.device,metric:b.metric,operator:b.operator,threshold:b.threshold};
 }
 return spec;
 }
 function add(b){const spec=validate(b),id=randomUUID();return tx(()=>{if(db.prepare('SELECT count(*) n FROM automation_rules').get().n>=100)throw Error('Rule limit reached');db.prepare('INSERT INTO automation_rules VALUES(?,?,?,?,?,?,0,NULL,?)').run(id,b.name.trim(),b.kind,JSON.stringify(spec),b.entity,b.action,clock());audit('rule_created',id);return id;});}
 function enable(id,value){if(typeof value!=='boolean')throw Error('Invalid enabled flag');return tx(()=>{const r=db.prepare('SELECT * FROM automation_rules WHERE id=?').get(id);if(!r)throw Error('Rule not found');if(value&&!config.entities.includes(r.entity))throw Error('Target not allowed');db.prepare('UPDATE automation_rules SET enabled=?,last_key=NULL WHERE id=?').run(Number(value),id);if(!value)db.prepare("UPDATE automation_jobs SET state='cancelled' WHERE rule_id=? AND state='pending'").run(id);audit(value?'rule_enabled':'rule_disabled',id);});}
 function emergency(value){if(typeof value!=='boolean')throw Error('Invalid stop flag');if(value)active?.abort();return tx(()=>{db.prepare('UPDATE automation_state SET stopped=? WHERE id=1').run(Number(value));if(value)db.prepare("UPDATE automation_jobs SET state='cancelled' WHERE state='pending'").run();audit(value?'emergency_stop':'manual_arm');});}
 function trigger(r,now){
 const s=JSON.parse(r.spec);
 if(r.kind==='schedule'){const iso=new Date(now).toISOString();return iso.slice(11,16)===s.time?'schedule:'+iso.slice(0,10):null;}
 const d=db.prepare('SELECT online,source FROM devices WHERE id=?').get(s.device);
 if(!d?.online||(config.live&&d.source!=='live'))return null;
 const v=db.prepare('SELECT ts,value,quality FROM readings WHERE device_id=? AND metric=? ORDER BY ts DESC LIMIT 1').get(s.device,s.metric);
 if(!v||v.quality!=='good'||!Number.isFinite(v.value)||v.ts>now||now-v.ts>5*MIN)return null;
 return (s.operator==='gt'?v.value>s.threshold:v.value<s.threshold)?'condition:'+v.ts:null;
 }
 function tick(now=clock()){return tx(()=>{
 db.prepare("UPDATE automation_jobs SET state='expired' WHERE state='pending' AND expires<=?").run(now);
 if(stopped())return 0;
 let count=0;
 for(const r of db.prepare('SELECT * FROM automation_rules WHERE enabled=1').all()){
 if(!config.entities.includes(r.entity))continue;
 const key=trigger(r,now);
 // Edge-triggered conditions; require an observed false fresh sample to rearm.
 if(!key){if(r.kind==='condition'){
 const s=JSON.parse(r.spec),d=db.prepare('SELECT online,source FROM devices WHERE id=?').get(s.device),v=db.prepare('SELECT ts,value,quality FROM readings WHERE device_id=? AND metric=? ORDER BY ts DESC LIMIT 1').get(s.device,s.metric);
 if(d?.online&&(!config.live||d.source==='live')&&v?.quality==='good'&&Number.isFinite(v.value)&&v.ts<=now&&now-v.ts<=5*MIN&&!(s.operator==='gt'?v.value>s.threshold:v.value<s.threshold))db.prepare('UPDATE automation_rules SET last_key=NULL WHERE id=?').run(r.id);
 }continue;}
 if(r.last_key===key||(r.kind==='condition'&&r.last_key!==null))continue;
 if(db.prepare("SELECT 1 FROM automation_jobs WHERE rule_id=? AND state IN('pending','executing')").get(r.id))continue;
 if(db.prepare("SELECT 1 FROM automation_jobs WHERE rule_id=? AND created>?").get(r.id,now-5*MIN))continue;
 const id=randomUUID();
 const inserted=db.prepare("INSERT OR IGNORE INTO automation_jobs VALUES(?,?,?,'pending',?,?)").run(id,r.id,key,now,now+2*MIN);
 db.prepare('UPDATE automation_rules SET last_key=? WHERE id=?').run(key,r.id);
 if(inserted.changes){audit('approval_requested',r.id,id);count++;}
 }
 return count;});}
 async function approve(id){
 if(active)throw Error('Another command is active');
 const controller=new AbortController();
 const r=tx(()=>{
 if(stopped())throw Error('Emergency stop active');
 const j=db.prepare('SELECT j.*,r.enabled,r.entity,r.action,r.kind,r.spec FROM automation_jobs j JOIN automation_rules r ON r.id=j.rule_id WHERE j.id=?').get(id);
 if(!j||j.state!=='pending'||j.expires<=clock()||!j.enabled||!config.entities.includes(j.entity)||!light.test(j.entity)||!['turn_on','turn_off'].includes(j.action))throw Error('Approval no longer valid');
 if(j.kind==='condition'&&!trigger(j,clock()))throw Error('Condition no longer valid');
 if(db.prepare("SELECT 1 FROM automation_audit WHERE event='approved' AND job_id<>? AND ts>?").get(id,clock()-MIN))throw Error('Command cooldown');
 db.prepare("UPDATE automation_jobs SET state='executing' WHERE id=?").run(id);audit('approved',j.rule_id,id);return j;
 });
 active=controller;let outcome='simulated';
 try{
 if(config.live){
 if(stopped()||controller.signal.aborted)throw Error('Stopped');
 outcome='uncertain';
 const response=await fetcher(config.url+'/api/services/light/'+r.action,{method:'POST',headers:{Authorization:'Bearer '+config.haToken,'Content-Type':'application/json'},body:JSON.stringify({entity_id:r.entity}),redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(8000)])});
 if(response.ok&&!controller.signal.aborted)outcome='succeeded';
 }
 }catch{outcome='uncertain';}
 finally{active=null;tx(()=>{db.prepare('UPDATE automation_jobs SET state=? WHERE id=?').run(outcome,id);audit('execution_'+outcome,r.rule_id,id);});}
 return outcome;
 }
 function reject(id){return tx(()=>{const j=db.prepare("SELECT rule_id FROM automation_jobs WHERE id=? AND state='pending'").get(id);if(!j)throw Error('Approval not pending');db.prepare("UPDATE automation_jobs SET state='cancelled' WHERE id=?").run(id);audit('approval_rejected',j.rule_id,id);});}
 function snapshot(){return {stopped:stopped(),live:config.live,entities:config.entities,rules:db.prepare('SELECT * FROM automation_rules ORDER BY created DESC').all().map(r=>({...r,spec:JSON.parse(r.spec)})),jobs:db.prepare('SELECT j.*,r.name,r.entity,r.action FROM automation_jobs j JOIN automation_rules r ON r.id=j.rule_id ORDER BY j.created DESC LIMIT 100').all(),audit:db.prepare('SELECT * FROM automation_audit ORDER BY id DESC LIMIT 100').all()};}
 return {add,enable,emergency,tick,approve,reject,snapshot,stop(){emergency(true);}};
}
