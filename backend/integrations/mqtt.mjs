import {normalize,ingest,offline} from './store.mjs';
export function attachMQTT(client,{db,mappings},status){
 const map=new Map(mappings.map(m=>[m.key,m]));let stopped=false;
 const disconnected=()=>{if(stopped)return;status.state='retrying';offline(db,mappings);};
 client.on('connect',()=>{
  if(stopped)return;
  status.state='subscribing';
  if(!map.size){status.state='connected';return;}
  client.subscribe([...map.keys()],{qos:1},(err,granted)=>{
   if(stopped)return;
   if(err||!granted||granted.length!==map.size||granted.some(g=>g.qos>2)){status.state='subscription_error';offline(db,mappings);return;}
   status.state='connected';status.lastSuccess=Date.now();
  });
 });
 client.on('reconnect',disconnected);client.on('offline',disconnected);client.on('close',disconnected);client.on('error',disconnected);
 client.on('message',(topic,payload)=>{
  if(stopped||!map.has(topic))return;
  const m=map.get(topic);
  try{
   if(payload.length>4096)throw Error('Payload too large');
   const p=JSON.parse(payload.toString('utf8'));
   if(!p||typeof p!=='object'||!Object.hasOwn(p,'value'))throw Error('Invalid payload');
   const r=normalize(m.metric,p.value,p.unit,p.ts);
   ingest(db,m,r);status.lastSuccess=Date.now();
  }catch{status.rejected=(status.rejected??0)+1;}
 });
 return ()=>{stopped=true;offline(db,mappings);client.end(true);};
}
export async function startMQTT(options,status){
 const {connect}=await import('mqtt');
 const client=connect(options.url,{username:options.username,password:options.password,protocolVersion:4,clean:true,reconnectPeriod:5000,connectTimeout:10000,resubscribe:false,rejectUnauthorized:true,queueQoSZero:false});
 return attachMQTT(client,options,status);
}
