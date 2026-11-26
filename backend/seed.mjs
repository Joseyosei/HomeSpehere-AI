import {openDatabase,insertReading,metrics} from './db.mjs';
import {pathToFileURL} from 'node:url';
export function seedDemo(db,now=Date.now()){
 const end=Math.floor(now/900000)*900000;
 db.exec('BEGIN IMMEDIATE');
 try{
 if(db.prepare("SELECT 1 FROM households WHERE id='demo'").get()){db.exec('COMMIT');return false;}
 db.prepare('INSERT INTO households VALUES(?,?)').run('demo','Demo home');
 const room=db.prepare('INSERT INTO rooms VALUES(?,?,?)');
 room.run('utility','demo','Utility');room.run('living','demo','Living room');room.run('bedroom','demo','Bedroom');
 const device=db.prepare('INSERT INTO devices VALUES(?,?,?,?,?,?,?)');
 device.run('meter','demo','utility','Energy meter','meter',1,'demo');
 device.run('climate','demo','living','Climate sensor','sensor',1,'demo');
 device.run('lights','demo','living','Living room lights','light',1,'demo');
 device.run('bedroom-sensor','demo','bedroom','Bedroom sensor','sensor',0,'demo');
 for(let i=96;i>=0;i--){
 const ts=end-i*900000,h=new Date(ts).getUTCHours(),solar=Math.round(Math.max(0,Math.sin((h-6)/12*Math.PI))*1800),consumption=600+Math.round(500*(1+Math.sin(i/5)));
 for(const [id,metric,value] of [['meter','consumption',consumption],['meter','solar',solar],['meter','grid_import',Math.max(0,consumption-solar)],['meter','grid_export',Math.max(0,solar-consumption)],['climate','temperature',21+Math.round(Math.sin(i/8)*10)/10],['climate','humidity',65+Math.round(Math.cos(i/7)*5)]]){
 insertReading(db,{device_id:id,metric,ts,value,unit:metrics[metric],quality:'good'});
 }
 }
 db.exec('COMMIT');return true;
 }catch(e){db.exec('ROLLBACK');throw e;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const db=openDatabase(process.env.DB_PATH);try{console.log(seedDemo(db)?'Demo seeded':'Demo already exists');}finally{db.close();}}
