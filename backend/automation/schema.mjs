export function migrateAutomation(db){
 db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE automation_state(id INTEGER PRIMARY KEY CHECK(id=1),stopped INTEGER NOT NULL CHECK(stopped IN(0,1)));
 INSERT INTO automation_state VALUES(1,1);
 CREATE TABLE automation_rules(id TEXT PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN('schedule','condition')),spec TEXT NOT NULL,entity TEXT NOT NULL,action TEXT NOT NULL CHECK(action IN('turn_on','turn_off')),enabled INTEGER NOT NULL CHECK(enabled IN(0,1)),last_key TEXT,created INTEGER NOT NULL) STRICT;
 CREATE TABLE automation_jobs(id TEXT PRIMARY KEY,rule_id TEXT NOT NULL REFERENCES automation_rules(id),trigger_key TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN('pending','executing','simulated','succeeded','failed','cancelled','expired','uncertain')),created INTEGER NOT NULL,expires INTEGER NOT NULL,UNIQUE(rule_id,trigger_key)) STRICT;
 CREATE INDEX automation_jobs_state ON automation_jobs(state,expires);
 CREATE TABLE automation_audit(id INTEGER PRIMARY KEY,ts INTEGER NOT NULL,event TEXT NOT NULL,rule_id TEXT,job_id TEXT,detail TEXT NOT NULL) STRICT;
 PRAGMA user_version=2; COMMIT;`);
}
