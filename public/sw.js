const CACHE='homesphere-shell-v0.9.1';
const SHELL=['/','/style.css','/auth.mjs','/mobile-admin.mjs','/shell.mjs','/preferences.mjs','/app.mjs','/model.mjs','/chat.mjs','/energy-report.mjs','/automation.mjs','/manifest.webmanifest','/icon-192.png','/icon-512.png','/offline.html'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('homesphere-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(req.mode==='navigate'){event.respondWith(fetch(req).catch(()=>caches.match('/offline.html')));return;}
 if(!SHELL.includes(url.pathname)||url.search)return;
 event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
});
