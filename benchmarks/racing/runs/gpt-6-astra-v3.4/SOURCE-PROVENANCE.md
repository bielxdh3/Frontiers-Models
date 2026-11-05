# GPT-6 Astra — Racing-bench V3.4 source provenance

- Model: **GPT-6 Astra**; this V3.4 attempt is distinct from the earlier V2.6 archive at [../gpt-6-astra/](../gpt-6-astra/).
- Original public repository: [bielxdh3/6-astra](https://github.com/bielxdh3/6-astra).
- Pinned upstream branch and commit: `main` at `daf0099699a0e8201b8bc4f1dca6909f92700b3b`; Git tree `b115486c104e25041bf2116865de91b6c4a31132`.
- Run association: original source README identifies Racing-bench V3.4. The exact original model input and delivery of all 14 visual references have **not** been independently verified; the shared benchmark input is archived at [../../prompts/racing-v3.4/](../../prompts/racing-v3.4/).
- Archived tracked files: **1,183** source Git blobs, **432,577,165 bytes** (exact Git blobs, unaffected by Windows checkout line-ending conversion), preserved byte-for-byte under [source/](./source/) with per-file SHA-256, Git blob hashes, modes and sizes in [SOURCE-FILES.json](./SOURCE-FILES.json). Git history beyond the pinned source commit is not included.
- Included material is whatever the upstream commit tracks, including application source, assets, vendored engine, static build, 3D racing evidence and verification artifacts. Untracked ZIPs, `node_modules`, and other local-only files are not archived.
- Upstream [verification/REPORT.md](./source/verification/REPORT.md) explicitly marks the **integral benchmark FAIL**. The upstream test suite reported **33/34** automated checks passed; the 60 FPS target for High failed (measured High average **55.48 FPS**, 1% low **28.92 FPS**, on RTX 3070 Ti and Ryzen 7 5700G), while Low average was **91.29 FPS**. Visual acceptance gates **P2–P4 were not demonstrated as approved**, and the RTX 3060/integrated-GPU targets were not physically measured. These are upstream-reported results, **not independently rerun or accepted** by Frontier Models.
- The source's [ASSET-LICENSES.md](./source/ASSET-LICENSES.md) records provenance of assets, but specific redistribution rights for user-provided reference visuals and derivatives were not independently checked. The public repository was already available before this archive was made.
- No public game URL was supplied. No production deployment is implied by adding this source run to the current arena.

The source is preserved, not repaired. Any future game or benchmark changes require a separate run/revision, not alteration of this pinned snapshot.
