# Portable replay v1

Plain UTF-8 JSON with `.solstice` extension, no compression or executable data. Maximum 8 MiB before parsing, 22,002 frames, 16,000 events, 1,800 seconds. Unsupported versions and compressed files are rejected without decompression. Exported data contains no device identifiers, private paths, origin storage keys or URLs.

Top-level fields: format (`solstice-replay`), version (1), created (ISO date), origin (informational claim only), setup (known course/car identifiers and bounded condition indices), cars (one or six stable identities), result, frames and events. File ingestion always sets the library entry's provenance to imported; file claims never qualify for records.

Each frame has `t`, `w` (cloud/wetness/day phase), `h` (remaining seconds, score, multiplier), and `c` (one 20-number tuple per vehicle): x, y, z, heading, speed, steering, front/left/right damage, nitro, boost flag, drift flag, unwrapped distance, ordered gates passed, lap-valid flag, rejoin-ghost seconds, discontinuity epoch, finish time (-1 if unfinished), current lap start time, impact strength.

Ten samples per simulated second, additional significant-event frames, and a final frame cover the recorded interval. Events are gate, lap, finish, collision or recover, each with time/car/value. Validation bounds times, coordinates, number types, count, flags and known identifiers. Unknown object fields are removed. Rendering uses only built-in local assets.

Playback binary-searches historical frames, interpolates continuous values and shortest heading angles, and holds discrete state until its actual event sample. Changed epochs suppress teleport interpolation. HUD and standings come from historical tuples. Playback never calls the simulator or record writer. A single animation owner handles live play, frozen menus and replay.

OPFS files are written and verified before a five-entry localStorage manifest is committed under a Web Lock. Replacement checks the displayed manifest revision. Failed writes retain old entries. Unreferenced valid files are exposed for explicit recovery, export, replacement or deletion; incomplete files are labeled, never silently admitted or deleted.
