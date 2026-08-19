import {
  addEventToGoogleCalendar,
  deleteEventFromGoogleCalendar,
  updateEventInGoogleCalendar,
} from '../../firebase/calendarAPI.js';

const partialMessage = (operationType) => {
  if (operationType === 'google-create') return 'Evento salvo no Organizador, mas não foi criado no Google Calendar.';
  if (operationType === 'google-update') return 'Evento atualizado no Organizador, mas não foi atualizado no Google Calendar.';
  return 'Evento removido do Organizador, mas pode continuar no Google Calendar.';
};

export async function syncCalendarActionWithGoogle(applied, {
  accessToken = null,
  addEvent = addEventToGoogleCalendar,
  updateEvent = updateEventInGoogleCalendar,
  deleteEvent = deleteEventFromGoogleCalendar,
} = {}) {
  const operation = applied?.externalOperation;
  if (!operation) {
    return {
      ok: true,
      googleStatus: 'not-requested',
      records: applied.records,
      message: applied.message,
      needsFirestoreResync: false,
    };
  }

  if (!accessToken) {
    return {
      ok: true,
      googleStatus: 'local-only',
      records: applied.records,
      message: partialMessage(operation.type),
      needsFirestoreResync: false,
    };
  }

  try {
    if (operation.type === 'google-create') {
      const googleEventId = await addEvent(applied.record, accessToken);
      if (!googleEventId) throw new Error('O Google Calendar não retornou o ID do evento.');
      const records = applied.records.map(event => String(event.id) === operation.eventId
        ? { ...event, googleEventId }
        : event);
      return {
        ok: true,
        googleStatus: 'synced',
        records,
        message: 'Evento criado e sincronizado com o Google Calendar.',
        needsFirestoreResync: true,
      };
    }

    if (operation.type === 'google-update') {
      const updated = await updateEvent(operation.googleEventId, applied.record, accessToken);
      if (!updated) throw new Error('O Google Calendar recusou a atualização.');
      return {
        ok: true,
        googleStatus: 'synced',
        records: applied.records,
        message: 'Evento atualizado no Organizador e no Google Calendar.',
        needsFirestoreResync: false,
      };
    }

    if (operation.type === 'google-delete') {
      const removed = await deleteEvent(operation.googleEventId, accessToken);
      if (!removed) throw new Error('O Google Calendar recusou a exclusão.');
      return {
        ok: true,
        googleStatus: 'synced',
        records: applied.records,
        message: 'Evento removido do Organizador e do Google Calendar.',
        needsFirestoreResync: false,
      };
    }

    throw new Error('Operação externa desconhecida.');
  } catch (error) {
    return {
      ok: true,
      googleStatus: 'local-only',
      records: applied.records,
      message: partialMessage(operation.type),
      warning: error.message || 'Falha na sincronização com o Google Calendar.',
      needsFirestoreResync: false,
    };
  }
}
