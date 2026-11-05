"""Package only the project, static build and current verification evidence."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "solmare-racing.zip"
VERIFICATION = ROOT / "verification"


def digest(file):
    result = hashlib.sha256()
    with file.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


result = json.loads((VERIFICATION / "results.json").read_text(encoding="utf-8"))
files = set()
for name in ("index.html", "style.css", "track.json", "package.json", "package-lock.json", "README.md", "ASSET-LICENSES.md"):
    files.add(ROOT / name)
for directory in ("src", "scripts", "assets", "vendor", "dist", "benchmark/racing-v3.4"):
    files.update(file for file in (ROOT / directory).rglob("*") if file.is_file() and not (file.name.startswith("source-") and file.suffix == ".html"))
for name in (
    "REPORT.md", "GATES.md", "visual-observations.json", "results.json",
    "race-3-laps.json", "race-6-laps.json", "restart-metrics.json",
    "scene-stats.json", "image-metrics.json", "sweep-metrics.json",
    "hardware.json", "performance.json", "audio-metrics.json", "build.json",
    "physics-regression.json", "media-check.json", "volta.webm", "audio-volta.wav",
    "menu.png", "garage.png", "results-3.png", "results-6.png", "sweep-sheet.png",
    "logs/verify.log", "logs/browser-errors.json",
):
    files.add(VERIFICATION / name)
for capture in result["captures"]:
    files.add(VERIFICATION / "screenshots" / capture["file"])
    files.add(VERIFICATION / "compare" / (capture["id"] + ".png"))
files.update(file for file in (VERIFICATION / "sweep").glob("*.png") if file.is_file())
files.update(file for file in (VERIFICATION / "logs").glob("capture-*.log") if file.is_file())
assert len(result["captures"]) == 12, "Missing screenshots"
assert len(list((VERIFICATION / "sweep").glob("*.png"))) == 114, "Missing sweep frames"
for file in files:
    assert file.is_relative_to(ROOT) and file.is_file(), str(file)
    assert not file.is_symlink(), str(file)
    if file.is_relative_to(ROOT / "dist"):
        assert "refs" not in file.parts, "Reference images must not enter the static build"

manifest = {
    "benchmarkStatus": "FAIL",
    "benchmarkLimitations": [
        "Visual quality below the supplied commercial references",
        "Visual gates P2-P4 were not established before advancing",
        "RTX 3060 and integrated GPU not directly tested",
    ],
    "automatedStatus": result["automatedStatus"],
    "files": [{"path": file.relative_to(ROOT).as_posix(), "bytes": file.stat().st_size, "sha256": digest(file)} for file in sorted(files)],
}
manifest_path = VERIFICATION / "delivery-manifest.json"
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
files.add(manifest_path)
with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for file in sorted(files):
        archive.write(file, file.relative_to(ROOT).as_posix())
with zipfile.ZipFile(OUT) as archive:
    assert archive.testzip() is None, "Archive CRC verification failed"
    assert len(archive.infolist()) == len(files)
checksum = digest(OUT)
(ROOT / "solmare-racing.zip.sha256").write_text(checksum + "  " + OUT.name + "\n", encoding="ascii")
print(json.dumps({"archive": str(OUT), "bytes": OUT.stat().st_size, "MiB": OUT.stat().st_size / 1024**2, "files": len(files), "sha256": checksum}, indent=2))
