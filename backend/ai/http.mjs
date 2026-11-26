import {answerChat,validateChat} from './assistant.mjs';
export function createAIHandler(db,config,options={}){
 let active=false,last=0;
 return async function(req,url){
 const fail=(status,error)=>({status,data:{error}});
 if(url.pathname==='/api/ai/status')return req.method==='GET'?{status:200,data:{enabled:config.enabled,mode:config.enabled?'ollama-with-local-fallback':'local-rules',model:config.enabled?config.model:null}}:fail(405,'Method not allowed');
 if(url.pathname!=='/api/ai/chat')return fail(404,'Not found');
 if(req.method!=='POST')return fail(405,'Method not allowed');
 // Browser origin must match the actual local listener; no cross-origin access.
 const expected='http://'+req.headers.host;
 if(!/^127\.0\.0\.1:\d+$|^localhost:\d+$|^\[::1\]:\d+$/.test(req.headers.host??'')||(req.headers.origin&&req.headers.origin!==expected)||req.headers['sec-fetch-site']==='cross-site')return fail(403,'Local origin required');
 if((req.headers['content-type']??'').split(';')[0].trim()!=='application/json')return fail(415,'JSON required');
 if(active||Date.now()-last<1000)return fail(429,'Assistant busy; retry shortly');
 active=true;last=Date.now();
 try{
 let size=0;const chunks=[];
 for await(const chunk of req){size+=chunk.length;if(size>16384)return fail(413,'Request too large');chunks.push(chunk);}
 let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));validateChat(body);}catch{return fail(400,'Invalid chat request');}
 const data=await answerChat(db,body,config,options);
 return data?{status:200,data}:fail(404,'Household not found');
 }finally{active=false;}
 };
}
