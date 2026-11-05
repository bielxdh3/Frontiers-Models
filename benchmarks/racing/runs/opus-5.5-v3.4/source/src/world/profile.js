// Shared cross-section profile rules (used by road mesh, terrain conform and validation).
export const CURB_H = 0.15;          // village sidewalk curb height
export const SHOULDER = { 1: 1.6, 2: 1.4, 3: 2.7, 4: 1.6 }; // shoulder / sidewalk width per zone
export const SHELF_EXTRA = 2.0;       // flat terrain shelf beyond the road mesh edge
export const EXCLUSION = 3.0;         // no objects closer than this to the asphalt edge

function smoothZone(track, s, fn) {
  let v = 0, n = 0;
  for (let k = -6; k <= 6; k++) { v += fn(track.zoneAt(s + k * 1.5)); n++; }
  return v / n;
}
export function curbHeight(track, s) { return smoothZone(track, s, (z) => (z === 3 ? CURB_H : 0)); }
export function shoulderWidth(track, s) { return smoothZone(track, s, (z) => SHOULDER[z]); }
export function shoulderFall(sh) { return 0.025 * (sh - 0.25); }
/** height offset of the road mesh above the banked road plane at horizontal |d| (asphalt = 0) */
export function profileOffset(track, s, ad, hw) {
  if (ad <= hw) return 0;
  const sh = shoulderWidth(track, s);
  const ch = curbHeight(track, s);
  if (ad <= hw + 0.25) return ch;
  const t = Math.min(1, (ad - hw - 0.25) / Math.max(0.01, sh - 0.25));
  return ch - shoulderFall(sh) * t;
}
/** offset used by the terrain conform: never raised under the curb face (grid cannot hold a step) */
export function terrainProfileOffset(track, s, ad, hw) {
  if (ad <= hw + 0.25) return Math.min(0, profileOffset(track, s, ad, hw));
  const sh = shoulderWidth(track, s);
  const ch = curbHeight(track, s);
  const outer = ch - shoulderFall(sh);
  const t = Math.min(1, (ad - hw - 0.25) / Math.max(0.01, sh - 0.25));
  return ch > 0.001 ? outer * t : profileOffset(track, s, ad, hw);
}
