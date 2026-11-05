import * as THREE from 'three';
export async function loadMaterials(progress=()=>{}){
 const loader=new THREE.TextureLoader(),names=['asphalt','earth','stone','plaster','rubber','metal','paint','bark','leaf','tile','sand'],textures={};let done=0;
 await Promise.all(names.map(async name=>{const [map,normalMap,roughnessMap]=await Promise.all(['color.jpg','normal.png','rough.png'].map(s=>loader.loadAsync(`assets/textures/${name}-${s}`)));map.colorSpace=THREE.SRGBColorSpace;for(const t of [map,normalMap,roughnessMap]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;}textures[name]={map,normalMap,roughnessMap};progress(++done/names.length);}));
 const mat=(name,color='#ffffff',extra={})=>new THREE.MeshStandardMaterial({...textures[name],color,roughness:.9,normalScale:new THREE.Vector2(.4,.4),...extra});
 return{textures,mat,
  asphalt:mat('asphalt','#ffffff',{roughness:.92,normalScale:new THREE.Vector2(.45,.45)}),
  earth:mat('earth','#ffffff',{vertexColors:true,roughness:1}),
  line:mat('paint','#eee9d3',{roughness:.7}),
  metal:mat('metal','#6a747a',{metalness:.8,roughness:.38}),
  chrome:mat('metal','#c8cace',{metalness:1,roughness:.19}),
  rubber:mat('rubber','#83868b',{roughness:.93}),
  dark:mat('rubber','#353d43',{roughness:.65}),
  glass:new THREE.MeshPhysicalMaterial({color:'#54707c',metalness:.4,roughness:.09,transparent:true,opacity:.92,envMapIntensity:1.1,clearcoat:1,side:THREE.DoubleSide}),
  paint(color){return new THREE.MeshPhysicalMaterial({...textures.paint,color,metalness:.36,roughness:.85,clearcoat:1,clearcoatRoughness:.16,envMapIntensity:.85,normalScale:new THREE.Vector2(.04,.04)});}
 };
}
