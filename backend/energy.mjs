// Trapezoidal integration of adjacent good samples, no extrapolation or gap filling.
export function integrate(rows,from,to,maxGapMs=1800000){
 let wattMs=0,coveredMs=0;
 for(let i=1;i<rows.length;i++){
 const a=rows[i-1],b=rows[i],dt=b.ts-a.ts;
 if(dt<=0||dt>maxGapMs||a.quality!=='good'||b.quality!=='good'||!Number.isFinite(a.value)||!Number.isFinite(b.value))continue;
 const l=Math.max(from,a.ts),r=Math.min(to,b.ts);if(r<=l)continue;
 const v1=a.value+(b.value-a.value)*(l-a.ts)/dt,v2=a.value+(b.value-a.value)*(r-a.ts)/dt;
 wattMs+=(v1+v2)/2*(r-l);coveredMs+=r-l;
 }
 return {kWh:coveredMs?wattMs/3600000000:null,coveredMs,coverage:coveredMs/(to-from)};
}
export function energySummary(db,device,from,to){
 const readings=db.prepare('SELECT ts,value,quality FROM readings WHERE device_id=? AND metric=? AND ts BETWEEN ? AND ? ORDER BY ts');
 return Object.fromEntries(['consumption','solar','grid_import','grid_export'].map(metric=>[metric,integrate(readings.all(device,metric,Math.max(0,from-1800000),to+1800000),from,to)]));
}
