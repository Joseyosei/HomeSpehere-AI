import {normalize,ingest,offline} from './store.mjs';
export async function pollHA({db,url,token,mappings,fetcher=fetch,signal}){
 const response=await fetcher(url+'/api/states',{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:signal??AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('Home Assistant HTTP failure');
 const states=await response.json();if(!Array.isArray(states))throw Error('Invalid Home Assistant response');
 const candidates=states.filter(s=>typeof s?.entity_id==='string'&&s.entity_id.startsWith('sensor.')).slice(0,2000);
 const byId=new Map(candidates.map(s=>[s.entity_id,s]));
 let accepted=0,rejected=0;
 for(const m of mappings){
  const s=byId.get(m.key);
  if(!s){offline(db,[m]);continue;}
  try{
   const ts=Date.parse(s.last_reported??s.last_updated);
   const r=normalize(m.metric,s.state,s.attributes?.unit_of_measurement??(s.state==='unavailable'||s.state==='unknown'?undefined:null)??(s.state==='unavailable'||s.state==='unknown'?({temperature:'C',humidity:'%',battery:'%'}[m.metric]??'W'):null),ts);
   accepted+=Number(ingest(db,m,r));
  }catch{rejected++;offline(db,[m]);}
 }
 return {accepted,rejected,discovered:candidates.map(s=>({key:s.entity_id,unit:typeof s.attributes?.unit_of_measurement==='string'?s.attributes.unit_of_measurement:null}))};
}
export function startHA(options,status){
 let stopped=false,timer,controller,delay=options.poll;
 const tick=async()=>{
  controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
  try{const result=await pollHA({...options,signal:controller.signal});if(stopped)return;Object.assign(status,{state:'connected',lastSuccess:Date.now(),discovered:result.discovered,rejected:result.rejected});delay=options.poll;}
  catch{if(stopped)return;status.state='retrying';offline(options.db,options.mappings);delay=Math.min(delay*2,300000);}
  finally{clearTimeout(timeout);if(!stopped)timer=setTimeout(tick,delay);}
 };
 void tick();
 return ()=>{stopped=true;clearTimeout(timer);controller?.abort();offline(options.db,options.mappings);};
}
