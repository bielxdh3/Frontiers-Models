import * as THREE from 'three';
export const PRESETS=[
 {id:'s1',name:'reta-orla',s:245,mode:'drive',refs:['01-golden-hour-palmeiras.jpg','02-costa-praia-falesia.jpg']},
 {id:'s2',name:'grid-3-4',s:153,mode:'beauty',noHUD:true,refs:['11-carro-pintura-vidro-rodas.jpg']},
 {id:'s3',name:'praia-espuma',s:330,mode:'shore',refs:['02-costa-praia-falesia.jpg','04-agua-margem-pedras.jpg']},
 {id:'s4',name:'falesia-mirante',s:1010,mode:'drive',refs:['02-costa-praia-falesia.jpg']},
 {id:'s5',name:'vila-rua',s:1525,mode:'drive',refs:['05-vila-igreja-densidade.jpg','06-vila-pedra-disputa.jpg','07-vila-paredes-velocidade.jpg']},
 {id:'s6',name:'bosque-luz',s:2325,mode:'drive',refs:['08-vegetacao-densa.jpg','10-luz-rasante-floresta.jpg']},
 {id:'s7',name:'ponte-ou-tunel',s:2504,mode:'drive',refs:['14-ponte-terreno.jpg']},
 {id:'s8',name:'disputa',s:430,mode:'battle',refs:['09-vegetacao-curva-disputa.jpg','13-pelotao-ia-lado-a-lado.jpg']},
 {id:'s9',name:'close-pista',s:1010,mode:'close',refs:[]},
 {id:'s10',name:'baixa-vila',s:1525,mode:'drive',quality:'low',refs:[]},
 {id:'s11',name:'escala',s:1525,mode:'scale',refs:[]},
 {id:'s12',name:'mapa',s:153,mode:'top',noHUD:true,refs:[]}
];
export function audit(r){
 const tris=g=>(g.index?.count||g.attributes.position.count)/3,materials=new Map(),textures=new Map(),entities=new Map(),cars=[],boxViolations=[],flatViolations=[],smallTextures=[];let meshes=0,totalTriangles=0;
 r.scene.updateMatrixWorld(true);r.scene.traverse(o=>{if(o.userData.type==='car'){let n=0;const mats=new Set();o.traverse(child=>{if(child.isMesh){n+=tris(child.geometry);for(const mat of Array.isArray(child.material)?child.material:[child.material])mats.add(mat.uuid);}});cars.push({name:o.name,model:o.userData.model,triangles:n,materials:mats.size});}
  if(!o.isMesh||o.userData.exempt||o===r.world.ocean.mesh)return;meshes++;const g=o.geometry;g.computeBoundingBox();const size=g.boundingBox.getSize(new THREE.Vector3()),n=tris(g);totalTriangles+=n*(o.count||1);if((n<=12||g.type==='BoxGeometry')&&Math.max(size.x,size.y,size.z)>1)boxViolations.push({name:o.name,type:g.type,triangles:n,size:size.toArray()});
  if(o.isInstancedMesh&&o.userData.entityIds){const matrix=new THREE.Matrix4();o.userData.entityIds.forEach((id,i)=>{if(entities.has(id))return;o.getMatrixAt(i,matrix);const p=new THREE.Vector3().setFromMatrixPosition(matrix),nearest=r.track.nearest(p.x,p.z);entities.set(id,{type:o.userData.entityType,variant:o.userData.variant,s:nearest.s,position:p.toArray()});});}
  for(const m of Array.isArray(o.material)?o.material:[o.material]){const glass=m.isMeshPhysicalMaterial&&m.transparent&&m.opacity>.5&&m.roughness<.15,emissive=m.emissive&&m.emissive.getHex()>0;materials.set(m.uuid,{name:m.name,type:m.type,albedo:!!m.map,normal:!!m.normalMap,glass,emissive:!!emissive});if(!m.map&&!m.normalMap&&!glass&&!emissive)flatViolations.push({mesh:o.name||g.type,material:m.type});for(const slot of['map','normalMap','roughnessMap','alphaMap']){const texture=m[slot];if(!texture?.image)continue;const value={slot,width:texture.image.width,height:texture.image.height,url:texture.image.currentSrc||'generated canvas'};textures.set(texture.uuid,value);if(value.width<1024||value.height<1024)smallTextures.push(value);}}
 });
 const list=[...entities.values()],houses=list.filter(x=>x.type==='house'),species=[...new Set(list.filter(x=>x.type==='vegetation').map(x=>x.variant.replace(/\d+$/,'')))],bins=Array(Math.ceil(r.track.length/100)).fill(0);for(const e of list)bins[Math.min(bins.length-1,Math.floor(e.s/100))]++;
 return{source:'Live Three.js graph; geometries, materials, instanced transforms and connected AudioBuffer sources',cars,meshCount:meshes,totalTriangles,materials:[...materials.values()],textures:[...textures.values()],houseCount:houses.length,houseVariants:new Set(houses.map(x=>x.variant)).size,vegetationSpecies:species,propsPer100m:bins,boxViolations,flatViolations,smallTextures,world:r.world.validate(),audio:r.audio.stats(),activeAI:r.race.vehicles.length-1};
}
export function skyFraction(r){const target=new THREE.WebGLRenderTarget(480,270),oldFog=r.scene.fog,oldBackground=r.scene.background,oldOverride=r.scene.overrideMaterial,oldSky=r.lighting.sky.visible,oldTone=r.renderer.toneMapping;
 r.lighting.sky.visible=false;r.scene.fog=null;r.scene.background=new THREE.Color('white');r.renderer.toneMapping=THREE.NoToneMapping;const black=new THREE.MeshBasicMaterial({color:0});r.scene.overrideMaterial=black;r.renderer.setRenderTarget(target);r.renderer.render(r.scene,r.camera);const pixels=new Uint8Array(480*270*4);r.renderer.readRenderTargetPixels(target,0,0,480,270,pixels);let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>250&&pixels[i+1]>250&&pixels[i+2]>250)count++;r.renderer.setRenderTarget(null);r.scene.fog=oldFog;r.scene.background=oldBackground;r.scene.overrideMaterial=oldOverride;r.lighting.sky.visible=oldSky;r.renderer.toneMapping=oldTone;black.dispose();target.dispose();r.draw();return count/(480*270);}
export function pose(r,preset){r.state.mode=preset.mode;r.rig.snap=true;r.rig.mode='chase';r.actions.quality(preset.quality||'high');r.state.testFreeze=true;document.querySelector('#ui').style.visibility=preset.noHUD?'hidden':'visible';r.draw();if(preset.mode==='top'){for(const m of r.world.batch.meshes)m.visible=true;const fog=r.scene.fog;r.scene.fog=null;r.renderer.render(r.scene,r.topCamera);r.scene.fog=fog;}}

