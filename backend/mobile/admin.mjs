export async function mobileAdmin(req,url,session,service,enabled){
 const fail=(status,error)=>({status,data:{error}}),ok=data=>({status:200,data});
 if(session.role!=='owner')return fail(403,'Owner required');
 if(url.pathname==='/api/mobile-admin'&&req.method==='GET')return ok({enabled,devices:service.list(),users:service.users()});
 if(req.method!=='POST')return fail(405,'Method not allowed');
 if((req.headers['content-type']||'').split(';')[0]!=='application/json')return fail(415,'JSON required');
 try{let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>4096)return fail(413,'Too large');chunks.push(c);}const b=JSON.parse(Buffer.concat(chunks).toString());
 if(url.pathname==='/api/mobile-admin/pair'){if(!enabled)return fail(503,'Enable mobile gateway first');return ok(service.issue(session,b));}
 if(url.pathname==='/api/mobile-admin/revoke')return service.revoke(b.id,session.id)?ok({ok:true}):fail(404,'Device not found');
 return fail(404,'Not found');
 }catch{return fail(403,'Request rejected');}
}
