import {insights} from './model.mjs';
const add=(parent,tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;parent.append(el);return el;};
const metrics=document.querySelector('#overview');
const get=async path=>{const r=await fetch(path);if(!r.ok)throw Error('Request failed');return r.json();};
try{
 const [latest,devices,energy]=await Promise.all(['/api/latest','/api/devices','/api/energy'].map(get));
 const reading=metric=>latest.find(r=>r.metric===metric&&r.quality==='good'&&!r.stale)?.value??null;
 const data={powerW:reading('consumption'),solarW:reading('solar'),temperatureC:reading('temperature'),humidity:reading('humidity'),devices:devices.map(d=>({...d,online:Boolean(d.online)}))};
 for(const [label,value,unit] of [['Site consumption',data.powerW,'W'],['Solar generation',data.solarW,'W'],['Temperature',data.temperatureC,'°C'],['Humidity',data.humidity,'%']]){
 const card=add(metrics,'article','','metric');add(card,'span',label);add(card,'strong',value===null?'Unavailable':value+' '+unit);
 }
 const panel=add(metrics.parentElement,'section','','panel');add(panel,'h2','Energy history · last 24 hours');add(panel,'p','Synthetic data · estimated from valid sample intervals');
 for(const [metric,result] of Object.entries(energy.metrics))add(panel,'p',metric.replaceAll('_',' ')+': '+(result.kWh===null?'Unavailable':result.kWh.toFixed(2)+' kWh')+' · '+Math.round(result.coverage*100)+'% coverage');
 if(latest.some(r=>r.stale))add(panel,'p','Some readings are stale. Demo samples are not refreshed automatically.');
 for(const advice of insights(data))add(document.querySelector('#advice'),'li',advice);
 for(const device of data.devices){const row=add(document.querySelector('#device-list'),'li','');add(row,'span',device.name);add(row,'span',device.online?'Online':'Offline');}
}catch{add(metrics,'p','Unable to load persisted demo readings. Start the local server and reload.');}
