import {energySummary} from '../energy.mjs';
const DAY=86400000;
const floors={consumption:300,solar:300,grid_import:300,grid_export:300,temperature:2,humidity:10,battery:15};
const median=values=>{const a=[...values].sort((a,b)=>a-b),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
export function anomaly(metric,value,baseline){
 if(!Object.hasOwn(floors,metric)||!Number.isFinite(value)||baseline.length<8||baseline.some(v=>!Number.isFinite(v)))return null;
 const center=median(baseline),mad=median(baseline.map(v=>Math.abs(v-center))),delta=value-center;
 if(Math.abs(delta)<Math.max(floors[metric],4*1.4826*mad))return null;
 return {direction:delta>0?'above':'below',baselineMedian:center,samples:baseline.length};
}
export function householdContext(db,household,now=Date.now()){
 if(!['demo','live'].includes(household)||!db.prepare('SELECT 1 FROM households WHERE id=?').get(household))return null;
 const devices=db.prepare('SELECT id,online FROM devices WHERE household_id=? AND source=? ORDER BY id LIMIT 50').all(household,household);
 const facts=[],recommendations=[],anomalies=[];
 const latest=db.prepare('SELECT metric,ts,value,unit,quality FROM readings WHERE device_id=? AND ts<=? AND ts=(SELECT max(x.ts) FROM readings x WHERE x.device_id=readings.device_id AND x.metric=readings.metric AND x.ts<=?) ORDER BY metric');
 const historical=db.prepare("SELECT value FROM readings WHERE device_id=? AND metric=? AND ts>=? AND ts<? AND quality='good' ORDER BY ts DESC LIMIT 96");
 const makeFact=(kind,text)=>{const id='F'+(facts.length+1);facts.push({id,kind,text});return id;};
 for(let i=0;i<devices.length;i++){
 const d=devices[i],label='Device '+(i+1);
 const status=makeFact('status',label+': '+(d.online?'last observed online':'offline'));
 if(!d.online)recommendations.push({text:label+': check the sensor connection.',refs:[status]});
 const rows=latest.all(d.id,now,now);
 for(const r of rows){
 const fresh=Boolean(d.online)&&r.quality==='good'&&Number.isFinite(r.value)&&now-r.ts<=1800000;
 const id=makeFact(r.metric,label+' '+r.metric+': '+(fresh?r.value+' '+r.unit:'unavailable, stale or offline')+'; sample '+new Date(r.ts).toISOString());
 if(!fresh)continue;
 const a=anomaly(r.metric,r.value,historical.all(d.id,r.metric,Math.max(0,r.ts-DAY),r.ts).map(x=>x.value));
 if(a){const ref=makeFact('anomaly',label+' '+r.metric+' is '+a.direction+' recent median '+a.baselineMedian.toFixed(2)+' '+r.unit+' ('+a.samples+' prior samples; heuristic, not a diagnosis).');anomalies.push({text:facts.at(-1).text,refs:[id,ref]});}
 if(r.metric==='consumption'&&r.value>1500)recommendations.push({text:label+': review which appliances are running; avoid interrupting essential equipment.',refs:[id]});
 if(r.metric==='humidity'&&r.value>60)recommendations.push({text:label+': consider ventilation if outdoor conditions permit.',refs:[id]});
 if(r.metric==='battery'&&r.value<20)recommendations.push({text:label+': check battery charging or replacement guidance.',refs:[id]});
 }
 if(rows.some(r=>['consumption','solar','grid_import','grid_export'].includes(r.metric))){
 const summary=energySummary(db,d.id,Math.max(0,now-DAY),now);
 for(const [metric,r] of Object.entries(summary))if(r.kWh!==null)makeFact('energy',label+' '+metric+' estimated '+r.kWh.toFixed(3)+' kWh over covered intervals in last 24h; coverage '+Math.round(r.coverage*100)+'%.');
 }
 }
 return {household,source:household==='demo'?'synthetic demo':'connected sensors',asOf:new Date(now).toISOString(),facts:facts.slice(0,120),recommendations:recommendations.filter(r=>r.refs.every(id=>facts.slice(0,120).some(f=>f.id===id))).slice(0,20),anomalies:anomalies.filter(r=>r.refs.every(id=>facts.slice(0,120).some(f=>f.id===id))).slice(0,20),limited:facts.length>120||devices.length===50};
}
