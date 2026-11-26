import {timingSafeEqual,createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest();
export function automationHandler(engine,config){
 return async(req,url)=>{
 const fail=(status,error)=>({status,data:{error}}),ok=data=>({status:200,data});
 if(!engine||!config.token)return fail(503,'Automation administration not configured');
 const host=req.headers.host??'',origin=req.headers.origin;
 if(!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)||(origin&&origin!=='http://'+host)||req.headers['sec-fetch-site']==='cross-site')return fail(403,'Local origin required');
 const auth=req.headers.authorization??'';
 if(!timingSafeEqual(hash(auth),hash('Bearer '+config.token)))return fail(401,'Admin token required');
 if(req.method==='GET'&&url.pathname==='/api/automation')return ok(engine.snapshot());
 if(req.method!=='POST')return fail(405,'Method not allowed');
 if((req.headers['content-type']??'').split(';')[0].trim()!=='application/json')return fail(415,'JSON required');
 let body;try{let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>8192)return fail(413,'Request too large');chunks.push(c);}body=JSON.parse(Buffer.concat(chunks).toString());if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{return fail(400,'Invalid JSON');}
 try{
 switch(url.pathname){
 case '/api/automation/rules':return ok({id:engine.add(body)});
 case '/api/automation/enable':engine.enable(body.id,body.enabled);break;
 case '/api/automation/stop':engine.emergency(body.stopped);break;
 case '/api/automation/approve':return ok({outcome:await engine.approve(body.id)});
 case '/api/automation/reject':engine.reject(body.id);break;
 default:return fail(404,'Not found');
 }return ok({ok:true});
 }catch{return fail(409,'Automation request rejected by policy or current state');}
 };
}
