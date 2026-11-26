import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,insertReading} from '../backend/db.mjs';
import {seedDemo} from '../backend/seed.mjs';
import {integrate} from '../backend/energy.mjs';
import {api} from '../backend/api.mjs';
import {ownerHeaders} from './auth-helper.mjs';
import {makeServer} from '../server.mjs';
const now=1760000400000;
function fixture(t){const db=openDatabase(':memory:');t.after(()=>db.close());seedDemo(db,now);return db;}
test('migration and idempotent seed',t=>{const db=fixture(t);assert.equal(seedDemo(db,now),false);assert.equal(db.prepare('SELECT count(*) n FROM readings').get().n,582);assert.equal(db.prepare('PRAGMA user_version').get().user_version,3);});
test('reject invalid units and orphan device',t=>{const db=fixture(t);const r={device_id:'meter',metric:'consumption',ts:now,value:100,unit:'kW',quality:'good'};assert.throws(()=>insertReading(db,r));assert.throws(()=>insertReading(db,{...r,unit:'W',device_id:'unknown'}));});
test('constraint on humidity and missing value',t=>{const db=fixture(t);const r={device_id:'climate',metric:'humidity',ts:now+1,value:101,unit:'%',quality:'good'};assert.throws(()=>insertReading(db,r));assert.throws(()=>insertReading(db,{...r,value:null}));});
test('1 kW for one hour equals 1 kWh',()=>{const rows=[0,1800000,3600000].map(ts=>({ts,value:1000,quality:'good'}));assert.deepEqual(integrate(rows,0,3600000),{kWh:1,coveredMs:3600000,coverage:1});});
test('missing and long gaps remain unknown',()=>{assert.equal(integrate([{ts:0,value:1000,quality:'good'},{ts:3600000,value:1000,quality:'good'}],0,3600000).kWh,null);assert.equal(integrate([{ts:0,value:1000,quality:'good'},{ts:900000,value:null,quality:'missing'}],0,900000).coverage,0);});
test('clipped linear interval',()=>{const rows=[{ts:0,value:0,quality:'good'},{ts:1800000,value:2000,quality:'good'}];assert.equal(integrate(rows,900000,1800000).kWh,0.375);});
test('history validation and truncation',t=>{const db=fixture(t);const call=p=>api(db,new URL(p,'http://localhost'),now);assert.equal(call('/api/history?limit=1').data.truncated,true);assert.equal(call('/api/history?metric=bad').status,400);assert.equal(call('/api/history?from=abc').status,400);assert.equal(call('/api/history?household=other').status,404);assert.equal(call('/api/energy').status,200);});
test('HTTP read-only API and static routing',async t=>{const db=openDatabase(':memory:');seedDemo(db,now);const headers=await ownerHeaders(db);const server=makeServer(db);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();});const base='http://127.0.0.1:'+server.address().port;assert.equal((await (await fetch(base+'/api/health',{headers})).json()).schema,3);assert.equal((await fetch(base+'/api/devices',{method:'POST',headers})).status,405);assert.equal((await fetch(base+'/backend/db.mjs')).status,404);assert.equal((await fetch(base+'/')).status,200);});
