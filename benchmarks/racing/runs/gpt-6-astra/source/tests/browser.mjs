import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const output=resolve('output/playwright');await mkdir(output,{recursive:true});
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
const results=[],errors=[],network=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true,locale:'pt-BR'});
const page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:')&&!r.url().startsWith('data:'))network.push(r.url());});
page.on('dialog',d=>d.accept());
const base='http://127.0.0.1:5173/?harness=1&case=acceptance';
await page.goto(base);await page.waitForFunction(()=>window.__mareHarness?.state().libraryAvailable);
const h=(method,...args)=>page.evaluate(({method,args})=>window.__mareHarness[method](...args),{method,args});
const screenshot=name=>page.screenshot({path:resolve(output,`${name}.png`)});
async function check(name,fn){if(only&&!only.includes(name))return;try{const evidence=await fn();results.push({name,status:'passed',evidence});console.log(`PASS ${name}: ${JSON.stringify(evidence)}`);}catch(e){results.push({name,status:'failed',error:e.message});console.log(`FAIL ${name}: ${e.message}`);await screenshot(`failure-${name}`).catch(()=>{});}}
async function newRace(options={}){await h('start',{mode:'trial',car:'brisa',weather:'sunny',daylight:'day',difficulty:'normal',...options});}
async function fullRace(options={}){await newRace(options);return h('advance',350);}

await check('first-launch',async()=>{
 assert(await page.getByRole('heading',{level:1}).isVisible());await screenshot('menu');
 await page.getByRole('button',{name:/Conheça sua próxima companhia/}).click();
 for(const name of ['Maré GT','Solstice S','Brisa R'])await page.getByRole('button',{name:new RegExp('^'+name+' ')}).click();
 await screenshot('garage');await page.getByRole('button',{name:'Este é o meu carro →'}).click();
 assert(await page.getByRole('button',{name:'Entrar na pista →'}).isVisible());
 return {means:'direct UI',cars:3,renderer:await h('state').then(s=>s.render)};
});
await check('settings-bindings',async()=>{
 await page.getByRole('button',{name:'Ajustes',exact:true}).click();await page.getByRole('button',{name:'Alterar Frear / ré'}).click();await page.keyboard.press('KeyW');assert.match(await page.locator('#binding-error').innerText(),/Já usada/);await page.keyboard.press('KeyX');assert.equal((await h('state')).settings.bindings.brake,'KeyX');
 await page.getByRole('button',{name:'Alterar Acelerar'}).click();await page.keyboard.press('ArrowUp');assert.equal((await h('state')).settings.bindings.throttle,'ArrowUp');
 await page.getByLabel('Qualidade gráfica',{exact:true}).selectOption('low');assert.equal((await h('state')).settings.quality,'low');await screenshot('settings');await page.getByRole('button',{name:'Fechar ajustes'}).click();
 await page.getByRole('button',{name:'Entrar na pista →'}).click();await page.waitForTimeout(3350);await page.keyboard.down('ArrowUp');await page.waitForTimeout(700);await page.keyboard.up('ArrowUp');assert((await h('state')).race.cars[0].speed>3);
 await page.keyboard.press('Escape');const time=(await h('state')).race.time;await page.waitForTimeout(400);assert.equal((await h('state')).race.time,time);
 await page.getByRole('button',{name:'Ajustar a experiência'}).click();await page.getByRole('button',{name:'Restaurar teclas originais'}).click();await page.getByLabel('Qualidade gráfica',{exact:true}).selectOption('medium');await page.getByRole('button',{name:'Fechar ajustes'}).click();assert.equal((await h('state')).race.time,time);await page.getByRole('button',{name:'Continuar →'}).click();
 return {means:'direct keyboard and UI',conflictRejected:true,reboundThrottleMovedCar:true,pauseTime:time};
});
await check('direct-driving-interruptions',async()=>{
 await newRace();await page.waitForTimeout(3300);await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');await page.waitForTimeout(1100);await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');const moving=(await h('state')).race;assert(moving.cars[0].speed>5);assert(moving.cars[0].nitro<100);await screenshot('driving-day');
 await page.locator('[data-act="pause"]').focus();await page.keyboard.down('Space');await page.keyboard.down('KeyW');await page.keyboard.down('KeyA');await page.waitForTimeout(200);await page.keyboard.up('Space');await page.keyboard.up('KeyA');await page.keyboard.up('KeyW');assert.equal((await h('state')).screen,'drive');assert.equal(await page.evaluate(()=>scrollY),0);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const paused=(await h('state')).race;assert.equal(paused.status,'paused');await page.waitForTimeout(350);assert.equal((await h('state')).race.time,paused.time);await page.getByRole('button',{name:'Continuar →'}).click();await page.waitForTimeout(100);assert(!(await h('state')).race.cars[0].boost);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Encerrar tentativa e ver replay parcial'}).click();assert.equal((await h('transient')).status,'partial');
 return {means:'direct keyboard; injected blur event',speed:moving.cars[0].speed,nitro:moving.cars[0].nitro,retirement:'partial',focusedHudSpaceSafe:true};
});
await check('time-trial-completion',async()=>{
 const r=await fullRace();assert.equal(r.status,'finished');assert.equal(r.cars[0].laps.length,3);assert(r.cars[0].laps.every(l=>l.valid));await page.waitForTimeout(100);const records=await h('records');assert(records.length>0);assert(records.every(r=>r.origin==='harness'));await screenshot('results');
 await h('showReplay');await page.waitForTimeout(100);const sample=await h('seek',r.time*.55);assert(sample.time>50);await screenshot('replay');
 for(const name of ['Órbita','Aérea','Perseguição'])await page.getByRole('button',{name,exact:true}).click();await page.getByRole('button',{name:'Reproduzir ou pausar replay'}).click();await page.waitForTimeout(250);await page.getByRole('button',{name:'Reproduzir ou pausar replay'}).click();const t=(await h('state')).replayTime;await page.waitForTimeout(150);assert.equal((await h('state')).replayTime,t);
 return {means:'fixed-step input harness + viewer UI',time:r.time,laps:r.cars[0].laps,recordsNamespace:(await h('state')).namespace};
});
await check('race-difficulties',async()=>{
 const races=[];for(const difficulty of ['easy','normal','hard']){
  await newRace({mode:'race',difficulty,car:'mare'});await h('advance',35);if(difficulty==='normal')await screenshot('race-six-cars');const r=await h('advance',350);assert.equal(r.status,'finished');assert.equal(r.cars.length,6);assert(r.cars.slice(1).every(c=>c.nextGate>20));assert(r.time>120&&r.time<240);const rp=await h('transient');assert.equal(rp.identities.length,6);assert(rp.events.some(e=>e.type==='collision'));races.push({difficulty,time:r.time,place:r.result.place,rivalsFinished:r.cars.slice(1).filter(c=>c.finishTime!==null).length,rivalLaps:r.cars.slice(1).map(c=>c.completed),collisions:rp.events.filter(e=>e.type==='collision').length});
 }return {means:'fixed-step input harness',races};
});
await check('checkpoint-success-failure',async()=>{
 const success=await fullRace({mode:'rush'});assert.equal(success.status,'finished');assert.equal(success.gates,24);assert(success.score>5000);await screenshot('checkpoint-results');await newRace({mode:'rush'});const fail=await h('advance',40,false);assert.equal(fail.status,'failed');assert.equal((await h('transient')).status,'failed');return {means:'fixed-step input harness',gates:success.gates,score:success.score,successTime:success.time,timeout:fail.time};
});
await check('weather-damage-replay',async()=>{
 await newRace({mode:'race',weather:'rainy',daylight:'night'});await h('advance',25);await screenshot('rain-night');await h('forceCollision');const hit=await h('advance',1,true);assert(hit.cars[0].damage>0);await h('advance',.1,false,{recover:true});const recovered=(await h('state')).race;assert(recovered.cars[0].recovery>0);await h('advance',70);await page.keyboard.press('Escape');await page.getByRole('button',{name:'Encerrar tentativa e ver replay parcial'}).click();const rp=await h('transient');const collision=rp.events.find(e=>e.car===0&&e.type==='collision'),recovery=rp.events.find(e=>e.car===0&&e.type==='recovery');assert(collision&&recovery);await h('showReplay');const before=await h('seek',Math.max(0,collision.t-.2));const after=await h('seek',collision.t+.1);assert(after.cars[0].damage>before.cars[0].damage);const a=await h('seek',20);await h('seek',70);const b=await h('seek',20);assert.deepEqual(a,b);const late=await h('seek',rp.duration);assert.notEqual(before.climate.wet,late.climate.wet);await screenshot('replay-wet-damage');return {means:'input harness + collision injection + viewer UI',damage:after.cars[0].damage,collision:collision.t,recovery:recovery.t,wetBefore:before.climate.wet,wetAfter:late.climate.wet};
});
await check('postcard',async()=>{
 await fullRace();await h('showReplay');await h('seek',40);await page.getByRole('button',{name:'Criar cartão ↗'}).click();await page.getByLabel('Legenda do cartão').fill('Uma curva, um horizonte.');await page.getByLabel('Moldura',{exact:true}).selectOption('coral');await page.getByLabel('Órbita da câmera').fill('2.7');await screenshot('postcard-studio');const event=page.waitForEvent('download');await page.getByRole('button',{name:'Guardar imagem ↓'}).click();const dl=await event;await dl.saveAs(resolve(output,'cartao-teste.png'));const data=await readFile(resolve(output,'cartao-teste.png'));assert.equal(data.subarray(1,4).toString(),'PNG');assert(data.length>10000);await page.getByRole('button',{name:'Voltar ao replay'}).click();return {means:'direct UI over harness replay',pngBytes:data.length};
});
await check('replay-library-roundtrip',async()=>{
 await fullRace();const event=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar arquivo',exact:true}).click();const dl=await event;const file=resolve(output,'harness-replay.json');await dl.saveAs(file);
 await page.getByRole('button',{name:'Salvar replay',exact:true}).click();let lib=await h('list');assert.equal(lib.entries.length,1);const records=await h('records');await page.reload();await page.waitForFunction(()=>window.__mareHarness?.state().libraryAvailable);lib=await h('list');assert.equal(lib.entries.length,1);const env=await h('load',lib.entries[0].id);assert.equal(env.replay.status,'finished');
 await page.getByRole('button',{name:'Replays',exact:true}).click();await page.locator('.library-row').first().waitFor();await page.locator('#file-import').setInputFiles(file);await page.waitForFunction(()=>document.querySelectorAll('.library-row').length===2);lib=await h('list');assert.equal(lib.entries.length,2);assert.equal(lib.entries.filter(e=>e.origin==='imported').length,1);assert.deepEqual(await h('records'),records);await screenshot('library');return {means:'direct save/export/import/refresh UI',entries:lib.entries.length,imported:true,bytes:(await readFile(file)).length};
});
await check('untrusted-import-and-capacity',async()=>{
 const file=resolve(output,'harness-replay.json');let data;try{data=JSON.parse(await readFile(file,'utf8'));}catch{await fullRace();data=await h('transient');}
 const records=await h('records');data.result={best:.001};data.origin='local';data.label='<img src=x onerror=alert(1)>';await h('importText',JSON.stringify(data));assert.deepEqual(await h('records'),records);
 let lib=await h('list');while(lib.entries.length<5){await h('importText',JSON.stringify(data));lib=await h('list');}
 await assert.rejects(()=>h('importText',JSON.stringify(data)),/cheia/);assert.equal((await h('list')).entries.length,5);await assert.rejects(()=>h('importText','{invalid'),/JSON inválido/);const bad=structuredClone(data);bad.version=50;await assert.rejects(()=>h('importText',JSON.stringify(bad)),/incompatível/);assert.equal((await h('list')).entries.length,5);
 // Exercise the visible full-library choice; cancellation preserves every id.
 await fullRace();const before=(await h('list')).entries.map(e=>e.id);await page.getByRole('button',{name:'Salvar replay',exact:true}).click();await page.getByRole('button',{name:'Cancelar',exact:true}).click();assert.deepEqual((await h('list')).entries.map(e=>e.id),before);await page.getByRole('button',{name:'Salvar replay',exact:true}).click();await page.locator('.replace-choice').first().click();lib=await h('list');assert.equal(lib.entries.length,5);assert(!lib.entries.some(e=>e.id===before[0]));return {means:'import harness + real capacity dialog UI',capacity:5,cancelPreserved:true,explicitReplace:true,recordsUnchanged:true};
});
await check('concurrent-and-interrupted-storage',async()=>{
 let lib=await h('list');while(lib.entries.length>4){await h('remove',lib.entries.at(-1).id);lib=await h('list');}await fullRace();while(lib.entries.length<4){await h('save');lib=await h('list');}
 const second=await context.newPage();second.on('dialog',d=>d.accept());await second.goto(base);await second.waitForFunction(()=>window.__mareHarness?.state().libraryAvailable);await second.evaluate(()=>{window.__mareHarness.start();window.__mareHarness.advance(350);});
 const saves=await Promise.allSettled([h('save'),second.evaluate(()=>window.__mareHarness.save())]);assert.equal(saves.filter(s=>s.status==='fulfilled').length,1);assert.equal((await h('list')).entries.length,5);await second.close();await page.bringToFront();
 await h('remove',(await h('list')).entries.at(-1).id);assert(await h('quotaFailure'));lib=await h('list');assert.equal(lib.entries.length,4);assert(lib.orphans.length>0);await h('save');lib=await h('list');assert.equal(lib.entries.length,5);const orphan=lib.orphans.find(e=>!e.broken);assert(orphan);await assert.rejects(()=>h('recover',orphan.id),/ocupados/);assert((await h('list')).orphans.some(e=>e.id===orphan.id));await h('recover',orphan.id,lib.entries[0].id);assert.equal((await h('list')).entries.length,5);return {means:'two actual tabs + injected metadata quota failure',parallelSaves:saves.map(s=>s.status),orphanRecoveryAtCapacity:true};
});
await check('quality-resize-context-storage',async()=>{
 await newRace({mode:'race',weather:'rainy'});await h('advance',25);await page.keyboard.press('Escape');const time=(await h('state')).race.time;await page.getByRole('button',{name:'Ajustar a experiência'}).click();const workloads=[];
 for(const q of ['low','medium','high']){await page.getByLabel('Qualidade gráfica',{exact:true}).selectOption(q);await page.waitForTimeout(120);workloads.push({quality:q,...(await h('state')).render});assert.equal((await h('state')).race.time,time);}assert(workloads[0].triangles<workloads[2].triangles);
 await page.setViewportSize({width:800,height:680});await screenshot('settings-narrow');assert(await page.getByRole('button',{name:'Fechar ajustes'}).isVisible());await page.getByRole('button',{name:'Fechar ajustes'}).click();await page.getByRole('button',{name:'Continuar →'}).click();await screenshot('driving-narrow');
 const lossSupported=await h('contextLoss');if(lossSupported){await page.waitForTimeout(900);assert.equal((await h('state')).screen,'pause');await page.getByRole('button',{name:'Continuar →'}).click();assert.equal((await h('state')).screen,'drive');}
 await h('denyStorage');await h('advance',350);await page.getByRole('button',{name:'Salvar replay',exact:true}).click();assert.match(await page.locator('#notice').innerText(),/negado|temporário/);assert.equal((await h('transient')).status,'finished');await h('allowStorage');await page.setViewportSize({width:1440,height:900});return {means:'direct settings/resize + injected context loss/storage denial',workloads,contextLossSupported:lossSupported};
});
await check('static-production',async()=>{
 const p=await context.newPage();const requests=[];p.on('request',r=>requests.push(r.url()));await p.goto('http://127.0.0.1:4173');await p.getByRole('button',{name:'Vamos para a pista ↗'}).waitFor();assert.equal(await p.evaluate(()=>typeof window.__mareHarness),'undefined');await p.getByRole('button',{name:'Vamos para a pista ↗'}).click();await p.getByRole('button',{name:'Entrar na pista →'}).click();await p.waitForTimeout(3500);await p.keyboard.down('KeyW');await p.waitForTimeout(700);await p.keyboard.up('KeyW');assert(Number(await p.locator('#speed').innerText())>0);await p.screenshot({path:resolve(output,'static-production.png')});assert(requests.every(u=>u.startsWith('http://127.0.0.1:4173')||u.startsWith('data:')));await p.keyboard.press('Escape');await p.getByRole('button',{name:'Encerrar tentativa e ver replay parcial'}).click();await p.getByRole('button',{name:'Salvar replay',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#notice')?.textContent==='Replay salvo na biblioteca local.');await p.reload();await p.getByRole('button',{name:'Replays',exact:true}).click();await p.getByRole('button',{name:'Assistir',exact:true}).first().waitFor();await p.getByRole('button',{name:'Assistir',exact:true}).first().click();await p.getByRole('button',{name:'Criar cartão ↗'}).waitFor();await p.screenshot({path:resolve(output,'static-saved-replay.png')});await p.close();return {means:'direct keyboard/UI on generic static host',productionHarnessAbsent:true,noExternalRequests:true,persistenceSurvivedRefresh:true,savedViewerOpened:true};
});
await check('runtime-cleanliness',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(network,[]);return {uncaughtErrors:errors,externalRequests:network,browser:browser.version()};});

// Disposable harness stores and the fresh browser context are removed at closeout.
await h('purge').catch(e=>console.log(`Test-store cleanup: ${e.message}`));
await writeFile(resolve(output,only?`acceptance-targeted-${only.join('-')}.json`:'acceptance.json'),JSON.stringify({browser:browser.version(),environment:'Chrome headless, 1440x900 / 800x680. Fixed simulation steps for complete races; no consumer GPU FPS claim.',results,errors,network},null,2));
await context.close();await browser.close();
process.exitCode=results.some(r=>r.status==='failed')?1:0;
