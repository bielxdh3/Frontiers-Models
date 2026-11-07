"""Count physical source lines for the five archived Racing V3.4 projects.

Uses pinned Git blob IDs from SOURCE-FILES.json; works with sparse checkouts.
Counts nonempty final lines. Own-source excludes archived dependencies,
generated builds, media, reference assets, and verification artifacts.
Code-file totals include third-party/generated JS/CSS, for comparison only.
"""

from __future__ import annotations

import json
import subprocess
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
CODE_EXTENSIONS = {
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py",
    ".html", ".css", ".scss", ".sass", ".vue", ".svelte",
    ".glsl", ".wgsl", ".vert", ".frag", ".sh", ".ps1",
}
TEXT_EXTENSIONS = CODE_EXTENSIONS | {
    ".json", ".jsonl", ".md", ".txt", ".yaml", ".yml", ".xml",
    ".svg", ".csv", ".toml", ".ini", ".cfg", ".webmanifest",
}
EXTERNAL_OR_GENERATED_ROOTS = {
    "node_modules", "vendor", "dist", "build", ".next",
    "coverage", "playwright-report", "verification", "assets",
    "public", "benchmark", "racing-v3.4",
}
CHUNK_SIZE = 32


def git(*args: str, input_bytes: bytes | None = None) -> bytes:
    return subprocess.run(
        ["git", "-C", str(ROOT), *args], input=input_bytes,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        check=True,
    ).stdout


def blobs(items: list[dict]):
    """Fetch exact pinned Git objects efficiently without a full checkout."""
    for start in range(0, len(items), CHUNK_SIZE):
        chunk = items[start : start + CHUNK_SIZE]
        output = git(
            "cat-file", "--batch",
            input_bytes=b"".join(f["git_blob_sha1"].encode("ascii") + b"\n" for f in chunk),
        )
        offset = 0
        for entry in chunk:
            end = output.index(b"\n", offset)
            oid, kind, size_str = output[offset:end].decode("ascii").split()
            size = int(size_str)
            if kind != "blob" or oid != entry["git_blob_sha1"] or size != entry["bytes"]:
                raise ValueError(f"Unexpected Git blob for {entry['path']}")
            data = output[end + 1 : end + 1 + size]
            offset = end + 1 + size + 1
            yield entry, data
        if offset != len(output):
            raise ValueError("Unexpected trailing output from git cat-file")


def count(run: dict) -> dict:
    name = run["id"]
    raw = git("show", f"HEAD:benchmarks/racing/runs/{name}/SOURCE-FILES.json")
    manifest = json.loads(raw)
    if manifest["file_count"] != len(manifest["files"]):
        raise ValueError(f"Incomplete manifest: {name}")
    source_code = [
        file for file in manifest["files"]
        if Path(file["path"]).suffix.lower() in TEXT_EXTENSIONS
    ]
    result = Counter()
    for file, blob in blobs(source_code):
        # Filter rare binary data disguised under a text extension.
        if b"\x00" in blob:
            result["mislabelled_binary_files"] += 1
            continue
        physical_lines = blob.count(b"\n") + (1 if blob and not blob.endswith(b"\n") else 0)
        result["all_text_lines"] += physical_lines
        result["all_text_files"] += 1
        suffix = Path(file["path"]).suffix.lower()
        if suffix not in CODE_EXTENSIONS:
            continue
        result["all_code_lines"] += physical_lines
        result["all_code_files"] += 1
        root = file["path"].split("/", 1)[0].lower()
        if root not in EXTERNAL_OR_GENERATED_ROOTS and not Path(file["path"]).name.endswith(".min.js"):
            result["own_code_lines"] += physical_lines
            result["own_code_files"] += 1
    return {
        "id": name, "model": run["model"],
        "tracked_files": manifest["file_count"],
        **{key: result[key] for key in (
            "own_code_lines", "own_code_files",
            "all_code_lines", "all_code_files",
            "all_text_lines", "all_text_files", "mislabelled_binary_files",
        )},
    }


if __name__ == "__main__":
    catalog = json.loads((ROOT / "benchmarks/racing/RUNS.json").read_text(encoding="utf-8"))
    indexed = {run["id"]: run for run in catalog["runs"]}
    results = [count(indexed[name]) for name in catalog["current_arena"]]
    print(json.dumps({
        "method": "Pinned Git blobs, physical lines (blank/comment lines included); own-code excludes vendored, generated, verification, media and data artifacts; JSON/lockfiles excluded from code",
        "runs": results,
    }, indent=2, ensure_ascii=False))
