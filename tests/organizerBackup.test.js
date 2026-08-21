import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOrganizerBackupFilename,
  createOrganizerBackupPayload,
  getOrganizerBackupStorageKey,
  parseOrganizerBackupText,
  saveOrganizerBackupPair,
} from '../src/services/organizerBackup.js';

const user = { uid: 'user-123', email: 'arthur@example.com' };
const data = {
  tasks: [],
  habits: [],
  notes: [],
  events: [],
  dailyHabitsState: { lastDate: '2026-08-21', completed: {} },
  aiActionAudit: [],
};

test('backup payload records its owner and keeps organizer data serializable', () => {
  const payload = createOrganizerBackupPayload({
    user,
    data,
    reason: 'manual-export',
    now: new Date('2026-08-21T12:00:00.000Z'),
  });

  assert.equal(payload.owner.uid, user.uid);
  assert.equal(payload.owner.email, user.email);
  assert.equal(payload.reason, 'manual-export');
  assert.deepEqual(payload.data, data);
  assert.notEqual(payload.data, data);
});

test('backup parser rejects malformed files and incomplete organizer data', () => {
  assert.throws(() => parseOrganizerBackupText('{'), /JSON válido/);
  assert.throws(
    () => parseOrganizerBackupText(JSON.stringify({ format: 'unknown' })),
    /formato de backup/,
  );

  const incomplete = createOrganizerBackupPayload({ user, data });
  delete incomplete.data.events;
  assert.throws(() => parseOrganizerBackupText(JSON.stringify(incomplete)), /events/);
});

test('local backup keeps separate previous and current snapshots for each uid', () => {
  const entries = new Map();
  const storage = {
    setItem: (key, value) => entries.set(key, value),
  };
  const nextData = { ...data, tasks: [{ id: 'task-1', title: 'Teste' }] };

  saveOrganizerBackupPair({
    storage,
    user,
    previousData: data,
    currentData: nextData,
    reason: 'sync:tasks',
  });

  const previous = JSON.parse(entries.get(getOrganizerBackupStorageKey(user.uid, 'previous')));
  const current = JSON.parse(entries.get(getOrganizerBackupStorageKey(user.uid, 'current')));
  assert.equal(previous.data.tasks.length, 0);
  assert.equal(current.data.tasks.length, 1);
  assert.match(previous.reason, /before$/);
  assert.match(current.reason, /after$/);
});

test('backup filename identifies the account without unsafe characters', () => {
  assert.equal(
    createOrganizerBackupFilename(user, new Date('2026-08-21T12:00:00.000Z')),
    'passo-a-passo-backup-arthur-example-com-2026-08-21.json',
  );
});
