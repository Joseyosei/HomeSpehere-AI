import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {openDatabase} from './backend/db.mjs';
import {seedDemo} from './backend/seed.mjs';
import {startIntegrations} from './backend/integrations/index.mjs';
import {aiConfig} from './backend/ai/assistant.mjs';
import {createAIHandler} from './backend/ai/http.mjs';
import {tariffConfig} from './backend/energy-intelligence.mjs';
import {automationConfig,createEngine} from './backend/automation/engine.mjs';
import {automationHandler} from './backend/automation/http.mjs';
import {authConfig,createAuth} from './backend/auth/service.mjs';
import {authGuard} from './backend/auth/http.mjs';
import {iconPNG} from './backend/ui-icons.mjs';
import {api} from './backend/api.mjs';
const routes=new Map([['/',['index.html','text/html']],['/app.mjs',['app.mjs','text/javascript']],['/auth.mjs',['auth.mjs','text/javascript']],['/chat.mjs',['chat.mjs','text/javascript']],['/automation.mjs',['automation.mjs','text/javascript']],['/energy-report.mjs',['energy-report.mjs','text/javascript']],['/model.mjs',['model.mjs','text/javascript']],['/style.css',['style.css','text/css']],['/shell.mjs',['shell.mjs','text/javascript']],['/preferences.mjs',['preferences.mjs','text/javascript']],['/sw.js',['sw.js','text/javascript']],['/manifest.webmanifest',['manifest.webmanifest','application/manifest+json']],['/offline.html',['offline.html','text/html']]]);
export function makeServer(db, integrationStatus={ha:{state:'disabled',discovered:[]},mqtt:{state:'disabled'}}, assistantConfig=aiConfig({}), energyTariff=tariffConfig(), automation=null, autoConfig=automationConfig(), securityConfig=authConfig()){
 const auth=createAuth(db,securityConfig),guard=authGuard(auth);
 const autoHandler=automationHandler(automation,autoConfig);
 const aiHandler=createAIHandler(db,assistantConfig);
 return createServer(async(req,res)=>{
 const headers={'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; object-src 'none'; frame-ancestors 'none'",'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
 const json=(status,data)=>res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify(data));
 try{
 const url=new URL(req.url,'http://127.0.0.1');
 let session;
 if(url.pathname.startsWith('/api/')){const g=await guard(req,url,res);if(g.status)return json(g.status,g.data);session=g.session;}
 if(url.pathname==='/api/automation'||url.pathname.startsWith('/api/automation/')){const result=await autoHandler(req,url);return json(result.status,result.data);}
 if(url.pathname.startsWith('/api/ai/')){const result=await aiHandler(req,url,h=>{const allowed=auth.allowed(session,h);if(!allowed)auth.audit('household_denied',session.id);return allowed;});return json(result.status,result.data);}
 if(req.method!=='GET'){res.setHeader('Allow','GET');return json(405,{error:'Method not allowed'});}
 if(url.pathname==='/api/integrations')return json(200,integrationStatus);
 if(url.pathname.startsWith('/api/')){const result=api(db,url,Date.now(),energyTariff);return json(result.status,result.data);}
 if(['/icon-192.png','/icon-512.png'].includes(url.pathname)){res.writeHead(200,{...headers,'Content-Type':'image/png'}).end(iconPNG(url.pathname.includes('192')?192:512));return;}
 const route=routes.get(url.pathname);if(!route)return json(404,{error:'Not found'});
 const data=await readFile(new URL('./public/'+route[0],import.meta.url));res.writeHead(200,{...headers,'Content-Type':route[1]+'; charset=utf-8'}).end(data);
 }catch(e){console.error(e.message);if(!res.headersSent)json(500,{error:'Internal server error'});else res.end();}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const db=openDatabase(process.env.DB_PATH);seedDemo(db);
 const port=Number(process.env.PORT??8780);
 let integrations;try{integrations=await startIntegrations(db);}catch{db.close();console.error('Integration configuration/startup failed. Check local configuration.');process.exit(1);}
 let assistantConfig;try{assistantConfig=aiConfig();}catch{integrations.stop();db.close();console.error('Invalid local AI configuration.');process.exit(1);}
 let energyTariff;try{energyTariff=tariffConfig(process.env);}catch{integrations.stop();db.close();console.error('Invalid energy tariff configuration.');process.exit(1);}
 let autoConfig,automation;try{autoConfig=automationConfig(process.env);automation=createEngine(db,autoConfig);}catch{integrations.stop();db.close();console.error('Invalid automation configuration.');process.exit(1);}
 const timer=setInterval(()=>{try{automation.tick();}catch{automation.emergency(true);console.error('Automation evaluation stopped.');}},10000);
 let securityConfig;try{securityConfig=authConfig(process.env);}catch{clearInterval(timer);automation.stop();integrations.stop();db.close();console.error('Invalid security configuration.');process.exit(1);}
 const server=makeServer(db,integrations.status,assistantConfig,energyTariff,automation,autoConfig,securityConfig);
 server.requestTimeout=30000;
 server.listen(port,'127.0.0.1',()=>console.log('HomeSphere AI: http://127.0.0.1:'+server.address().port));
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{clearInterval(timer);automation.stop();integrations.stop();server.close(()=>{db.close();});});
}
