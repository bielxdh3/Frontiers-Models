/**
 * StorageManager.ts
 * Manages local preferences, personal best lap records, and the 5-slot Replay Library.
 * Strictly adheres to clean-room non-database requirements:
 * - No IndexedDB, SQLite, Cache Storage, or Service Workers.
 * - Uses localStorage for metadata/preferences and OPFS (Origin Private File System)
 *   with fallback for replay keyframe data.
 * - Maximum 5 saved replay slots strictly enforced with explicit user replacement.
 * - Imported replays are stamped as imported and NEVER write to personal records.
 */

export interface PersonalRecord {
  trackId: string;
  carId: string;
  bestLapMs: number;
  date: string;
  weather: string;
  timeOfDay: string;
}

export interface ReplayMetadata {
  id: string;
  title: string;
  mode: 'time_trial' | 'race' | 'checkpoint';
  trackId: string;
  carId: string;
  date: string;
  durationMs: number;
  isCompleted: boolean;
  isImported: boolean; // Must be true for any imported file
  bestLapMs?: number;
  finalPosition?: number;
  score?: number;
}

export interface ReplayKeyframe {
  t: number; // Timestamp in milliseconds
  p: [number, number, number]; // Player position [x, y, z]
  r: [number, number, number, number]; // Player rotation quaternion [x, y, z, w]
  v: number; // Player speed km/h
  d: number; // Drift angle / intensity 0..1
  n: number; // Nitro remaining 0..100
  dmg: number; // Damage level 0..1
  lap: number; // Current lap
  cp: number; // Current checkpoint
  pos: number; // Current race position 1..6
  opp: Array<{
    p: [number, number, number];
    r: [number, number, number, number];
    dmg: number;
  }>;
  weatherWetness: number;
  daylightTime: number;
}

export interface ReplayPayload {
  schemaVersion: 1;
  metadata: ReplayMetadata;
  keyframes: ReplayKeyframe[];
}

export interface GameSettings {
  quality: 'low' | 'medium' | 'high';
  masterVolume: number; // 0..1
  isMuted: boolean;
  reducedMotion: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  quality: 'high',
  masterVolume: 0.8,
  isMuted: false,
  reducedMotion: false
};

export const MAX_REPLAY_SLOTS = 5;
const STORAGE_PREFIX = 'racing_bench_';

export class StorageManager {
  private hasOpfs = false;
  private opfsRoot: FileSystemDirectoryHandle | null = null;

  constructor() {
    this.initOpfs();
  }

  private async initOpfs(): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.getDirectory) {
        this.opfsRoot = await navigator.storage.getDirectory();
        this.hasOpfs = true;
      }
    } catch {
      this.hasOpfs = false;
      this.opfsRoot = null;
    }
  }

  // --- Settings ---
  public getSettings(): GameSettings {
    try {
      const data = localStorage.getItem(`${STORAGE_PREFIX}settings`);
      if (data) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      }
    } catch {}
    return { ...DEFAULT_SETTINGS };
  }

  public saveSettings(settings: GameSettings): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}settings`, JSON.stringify(settings));
    } catch {}
  }

  // --- Personal Best Records (Strictly for legitimate locally played laps) ---
  public getPersonalRecords(): Record<string, PersonalRecord> {
    try {
      const data = localStorage.getItem(`${STORAGE_PREFIX}records`);
      if (data) {
        return JSON.parse(data);
      }
    } catch {}
    return {};
  }

  public getBestRecord(trackId: string): PersonalRecord | null {
    const records = this.getPersonalRecords();
    return records[trackId] || null;
  }

  /**
   * Save a legitimate personal best record.
   * STRICT INVARIANT: Only genuine local gameplay can call this.
   * Replays and imported files are strictly forbidden from invoking this method.
   */
  public savePersonalRecord(record: PersonalRecord): boolean {
    if (!record.trackId || !record.bestLapMs || record.bestLapMs <= 0) {
      return false;
    }

    const records = this.getPersonalRecords();
    const existing = records[record.trackId];

    if (!existing || record.bestLapMs < existing.bestLapMs) {
      records[record.trackId] = { ...record };
      try {
        localStorage.setItem(`${STORAGE_PREFIX}records`, JSON.stringify(records));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  // --- Replay Library (Strictly max 5 slots) ---
  public getReplayMetadataList(): ReplayMetadata[] {
    try {
      const data = localStorage.getItem(`${STORAGE_PREFIX}replay_list`);
      if (data) {
        const list = JSON.parse(data);
        if (Array.isArray(list)) {
          return list.slice(0, MAX_REPLAY_SLOTS);
        }
      }
    } catch {}
    return [];
  }

  public isLibraryFull(): boolean {
    return this.getReplayMetadataList().length >= MAX_REPLAY_SLOTS;
  }

  /**
   * Saves a replay payload. If the library is full (5 items) and no replaceId is given,
   * returns { success: false, full: true } so the UI can prompt the player.
   */
  public async saveReplay(
    payload: ReplayPayload,
    replaceId?: string
  ): Promise<{ success: boolean; full?: boolean; error?: string }> {
    const list = this.getReplayMetadataList();

    if (list.length >= MAX_REPLAY_SLOTS && !replaceId) {
      return { success: false, full: true, error: 'Replay library is full (max 5 slots).' };
    }

    try {
      // 1. Write the payload data to file/storage
      await this.writeReplayData(payload.metadata.id, payload);

      // 2. Update the metadata list
      let updatedList: ReplayMetadata[];
      if (replaceId) {
        const index = list.findIndex((m) => m.id === replaceId);
        if (index >= 0) {
          // Clean up old file
          await this.deleteReplayData(replaceId);
          updatedList = [...list];
          updatedList[index] = payload.metadata;
        } else {
          updatedList = [...list.filter((m) => m.id !== replaceId), payload.metadata].slice(0, MAX_REPLAY_SLOTS);
        }
      } else {
        updatedList = [...list, payload.metadata].slice(0, MAX_REPLAY_SLOTS);
      }

      localStorage.setItem(`${STORAGE_PREFIX}replay_list`, JSON.stringify(updatedList));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Storage error while saving replay.' };
    }
  }

  public async getReplayData(id: string): Promise<ReplayPayload | null> {
    try {
      // Try OPFS first
      if (this.hasOpfs && this.opfsRoot) {
        try {
          const fileHandle = await this.opfsRoot.getFileHandle(`replay_${id}.json`);
          const file = await fileHandle.getFile();
          const text = await file.text();
          return JSON.parse(text);
        } catch {}
      }

      // Fallback to localStorage
      const data = localStorage.getItem(`${STORAGE_PREFIX}replay_data_${id}`);
      if (data) {
        return JSON.parse(data);
      }
    } catch {}
    return null;
  }

  public async deleteReplay(id: string): Promise<boolean> {
    try {
      await this.deleteReplayData(id);
      const list = this.getReplayMetadataList().filter((m) => m.id !== id);
      localStorage.setItem(`${STORAGE_PREFIX}replay_list`, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  }

  private async writeReplayData(id: string, payload: ReplayPayload): Promise<void> {
    const text = JSON.stringify(payload);

    if (this.hasOpfs && this.opfsRoot) {
      try {
        const fileHandle = await this.opfsRoot.getFileHandle(`replay_${id}.json`, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(text);
        await writable.close();
        return;
      } catch {
        // Fall back to localStorage if OPFS write fails
      }
    }

    localStorage.setItem(`${STORAGE_PREFIX}replay_data_${id}`, text);
  }

  private async deleteReplayData(id: string): Promise<void> {
    if (this.hasOpfs && this.opfsRoot) {
      try {
        await this.opfsRoot.removeEntry(`replay_${id}.json`);
      } catch {}
    }
    localStorage.removeItem(`${STORAGE_PREFIX}replay_data_${id}`);
  }

  // --- Export and Import ---
  public exportReplayToFile(payload: ReplayPayload): void {
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sanitizedTitle = (payload.metadata.title || 'replay').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `racing_${sanitizedTitle}_${payload.metadata.id.slice(0, 8)}.racingreplay`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Validates an untrusted imported replay file.
   * - Enforces schema version
   * - Bounded payload size and sample count
   * - Stamps as isImported: true
   * - Sanitizes all text fields
   */
  public validateAndParseImport(jsonString: string): { valid: boolean; payload?: ReplayPayload; error?: string } {
    if (jsonString.length > 25 * 1024 * 1024) {
      return { valid: false, error: 'Replay file exceeds maximum size limit (25MB).' };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      return { valid: false, error: 'Malformed JSON syntax.' };
    }

    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'Invalid replay format: root must be an object.' };
    }

    if (parsed.schemaVersion !== 1) {
      return { valid: false, error: `Unsupported schema version: ${parsed.schemaVersion}.` };
    }

    if (!parsed.metadata || typeof parsed.metadata !== 'object') {
      return { valid: false, error: 'Missing replay metadata.' };
    }

    if (!Array.isArray(parsed.keyframes)) {
      return { valid: false, error: 'Missing or invalid keyframe array.' };
    }

    if (parsed.keyframes.length > 50000) {
      return { valid: false, error: 'Keyframe count exceeds reasonable bounds (max 50,000).' };
    }

    // Sanitize metadata
    const rawMeta = parsed.metadata;
    const sanitizedMetadata: ReplayMetadata = {
      id: 'imp_' + Math.random().toString(36).substring(2, 10),
      title: String(rawMeta.title || 'Imported Replay').slice(0, 40).replace(/<[^>]*>?/gm, ''),
      mode: ['time_trial', 'race', 'checkpoint'].includes(rawMeta.mode) ? rawMeta.mode : 'time_trial',
      trackId: String(rawMeta.trackId || 'coastal_sprint').slice(0, 30),
      carId: String(rawMeta.carId || 'corsica_gt').slice(0, 30),
      date: new Date().toISOString(),
      durationMs: Math.max(0, Math.min(1800000, Number(rawMeta.durationMs) || 0)),
      isCompleted: Boolean(rawMeta.isCompleted),
      isImported: true, // MANDATORY: stamped as imported regardless of file contents
      bestLapMs: rawMeta.bestLapMs ? Math.max(0, Number(rawMeta.bestLapMs)) : undefined,
      finalPosition: rawMeta.finalPosition ? Math.max(1, Math.min(6, Number(rawMeta.finalPosition))) : undefined,
      score: rawMeta.score ? Math.max(0, Number(rawMeta.score)) : undefined
    };

    // Validate keyframes structure
    const validKeyframes: ReplayKeyframe[] = [];
    for (let i = 0; i < parsed.keyframes.length; i++) {
      const kf = parsed.keyframes[i];
      if (!kf || typeof kf.t !== 'number' || !Array.isArray(kf.p) || !Array.isArray(kf.r)) {
        continue;
      }
      validKeyframes.push({
        t: Math.max(0, Number(kf.t)),
        p: [Number(kf.p[0]) || 0, Number(kf.p[1]) || 0, Number(kf.p[2]) || 0],
        r: [Number(kf.r[0]) || 0, Number(kf.r[1]) || 0, Number(kf.r[2]) || 0, Number(kf.r[3]) || 1],
        v: Math.max(0, Math.min(500, Number(kf.v) || 0)),
        d: Math.max(0, Math.min(1, Number(kf.d) || 0)),
        n: Math.max(0, Math.min(100, Number(kf.n) || 0)),
        dmg: Math.max(0, Math.min(1, Number(kf.dmg) || 0)),
        lap: Math.max(1, Math.min(10, Number(kf.lap) || 1)),
        cp: Math.max(0, Number(kf.cp) || 0),
        pos: Math.max(1, Math.min(6, Number(kf.pos) || 1)),
        opp: Array.isArray(kf.opp)
          ? kf.opp.map((o: any) => ({
              p: [Number(o.p?.[0]) || 0, Number(o.p?.[1]) || 0, Number(o.p?.[2]) || 0],
              r: [Number(o.r?.[0]) || 0, Number(o.r?.[1]) || 0, Number(o.r?.[2]) || 0, Number(o.r?.[3]) || 1],
              dmg: Math.max(0, Math.min(1, Number(o.dmg) || 0))
            }))
          : [],
        weatherWetness: Math.max(0, Math.min(1, Number(kf.weatherWetness) || 0)),
        daylightTime: Math.max(0, Math.min(1, Number(kf.daylightTime) || 0))
      });
    }

    if (validKeyframes.length === 0) {
      return { valid: false, error: 'Replay contains no valid keyframes.' };
    }

    return {
      valid: true,
      payload: {
        schemaVersion: 1,
        metadata: sanitizedMetadata,
        keyframes: validKeyframes
      }
    };
  }
}
