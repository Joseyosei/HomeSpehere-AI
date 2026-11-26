import {insights} from './model.mjs';
const add=(p,tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;p.append(e);return e;};
const get=async p=>{const r=await fetch(p);if(!r.ok)throw Error('Request failed');return r.json();};
const metrics=document.querySelector('#overview'),select=document.querySelector('#household'),panel=document.querySelector('#energy'),status=document.querySelector('#connections'),advice=document.querySelector('#advice'),deviceList=document.querySelector('#device-list');
let busy=false;
async function refresh(){
 if(busy)return;busy=true;
 const household=select.value||'demo',q='?household='+encodeURIComponent(household);
 try{
 const [latest,devices,connections]=await Promise.all([get('/api/latest'+q),get('/api/devices'+q),get('/api/integrations').catch(()=>({}))]);
 const reading=metric=>{const rows=latest.filter(r=>r.metric===metric&&r.quality==='good'&&!r.stale&&devices.some(d=>d.id===r.device_id&&d.online));return rows.length===1?rows[0].value:null;};
 const data={powerW:reading('consumption'),solarW:reading('solar'),temperatureC:reading('temperature'),humidity:reading('humidity'),devices:devices.map(d=>({...d,online:Boolean(d.online)}))};
 const meters=[...new Set(latest.filter(r=>['consumption','solar','grid_import','grid_export'].includes(r.metric)).map(r=>r.device_id))];
 const energy=meters.length===1?await get('/api/energy'+q+'&device='+encodeURIComponent(meters[0])):null;
 if(select.value!==household)return;
 metrics.replaceChildren();panel.replaceChildren();status.replaceChildren();advice.replaceChildren();deviceList.replaceChildren();
 document.querySelector('.badge').textContent=household==='demo'?'Synthetic demo':'Connected home';
 for(const [label,value,unit] of [['Site consumption',data.powerW,'W'],['Solar generation',data.solarW,'W'],['Temperature',data.temperatureC,'°C'],['Humidity',data.humidity,'%']]){const c=add(metrics,'article','','metric');add(c,'span',label);add(c,'strong',value===null?'Unavailable':value+' '+unit);}
 add(panel,'h2','Energy history · last 24 hours');
 if(energy)for(const [metric,r] of Object.entries(energy.metrics))add(panel,'p',metric.replaceAll('_',' ')+': '+(r.kWh===null?'Unavailable':r.kWh.toFixed(2)+' kWh')+' · '+Math.round(r.coverage*100)+'% coverage');
 else add(panel,'p','No single energy meter selected. Use the API for individual devices.');
 add(status,'h2','Integration status');for(const [name,s] of Object.entries(connections))add(status,'p',name.toUpperCase()+': '+s.state);
 if(latest.some(r=>r.stale))add(status,'p','Some sensor readings are stale.');
 for(const a of insights(data))add(advice,'li',a);
 for(const d of data.devices){const row=add(deviceList,'li','');add(row,'span',d.name);add(row,'span',d.online?'Online':'Offline');}
 }catch{metrics.replaceChildren();panel.replaceChildren();status.replaceChildren();advice.replaceChildren();deviceList.replaceChildren();add(metrics,'p','Unable to load readings. Retrying…');}finally{busy=false;}
}
try{const homes=await get('/api/households');for(const h of homes){const o=add(select,'option',h.name);o.value=h.id;}select.value=homes[0]?.id??'';select.dispatchEvent(new Event('homes-ready'));select.addEventListener('change',refresh);await refresh();setInterval(refresh,5000);}catch{add(metrics,'p','Unable to connect to local server. Reload to retry.');}
