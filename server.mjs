import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const routes = new Map([['/',['index.html','text/html']],['/app.mjs',['app.mjs','text/javascript']],['/model.mjs',['model.mjs','text/javascript']],['/style.css',['style.css','text/css']]]);
const server = createServer(async (req,res)=>{
 const headers={'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; object-src 'none'; frame-ancestors 'none'",'Cache-Control':'no-store'};
 const route=routes.get(req.url);
 if(req.method!=='GET'||!route){res.writeHead(404,headers).end();return;}
 try {const data=await readFile(new URL('./public/'+route[0],import.meta.url));res.writeHead(200,{...headers,'Content-Type':route[1]+'; charset=utf-8'}).end(data);}
 catch {res.writeHead(500,headers).end('Unable to load dashboard');}
});
server.listen(8780,'127.0.0.1',()=>console.log('HomeSphere AI: http://127.0.0.1:8780'));
