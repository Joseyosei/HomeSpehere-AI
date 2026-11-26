export function migrateAuth(db){
 db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN('owner','viewer')),created INTEGER NOT NULL) STRICT;
 CREATE TABLE memberships(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,household_id TEXT NOT NULL REFERENCES households(id),PRIMARY KEY(user_id,household_id)) STRICT;
 CREATE TABLE sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,created INTEGER NOT NULL,expires INTEGER NOT NULL) STRICT;
 CREATE INDEX sessions_expiry ON sessions(expires);
 CREATE TABLE security_audit(id INTEGER PRIMARY KEY,ts INTEGER NOT NULL,event TEXT NOT NULL,user_id TEXT,detail TEXT NOT NULL) STRICT;
 PRAGMA user_version=3; COMMIT;`);
}
