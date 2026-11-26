import {integrate} from './energy.mjs';
const DAY=86400000,HOUR=3600000,GAP=1800000;
export const energyMetrics=['consumption','solar','grid_import','grid_export'];
export function tariffConfig(env={}){
 const number=(key,max)=>{const raw=env[key];if(raw===undefined||raw==='')return null;const n=Number(raw);if(!String(raw).trim()||!Number.isFinite(n)||n<0||n>max)throw Error('Invalid '+key);return n;};
 const currency=env.HS_ENERGY_CURRENCY||'GBP';
 if(!/^[A-Z]{3}$/.test(currency))throw Error('Invalid currency');
 return {currency,importRate:number('HS_IMPORT_RATE',100),exportRate:number('HS_EXPORT_RATE',100),standingCharge:number('HS_STANDING_CHARGE',100),carbonFactor:number('HS_CARBON_FACTOR',10)};
}
export function periodBounds(period,now){
 if(!['day','month'].includes(period)||!Number.isSafeInteger(now)||now<0)throw Error('Invalid period');
 const d=new Date(now),day=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());
 return {from:period==='day'?day:Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1),to:now};
}
const sum=(values)=>values.some(v=>v===null)?null:values.reduce((a,b)=>a+b,0);
export function estimateCosts(metrics,tariff,days){
 const imported=metrics.grid_import,exported=metrics.grid_export;
 const importCost=tariff.importRate===null||imported.kWh===null?null:imported.kWh*tariff.importRate;
 const exportCredit=tariff.exportRate===null||exported.kWh===null?null:exported.kWh*tariff.exportRate;
 const standingCost=tariff.standingCharge===null?null:tariff.standingCharge*days;
 const gross=sum([importCost,standingCost]);
 const net=gross===null||exportCredit===null?null:gross-exportCredit;
 return {currency:tariff.currency,importCost,exportCredit,standingCost,gross,net,partial:imported.coverage<0.999999||exported.coverage<0.999999,carbonKg:tariff.carbonFactor===null||imported.kWh===null?null:imported.kWh*tariff.carbonFactor,carbonCoverage:imported.coverage};
}
export function forecastDays(days){
 // Only complete UTC days with >=90% coverage; no invented values for gaps.
 const usable=days.filter(d=>d.coverage>=0.9&&Number.isFinite(d.kWh));
 if(usable.length<3)return {status:'insufficient_history',sampleDays:usable.length,nextDayKWh:null,next7DaysKWh:null,backtestMAE:null};
 const recent=usable.slice(-7),mean=a=>a.reduce((s,d)=>s+d.kWh,0)/a.length;
 const estimate=mean(recent),errors=[];
 for(let i=3;i<usable.length;i++)errors.push(Math.abs(usable[i].kWh-mean(usable.slice(Math.max(0,i-7),i))));
 return {status:'baseline',sampleDays:recent.length,nextDayKWh:estimate,next7DaysKWh:estimate*7,backtestMAE:errors.length?errors.reduce((s,e)=>s+e,0)/errors.length:null};
}
export function peakUsage(rows,from,to){
 let peak=null;for(const r of rows)if(r.ts>=from&&r.ts<=to&&r.quality==='good'&&Number.isFinite(r.value)&&(!peak||r.value>peak.watts))peak={watts:r.value,ts:r.ts};
 return peak;
}
export function solarAdvice(solar,exported){
 if(solar.kWh===null||exported.kWh===null||solar.coverage<0.9||exported.coverage<0.9)return {status:'insufficient_coverage',message:'More solar and export data is needed to assess opportunities.'};
 if(exported.kWh>0.25&&solar.kWh>0.25)return {status:'opportunity',message:'Review exporting periods and consider shifting flexible appliance use into solar generation hours. Export may include battery discharge; verify before acting.'};
 return {status:'no_clear_opportunity',message:'No substantial export opportunity is evident in this period.'};
}
function load(db,device,from,to){
 const stmt=db.prepare('SELECT ts,value,quality FROM readings WHERE device_id=? AND metric=? AND ts BETWEEN ? AND ? ORDER BY ts LIMIT 150001');
 return Object.fromEntries(energyMetrics.map(m=>{const rows=stmt.all(device,m,Math.max(0,from-GAP),to);if(rows.length>150000)throw Error('Too many readings for analytics');return [m,rows];}));
}
function measures(rows,from,to){
 return Object.fromEntries(energyMetrics.map(m=>[m,to>from?integrate(rows[m],from,to):{kWh:null,coverage:0,coveredMs:0}]));
}
export function energyReport(db,{device,household,period='day',now=Date.now(),tariff=tariffConfig()}){
 const d=db.prepare('SELECT id,source FROM devices WHERE id=? AND household_id=?').get(device,household);
 if(!d)return null;
 const {from,to}=periodBounds(period,now),today=periodBounds('day',now).from;
 const historyFrom=Math.max(0,today-14*DAY);
 const rows=load(db,device,Math.min(from,historyFrom),to);
 const metrics=measures(rows,from,to),buckets=[],training=[];
 const step=period==='day'?HOUR:DAY;
 for(let start=from;start<to;start+=step){
 const end=Math.min(start+step,to);
 buckets.push({from:start,to:end,metrics:measures(rows,start,end)});
 }
 for(let start=historyFrom;start<today;start+=DAY){
 const r=integrate(rows.consumption,start,start+DAY);training.push({from:start,kWh:r.kWh,coverage:r.coverage});
 }
 return {device,household,source:d.source,period,timezone:'UTC',from,to,metrics,buckets,tariff,cost:estimateCosts(metrics,tariff,(to-from)/DAY),peak:peakUsage(rows.consumption,from,to),forecast:forecastDays(training),solar:solarAdvice(metrics.solar,metrics.grid_export),notice:'Estimates for observed intervals; flat tariff and constant carbon factor. Standing charge prorated. Not a bill or guaranteed forecast.'};
}
