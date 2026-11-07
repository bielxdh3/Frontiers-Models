"""One-time, byte-preserving import of the Gemini 4 Argon Racing V3.4 source.

The original repository is deliberately NEVER linked from Frontiers. The
model's Git commit and tree may be pinned for provenance without an upstream
URL. The complete source is archived locally, including third-party assets.
"""

import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RACING = ROOT / "benchmarks" / "racing"
DEST = RACING / "runs" / "gemini-4-argon-v3.4"
EXPECTED_COMMIT = "88632a836928ac314ab0e26b492d5360382b980f"
EXPECTED_TREE = "22f7d5a2fae93ea3e92d67a37a4ea23d0bb6e5d8"
SITE = "https://racing-gemini-4-argon.biel.dev.br/"
SOURCE = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else None

def git(*args):
    return subprocess.check_output(["git", "-C", str(SOURCE), *args]).decode().strip()

def replace_once(content, old, new, label):
    if content.count(old) != 1:
        raise ValueError(f"{label}: expected exactly once, found {content.count(old)} for {old[:60]!r}")
    return content.replace(old, new)

def update(path, fn):
    original = path.read_text(encoding="utf-8")
    changed = fn(original)
    if changed != original:
        path.write_text(changed, encoding="utf-8", newline="\n")

def main():
    if SOURCE is None:
        raise SystemExit("Usage: python scripts/import-racing-argon-v34.py PATH_TO_PINNED_4ARGON_CHECKOUT")
    commit = git("rev-parse", "HEAD")
    tree = git("rev-parse", "HEAD^{tree}")
    if (commit, tree) != (EXPECTED_COMMIT, EXPECTED_TREE):
        raise SystemExit(f"Source changed; refuse import: {commit} / {tree}")
    listing = subprocess.check_output(
        ["git", "-C", str(SOURCE), "ls-tree", "-r", "-z", "-l", "HEAD"]
    )
    entries = []
    for row in listing.split(b"\0"):
        if not row:
            continue
        meta, raw_path = row.split(b"\t", 1)
        mode, typ, blob, size = meta.decode().split()
        if typ != "blob" or mode not in ("100644", "100755"):
            raise ValueError(f"Unacceptable tracked entry: {raw_path!r}")
        path = raw_path.decode("utf-8")
        parts = path.split("/")
        if not all(p not in ("", ".", "..") for p in parts) or "\\" in path:
            raise ValueError(f"Unsafe path: {path}")
        entries.append((path, mode, blob, int(size)))
    if len(entries) != 450:
        raise ValueError(f"Expected 450 tracked blobs, got {len(entries)}")
    if DEST.exists():
        raise ValueError(f"Refuse to replace existing archive: {DEST}")
    (DEST / "source").mkdir(parents=True)
    manifest = []
    total = 0
    for i, (rel, mode, blob, size) in enumerate(entries):
        # Git's own blob bytes, never a Windows working-tree checkout (CRLF).
        data = subprocess.check_output(["git", "-C", str(SOURCE), "cat-file", "blob", blob])
        if len(data) != size:
            raise ValueError(f"Source checkout incomplete: {rel} / {len(data)} vs {size}")
        computed_blob = hashlib.sha1(f"blob {size}\0".encode() + data).hexdigest()
        if computed_blob != blob:
            raise ValueError(f"Blob mismatch: {rel}")
        target = DEST / "source" / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        manifest.append(dict(path=rel, mode=mode, git_blob_sha1=blob,
                             sha256=hashlib.sha256(data).hexdigest(), bytes=size))
        total += size
        if i % 100 == 0:
            print(f"Copied {i+1}/{len(entries)}", flush=True)
    record = dict(
        format="git-blob-byte-exact-v1",
        model="Gemini 4 Argon (Racing V3.4)",
        source_repository=None,
        source_branch="main",
        source_commit=commit,
        source_tree=tree,
        snapshot_root="source/",
        file_count=len(entries),
        total_bytes=total,
        lfs_pointer_paths=[],
        repository_bundle=None,
        files=manifest,
    )
    (DEST / "SOURCE-FILES.json").write_text(
        json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (DEST / "SOURCE-PROVENANCE.md").write_text(f"""# Gemini 4 Argon — Racing-bench V3.4 source provenance

- Git branch: `main`; pinned commit: `{commit}`.
- Git tree: `{tree}`.
- Complete original Git-tracked snapshot: **{len(entries):,} files / {total:,} bytes**, archived under [source/](./source/) and individually checked against original Git blob SHA-1; SHA-256 checksums are in [SOURCE-FILES.json](./SOURCE-FILES.json).
- The original repository URL is intentionally not recorded. **Use only this archived source link**: [Gemini 4 Argon source](./source/). The snapshot has no Git-history bundle.
- Prompt association: the source README names Racing-bench V3.4, but original prompt delivery and all 14 reference-image handoffs have **not** been independently demonstrated.
- The upstream README reports 60.0 FPS mean for High and Low on the RTX 3070 Ti at 1080p, and 59.5 FPS 1% low. These are **self-reported**, not independently reproduced or equivalent to tests on required alternative hardware.
- Owner-supplied site: {SITE}. Its availability and gameplay are not independently verified.
- Licenses for bundled assets and libraries are documented in [ASSET-LICENSES.md](./source/ASSET-LICENSES.md); independent redistribution review is not claimed.

Original source files, including reports and assets, were not modified. Future changes must be tracked as separate revisions, not edits to this archive.
""", encoding="utf-8")

    runs_path = RACING / "RUNS.json"
    runs = json.loads(runs_path.read_text(encoding="utf-8"))
    runid = "gemini-4-argon-v3.4"
    if any(r["id"] == runid for r in runs["runs"]):
        raise ValueError("Run already registered")
    runs["runs"].append({
        "id": runid,
        "model": "Gemini 4 Argon",
        "live_url": SITE,
        "site_url": SITE,
        "site_status": "owner-provided-url-reachability-and-gameplay-not-independently-verified",
        "source_repository": None,
        "source_branch": "main",
        "source_commit": commit,
        "source_tree": tree,
        "prompt": "prompts/racing-v3.4/racing-v3.4.md",
        "prompt_association": "source README reports Racing-bench V3.4; exact original prompt and 14-reference delivery not independently proven",
        "provenance": "runs/gemini-4-argon-v3.4/SOURCE-PROVENANCE.md",
        "archival_status": "complete-tracked-git-snapshot-no-history-bundle",
        "gameplay_verification": "not-independently-verified",
        "display_status": "current-archived-source-owner-provided-site",
        "archive_path": "runs/gemini-4-argon-v3.4/source",
        "manifest": "runs/gemini-4-argon-v3.4/SOURCE-FILES.json",
        "source_file_count": len(entries),
        "source_bytes": total,
        "git_bundle": None,
        "reported_verification": {
            "source": "original-readme-self-report",
            "high_preset_average_fps": 60.0,
            "low_preset_average_fps": 60.0,
            "hardware": "rtx-3070-ti-1080p",
            "full_benchmark_acceptance": "not-independently-verified"
        }
    })
    runs["current_arena"].append(runid)
    runs_path.write_text(json.dumps(runs, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Archived {len(entries)} files, {total} bytes; registered {runid}.", flush=True)

if __name__ == "__main__":
    main()
