import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const c=await browser.newContext({viewport:{width:1024,height:768},reducedMotion:'reduce'}),p=await c.newPage();const evidence={};
try{
 await p.goto('http://localhost:5173/');await p.locator('.scene-host canvas').waitFor();await p.locator('.welcome-card>.icon-button').click();
 await p.locator('#object-search').fill('Terra');await p.locator('.catalog-object').first().click();await p.waitForTimeout(500);
 evidence.unnamedVisibleButtons=await p.locator('button:visible').evaluateAll(es=>es.filter(e=>!e.getAttribute('aria-label')&&!e.getAttribute('title')&&!e.textContent.trim()).map(e=>e.outerHTML));expect(evidence.unnamedVisibleButtons).toEqual([]);
 const supported=await p.locator('.scene-host canvas').evaluate(canvas=>{const gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_lose_context');if(!ext)return false;ext.loseContext();return true;});evidence.contextLossExtensionSupported=supported;
 if(supported){await expect(p.locator('.scene-fallback')).toContainText('interrompida');await p.getByRole('button',{name:'Restaurar cena 3D',exact:true}).click();await expect(p.locator('.scene-fallback')).toHaveCount(0,{timeout:8000});await expect(p.locator('.inspector-identity h1')).toHaveText('Terra');evidence.contextRestoredWithSelection=true;}
 await p.screenshot({path:'test-results/context-recovery.png'});evidence.status='PASS';console.log(JSON.stringify(evidence));
}catch(e){evidence.status='FAIL';evidence.error=e.message.slice(0,1800);console.log(JSON.stringify(evidence));process.exitCode=1;}finally{await writeFile('test-results/capabilities-validation.json',JSON.stringify(evidence,null,2));await browser.close();}
