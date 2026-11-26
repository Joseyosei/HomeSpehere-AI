const root=document.querySelector('#energy-report'),house=document.querySelector('#household'),device=document.querySelector('#energy-device'),period=document.querySelector('#energy-period'),metric=document.querySelector('#energy-metric'),status=document.querySelector('#energy-status'),cards=document.querySelector('#energy-cards'),chart=document.querySelector('#energy-chart'),details=document.querySelector('#energy-details'),table=document.querySelector('#energy-table');
const get=async p=>{const r=await fetch(p);if(!r.ok)throw Error('Request failed');return r.json();};
const add=(p,tag,text)=>{const e=document.createElement(tag);e.textContent=text;p.append(e);return e;};
let generation=0,report=null;
const fmt=(v,suffix='')=>v===null||v===undefined?'Unavailable':v.toFixed(2)+suffix;
const label=m=>m.replaceAll('_',' ');
function draw(){
 if(!report)return;chart.replaceChildren();table.replaceChildren();
 const selected=metric.value,values=report.buckets.map(b=>b.metrics[selected]),max=Math.max(0.01,...values.map(v=>v.kWh??0));
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 640 220');svg.setAttribute('role','img');svg.setAttribute('aria-label',label(selected)+' in kWh; missing buckets omitted');
 const heading=add(table,'tr','');for(const t of ['UTC interval','Energy (kWh)','Coverage'])add(heading,'th',t);
 for(let i=0;i<values.length;i++){
 const v=values[i],b=report.buckets[i],time=new Date(b.from).toISOString().slice(0,16).replace('T',' ');
 const tr=add(table,'tr','');add(tr,'td',time);add(tr,'td',fmt(v.kWh));add(tr,'td',Math.round(v.coverage*100)+'%');
 if(v.kWh===null)continue;
 const width=600/Math.max(1,values.length),height=v.kWh/max*170,rect=document.createElementNS(ns,'rect');
 for(const [k,val] of Object.entries({x:20+i*width,y:190-height,width:Math.max(1,width-3),height:Math.max(1,height),fill:v.coverage<0.9?'#b69e72':'#74bca3',tabindex:0}))rect.setAttribute(k,val);
 const title=document.createElementNS(ns,'title');title.textContent=time+': '+fmt(v.kWh,' kWh')+' ('+Math.round(v.coverage*100)+'% coverage)';rect.append(title);
 const announce=()=>{document.querySelector('#energy-point').textContent=title.textContent;};rect.addEventListener('focus',announce);rect.addEventListener('pointerenter',announce);svg.append(rect);
 }
 chart.append(svg);document.querySelector('#energy-point').textContent='Focus or hover over a bar for details. Missing intervals are blank; amber means partial coverage.';
}
function render(r){
 report=r;cards.replaceChildren();details.replaceChildren();
 for(const [m,v] of Object.entries(r.metrics)){const c=add(cards,'article','');c.className='metric';add(c,'span',label(m));add(c,'strong',fmt(v.kWh,' kWh'));add(c,'small',Math.round(v.coverage*100)+'% coverage');}
 const c=r.cost,f=r.forecast;
 for(const t of ['Estimated import cost: '+fmt(c.importCost,' '+c.currency),'Export credit: '+fmt(c.exportCredit,' '+c.currency),'Prorated standing charge: '+fmt(c.standingCost,' '+c.currency),'Estimated net cost: '+fmt(c.net,' '+c.currency),'Grid emissions: '+fmt(c.carbonKg,' kg CO₂e'),'Peak observed consumption: '+(r.peak?fmt(r.peak.watts,' W')+' at '+new Date(r.peak.ts).toISOString():'Unavailable'),'Next UTC day forecast: '+fmt(f.nextDayKWh,' kWh'),'Next seven days forecast: '+fmt(f.next7DaysKWh,' kWh'),'Forecast training days: '+f.sampleDays+'; historical backtest MAE: '+fmt(f.backtestMAE,' kWh'),r.solar.message,r.notice])add(details,'p',t);
 if(c.partial)add(details,'p','Cost coverage is incomplete; totals may omit unobserved intervals.');
 draw();
}
async function refresh(){
 const token=++generation,h=house.value||'demo',d=device.value;report=null;cards.replaceChildren();chart.replaceChildren();details.replaceChildren();table.replaceChildren();document.querySelector('#energy-point').textContent='';
 if(!d){status.textContent='Select an energy meter.';return;}
 status.textContent='Loading energy report…';
 try{const r=await get('/api/energy/report?'+new URLSearchParams({household:h,device:d,period:period.value}));if(token!==generation)return;render(r);status.textContent=r.source+' · '+r.timezone+' · '+r.period+' to date';}
 catch{if(token===generation)status.textContent='Energy report unavailable. Check the selected meter and retry.';}
}
async function selectDevices(){
 const token=++generation,h=house.value||'demo';device.replaceChildren();report=null;cards.replaceChildren();chart.replaceChildren();details.replaceChildren();table.replaceChildren();document.querySelector('#energy-point').textContent='';status.textContent='Loading meters…';
 try{const q='?household='+encodeURIComponent(h),[devices,latest]=await Promise.all([get('/api/devices'+q),get('/api/latest'+q)]);if(token!==generation)return;
 const ids=new Set(latest.filter(r=>['consumption','solar','grid_import','grid_export'].includes(r.metric)).map(r=>r.device_id));
 for(const d of devices.filter(d=>ids.has(d.id))){const o=add(device,'option',d.name);o.value=d.id;}await refresh();}
 catch{if(token===generation)status.textContent='Unable to load meters.';}
}
house.addEventListener('change',selectDevices);house.addEventListener('homes-ready',selectDevices);device.addEventListener('change',refresh);period.addEventListener('change',refresh);metric.addEventListener('change',draw);document.querySelector('#energy-refresh').addEventListener('click',()=>device.value?refresh():selectDevices());if(house.value)void selectDevices();
