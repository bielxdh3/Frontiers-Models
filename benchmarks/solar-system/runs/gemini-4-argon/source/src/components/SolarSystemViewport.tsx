import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  CameraMode,
  CelestialBodyData,
  EvaluatedBodyState,
  Language,
  ReferenceFrame,
  UserPreferences,
  Vector3Like,
} from '../types/solarSystem';
import { CATALOG_BY_ID, CELESTIAL_CATALOG, getChildMoons } from '../data/celestialCatalog';
import {
  BodyRenderRig,
  createBeltParticleSystem,
  createBodyRenderRig,
  createSeededStarfield,
} from '../engine/sceneObjects';
import {
  degToRad,
  eclipticToThreeVector,
  evaluateKeplerianOrbitAtTime,
  mapHeliocentricAuToExplorationUnits,
  RELATIVE_SCALE_UNITS_PER_AU,
  sampleOrbitDisplayPath,
} from '../engine/ephemeris';
import { formatSimulationDateUtc } from '../utils/formatters';

export interface ProjectedLabelItem {
  id: string;
  name: string;
  category: string;
  x: number;
  y: number;
  priority: number;
  isSelected: boolean;
  isSubpixel: boolean;
  isOccluded: boolean;
  color: string;
}

export interface DisambiguationCandidate {
  id: string;
  name: string;
  subtype: string;
}

export interface PhotoCaptureOptions {
  includeLabels: boolean;
  includeMetadataCaption: boolean;
  resolutionScale: 1 | 2;
  aspectPreset: 'viewport' | '16:9' | '4:3' | '1:1';
  fov: number;
}

export interface ViewportHandle {
  flyToBody: (bodyId: string, mode?: CameraMode, customMultiplier?: number, elevationDeg?: number) => void;
  setCameraPreset: (preset: CameraMode) => void;
  resetView: () => void;
  zoomByFactor: (factor: number) => void;
  orbitByAngles: (dTheta: number, dPhi: number) => void;
  getCameraOffset: () => Vector3Like;
  applySavedOffset: (targetId: string, offset: Vector3Like, mode: CameraMode) => void;
  invalidateTrails: () => void;
  capturePhotoDataUrl: (options: PhotoCaptureOptions) => string | null;
}

interface SolarSystemViewportProps {
  simTimeMs: number;
  bodyStates: Record<string, EvaluatedBodyState>;
  selectedBodyId: string;
  cameraMode: CameraMode;
  referenceFrame: ReferenceFrame;
  preferences: UserPreferences;
  favorites: string[];
  measurementEndpoints: { fromId: string; toId: string; pulseProgress: number | null } | null;
  photoFov?: number;
  onSelectBody: (bodyId: string, initiateFocus?: boolean) => void;
  onCameraModeChange: (mode: CameraMode) => void;
  onManualCameraGesture: () => void;
  onRegisterHandle: (handle: ViewportHandle) => void;
  onFpsSample?: (fps: number) => void;
}

export const SolarSystemViewport: React.FC<SolarSystemViewportProps> = ({
  simTimeMs,
  bodyStates,
  selectedBodyId,
  cameraMode,
  referenceFrame,
  preferences,
  favorites,
  measurementEndpoints,
  photoFov,
  onSelectBody,
  onCameraModeChange,
  onManualCameraGesture,
  onRegisterHandle,
  onFpsSample,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState<boolean>(false);
  const [labels, setLabels] = useState<ProjectedLabelItem[]>([]);
  const [disambiguation, setDisambiguation] = useState<{
    x: number;
    y: number;
    candidates: DisambiguationCandidate[];
  } | null>(null);

  // Latest reactive props stored in ref for the authoritative animation loop
  const latestPropsRef = useRef({
    simTimeMs,
    bodyStates,
    selectedBodyId,
    cameraMode,
    referenceFrame,
    preferences,
    favorites,
    measurementEndpoints,
    photoFov,
  });
  latestPropsRef.current = {
    simTimeMs,
    bodyStates,
    selectedBodyId,
    cameraMode,
    referenceFrame,
    preferences,
    favorites,
    measurementEndpoints,
    photoFov,
  };

  // Camera spherical state around current lookAt target
  const camStateRef = useRef({
    targetBodyId: selectedBodyId || 'earth',
    lookAtPos: new THREE.Vector3(0, 0, 0),
    sphericalRadius: 115,
    sphericalTheta: 0.65, // Azimuth in XZ plane
    sphericalPhi: 1.08, // Polar angle from +Y (0 = north pole, PI/2 = equator)
    panOffset: new THREE.Vector3(0, 0, 0),
    // Transition animation
    isTransitioning: false,
    transitionStartMs: 0,
    transitionDurationMs: 950,
    startLookAt: new THREE.Vector3(),
    startRadius: 115,
    startTheta: 0.65,
    startPhi: 1.08,
    destTargetId: selectedBodyId || 'earth',
    destRadius: 115,
    destTheta: 0.65,
    destPhi: 1.08,
  });

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rigsRef = useRef<Record<string, BodyRenderRig>>({});
  const orbitLinesRef = useRef<Record<string, THREE.Line>>({});
  const trailHistoryRef = useRef<Record<string, Vector3Like[]>>({});
  const trailLinesRef = useRef<Record<string, THREE.Line>>({});
  const lastTrailSampleSimMsRef = useRef<number>(simTimeMs);
  const lastOrbitScaleModeRef = useRef<string>('');

  const computeIdealFramingRadius = useCallback(
    (bodyId: string, mode: CameraMode, customMultiplier?: number): number => {
      const body = CATALOG_BY_ID[bodyId];
      const state = latestPropsRef.current.bodyStates[bodyId];
      if (!body || !state) return 120;

      if (mode === 'overview' || mode === 'preset_top' || mode === 'preset_cinematic') {
        return latestPropsRef.current.preferences.scaleMode === 'exploration' ? 145 : 320;
      }

      const baseR = Math.max(0.18, state.displayRadius);
      // Include ring extent if present
      let extentMultiplier = 1.0;
      if (body.rings) {
        const maxRingRatio = Math.max(...body.rings.bands.map((b) => b.outerRadiusRatio));
        extentMultiplier = Math.max(1.0, maxRingRatio * 1.15);
      }

      if (mode === 'parent_system') {
        const moons = getChildMoons(body.id);
        if (moons.length > 0) {
          const maxMoonDist = Math.max(
            ...moons.map((m) =>
              latestPropsRef.current.preferences.scaleMode === 'exploration'
                ? m.visual.explorationDistanceUnits
                : Math.max(2.0, ((m.parentDistanceKm ?? 400000) / 100000) * 1.35)
            )
          );
          return Math.max(baseR * extentMultiplier * 3.2, maxMoonDist * 2.35);
        }
      }

      const mult = customMultiplier ?? 3.8;
      return Math.max(0.85, baseR * extentMultiplier * mult);
    },
    []
  );

  const flyToBody = useCallback(
    (
      bodyId: string,
      mode: CameraMode = 'focus',
      customMultiplier?: number,
      elevationDeg?: number
    ) => {
      const cs = camStateRef.current;
      const reducedMotion = latestPropsRef.current.preferences.reducedMotion;
      const idealRadius = computeIdealFramingRadius(bodyId, mode, customMultiplier);
      const targetPhi =
        elevationDeg !== undefined
          ? Math.max(0.12, Math.min(Math.PI - 0.12, Math.PI / 2 - degToRad(elevationDeg)))
          : mode === 'preset_top'
            ? 0.08
            : mode === 'preset_polar'
              ? 0.12
              : mode === 'preset_equatorial'
                ? Math.PI / 2
                : mode === 'preset_cinematic'
                  ? 1.32
                  : 1.12;

      cs.panOffset.set(0, 0, 0);

      if (reducedMotion) {
        cs.targetBodyId = bodyId;
        cs.destTargetId = bodyId;
        cs.sphericalRadius = idealRadius;
        cs.sphericalPhi = targetPhi;
        cs.isTransitioning = false;
        const st = latestPropsRef.current.bodyStates[bodyId];
        if (st) {
          cs.lookAtPos.set(st.displayPosition.x, st.displayPosition.y, st.displayPosition.z);
        }
        return;
      }

      cs.isTransitioning = true;
      cs.transitionStartMs = performance.now();
      cs.transitionDurationMs = 880;
      cs.startLookAt.copy(cs.lookAtPos);
      cs.startRadius = cs.sphericalRadius;
      cs.startTheta = cs.sphericalTheta;
      cs.startPhi = cs.sphericalPhi;
      cs.destTargetId = bodyId;
      cs.targetBodyId = bodyId;
      cs.destRadius = idealRadius;
      cs.destTheta = cs.sphericalTheta + 0.25;
      cs.destPhi = targetPhi;
    },
    [computeIdealFramingRadius]
  );

  const resetView = useCallback(() => {
    onCameraModeChange('overview');
    flyToBody('sun', 'overview', undefined, 28);
  }, [flyToBody, onCameraModeChange]);

  const setCameraPreset = useCallback(
    (preset: CameraMode) => {
      const targetId =
        preset === 'overview' || preset === 'preset_top' || preset === 'preset_cinematic'
          ? 'sun'
          : latestPropsRef.current.selectedBodyId || 'earth';
      onCameraModeChange(preset);
      flyToBody(targetId, preset);
    },
    [flyToBody, onCameraModeChange]
  );

  const zoomByFactor = useCallback((factor: number) => {
    const cs = camStateRef.current;
    cs.isTransitioning = false;
    cs.sphericalRadius = Math.max(0.45, Math.min(2400, cs.sphericalRadius * factor));
  }, []);

  const orbitByAngles = useCallback((dTheta: number, dPhi: number) => {
    const cs = camStateRef.current;
    cs.isTransitioning = false;
    cs.sphericalTheta += dTheta;
    cs.sphericalPhi = Math.max(0.06, Math.min(Math.PI - 0.06, cs.sphericalPhi + dPhi));
  }, []);

  const invalidateTrails = useCallback(() => {
    trailHistoryRef.current = {};
    Object.values(trailLinesRef.current).forEach((line) => {
      line.geometry.setFromPoints([]);
    });
  }, []);

  const getCameraOffset = useCallback((): Vector3Like => {
    const cs = camStateRef.current;
    const sinPhi = Math.sin(cs.sphericalPhi);
    return {
      x: cs.sphericalRadius * sinPhi * Math.cos(cs.sphericalTheta),
      y: cs.sphericalRadius * Math.cos(cs.sphericalPhi),
      z: cs.sphericalRadius * sinPhi * Math.sin(cs.sphericalTheta),
    };
  }, []);

  const applySavedOffset = useCallback(
    (targetId: string, offset: Vector3Like, mode: CameraMode) => {
      const cs = camStateRef.current;
      const r = Math.max(0.6, Math.hypot(offset.x, offset.y, offset.z));
      const phi = Math.acos(Math.max(-0.99, Math.min(0.99, offset.y / r)));
      const theta = Math.atan2(offset.z, offset.x);
      cs.isTransitioning = false;
      cs.targetBodyId = targetId;
      cs.destTargetId = targetId;
      cs.sphericalRadius = r;
      cs.sphericalPhi = phi;
      cs.sphericalTheta = theta;
      cs.panOffset.set(0, 0, 0);
      onCameraModeChange(mode);
    },
    [onCameraModeChange]
  );

  const capturePhotoDataUrl = useCallback(
    (options: PhotoCaptureOptions): string | null => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!renderer || !scene || !camera) return null;

      try {
        // Render one fresh frame before reading pixels
        const prevFov = camera.fov;
        if (options.fov && Number.isFinite(options.fov)) {
          camera.fov = options.fov;
          camera.updateProjectionMatrix();
        }
        renderer.render(scene, camera);

        const srcCanvas = renderer.domElement;
        const scale = options.resolutionScale === 2 ? 1.5 : 1.0;
        const maxDim = 2560;

        let targetW = Math.min(maxDim, Math.round(srcCanvas.width * scale));
        let targetH = Math.min(maxDim, Math.round(srcCanvas.height * scale));

        if (options.aspectPreset === '16:9') {
          targetH = Math.round((targetW * 9) / 16);
        } else if (options.aspectPreset === '4:3') {
          targetH = Math.round((targetW * 3) / 4);
        } else if (options.aspectPreset === '1:1') {
          const side = Math.min(targetW, targetH);
          targetW = side;
          targetH = side;
        }

        const outCanvas = document.createElement('canvas');
        outCanvas.width = targetW;
        outCanvas.height = targetH;
        const ctx = outCanvas.getContext('2d');
        if (!ctx) return null;

        // Center-crop source canvas into target aspect ratio
        const srcAspect = srcCanvas.width / srcCanvas.height;
        const dstAspect = targetW / targetH;
        let sx = 0;
        let sy = 0;
        let sw = srcCanvas.width;
        let sh = srcCanvas.height;

        if (srcAspect > dstAspect) {
          sw = Math.round(srcCanvas.height * dstAspect);
          sx = Math.round((srcCanvas.width - sw) / 2);
        } else {
          sh = Math.round(srcCanvas.width / dstAspect);
          sy = Math.round((srcCanvas.height - sh) / 2);
        }

        ctx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, targetW, targetH);

        // Deliberately render HTML labels onto the exported canvas when requested (Section 41)
        if (options.includeLabels) {
          const rect = srcCanvas.getBoundingClientRect();
          const scaleX = targetW / Math.max(1, rect.width);
          const scaleY = targetH / Math.max(1, rect.height);
          ctx.font = `600 ${Math.round(13 * scaleX)}px system-ui, -apple-system, sans-serif`;
          ctx.textBaseline = 'middle';

          for (const lbl of labels) {
            if (lbl.isOccluded) continue;
            const lx = lbl.x * scaleX;
            const ly = lbl.y * scaleY;
            if (lx < 20 || lx > targetW - 20 || ly < 20 || ly > targetH - 40) continue;

            ctx.fillStyle = 'rgba(7, 12, 24, 0.78)';
            const textWidth = ctx.measureText(lbl.name).width;
            ctx.fillRect(lx - 6, ly - 11, textWidth + 14, 22);
            ctx.strokeStyle = lbl.isSelected ? '#38bdf8' : 'rgba(148, 163, 184, 0.45)';
            ctx.lineWidth = 1;
            ctx.strokeRect(lx - 6, ly - 11, textWidth + 14, 22);
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(lbl.name, lx + 1, ly);
          }
        }

        if (options.includeMetadataCaption) {
          const { selectedBodyId: selId, simTimeMs: tMs, preferences: prefs } = latestPropsRef.current;
          const lang = prefs.language;
          const bodyName = CATALOG_BY_ID[selId]?.name[lang] ?? selId;
          const dateStr = formatSimulationDateUtc(tMs, lang);
          const scaleLabel =
            prefs.scaleMode === 'exploration'
              ? lang === 'pt-BR'
                ? 'Escala de Exploração (raios e distâncias ajustados)'
                : 'Exploration Scale (adjusted radii & distances)'
              : lang === 'pt-BR'
                ? 'Escala Relativa (distâncias lineares em UA)'
                : 'Relative Scale (linear AU distances)';

          const barH = Math.max(40, Math.round(targetH * 0.055));
          ctx.fillStyle = 'rgba(5, 9, 20, 0.86)';
          ctx.fillRect(0, targetH - barH, targetW, barH);
          ctx.fillStyle = '#e2e8f0';
          ctx.font = `500 ${Math.max(12, Math.round(barH * 0.36))}px system-ui, sans-serif`;
          ctx.textBaseline = 'middle';
          const caption = `${
            lang === 'pt-BR' ? 'Observatório do Sistema Solar' : 'Solar System Observatory'
          }  •  ${bodyName}  •  ${dateStr}  •  ${scaleLabel}  •  NASA/JPL Keplerian Model`;
          ctx.fillText(caption, 18, targetH - barH / 2);
        }

        camera.fov = prevFov;
        camera.updateProjectionMatrix();
        return outCanvas.toDataURL('image/png');
      } catch {
        return null;
      }
    },
    [labels]
  );

  useEffect(() => {
    onRegisterHandle({
      flyToBody,
      setCameraPreset,
      resetView,
      zoomByFactor,
      orbitByAngles,
      getCameraOffset,
      applySavedOffset,
      invalidateTrails,
      capturePhotoDataUrl,
    });
  }, [
    onRegisterHandle,
    flyToBody,
    setCameraPreset,
    resetView,
    zoomByFactor,
    orbitByAngles,
    getCameraOffset,
    applySavedOffset,
    invalidateTrails,
    capturePhotoDataUrl,
  ]);

  // Refit camera when scaleMode changes while preserving target and simulation time (Section 19)
  useEffect(() => {
    const cs = camStateRef.current;
    const targetId =
      cameraMode === 'overview' ? 'sun' : selectedBodyId || cs.targetBodyId || 'earth';
    if (!cs.isTransitioning) {
      cs.targetBodyId = targetId;
      cs.destTargetId = targetId;
    }
    const newRadius = computeIdealFramingRadius(targetId, cameraMode);
    cs.sphericalRadius = newRadius;
  }, [preferences.scaleMode, cameraMode, selectedBodyId, computeIdealFramingRadius]);

  // Main Three.js scene initialization & single authoritative loop
  useEffect(() => {
    const container = canvasHostRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: preferences.qualityPreset !== 'low',
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
    } catch {
      setWebglError(
        'Não foi possível inicializar o contexto WebGL 3D neste navegador. O modo explorador de catálogo, tabelas, laboratórios e diagramas permanece totalmente funcional.'
      );
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const maxDpr = preferences.qualityPreset === 'low' ? 1.0 : 1.75;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored, false);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#040711');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      46,
      (container.clientWidth || 800) / Math.max(1, container.clientHeight || 600),
      0.04,
      9000
    );
    cameraRef.current = camera;

    // Seeded distant starfield
    const starfield = createSeededStarfield(424242);
    scene.add(starfield);

    // Primary Solar PointLight + Ambient assistance light
    const sunPointLight = new THREE.PointLight(0xfff8eb, 2.75, 0, 0.0);
    sunPointLight.position.set(0, 0, 0);
    scene.add(sunPointLight);

    const ambientLight = new THREE.AmbientLight(0x9bb8ff, 0.32);
    scene.add(ambientLight);

    // Optional Scientific Overlays Group (Ecliptic Grid & Cardinal J2000 Axes)
    const eclipticGrid = new THREE.PolarGridHelper(180, 16, 12, 96, 0x1e3a5f, 0x0f243d);
    eclipticGrid.visible = false;
    scene.add(eclipticGrid);

    const cardinalGroup = new THREE.Group();
    const xAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-185, 0, 0),
      new THREE.Vector3(185, 0, 0),
    ]);
    const zAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, -185),
      new THREE.Vector3(0, 0, 185),
    ]);
    const yAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -60, 0),
      new THREE.Vector3(0, 60, 0),
    ]);
    cardinalGroup.add(
      new THREE.Line(
        xAxisGeo,
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 })
      ),
      new THREE.Line(
        zAxisGeo,
        new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.35 })
      ),
      new THREE.Line(
        yAxisGeo,
        new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.45 })
      )
    );
    cardinalGroup.visible = false;
    scene.add(cardinalGroup);

    // Build Body Rigs, Orbit Paths, Motion Trails, Velocity Arrows, Perihelion/Aphelion Markers
    const rigs: Record<string, BodyRenderRig> = {};
    const orbitLines: Record<string, THREE.Line> = {};
    const trailLines: Record<string, THREE.Line> = {};
    const velocityArrows: Record<string, THREE.ArrowHelper> = {};
    const apsidesGroups: Record<string, { peri: THREE.Mesh; aphe: THREE.Mesh }> = {};

    const orbitsGroup = new THREE.Group();
    scene.add(orbitsGroup);

    const trailsGroup = new THREE.Group();
    scene.add(trailsGroup);

    for (const body of CELESTIAL_CATALOG) {
      if (body.simulationTier === 'simulated') {
        const rig = createBodyRenderRig(
          body,
          latestPropsRef.current.preferences.qualityPreset,
          latestPropsRef.current.preferences.presentationMode,
          latestPropsRef.current.preferences.venusSurfaceRadarMode
        );
        rigs[body.id] = rig;
        scene.add(rig.rootGroup);
      }

      if (body.orbit) {
        const orbitGeo = new THREE.BufferGeometry();
        const orbitColor =
          body.category === 'planet'
            ? body.visual.primaryColor
            : body.category === 'dwarf_planet'
              ? '#a78bfa'
              : body.category === 'moon'
                ? '#64748b'
                : '#38bdf8';
        const orbitMat = new THREE.LineBasicMaterial({
          color: new THREE.Color(orbitColor),
          transparent: true,
          opacity: body.category === 'planet' ? 0.38 : 0.24,
        });
        const line = new THREE.Line(orbitGeo, orbitMat);
        orbitsGroup.add(line);
        orbitLines[body.id] = line;

        // Motion trail line
        const trailGeo = new THREE.BufferGeometry();
        const trailMat = new THREE.LineBasicMaterial({
          color: new THREE.Color(body.visual.accentColor || orbitColor),
          transparent: true,
          opacity: 0.78,
        });
        const trailLine = new THREE.Line(trailGeo, trailMat);
        trailsGroup.add(trailLine);
        trailLines[body.id] = trailLine;

        // Velocity arrow helper
        const arrow = new THREE.ArrowHelper(
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(0, 0, 0),
          4,
          0x34d399,
          0.9,
          0.5
        );
        arrow.visible = false;
        scene.add(arrow);
        velocityArrows[body.id] = arrow;

        // Perihelion & Aphelion markers for heliocentric bodies
        if (body.category !== 'moon') {
          const periGeo = new THREE.SphereGeometry(0.32, 10, 10);
          const periMesh = new THREE.Mesh(
            periGeo,
            new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
          );
          const apheMesh = new THREE.Mesh(
            periGeo,
            new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
          );
          periMesh.visible = false;
          apheMesh.visible = false;
          scene.add(periMesh, apheMesh);
          apsidesGroups[body.id] = { peri: periMesh, aphe: apheMesh };
        }
      }
    }

    rigsRef.current = rigs;
    orbitLinesRef.current = orbitLines;
    trailLinesRef.current = trailLines;

    // Selection Bracket Halo
    const selectionRingGeo = new THREE.RingGeometry(1.24, 1.275, 64);
    const selectionRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
      depthTest: false,
    });
    const selectionBracket = new THREE.Mesh(selectionRingGeo, selectionRingMat);
    scene.add(selectionBracket);

    // Distance Ruler Line & Light Pulse Sphere (Section 31)
    const rulerGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const rulerMat = new THREE.LineDashedMaterial({
      color: 0xfbbf24,
      dashSize: 1.5,
      gapSize: 0.8,
      transparent: true,
      opacity: 0.92,
    });
    const rulerLine = new THREE.Line(rulerGeo, rulerMat);
    rulerLine.visible = false;
    scene.add(rulerLine);

    const pulseGeo = new THREE.SphereGeometry(0.55, 16, 16);
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const lightPulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
    lightPulseMesh.visible = false;
    scene.add(lightPulseMesh);

    // Asteroid Belt and Kuiper Belt point clouds
    let asteroidBeltPoints = createBeltParticleSystem(
      'asteroid_belt',
      latestPropsRef.current.preferences.scaleMode,
      7001
    );
    let kuiperBeltPoints = createBeltParticleSystem(
      'kuiper_belt',
      latestPropsRef.current.preferences.scaleMode,
      7002
    );
    scene.add(asteroidBeltPoints, kuiperBeltPoints);

    // ResizeObserver for responsive viewport (Section 44 & 56)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(240, Math.floor(entry.contentRect.width));
        const h = Math.max(200, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
    });
    resizeObserver.observe(container);

    // Authoritative animation loop
    let animFrameId = 0;
    let lastLabelUpdateMs = 0;
    let frameCount = 0;
    let lastFpsCheckMs = performance.now();

    const animate = (nowMs: number) => {
      animFrameId = requestAnimationFrame(animate);
      frameCount++;
      if (nowMs - lastFpsCheckMs >= 1000) {
        const measuredFps = Math.round((frameCount * 1000) / (nowMs - lastFpsCheckMs));
        frameCount = 0;
        lastFpsCheckMs = nowMs;
        if (onFpsSample) onFpsSample(measuredFps);
      }

      const {
        simTimeMs: curSimMs,
        bodyStates: curStates,
        selectedBodyId: curSelectedId,
        cameraMode: curCamMode,
        preferences: curPrefs,
        favorites: curFavs,
        measurementEndpoints: curMeasure,
        photoFov: curPhotoFov,
      } = latestPropsRef.current;

      // Update camera FOV if Photo Mode overrides it
      const targetFov = curPhotoFov ?? 46;
      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov = targetFov;
        camera.updateProjectionMatrix();
      }

      // Background & Lighting updates
      scene.background = new THREE.Color(
        curPrefs.cleanBackground ? '#000000' : '#040711'
      );
      starfield.visible = !curPrefs.cleanBackground && curPrefs.backgroundIntensity > 0.02;
      const starPoints = starfield.children[0] as THREE.Points | undefined;
      if (starPoints) {
        (starPoints.material as THREE.PointsMaterial).opacity =
          curPrefs.backgroundIntensity * 0.92;
      }

      ambientLight.intensity = curPrefs.ambientExposure;
      eclipticGrid.visible = curPrefs.showEclipticGrid;
      cardinalGroup.visible = curPrefs.showCardinalIndicators;

      // Rebuild orbit paths & belts if scaleMode changed
      const scaleKey = `${curPrefs.scaleMode}`;
      if (lastOrbitScaleModeRef.current !== scaleKey) {
        lastOrbitScaleModeRef.current = scaleKey;
        scene.remove(asteroidBeltPoints, kuiperBeltPoints);
        asteroidBeltPoints.geometry.dispose();
        kuiperBeltPoints.geometry.dispose();
        asteroidBeltPoints = createBeltParticleSystem('asteroid_belt', curPrefs.scaleMode, 7001);
        kuiperBeltPoints = createBeltParticleSystem('kuiper_belt', curPrefs.scaleMode, 7002);
        scene.add(asteroidBeltPoints, kuiperBeltPoints);

        // Rebuild heliocentric orbit geometries
        for (const body of CELESTIAL_CATALOG) {
          if (body.orbit && body.category !== 'moon' && orbitLines[body.id]) {
            const pts = sampleOrbitDisplayPath(body, curSimMs, curPrefs.scaleMode);
            orbitLines[body.id].geometry.setFromPoints(
              pts.map((p) => new THREE.Vector3(p.x, p.y, p.z))
            );
          }
          // Update perihelion / aphelion positions
          if (body.orbit && body.category !== 'moon' && apsidesGroups[body.id]) {
            const pSpec = { ...body.orbit, L0: body.orbit.longPeri0, LDot: 0 };
            const aSpec = { ...body.orbit, L0: body.orbit.longPeri0 + 180, LDot: 0 };
            const pEval = evaluateKeplerianOrbitAtTime(pSpec, curSimMs);
            const aEval = evaluateKeplerianOrbitAtTime(aSpec, curSimMs);
            const pDist =
              curPrefs.scaleMode === 'exploration'
                ? mapHeliocentricAuToExplorationUnits(pEval.radius)
                : pEval.radius * RELATIVE_SCALE_UNITS_PER_AU;
            const aDist =
              curPrefs.scaleMode === 'exploration'
                ? mapHeliocentricAuToExplorationUnits(aEval.radius)
                : aEval.radius * RELATIVE_SCALE_UNITS_PER_AU;
            const pVec = eclipticToThreeVector({
              x: (pEval.position.x / Math.max(1e-6, pEval.radius)) * pDist,
              y: (pEval.position.y / Math.max(1e-6, pEval.radius)) * pDist,
              z: (pEval.position.z / Math.max(1e-6, pEval.radius)) * pDist,
            });
            const aVec = eclipticToThreeVector({
              x: (aEval.position.x / Math.max(1e-6, aEval.radius)) * aDist,
              y: (aEval.position.y / Math.max(1e-6, aEval.radius)) * aDist,
              z: (aEval.position.z / Math.max(1e-6, aEval.radius)) * aDist,
            });
            apsidesGroups[body.id].peri.position.set(pVec.x, pVec.y, pVec.z);
            apsidesGroups[body.id].aphe.position.set(aVec.x, aVec.y, aVec.z);
          }
        }
      }

      asteroidBeltPoints.visible = curPrefs.showAsteroidBelt;
      kuiperBeltPoints.visible = curPrefs.showKuiperBelt;

      // Update each body's rig position, radius, spin, and overlays
      const selectedBody = CATALOG_BY_ID[curSelectedId];
      const selectedSystemParentId =
        selectedBody?.category === 'moon' ? selectedBody.parentId : selectedBody?.id;

      for (const body of CELESTIAL_CATALOG) {
        const st = curStates[body.id];
        const rig = rigs[body.id];
        if (!st || !rig) continue;

        rig.rootGroup.position.set(
          st.displayPosition.x,
          st.displayPosition.y,
          st.displayPosition.z
        );
        rig.tiltGroup.scale.setScalar(st.displayRadius);
        rig.spinMesh.rotation.y = st.spinAngleRad;
        if (rig.cloudsMesh) {
          rig.cloudsMesh.rotation.y = st.spinAngleRad * 1.06;
        }

        // Update Earth's night-side lights direction to the Sun
        if (body.id === 'earth' && rig.nightLightsMesh) {
          const sunDir = new THREE.Vector3(
            -st.displayPosition.x,
            -st.displayPosition.y,
            -st.displayPosition.z
          ).normalize();
          const mat = rig.nightLightsMesh.material as THREE.ShaderMaterial;
          mat.uniforms.sunDirWorld.value.copy(sunDir);
        }

        // Update Axial Arrow visibility
        if (rig.axialArrow) {
          rig.axialArrow.visible = curPrefs.showAxialArrows;
        }

        // Update Tidal-Locking overlay for moons
        if (rig.tidalLockArrow && body.parentId && curStates[body.parentId]) {
          rig.tidalLockArrow.visible = curPrefs.showTidalLockingOverlay;
          rig.tidalLockArrow.scale.setScalar(st.displayRadius);
          const parentPos = curStates[body.parentId].displayPosition;
          const dx = parentPos.x - st.displayPosition.x;
          const dz = parentPos.z - st.displayPosition.z;
          rig.tidalLockArrow.rotation.y = Math.atan2(-dz, dx);
        }

        // Update Comet coma & tails (ion tail strictly anti-sunward, dust tail curved)
        if (body.id === 'halley_model' && rig.cometGroup) {
          const rAu = Math.max(0.4, st.sunDistanceAu);
          // Educational activity intensity I ~ (1.5 / rAu)^1.4 clamped
          const activity = Math.max(0.12, Math.min(2.2, Math.pow(1.8 / rAu, 1.15)));
          const antiSolarDir = new THREE.Vector3(
            st.displayPosition.x,
            st.displayPosition.y,
            st.displayPosition.z
          ).normalize();

          rig.cometGroup.scale.setScalar(st.displayRadius * (0.8 + activity * 0.7));
          rig.cometGroup.lookAt(
            st.displayPosition.x + antiSolarDir.x * 10,
            st.displayPosition.y + antiSolarDir.y * 10,
            st.displayPosition.z + antiSolarDir.z * 10
          );
          if (rig.dustTailMesh) {
            rig.dustTailMesh.rotation.y = 0.24; // Curved away from anti-solar vector
          }
        }

        // Update moon orbit path around moving parent
        if (body.category === 'moon' && body.parentId && orbitLines[body.id]) {
          const parentSt = curStates[body.parentId];
          if (parentSt) {
            const pts = sampleOrbitDisplayPath(
              body,
              curSimMs,
              curPrefs.scaleMode,
              parentSt.displayPosition,
              64
            );
            orbitLines[body.id].geometry.setFromPoints(
              pts.map((p) => new THREE.Vector3(p.x, p.y, p.z))
            );
          }
        }

        // Orbit path visibility rules (Section 28)
        const oLine = orbitLines[body.id];
        if (oLine) {
          if (curPrefs.orbitMode === 'none') {
            oLine.visible = false;
          } else if (curPrefs.orbitMode === 'selected') {
            oLine.visible = body.id === curSelectedId;
          } else if (curPrefs.orbitMode === 'selected_system') {
            oLine.visible =
              body.id === selectedSystemParentId || body.parentId === selectedSystemParentId;
          } else {
            // 'all': show planets, dwarf planets, small bodies, and moons of the selected system
            oLine.visible =
              body.category !== 'moon' || body.parentId === selectedSystemParentId;
          }
        }

        // Velocity Vector overlay
        const vArrow = velocityArrows[body.id];
        if (vArrow) {
          const showVel =
            curPrefs.showVelocityVectors &&
            (body.category === 'planet' || body.id === curSelectedId);
          vArrow.visible = showVel;
          if (showVel) {
            vArrow.position.set(
              st.displayPosition.x,
              st.displayPosition.y,
              st.displayPosition.z
            );
            const vThree = eclipticToThreeVector(st.velocityVectorAuPerDay);
            const vVec = new THREE.Vector3(vThree.x, vThree.y, vThree.z);
            if (vVec.lengthSq() > 1e-10) {
              vVec.normalize();
              vArrow.setDirection(vVec);
              const arrowLen = Math.max(
                st.displayRadius * 2.2,
                Math.min(14, st.orbitalVelocityKms * 0.25)
              );
              vArrow.setLength(arrowLen, arrowLen * 0.24, arrowLen * 0.14);
            }
          }
        }

        // Perihelion & Aphelion markers visibility
        if (apsidesGroups[body.id]) {
          const showAp =
            curPrefs.showPerihelionAphelion &&
            (body.id === curSelectedId || body.category === 'planet');
          apsidesGroups[body.id].peri.visible = showAp;
          apsidesGroups[body.id].aphe.visible = showAp;
        }
      }

      // Motion Trails sampling with discontinuous jump detection (Section 28)
      const simDeltaDays = Math.abs(curSimMs - lastTrailSampleSimMsRef.current) / 86400000;
      if (simDeltaDays > 180) {
        // Discontinuous jump detected -> clear stale trails so no false line bridges centuries!
        trailHistoryRef.current = {};
        lastTrailSampleSimMsRef.current = curSimMs;
      } else if (curPrefs.showTrails && simDeltaDays >= 0.15) {
        lastTrailSampleSimMsRef.current = curSimMs;
        for (const body of CELESTIAL_CATALOG) {
          if (!body.orbit || !curStates[body.id]) continue;
          const pos = curStates[body.id].displayPosition;
          const arr = trailHistoryRef.current[body.id] ?? [];
          arr.push({ x: pos.x, y: pos.y, z: pos.z });
          if (arr.length > 90) arr.shift();
          trailHistoryRef.current[body.id] = arr;
        }
      }

      for (const body of CELESTIAL_CATALOG) {
        const tLine = trailLines[body.id];
        if (!tLine) continue;
        tLine.visible = curPrefs.showTrails;
        if (curPrefs.showTrails) {
          const hist = trailHistoryRef.current[body.id] ?? [];
          const curPos = curStates[body.id]?.displayPosition;
          const pts = curPos ? [...hist, curPos] : hist;
          tLine.geometry.setFromPoints(pts.map((p) => new THREE.Vector3(p.x, p.y, p.z)));
        }
      }

      // Distance Ruler & Light Pulse (Section 31)
      if (
        curMeasure &&
        curStates[curMeasure.fromId] &&
        curStates[curMeasure.toId]
      ) {
        const pFrom = curStates[curMeasure.fromId].displayPosition;
        const pTo = curStates[curMeasure.toId].displayPosition;
        const vFrom = new THREE.Vector3(pFrom.x, pFrom.y, pFrom.z);
        const vTo = new THREE.Vector3(pTo.x, pTo.y, pTo.z);
        rulerLine.visible = true;
        rulerLine.geometry.setFromPoints([vFrom, vTo]);
        rulerLine.computeLineDistances();

        if (curMeasure.pulseProgress !== null && curMeasure.pulseProgress >= 0) {
          lightPulseMesh.visible = true;
          lightPulseMesh.position.lerpVectors(
            vFrom,
            vTo,
            Math.max(0, Math.min(1, curMeasure.pulseProgress))
          );
        } else {
          lightPulseMesh.visible = false;
        }
      } else {
        rulerLine.visible = false;
        lightPulseMesh.visible = false;
      }

      // Update camera position & target tracking (Section 21)
      const cs = camStateRef.current;
      const targetState = curStates[cs.destTargetId] ?? curStates[curSelectedId] ?? curStates.sun;
      const liveTargetPos = targetState
        ? new THREE.Vector3(
            targetState.displayPosition.x,
            targetState.displayPosition.y,
            targetState.displayPosition.z
          )
        : new THREE.Vector3(0, 0, 0);

      if (cs.isTransitioning) {
        const elapsed = nowMs - cs.transitionStartMs;
        const rawT = Math.min(1, elapsed / Math.max(1, cs.transitionDurationMs));
        // Cubic ease-in-out
        const ease = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

        cs.lookAtPos.lerpVectors(cs.startLookAt, liveTargetPos, ease);
        cs.sphericalRadius =
          cs.startRadius + (cs.destRadius - cs.startRadius) * ease;
        cs.sphericalTheta =
          cs.startTheta + (cs.destTheta - cs.startTheta) * ease;
        cs.sphericalPhi = cs.startPhi + (cs.destPhi - cs.startPhi) * ease;

        if (rawT >= 1) {
          cs.isTransitioning = false;
        }
      } else if (curCamMode !== 'free') {
        cs.lookAtPos.copy(liveTargetPos).add(cs.panOffset);
      }

      const sinPhi = Math.sin(cs.sphericalPhi);
      const camX =
        cs.lookAtPos.x + cs.sphericalRadius * sinPhi * Math.cos(cs.sphericalTheta);
      const camY = cs.lookAtPos.y + cs.sphericalRadius * Math.cos(cs.sphericalPhi);
      const camZ =
        cs.lookAtPos.z + cs.sphericalRadius * sinPhi * Math.sin(cs.sphericalTheta);

      camera.position.set(camX, camY, camZ);
      camera.lookAt(cs.lookAtPos);

      // Keep distant starfield centered on camera so stars never exhibit near-field parallax
      starfield.position.copy(camera.position);

      // Update Selection Bracket (hidden during Photo Mode for clean photography)
      const selState = curStates[curSelectedId];
      if (selState && latestPropsRef.current.photoFov === undefined) {
        selectionBracket.visible = true;
        selectionBracket.position.set(
          selState.displayPosition.x,
          selState.displayPosition.y,
          selState.displayPosition.z
        );
        const distToCam = camera.position.distanceTo(selectionBracket.position);
        const minBracketScale = distToCam * 0.016;
        selectionBracket.scale.setScalar(
          Math.max(selState.displayRadius * 1.18, minBracketScale)
        );
        selectionBracket.lookAt(camera.position);
      } else {
        selectionBracket.visible = false;
      }

      renderer.render(scene, camera);

      // Priority-aware 2D label projection & overlap management (throttled to ~20 Hz for crisp UI performance)
      if (nowMs - lastLabelUpdateMs > 50) {
        lastLabelUpdateMs = nowMs;
        if (curPrefs.labelMode === 'none') {
          setLabels([]);
        } else {
          const w = container.clientWidth || 800;
          const h = container.clientHeight || 600;
          const candidates: ProjectedLabelItem[] = [];
          const projVec = new THREE.Vector3();

          for (const body of CELESTIAL_CATALOG) {
            const st = curStates[body.id];
            if (!st) continue;

            // Filter by labelMode
            const isSelected = body.id === curSelectedId;
            const isMeasureEndpoint =
              curMeasure?.fromId === body.id || curMeasure?.toId === body.id;
            const isFav = curFavs.includes(body.id);
            const isInSelectedSystem =
              body.id === selectedSystemParentId ||
              body.parentId === selectedSystemParentId;

            let allowLabel = false;
            if (isSelected || isMeasureEndpoint) {
              allowLabel = true;
            } else if (curPrefs.labelMode === 'selected') {
              allowLabel = isSelected;
            } else if (curPrefs.labelMode === 'favorites') {
              allowLabel = isFav;
            } else if (curPrefs.labelMode === 'selected_system') {
              allowLabel = isInSelectedSystem;
            } else if (curPrefs.labelMode === 'major') {
              if (body.category === 'star' || body.category === 'planet') {
                allowLabel = true;
              } else if (body.category === 'dwarf_planet') {
                allowLabel = curPrefs.labelDensity !== 'compact' || body.id === 'pluto';
              } else if (body.category === 'moon') {
                // Show moon labels when close to parent or when parent system is selected
                allowLabel = isInSelectedSystem || body.id === 'moon';
              } else if (body.id === 'vesta' || body.id === 'halley_model') {
                allowLabel = curPrefs.labelDensity === 'detailed';
              }
            }

            if (!allowLabel) continue;

            const worldPos = new THREE.Vector3(
              st.displayPosition.x,
              st.displayPosition.y,
              st.displayPosition.z
            );
            projVec.copy(worldPos).project(camera);
            if (projVec.z < -1 || projVec.z > 1) continue; // Behind camera or clip plane

            const sx = (projVec.x * 0.5 + 0.5) * w;
            const sy = (-projVec.y * 0.5 + 0.5) * h;
            if (sx < 16 || sx > w - 16 || sy < 16 || sy > h - 16) continue;

            const distToCam = camera.position.distanceTo(worldPos);
            const apparentRadiusPx =
              (st.displayRadius / Math.max(0.1, distToCam)) * (h * 0.85);
            const isSubpixel = apparentRadiusPx < 3.2;

            // Check simple occlusion by parent planet for moons
            let isOccluded = false;
            if (body.category === 'moon' && body.parentId && curStates[body.parentId]) {
              const pSt = curStates[body.parentId];
              const pWorld = new THREE.Vector3(
                pSt.displayPosition.x,
                pSt.displayPosition.y,
                pSt.displayPosition.z
              );
              const parentDistToCam = camera.position.distanceTo(pWorld);
              if (distToCam > parentDistToCam) {
                const pProj = pWorld.clone().project(camera);
                const px = (pProj.x * 0.5 + 0.5) * w;
                const py = (-pProj.y * 0.5 + 0.5) * h;
                const parentPxRadius =
                  (pSt.displayRadius / Math.max(0.1, parentDistToCam)) * (h * 0.85);
                if (Math.hypot(sx - px, sy - py) < parentPxRadius * 0.95) {
                  isOccluded = true;
                }
              }
            }

            const priority = isSelected
              ? 100
              : isMeasureEndpoint
                ? 95
                : body.id === selectedSystemParentId
                  ? 90
                  : body.category === 'star'
                    ? 85
                    : body.category === 'planet'
                      ? 75
                      : isFav
                        ? 65
                        : body.category === 'dwarf_planet'
                          ? 55
                          : 40;

            candidates.push({
              id: body.id,
              name: body.name[curPrefs.language],
              category: body.category,
              x: sx,
              y: sy - Math.min(28, Math.max(10, apparentRadiusPx + 8)),
              priority,
              isSelected,
              isSubpixel,
              isOccluded,
              color: body.visual.primaryColor,
            });
          }

          // Sort by priority descending and suppress overlapping lower-priority labels (Section 23)
          candidates.sort((a, b) => b.priority - a.priority);
          const accepted: ProjectedLabelItem[] = [];
          const minSepX = curPrefs.labelDensity === 'compact' ? 92 : 72;
          const minSepY = curPrefs.labelDensity === 'compact' ? 28 : 22;

          for (const cand of candidates) {
            if (cand.isSelected) {
              accepted.push(cand);
              continue;
            }
            const overlaps = accepted.some(
              (acc) =>
                Math.abs(acc.x - cand.x) < minSepX &&
                Math.abs(acc.y - cand.y) < minSepY
            );
            if (!overlaps) {
              accepted.push(cand);
            }
          }
          setLabels(accepted);
        }
      }
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      renderer.dispose();
    };
  }, [
    preferences.qualityPreset,
    preferences.presentationMode,
    preferences.venusSurfaceRadarMode,
    onFpsSample,
  ]);

  // Pointer & Touch gesture handling (Orbit, Pan, Pinch Zoom, Click/Tap Picking with Movement Threshold & Disambiguation)
  const pointerStateRef = useRef<{
    activePointers: Map<number, { x: number; y: number }>;
    downX: number;
    downY: number;
    movedDistance: number;
    lastPinchDist: number | null;
    isPanGesture: boolean;
  }>({
    activePointers: new Map(),
    downX: 0,
    downY: 0,
    movedDistance: 0,
    lastPinchDist: null,
    isPanGesture: false,
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-ui-overlay="true"]')) return;
    setDisambiguation(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    const ps = pointerStateRef.current;
    ps.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ps.activePointers.size === 1) {
      ps.downX = e.clientX;
      ps.downY = e.clientY;
      ps.movedDistance = 0;
      ps.isPanGesture = e.button === 2 || e.shiftKey;
    } else if (ps.activePointers.size === 2) {
      const pts = Array.from(ps.activePointers.values());
      ps.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ps = pointerStateRef.current;
    const prev = ps.activePointers.get(e.pointerId);
    if (!prev) return;

    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    ps.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    ps.movedDistance += Math.hypot(dx, dy);

    if (ps.movedDistance > 6) {
      // Cancel any active scripted transition cleanly on manual drag (Section 21)
      camStateRef.current.isTransitioning = false;
      onManualCameraGesture();
    }

    const cs = camStateRef.current;
    if (ps.activePointers.size === 1) {
      if (ps.isPanGesture) {
        const panScale = cs.sphericalRadius * 0.0015;
        const right = new THREE.Vector3(
          -Math.sin(cs.sphericalTheta),
          0,
          Math.cos(cs.sphericalTheta)
        );
        const up = new THREE.Vector3(0, 1, 0);
        cs.panOffset.addScaledVector(right, -dx * panScale);
        cs.panOffset.addScaledVector(up, dy * panScale);
        cs.lookAtPos.addScaledVector(right, -dx * panScale);
        cs.lookAtPos.addScaledVector(up, dy * panScale);
      } else {
        cs.sphericalTheta += dx * 0.0055;
        cs.sphericalPhi = Math.max(
          0.06,
          Math.min(Math.PI - 0.06, cs.sphericalPhi - dy * 0.0055)
        );
      }
    } else if (ps.activePointers.size === 2) {
      const pts = Array.from(ps.activePointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (ps.lastPinchDist && ps.lastPinchDist > 10) {
        const ratio = ps.lastPinchDist / Math.max(10, dist);
        cs.sphericalRadius = Math.max(0.45, Math.min(2400, cs.sphericalRadius * ratio));
      }
      ps.lastPinchDist = dist;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const ps = pointerStateRef.current;
    ps.activePointers.delete(e.pointerId);
    if (ps.activePointers.size < 2) {
      ps.lastPinchDist = null;
    }

    // Distinguish click/tap from camera drag using 6px movement threshold (Section 22)
    if (ps.movedDistance < 6 && e.button === 0 && containerRef.current && cameraRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const w = rect.width;
      const h = rect.height;
      const camera = cameraRef.current;
      const curStates = latestPropsRef.current.bodyStates;
      const lang = latestPropsRef.current.preferences.language;

      const hits: Array<{ id: string; distPx: number; body: CelestialBodyData }> = [];
      const proj = new THREE.Vector3();

      for (const body of CELESTIAL_CATALOG) {
        if (body.simulationTier !== 'simulated') continue;
        const st = curStates[body.id];
        if (!st) continue;
        const worldPos = new THREE.Vector3(
          st.displayPosition.x,
          st.displayPosition.y,
          st.displayPosition.z
        );
        proj.copy(worldPos).project(camera);
        if (proj.z < -1 || proj.z > 1) continue;
        const sx = (proj.x * 0.5 + 0.5) * w;
        const sy = (-proj.y * 0.5 + 0.5) * h;

        const distToCam = camera.position.distanceTo(worldPos);
        const apparentRadiusPx = (st.displayRadius / Math.max(0.1, distToCam)) * (h * 0.85);
        const tolerancePx = Math.max(18, Math.min(54, apparentRadiusPx + 10));
        const dPx = Math.hypot(clickX - sx, clickY - sy);
        if (dPx <= tolerancePx) {
          hits.push({ id: body.id, distPx: dPx, body });
        }
      }

      if (hits.length === 1) {
        onSelectBody(hits[0].id, false);
      } else if (hits.length > 1) {
        // Sort by screen proximity; if top candidates are close in projection, offer disambiguation (Section 22)
        hits.sort((a, b) => a.distPx - b.distPx);
        setDisambiguation({
          x: Math.min(w - 220, Math.max(16, clickX)),
          y: Math.min(h - 180, Math.max(16, clickY)),
          candidates: hits.slice(0, 5).map((hItem) => ({
            id: hItem.id,
            name: hItem.body.name[lang],
            subtype: hItem.body.subtype[lang],
          })),
        });
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-ui-overlay="true"]')) return;
    const cs = camStateRef.current;
    cs.isTransitioning = false;
    const factor = e.deltaY > 0 ? 1.12 : 0.89;
    cs.sphericalRadius = Math.max(0.45, Math.min(2400, cs.sphericalRadius * factor));
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-ui-overlay="true"]')) return;
    if (selectedBodyId) {
      onSelectBody(selectedBodyId, true);
    }
  };

  const lang: Language = preferences.language;

  if (webglError) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-100"
        role="region"
        aria-label={lang === 'pt-BR' ? 'Aviso de Modo de Recuperação 2D' : '2D Fallback Explorer Notice'}
      >
        <div className="max-w-lg p-6 rounded-2xl bg-slate-900/90 border border-amber-500/40 shadow-xl">
          <h2 className="text-lg font-semibold text-amber-300 mb-2">
            {lang === 'pt-BR'
              ? 'Visualização 3D Interativa Indisponível — Explorador Esquemático Ativo'
              : 'Interactive 3D View Unavailable — Schematic Explorer Active'}
          </h2>
          <p className="text-sm text-slate-300 mb-4">{webglError}</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {CELESTIAL_CATALOG.slice(0, 10).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onSelectBody(b.id, false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  selectedBodyId === b.id
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {b.name[lang]}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
      tabIndex={0}
      role="application"
      aria-label={
        lang === 'pt-BR'
          ? 'Cena 3D Interativa do Sistema Solar. Use as setas para orbitar a câmera, + e - para zoom, ou selecione corpos no navegador.'
          : 'Interactive 3D Solar System Scene. Use arrow keys to orbit camera, + and - to zoom, or select bodies in the navigator.'
      }
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          orbitByAngles(-0.08, 0);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          orbitByAngles(0.08, 0);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          orbitByAngles(0, -0.08);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          orbitByAngles(0, 0.08);
        } else if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          zoomByFactor(0.86);
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          zoomByFactor(1.16);
        }
      }}
      className="relative w-full h-full overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
      style={{ touchAction: 'none' }}
    >
      {/* Dedicated WebGL Canvas Host */}
      <div ref={canvasHostRef} className="absolute inset-0 w-full h-full" />

      {/* Priority-aware 2D Screen-space Labels & Subpixel Locator Markers */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" data-ui-overlay="true">
        {labels.map((lbl) => (
          <button
            key={lbl.id}
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onSelectBody(lbl.id, false);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onSelectBody(lbl.id, true);
            }}
            style={{
              transform: `translate3d(${Math.round(lbl.x)}px, ${Math.round(lbl.y)}px, 0) translate(-50%, -50%)`,
            }}
            className={`pointer-events-auto absolute flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-opacity duration-150 ${
              lbl.isOccluded ? 'opacity-35' : 'opacity-95'
            } ${
              preferences.highContrastLabels
                ? 'bg-black text-white border-2 border-yellow-300 shadow-lg'
                : lbl.isSelected
                  ? 'bg-sky-950/90 text-sky-100 border border-sky-400 shadow-md shadow-sky-950/50'
                  : 'bg-slate-950/80 text-slate-200 border border-slate-700/70 hover:border-sky-400/70 hover:text-white'
            }`}
          >
            {lbl.isSubpixel && (
              <span
                className="inline-block w-2 h-2 rounded-full ring-2 ring-sky-400/60"
                style={{ backgroundColor: lbl.color }}
                title={
                  lang === 'pt-BR'
                    ? 'Marcador de localização (disco real é subpixel nesta escala)'
                    : 'Locator marker (true disk is subpixel at this scale)'
                }
              />
            )}
            <span>{lbl.name}</span>
          </button>
        ))}
      </div>

      {/* Overlapping-objects Disambiguation Menu (Section 22) */}
      {disambiguation && (
        <div
          data-ui-overlay="true"
          style={{ left: disambiguation.x, top: disambiguation.y }}
          className="absolute z-30 w-56 rounded-xl bg-slate-900/95 border border-sky-400/50 shadow-2xl p-2 backdrop-blur-md"
          role="menu"
          aria-label={
            lang === 'pt-BR' ? 'Escolher corpo sobreposto' : 'Choose overlapping body'
          }
        >
          <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-sky-300">
            <span>
              {lang === 'pt-BR' ? 'Objetos Próximos' : 'Overlapping Bodies'}
            </span>
            <button
              type="button"
              onClick={() => setDisambiguation(null)}
              className="text-slate-400 hover:text-white px-1"
              aria-label={lang === 'pt-BR' ? 'Fechar lista' : 'Close list'}
            >
              ✕
            </button>
          </div>
          <div className="mt-1 flex flex-col gap-1">
            {disambiguation.candidates.map((cand) => (
              <button
                key={cand.id}
                type="button"
                onClick={() => {
                  onSelectBody(cand.id, false);
                  setDisambiguation(null);
                }}
                className="flex flex-col items-start px-2.5 py-1.5 rounded-lg text-left hover:bg-sky-500/20 transition"
              >
                <span className="text-xs font-semibold text-slate-100">{cand.name}</span>
                <span className="text-[10px] text-slate-400">{cand.subtype}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* WebGL Context Lost Recovery Banner (Section 51) */}
      {contextLost && (
        <div
          data-ui-overlay="true"
          className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-6"
        >
          <div className="max-w-md rounded-2xl bg-slate-900 border border-amber-500/50 p-5 text-center shadow-2xl">
            <h3 className="text-base font-semibold text-amber-300 mb-2">
              {lang === 'pt-BR'
                ? 'Contexto Gráfico 3D Interrompido'
                : '3D Graphics Context Interrupted'}
            </h3>
            <p className="text-xs text-slate-300 mb-4">
              {lang === 'pt-BR'
                ? 'Seu estado de simulação, data e notas estão preservados. Aguardando restauração do WebGL ou clique abaixo para recarregar o renderizador.'
                : 'Your simulation state, date, and notes are preserved. Waiting for WebGL restoration or click below to reinitialize.'}
            </p>
            <button
              type="button"
              onClick={() => setContextLost(false)}
              className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-semibold text-xs hover:bg-sky-400"
            >
              {lang === 'pt-BR' ? 'Restaurar Visualização' : 'Restore View'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
