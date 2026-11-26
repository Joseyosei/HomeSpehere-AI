const section=document.querySelector('#assistant'),form=document.querySelector('#chat-form'),input=document.querySelector('#chat-question'),log=document.querySelector('#chat-log'),house=document.querySelector('#household'),send=document.querySelector('#chat-send'),status=document.querySelector('#chat-status');
let history=[],generation=0;
function add(role,text){const p=document.createElement('p');p.className='chat-'+role;p.textContent=text;log.append(p);while(log.children.length>24)log.firstChild.remove();return p;}
function clear(){generation++;history=[];log.replaceChildren();status.textContent='Conversation cleared.';}
house.addEventListener('change',clear);document.querySelector('#chat-clear').addEventListener('click',clear);
form.addEventListener('submit',async e=>{
 e.preventDefault();const question=input.value.trim(),household=house.value;if(!question||!household||send.disabled)return;
 const turn=generation;send.disabled=true;input.value='';add('user',question);status.textContent='Analysing selected household…';
 try{
 const response=await fetch('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({household,question,history:history.slice(-6)}),signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error('Request failed: '+response.status);
 const result=await response.json();if(turn!==generation||house.value!==household)return;
 add('assistant',result.answer);
 for(const r of result.recommendations.slice(0,4))add('note',r.text);
 for(const r of result.anomalies.slice(0,4))add('note',r.text);
 add('note',result.notice);
 status.textContent=result.source+' · '+result.mode+' · '+result.asOf;
 history.push({role:'user',content:question},{role:'assistant',content:result.answer.slice(0,1500)});history=history.slice(-6);
 }catch{if(turn===generation)status.textContent='Assistant unavailable or busy. Try again.';}finally{send.disabled=false;input.focus();}
});
fetch('/api/ai/status').then(r=>r.json()).then(s=>{status.textContent=s.enabled?'Local Ollama enabled; rules fallback available.':'Local rules mode. Enable Ollama in configuration.';}).catch(()=>{status.textContent='Assistant status unavailable.';});
