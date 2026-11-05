import { mkdir, copyFile, cp } from 'node:fs/promises';
await mkdir('vendor', {recursive:true});
for (const file of ['three.module.js','three.core.js']) await copyFile('node_modules/three/build/'+file,'vendor/'+file);
await cp('node_modules/three/examples/jsm','vendor/addons',{recursive:true});
await copyFile('node_modules/three/LICENSE','vendor/LICENSE.three');
