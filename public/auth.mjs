import {activateShell,clearDisplay} from './shell.mjs';
const status=await fetch('/api/auth/status').then(r=>r.json()).catch(()=>({authenticated:false}));
const original=window.fetch.bind(window);
let csrf=status.csrf;
window.fetch=(resource,options={})=>{
 const url=new URL(typeof resource==='string'?resource:resource.url,location.href);
 if(url.origin===location.origin&&url.pathname.startsWith('/api/')&&options.method&&options.method!=='GET'){
 const headers=new Headers(options.headers);if(csrf)headers.set('X-CSRF-Token',csrf);return original(resource,{...options,headers}).then(checkSession);
 }return original(resource,options).then(checkSession);
};
function checkSession(r){if(r.status===401&&status.authenticated&&r.url.includes('/api/')){const path=new URL(r.url).pathname;if(!path.startsWith('/api/automation')){clearDisplay();document.querySelector('#dashboard').hidden=true;location.reload();}}return r;}
const login=document.querySelector('#auth-login'),setup=document.querySelector('#auth-setup'),account=document.querySelector('#auth-account'),message=document.querySelector('#auth-message'),dashboard=document.querySelector('#dashboard');
const post=async(path,data)=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!r.ok)throw Error('Request rejected ('+r.status+')');return r.json();};
function formData(form){return Object.fromEntries(new FormData(form));}
login.hidden=status.authenticated;setup.hidden=!status.setupAvailable||status.authenticated;account.hidden=!status.authenticated;dashboard.hidden=!status.authenticated;
login.onsubmit=async e=>{e.preventDefault();try{await post('/api/auth/login',formData(login));location.reload();}catch(e){message.textContent=e.message;}};
setup.onsubmit=async e=>{e.preventDefault();try{await post('/api/auth/register',formData(setup));setup.reset();setup.hidden=true;message.textContent='Owner created. Sign in.';}catch(e){message.textContent=e.message;}};
if(status.authenticated){
 activateShell();
 document.querySelector('#auth-who').textContent=status.user.email+' · '+status.user.role;
 document.querySelector('#auth-logout').onclick=async()=>{try{await post('/api/auth/logout',{});location.reload();}catch(e){message.textContent=e.message;}};
 if(status.user.role==='owner'){
 await import('./mobile-admin.mjs');
 const invite=document.querySelector('#auth-invite');invite.hidden=false;
 invite.onsubmit=async e=>{e.preventDefault();const d=formData(invite);try{await post('/api/auth/register',{email:d.email,password:d.password,households:d.households.split(',').map(s=>s.trim()).filter(Boolean)});invite.reset();message.textContent='Viewer created.';}catch(e){message.textContent=e.message;}};
 document.querySelector('#auth-audit-button').hidden=false;
 document.querySelector('#auth-audit-button').onclick=async()=>{try{const r=await fetch('/api/auth/audit');if(!r.ok)throw Error('Audit unavailable');document.querySelector('#auth-audit').textContent=(await r.json()).map(x=>new Date(x.ts).toISOString()+' '+x.event+' '+(x.user_id??'')).join('\n');}catch(e){message.textContent=e.message;}};
 }else{document.querySelector('#automation').hidden=true;document.querySelector('a[href="#automation"]').hidden=true;}
 await Promise.all([import('./app.mjs'),import('./chat.mjs'),import('./energy-report.mjs'),...(status.user.role==='owner'?[import('./automation.mjs')]:[])]);
}
