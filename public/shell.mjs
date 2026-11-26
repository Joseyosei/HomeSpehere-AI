import {widgets,normalizePreferences,readPreferences,savePreferences,moveWidget} from './preferences.mjs';
const q=id=>document.getElementById(id),names={overview:'Overview metrics',insights:'Home intelligence',devices:'Devices',energy:'Energy history',connections:'Connections','energy-report':'Energy intelligence'};
let prefs=readPreferences(localStorage),display=false,installEvent=null,authenticated=false;
const theme=q('theme-select'),density=q('density-select'),list=q('widget-settings'),grid=q('widget-grid'),notice=q('network-status');
function apply(){
 document.documentElement.dataset.theme=prefs.theme;document.documentElement.dataset.density=prefs.density;
 theme.value=prefs.theme;density.value=prefs.density;
 for(const id of prefs.order){const node=q(id);grid.append(node);node.hidden=prefs.hidden.includes(id);}
 for(const a of document.querySelectorAll('nav a'))if(widgets.includes(a.hash.slice(1)))a.hidden=prefs.hidden.includes(a.hash.slice(1));
 savePreferences(localStorage,prefs);
}
function button(p,label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;p.append(b);return b;}
function settings(){
 list.replaceChildren();
 for(const id of prefs.order){
 const row=document.createElement('div');row.className='widget-setting';
 const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=!prefs.hidden.includes(id);
 check.onchange=()=>{prefs.hidden=check.checked?prefs.hidden.filter(x=>x!==id):[...prefs.hidden,id];apply();};
 label.append(check,document.createTextNode(names[id]));row.append(label);
 const move=delta=>{prefs=moveWidget(prefs,id,delta);apply();settings();list.querySelector('[data-move="'+id+'-'+delta+'"]')?.focus();};
 for(const [delta,text] of [[-1,'Move up'],[1,'Move down']]){const b=button(row,text,()=>move(delta));b.dataset.move=id+'-'+delta;b.setAttribute('aria-label',text+' '+names[id]);b.disabled=prefs.order.indexOf(id)+delta<0||prefs.order.indexOf(id)+delta>=prefs.order.length;}
 list.append(row);
 }
}
theme.onchange=()=>{prefs.theme=theme.value;apply();};density.onchange=()=>{prefs.density=density.value;apply();};
q('reset-layout').onclick=()=>{prefs=normalizePreferences(null);apply();settings();};
function setDisplay(value){
 display=value&&authenticated;document.body.classList.toggle('display-mode',display);q('display-toggle').textContent=display?'Exit display mode':'Display mode';q('display-toggle').setAttribute('aria-pressed',String(display));
 if(display){q('layout-settings').open=false;q('display-toggle').focus();}
}
q('display-toggle').onclick=()=>setDisplay(!display);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&display)setDisplay(false);});
q('fullscreen-toggle').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notice.textContent='Fullscreen is not available in this browser.';}};
if(!document.documentElement.requestFullscreen)q('fullscreen-toggle').hidden=true;
function network(){notice.textContent=navigator.onLine?'Network available · local server required':'Offline · private data unavailable';document.body.classList.toggle('network-offline',!navigator.onLine);}
addEventListener('online',network);addEventListener('offline',network);network();
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e;q('install-app').hidden=false;});
q('install-app').onclick=async()=>{if(installEvent){await installEvent.prompt();installEvent=null;q('install-app').hidden=true;}};
addEventListener('appinstalled',()=>{q('install-app').hidden=true;});
if('serviceWorker' in navigator&&isSecureContext)navigator.serviceWorker.register('/sw.js').catch(()=>{q('pwa-status').textContent='Offline shell installation unavailable.';});
else q('pwa-status').textContent='Offline installation requires a secure browser context.';
apply();settings();
export function activateShell(){authenticated=true;q('display-toggle').hidden=false;q('layout-settings').hidden=false;q('fullscreen-toggle').hidden=!document.documentElement.requestFullscreen;}
export function clearDisplay(){setDisplay(false);authenticated=false;}
