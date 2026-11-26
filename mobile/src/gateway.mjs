import {validateGateway} from './model.mjs';
// No credentials or session tokens sent during this initial connectivity probe.
// Real native authentication requires the forthcoming paired gateway protocol.
export async function probeGateway(raw,{fetcher=fetch}={}){
 const origin=validateGateway(raw);
 const r=await fetcher(origin+'/api/auth/status',{method:'GET',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('Gateway unavailable');
 const data=await r.json();
 if(typeof data.authenticated!=='boolean'||typeof data.setupAvailable!=='boolean')throw Error('Unexpected gateway response');
 return {origin,reachable:true};
}
