import {history,metrics} from './db.mjs';
import {energySummary} from './energy.mjs';
const DAY=86400000;
function range(q,now){
 const parse=(key,fallback)=>{const v=q.get(key);if(v===null)return fallback;if(!/^\d{1,15}$/.test(v))throw Error('Invalid timestamp');const n=Number(v);if(!Number.isSafeInteger(n)||n>253402300799999)throw Error('Invalid timestamp');return n;};
 const to=parse('to',now),from=parse('from',Math.max(0,to-DAY));
 if(from>=to||to-from>31*DAY)throw Error('Range must be positive and at most 31 days');
 return {from,to};
}
export function api(db,url,now=Date.now()){
 const q=url.searchParams;
 const ok=data=>({status:200,data});
 const fail=(status,error)=>({status,data:{error}});
 if(url.pathname==='/api/health')return ok({status:'ok',schema:db.prepare('PRAGMA user_version').get().user_version});
 if(url.pathname==='/api/households')return ok(db.prepare('SELECT * FROM households ORDER BY id').all());
 const household=q.get('household')??'demo';
 if(!db.prepare('SELECT 1 FROM households WHERE id=?').get(household))return fail(404,'Household not found');
 if(url.pathname==='/api/rooms')return ok(db.prepare('SELECT * FROM rooms WHERE household_id=? ORDER BY id').all(household));
 if(url.pathname==='/api/devices')return ok(db.prepare('SELECT * FROM devices WHERE household_id=? ORDER BY id').all(household));
 if(url.pathname==='/api/latest'){
 return ok(db.prepare(`SELECT d.id AS device_id,d.source,r.metric,r.ts,r.value,r.unit,r.quality FROM devices d JOIN readings r ON r.device_id=d.id WHERE d.household_id=? AND r.ts=(SELECT max(x.ts) FROM readings x WHERE x.device_id=r.device_id AND x.metric=r.metric) ORDER BY d.id,r.metric`).all(household).map(r=>({...r,stale:now-r.ts>1800000})));
 }
 if(!['/api/history','/api/energy'].includes(url.pathname))return fail(404,'Not found');
 const device=q.get('device')??'meter';
 const d=db.prepare('SELECT * FROM devices WHERE id=? AND household_id=?').get(device,household);
 if(!d)return fail(404,'Device not found');
 let dates;try{dates=range(q,now);}catch(e){return fail(400,e.message);}
 const {from,to}=dates;
 if(url.pathname==='/api/energy')return ok({device,source:d.source,from,to,metrics:energySummary(db,device,from,to)});
 const metric=q.get('metric')??'consumption',limitText=q.get('limit')??'1000',limit=Number(limitText);
 if(!Object.hasOwn(metrics,metric)||!/^\d+$/.test(limitText)||!Number.isInteger(limit)||limit<1||limit>5000)return fail(400,'Invalid metric or limit');
 const rows=history(db,device,metric,from,to,limit+1),truncated=rows.length>limit;
 return ok({device,source:d.source,metric,from,to,truncated,rows:rows.slice(0,limit)});
}
