import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {emptyCollection} from '../src/storage.js';
const root=process.cwd(),out=path.join(root,'test-results');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,downloadsPath:out,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const results=[];
const c=await browser.newContext({viewport:{width:1024,height:768},reducedMotion:'reduce',acceptDownloads:true});
const seed=emptyCollection();seed.settings.lang='en';seed.settings.quality='low';seed.settings.reducedMotion=true;seed.onboarded=true;
await c.addInitScript(data=>localStorage.setItem('orbita-observatory-v1',JSON.stringify(data)),seed);
const p=await c.newPage();p.setDefaultTimeout(8000);const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:5173/');await p.locator('.scene-host canvas').waitFor();
const openTool=async title=>{await p.locator('.primary-nav button').nth(2).click();await p.locator('.tools-grid>button').filter({hasText:title}).click();};
const learning=async()=>{await p.locator('.primary-nav button').nth(1).click();await p.locator('.learning-links button').filter({hasText:'Discovery challenges'}).click();};
const select=async name=>{await p.locator('#object-search').fill(name);await p.locator('.catalog-object').first().click();};
const record=async(name,fn)=>{if(process.env.EXT_FILTER&&!name.match(new RegExp(process.env.EXT_FILTER,'i')))return;try{await fn();results.push({name,status:'PASS'});console.log('PASS',name);}catch(e){results.push({name,status:'FAIL',error:e.message.slice(0,1800)});console.log('FAIL',name,e.message.slice(0,500));await p.screenshot({path:path.join(out,'extended-failure-'+name.replace(/\W+/g,'-')+'.png')}).catch(()=>{});}};
await record('all twelve learning activities evaluate actual exploration state',async()=>{
 await learning();await p.locator('.activities-grid>button').first().click();
 for(let id=0;id<12;id++){
  await expect(p.locator('.activity-index')).toContainText(String(id+1).padStart(2,'0'));
  await p.locator('.activity-detail>.button-row').getByRole('button',{name:'Explore in the scene',exact:true}).click();
  if(id===0)await select('Mercury');
  if(id===1)await select('Jupiter');
  if(id===2){await select('Earth');await p.locator('.inspector [role=tab]').filter({hasText:'Data'}).click();await p.locator('.inspector-content').getByRole('button',{name:'Observe one orbit',exact:true}).click();await expect(p.locator('.playback-controls .play-button')).toHaveAttribute('aria-label','Play',{timeout:45000});}
  if(id===3)await p.getByLabel('Orbital position',{exact:true}).fill('180');
  if(id===4){await p.getByLabel('Central mass',{exact:true}).fill('1');await p.getByLabel('Semi-major axis',{exact:true}).fill('2');await p.getByRole('button',{name:'Run',exact:true}).click();}
  if(id===5){await p.getByLabel('Axial tilt',{exact:true}).fill('0');await p.getByLabel('Latitude',{exact:true}).fill('30');}
  if(id===6){await select('Saturn');await p.getByRole('button',{name:'Equatorial view',exact:true}).click();await p.getByRole('button',{name:'Polar view',exact:true}).click();}
  if(id===7){await select('Moon');await p.locator('.inspector-content').getByRole('button',{name:'Follow',exact:true}).click();}
  if(id===8)await p.getByLabel('Test mass',{exact:true}).fill('60');
  let answer='';
  if(id===9){await p.getByLabel('From',{exact:true}).selectOption('sun');await p.getByLabel('To',{exact:true}).selectOption('earth');const freeze=p.getByRole('button',{name:'Freeze',exact:true});if(await freeze.count())await freeze.click();answer=(await p.locator('.measurement-workspace>.stat-strip .stat').nth(1).locator('strong').textContent()).replace(/[^\d.]/g,'');}
  if(id===10)await p.locator('.scale-badge').click();
  if(id===11){await p.locator('.tool-header-actions>.icon-button').click();await select('Earth');await p.locator('.inspector [role=tab]').filter({hasText:'Sources'}).click();}
  await learning();
  if(id===2)await p.getByLabel('Your answer (days)',{exact:true}).fill('365.256');
  if(id===8)await p.getByLabel('Your answer (N)',{exact:true}).fill('97.45');
  if(id===9)await p.getByLabel('Your answer (s)',{exact:true}).fill(answer);
  if(id===11)await p.getByLabel('Your answer',{exact:true}).selectOption('0');
  await p.getByRole('button',{name:'Check discovery',exact:true}).click();await expect(p.locator('.activity-feedback')).toContainText('Exactly');
  console.log('  activity',id+1,'passed');
  if(id<11)await p.locator('.activity-detail>.button-row').getByRole('button',{name:'Next',exact:true}).click();
 }
 const completed=await p.evaluate(()=>JSON.parse(localStorage.getItem('orbita-observatory-v1')).completed);expect(new Set(completed).size).toBe(12);
 await p.screenshot({path:path.join(out,'extended-twelve-activities-complete.png')});
});
await record('photo options, bounded recording and private-free portable scene export',async()=>{
 await p.locator('.brand').click();await select('Saturn');await openTool('Photography');
 await p.getByLabel('Aspect ratio',{exact:true}).selectOption('square');await p.getByLabel('Exposure',{exact:true}).fill('1.3');await p.getByLabel('Star intensity',{exact:true}).fill('0.3');await p.getByLabel('Labels',{exact:true}).check();await p.getByLabel('Orbits',{exact:true}).check();await p.getByLabel('Composition guides',{exact:true}).uncheck();await p.getByRole('button',{name:'Capture',exact:true}).click();await expect(p.locator('.photo-result')).toContainText('1024 × 1024');
 const dl=p.waitForEvent('download');await p.getByRole('button',{name:'Download PNG',exact:true}).click();await (await dl).saveAs(path.join(out,'saturn-square.png'));
 await p.locator('.photo-result>button').first().click();
 const canRecord=await p.evaluate(()=>typeof MediaRecorder!=='undefined'&&!!HTMLCanvasElement.prototype.captureStream);
 if(canRecord){await p.getByRole('button',{name:'Record video',exact:true}).click();await expect(p.getByRole('button',{name:'Stop recording',exact:true})).toBeVisible();await p.waitForTimeout(1000);await p.getByRole('button',{name:'Stop recording',exact:true}).click();await expect(p.locator('a[download="orbita.webm"]')).toBeVisible();const video=p.waitForEvent('download');await p.locator('a[download="orbita.webm"]').click();await (await video).saveAs(path.join(out,'test-video.webm'));expect((await readFile(path.join(out,'test-video.webm'))).length).toBeGreaterThan(1000);}
 await p.locator('.photo-top>button').click();await p.getByRole('button',{name:'Share scene',exact:true}).click();const scene=p.waitForEvent('download');await p.getByRole('button',{name:'Download scene file',exact:true}).click();await (await scene).saveAs(path.join(out,'portable-scene.json'));const file=JSON.parse(await readFile(path.join(out,'portable-scene.json'),'utf8'));expect(file.target).toBe('saturn');expect(file.notes).toBeUndefined();expect(file.settings).toBeUndefined();await p.getByRole('dialog').getByLabel('Import',{exact:true}).setInputFiles(path.join(out,'portable-scene.json'));await expect(p.locator('.modal-backdrop')).toHaveCount(0);await expect(p.locator('.inspector-identity h1')).toHaveText('Saturn');
});
await record('mobile touch and pinch have working explorer alternatives',async()=>{
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'}),q=await mobile.newPage();await q.goto('http://localhost:5173/');await q.locator('.scene-host canvas').waitFor();await q.waitForLoadState('networkidle');await q.screenshot({path:path.join(out,'final-mobile-opening.png')});await q.locator('.welcome-card>.icon-button').tap();
 const before=await q.locator('.body-label').evaluateAll(es=>es.map(e=>e.style.transform).join('|'));const session=await mobile.newCDPSession(q);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:135,y:355,id:1},{x:255,y:355,id:2}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:100,y:355,id:1},{x:290,y:355,id:2}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await q.waitForTimeout(400);const after=await q.locator('.body-label').evaluateAll(es=>es.map(e=>e.style.transform).join('|'));expect(after).not.toBe(before);
 await q.locator('.mobile-menu').tap();await q.locator('#object-search').fill('Terra');await q.locator('.catalog-object').first().tap();await expect(q.locator('.inspector-identity h1')).toHaveText('Terra');await q.screenshot({path:path.join(out,'final-mobile-earth.png')});await mobile.close();
});
await writeFile(path.join(out,'extended-validation.json'),JSON.stringify({results,errors,environment:{browser:await browser.version(),rendering:'ANGLE SwiftShader',touch:'CDP emulation; no physical hardware tested'}},null,2));console.log(JSON.stringify({passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,errors},null,2));await browser.close();if(results.some(r=>r.status==='FAIL')||errors.length)process.exitCode=1;
