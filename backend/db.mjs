import {migrateMobile} from './mobile/schema.mjs';
import {migrateAuth} from './auth/schema.mjs';
import {migrateAutomation} from './automation/schema.mjs';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
export const metrics=Object.freeze({consumption:'W',solar:'W',grid_import:'W',grid_export:'W',temperature:'C',humidity:'%',battery:'%'});
export function openDatabase(path='data/homesphere.sqlite'){
 if(path!==':memory:') mkdirSync(dirname(path),{recursive:true,mode:0o700});
 const db=new DatabaseSync(path);
 db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
 try{
 const version=db.prepare('PRAGMA user_version').get().user_version;
 if(version>4)throw Error('Unsupported database version');
 if(version===0)db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE households(id TEXT PRIMARY KEY,name TEXT NOT NULL) STRICT;
 CREATE TABLE rooms(id TEXT PRIMARY KEY,household_id TEXT NOT NULL REFERENCES households(id),name TEXT NOT NULL,UNIQUE(id,household_id)) STRICT;
 CREATE TABLE devices(id TEXT PRIMARY KEY,household_id TEXT NOT NULL REFERENCES households(id),room_id TEXT NOT NULL,name TEXT NOT NULL,kind TEXT NOT NULL,online INTEGER NOT NULL CHECK(online IN(0,1)),source TEXT NOT NULL CHECK(source IN('demo','live')),FOREIGN KEY(room_id,household_id) REFERENCES rooms(id,household_id)) STRICT;
 CREATE TABLE readings(device_id TEXT NOT NULL REFERENCES devices(id),metric TEXT NOT NULL CHECK(metric IN('consumption','solar','grid_import','grid_export','temperature','humidity','battery')),ts INTEGER NOT NULL CHECK(ts>=0 AND ts<=253402300799999),value REAL,unit TEXT NOT NULL,quality TEXT NOT NULL CHECK(quality IN('good','missing','suspect')),CHECK((quality='missing' AND value IS NULL) OR (quality!='missing' AND value IS NOT NULL)),CHECK(value IS NULL OR abs(value)<=1000000000),CHECK((metric IN('consumption','solar','grid_import','grid_export') AND unit='W' AND (value IS NULL OR value>=0)) OR (metric='temperature' AND unit='C' AND (value IS NULL OR value>=-273.15)) OR (metric IN('humidity','battery') AND unit='%' AND (value IS NULL OR value BETWEEN 0 AND 100))),PRIMARY KEY(device_id,metric,ts)) STRICT;
 CREATE INDEX readings_time ON readings(ts);
 PRAGMA user_version=1; COMMIT;`);
 if(version<2)migrateAutomation(db);
 if(version<3)migrateAuth(db);
 if(version<4)migrateMobile(db);
 return db;
 }catch(e){db.close();throw e;}
}
export function insertReading(db,r){
 if(!Object.hasOwn(metrics,r.metric)||r.unit!==metrics[r.metric]||!Number.isSafeInteger(r.ts)||r.ts<0||!['good','missing','suspect'].includes(r.quality)||!(r.value===null||Number.isFinite(r.value)))throw new TypeError('Invalid reading');
 return db.prepare('INSERT INTO readings(device_id,metric,ts,value,unit,quality) VALUES(?,?,?,?,?,?) ON CONFLICT(device_id,metric,ts) DO NOTHING').run(r.device_id,r.metric,r.ts,r.value,r.unit,r.quality);
}
export function history(db,device,metric,from,to,limit=1000){
 return db.prepare('SELECT ts,value,unit,quality FROM readings WHERE device_id=? AND metric=? AND ts>=? AND ts<=? ORDER BY ts LIMIT ?').all(device,metric,from,to,limit);
}
