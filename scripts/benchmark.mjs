import {performance} from 'node:perf_hooks';
import {openDatabase} from '../backend/db.mjs';
import {seedDemo} from '../backend/seed.mjs';
import {energyReport} from '../backend/energy-intelligence.mjs';
const db=openDatabase(':memory:'),now=Date.now();seedDemo(db,now);
try{const samples=[];for(let i=0;i<100;i++){const t=performance.now();energyReport(db,{device:'meter',household:'demo',period:'month',now});samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);const p95=samples[94];console.log(JSON.stringify({fixture:'582 synthetic readings',iterations:samples.length,p50Ms:samples[49],p95Ms:p95,rssMB:process.memoryUsage().rss/1048576},null,2));if(p95>250)process.exitCode=1;}finally{db.close();}
