import {config} from './config.mjs';
import {prepareLive} from './store.mjs';
import {startHA} from './ha.mjs';
import {startMQTT} from './mqtt.mjs';
export async function startIntegrations(db,env=process.env){
 const c=config(env),status={ha:{state:'disabled',discovered:[]},mqtt:{state:'disabled',rejected:0}},stops=[];
 const ha=c.mappings.filter(m=>m.adapter==='ha'),mqtt=c.mappings.filter(m=>m.adapter==='mqtt');
 if(c.haUrl||c.mqttUrl)prepareLive(db,c.mappings);
 try{
 if(c.mqttUrl){status.mqtt.state='connecting';stops.push(await startMQTT({db,url:c.mqttUrl,username:c.username,password:c.password,mappings:mqtt},status.mqtt));}
 if(c.haUrl){status.ha.state='connecting';stops.push(startHA({db,url:c.haUrl,token:c.token,poll:c.poll,mappings:ha},status.ha));}
 }catch(e){for(const stop of stops)stop();throw e;}
 return {status,stop(){for(const stop of stops)stop();}};
}
