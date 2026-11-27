import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const [origin, puppeteerPath, output] = process.argv.slice(2);
if (!origin || !puppeteerPath || !output) throw new Error('Usage: verify-party-groups-passcode.mjs ORIGIN PUPPETEER_MODULE OUTPUT_DIRECTORY');
const { default: puppeteer } = await import(pathToFileURL(puppeteerPath).href);
const env = await readFile('.env', 'utf8');
const api = new URL(env.match(/^NEXT_PUBLIC_API_URL\s*=\s*["']?([^\r\n"']+)/m)?.[1]?.trim() || 'http://localhost:4000/api/v1', origin);
const prefix = api.pathname.replace(/\/$/, '');
const id = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const user = { id:id(1), name:'QA Owner', email:'qa@example.invalid', role:'OWNER', sessionId:'fixture', mfaEnabled:true, mfaVerified:true };
const company = { id:id(2), name:'Test Company', isActive:true, createdAt:new Date().toISOString(), workspaceBranchId:id(4), preferences:{} };
const branch = { id:id(3), businessId:company.id, name:'Main', code:'MAIN', isActive:true };
let groups = [{ id:id(5), name:'Wholesale' }];
let parties = [{ id:id(6), name:'Customer One', groupId:id(5), group:'Wholesale', gstType:'UNREGISTERED', balanceDue:20 }, { id:id(7), name:'Customer Two', groupId:null, group:null, gstType:'UNREGISTERED', balanceDue:10 }];
let enabled = true, passcode = '123456', writes = 0, failGroups = false;
const checks = [], errors = [];
await mkdir(output,{recursive:true});
const browser = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, args:['--disable-gpu'] });
let page;
console.log('Browser launched');
try {
  page = await browser.newPage();
  await page.setViewport({width:1440,height:1000});
  page.on('pageerror', (error) => errors.push(error.message));
  await page.evaluateOnNewDocument(({company,branch}) => {localStorage.setItem('activeBusinessId',company.id);localStorage.setItem('activeWorkspaceBranchId',company.workspaceBranchId);localStorage.setItem(`activeBranchId:${company.id}`,branch.id);},{company,branch});
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    const url = new URL(request.url());
    if (url.origin !== api.origin || !url.pathname.startsWith(prefix)) {
      if (url.origin === new URL(origin).origin || ['data:','blob:','about:'].includes(url.protocol)) return request.continue();
      return request.abort();
    }
    const headers = {'access-control-allow-origin':new URL(origin).origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','access-control-allow-headers':'content-type,x-business-id,x-branch-id,x-action-passcode'};
    const respond = (value,status=200) => request.respond({status,headers,contentType:'application/json',body:JSON.stringify(value)});
    if (request.method() === 'OPTIONS') return request.respond({status:204,headers});
    const endpoint = url.pathname.slice(prefix.length);
    if (request.method() !== 'GET') {
      const supplied = request.headers()['x-action-passcode'];
      if (enabled && supplied !== passcode) return respond({message:supplied?'PASSCODE_INVALID':'PASSCODE_REQUIRED'},403);
      const data = JSON.parse(request.postData() || '{}');
      if (endpoint === '/action-security') {enabled=data.enabled;if(data.passcode)passcode=data.passcode;writes++;return respond({enabled});}
      if (endpoint === '/party-groups') {const group={id:id(groups.length+20),name:data.name};groups.push(group);writes++;return respond(group);}
      const membership = endpoint.match(/^\/party-groups\/([^/]+)\/parties$/);
      if (membership) {const group=groups.find(g=>g.id===membership[1]);parties=parties.map(p=>data.partyIds.includes(p.id)?{...p,groupId:group.id,group:group.name}:p.groupId===group.id?{...p,groupId:null,group:null}:p);writes++;return respond({success:true});}
      return respond({message:'Unexpected synthetic mutation'},400);
    }
    if (endpoint === '/auth/me') return respond(user);
    if (endpoint === '/businesses') return respond([company]);
    if (endpoint === '/businesses/'+company.id) return respond(company);
    if (endpoint.endsWith('/preferences')) return respond({});
    if (endpoint === '/branches') return respond([branch]);
    if (endpoint === '/workspace-branches') return respond([{id:id(4),name:'Test workspace',code:'TEST',isActive:true,businesses:[company]}]);
    if (endpoint === '/action-security') return respond({enabled});
    if (endpoint === '/party-groups' && failGroups) return respond({message:'Simulated unavailable party groups.'},503);
    if (endpoint === '/party-groups') return respond(groups.map(g=>({...g,partyCount:parties.filter(p=>p.groupId===g.id).length})));
    if (endpoint === '/parties') return respond(parties);
    if (endpoint === '/parties/next-code') return respond({code:'P-0003'});
    const ledger=endpoint.match(/^\/parties\/([^/]+)\/ledger$/);
    if(ledger){const party=parties.find(p=>p.id===ledger[1]);return respond({party,summary:{openingBalance:0,totalBilled:0,totalReceived:0,balanceDue:party.balanceDue,creditLimit:0,creditAvailable:0},transactions:[]});}
    return respond([]);
  });
  const visit = async (route) => { console.log('Checking '+route); return page.goto(origin+route,{waitUntil:'networkidle0',timeout:30000}); };
  const text = () => page.evaluate(()=>document.body.innerText);
  const clickText = async (label) => {await page.waitForFunction((label)=>[...document.querySelectorAll('button')].some(node=>node.textContent.trim()===label&&!node.disabled),{},label);const found=await page.evaluate((label)=>{const node=[...document.querySelectorAll('button')].find(n=>n.textContent.trim()===label);if(!node)return false;node.click();return true;},label);assert.ok(found,`Missing button: ${label}`);};
  const verify = async (code) => {await page.waitForSelector('input[aria-label="Action passcode"]');await page.type('input[aria-label="Action passcode"]',code);await clickText('Verify & save');};
  await visit('/dashboard');
  assert.ok(!(await text()).includes('YOUR BUSINESS, AT A GLANCE'));assert.ok(!(await text()).includes('A clear view of your sales, spending, and what needs attention.'));checks.push('Removed dashboard copy');
  await visit('/parties');await page.waitForSelector('section[aria-label="Party overview"] article strong');
  await page.waitForFunction(()=>document.querySelector('section[aria-label="Party overview"] article strong')?.textContent==='2');
  assert.deepEqual(await page.$$eval('section[aria-label="Party overview"] article strong',nodes=>nodes.map(node=>Number(node.textContent.replace(/[^\d.]/g,'')))),[2,1,30,0]);
  assert.ok(await page.$('main a[href="/parties/details"]'));assert.ok(await page.$('main a[href="/parties/groups"]'));
  assert.equal(await page.$('nav a[href="/parties/details"][aria-current="page"]'),null);checks.push('Parties dashboard loads real party and group summaries with separate workspaces');
  await page.screenshot({path:output+'/parties-dashboard-desktop.png',fullPage:true});
  await page.click('main a[href="/parties/details"]');await page.waitForSelector('select[aria-label="Filter by party group"]');
  assert.equal(new URL(page.url()).pathname,'/parties/details');assert.ok(await page.$('nav a[href="/parties/details"][aria-current="page"]'));assert.equal(await page.$('nav a[href="/parties/groups"][aria-current="page"]'),null);checks.push('Party Details opens separately and highlights its sidebar item');
  await page.click('nav a[href="/parties/groups"]');await page.waitForFunction(()=>location.pathname==='/parties/groups');await page.waitForSelector('nav a[href="/parties/groups"][aria-current="page"]');assert.equal(await page.$('nav a[href="/parties/details"][aria-current="page"]'),null);checks.push('Party Groups opens separately and highlights only its own sidebar item');
  await page.evaluate(()=>[...document.querySelectorAll('nav button')].find(button=>button.textContent.trim()==='Parties').click());await page.waitForFunction(()=>location.pathname==='/parties');await page.waitForSelector('section[aria-label="Party overview"]');checks.push('Parties parent menu returns to the dashboard from a child page');
  await visit('/parties/groups');await clickText('Add party group');await page.waitForSelector('[role=dialog] input');await page.type('[role="dialog"] input','Retail');await clickText('Save group');
  await verify('999999');await page.waitForFunction(()=>document.body.innerText.includes('Incorrect passcode. Try again.'));await verify('123456');
  await page.waitForFunction(()=>[...document.querySelectorAll('td')].some(n=>n.textContent==='Retail'));assert.equal(writes,1);await page.waitForFunction(()=>document.querySelectorAll('[role=dialog]').length===0);checks.push('Create group requires correct passcode after wrong-passcode retry');
  await clickText('Add party group');await page.waitForSelector('[role=dialog] input');await page.type('[role="dialog"] input','Cancelled group');await clickText('Save group');await page.waitForSelector('input[aria-label="Action passcode"]');await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('input[aria-label="Action passcode"]'));assert.equal(await page.$eval('[role="dialog"] input',n=>n.value),'Cancelled group');assert.equal(writes,1);checks.push('Cancelling passcode keeps the form and saves nothing');
  await page.click('[role="dialog"] button[aria-label="Close dialog"]');
  await page.evaluate(()=>{const row=[...document.querySelectorAll('tr')].find(n=>n.textContent.includes('Wholesale'));row.querySelector('button').click();});
  await page.waitForSelector('[role="dialog"] input[type="checkbox"]');await page.evaluate(()=>{const label=[...document.querySelectorAll('[role="dialog"] label')].find(n=>n.textContent.includes('Customer Two'));label.querySelector('input').click();});await clickText('Save 2 parties');await verify('123456');
  await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));assert.ok(parties.every(p=>p.group==='Wholesale'));checks.push('Add multiple parties to a group');
  await visit('/parties?group='+id(5));assert.equal(new URL(page.url()).pathname,'/parties/details');checks.push('Legacy party group links redirect to Party Details');await page.waitForSelector('select[aria-label="Filter by party group"]');assert.equal(await page.$$eval('.reference-master-row',n=>n.length),2);
  await page.select('select[aria-label="Filter by party group"]','ungrouped');await page.waitForFunction(()=>document.querySelectorAll('.reference-master-row').length===0);assert.ok((await text()).includes('Select a record to view its details.'));checks.push('Party group filtering clears an out-of-filter detail');
  assert.equal(await page.$eval('.reference-page-action .btn-primary',n=>n.textContent.trim()),'Add Party Group');
  assert.equal(await page.$('.reference-page-action a[href="/parties/groups"]'),null);
  await clickText('Add Party Group');await page.waitForSelector('input[aria-label="Party group name"]');await page.type('input[aria-label="Party group name"]','Created from Parties');
  await page.click('[role="dialog"] button[type="submit"]');await verify('123456');await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));assert.ok(groups.some(group=>group.name==='Created from Parties'));checks.push('Parties primary button creates a Party Group and the separate group header button is removed');
  await clickText('Add Party');await page.waitForSelector('select[aria-label="Party Group"]');assert.ok((await text()).includes('+ Add Party Group'));await page.click('[role="dialog"] button[aria-label="Close dialog"]');checks.push('Party form provides managed group selector and inline creation');
  await visit('/reports?report=party-groups');await page.waitForFunction(()=>document.body.innerText.includes('PARTY GROUP'));assert.ok((await text()).includes('Wholesale'));checks.push('Party group summary report renders');
  await visit('/settings/passcode');await page.waitForSelector('input[autocomplete="new-password"]');const fields=await page.$$('input[autocomplete="new-password"]');await fields[0].type('654321');await fields[1].type('654321');await clickText('Change passcode');await verify('123456');
  await page.waitForFunction(()=>!document.querySelector('input[aria-label="Action passcode"]'));assert.equal(passcode,'654321');assert.equal(writes,4);checks.push('Changing passcode requires the existing passcode');
  await clickText('Disable passcode');await verify('654321');await page.waitForFunction(()=>document.body.innerText.includes('Protection: Not configured'));assert.equal(enabled,false);checks.push('Disabling protection requires the current passcode');
  failGroups=true;await visit('/parties');await page.waitForFunction(()=>document.body.innerText.includes('Simulated unavailable party groups.'));assert.equal(await page.$eval('section[aria-label="Party overview"] article strong',node=>node.textContent),'2');assert.ok(await page.$('main a[href="/parties/details"]'));checks.push('A group request failure keeps party data and both workspaces available');failGroups=false;
  const savedParties=parties,savedGroups=groups;parties=[];groups=[];await visit('/parties');await page.waitForFunction(()=>document.body.innerText.includes('No parties yet.'));assert.ok((await text()).includes('No party groups yet.'));checks.push('Empty Parties dashboard provides useful creation actions');parties=savedParties;groups=savedGroups;
  await visit('/parties/details?create=1');await page.waitForSelector('select[aria-label="Party Group"]');checks.push('Create-party links open the form on the separate Party Details page');
  for(const route of ['/parties','/parties/details','/parties/groups','/settings/passcode']){await page.setViewport({width:390,height:844});await visit(route);const size=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}));assert.ok(size.content<=size.width+2,`Mobile overflow at ${route}`);checks.push('Mobile layout '+route);if(route==='/parties')await page.screenshot({path:output+'/parties-dashboard-mobile.png',fullPage:true});}
  assert.deepEqual(errors,[]);await mkdir(output,{recursive:true});await page.screenshot({path:output+'/passcode-mobile.png',fullPage:true});await writeFile(output+'/results.json',JSON.stringify({passed:true,checks,successfulSyntheticWrites:writes,errors},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,successfulSyntheticWrites:writes}));
} catch (error) {
  await mkdir(output,{recursive:true});
  if(page){await writeFile(output+'/failure.json',JSON.stringify({checks,errors,url:page.url(),body:await page.evaluate(()=>document.body.innerText)},null,2));await page.screenshot({path:output+'/failure.png',fullPage:true});}
  throw error;
} finally {await browser.close();}
