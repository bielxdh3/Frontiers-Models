import * as THREE from 'three';
import { CARS } from './catalog.js';
import { clamp, lerp, rng, TAU } from './math.js';

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const standard = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .82, ...extra });
function mesh(geometry, material, parent, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, material); m.position.set(...position); m.scale.set(...scale); m.rotation.set(...rotation);
  m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
function canvasTexture(width, height, draw) {
  const c = document.createElement('canvas'); c.width = width; c.height = height; draw(c.getContext('2d'), width, height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function bodyGeometry(sections) {
  const positions = [], indices = [];
  for (const [z, width, low, high] of sections) {
    for (const [x, y] of [[-width, low], [width, low], [width, high - .12], [width * .8, high], [-width * .8, high], [-width, high - .12]]) positions.push(x, y, z);
  }
  for (let s = 0; s < sections.length - 1; s++) for (let p = 0; p < 6; p++) { const a = s * 6 + p, b = s * 6 + (p + 1) % 6, c = a + 6, d = b + 6; indices.push(a, b, c, b, d, c); }
  for (const s of [0, sections.length - 1]) for (let j = 1; j < 5; j++) { const a = s * 6; if (s === 0) indices.push(a, a + j + 1, a + j); else indices.push(a, a + j, a + j + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
export function makeCar(model, color) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const box = new THREE.BoxGeometry(1, 1, 1), cylinder = new THREE.CylinderGeometry(1, 1, 1, 18), paint = new THREE.MeshPhysicalMaterial({ color: color || model.color, metalness: .42, roughness: .26, clearcoat: 1, clearcoatRoughness: .2 });
  const black = standard('#172b33', { roughness: .42 }), glass = new THREE.MeshPhysicalMaterial({ color: '#164b5e', metalness: .6, roughness: .12, clearcoat: 1 }), rim = standard('#d9ddd4', { metalness: .85, roughness: .24 }), accent = standard(model.accent, { metalness: .38, roughness: .3 });
  const w = model.width / 2, l = model.length;
  const profile = model.design === 'wedge' ? [[-.5, .82, .37, .82], [-.38, 1, .34, .97], [.15, .97, .33, .82], [.5, .78, .40, .57]] : [[-.5, .82, .37, .9], [-.37, .98, .32, 1.03], [.10, 1, .32, .98], [.39, .92, .36, .85], [.5, .78, .46, .70]];
  const hull = mesh(bodyGeometry(profile.map(([z, a, b, c]) => [z * l, a * w, b, c])), paint, body);
  const cabin = model.design === 'compact' ? [[-.31 * l, .78 * w, 1.0, 1.21], [-.20 * l, .72 * w, 1.02, 1.72], [.10 * l, .66 * w, .99, 1.70], [.25 * l, .78 * w, .94, 1.03]] : model.design === 'coupe' ? [[-.36 * l, .78 * w, 1.0, 1.05], [-.16 * l, .69 * w, 1.01, 1.60], [.07 * l, .65 * w, .99, 1.58], [.27 * l, .78 * w, .96, 1.00]] : [[-.32 * l, .72 * w, .95, 1.04], [-.15 * l, .64 * w, .95, 1.39], [.05 * l, .61 * w, .87, 1.40], [.24 * l, .73 * w, .84, .89]];
  mesh(bodyGeometry(cabin), glass, body);
  mesh(box, paint, body, [-.001, cabin[1][3] + .005, (cabin[1][0] + cabin[2][0]) / 2], [w * 1.36, .055, cabin[2][0] - cabin[1][0] + .05]);
  for (const side of [-1, 1]) {
    const pillarHeight = cabin[1][3] - 1.01;
    mesh(box, paint, body, [side * .7 * w, 1.01 + pillarHeight / 2, -.13 * l], [.06, pillarHeight, .08], [0, 0, side * .10]);
    mesh(box, black, body, [side * .99 * w, .67, -.1], [.032, .034, l * .50]);
    mesh(box, accent, body, [side * w, .46, .0], [.06, .08, l * .58]);
    mesh(box, black, body, [side * w * 1.08, 1.02, l * .12], [.25, .14, .29]);
    mesh(box, paint, body, [side * w * 1.08, 1.08, l * .12], [.25, .06, .29]);
    mesh(box, rim, body, [side * w * .99, .87, -.11 * l], [.035, .045, .24]);
  }
  const lampMat = new THREE.MeshStandardMaterial({ color: '#fff5c9', emissive: '#fff1ba', emissiveIntensity: 1.6, roughness: .2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: '#f3654e', emissive: '#ed342a', emissiveIntensity: 1.2 });
  const lamps = [];
  for (const side of [-1, 1]) {
    lamps.push(mesh(box, lampMat.clone(), body, [side * w * .57, model.design === 'wedge' ? .64 : .77, l * .484], [model.design === 'wedge' ? .58 : .45, .12, .09]));
    mesh(box, tailMat, body, [side * w * .58, .77, -l * .497], [.58, .12, .045]);
    mesh(cylinder, black, body, [side * .55, .36, -l * .51], [.10, .13, .10], [Math.PI / 2, 0, 0]);
  }
  mesh(box, black, body, [0, .51, l * .486], [w * 1.12, .14, .1]);
  mesh(box, rim, body, [0, .64, -l * .506], [.36, .12, .03]);
  const hood = mesh(box, accent, body, [0, model.design === 'wedge' ? .83 : .98, l * .29], [.16, .012, l * .24], [-.06, 0, 0]);
  if (model.design !== 'compact') {
    for (const side of [-1, 1]) mesh(box, black, body, [side * w * .65, 1.04, -l * .40], [.07, .25, .10]);
    mesh(box, paint, body, [0, 1.17, -l * .40], [w * 2.02, .09, .34]);
  }
  const wheels = [];
  for (const side of [-1, 1]) for (const axle of [-1, 1]) {
    const steer = new THREE.Group(), spin = new THREE.Group(); root.add(steer); steer.add(spin);
    steer.position.set(side * w * .94, .40, axle * l * .29);
    const tire = mesh(cylinder, black, spin, [0, 0, 0], [.38, .31, .38], [0, 0, Math.PI / 2]);
    tire.material = standard('#14262b', { roughness: .95 });
    mesh(cylinder, rim, spin, [side * .01, 0, 0], [.255, .325, .255], [0, 0, Math.PI / 2]);
    mesh(cylinder, black, spin, [side * .17, 0, 0], [.18, .02, .18], [0, 0, Math.PI / 2]);
    for (let k = 0; k < 5; k++) mesh(box, rim, spin, [side * .19, 0, 0], [.025, .41, .043], [k * TAU / 5, 0, 0]);
    mesh(cylinder, accent, spin, [side * .22, 0, 0], [.065, .03, .065], [0, 0, Math.PI / 2]);
    wheels.push({ steer, spin, front: axle > 0 });
  }
  const scratches = [];
  for (let side = 0; side < 3; side++) {
    const g = new THREE.Group(); body.add(g); g.visible = false;
    for (let k = 0; k < 7; k++) {
      const position = side === 0 ? [-.7 + k * .21, .69 + k % 2 * .1, l * .50] : [(side === 1 ? -1 : 1) * w, .57 + k * .05, -.9 + k * .26];
      mesh(box, standard(k % 2 ? '#ede2ca' : '#283d43'), g, position, side === 0 ? [.09, .024, .025] : [.025, .02, .6], [0, 0, side === 0 ? .7 : 0]);
    }
    scratches.push(g);
  }
  const flames = new THREE.Group(); root.add(flames);
  for (const side of [-1, 1]) mesh(new THREE.ConeGeometry(.16, .9, 8), new THREE.MeshBasicMaterial({ color: '#9bedff', transparent: true, opacity: .85 }), flames, [side * .55, .36, -l * .58], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  const shadow = mesh(new THREE.PlaneGeometry(model.width * 1.8, l * 1.5), new THREE.MeshBasicMaterial({ map: canvasTexture(64, 64, ctx => { const grad = ctx.createRadialGradient(32, 32, 3, 32, 32, 32); grad.addColorStop(0, 'rgba(6,28,34,.5)'); grad.addColorStop(1, 'rgba(6,28,34,0)'); ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64); }), transparent: true, depthWrite: false }), root, [0, .035, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  shadow.castShadow = false;
  return { root, body, hull, paint, hood, lamps, wheels, scratches, flames, model };
}

class Batches {
  constructor(parent) { this.parent = parent; this.groups = new Map(); this.dummy = new THREE.Object3D(); this.meshes = []; }
  put(key, geometry, material, position, scale, rotation = [0, 0, 0], detail = false) {
    if (!this.groups.has(key)) this.groups.set(key, { geometry, material, items: [], detail });
    this.groups.get(key).items.push({ position, scale, rotation });
  }
  flush() {
    for (const { geometry, material, items, detail } of this.groups.values()) {
      const m = new THREE.InstancedMesh(geometry, material, items.length); m.castShadow = m.receiveShadow = true;
      items.forEach((item, i) => { this.dummy.position.set(...item.position); this.dummy.scale.set(...item.scale); this.dummy.rotation.set(...item.rotation); this.dummy.updateMatrix(); m.setMatrixAt(i, this.dummy.matrix); });
      m.userData.fullCount = items.length; m.userData.detail = detail; m.computeBoundingSphere(); this.parent.add(m); this.meshes.push(m);
    }
  }
}
function ribbon(track, offsets, material, heightFn = () => -.06, skipBridge = false, colors) {
  const positions = [], indices = [], vertexColors = [], uvs = [], n = track.samples.length;
  for (let i = 0; i <= n; i++) {
    const q = track.samples[i % n];
    for (let j = 0; j < offsets.length; j++) { const off = offsets[j]; positions.push(q.x + q.nx * off, q.y + heightFn(off, q, i), q.z + q.nz * off); uvs.push(off * .25, (i === n ? track.length : q.s) * .25); if (colors) { const c = new THREE.Color(colors(off, i)); vertexColors.push(c.r, c.g, c.b); } }
    if (i === n || (skipBridge && i / n >= track.bridge[0] && i / n <= track.bridge[1])) continue;
    for (let j = 0; j < offsets.length - 1; j++) { const a = i * offsets.length + j, b = a + offsets.length; indices.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(indices); if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, material); m.receiveShadow = true; return m;
}
const distanceToCourse = (track, x, z) => { const q = track.nearest(x, z); return Math.hypot(x - q.x, z - q.z); };

export class GameRenderer {
  constructor(canvas, prefs) {
    this.canvas = canvas; this.prefs = prefs; this.fleet = []; this.courseId = ''; this.cameraMode = 0; this.snap = true; this.lost = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene(); this.scene.fog = new THREE.FogExp2('#b1d8d0', .0018);
    this.camera = new THREE.PerspectiveCamera(55, 1, .15, 4800); this.look = v3();
    this.sun = new THREE.DirectionalLight('#ffebc6', 2.5); this.sun.position.set(-80, 150, 60); this.sun.castShadow = true;
    this.sun.shadow.camera.left = this.sun.shadow.camera.bottom = -52; this.sun.shadow.camera.right = this.sun.shadow.camera.top = 52; this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 320; this.sun.shadow.bias = -.0004; this.sun.shadow.normalBias = .05;
    this.scene.add(this.sun, this.sun.target); this.ambient = new THREE.HemisphereLight('#d3eefd', '#858f67', 2.0); this.scene.add(this.ambient);
    this.headlight = new THREE.SpotLight('#fff1cf', 0, 85, .6, .6, 1); this.scene.add(this.headlight, this.headlight.target);
    const envTex = canvasTexture(256, 128, (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5b98ad'); g.addColorStop(.38, '#cfeaf2'); g.addColorStop(.50, '#fff9db'); g.addColorStop(.53, '#526a59'); g.addColorStop(1, '#8a9279'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#ffffff'; ctx.fillRect(w * .7, h * .12, 35, 50); });
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(this.renderer); this.environment = pmrem.fromEquirectangular(envTex); this.scene.environment = this.environment.texture; pmrem.dispose(); envTex.dispose();
    this.skyUniforms = { top: { value: new THREE.Color('#60b7d2') }, horizon: { value: new THREE.Color('#e3eedc') }, sun: { value: v3(-.4, .5, -.7).normalize() }, brightness: { value: 1 }, cloud: { value: 0 }, time: { value: 0 } };
    this.sky = mesh(new THREE.SphereGeometry(4000, 24, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, toneMapped: false, uniforms: this.skyUniforms, vertexShader: 'varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: `varying vec3 p;uniform vec3 top;uniform vec3 horizon;uniform vec3 sun;uniform float brightness;uniform float cloud;uniform float time;
      void main(){vec3 d=normalize(p);float h=pow(max(d.y,0.),.6);vec3 c=mix(horizon,top,h);float s=max(dot(d,sun),0.);c+=vec3(1.,.65,.25)*pow(s,500.)*brightness;c+=vec3(.4,.16,.04)*pow(s,12.)*brightness;
      float pattern=.5+sin(d.x*18.+d.z*8.+time*.008)*.22+sin(d.z*29.-d.x*4.)*.19+sin(d.x*43.+d.z*36.)*.08;
      float mask=smoothstep(.66-cloud*.2,.88-cloud*.18,pattern)*smoothstep(.02,.16,d.y)*(1.-smoothstep(.48,.8,d.y));
      c=mix(c,mix(horizon,vec3(.92),brightness*.7),mask*(.20+cloud*.65));gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
      }` }), this.scene);
    this.sky.castShadow = this.sky.receiveShadow = false;
    this.oceanUniforms = { time: { value: 0 }, dark: { value: 0 }, cloud: { value: 0 } };
    this.ocean = mesh(new THREE.PlaneGeometry(10000, 10000), new THREE.ShaderMaterial({ uniforms: this.oceanUniforms, toneMapped: false, vertexShader: 'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: `varying vec3 p;uniform float time;uniform float dark;uniform float cloud;void main(){float a=sin(p.x*.085+time*.6+sin(p.y*.04))*sin(p.y*.17+time*.4);float b=pow(max(0.,sin(p.x*.18+p.y*.3+time*.5)),22.);vec3 c=mix(vec3(.025,.40,.47),vec3(.11,.68,.66),.5+a*.15);c+=b*.12*(1.-cloud*.7);c=mix(c,vec3(.018,.09,.16),dark*.72);gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
      }` }), this.scene, [0, -5.5, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
    this.ocean.castShadow = this.ocean.receiveShadow = false;
    const rainPositions = new Float32Array(1600 * 6), random = rng(211);
    this.rainSeeds = Array.from({ length: 1600 }, () => [random() * 70 - 35, random() * 35, random() * 70 - 35]);
    this.rainGeo = new THREE.BufferGeometry(); this.rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    this.rain = new THREE.LineSegments(this.rainGeo, new THREE.LineBasicMaterial({ color: '#d8eff1', transparent: true, opacity: .45, depthWrite: false })); this.rain.frustumCulled = false; this.scene.add(this.rain);
    const pointPositions = new Float32Array(180 * 3);
    this.effectsGeo = new THREE.BufferGeometry(); this.effectsGeo.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
    this.effects = new THREE.Points(this.effectsGeo, new THREE.PointsMaterial({ color: '#e7ddc5', size: .50, transparent: true, opacity: .30, depthWrite: false, sizeAttenuation: true })); this.effects.frustumCulled = false; this.scene.add(this.effects);
    this.resize(); this.setQuality(prefs);
  }
  resize() {
    const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.snap = true;
  }
  setQuality(prefs) {
    this.prefs = prefs; const quality = ['Low', 'Medium', 'High'].indexOf(prefs.quality);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, [1, 1.35, 1.8][quality]) * prefs.scale);
    this.renderer.shadowMap.enabled = quality > 0; this.sun.castShadow = quality > 0;
    const size = quality === 2 ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) { this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; this.sun.shadow.mapSize.set(size, size); }
    for (const m of this.batches?.meshes || []) if (m.userData.detail) m.count = Math.ceil(m.userData.fullCount * [.42, .72, 1][quality]);
    this.rainCount = [350, 850, 1600][quality]; this.rainGeo.setDrawRange(0, this.rainCount * 2); this.resize();
  }
  disposeGroup(group) {
    if (!group) return;
    const geometries = new Set(), materials = new Set(), textures = new Set();
    group.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of (Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])) { materials.add(m); for (const value of Object.values(m)) if (value?.isTexture) textures.add(value); } });
    group.removeFromParent(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
  }
  buildWorld(track) {
    if (this.courseId === track.id) return;
    this.disposeGroup(this.world); this.world = new THREE.Group(); this.scene.add(this.world); this.courseId = track.id; this.track = track;
    const world = this.world, random = rng(track.id === 'coastal' ? 73 : track.id === 'riviera' ? 121 : 351), batches = this.batches = new Batches(world);
    const box = new THREE.BoxGeometry(1, 1, 1), cylinder = new THREE.CylinderGeometry(1, 1, 1, 8), cone = new THREE.ConeGeometry(1, 1, 7), sphere = new THREE.IcosahedronGeometry(1, 1);
    const rock = standard('#d5bd8c', { flatShading: true }), cream = standard('#f2dfb3'), white = standard('#f2efdc'), teal = standard('#316e6a'), dark = standard('#23484c'), terracotta = standard('#c87650'), rail = standard('#b3c2b3', { metalness: .45, roughness: .48 });
    this.road = standard('#465b59', { roughness: .94, metalness: .05 });
    const asphalt = canvasTexture(256, 256, (ctx, w, h) => { ctx.fillStyle = '#d3dad4'; ctx.fillRect(0, 0, w, h); const r = rng(33); for (let i = 0; i < 13000; i++) { ctx.fillStyle = `rgba(22,35,35,${r() * .14})`; ctx.fillRect(r() * w, r() * h, 1, 1); } });
    // Road grain is procedural; world-space geometry supplies every painted marking.
    asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping; this.road.map = asphalt;
    const terrainMat = standard('#d7c28e', { vertexColors: true, flatShading: true });
    const land = ribbon(track, [-100, -62, -35, -14, 0, 14, 35, 62, 100], terrainMat, (off, q, i) => Math.abs(off) < 35 ? -.42 - Math.abs(off) * .015 : lerp(-1, -q.y - 6, clamp((Math.abs(off) - 35) / 65, 0, 1)) + Math.sin(i * .35) * Math.abs(off) / 100, true, (off, i) => Math.abs(off) < 18 ? '#d8c899' : Math.abs(off) < 40 ? (i % 7 > 3 ? '#a1b58a' : '#aab991') : (i % 3 ? '#c7b18a' : '#d5bd96'));
    world.add(land); world.add(ribbon(track, [-track.width / 2, track.width / 2], this.road, () => .015));
    for (const side of [-1, 1]) {
      const o = side * (track.width / 2 - .25);
      world.add(ribbon(track, [o - .10, o + .10], white, () => .035));
      const curb = standard('#ffffff', { vertexColors: true });
      world.add(ribbon(track, [side * (track.width / 2 + .1), side * (track.width / 2 + .8)].sort((a, b) => a - b), curb, () => .06, false, (_off, i) => Math.floor(i / 3) % 2 ? '#f2e5bd' : '#d77e5c'));
    }
    for (let s = 0; s < track.length; s += 9) {
      const q = track.at(s), heading = Math.atan2(q.tx, q.tz);
      batches.put('dashes', box, cream, [q.x, q.y + .04, q.z], [.14, .025, 3.2], [0, heading, 0]);
      for (const side of [-1, 1]) {
        const off = side * (track.width / 2 + 5.4), x = q.x + q.nx * off, z = q.z + q.nz * off;
        batches.put('rail-posts', box, rail, [x, q.y + .6, z], [.18, 1.2, .18]);
        batches.put('rail', box, rail, [x, q.y + 1.04, z], [.16, .24, 9.05], [0, heading, 0]);
        batches.put('reflectors', box, standard('#f9d396', { emissive: '#efaa46', emissiveIntensity: .7 }), [x, q.y + 1.2, z], [.19, .12, .24], [0, heading, 0]);
      }
    }
    const loc = (q, side, off, along = 0, y = 0) => [q.x + q.nx * side * off + q.tx * along, q.y + y, q.z + q.nz * side * off + q.tz * along];
    // The viaduct exposes a real open-water gap and a continuous raised road deck.
    for (let i = Math.floor(track.bridge[0] * 900); i < track.bridge[1] * 900; i += 7) {
      const q = track.samples[i], heading = Math.atan2(q.tx, q.tz);
      batches.put('viaduct-deck', box, cream, [q.x, q.y - .9, q.z], [track.width + 7, 1.7, 23], [0, heading, 0]);
      for (const side of [-1, 1]) batches.put('viaduct-piers', cylinder, rock, loc(q, side, track.width * .35, 0, -(q.y + 5) / 2), [1.6, q.y + 5, 1.6]);
    }
    // Continuous curved tunnel shell, open at both ends; its edges agree with the corridor barriers.
    const tunnelPositions = [], tunnelIndices = [], arc = 18, start = Math.floor(track.tunnel[0] * 900), end = Math.floor(track.tunnel[1] * 900);
    for (let i = start; i <= end; i++) {
      const q = track.samples[i];
      for (let a = 0; a <= arc; a++) { const theta = a / arc * Math.PI, off = Math.cos(theta) * (track.width / 2 + 5.7); tunnelPositions.push(q.x + q.nx * off, q.y + 1.1 + Math.sin(theta) * 10, q.z + q.nz * off); }
      if (i < end) for (let a = 0; a < arc; a++) { const k = (i - start) * (arc + 1) + a; tunnelIndices.push(k, k + arc + 1, k + 1, k + 1, k + arc + 1, k + arc + 2); }
      if (i % 6 === 0) for (const side of [-1, 1]) batches.put('tunnel-lights', box, new THREE.MeshStandardMaterial({ color: '#ffdc96', emissive: '#ffb85d', emissiveIntensity: 1.4 }), loc(q, side, track.width / 2 + 4, 0, 3), [.2, .23, 1.8], [0, Math.atan2(q.tx, q.tz), 0]);
    }
    const tunnelGeo = new THREE.BufferGeometry(); tunnelGeo.setAttribute('position', new THREE.Float32BufferAttribute(tunnelPositions, 3)); tunnelGeo.setIndex(tunnelIndices); tunnelGeo.computeVertexNormals(); mesh(tunnelGeo, standard('#aa9671', { side: THREE.DoubleSide, roughness: .92 }), world);
    // Houses are modular original architecture, in batches rather than a downloaded village pack.
    const facadeColors = ['#f4e4bb', '#e6ad8f', '#e8c87b', '#c6d8c1', '#f0cfb5', '#eee9d3'], facades = facadeColors.map(c => standard(c));
    const villageStart = track.length * track.village[0], villageEnd = track.length * track.village[1];
    for (let s = villageStart; s < villageEnd; s += 18) {
      const q = track.at(s), heading = Math.atan2(q.tx, q.tz);
      for (const side of [-1, 1]) {
        const width = 7 + random() * 4, depth = 7 + random() * 3, floors = 2 + Math.floor(random() * 2), h = floors * 3.2, off = track.width / 2 + 13 + depth / 2;
        const center = loc(q, side, off, 0, h / 2 - .2), idx = Math.floor(random() * facades.length);
        batches.put(`house-${idx}`, box, facades[idx], center, [depth, h, width], [0, heading, 0]);
        batches.put('house-plinth', box, cream, loc(q, side, off, 0, -.4), [depth + 1, .8, width + 1], [0, heading, 0]);
        const roofPosition = loc(q, side, off, 0, h + .9);
        batches.put('tiled-roof', new THREE.ConeGeometry(1, 1, 4), terracotta, roofPosition, [depth * .79, 2.6, width * .79], [0, heading + Math.PI / 4, 0]);
        for (let floor = 0; floor < floors; floor++) for (const along of [-width * .29, width * .29]) {
          batches.put('window-glass', box, dark, loc(q, side, off - depth / 2 - .025, along, floor * 3.2 + 1.9), [.07, 1.4, 1.1], [0, heading, 0]);
          batches.put('window-sill', box, white, loc(q, side, off - depth / 2 - .12, along, floor * 3.2 + 1.12), [.35, .14, 1.4], [0, heading, 0]);
          for (const shutter of [-1, 1]) batches.put('shutters', box, teal, loc(q, side, off - depth / 2 - .07, along + shutter * .85, floor * 3.2 + 1.9), [.12, 1.6, .48], [0, heading, 0]);
          if (floor > 0) { batches.put('balcony', box, white, loc(q, side, off - depth / 2 - .75, along, floor * 3.2 + 1), [1.7, .18, 2]); batches.put('balcony-front', box, teal, loc(q, side, off - depth / 2 - 1.5, along, floor * 3.2 + 1.55), [.09, .7, 2]); }
        }
        for (let k = 0; k < 8; k++) batches.put(`awning-${k % 2}`, box, k % 2 ? white : standard('#d69261'), loc(q, side, off - depth / 2 - 1.2, (k - 3.5) * width / 8, 3.4), [2.8, .12, width / 8], [0, heading, side * -.16]);
        batches.put('village-flower', sphere, standard('#d76583'), loc(q, side, off - depth / 2 - 1.2, width * .44, 1), [1, 1.4, 1.4], [0, heading, 0], true);
      }
    }
    const leafGeo = new THREE.BufferGeometry(), leafVertices = [];
    for (let k = 0; k < 5; k++) {
      const a = k / 5, b = (k + 1) / 5, wa = Math.sin(a * Math.PI) * .65 + .04, wb = Math.sin(b * Math.PI) * .65;
      const ya = Math.sin(a * Math.PI) * .9 - a * a * 1.4, yb = Math.sin(b * Math.PI) * .9 - b * b * 1.4;
      leafVertices.push(-wa, ya, a * 5, wa, ya, a * 5, -wb, yb, b * 5, wa, ya, a * 5, wb, yb, b * 5, -wb, yb, b * 5);
    }
    leafGeo.setAttribute('position', new THREE.Float32BufferAttribute(leafVertices, 3)); leafGeo.computeVertexNormals();
    const leafMat = standard('#417c61', { side: THREE.DoubleSide }), bark = standard('#9d8461'), cypress = standard('#396950'), foliage = standard('#718d61');
    for (let s = 8; s < track.length; s += 13) {
      const q = track.at(s), u = q.i / 900;
      if ((u > track.bridge[0] && u < track.bridge[1]) || (u > track.tunnel[0] && u < track.tunnel[1])) continue;
      const side = random() > .5 ? 1 : -1, off = track.width / 2 + 13 + random() * 18;
      if (u > track.village[0] && u < track.village[1] && off > 22) continue;
      const p = loc(q, side, off), h = 6 + random() * 4;
      if (random() > .35) {
        batches.put('palm-trunks', cylinder, bark, [p[0], p[1] + h / 2, p[2]], [.23, h, .23], [0, 0, .07], true);
        for (let k = 0; k < 7; k++) batches.put('palm-fronds', leafGeo, leafMat, [p[0] + h * .03, p[1] + h, p[2]], [.7 + random() * .3, 1, .65 + random() * .3], [0, k * TAU / 7 + random() * .25, 0], true);
      } else {
        batches.put('tree-trunks', cylinder, bark, [p[0], p[1] + 1.5, p[2]], [.25, 3, .25], [0, 0, 0], true);
        if (random() > .4) batches.put('cypress', cone, cypress, [p[0], p[1] + 4.6, p[2]], [1.6, 7, 1.6], [0, random() * 6, 0], true);
        else batches.put('olive', sphere, foliage, [p[0], p[1] + 4.5, p[2]], [3.2, 2.8, 3], [0, random() * 6, 0], true);
      }
      if (random() > .5) batches.put('boulders', sphere, rock, loc(q, side, off + 15, 0, -1), [2 + random() * 5, 2 + random() * 7, 3 + random() * 5], [0, random() * 6, .3], true);
    }
    for (let k = 0; k < 18; k++) {
      const x = 80 + random() * 580, z = -160 + random() * 600;
      const distance = distanceToCourse(track, x, z);
      if (distance < 115) continue;
      const radius = Math.min(distance - 55, 55 + random() * 65);
      mesh(new THREE.IcosahedronGeometry(1, 1), standard(k % 2 ? '#91a17a' : '#a5ac83', { flatShading: true }), world, [x, -10, z], [radius, 40 + random() * 65, radius], [0, random() * 6, 0]);
    }
    // Distinctive lighthouse and boats create scale and recognizable distant composition.
    const lighthouseQ = track.at(track.length * .87), lp = loc(lighthouseQ, -1, 52);
    mesh(cylinder, cream, world, [lp[0], lp[1] + 9, lp[2]], [3.2, 19, 3.2]);
    mesh(cylinder, terracotta, world, [lp[0], lp[1] + 16, lp[2]], [3.3, 2, 3.3]);
    mesh(cylinder, dark, world, [lp[0], lp[1] + 20.5, lp[2]], [2.4, 3, 2.4]);
    mesh(cone, terracotta, world, [lp[0], lp[1] + 23, lp[2]], [3.7, 2.5, 3.7]);
    mesh(cylinder, white, world, [lp[0], lp[1] + 18.8, lp[2]], [4.1, .4, 4.1]);
    this.boats = [];
    for (let k = 0; k < 7; k++) {
      const q = track.at(track.length * (k + .35) / 7), p = loc(q, -1, 170 + random() * 80); if (distanceToCourse(track, p[0], p[2]) < 110) continue;
      const boat = new THREE.Group(); world.add(boat); boat.position.set(p[0], -4.9, p[2]); boat.rotation.y = random() * 6;
      mesh(bodyGeometry([[-4, .1, 0, .9], [-2.6, 1.4, -.6, 1], [2.6, 1.2, -.4, 1], [4, 0, .1, .7]]), white, boat);
      mesh(cylinder, dark, boat, [0, 4.5, 0], [.07, 9, .07]);
      const sailGeo = new THREE.BufferGeometry(); sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 8.6, 0, 0, 1.2, 0, 0, 1.2, 3.4], 3)); sailGeo.computeVertexNormals(); mesh(sailGeo, standard('#f1d5a3', { side: THREE.DoubleSide }), boat);
      this.boats.push(boat);
    }
    // Ordered gates are actual geometric arches. Only the next rush gate is emphasized.
    this.gates = [];
    const gateMat = standard('#f3cf8e', { emissive: '#d5a85b', emissiveIntensity: .12 });
    for (let k = 0; k < (track.mode === 'rush' ? track.gates : 1); k++) {
      const s = track.mode === 'rush' ? (k + 1) * track.length / track.gates : 0, q = track.at(s), gate = new THREE.Group(); gate.position.set(q.x, q.y, q.z); gate.rotation.y = Math.atan2(q.tx, q.tz); world.add(gate);
      const material = gateMat.clone();
      for (const side of [-1, 1]) { mesh(box, material, gate, [side * (track.width / 2 + 1.5), 4, 0], [.42, 8, .6]); mesh(box, dark, gate, [side * (track.width / 2 + 1.5), 1, 0], [.8, 2, .9]); }
      mesh(box, material, gate, [0, 7.7, 0], [track.width + 3.5, .6, .6]);
      const label = track.mode === 'rush' ? `GATE ${String(k + 1).padStart(2, '0')}   /   ${track.gates}` : 'S O L S T I C E   /   C O A S T   C L U B';
      const signTex = canvasTexture(1024, 96, (ctx, w, h) => { ctx.fillStyle = '#164a4e'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#f8e9ca'; ctx.font = 'bold 35px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, w / 2, 63); });
      const signMaterial = new THREE.MeshBasicMaterial({ map: signTex });
      mesh(new THREE.PlaneGeometry(track.width + 2, 1.7), signMaterial, gate, [0, 7.35, -.36], [1, 1, 1], [0, Math.PI, 0]);
      mesh(new THREE.PlaneGeometry(track.width + 2, 1.7), signMaterial, gate, [0, 7.35, .36]);
      this.gates.push({ root: gate, material });
    }
    const startLine = track.at(0);
    for (let k = 0; k < 16; k++) batches.put(`start-${k % 2}`, box, k % 2 ? dark : white, [startLine.x + startLine.nx * ((k - 7.5) * track.width / 16), startLine.y + .05, startLine.z + startLine.nz * ((k - 7.5) * track.width / 16)], [track.width / 16, .03, 1.2], [0, Math.atan2(startLine.tx, startLine.tz), 0]);
    batches.flush(); this.setQuality(this.prefs); this.snap = true;
  }
  setCars(cars) {
    const signature = cars.map(c => `${c.model}:${c.color}`).join('|');
    if (signature === this.fleetSignature) return;
    for (const c of this.fleet) this.disposeGroup(c.root);
    this.fleet = cars.map(c => { const car = makeCar(CARS.find(m => m.id === c.model) || CARS[0], c.color); this.scene.add(car.root); return car; });
    this.fleetSignature = signature; this.snap = true;
  }
  updateEnvironment(env, time, player) {
    const sunHeight = Math.sin(env.day * TAU), light = clamp((sunHeight + .15) / 1.15, 0, 1), dark = 1 - light;
    const sunset = Math.max(0, 1 - Math.abs(sunHeight) * 2) * (env.day < .6 ? 1 : .3);
    this.sun.intensity = (light * 2.6 + .22) * (1 - env.cloud * .54); this.ambient.intensity = 1.0 + light * 1.15 - env.cloud * .25;
    this.sun.color.set('#ffedcf').lerp(new THREE.Color('#f8a567'), sunset * .75);
    this.ambient.color.set('#c0e2ed').lerp(new THREE.Color('#6e91b5'), dark * .8);
    this.skyUniforms.top.value.set('#57b6d3').lerp(new THREE.Color('#172a53'), dark).lerp(new THREE.Color('#8ca6ae'), env.cloud * .70);
    this.skyUniforms.horizon.value.set('#e4eed5').lerp(new THREE.Color('#edb6a0'), sunset * .65).lerp(new THREE.Color('#435b7a'), dark * .8).lerp(new THREE.Color('#a4b7ba'), env.cloud * .55);
    this.skyUniforms.brightness.value = light; this.skyUniforms.cloud.value = env.cloud; this.skyUniforms.time.value = time; this.scene.fog.color.copy(this.skyUniforms.horizon.value); this.scene.fog.density = .0014 + env.cloud * .00085;
    this.oceanUniforms.time.value = time; this.oceanUniforms.dark.value = dark; this.oceanUniforms.cloud.value = env.cloud;
    if (this.road) { this.road.roughness = lerp(.94, .25, env.wet); this.road.metalness = lerp(.02, .30, env.wet); this.road.color.set('#465b59').lerp(new THREE.Color('#2d424b'), env.wet); }
    this.sun.position.set(player.x - 95, player.y + 160, player.z + 70); this.sun.target.position.set(player.x, player.y, player.z); this.sun.target.updateMatrixWorld();
    this.sky.position.copy(this.camera.position);
    this.headlight.intensity = dark * 85; this.headlight.position.set(player.x, player.y + 1.1, player.z); this.headlight.target.position.set(player.x + Math.sin(player.heading) * 35, player.y, player.z + Math.cos(player.heading) * 35); this.headlight.target.updateMatrixWorld();
    this.rain.visible = env.wet > .07;
    if (this.rain.visible) {
      const data = this.rainGeo.attributes.position.array, count = Math.floor(this.rainCount * env.wet);
      for (let i = 0; i < count; i++) { const [x, y, z] = this.rainSeeds[i], height = ((y - time * 23) % 35 + 35) % 35; data.set([player.x + x, player.y + height, player.z + z, player.x + x - .25, player.y + height - 1.3, player.z + z + .08], i * 6); }
      this.rainGeo.setDrawRange(0, count * 2); this.rainGeo.attributes.position.needsUpdate = true;
    }
    this.boats?.forEach((b, i) => { b.position.y = -4.9 + Math.sin(time * .7 + i) * .13; b.rotation.z = Math.sin(time * .45 + i) * .025; });
  }
  updateCars(cars, time) {
    const particles = this.effectsGeo.attributes.position.array; let count = 0;
    cars.forEach((c, i) => {
      const m = this.fleet[i]; if (!m) return;
      m.root.position.set(c.x, c.y + .12, c.z); m.root.rotation.set(0, c.heading, 0);
      m.body.rotation.z = -c.steer * Math.min(.045, Math.abs(c.speed) * .0014); m.body.rotation.x = c.boosting ? -.025 : 0;
      m.hull.scale.x = 1 - Math.max(c.damage[1], c.damage[2]) * .07; m.hull.position.x = (c.damage[1] - c.damage[2]) * .035;
      m.hood.rotation.x = -.06 + c.damage[0] * .13;
      m.lamps.forEach((lamp, side) => { lamp.material.emissiveIntensity = c.damage[0] > .65 && side === 0 ? .03 : 1.6; });
      m.scratches.forEach((g, side) => { g.visible = c.damage[side] > .10; g.scale.y = .7 + c.damage[side] * .5; });
      m.wheels.forEach(wheel => { wheel.steer.rotation.y = wheel.front ? c.steer * .28 : 0; wheel.spin.rotation.x = c.wheelSpin || time * c.speed / .35; });
      m.flames.visible = c.boosting; m.flames.scale.z = 1 + Math.sin(time * 35) * .18;
      // Rejoin is visibly transparent; no hidden teleport/collision immunity.
      m.paint.transparent = c.ghost > 0; m.paint.opacity = c.ghost > 0 ? .45 : 1; m.paint.depthWrite = c.ghost <= 0;
      const smoky = c.drifting || Math.max(...c.damage) > .65;
      if (smoky) for (let k = 0; k < 24 && count < 180; k++, count++) {
        const age = ((k / 24 + time * .8) % 1), forward = -1.5 - age * 6, side = Math.sin(k * 13.1) * (1 + age);
        particles.set([c.x + Math.sin(c.heading) * forward + Math.cos(c.heading) * side, c.y + .4 + age * 1.6, c.z + Math.cos(c.heading) * forward - Math.sin(c.heading) * side], count * 3);
      }
    });
    this.effectsGeo.setDrawRange(0, count); this.effectsGeo.attributes.position.needsUpdate = true; this.effects.visible = count > 0;
  }
  render(state, mode, dt = 1 / 60, options = {}) {
    if (this.lost || !state?.cars?.length) return;
    this.buildWorld(state.track); this.setCars(state.cars); const car = state.cars[0], t = state.time || 0;
    this.updateCars(state.cars, t); this.updateEnvironment(state.env, t, car);
    this.gates?.forEach((g, i) => { const next = state.track.mode !== 'rush' || i === car.p.passed; g.material.color.set(next ? '#ffc272' : '#86a49c'); g.material.emissiveIntensity = next ? .5 : .04; });
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading), rx = fz, rz = -fx;
    let position, target, fov = 57, menu = ['menu', 'garage', 'setup', 'library', 'results', 'settings-menu'].includes(mode);
    if (mode === 'photo') {
      const angle = options.photoAngle || 0, distance = options.photoDistance || 9;
      position = v3(car.x + Math.sin(car.heading + angle) * distance, car.y + (options.photoHeight || 3.5), car.z + Math.cos(car.heading + angle) * distance);
      target = v3(car.x, car.y + .85, car.z); fov = 46;
    } else if (menu) {
      const a = this.prefs.reducedMotion ? .0 : Math.sin(options.menuTime * .12) * .10;
      position = v3(car.x + rx * 7 + fx * (8 + a), car.y + 3.1, car.z + rz * 7 + fz * (8 + a));
      target = v3(car.x, car.y + .8, car.z); fov = 43;
    } else if (mode === 'race' && state.status === 'countdown' && state.track.mode === 'race') {
      position = v3(car.x - fx * 40 + rx * 12, car.y + 17, car.z - fz * 40 + rz * 12);
      target = v3(car.x - fx * 10, car.y + .8, car.z - fz * 10); fov = 54;
    } else if (mode === 'replay' && this.cameraMode === 1) {
      position = v3(car.x + rx * 11 - fx * 2, car.y + 3, car.z + rz * 11 - fz * 2); target = v3(car.x + fx * 2, car.y + .8, car.z + fz * 2); fov = 52;
    } else if (mode === 'replay' && this.cameraMode === 2) {
      position = v3(car.x - fx * 6 + rx * 4, car.y + 38, car.z - fz * 6 + rz * 4); target = v3(car.x + fx * 12, car.y, car.z + fz * 12); fov = 58;
    } else {
      const speed = Math.abs(car.speed), lookAhead = state.track.at(car.p.unwrapped + 24 + speed * .4);
      position = v3(car.x - fx * (9.5 + speed * .025) + rx * car.steer * .55, car.y + 4.7, car.z - fz * (9.5 + speed * .025) + rz * car.steer * .55);
      target = v3(lerp(car.x + fx * 18, lookAhead.x, .30), lerp(car.y + 1, lookAhead.y + 1, .38), lerp(car.z + fz * 18, lookAhead.z, .30)); fov = 56 + speed * .09 + (car.boosting && !this.prefs.reducedMotion ? 5 : 0);
    }
    if (menu && innerWidth > 850) this.camera.setViewOffset(innerWidth, innerHeight, -innerWidth * .17, 0, innerWidth, innerHeight); else this.camera.clearViewOffset();
    const blend = this.snap || menu || mode === 'photo' ? 1 : 1 - Math.exp(-dt * 8);
    this.camera.position.lerp(position, blend); this.look.lerp(target, blend); this.camera.lookAt(this.look); this.camera.fov = lerp(this.camera.fov, fov, this.snap ? 1 : .15); this.camera.updateProjectionMatrix(); this.snap = false;
    this.renderer.render(this.scene, this.camera);
  }
  postcard(state, { caption = 'The long way home.', treatment = 'sand', ...options }) {
    this.snap = true; this.render(state, 'photo', 1 / 60, options);
    const output = document.createElement('canvas'), w = 1600, h = 1120; output.width = w; output.height = h;
    const ctx = output.getContext('2d');
    const bg = { sand: '#f2e8d3', midnight: '#183f48', coral: '#e48469' }[treatment] || '#f2e8d3'; ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    const source = this.canvas, ratio = source.width / source.height, targetRatio = 1504 / 860;
    let sw = source.width, sh = source.height, sx = 0, sy = 0;
    if (ratio > targetRatio) { sw = sh * targetRatio; sx = (source.width - sw) / 2; } else { sh = sw / targetRatio; sy = (source.height - sh) / 2; }
    ctx.drawImage(source, sx, sy, sw, sh, 48, 48, 1504, 860);
    ctx.fillStyle = treatment === 'midnight' ? '#f5dfb9' : '#18474b'; ctx.font = 'italic bold 42px Georgia, serif'; ctx.fillText(String(caption).slice(0, 64), 58, 983, 1260);
    ctx.font = '17px sans-serif'; ctx.fillText(`SOLSTICE  /  ${state.track.name.toUpperCase()}  /  COAST CLUB`, 60, 1044);
    ctx.textAlign = 'right'; ctx.fillText('WISH YOU WERE HERE.', 1540, 1044);
    return output;
  }
}
