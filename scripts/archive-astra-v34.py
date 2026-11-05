"""Import the pinned GPT-6 Astra Racing V3.4 Git snapshot byte-for-byte.

Usage: python scripts/archive-astra-v34.py E:/path/to/6-astra-checkout
This is an archival operation only: never rebuild or modify model output.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import sys

COMMIT = "daf0099699a0e8201b8bc4f1dca6909f92700b3b"
TREE = "b115486c104e25041bf2116865de91b6c4a31132"
SOURCE_REPO = "https://github.com/bielxdh3/6-astra"
ROOT = Path(__file__).resolve().parent.parent
RUN = ROOT / "benchmarks" / "racing" / "runs" / "gpt-6-astra-v3.4"
DEST = RUN / "source"


def git(repo: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-C", str(repo), *args])


def main(source: Path) -> None:
    source = source.resolve(strict=True)
    assert git(source, "rev-parse", "HEAD").strip().decode() == COMMIT, "incorrect source commit"
    assert git(source, "rev-parse", "HEAD^{tree}").strip().decode() == TREE, "incorrect source tree"
    assert not git(source, "status", "--porcelain", "--untracked-files=no").strip(), "source is modified"
    if DEST.exists() and any(DEST.iterdir()):
        raise SystemExit("Refusing to overwrite existing archive: " + str(DEST))

    entries: list[dict[str, str | int]] = []
    total = 0
    # Read immutable Git blobs rather than the checkout: Windows autocrlf may
    # transform .gitignore and other text files despite an unchanged HEAD.
    with subprocess.Popen(
        ["git", "-C", str(source), "cat-file", "--batch"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE,
    ) as cat:
        assert cat.stdin and cat.stdout
        for record in git(source, "ls-files", "--stage", "-z").split(b"\0"):
            if not record:
                continue
            meta, raw_path = record.split(b"\t", 1)
            mode, sha1, stage = meta.decode("ascii").split(" ")
            if stage != "0" or mode not in ("100644", "100755"):
                raise ValueError(f"unsupported Git entry at {raw_path!r}: {meta!r}")
            relative = raw_path.decode("utf-8", "strict")
            parts = relative.split("/")
            if any(p in ("", ".", "..") for p in parts) or "\\" in relative:
                raise ValueError("unsafe source path: " + relative)
            cat.stdin.write(sha1.encode("ascii") + b"\n")
            cat.stdin.flush()
            header = cat.stdout.readline().strip().split(b" ")
            if len(header) != 3 or header[:2] != [sha1.encode("ascii"), b"blob"]:
                raise ValueError("unexpected Git object: " + relative)
            data = cat.stdout.read(int(header[2]))
            if cat.stdout.read(1) != b"\n":
                raise ValueError("invalid Git batch terminator: " + relative)
            expected_blob = hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()
            if expected_blob != sha1:
                raise ValueError("Git object differs from index: " + relative)
            out = DEST.joinpath(*parts)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(data)
            if hashlib.sha256(out.read_bytes()).digest() != hashlib.sha256(data).digest():
                raise ValueError("copy failed integrity check: " + relative)
            entries.append({
                "path": relative,
                "mode": mode,
                "git_blob_sha1": sha1,
                "sha256": hashlib.sha256(data).hexdigest(),
                "bytes": len(data),
            })
            total += len(data)
        cat.stdin.close()
        if cat.wait() != 0:
            raise ValueError("Git cat-file failed")

    entries.sort(key=lambda item: str(item["path"]))
    manifest = {
        "format": "git-blob-byte-exact-v1",
        "model": "GPT-6 Astra (Racing V3.4)",
        "source_repository": SOURCE_REPO,
        "source_branch": "main",
        "source_commit": COMMIT,
        "source_tree": TREE,
        "snapshot_root": "source/",
        "file_count": len(entries),
        "total_bytes": total,
        "lfs_pointer_paths": [],
        "repository_bundle": None,
        "files": entries,
    }
    RUN.mkdir(parents=True, exist_ok=True)
    (RUN / "SOURCE-FILES.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Archived {len(entries)} Git files / {total} bytes from {COMMIT}.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/archive-astra-v34.py SOURCE_GIT_CHECKOUT")
    main(Path(sys.argv[1]))
