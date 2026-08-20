export const HABIT_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export const HABIT_FREQUENCIES = new Set(['todos_dias', 'dias_especificos', 'uma_vez']);

export const HABIT_COLOR_VALUES = {
  Azul: 'habit-color-blue',
  Oliva: 'habit-color-olive',
  Vinho: 'habit-color-wine',
  Roxo: 'habit-color-purple',
  Verde: 'habit-color-green',
  Grafite: 'habit-color-graphite',
};

export const HABIT_COLORS = new Set(Object.keys(HABIT_COLOR_VALUES));

export const normalizeHabitDays = (days) => {
  if (!Array.isArray(days)) return null;
  const uniqueDays = [...new Set(days.map(day => String(day || '').trim()).filter(Boolean))];
  if (!uniqueDays.length || uniqueDays.some(day => !HABIT_DAYS.includes(day))) return null;
  return HABIT_DAYS.filter(day => uniqueDays.includes(day));
};

export const recurrenceFromFrequency = (frequency, days = []) => {
  if (frequency === 'todos_dias') return 'Todos os dias';
  if (frequency === 'uma_vez') return 'Apenas uma vez';
  return days.join(', ');
};

export const frequencyFromHabit = (habit = {}) => {
  if (HABIT_FREQUENCIES.has(habit.frequency)) {
    return {
      frequency: habit.frequency,
      days: habit.frequency === 'dias_especificos'
        ? normalizeHabitDays(habit.days) || []
        : [],
    };
  }

  if (habit.recurrence === 'Apenas uma vez') return { frequency: 'uma_vez', days: [] };
  if (!habit.recurrence || habit.recurrence === 'Todos os dias') return { frequency: 'todos_dias', days: [] };
  return {
    frequency: 'dias_especificos',
    days: normalizeHabitDays(String(habit.recurrence).split(',').map(day => day.trim())) || [],
  };
};

export const habitColorLabel = (color = '') => {
  const entry = Object.entries(HABIT_COLOR_VALUES).find(([, value]) => value === color);
  if (entry) return entry[0];
  if (color.includes('4A85F6') || color.includes('blue')) return 'Azul';
  if (color.includes('olive')) return 'Oliva';
  if (color.includes('terracotta') || color.includes('wine') || color.includes('rose')) return 'Vinho';
  if (color.includes('FF9B6A') || color.includes('amber')) return 'Oliva';
  if (color.includes('9864F5') || color.includes('purple')) return 'Roxo';
  if (color.includes('10B981') || color.includes('emerald')) return 'Verde';
  return 'Grafite';
};

export const organizerDateKey = (now = new Date(), timeZone = 'America/Sao_Paulo') => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const toggleDailyHabitCompletion = (state = {}, habitId, dateKey = organizerDateKey()) => {
  const normalizedHabitId = String(habitId || '').trim();
  const completed = state.lastDate === dateKey && state.completed && typeof state.completed === 'object'
    ? state.completed
    : {};

  if (!normalizedHabitId) {
    return { lastDate: dateKey, completed: { ...completed } };
  }

  return {
    lastDate: dateKey,
    completed: {
      ...completed,
      [normalizedHabitId]: !completed[normalizedHabitId],
    },
  };
};
