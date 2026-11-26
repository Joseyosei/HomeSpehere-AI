import {validateGateway} from './model.mjs';
const tokenPattern=/^[a-f0-9]{64}$/;
async function call(raw,path,{method='GET',token,body,fetcher=fetch}={}){
 const origin=validateGateway(raw),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try{const r=await fetcher(origin+'/mobile/v1/'+path,{method,credentials:'omit',redirect:'error',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal});if(!r.ok){const e=Error('Gateway request rejected');e.status=r.status;throw e;}return await r.json();}finally{clearTimeout(timer);}
}
export async function probeGateway(raw,options={}){const origin=validateGateway(raw),d=await call(origin,'status',options);if(d.protocol!==1||d.pairing!==true)throw Error('Unexpected gateway response');return {origin,reachable:true};}
export async function pairGateway(raw,code,name,options={}){if(!tokenPattern.test(code)||!name.trim()||name.length>80)throw Error('Invalid pairing');const origin=validateGateway(raw),d=await call(origin,'pair',{...options,method:'POST',body:{code,name}});if(!tokenPattern.test(d.token)||typeof d.household!=='string'||typeof d.id!=='string'||!Number.isFinite(d.expires))throw Error('Invalid credential response');return {...d,origin};}
export async function sessionGateway(credential,options={}){return call(credential.origin,'session',{...options,token:credential.token});}
export async function revokeGateway(credential,options={}){return call(credential.origin,'session',{...options,token:credential.token,method:'DELETE'});}
