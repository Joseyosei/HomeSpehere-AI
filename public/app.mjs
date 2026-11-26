import {demo,insights} from './model.mjs';
const add=(parent,tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;parent.append(el);return el;};
const metrics=document.querySelector('#overview');
for(const [label,value] of [['Site consumption',demo.powerW+' W'],['Solar generation',demo.solarW+' W'],['Temperature',demo.temperatureC+' °C'],['Humidity',demo.humidity+'%']]){
 const card=add(metrics,'article','','metric');add(card,'span',label);add(card,'strong',value);
}
for(const advice of insights(demo))add(document.querySelector('#advice'),'li',advice);
for(const device of demo.devices){const row=add(document.querySelector('#device-list'),'li','');add(row,'span',device.name);add(row,'span',device.online?'Online':'Offline');}
