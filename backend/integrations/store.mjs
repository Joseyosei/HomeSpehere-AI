import {insertReading,metrics} from '../db.mjs';
export function normalize(metric,raw,unit,ts,now=Date.now()){
 if(!Number.isSafeInteger(ts)||ts<0||ts>now+60000)throw Error('Invalid timestamp');
 if(!Object.hasOwn(metrics,metric))throw Error('Unknown metric');
 const expected=metrics[metric];
 let factor=1,offset=0;
 if(expected==='W'&&unit==='kW')factor=1000;
 else if(expected==='C'&&unit==='°F'){factor=5/9;offset=-32;}
 else if(expected==='C'&&unit==='°C'){}
 else if(unit!==expected)throw Error('Unexpected unit');
 if(raw===null||['unknown','unavailable'].includes(raw))return {metric,ts,value:null,unit:expected,quality:'missing'};
 if(typeof raw!=='number'&&(typeof raw!=='string'||!raw.trim()||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(raw.trim())))throw Error('Invalid sensor value');
 const value=(Number(raw)+offset)*factor;
 if(!Number.isFinite(value)||Math.abs(value)>1e9||(expected==='W'&&value<0)||(expected==='%'&&(value<0||value>100))||(expected==='C'&&value< -273.15))throw Error('Out of range');
 return {metric,ts,value,unit:expected,quality:'good'};
}
export function prepareLive(db,mappings){
 db.exec('BEGIN IMMEDIATE');
 try{
 db.prepare("INSERT OR IGNORE INTO households VALUES('live','Connected home')").run();
 db.prepare("INSERT OR IGNORE INTO rooms VALUES('live-unassigned','live','Unassigned')").run();
 for(const m of mappings){
 const id='live-'+m.device;
 db.prepare("INSERT OR IGNORE INTO devices VALUES(?,'live','live-unassigned',?,'sensor',0,'live')").run(id,m.name);
 const d=db.prepare('SELECT household_id,source FROM devices WHERE id=?').get(id);
 if(d.household_id!=='live'||d.source!=='live')throw Error('Device collision');
 db.prepare('UPDATE devices SET online=0 WHERE id=?').run(id);
 }
 db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function ingest(db,m,reading){
 const id='live-'+m.device;
 db.exec('BEGIN IMMEDIATE');
 try{
 const result=insertReading(db,{...reading,device_id:id});
 const latest=db.prepare('SELECT quality,ts FROM readings WHERE device_id=? AND metric=? ORDER BY ts DESC LIMIT 1').get(id,m.metric);
 db.prepare('UPDATE devices SET online=? WHERE id=?').run(Number(latest.quality==='good'&&Date.now()-latest.ts<=1800000),id);
 db.exec('COMMIT');return result.changes;
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function offline(db,mappings){for(const m of mappings)db.prepare("UPDATE devices SET online=0 WHERE id=? AND source='live'").run('live-'+m.device);}
