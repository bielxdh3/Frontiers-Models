# Asset attribution

All essential assets are local; the browser does not hotlink textures.

| Asset | Origin | Use / rights | Fallback |
| --- | --- | --- | --- |
| `public/textures/{sun,mercury,venus_atmosphere,earth_daymap,moon,mars,jupiter,saturn,uranus,neptune}.jpg` | [Solar System Scope textures](https://www.solarsystemscope.com/textures/), INOVE | 2048 × 1024 equirectangular sRGB color maps; [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Color adjusted, based on NASA sources, with reconstructed regions. | Seeded body-specific procedural maps. |
| `public/textures/earth_clouds.jpg` | Same collection | 2048 × 1024 opacity map, CC BY 4.0; separate solar-lit cloud layer. | Earth remains usable without clouds. |
| `public/fonts/manrope.woff2` | [Manrope on Google Fonts](https://fonts.google.com/specimen/Manrope) | SIL Open Font License 1.1; bundled for local loading. | Arial / Helvetica / system sans-serif. |
| Lucide icons | [Lucide](https://lucide.dev/license) | ISC license; packaged SVG components. | Controls also carry visible or accessible names. |
| Stars, rings, satellite maps, glow, diagrams, comet trails | Created during this execution | Deterministic procedural educational representations; no assertion of photographic or geographic authority. | Included directly in the application. |

`src/data.js` exports the machine-readable asset manifest, including color role, source URL, resolution, attribution and fallback. The download helper is `scripts/fetch-assets.mjs`. The final bundled images were verified as JPEG files; the initially attempted Node transport failed and the bounded curl download succeeded.
