import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import * as artifactEvents from './0001-artifact-events.js';
import {
  ARTIFACT_EVENTS_MIGRATION_ID,
  EventsMigrationProvider,
  eventsMigrationIds,
} from './index.js';

describe('events migration registry', () => {
  it('registers artifact events as the first events migration', async () => {
    const provider = new EventsMigrationProvider();
    const migrations = await provider.getMigrations();

    expect(eventsMigrationIds).toEqual([ARTIFACT_EVENTS_MIGRATION_ID]);
    expect(migrations[ARTIFACT_EVENTS_MIGRATION_ID]).toBe(artifactEvents);
    expect(migrations[ARTIFACT_EVENTS_MIGRATION_ID].up).toBeTypeOf('function');
    expect(migrations[ARTIFACT_EVENTS_MIGRATION_ID].down).toBeTypeOf('function');
  });

  it('keeps events migrations forward-only', async () => {
    await expect(artifactEvents.down()).rejects.toThrow('down migrations are not supported');
  });

  it('keeps artifact events append-only under tenant RLS', async () => {
    const source = await readFile(new URL('./0001-artifact-events.ts', import.meta.url), 'utf8');

    expect(source).toContain('ALTER TABLE artifact_events ENABLE ROW LEVEL SECURITY');
    expect(source).toContain('ALTER TABLE artifact_events FORCE ROW LEVEL SECURITY');
    expect(source).toContain('CREATE POLICY artifact_events_owner_read');
    expect(source).toContain('CREATE POLICY artifact_events_owner_insert');
    expect(source).not.toContain('FOR UPDATE');
    expect(source).not.toContain('FOR DELETE');
    expect(source).toContain('CREATE TRIGGER artifact_events_no_update');
    expect(source).toContain('CREATE TRIGGER artifact_events_no_delete');
    expect(source).toContain('artifact_events_org_idempotency_unique');
  });
});
