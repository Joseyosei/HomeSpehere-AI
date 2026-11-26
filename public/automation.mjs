const q=id=>document.getElementById(id),token=q('auto-token'),status=q('auto-status'),rules=q('auto-rules'),jobs=q('auto-jobs'),audit=q('auto-audit'),target=q('auto-entity'),kind=q('auto-kind');
let key='',busy=false;
const add=(p,t,s)=>{const e=document.createElement(t);e.textContent=s;p.append(e);return e;};
async function request(path='',body){
 const r=await fetch('/api/automation'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!r.ok)throw Error('Request rejected ('+r.status+')');return r.json();
}
function button(parent,label,fn){const b=add(parent,'button',label);b.type='button';b.onclick=()=>void perform(fn);}
async function perform(fn){if(busy)return;busy=true;try{await fn();await refresh();}catch(e){status.textContent=e.message;}finally{busy=false;}}
async function refresh(){
 const s=await request();status.textContent=(s.live?'LIVE light control':'Simulation only')+' · '+(s.stopped?'STOPPED':'ARMED')+' · every action needs approval';
 const old=target.value;target.replaceChildren();for(const e of s.entities){const o=add(target,'option',e);o.value=e;}if(s.entities.includes(old))target.value=old;
 rules.replaceChildren();jobs.replaceChildren();audit.replaceChildren();
 for(const r of s.rules){const p=add(rules,'p',r.name+' · '+r.kind+' · '+r.entity+' · '+r.action+' · '+JSON.stringify(r.spec)+' · ');button(p,r.enabled?'Disable':'Enable',()=>request('/enable',{id:r.id,enabled:!r.enabled}));}
 for(const j of s.jobs){const p=add(jobs,'p',j.name+' · '+j.entity+' · '+j.action+' · '+j.state+' · '+new Date(j.expires).toISOString()+' ');if(j.state==='pending'){button(p,'Approve',()=>{if(confirm('Approve this exact light action?'))return request('/approve',{id:j.id});});button(p,'Reject',()=>request('/reject',{id:j.id}));}}
 for(const a of s.audit)add(audit,'li',new Date(a.ts).toISOString()+' · '+a.event+(a.job_id?' · '+a.job_id:''));
}
q('auto-connect').onclick=()=>{key=token.value;token.value='';void perform(async()=>{});};
q('auto-stop').onclick=()=>void perform(()=>request('/stop',{stopped:true}));
q('auto-arm').onclick=()=>{if(confirm('Arm rule evaluation? Each action still needs approval.'))void perform(()=>request('/stop',{stopped:false}));};
kind.onchange=()=>{q('auto-schedule').hidden=kind.value!=='schedule';q('auto-condition').hidden=kind.value!=='condition';};
q('auto-form').onsubmit=e=>{e.preventDefault();void perform(()=>request('/rules',{name:q('auto-name').value,kind:kind.value,entity:target.value,action:q('auto-action').value,time:q('auto-time').value,device:q('auto-device').value,metric:q('auto-metric').value,operator:q('auto-operator').value,threshold:Number(q('auto-threshold').value)}));};
setInterval(()=>{if(key&&!busy)void perform(async()=>{});},10000);
