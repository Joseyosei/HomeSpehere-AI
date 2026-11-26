import {DatabaseSync,backup} from 'node:sqlite';
import {resolve,dirname} from 'node:path';
import {mkdirSync,existsSync,chmodSync,renameSync,rmSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export async function snapshot(source,destination){
 source=resolve(source);destination=resolve(destination);
 if(source===destination||!existsSync(source)||existsSync(destination))throw Error('Source must exist and destination must be new');
 mkdirSync(dirname(destination),{recursive:true,mode:0o700});
 const temp=destination+'.'+randomUUID()+'.tmp',db=new DatabaseSync(source,{readOnly:true});
 try{await backup(db,temp);const copy=new DatabaseSync(temp,{readOnly:true});try{if(copy.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Backup integrity check failed');if(copy.prepare('PRAGMA foreign_key_check').all().length)throw Error('Backup foreign key check failed');}finally{copy.close();}
 chmodSync(temp,0o600);if(existsSync(destination))throw Error('Destination already exists');renameSync(temp,destination);
 }finally{db.close();rmSync(temp,{force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [, ,source,destination]=process.argv;if(!source||!destination){console.error('Usage: node scripts/backup.mjs SOURCE NEW_DESTINATION');process.exitCode=1;}else await snapshot(source,destination);}
