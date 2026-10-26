export type Language = 'pt-BR' | 'en';

export type BodyCategory =
  | 'star'
  | 'planet'
  | 'moon'
  | 'dwarf_planet'
  | 'small_body'
  | 'region';

export type SimulationTier = 'simulated' | 'schematic' | 'reference';

export type ScaleMode = 'exploration' | 'relative';
export type PresentationMode = 'natural' | 'enhanced';
export type QualityPreset = 'auto' | 'high' | 'balanced' | 'low';
export type WorkspacePreset =
  | 'cinematic'
  | 'classroom'
  | 'detailed_study'
  | 'low_power'
  | 'custom';

export type LabelMode =
  | 'major'
  | 'selected_system'
  | 'selected'
  | 'favorites'
  | 'none';

export type OrbitMode = 'all' | 'selected' | 'selected_system' | 'none';

export type ReferenceFrame = 'sun' | 'earth' | 'local_parent';

export type CameraMode =
  | 'overview'
  | 'focus'
  | 'follow'
  | 'parent_system'
  | 'free'
  | 'preset_top'
  | 'preset_cinematic'
  | 'preset_equatorial'
  | 'preset_polar';

export type TopLevelSection = 'explore' | 'learn' | 'tools' | 'settings';

export type ActiveTool =
  | 'none'
  | 'comparison'
  | 'measurement'
  | 'scale_lab'
  | 'seasons_lab'
  | 'moon_lab'
  | 'orbit_lab'
  | 'outer_system'
  | 'missions'
  | 'tours'
  | 'activities'
  | 'encyclopedia'
  | 'collections'
  | 'photo_mode'
  | 'settings';

export interface LocalizedText {
  'pt-BR': string;
  en: string;
}

export interface SourceReference {
  id: string;
  title: LocalizedText;
  institution: string;
  url: string;
  referenceDate: string;
  note: LocalizedText;
}

export interface AssetManifestEntry {
  id: string;
  bodyId: string;
  role: 'visible_color' | 'enhanced_color' | 'radar_map' | 'topography' | 'procedural_artistic';
  resolution: string;
  attribution: string;
  licenseNote: string;
  fallbackStrategy: LocalizedText;
  description: LocalizedText;
}

/**
 * Keplerian elements either in JPL Table 1 secular rates format (for major planets)
 * or classical elements relative to parent/ecliptic at J2000.0 (JD 2451545.0).
 */
export interface KeplerianOrbitSpec {
  frame: 'heliocentric_ecliptic' | 'parent_equatorial' | 'parent_ecliptic';
  /** Semi-major axis in AU (for heliocentric) or km (if isParentKm is true) */
  a0: number;
  aDot?: number; // per Julian century
  isParentKm?: boolean;
  /** Eccentricity */
  e0: number;
  eDot?: number;
  /** Inclination in degrees */
  I0: number;
  IDot?: number;
  /** Mean longitude in degrees (or mean anomaly M0 if usesMeanAnomaly is true) */
  L0: number;
  LDot?: number; // degrees per Julian century (or derived from periodDays)
  /** Longitude of perihelion in degrees */
  longPeri0: number;
  longPeriDot?: number;
  /** Longitude of ascending node in degrees */
  longNode0: number;
  longNodeDot?: number;
  /** Orbital period in days (sidereal) */
  periodDays: number;
  /** Retrograde orbit indicator for satellites if period isn't already encoded in LDot */
  isRetrogradeOrbit?: boolean;
  /** Supported validity window (ISO years) */
  validStartYear: number;
  validEndYear: number;
  modelNote: LocalizedText;
}

export interface RingBandSpec {
  name: LocalizedText;
  innerRadiusRatio: number; // multiple of planet radius
  outerRadiusRatio: number;
  opacity: number;
  colorHex: string;
}

export interface RingSystemSpec {
  innerRadiusKm: number;
  outerRadiusKm: number;
  bands: RingBandSpec[];
  isFaintEnhancedInNatural?: boolean;
  note: LocalizedText;
}

export interface VisualBodyStyle {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  atmosphereColor?: string;
  atmosphereIntensity?: number;
  roughness: number;
  metalness: number;
  proceduralType:
    | 'star'
    | 'rocky_cratered'
    | 'venus_clouds'
    | 'venus_radar'
    | 'earth_living'
    | 'mars_rusty'
    | 'gas_jupiter'
    | 'gas_saturn'
    | 'ice_uranus'
    | 'ice_neptune'
    | 'icy_moon'
    | 'volcanic_io'
    | 'hazy_titan'
    | 'dwarf_pluto'
    | 'irregular_asteroid'
    | 'comet_active'
    | 'belt_region';
  explorationRadiusUnits: number;
  explorationDistanceUnits: number;
  seed: number;
}

export interface CelestialBodyData {
  id: string;
  name: LocalizedText;
  aliases: string[];
  category: BodyCategory;
  subtype: LocalizedText;
  simulationTier: SimulationTier;
  parentId: string | null;

  /** Physical quantities */
  diameterKm: number;
  diameterDefinition: 'mean_volumetric' | 'equatorial' | 'effective_dimensions' | 'region_extent';
  equatorialRadiusKm: number;
  meanRadiusKm: number;
  dimensionsKm?: string; // e.g., for irregular moons/asteroids like Phobos or Haumea
  massKg: number | null;
  densityGcm3: number | null;
  gravityMs2: number | null;
  gravityDefinition: LocalizedText;
  escapeVelocityKms: number | null;

  /** Rotation & Orientation */
  siderealRotationHours: number | null; // negative if retrograde
  solarDayHours: number | null;
  axialTiltDeg: number | null;
  isTidallyLocked?: boolean;

  /** Orbit summary */
  semiMajorAxisAu: number | null;
  parentDistanceKm: number | null; // for moons
  orbitalPeriodDays: number | null;
  eccentricity: number | null;
  inclinationDeg: number | null;
  orbit?: KeplerianOrbitSpec;

  /** Thermal & Atmosphere */
  meanTempK: number | null;
  tempRangeK?: [number, number];
  tempContext: LocalizedText;

  /** Satellites */
  knownMoons: number | null;
  knownMoonsRefDate: string;
  renderedMoons: number;

  /** Rings */
  rings?: RingSystemSpec;

  /** Visual & Educational */
  visual: VisualBodyStyle;
  summary: LocalizedText;
  keyFacts: LocalizedText[];
  classificationNote?: LocalizedText;
  uncertaintyNote: LocalizedText;
  approximationBadge: LocalizedText;
  sources: SourceReference[];
  assetManifest: AssetManifestEntry;
}

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface EvaluatedBodyState {
  id: string;
  /** Physical heliocentric ecliptic position in AU */
  heliocentricPositionAu: Vector3Like;
  /** Physical parent-relative position in km (for moons) or AU (for heliocentric bodies) */
  parentRelativePositionKm: Vector3Like;
  /** Instantaneous distance from the Sun in AU */
  sunDistanceAu: number;
  /** Instantaneous distance from the Sun in km */
  sunDistanceKm: number;
  /** Instantaneous distance from parent center in km */
  parentDistanceKm: number;
  /** Instantaneous orbital speed in km/s */
  orbitalVelocityKms: number;
  /** Velocity vector in AU/day (heliocentric) */
  velocityVectorAuPerDay: Vector3Like;
  /** Mean anomaly in radians */
  meanAnomalyRad: number;
  /** True anomaly in radians */
  trueAnomalyRad: number;
  /** Eccentric anomaly in radians */
  eccentricAnomalyRad: number;
  /** Current surface spin angle in radians */
  spinAngleRad: number;
  /** Whether current time is within nominal ephemeris validity interval */
  withinValidityWindow: boolean;
  /** Display coordinates in Three.js world space (Y-up) */
  displayPosition: Vector3Like;
  /** Display radius in Three.js world units */
  displayRadius: number;
}

export interface SavedViewpoint {
  id: string;
  title: string;
  targetId: string;
  cameraMode: CameraMode;
  cameraOffset: Vector3Like;
  simTimeMs: number;
  restoreDateOnVisit: boolean;
  scaleMode: ScaleMode;
  labelMode: LabelMode;
  orbitMode: OrbitMode;
  createdAt: string;
}

export interface TimeBookmark {
  id: string;
  title: string;
  simTimeMs: number;
  targetId: string;
  scaleMode: ScaleMode;
  category: 'user' | 'schematic_alignment' | 'model_approximate' | 'historical_event';
  description: LocalizedText;
}

export interface JournalEntry {
  id: string;
  title: string;
  note: string;
  bodyId: string;
  simTimeMs: number;
  measurementSummary?: string;
  screenshotDataUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeasurementRecord {
  id: string;
  fromId: string;
  toId: string;
  observerId?: string;
  simTimeMs: number;
  centerDistanceKm: number;
  surfaceDistanceKm: number;
  distanceAu: number;
  lightTimeSeconds: number;
  angularSeparationDeg?: number;
  isFrozen: boolean;
  timestampIso: string;
}

export interface HypotheticalOrbitPreset {
  id: string;
  name: string;
  centralMassSolar: number;
  semiMajorAxisAu: number;
  eccentricity: number;
  testMassKg: number;
}

export interface UserPreferences {
  language: Language;
  scaleMode: ScaleMode;
  presentationMode: PresentationMode;
  qualityPreset: QualityPreset;
  workspacePreset: WorkspacePreset;
  labelMode: LabelMode;
  labelDensity: 'compact' | 'standard' | 'detailed';
  orbitMode: OrbitMode;
  showTrails: boolean;
  trailDurationDays: number;
  showEclipticGrid: boolean;
  showCardinalIndicators: boolean;
  showPerihelionAphelion: boolean;
  showVelocityVectors: boolean;
  showAxialArrows: boolean;
  showTidalLockingOverlay: boolean;
  showAsteroidBelt: boolean;
  showKuiperBelt: boolean;
  backgroundIntensity: number; // 0 to 1
  cleanBackground: boolean;
  ambientExposure: number; // 0 to 1
  venusSurfaceRadarMode: boolean;
  interfaceSize: 'normal' | 'large';
  panelOpacity: number; // 0.65 to 1.0
  highContrastLabels: boolean;
  reducedMotion: boolean;
  unitSystem: 'metric' | 'familiar';
  backgroundCatchUp: boolean;
  soundEnabled: boolean;
  ambientAudioEnabled: boolean;
  uiSoundEnabled: boolean;
  narrationEnabled: boolean;
  onboardingCompleted: boolean;
}

export interface PersistedStoreV1 {
  schemaVersion: 1;
  preferences: UserPreferences;
  favorites: string[];
  visitedBodies: string[];
  recentBodies: string[];
  discoveryChecklist: {
    visitPlanet: boolean;
    followMoon: boolean;
    reverseTime: boolean;
    compareBodies: boolean;
    inspectScale: boolean;
  };
  savedViewpoints: SavedViewpoint[];
  bookmarks: TimeBookmark[];
  journalEntries: JournalEntry[];
  savedOrbitExperiments: HypotheticalOrbitPreset[];
  completedTours: string[];
  completedActivities: string[];
  activeActivitySequenceId: string | null;
}
