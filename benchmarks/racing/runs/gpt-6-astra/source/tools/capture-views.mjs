import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const out=resolve('output/playwright');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},locale:'pt-BR'});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173/?harness=1&case=visual');await page.waitForFunction(()=>window.__mareHarness?.state().libraryAvailable);
const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
await settle();await page.screenshot({path:resolve(out,'menu-final.png')});
await page.setViewportSize({width:800,height:680});await settle();await page.screenshot({path:resolve(out,'menu-narrow-final.png')});await page.setViewportSize({width:1440,height:900});
const views=[['trial','sunny','day',16,'coastal-final'],['race','rainy','night',12,'rain-night-final'],['race','sunny','sunset',28,'village-final'],['rush','cloudy','morning',35,'hills-final']];
for(const [mode,weather,daylight,time,name] of views){await page.evaluate(o=>{window.__mareHarness.start(o);window.__mareHarness.advance(o.time);},{mode,weather,daylight,time,car:'mare'});await settle();await page.screenshot({path:resolve(out,`${name}.png`)});}
const counts=[];
for(const mode of ['trial','race','trial']){await page.evaluate(mode=>window.__mareHarness.start({mode}),mode);await settle();counts.push({mode,...await page.evaluate(()=>window.__mareHarness.state().render)});}
await page.evaluate(()=>window.__mareHarness.purge());
await writeFile(resolve(out,'visual-inspection.json'),JSON.stringify({browser:browser.version(),views:views.map(v=>v[4]),sizes:['1440x900','800x680'],errors,resourceCounts:counts,means:'rendered frames of harness-driven real simulation, not human driving'},null,2));
console.log(JSON.stringify({errors,resourceCounts:counts}));await context.close();await browser.close();
