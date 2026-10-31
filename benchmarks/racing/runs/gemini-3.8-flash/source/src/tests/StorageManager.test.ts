/**
 * tests/StorageManager.test.ts
 * Tests non-database persistence, 5-slot replay vault capacity,
 * schema validation, and personal best record authenticity invariants.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StorageManager,
  ReplayPayload,
  MAX_REPLAY_SLOTS,
  PersonalRecord
} from '../core/StorageManager';

function makeMockPayload(id: string, durationMs = 120000): ReplayPayload {
  return {
    schemaVersion: 1,
    metadata: {
      id,
      title: `Race ${id}`,
      mode: 'time_trial',
      trackId: 'coastal_sprint',
      carId: 'riviera_spyder',
      date: new Date().toISOString(),
      durationMs,
      isCompleted: true,
      isImported: false,
      bestLapMs: 38500
    },
    keyframes: [
      {
        t: 0,
        p: [0, 1, 0],
        r: [0, 0, 0, 1],
        v: 0,
        d: 0,
        n: 100,
        dmg: 0,
        lap: 1,
        cp: 0,
        pos: 1,
        opp: [],
        weatherWetness: 0,
        daylightTime: 12
      },
      {
        t: durationMs,
        p: [100, 1, 100],
        r: [0, 0.707, 0, 0.707],
        v: 180,
        d: 0.2,
        n: 60,
        dmg: 0.15,
        lap: 3,
        cp: 11,
        pos: 1,
        opp: [],
        weatherWetness: 0,
        daylightTime: 12.1
      }
    ]
  };
}

describe('StorageManager', () => {
  let storage: StorageManager;

  beforeEach(() => {
    localStorage.clear();
    storage = new StorageManager();
  });

  it('enforces maximum 5-entry replay capacity and forbids silent eviction', async () => {
    // Save 5 replays
    for (let i = 1; i <= MAX_REPLAY_SLOTS; i++) {
      const res = await storage.saveReplay(makeMockPayload(`slot_${i}`));
      expect(res.success).toBe(true);
    }

    expect(storage.getReplayMetadataList().length).toBe(5);
    expect(storage.isLibraryFull()).toBe(true);

    // Attempt to save 6th replay without replacement
    const sixth = await storage.saveReplay(makeMockPayload('slot_6'));
    expect(sixth.success).toBe(false);
    expect(sixth.full).toBe(true);

    // Library must still contain exactly 5 original entries
    const list = storage.getReplayMetadataList();
    expect(list.length).toBe(5);
    expect(list.map((m) => m.id)).toEqual(['slot_1', 'slot_2', 'slot_3', 'slot_4', 'slot_5']);
  });

  it('allows explicit user replacement of an existing replay slot', async () => {
    for (let i = 1; i <= MAX_REPLAY_SLOTS; i++) {
      await storage.saveReplay(makeMockPayload(`slot_${i}`));
    }

    // Replace slot_3 explicitly
    const res = await storage.saveReplay(makeMockPayload('slot_replacement'), 'slot_3');
    expect(res.success).toBe(true);

    const list = storage.getReplayMetadataList();
    expect(list.length).toBe(5);
    expect(list.some((m) => m.id === 'slot_replacement')).toBe(true);
    expect(list.some((m) => m.id === 'slot_3')).toBe(false);
  });

  it('validates imported replay files and stamps them as imported', () => {
    const rawPayload = makeMockPayload('imp_test');
    (rawPayload.metadata as any).isImported = false; // Even if imported file claims it was local
    const jsonStr = JSON.stringify(rawPayload);

    const res = storage.validateAndParseImport(jsonStr);
    expect(res.valid).toBe(true);
    expect(res.payload?.metadata.isImported).toBe(true); // Must be forced to true
  });

  it('rejects malformed or oversized imported replays safely', () => {
    // Malformed JSON
    const res1 = storage.validateAndParseImport('not json');
    expect(res1.valid).toBe(false);

    // Wrong schema version
    const res2 = storage.validateAndParseImport(JSON.stringify({ schemaVersion: 99 }));
    expect(res2.valid).toBe(false);

    // Empty keyframes
    const res3 = storage.validateAndParseImport(
      JSON.stringify({ schemaVersion: 1, metadata: {}, keyframes: [] })
    );
    expect(res3.valid).toBe(false);
  });

  it('strict record authenticity: preserves legitimate personal bests', () => {
    const record1: PersonalRecord = {
      trackId: 'coastal_sprint',
      carId: 'riviera_spyder',
      bestLapMs: 42000,
      date: new Date().toISOString(),
      weather: 'sunny',
      timeOfDay: 'daytime'
    };

    expect(storage.savePersonalRecord(record1)).toBe(true);
    expect(storage.getBestRecord('coastal_sprint')?.bestLapMs).toBe(42000);

    // Slower lap does not overwrite personal record
    const slowerRecord: PersonalRecord = {
      ...record1,
      bestLapMs: 45000
    };
    expect(storage.savePersonalRecord(slowerRecord)).toBe(false);
    expect(storage.getBestRecord('coastal_sprint')?.bestLapMs).toBe(42000);

    // Faster lap updates record
    const fasterRecord: PersonalRecord = {
      ...record1,
      bestLapMs: 39500
    };
    expect(storage.savePersonalRecord(fasterRecord)).toBe(true);
    expect(storage.getBestRecord('coastal_sprint')?.bestLapMs).toBe(39500);
  });
});
