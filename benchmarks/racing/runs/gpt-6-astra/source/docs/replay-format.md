# Replay format and storage contract

The portable format is UTF-8 JSON with `format: "mare-alta"` and `version: 1`.
It contains all historical state needed for the bundled version's three original
courses and cars. It contains no remote resource addresses, device identifiers,
browser profile paths, storage file names or credentials.

The header has a bounded label, ISO creation date, mode/car/initial weather and
daylight/difficulty, duration, completion status and stable car identities.
File origin and claimed results are never authority for personal records. Every
file import is stamped `imported` in the local library, even when its header
claims `local`. Internal harness recordings are confined to a test namespace.

Each frame contains:

- `t`: simulation seconds, strictly increasing, up to 3,600 seconds.
- `env`: weather, wetness, daylight phase and illumination, each in [0, 1].
- `cars`: one car for trial/rush, six for race. Each 22-number row is x, y, z,
  heading, vx, vz, longitudinal speed, steering, nitro reserve, boost, drift,
  accumulated damage, recovery serial, rejoin protection, unwrapped route
  distance, next ordered gate, completed laps, lap validity, impact flash,
  finish time (-1 when unfinished), place and lap start time.
- `hud`: countdown remaining, arcade score, combo and collected gates.
- `laps`: completed player laps as [time, validity].
- `message`: a bounded plain-text historic feedback message.

Event types are `start`, `gate`, `lap`, `collision`, `recovery`, `finish` and
`end`. They are sorted by simulation time and identify an existing car. Events
force snapshots in addition to nominal 10 Hz recording. Seeking uses binary
search, shortest-arc headings, interpolated continuous motion/environment and
preceding-sample discrete state. Recovery serial changes disable interpolation
across a teleport. No live simulation runs in the viewer.

Imports reject incompatible versions, malformed/truncated JSON, compressed
files, non-finite or out-of-range numbers, unknown identifiers, excess cars,
incorrect sample ordering and unreasonable event counts. Limits: 32 MiB raw
input, 40,000 samples, 20,000 events, 1 hour. There is no decompression path.
Longer live races remain playable; recording stops at the limit and the exported
recording is explicitly partial. This is a replay limit, not a race time limit.

Persistence uses OPFS files named by local UUID and a small localStorage
manifest. No database, IndexedDB or Cache Storage is used. An exclusive Web Lock
serializes reads/writes across tabs. Without OPFS or Web Locks, durable writes
are refused, while replay viewing and file export remain usable.

A replacement validates the new replay, creates and closes a new file, reads it
back, commits an updated five-entry manifest, then removes the selected old
file. A failure before the manifest commit preserves the old recording. A valid
orphan is displayed separately for recovery, export or deletion; it is not
silently admitted as a sixth entry. Corrupt indexes can be backed up and rebuilt
without deleting recording files. Deleting an entry is an explicit user action.

LocalStorage personal records are written only by the completed, locally played
Time Trial result path; replay playback/import/export never calls that path.
Records retain car and starting weather/daylight conditions. A single invalid
lap does not erase valid laps; three invalid laps produce no record.
