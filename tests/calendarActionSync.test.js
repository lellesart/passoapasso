import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEventForGoogle } from '../src/firebase/calendarAPI.js';
import { syncCalendarActionWithGoogle } from '../src/services/ai/calendarActionSync.js';

const event = {
  id: 'e1',
  title: 'Dentista',
  date: '2026-08-20',
  time: '14:00',
  category: 'Saúde',
  reminderMinutes: 30,
};

test('Google payload uses the organizer São Paulo timezone deterministically', () => {
  const payload = formatEventForGoogle(event);
  assert.equal(payload.start.dateTime, '2026-08-20T17:00:00.000Z');
  assert.equal(payload.end.dateTime, '2026-08-20T18:00:00.000Z');
  assert.equal(payload.start.timeZone, 'America/Sao_Paulo');
  assert.deepEqual(payload.reminders.overrides, [{ method: 'popup', minutes: 30 }]);
});

test('Google creation stores the returned external ID for Firebase resync', async () => {
  const applied = {
    records: [event],
    record: event,
    message: 'Evento criado com sucesso.',
    externalOperation: { type: 'google-create', eventId: 'e1' },
  };
  const result = await syncCalendarActionWithGoogle(applied, {
    accessToken: 'token',
    addEvent: async () => 'google-event',
  });

  assert.equal(result.googleStatus, 'synced');
  assert.equal(result.records[0].googleEventId, 'google-event');
  assert.equal(result.needsFirestoreResync, true);
});

test('missing token keeps a requested event local and reports partial state', async () => {
  const applied = {
    records: [event],
    record: event,
    message: 'Evento criado com sucesso.',
    externalOperation: { type: 'google-create', eventId: 'e1' },
  };
  const result = await syncCalendarActionWithGoogle(applied, { accessToken: null });

  assert.equal(result.ok, true);
  assert.equal(result.googleStatus, 'local-only');
  assert.match(result.message, /salvo no Organizador.*não foi criado no Google Calendar/);
});

test('Google update failure does not roll back the organizer event', async () => {
  const updatedEvent = { ...event, time: '15:00', googleEventId: 'google-event' };
  const applied = {
    records: [updatedEvent],
    record: updatedEvent,
    message: 'Evento atualizado com sucesso.',
    externalOperation: { type: 'google-update', eventId: 'e1', googleEventId: 'google-event' },
  };
  const result = await syncCalendarActionWithGoogle(applied, {
    accessToken: 'token',
    updateEvent: async () => false,
  });

  assert.equal(result.googleStatus, 'local-only');
  assert.equal(result.records[0].time, '15:00');
  assert.match(result.message, /atualizado no Organizador.*não foi atualizado no Google Calendar/);
});

test('Google deletion receives only the external event ID', async () => {
  let receivedId = null;
  const deletedEvent = { ...event, deleted: true, googleEventId: 'google-event' };
  const result = await syncCalendarActionWithGoogle({
    records: [deletedEvent],
    record: deletedEvent,
    message: 'Evento movido para a Lixeira.',
    externalOperation: { type: 'google-delete', eventId: 'e1', googleEventId: 'google-event' },
  }, {
    accessToken: 'token',
    deleteEvent: async id => {
      receivedId = id;
      return true;
    },
  });

  assert.equal(receivedId, 'google-event');
  assert.equal(result.googleStatus, 'synced');
});
