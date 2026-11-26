export function authGuard(auth){
 let bucketStart=Date.now(),requests=0,loginStart=Date.now(),attempts=0,active=0;
 const local=req=>/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(req.headers.host??'')&&(!req.headers.origin||req.headers.origin==='http://'+req.headers.host)&&req.headers['sec-fetch-site']!=='cross-site';
 const fail=(status,error)=>({status,data:{error}}),ok=data=>({status:200,data});
 async function body(req){
 if((req.headers['content-type']??'').split(';')[0].trim()!=='application/json')throw Error('JSON required');
 let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>16384)throw Error('Request too large');chunks.push(c);}
 const b=JSON.parse(Buffer.concat(chunks).toString());if(!b||typeof b!=='object'||Array.isArray(b))throw Error('Invalid JSON');return b;
 }
 return async(req,url,res)=>{
 const p=url.pathname,now=Date.now();
 if(!local(req)){auth.audit('origin_rejected');return fail(403,'Local origin required');}
 if(now-bucketStart>=60000){bucketStart=now;requests=0;}if(++requests>600)return fail(429,'Request limit exceeded');
 const s=auth.session(req.headers.cookie);
 if(p==='/api/auth/status'&&req.method==='GET')return ok({setupAvailable:auth.setupAvailable(),authenticated:!!s,user:s?{id:s.id,email:s.email,role:s.role}:null,csrf:s?.csrf??null});
 if(p==='/api/auth/login'||p==='/api/auth/register'){
 if(req.method!=='POST')return fail(405,'Method not allowed');
 if(s&&p==='/api/auth/login')return fail(409,'Sign out first');
 if(s&&(!auth.csrf(s,req.headers['x-csrf-token'])||s.role!=='owner'))return fail(403,'Owner and CSRF required');
 if(now-loginStart>=60000){loginStart=now;attempts=0;}
 if(++attempts>10||active>=2)return fail(429,'Authentication rate limit exceeded');
 active++;
 try{
 const b=await body(req);
 if(p.endsWith('/register')){await auth.register(b,s);return ok({ok:true});}
 const result=await auth.login(b);if(!result)return fail(401,'Invalid credentials');
 res.setHeader('Set-Cookie',auth.cookie(result.token));return ok({user:result.user,csrf:result.csrf});
 }catch{auth.audit('authentication_rejected',s?.id??null);return fail(400,'Authentication request rejected');}finally{active--;}
 }
 if(!s)return fail(401,'Sign in required');
 if(req.method!=='GET'&&!auth.csrf(s,req.headers['x-csrf-token'])){auth.audit('csrf_rejected',s.id);return fail(403,'CSRF validation failed');}
 if(p==='/api/auth/logout'){if(req.method!=='POST')return fail(405,'Method not allowed');auth.logout(s);res.setHeader('Set-Cookie',auth.cookie(''));return ok({ok:true});}
 if(p==='/api/auth/audit'){if(req.method!=='GET')return fail(405,'Method not allowed');return s.role==='owner'?ok(auth.logs()):fail(403,'Owner required');}
 if(p==='/api/households'&&req.method==='GET')return ok(auth.households(s));
 if(p.startsWith('/api/automation')||p==='/api/integrations'){
 if(s.role!=='owner'){auth.audit('role_denied',s.id);return fail(403,'Owner required');}
 if(p.startsWith('/api/automation')&&req.method!=='GET')auth.audit('automation_admin_request',s.id,p);
 return {session:s};
 }
 if(p.startsWith('/api/auth/'))return fail(404,'Not found');
 // AI chat checks the parsed body separately, not just a query parameter.
 if(!['/api/ai/chat','/api/ai/status','/api/health','/api/energy/tariff'].includes(p)&&!auth.allowed(s,url.searchParams.get('household')??'demo')){auth.audit('household_denied',s.id);return fail(403,'Household access denied');}
 return {session:s};
 };
}
