export const widgets=['overview','insights','devices','energy','connections','energy-report'];
export function normalizePreferences(raw){
 const p=raw&&typeof raw==='object'?raw:{};
 const order=Array.isArray(p.order)?[...new Set(p.order.filter(x=>widgets.includes(x)))]:[];
 return {theme:['light','dark','system'].includes(p.theme)?p.theme:'system',density:p.density==='compact'?'compact':'comfortable',order:[...order,...widgets.filter(x=>!order.includes(x))],hidden:Array.isArray(p.hidden)?[...new Set(p.hidden.filter(x=>widgets.includes(x)))]:[]};
}
export function readPreferences(storage){try{return normalizePreferences(JSON.parse(storage.getItem('hs-layout-v1')));}catch{return normalizePreferences(null);}}
export function savePreferences(storage,p){try{storage.setItem('hs-layout-v1',JSON.stringify(normalizePreferences(p)));}catch{}}
export function moveWidget(p,id,delta){const n=normalizePreferences(p),i=n.order.indexOf(id),j=i+delta;if(i>=0&&j>=0&&j<n.order.length&&Number.isInteger(j)){[n.order[i],n.order[j]]=[n.order[j],n.order[i]];}return n;}
