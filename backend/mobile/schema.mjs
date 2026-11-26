export function migrateMobile(db){db.exec(`BEGIN IMMEDIATE;
CREATE TABLE mobile_pairings(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,household_id TEXT NOT NULL REFERENCES households(id),expires INTEGER NOT NULL) STRICT;
CREATE TABLE mobile_credentials(id TEXT PRIMARY KEY,hash TEXT NOT NULL UNIQUE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,household_id TEXT NOT NULL REFERENCES households(id),name TEXT NOT NULL,created INTEGER NOT NULL,expires INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN(0,1))) STRICT;
CREATE INDEX mobile_pairings_expiry ON mobile_pairings(expires);
PRAGMA user_version=4; COMMIT;`);}
