export const demo=Object.freeze({powerW:1850,solarW:720,temperatureC:21.4,humidity:67,devices:[{name:'Living room lights',online:true},{name:'Kitchen sensor',online:true},{name:'Bedroom sensor',online:false},{name:'Energy meter',online:true}]});
export function insights(data){
 const result=[];
 if(Number.isFinite(data.powerW)&&data.powerW>1500) result.push('Site consumption is above the demo threshold of 1.5 kW. Check large appliances.');
 if(Number.isFinite(data.humidity)&&data.humidity>60) result.push('Humidity is above 60%. Consider ventilation if appropriate.');
 const offline=data.devices.filter(d=>!d.online).length;
 if(offline) result.push(offline+' device(s) offline. Check connectivity.');
 return result.length?result:['No configured thresholds exceeded.'];
}
