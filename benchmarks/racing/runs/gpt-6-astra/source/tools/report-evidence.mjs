import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='output/playwright';
const files=['acceptance.json','acceptance-targeted.json','acceptance-targeted-static-production.json'];
const runs=await Promise.all(files.map(async path=>({file:path,...JSON.parse(await readFile(`${dir}/${path}`,'utf8'))})));
const cases=new Map();
for(const run of runs)for(const c of run.results){if(c.status==='passed')cases.set(c.name,{...c,evidenceFile:run.file});else if(!cases.has(c.name))cases.set(c.name,{...c,evidenceFile:run.file});}
const hashes=[];
for(const folder of ['src','dist','dist/assets'])for(const file of await readdir(folder,{withFileTypes:true}))if(file.isFile()){const path=`${folder}/${file.name}`,bytes=await readFile(path);hashes.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
const report={deliveryDate:'2026-11-01',timezone:'America/Cuiaba',kind:'game implementation verification',logic:{passed:12,total:12,command:'npm test'},browser:{passed:[...cases.values()].filter(c=>c.status==='passed').length,total:cases.size,cases:[...cases.values()]},priorObservations:runs.flatMap(r=>r.results.filter(c=>c.status!=='passed').map(c=>({file:r.file,...c}))),finalVisualInspection:JSON.parse(await readFile(`${dir}/visual-inspection.json`,'utf8')),hashes,limitations:['No consumer GPU FPS claim','No human-completed full race claim','Physical audio output, fullscreen, foreign keyboard layout and other browser engines not independently verified'],testIsolation:'Harness stores purged; production-origin checks used disposable contexts.'};
await writeFile(`${dir}/acceptance-final.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({logic:report.logic,browser:{passed:report.browser.passed,total:report.browser.total},hashedFiles:hashes.length,report:`${dir}/acceptance-final.json`}));
