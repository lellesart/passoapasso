export const GOOGLE_CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/**
 * Converte um evento do nosso formato para o formato esperado pelo Google Calendar
 */
const formatEventForGoogle = (event) => {
  // A data no app é no formato YYYY-MM-DD e hora HH:mm
  // Assumimos fuso horário local para simplificar, montando uma data ISO
  const startDateTime = new Date(`${event.date}T${event.time}:00`).toISOString();
  
  // Como não temos hora de término definida no app, definiremos 1 hora de duração padrão
  const endDateTime = new Date(new Date(startDateTime).getTime() + 60 * 60 * 1000).toISOString();

  // Configura lembretes. O defaultReminder deve estar em minutos.
  const overrides = [];
  if (event.reminderMinutes) {
    overrides.push({ method: 'popup', minutes: Number(event.reminderMinutes) });
  } else {
    // Padrão de 15 minutos se não especificado
    overrides.push({ method: 'popup', minutes: 15 });
  }

  return {
    summary: event.title,
    description: `Categoria: ${event.category}\nGerado pelo passo.a.passo`,
    start: {
      dateTime: startDateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    end: {
      dateTime: endDateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    reminders: {
      useDefault: false,
      overrides: overrides
    }
  };
};

/**
 * Adiciona um evento ao Google Calendar
 * @returns googleEventId (string) ou null em caso de falha
 */
export const addEventToGoogleCalendar = async (event, accessToken) => {
  if (!accessToken) return null;
  
  try {
    const response = await fetch(GOOGLE_CALENDAR_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formatEventForGoogle(event))
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || response.statusText;
      throw new Error(`Erro do Google: ${errorMessage}`);
    }
    
    const data = await response.json();
    return data.id; // Retorna o ID gerado pelo Google
  } catch (error) {
    console.error('Erro ao adicionar evento no Google Calendar:', error);
    throw error;
  }
};

/**
 * Atualiza um evento no Google Calendar
 */
export const updateEventInGoogleCalendar = async (googleEventId, event, accessToken) => {
  if (!accessToken || !googleEventId) return false;
  
  try {
    const response = await fetch(`${GOOGLE_CALENDAR_API_URL}/${googleEventId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formatEventForGoogle(event))
    });
    
    if (!response.ok) {
      throw new Error(`Google Calendar API Error: ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao atualizar evento no Google Calendar:', error);
    return false;
  }
};

/**
 * Deleta um evento do Google Calendar
 */
export const deleteEventFromGoogleCalendar = async (googleEventId, accessToken) => {
  if (!accessToken || !googleEventId) return false;
  
  try {
    const response = await fetch(`${GOOGLE_CALENDAR_API_URL}/${googleEventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Google Calendar API Error: ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao deletar evento no Google Calendar:', error);
    return false;
  }
};
