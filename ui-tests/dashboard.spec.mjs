import {test,expect} from '@playwright/test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../backend/db.mjs';
import {seedDemo} from '../backend/seed.mjs';
import {createAuth,authConfig} from '../backend/auth/service.mjs';
import {makeServer} from '../server.mjs';
let server,db,dir,base;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'hs-ui-'));db=openDatabase(join(dir,'ui.sqlite'));seedDemo(db);const config=authConfig({HS_SETUP_TOKEN:'x'.repeat(40)});const a=createAuth(db,config);await a.register({email:'owner@example.test',password:'Test-only-password-123',setupToken:config.setup});server=makeServer(db,undefined,undefined,undefined,undefined,undefined,config);await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;});
test.afterAll(async()=>{if(server)await new Promise(r=>server.close(r));db?.close();if(dir)rmSync(dir,{recursive:true,force:true});});
async function login(page){await page.goto(base);await page.locator('#auth-login input[name=email]').fill('owner@example.test');await page.locator('#auth-login input[name=password]').fill('Test-only-password-123');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#dashboard')).toBeVisible();await expect(page.locator('#overview .metric')).toHaveCount(4);}
test('desktop login, preferences and display mode',async({page})=>{await login(page);await page.locator('#theme-select').selectOption('light');await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.locator('#layout-settings summary').click();await page.getByLabel('Devices',{exact:true}).uncheck();await expect(page.locator('#devices')).toBeHidden();await page.reload();await expect(page.locator('#dashboard')).toBeVisible();await expect(page.locator('#devices')).toBeHidden();await page.getByRole('button',{name:'Display mode',exact:true}).click();await expect(page.locator('#automation')).toBeHidden();await page.keyboard.press('Escape');await expect(page.locator('#automation')).toBeVisible();});
test('mobile viewport fits without horizontal overflow',async({page})=>{await page.setViewportSize({width:390,height:844});await login(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await expect(page.locator('#household')).toBeVisible();});
test('offline navigation shows public shell and no cached data',async({page,context})=>{await login(page);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByRole('heading',{name:"You're offline"})).toBeVisible();await context.setOffline(false);});
