import * as THREE from 'three';
import { BODIES, MOON_ORBITS, getBody } from './catalog.js';
import { sampleOrbitAu, systemAt } from './ephemeris.js';
import { accuracyNow, state } from './state.js';
import {
  J2000_JD,
  auPerDayToKmS,
  displayRadius,
  eclipticToScene,
  len,
  mapHeliocentric,
  mapLocal,
  norm,
  scale as scaleVec,
  sub,
  velocityAuPerDay,
} from './science.js';
import { bodyAu } from './ephemeris.js';
import { irregularGeometry, makeTextures } from './textures.js';

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Spherical();

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createWorld(canvas, hooks = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x070b14, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 80000);
  const sunLight = new THREE.PointLight(0xfff5ea, 8, 0, 0);
  const ambient = new THREE.AmbientLight(0x9eb0d0, 0.03);
  scene.add(ambient);

  const system = new THREE.Group();
  scene.add(system);
  system.add(sunLight);

  const textures = makeTextures();
  const sphere = new THREE.SphereGeometry(1, 48, 32);
  const views = new Map();
  const pickables = [];
  const sunUniform = { value: new THREE.Vector3() };

  const coronaTex = radialSprite();
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({
    map: coronaTex,
    color: 0xffcc88,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.55,
  }));
  system.add(corona);

  function makeStandard(map, roughness, extras = {}) {
    return new THREE.MeshStandardMaterial({
      map,
      roughness,
      metalness: 0,
      emissive: extras.emissive || new THREE.Color(0x000000),
      emissiveMap: extras.emissiveMap || null,
      emissiveIntensity: extras.emissiveIntensity ?? 1,
    });
  }

  function attachNight(material) {
    material.customProgramCacheKey = () => 'earth-night';
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uSun = sunUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPosN; varying vec3 vWNorN;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWPosN = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNorN = normalize(mat3(modelMatrix) * objectNormal);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uSun; varying vec3 vWPosN; varying vec3 vWNorN;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          {
            vec3 toSun = normalize(uSun - vWPosN);
            float ndl = dot(normalize(vWNorN), toSun);
            float night = smoothstep(0.15, -0.05, ndl);
            totalEmissiveRadiance *= night;
          }`);
    };
  }

  function attachRingShadow(material, view) {
    material.customProgramCacheKey = () => `ring-shadow-${view.id}`;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uSun = sunUniform;
      shader.uniforms.uCenter = view.centerUniform;
      shader.uniforms.uAxis = view.axisUniform;
      shader.uniforms.uInner = view.innerUniform;
      shader.uniforms.uOuter = view.outerUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPosS;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWPosS = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uSun; uniform vec3 uCenter; uniform vec3 uAxis; uniform float uInner; uniform float uOuter; varying vec3 vWPosS;')
        .replace('#include <opaque_fragment>', `{
            vec3 rel = vWPosS - uCenter;
            vec3 axis = normalize(uAxis);
            float h = dot(rel, axis);
            vec3 planar = rel - axis * h;
            vec3 toSun = normalize(uSun - vWPosS);
            float denom = dot(toSun, axis);
            if (abs(denom) > 0.0001) {
              float t = -h / denom;
              if (t > 0.0) {
                vec3 hit = planar + (toSun - axis * denom) * t;
                float rho = length(hit);
                if (rho > uInner && rho < uOuter) outgoingLight *= 0.42;
              }
            }
          }
          #include <opaque_fragment>`);
    };
  }

  for (const def of BODIES) {
    if (def.type === 'region') continue;
    const pivot = new THREE.Group();
    const axis = new THREE.Group();
    const spin = new THREE.Group();
    const equator = new THREE.Group();
    const moons = new THREE.Group();
    pivot.add(axis);
    axis.add(spin);
    axis.add(equator);
    pivot.add(moons);
    if (def.axialTiltDeg) axis.rotation.z = THREE.MathUtils.degToRad(def.axialTiltDeg);
    system.add(pivot);

    let geometry = sphere;
    if (def.irregular) geometry = irregularGeometry(def.id.length * 17, 1, 2);
    const map = def.id === 'venus' && state.venusRadar ? textures.venusRadar : textures[def.visual] || textures[def.id];
    const roughness = def.type === 'planet' && ['jupiter', 'saturn', 'uranus', 'neptune'].includes(def.id) ? 0.62 : 0.96;
    const material = def.id === 'sun'
      ? new THREE.MeshBasicMaterial({ map: textures.sun, toneMapped: true })
      : makeStandard(map, def.id === 'moon' ? 1 : roughness, def.id === 'earth'
        ? { emissiveMap: textures.earthNight, emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0.9 }
        : {});
    if (def.id === 'earth') attachNight(material);
    const mesh = new THREE.Mesh(geometry, material);
    spin.add(mesh);
    if (def.id === 'earth') {
      const clouds = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({
        map: textures.clouds,
        transparent: true,
        depthWrite: false,
        roughness: 1,
        metalness: 0,
      }));
      clouds.scale.setScalar(1.02);
      clouds.renderOrder = 2;
      spin.add(clouds);
      mesh.userData.clouds = clouds;
    }
    const atmoColors = {
      earth: '#8ec6ff',
      venus: '#f0ddb0',
      mars: '#e7b59a',
      jupiter: '#f0d2b0',
      saturn: '#f3e2c2',
      uranus: '#d5fbff',
      neptune: '#8eb6ff',
      titan: '#e7b07a',
    };
    let atmo = null;
    if (atmoColors[def.id]) {
      atmo = new THREE.Mesh(sphere, atmosphereMaterial(atmoColors[def.id]));
      atmo.scale.setScalar(1.08);
      atmo.renderOrder = 3;
      axis.add(atmo);
    }
    const proxy = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ visible: false }));
    proxy.userData.id = def.id;
    pivot.add(proxy);
    pickables.push(proxy);

    const view = {
      id: def.id,
      def,
      pivot,
      axis,
      spin,
      equator,
      moons,
      mesh,
      material,
      atmo,
      proxy,
      radiusScene: 1,
      ringOuter: 0,
      centerUniform: { value: new THREE.Vector3() },
      axisUniform: { value: new THREE.Vector3(0, 1, 0) },
      innerUniform: { value: 0 },
      outerUniform: { value: 1 },
      rings: null,
      trail: [],
      theta: 0,
    };
    if (def.rings) {
      const ringMap = textures[`${def.id}Ring`] || textures.saturnRing;
      const ringMat = new THREE.MeshStandardMaterial({
        map: ringMap,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.85,
        metalness: 0,
        depthWrite: false,
        alphaTest: 0.04,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 2.2, 96, 6), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 2;
      ring.userData.id = def.id;
      equator.add(ring);
      pickables.push(ring);
      view.rings = ring;
      if (!def.rings.faint) attachRingShadow(material, view);
    }
    if (def.tidalLock) {
      const mark = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0xffb45a }));
      mark.scale.setScalar(0.08);
      mark.position.set(1.05, 0, 0);
      mark.visible = false;
      mesh.add(mark);
      view.lockMark = mark;
    }
    if (def.id === 'classroom-comet') {
      view.ion = new THREE.Mesh(new THREE.ConeGeometry(0.15, 1, 8), new THREE.MeshBasicMaterial({ color: 0xb7dcff, transparent: true, opacity: 0.45, depthWrite: false }));
      view.dust = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1, 8), new THREE.MeshBasicMaterial({ color: 0xe7d2a4, transparent: true, opacity: 0.4, depthWrite: false }));
      pivot.add(view.ion, view.dust);
    }
    views.set(def.id, view);
  }

  for (const def of BODIES) {
    if (!def.parent || def.parent === 'sun' || def.type === 'region') continue;
    const view = views.get(def.id);
    const parent = views.get(def.parent);
    if (view && parent) parent.moons.attach(view.pivot);
  }

  const orbitGroup = new THREE.Group();
  system.add(orbitGroup);
  const belt = makeBelt(700, 2.15, 3.25, 41, 0x9a938c);
  const kuiper = makeBelt(360, 30, 50, 73, 0x8ea0c4);
  system.add(belt.mesh, kuiper.mesh);

  const stars = makeStars(2200);
  const milky = makeMilky();
  scene.add(stars, milky);

  const measureLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.85 }),
  );
  measureLine.visible = false;
  scene.add(measureLine);
  const pulse = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0xffe7b0 }));
  pulse.visible = false;
  scene.add(pulse);

  const selection = new THREE.Mesh(
    new THREE.RingGeometry(1.15, 1.28, 48),
    new THREE.MeshBasicMaterial({ color: 0xd7f6ff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  );
  selection.visible = false;
  scene.add(selection);

  const velocity = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0x9ad7c8);
  velocity.visible = false;
  scene.add(velocity);

  const cam = { theta: 0.62, phi: 1.02, radius: 148, target: new THREE.Vector3(0, 0, 0), transition: null, anchorId: null };
  let scaleMode = state.scaleMode;
  let orbitKey = '';
  let qualityLevel = 2;
  let slow = 0;
  let fast = 0;
  let frameTimes = [];
  let lostCount = 0;
  const pointers = new Map();
  let drag = null;
  let lastClick = { t: 0, id: null };
  const clockKeys = { left: false, right: false, up: false, down: false, inn: false, out: false };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lostCount += 1;
    state.contextLost = true;
    hooks.onContext?.('lost');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    if (lostCount > 3) return;
    state.contextLost = false;
    resize();
    hooks.onContext?.('restored');
  });

  function onDown(e) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, button: e.button };
    canvas.setPointerCapture?.(e.pointerId);
    cam.transition = null;
    hooks.onCameraGrab?.();
  }
  function onMove(e) {
    const prev = pointers.get(e.pointerId);
    if (!prev || !drag) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2) {
      const pts = [...pointers.values()];
      const d0 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      drag.pinch = drag.pinch || d0;
      const factor = d0 / drag.pinch;
      if (Number.isFinite(factor) && factor > 0) cam.radius /= factor;
      drag.pinch = d0;
      clampRadius();
      return;
    }
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
    const pan = state.panMode || drag.button === 2 || e.shiftKey;
    if (pan) {
      cam.anchorId = null;
      const dist = cam.radius;
      const k = dist * 0.0011;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
      cam.target.addScaledVector(right, -dx * k);
      cam.target.addScaledVector(up, dy * k);
    } else if (drag.moved) {
      cam.theta -= dx * 0.005;
      cam.phi = THREE.MathUtils.clamp(cam.phi - dy * 0.005, 0.08, Math.PI - 0.08);
    }
    drag.x = e.clientX;
    drag.y = e.clientY;
  }
  function onUp(e) {
    pointers.delete(e.pointerId);
    if (drag && !drag.moved && drag.button === 0) {
      const hits = pick(e.clientX, e.clientY);
      if (hits.length) {
        const now = performance.now();
        if (lastClick.id === hits[0] && now - lastClick.t < 320) hooks.onFocus?.(hits[0]);
        else hooks.onSelect?.(hits[0], hits.slice(1, 4));
        lastClick = { t: now, id: hits[0] };
      }
    }
    if (pointers.size === 0) drag = null;
  }
  function onWheel(e) {
    e.preventDefault();
    cam.transition = null;
    cam.radius *= Math.exp(e.deltaY * 0.00105);
    clampRadius();
    hooks.onCameraGrab?.();
  }

  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pickables, false).filter((h) => h.object.visible !== false && h.object.parent?.visible !== false);
    const ids = [];
    for (const hit of hits) {
      const id = hit.object.userData.id;
      if (id && !ids.includes(id)) ids.push(id);
      if (ids.length >= 4) break;
    }
    return ids;
  }

  function worldPos(id, target = _v) {
    const view = views.get(id);
    if (!view) return target.set(0, 0, 0);
    return view.pivot.getWorldPosition(target);
  }

  function clampRadius() {
    const id = state.followId || state.selectedId;
    const min = id && views.get(id) ? Math.max(views.get(id).radiusScene * 1.35, 0.002) : 0.05;
    cam.radius = THREE.MathUtils.clamp(cam.radius, min, state.scaleMode === 'relative' ? 8000 : 800);
  }

  function framing(id, mode) {
    const view = views.get(id);
    if (!view) return state.scaleMode === 'relative' ? 520 : 150;
    const r = Math.max(view.radiusScene, 0.01);
    if (mode === 'close') return r * 2.6;
    if (mode === 'rings') return Math.max(view.ringOuter * 2.6, r * 5);
    if (mode === 'system') return Math.max(r * 6, view.moonReach || r * 8);
    if (mode === 'terminator') return r * 3.1;
    if (mode === 'overview') return state.scaleMode === 'relative' ? 560 : 150;
    return Math.max(view.ringOuter * 2.2, r * 4.4);
  }

  function focus(id, mode = 'focus', instant = false) {
    const view = views.get(id);
    if (!view && id !== 'asteroid-belt' && id !== 'kuiper-belt') return;
    const dest = id === 'asteroid-belt' || id === 'kuiper-belt'
      ? new THREE.Vector3()
      : worldPos(id, new THREE.Vector3());
    const radius = id === 'asteroid-belt' ? (state.scaleMode === 'relative' ? 80 : 70)
      : id === 'kuiper-belt' ? (state.scaleMode === 'relative' ? 700 : 120)
        : framing(id, mode);
    const phi = mode === 'overview' ? 0.55 : mode === 'rings' ? 0.72 : mode === 'terminator' ? 1.25 : cam.phi;
    const theta = mode === 'terminator' ? cam.theta + 1.2 : cam.theta;
    if (instant || state.prefs.reducedMotion) {
      cam.target.copy(dest);
      cam.radius = radius;
      cam.phi = phi;
      cam.theta = theta;
      cam.transition = null;
      cam.anchorId = views.has(id) ? id : null;
      return;
    }
    cam.anchorId = views.has(id) ? id : null;
    cam.transition = {
      t: 0,
      dur: mode === 'overview' ? 1.15 : 1.35,
      from: cam.target.clone(),
      fromR: cam.radius,
      fromPhi: cam.phi,
      fromTheta: cam.theta,
      toId: views.has(id) ? id : null,
      to: dest,
      toR: radius,
      toPhi: phi,
      toTheta: theta,
    };
  }

  function overview(instant = false) {
    cam.anchorId = null;
    focus('sun', 'overview', instant);
    cam.transition && (cam.transition.to = new THREE.Vector3());
    if (instant || state.prefs.reducedMotion) cam.target.set(0, 0, 0);
  }

  function preset(name) {
    if (name === 'top') {
      cam.phi = 0.12;
      cam.theta = 0.2;
      cam.transition = null;
      return;
    }
    if (name === 'cinematic') {
      cam.phi = 1.25;
      cam.theta = 0.4;
      cam.radius = state.scaleMode === 'relative' ? 640 : 168;
      cam.transition = null;
      return;
    }
    if (name === 'polar' && state.selectedId) {
      cam.phi = 0.18;
      focus(state.selectedId, 'focus', state.prefs.reducedMotion);
    }
    if (name === 'equator' && state.selectedId) {
      cam.phi = 1.45;
      focus(state.selectedId, 'focus', state.prefs.reducedMotion);
    }
  }

  function visibleBody(def) {
    if (def.type === 'star' || def.type === 'planet' || def.id === 'moon') return true;
    if (def.type === 'moon') {
      return state.layers.moons || state.selectedId === def.id || state.selectedId === def.parent || state.followId === def.id || state.followId === def.parent;
    }
    if (def.group === 'dwarf') return state.layers.dwarfs || state.selectedId === def.id || state.followId === def.id;
    if (def.group === 'small') return state.layers.small || state.selectedId === def.id || state.followId === def.id;
    return false;
  }

  function updateBodies(sys) {
    const mode = state.scaleMode;
    for (const def of BODIES) {
      const view = views.get(def.id);
      if (!view) continue;
      const row = sys.bodies[def.id];
      view.pivot.visible = visibleBody(def) && Boolean(row?.au);
      if (!row?.au) continue;
      const radius = displayRadius(def.radiusEqKm || 1, mode);
      view.radiusScene = radius;
      const shape = def.shape || { x: 1, y: 1, z: 1 };
      view.mesh.scale.set(radius * shape.x, radius * shape.y, radius * shape.z);
      if (view.mesh.userData.clouds) view.mesh.userData.clouds.scale.setScalar(radius * 1.02);
      if (view.atmo) view.atmo.scale.setScalar(radius * 1.08);
      view.proxy.scale.setScalar(Math.max(radius * 1.35, radius + 0.15));
      if (def.parent && def.parent !== 'sun' && row.relativeAu) {
        const parent = getBody(def.parent);
        const local = mapLocal(row.relativeAu, parent.radiusEqKm || 6378, mode);
        view.pivot.position.set(local.x, local.y, local.z);
        view.moonReach = local.displayDistance;
        const parentView = views.get(def.parent);
        if (parentView) parentView.moonReach = Math.max(parentView.moonReach || 0, local.displayDistance + radius);
      } else {
        const p = mapHeliocentric(row.au, mode);
        view.pivot.position.set(p.x, p.y, p.z);
      }
      if (def.id === 'sun') {
        corona.position.copy(view.pivot.position);
        const glow = state.presentation === 'enhanced' ? 3.1 : 2.35;
        corona.scale.setScalar(radius * glow);
      }
      const period = def.tidalLock ? null : def.rotationDays;
      if (def.tidalLock && Number.isFinite(row.theta)) {
        const rel = view.pivot.position;
        const parentPos = views.get(def.parent)?.pivot.position || new THREE.Vector3();
        const dx = parentPos.x - (def.parent && def.parent !== 'sun' ? 0 : view.pivot.position.x);
        const dz = parentPos.z - (def.parent && def.parent !== 'sun' ? 0 : view.pivot.position.z);
        // Moon pivot is local to parent, so parent is at local origin.
        const toParent = def.parent && def.parent !== 'sun'
          ? new THREE.Vector3(-view.pivot.position.x, 0, -view.pivot.position.z)
          : new THREE.Vector3(dx, 0, dz);
        view.spin.rotation.y = Math.atan2(-toParent.z, toParent.x);
      } else if (period) {
        const spins = ((state.jd - J2000_JD) / Math.abs(period)) * Math.PI * 2;
        view.spin.rotation.y = spins;
        if (view.mesh.userData.clouds && !state.prefs.reducedMotion) {
          view.mesh.userData.clouds.rotation.y = spins * 1.08;
        }
      }
      if (view.lockMark) view.lockMark.visible = state.tidalOverlay;
      if (view.rings && def.rings) {
        const eq = displayRadius(def.radiusEqKm, mode);
        const inner = eq * (def.rings.innerKm / def.radiusEqKm);
        const outer = eq * (def.rings.outerKm / def.radiusEqKm);
        view.ringOuter = outer;
        if (Math.abs((view.rings.userData.outer || 0) - outer) > 0.02) {
          view.rings.geometry.dispose();
          view.rings.geometry = new THREE.RingGeometry(Math.max(0.01, inner), Math.max(inner + 0.01, outer), 96, 6);
          view.rings.userData.outer = outer;
        }
        view.innerUniform.value = inner;
        view.outerUniform.value = outer;
        view.rings.visible = def.rings.faint ? state.layers.faintRings || state.selectedId === def.id : true;
        const showEnhanced = state.presentation === 'enhanced' && def.rings.faint;
        view.rings.material.opacity = def.rings.faint ? (showEnhanced ? 0.55 : 0.28) : 1;
      }
      if (def.id === 'venus') {
        const next = state.venusRadar ? textures.venusRadar : textures.textures?.venus || textures.venus;
        if (view.material.map !== next) {
          view.material.map = next;
          view.material.needsUpdate = true;
        }
      }
      if (view.ion && row.au) {
        const activity = row.activity ?? 0.2;
        const away = view.pivot.position.clone();
        if (away.lengthSq() > 1e-6) away.normalize();
        else away.set(1, 0, 0);
        const dustDir = away.clone().add(new THREE.Vector3(-away.z, 0, away.x).multiplyScalar(0.35)).normalize();
        aimTail(view.ion, away, 1.2 + activity * 7, activity);
        aimTail(view.dust, dustDir, 1 + activity * 5, activity * 0.8);
      }
    }
    sunLight.position.copy(views.get('sun').pivot.position);
    sunUniform.value.copy(sunLight.position);
    const saturn = views.get('saturn');
    if (saturn) {
      saturn.pivot.getWorldPosition(saturn.centerUniform.value);
      saturn.axis.getWorldDirection ? null : null;
      _v.set(0, 1, 0).applyQuaternion(saturn.axis.getWorldQuaternion(_q));
      saturn.axisUniform.value.copy(_v);
    }
  }

  function rebuildOrbits(sys) {
    const key = `${state.scaleMode}|${state.orbits}|${state.selectedId}|${state.layers.moons}|${Math.floor(state.jd / 365.25)}|${accuracyNow()}`;
    if (key === orbitKey) return;
    orbitKey = key;
    orbitGroup.clear();
    for (const view of views.values()) {
      [...view.moons.children].forEach((child) => {
        if (child.userData?.tempOrbit) view.moons.remove(child);
      });
    }
    const mode = state.orbits;
    if (mode === 'none') return;
    const ids = mode === 'selected' && state.selectedId ? [state.selectedId]
      : mode === 'system' && state.selectedId ? [state.selectedId, ...(getBody(state.selectedId)?.moons || []), getBody(state.selectedId)?.parent].filter(Boolean)
        : BODIES.filter((b) => b.jpl || b.simple).map((b) => b.id);
    for (const id of ids) {
      const def = getBody(id);
      if (!def) continue;
      if (def.type === 'moon') {
        const orbit = MOON_ORBITS[def.moonOrbit];
        const parent = getBody(def.parent);
        if (!orbit || !parent) continue;
        const pts = [];
        for (let i = 0; i <= 96; i += 1) {
          const theta = (i / 96) * Math.PI * 2 * (orbit.retrograde ? -1 : 1);
          const r = orbit.radiusKm / 149597870.7;
          const inc = orbit.inclinationDeg * Math.PI / 180;
          const au = {
            x: r * Math.cos(theta),
            y: r * Math.sin(theta) * Math.cos(inc),
            z: r * Math.sin(theta) * Math.sin(inc),
          };
          const local = mapLocal(au, parent.radiusEqKm, state.scaleMode);
          pts.push(new THREE.Vector3(local.x, local.y, local.z));
        }
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({
          color: id === state.selectedId ? 0xd7ecff : 0x8ea0b8,
          transparent: true,
          opacity: id === state.selectedId ? 0.9 : 0.35,
        }));
        views.get(def.parent)?.moons.add(line);
        line.userData.tempOrbit = true;
        continue;
      }
      const samples = sampleOrbitAu(id, state.jd, accuracyNow(), def.simple ? 140 : 180);
      const pts = samples.map((au) => {
        const p = mapHeliocentric(au, state.scaleMode);
        return new THREE.Vector3(p.x, p.y, p.z);
      });
      if (pts.length < 2) continue;
      const selected = id === state.selectedId;
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({
        color: selected ? 0xe7f4ff : 0x9aafc4,
        transparent: true,
        opacity: selected ? 0.9 : def.simple ? 0.18 : 0.32,
      }));
      orbitGroup.add(line);
    }
  }

  function updateTrails(dt) {
    if (!state.trails) return;
    const stepDays = Math.abs(state.rate * dt / 86400);
    if (stepDays > 20) {
      for (const view of views.values()) view.trail.length = 0;
      state.trailBreakNote = true;
      return;
    }
    for (const view of views.values()) {
      if (!view.pivot.visible) continue;
      if (state.labels === 'selected' && view.id !== state.selectedId && view.id !== state.followId) continue;
      const p = view.pivot.getWorldPosition(new THREE.Vector3());
      const last = view.trail[view.trail.length - 1];
      if (!last || last.distanceTo(p) > view.radiusScene * 0.35) view.trail.push(p);
      if (view.trail.length > 180) view.trail.shift();
    }
  }

  function updateCamera(dt) {
    if (state.cameraKeys) {
      if (clockKeys.left) cam.theta -= dt * 0.9;
      if (clockKeys.right) cam.theta += dt * 0.9;
      if (clockKeys.up) cam.phi = Math.max(0.08, cam.phi - dt * 0.7);
      if (clockKeys.down) cam.phi = Math.min(Math.PI - 0.08, cam.phi + dt * 0.7);
      if (clockKeys.inn) cam.radius *= 1 - dt * 0.65;
      if (clockKeys.out) cam.radius *= 1 + dt * 0.65;
    }
    const follow = state.followId && views.get(state.followId);
    const anchor = follow ? state.followId : cam.anchorId;
    if (cam.transition) {
      cam.transition.t += dt / cam.transition.dur;
      const k = Math.min(1, cam.transition.t);
      const e = k * k * (3 - 2 * k);
      const dest = cam.transition.toId ? worldPos(cam.transition.toId, new THREE.Vector3()) : cam.transition.to;
      cam.target.lerpVectors(cam.transition.from, dest, e);
      cam.radius = THREE.MathUtils.lerp(cam.transition.fromR, cam.transition.toR, e);
      cam.phi = THREE.MathUtils.lerp(cam.transition.fromPhi, cam.transition.toPhi, e);
      cam.theta = THREE.MathUtils.lerp(cam.transition.fromTheta, cam.transition.toTheta, e);
      if (k >= 1) {
        cam.transition = null;
        hooks.onFramed?.();
      }
    } else if (anchor && views.get(anchor)) {
      cam.target.copy(worldPos(anchor, new THREE.Vector3()));
    }
    if (state.frame !== 'sun' && state.selectedId && views.get(state.selectedId)) {
      const origin = worldPos(state.selectedId, new THREE.Vector3());
      system.position.copy(origin).multiplyScalar(-1);
      if (!cam.transition && !follow) cam.target.set(0, 0, 0);
    } else {
      system.position.set(0, 0, 0);
    }
    clampRadius();
    _s.set(cam.radius, cam.phi, cam.theta);
    _v.setFromSpherical(_s);
    camera.position.copy(cam.target).add(_v);
    camera.lookAt(cam.target);
    const dist = Math.max(cam.radius, 0.001);
    camera.near = THREE.MathUtils.clamp(dist / 400, 0.00004, 2);
    camera.far = Math.max(8000, dist * 80);
    camera.updateProjectionMatrix();
    const selected = state.selectedId && views.get(state.selectedId);
    if (selected) {
      const p = worldPos(state.selectedId, new THREE.Vector3());
      selection.visible = true;
      selection.position.copy(p);
      selection.lookAt(camera.position);
      const span = Math.max(selected.ringOuter, selected.radiusScene) * 1.55;
      selection.scale.setScalar(Math.max(span, 0.05));
    } else selection.visible = false;
  }

  function updateBelts(jd) {
    belt.mesh.visible = state.layers.asteroids && state.effectiveQuality !== 'low';
    kuiper.mesh.visible = state.layers.kuiper;
    const countA = state.effectiveQuality === 'low' ? 180 : state.effectiveQuality === 'medium' ? 420 : 700;
    const countK = state.effectiveQuality === 'low' ? 80 : 360;
    placeBelt(belt, countA, jd);
    placeBelt(kuiper, countK, jd);
  }

  function placeBelt(pack, count, jd) {
    const dummy = pack.dummy;
    const n = Math.min(count, pack.rocks.length);
    pack.mesh.count = n;
    for (let i = 0; i < n; i += 1) {
      const rock = pack.rocks[i];
      const M = (rock.M0 + rock.n * (jd - J2000_JD)) * Math.PI / 180;
      const r = rock.a * (1 - rock.e * Math.cos(M));
      const inc = rock.i * Math.PI / 180;
      const au = { x: r * Math.cos(M), y: r * Math.sin(M) * Math.cos(inc), z: r * Math.sin(M) * Math.sin(inc) };
      const p = mapHeliocentric(au, state.scaleMode);
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(rock.size * (state.scaleMode === 'relative' ? 0.35 : 1));
      dummy.rotation.set(rock.rot, rock.rot * 0.3, 0);
      dummy.updateMatrix();
      pack.mesh.setMatrixAt(i, dummy.matrix);
    }
    pack.mesh.instanceMatrix.needsUpdate = true;
  }

  function updateMeasure() {
    const m = state.measure;
    if (!m?.a || !m?.b || !views.get(m.a) || !views.get(m.b)) {
      measureLine.visible = false;
      pulse.visible = false;
      return;
    }
    measureLine.visible = true;
    const a = worldPos(m.a, new THREE.Vector3());
    const b = worldPos(m.b, new THREE.Vector3());
    measureLine.geometry.setFromPoints([a, b]);
    if (state.lightPulse) {
      pulse.visible = true;
      const t = (performance.now() / 4000) % 1;
      pulse.position.lerpVectors(a, b, t);
      pulse.scale.setScalar(0.15);
    } else pulse.visible = false;
  }

  function updateSelectionVelocity() {
    velocity.visible = Boolean(state.layers.velocity && state.selectedId && state.selectedId !== 'sun');
    if (!velocity.visible) return;
    const id = state.selectedId;
    const vel = velocityAuPerDay((time) => bodyAu(id, time, accuracyNow()), state.jd);
    if (!vel.ok) return;
    const kms = auPerDayToKmS(vel.auPerDay);
    const speed = len(kms);
    const dir = eclipticToScene(norm(vel.auPerDay));
    const origin = worldPos(id, new THREE.Vector3());
    velocity.position.copy(origin);
    velocity.setDirection(new THREE.Vector3(dir.x, dir.y, dir.z));
    velocity.setLength(Math.max(views.get(id).radiusScene * 3, 1.2));
    state.velocityLegend = speed;
  }

  function applyQuality(level) {
    qualityLevel = level;
    state.effectiveQuality = ['low', 'medium', 'high'][level];
    for (const view of views.values()) {
      if (view.atmo) view.atmo.visible = level > 0 && !state.prefs.simplified;
      if (view.mesh.userData.clouds) view.mesh.userData.clouds.visible = level > 0;
    }
    stars.geometry.setDrawRange(0, level === 0 ? 700 : level === 1 ? 1400 : 2200);
    milky.visible = level > 0 && state.prefs.background > 0.05;
    resize();
  }

  function resize() {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    const cap = qualityLevel === 0 ? 1 : qualityLevel === 1 ? 1.25 : 1.75;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function update(dt) {
    frameTimes.push(dt);
    if (frameTimes.length > 45) frameTimes.shift();
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    state.fps = avg > 0 ? 1 / avg : 0;
    if (state.quality === 'auto') {
      if (avg > 1 / 28) { slow += 1; fast = 0; } else if (avg < 1 / 55) { fast += 1; slow = 0; } else { slow = 0; fast = 0; }
      if (slow > 40 && qualityLevel > 0) {
        applyQuality(qualityLevel - 1);
        state.qualityNote = 'adapted';
        slow = 0;
      } else if (fast > 180 && qualityLevel < 2) {
        applyQuality(qualityLevel + 1);
        fast = 0;
      }
    } else {
      const wanted = state.quality === 'low' ? 0 : state.quality === 'medium' ? 1 : 2;
      if (wanted !== qualityLevel) applyQuality(wanted);
    }
    const sys = systemAt(state.jd, state.allowExtended ? 'extended' : 'primary');
    if (scaleMode !== state.scaleMode) {
      scaleMode = state.scaleMode;
      orbitKey = '';
      const id = state.followId || state.selectedId;
      if (id) focus(id, 'focus', state.prefs.reducedMotion);
      else overview(state.prefs.reducedMotion);
    }
    renderer.toneMappingExposure = (state.presentation === 'enhanced' ? 1.22 : 1.02) * (state.photoExposure || 1);
    ambient.intensity = state.presentation === 'enhanced' ? 0.075 : 0.028;
    if (state.prefs.simplified) ambient.intensity = 0.11;
    camera.fov = state.photoFov || 48;
    updateBodies(sys);
    rebuildOrbits(sys);
    updateTrails(dt);
    updateBelts(state.jd);
    updateCamera(dt);
    updateMeasure();
    if (Math.floor(performance.now() / 500) % 2 === 0) updateSelectionVelocity();
    stars.position.copy(camera.position);
    milky.position.copy(camera.position);
    stars.material.opacity = state.prefs.background;
    milky.material.opacity = state.prefs.background * 0.28;
    corona.material.opacity = state.presentation === 'enhanced' ? 0.7 : 0.48;
    if (views.get('sun')) views.get('sun').spin.rotation.y += state.prefs.reducedMotion ? 0 : dt * 0.03;
    // Drop temporary moon orbit lines that were parented last rebuild by clearing children tagged... handled because rebuild clears only orbitGroup.
    // Moon lines accumulate if rebuild returns early. They are added to moons group.
    // Fix: remove temp orbits at start of rebuild. Already new key clears via parent? I only orbitGroup.clear().
    // I'll remove temp lines here if key matches after rebuild function handles it.
  }

  const oldRebuild = rebuildOrbits;
  // wrap to clean moon lines
  function cleanMoonLines() {
    for (const view of views.values()) {
      [...view.moons.children].forEach((child) => {
        if (child.userData?.tempOrbit) view.moons.remove(child);
      });
    }
  }
  const rebuildRef = rebuildOrbits;
  function rebuildWrapped(sys) {
    const key = `${state.scaleMode}|${state.orbits}|${state.selectedId}|${state.layers.moons}|${Math.floor(state.jd / 365.25)}|${accuracyNow()}`;
    if (key !== orbitKey) cleanMoonLines();
    rebuildRef(sys);
  }

  function projections() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const list = [];
    for (const [id, view] of views) {
      if (!view.pivot.visible) continue;
      const world = view.pivot.getWorldPosition(new THREE.Vector3());
      const projected = world.clone().project(camera);
      const x = (projected.x * 0.5 + 0.5) * w;
      const y = (-projected.y * 0.5 + 0.5) * h;
      const dist = camera.position.distanceTo(world);
      const radiusPx = (view.radiusScene / Math.max(dist, 0.0001)) * (h / (2 * Math.tan((camera.fov * Math.PI) / 360)));
      list.push({
        id,
        x,
        y,
        behind: projected.z > 1,
        radiusPx,
        priority: id === state.selectedId ? 100 : id === state.followId ? 80 : getBody(id)?.type === 'planet' || id === 'sun' || id === 'moon' ? 50 : 10,
      });
    }
    return list;
  }

  function mapData() {
    const pts = [];
    for (const id of ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']) {
      const view = views.get(id);
      if (!view) continue;
      pts.push({ id, x: view.pivot.position.x, z: view.pivot.position.z });
    }
    return {
      pts,
      camera: { x: camera.position.x, z: camera.position.z },
      target: { x: cam.target.x, z: cam.target.z },
      scaleMode: state.scaleMode,
    };
  }

  function capture(pixelScale = 1) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const prev = renderer.getPixelRatio();
    const max = renderer.capabilities?.maxTextureSize || 4096;
    const scaleWanted = Math.min(pixelScale, max / Math.max(w, h));
    renderer.setPixelRatio(prev * Math.max(1, scaleWanted));
    renderer.setSize(w, h, false);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    renderer.setPixelRatio(prev);
    resize();
    return { url, scaled: scaleWanted };
  }

  function getView() {
    return { theta: cam.theta, phi: cam.phi, radius: cam.radius, targetId: state.followId || state.selectedId || 'sun' };
  }
  function setView(v) {
    cam.theta = v.theta;
    cam.phi = v.phi;
    cam.radius = v.radius;
    cam.transition = null;
    if (v.targetId && views.get(v.targetId)) cam.target.copy(worldPos(v.targetId, new THREE.Vector3()));
  }

  applyQuality(window.matchMedia('(max-width: 800px)').matches ? 1 : 2);
  resize();
  overview(true);

  return {
    resize,
    update: (dt) => {
      const sys = systemAt(state.jd, state.allowExtended ? 'extended' : 'primary');
      // use inner update but avoid double systemAt — call the body of update
      update(dt);
      sys;
    },
    render: () => renderer.render(scene, camera),
    projections,
    mapData,
    focus,
    overview,
    preset,
    frameSystem: (id) => focus(id, 'system'),
    getView,
    setView,
    pointTheta(theta) { cam.theta = theta; cam.transition = null; },
    capture,
    setKey(name, down) { clockKeys[name] = down; },
    dispose() {
      renderer.dispose();
      sphere.dispose();
    },
    rebuildOrbits: rebuildWrapped,
  };
}

function aimTail(mesh, dir, length, activity) {
  mesh.scale.set(0.25 + activity, length, 0.25 + activity);
  mesh.position.copy(dir).multiplyScalar(length * 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
}

function atmosphereMaterial(hex) {
  const color = new THREE.Color(hex);
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uColor: { value: color } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(cameraPosition - vWorld))), 2.2);
        gl_FragColor = vec4(uColor, fres * 0.55);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function radialSprite() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 120);
  grd.addColorStop(0, 'rgba(255,244,220,0.9)');
  grd.addColorStop(0.35, 'rgba(255,180,80,0.25)');
  grd.addColorStop(1, 'rgba(255,160,60,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeStars(count) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const rand = mulberry32(2026);
  for (let i = 0; i < count; i += 1) {
    const z = rand() * 2 - 1;
    const t = rand() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const radius = 4000 + rand() * 200;
    positions[i * 3] = Math.cos(t) * r * radius;
    positions[i * 3 + 1] = z * radius;
    positions[i * 3 + 2] = Math.sin(t) * r * radius;
    const tint = rand();
    colors[i * 3] = 0.75 + tint * 0.2;
    colors[i * 3 + 1] = 0.8 + rand() * 0.15;
    colors[i * 3 + 2] = 0.9;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.35,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    opacity: 0.9,
  });
  return new THREE.Points(geo, mat);
}

function makeMilky() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 256);
  const grd = g.createLinearGradient(0, 90, 0, 170);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(0.5, 'rgba(170,186,210,0.35)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    opacity: 0.22,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(3900, 32, 16), mat);
  mesh.rotation.z = 0.6;
  return mesh;
}

function makeBelt(count, a0, a1, seed, color) {
  const rand = mulberry32(seed);
  const rocks = [];
  for (let i = 0; i < count; i += 1) {
    const a = a0 + rand() * (a1 - a0);
    rocks.push({
      a,
      e: rand() * 0.08,
      i: (rand() - 0.5) * (a0 > 10 ? 8 : 14),
      M0: rand() * 360,
      n: 360 / (a ** 1.5 * 365.25),
      size: a0 > 10 ? 0.35 : 0.05 + rand() * 0.08,
      rot: rand() * 6,
    });
  }
  const geo = irregularGeometry(seed, 1, 1);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 }), count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = count;
  return { mesh, rocks, dummy: new THREE.Object3D() };
}
