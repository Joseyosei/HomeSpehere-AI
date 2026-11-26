import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {openDatabase} from './backend/db.mjs';
import {seedDemo} from './backend/seed.mjs';
import {startIntegrations} from './backend/integrations/index.mjs';
import {aiConfig} from './backend/ai/assistant.mjs';
import {createAIHandler} from './backend/ai/http.mjs';
import {tariffConfig} from './backend/energy-intelligence.mjs';
import {api} from './backend/api.mjs';
const routes=new Map([['/',['index.html','text/html']],['/app.mjs',['app.mjs','text/javascript']],['/chat.mjs',['chat.mjs','text/javascript']],['/energy-report.mjs',['energy-report.mjs','text/javascript']],['/model.mjs',['model.mjs','text/javascript']],['/style.css',['style.css','text/css']]]);
export function makeServer(db, integrationStatus={ha:{state:'disabled',discovered:[]},mqtt:{state:'disabled'}}, assistantConfig=aiConfig({}), energyTariff=tariffConfig()){
 const aiHandler=createAIHandler(db,assistantConfig);
 return createServer(async(req,res)=>{
 const headers={'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; object-src 'none'; frame-ancestors 'none'",'Cache-Control':'no-store'};
 const json=(status,data)=>res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify(data));
 try{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname.startsWith('/api/ai/')){const result=await aiHandler(req,url);return json(result.status,result.data);}
 if(req.method!=='GET'){res.setHeader('Allow','GET');return json(405,{error:'Method not allowed'});}
 if(url.pathname==='/api/integrations')return json(200,integrationStatus);
 if(url.pathname.startsWith('/api/')){const result=api(db,url,Date.now(),energyTariff);return json(result.status,result.data);}
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
 const server=makeServer(db,integrations.status,assistantConfig,energyTariff);
 server.requestTimeout=30000;
 server.listen(port,'127.0.0.1',()=>console.log('HomeSphere AI: http://127.0.0.1:'+server.address().port));
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{integrations.stop();server.close(()=>{db.close();});});
}
