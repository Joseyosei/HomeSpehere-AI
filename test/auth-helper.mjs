import {createAuth,authConfig} from '../backend/auth/service.mjs';
export const setupToken='s'.repeat(40),password='Test-only-passphrase-123';
export const securityConfig=authConfig({HS_SETUP_TOKEN:setupToken});
export async function ownerHeaders(db){
 const a=createAuth(db,securityConfig);await a.register({email:'owner@example.test',password,setupToken});
 const s=await a.login({email:'owner@example.test',password});
 return {Cookie:'hs_session='+s.token,'X-CSRF-Token':s.csrf};
}
