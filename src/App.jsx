import React, { lazy, Suspense, useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { auth, googleProvider, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, db, doc, setDoc, getDoc, onSnapshot, serverTimestamp } from './firebase/config';
import { addEventToGoogleCalendar, deleteEventFromGoogleCalendar } from './firebase/calendarAPI';
import {
  CheckSquare,
  Flame,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  RotateCcw,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Check,
  AlertCircle,
  Bell,
  Save,
  FileText,
  CloudSun,
  Droplets,
  Wind,
  Dumbbell,
  Apple,
  Activity,
  GraduationCap,
  Cloud,
  CloudOff,
  CloudRain,
  Sun,
  CloudLightning,
  Snowflake,
  MapPin,
  Loader2,
  Pencil,
  LogOut
} from 'lucide-react';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { applyConfirmedOrganizerAction, applyOrganizerUndo } from './services/ai/actionExecutor';
import { syncCalendarActionWithGoogle } from './services/ai/calendarActionSync';
import { frequencyFromHabit, organizerDateKey, toggleDailyHabitCompletion } from './services/ai/habitModel';
import { appendAuditEntry, createAuditEntry } from './services/ai/actionAudit';

const loadSecondaryViews = () => import('./components/SecondaryViews');
const GoogleCalendarSyncView = lazy(() => loadSecondaryViews().then(module => ({ default: module.GoogleCalendarSyncView })));
const AISetupView = lazy(() => loadSecondaryViews().then(module => ({ default: module.AISetupView })));
const ChatView = lazy(() => loadSecondaryViews().then(module => ({ default: module.ChatView })));
const LocalAIAssistant = lazy(() => import('./components/LocalAIAssistant').then(module => ({ default: module.LocalAIAssistant })));

// Mapas de Cores Pastéis Sólidas por Categoria (Sem bordas)
const CATEGORY_COLORS = {
  Trabalho: {
    bg: 'bg-blue-100',
    badge: 'text-blue-900 font-bold',
    accent: 'text-blue-700',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
    dot: 'bg-blue-500'
  },
  Pessoal: {
    bg: 'bg-purple-100',
    badge: 'text-purple-900 font-bold',
    accent: 'text-purple-700',
    button: 'bg-purple-600 hover:bg-purple-700 text-white',
    dot: 'bg-purple-500'
  },
  Saúde: {
    bg: 'bg-emerald-100',
    badge: 'text-emerald-900 font-bold',
    accent: 'text-emerald-700',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    dot: 'bg-emerald-500'
  },
  Estudos: {
    bg: 'bg-amber-100',
    badge: 'text-amber-900 font-bold',
    accent: 'text-amber-700',
    button: 'bg-amber-600 hover:bg-amber-700 text-white',
    dot: 'bg-amber-500'
  },
  Compras: {
    bg: 'bg-amber-100',
    badge: 'text-amber-900 font-bold',
    accent: 'text-amber-700',
    button: 'bg-amber-600 hover:bg-amber-700 text-white',
    dot: 'bg-amber-500'
  },
  'Bem-estar': {
    bg: 'bg-rose-100',
    badge: 'text-rose-900 font-bold',
    accent: 'text-rose-700',
    button: 'bg-rose-600 hover:bg-rose-700 text-white',
    dot: 'bg-rose-500'
  }
};

const DEFAULT_COLOR = {
  bg: 'bg-stone-100',
  badge: 'text-stone-900 font-bold',
  accent: 'text-stone-700',
  button: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  dot: 'bg-stone-500'
};

const getCategoryStyle = (cat) => CATEGORY_COLORS[cat] || DEFAULT_COLOR;

const NOTE_CATEGORIES = ['Trabalho', 'Pessoal', 'Saúde', 'Estudos', 'Compras'];
const TASK_CATEGORIES = ['Trabalho', 'Pessoal', 'Saúde', 'Estudos'];
const HABIT_COLOR_OPTIONS = [
  { label: 'Azul arquivo', value: 'habit-color-blue', swatch: 'habit-swatch-blue' },
  { label: 'Verde oliva', value: 'habit-color-olive', swatch: 'habit-swatch-olive' },
  { label: 'Vinho', value: 'habit-color-wine', swatch: 'habit-swatch-wine' },
  { label: 'Roxo editorial', value: 'habit-color-purple', swatch: 'habit-swatch-purple' },
  { label: 'Verde profundo', value: 'habit-color-green', swatch: 'habit-swatch-green' },
  { label: 'Grafite', value: 'habit-color-graphite', swatch: 'habit-swatch-graphite' },
];

const getShoppingItems = (note) => {
  if (Array.isArray(note?.items)) return note.items;

  return String(note?.content || '')
    .split('\n')
    .map(item => item.replace(/^[\s•*-]+/, '').trim())
    .filter(Boolean)
    .map((text, index) => ({
      id: `${note?.id || 'shopping'}-${index}`,
      text,
      checked: false
    }));
};

const createShoppingItems = (items, noteId) => items
  .map(item => item.trim())
  .filter(Boolean)
  .map((text, index) => ({ id: `${noteId}-${index}`, text, checked: false }));

const toggleShoppingItemInNotes = (notes, noteId, itemIndex) => notes.map(note => {
  if (note.id !== noteId) return note;

  const items = getShoppingItems(note).map((item, index) => (
    index === itemIndex ? { ...item, checked: !item.checked } : item
  ));

  return { ...note, items };
});

function ShoppingListComposer({ items, onChange }) {
  const updateItem = (index, text) => {
    onChange(items.map((item, itemIndex) => itemIndex === index ? text : item));
  };

  const addItem = () => onChange([...items, '']);

  const removeItem = (index) => {
    const nextItems = items.filter((_, itemIndex) => itemIndex !== index);
    onChange(nextItems.length > 0 ? nextItems : ['']);
  };

  return (
    <div className="shopping-composer" aria-label="Itens da lista de compras">
      {items.map((item, index) => (
        <div className="shopping-composer-row" key={index}>
          <span className="shopping-composer-check" aria-hidden="true"></span>
          <input
            type="text"
            value={item}
            onChange={(event) => updateItem(index, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addItem();
              }
            }}
            placeholder={index === 0 ? 'Adicionar item...' : 'Próximo item...'}
            aria-label={`Item ${index + 1}`}
          />
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="shopping-composer-remove"
            aria-label={`Remover item ${index + 1}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button type="button" onClick={addItem} className="shopping-composer-add">
        <Plus className="w-3.5 h-3.5" />
        <span>Adicionar item</span>
      </button>
    </div>
  );
}

function ShoppingListContent({ note, preview = false, onToggleItem }) {
  const items = getShoppingItems(note);

  if (items.length === 0) {
    return <p className="shopping-list-empty">A lista ainda não possui itens.</p>;
  }

  return (
    <div className={`shopping-list ${preview ? 'is-preview' : ''}`}>
      {items.map((item, index) => {
        const content = (
          <>
            <span className="shopping-list-check" aria-hidden="true">
              {item.checked && <Check className="w-3 h-3" />}
            </span>
            <span className={item.checked ? 'is-checked' : ''}>{item.text}</span>
          </>
        );

        return preview ? (
          <div className="shopping-list-item" key={item.id || index}>{content}</div>
        ) : (
          <button
            type="button"
            className="shopping-list-item"
            key={item.id || index}
            onClick={() => onToggleItem?.(index)}
            aria-label={`${item.checked ? 'Desmarcar' : 'Marcar'} ${item.text}`}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

function TaskEditDialog({ task, onCancel, onSave }) {
  const [title, setTitle] = useState(task.title || '');
  const [category, setCategory] = useState(task.category || 'Trabalho');
  const [dueDate, setDueDate] = useState(task.dueDate || '');

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    onSave({ ...task, title: title.trim(), category, dueDate: dueDate || null });
  };

  return (
    <div className="note-viewer-overlay fixed inset-0 z-50 flex items-center justify-center p-5 sm:p-8">
      <div className="note-viewer-backdrop fixed inset-0" onClick={onCancel}></div>
      <article className="record-editor relative z-10" role="dialog" aria-modal="true" aria-labelledby="task-editor-title">
        <header className="record-editor-header">
          <div>
            <span className="note-drawer-kicker">Tarefa ativa · edição</span>
            <h2 id="task-editor-title">Editar tarefa</h2>
          </div>
          <button type="button" onClick={onCancel} className="note-drawer-close" aria-label="Fechar edição da tarefa">
            <X className="w-5 h-5" />
          </button>
        </header>
        <form onSubmit={handleSubmit} className="record-editor-form">
          <label className="record-editor-field">
            <span className="note-label">Título</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
          </label>
          <fieldset className="record-editor-field">
            <legend className="note-label">Categoria</legend>
            <div className="note-category-list" role="group" aria-label="Categoria da tarefa">
              {TASK_CATEGORIES.map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCategory(option)}
                  className={`note-category-option ${category === option ? 'is-selected' : ''}`}
                  aria-pressed={category === option}
                >
                  <span className="note-category-dot" />
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="record-editor-field">
            <span className="note-label">Prazo · opcional</span>
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>
          <div className="record-editor-actions">
            <button type="button" onClick={onCancel} className="note-cancel-button">Cancelar</button>
            <button type="submit" className="note-save-button">
              <Save className="w-4 h-4" />
              <span>Salvar alterações</span>
            </button>
          </div>
        </form>
      </article>
    </div>
  );
}

function NoteEditForm({ note, onCancel, onSave }) {
  const [title, setTitle] = useState(note.title || '');
  const [category, setCategory] = useState(note.category || 'Trabalho');
  const [content, setContent] = useState(note.content || '');
  const [shoppingItems, setShoppingItems] = useState(() => {
    const items = getShoppingItems(note).map(item => item.text);
    return items.length > 0 ? items : [''];
  });

  const changeCategory = (nextCategory) => {
    if (nextCategory === 'Compras' && category !== 'Compras') {
      const contentItems = content.split('\n').map(item => item.replace(/^[\s•*-]+/, '').trim()).filter(Boolean);
      setShoppingItems(contentItems.length > 0 ? contentItems : ['']);
    }
    if (category === 'Compras' && nextCategory !== 'Compras') {
      setContent(shoppingItems.map(item => item.trim()).filter(Boolean).join('\n'));
    }
    setCategory(nextCategory);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!title.trim()) return;

    const updatedNote = { ...note, title: title.trim(), category };
    if (category === 'Compras') {
      const previousItems = getShoppingItems(note);
      const items = shoppingItems
        .map(item => item.trim())
        .filter(Boolean)
        .map((text, index) => ({
          id: previousItems[index]?.id || `${note.id}-${Date.now()}-${index}`,
          text,
          checked: Boolean(previousItems[index]?.checked)
        }));
      updatedNote.items = items;
      updatedNote.content = items.map(item => item.text).join('\n');
    } else {
      updatedNote.content = content.trim();
      delete updatedNote.items;
    }
    onSave(updatedNote);
  };

  return (
    <form onSubmit={handleSubmit} className="note-edit-form">
      <label className="record-editor-field">
        <span className="note-label">Título</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
      </label>
      <fieldset className="record-editor-field">
        <legend className="note-label">Categoria</legend>
        <div className="note-category-list" role="group" aria-label="Categoria da nota">
          {NOTE_CATEGORIES.map(option => (
            <button
              key={option}
              type="button"
              onClick={() => changeCategory(option)}
              className={`note-category-option ${category === option ? 'is-selected' : ''}`}
              aria-pressed={category === option}
            >
              <span className="note-category-dot" />
              {option}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="record-editor-field">
        <span className="note-label">{category === 'Compras' ? 'Itens' : 'Conteúdo'}</span>
        {category === 'Compras' ? (
          <ShoppingListComposer items={shoppingItems} onChange={setShoppingItems} />
        ) : (
          <textarea value={content} onChange={(event) => setContent(event.target.value)} rows="8"></textarea>
        )}
      </div>
      <div className="record-editor-actions">
        <button type="button" onClick={onCancel} className="note-cancel-button">Cancelar</button>
        <button type="submit" className="note-save-button">
          <Save className="w-4 h-4" />
          <span>Salvar alterações</span>
        </button>
      </div>
    </form>
  );
}

function HabitEditForm({ habit, onCancel, onSave }) {
  const daysOfWeek = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const currentSchedule = frequencyFromHabit(habit);
  const [name, setName] = useState(habit.name || '');
  const [color, setColor] = useState(habit.color || 'habit-color-green');
  const [recurrenceType, setRecurrenceType] = useState(currentSchedule.frequency);
  const [selectedDays, setSelectedDays] = useState(currentSchedule.days);

  useEffect(() => {
    const nextSchedule = frequencyFromHabit(habit);
    setName(habit.name || '');
    setColor(habit.color || 'habit-color-green');
    setRecurrenceType(nextSchedule.frequency);
    setSelectedDays(nextSchedule.days);
  }, [habit]);

  const toggleDay = (day) => {
    setSelectedDays(prev => (
      prev.includes(day)
        ? prev.filter(item => item !== day)
        : [...prev, day]
    ));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) return;

    let recurrence = 'Todos os dias';
    let nextDays = [];

    if (recurrenceType === 'uma_vez') {
      recurrence = 'Apenas uma vez';
    } else if (recurrenceType === 'dias_especificos') {
      const uniqueDays = [...new Set(selectedDays)];
      if (uniqueDays.length === 0) {
        toast.error('Selecione pelo menos um dia!');
        return;
      }
      nextDays = daysOfWeek.filter(day => uniqueDays.includes(day));
      recurrence = nextDays.join(', ');
    }

    onSave({
      ...habit,
      name: nextName,
      color,
      recurrence,
      frequency: recurrenceType,
      days: nextDays,
    });
  };

  return (
    <div className="note-viewer-overlay fixed inset-0 z-50 flex items-center justify-center p-5 sm:p-8">
      <div className="note-viewer-backdrop fixed inset-0" onClick={onCancel}></div>
      <article className="record-editor relative z-10" role="dialog" aria-modal="true" aria-labelledby="habit-editor-title">
        <header className="record-editor-header">
          <div>
            <span className="note-drawer-kicker">Hábito ativo · edição</span>
            <h2 id="habit-editor-title">Editar hábito</h2>
          </div>
          <button type="button" onClick={onCancel} className="note-drawer-close" aria-label="Fechar edição do hábito">
            <X className="w-5 h-5" />
          </button>
        </header>
        <form onSubmit={handleSubmit} className="record-editor-form">
          <label className="record-editor-field">
            <span className="note-label">Nome</span>
            <input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </label>
          <fieldset className="record-editor-field">
            <legend className="note-label">Tom do registro</legend>
            <div className="habit-color-options habit-edit-color-options" role="group" aria-label="Cor do hábito">
              {HABIT_COLOR_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setColor(option.value)}
                  aria-label={`Selecionar cor ${option.label}`}
                  title={option.label}
                  className={`habit-color-swatch ${option.swatch} ${color === option.value ? 'is-selected' : ''}`}
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="record-editor-field">
            <legend className="note-label">Frequência</legend>
            <div className="habit-recurrence-options habit-edit-recurrence-options">
              <button type="button" onClick={() => setRecurrenceType('todos_dias')} className={`habit-recurrence-option ${recurrenceType === 'todos_dias' ? 'is-selected' : ''}`}>Todos os dias</button>
              <button type="button" onClick={() => setRecurrenceType('dias_especificos')} className={`habit-recurrence-option ${recurrenceType === 'dias_especificos' ? 'is-selected' : ''}`}>Dias específicos</button>
              <button type="button" onClick={() => setRecurrenceType('uma_vez')} className={`habit-recurrence-option ${recurrenceType === 'uma_vez' ? 'is-selected' : ''}`}>Apenas uma vez</button>
            </div>

            {recurrenceType === 'dias_especificos' && (
              <div className="habit-day-options habit-edit-day-options">
                {daysOfWeek.map(day => (
                  <button
                    type="button"
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`habit-day-option ${selectedDays.includes(day) ? 'is-selected' : ''}`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            )}
          </fieldset>
          <div className="record-editor-actions">
            <button type="button" onClick={onCancel} className="note-cancel-button">Cancelar</button>
            <button type="submit" className="note-save-button">
              <Save className="w-4 h-4" />
              <span>Salvar alterações</span>
            </button>
          </div>
        </form>
      </article>
    </div>
  );
}

const getHabitTone = (color = '') => {
  if (color.includes('4A85F6') || color.includes('blue')) return 'blue';
  if (color.includes('FF9B6A')) return 'olive';
  if (color.includes('olive')) return 'olive';
  if (color.includes('wine') || color.includes('terracotta') || color.includes('rose')) return 'wine';
  if (color.includes('amber') || color.includes('yellow')) return 'olive';
  if (color.includes('9864F5') || color.includes('purple')) return 'purple';
  if (color.includes('10B981') || color.includes('emerald')) return 'green';
  return 'graphite';
};

const ORGANIZER_SCHEMA_VERSION = 2;

const createEmptyOrganizerData = () => ({
  tasks: [],
  habits: [],
  notes: [],
  events: [],
  dailyHabitsState: {
    lastDate: organizerDateKey(),
    completed: {}
  },
  aiActionAudit: [],
});

const createOrganizerMetadata = (currentUser, { includeCreatedAt = false } = {}) => ({
  ownerUid: currentUser.uid,
  ownerEmail: currentUser.email || null,
  schemaVersion: ORGANIZER_SCHEMA_VERSION,
  updatedAt: serverTimestamp(),
  ...(includeCreatedAt ? { createdAt: serverTimestamp() } : {}),
});

const createEmptyUserDocument = (currentUser) => ({
  ...createEmptyOrganizerData(),
  ...createOrganizerMetadata(currentUser, { includeCreatedAt: true }),
});

const normalizeStoredHabits = (habits = []) => habits.map(habit => (
  habit.id === 'h_dieta' && (
    String(habit.color || '').includes('FF9B6A')
    || String(habit.color || '').includes('amber')
  )
    ? {
        ...habit,
        color: 'habit-color-olive',
        iconColor: 'text-[#5E6F3B]',
      }
    : habit
));

const normalizeDemoId = (value = '') => String(value).trim();

const DEMO_TASK_IDS = new Set(['1', '2', '3', '4', '5', '6']);
const DEMO_NOTE_IDS = new Set(['n1', 'n2']);
const DEMO_EVENT_IDS = new Set(['e1', 'e2', 'e3']);
const DEMO_HABIT_IDS = new Set(['h_treino', 'h_dieta', 'h_cardio', 'h_estudo']);

const removeDemoItems = (items, demoIds) => (
  Array.isArray(items)
    ? items.filter(item => !demoIds.has(normalizeDemoId(item?.id)))
    : []
);

const normalizeOrganizerData = (data = {}) => ({
  tasks: removeDemoItems(data.tasks, DEMO_TASK_IDS),
  notes: removeDemoItems(data.notes, DEMO_NOTE_IDS),
  events: removeDemoItems(data.events, DEMO_EVENT_IDS),
  habits: normalizeStoredHabits(removeDemoItems(data.habits, DEMO_HABIT_IDS)),
  dailyHabitsState: data.dailyHabitsState || {
    lastDate: organizerDateKey(),
    completed: {}
  },
  aiActionAudit: Array.isArray(data.aiActionAudit) ? data.aiActionAudit : [],
});

const summarizeOrganizerDocument = (currentUser, snapshot) => {
  const data = snapshot.exists() ? snapshot.data() : {};
  const visibleData = normalizeOrganizerData(data);

  return {
    id: currentUser.uid,
    caminho: `users/${currentUser.uid}`,
    tipo: 'principal_uid',
    existe: snapshot.exists(),
    ownerUid: data.ownerUid || null,
    ownerEmail: data.ownerEmail || null,
    schemaVersion: data.schemaVersion || null,
    brutos: {
      tarefas: Array.isArray(data.tasks) ? data.tasks.length : 0,
      habitos: Array.isArray(data.habits) ? data.habits.length : 0,
      notas: Array.isArray(data.notes) ? data.notes.length : 0,
      eventos: Array.isArray(data.events) ? data.events.length : 0,
    },
    visiveis_sem_demo: {
      tarefas: visibleData.tasks.length,
      habitos: visibleData.habits.length,
      notas: visibleData.notes.length,
      eventos: visibleData.events.length,
    },
  };
};

const SYNC_FIELD_LABELS = {
  tasks: 'tarefas',
  habits: 'hábitos',
  notes: 'notas',
  events: 'eventos',
  dailyHabitsState: 'hábitos do dia',
  aiActionAudit: 'histórico da IA',
};

const createInitialSyncStatus = () => ({
  state: 'idle',
  label: 'Aguardando alterações',
  detail: 'Os dados serão salvos nesta conta.',
  updatedAt: null,
});

const formatSyncStatusTime = (value) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
};

const persistOrganizerChange = async (syncToFirestore, field, data, successMessage) => {
  if (!syncToFirestore) {
    toast.error('Sincronização indisponível. A alteração ficou apenas local.');
    return false;
  }

  const result = await syncToFirestore(field, data);
  if (!result.ok) return false;

  if (successMessage) toast.success(successMessage);
  return true;
};

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function WeatherWidget() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [city, setCity] = useState("Sua Localização");

  useEffect(() => {
    const fetchWeather = async (latitude, longitude, defaultCityName) => {
      try {
        if (defaultCityName) {
          setCity(defaultCityName);
        } else {
          try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
            if (geoRes.ok) {
              const geoData = await geoRes.json();
              setCity(geoData.address.city || geoData.address.town || geoData.address.village || "Localização Atual");
            }
          } catch {}
        }

        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`);
        if (!weatherRes.ok) throw new Error("Erro ao buscar clima");
        const weatherData = await weatherRes.json();
        
        setWeather({
          temp: Math.round(weatherData.current_weather.temperature),
          windSpeed: Math.round(weatherData.current_weather.windspeed),
          weatherCode: weatherData.current_weather.weathercode,
          maxTemp: Math.round(weatherData.daily.temperature_2m_max[0]),
          minTemp: Math.round(weatherData.daily.temperature_2m_min[0]),
          humidity: weatherData.hourly.relative_humidity_2m[0] ?? 60,
        });
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (!navigator.geolocation) {
      fetchWeather(-22.9068, -43.1729, "Rio de Janeiro");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchWeather(position.coords.latitude, position.coords.longitude, null);
      },
      () => {
        // Fallback
        fetchWeather(-22.9068, -43.1729, "Rio de Janeiro");
      }
    );
  }, []);

  const getWeatherDetails = (code) => {
    if (code === 0) return { label: 'Ensolarado', icon: Sun, color: 'text-amber-500', bg: 'bg-amber-100' };
    if (code >= 1 && code <= 3) return { label: 'Parcialmente Nublado', icon: CloudSun, color: 'text-amber-600', bg: 'bg-amber-100' };
    if (code >= 45 && code <= 48) return { label: 'Neblina', icon: Cloud, color: 'text-stone-500', bg: 'bg-stone-100' };
    if (code >= 51 && code <= 67) return { label: 'Chuvoso', icon: CloudRain, color: 'text-blue-500', bg: 'bg-blue-100' };
    if (code >= 71 && code <= 77) return { label: 'Neve', icon: Snowflake, color: 'text-sky-500', bg: 'bg-sky-100' };
    if (code >= 95 && code <= 99) return { label: 'Tempestade', icon: CloudLightning, color: 'text-purple-500', bg: 'bg-purple-100' };
    return { label: 'Nublado', icon: Cloud, color: 'text-stone-500', bg: 'bg-stone-100' };
  };

  if (loading) {
    return (
      <div className="weather-brief is-loading" aria-label="Carregando clima">
        <span className="weather-brief-kicker">Clima local</span>
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="weather-brief is-unavailable">
        <span className="weather-brief-kicker">Clima local</span>
        <div className="weather-brief-unavailable">
          <CloudSun className="w-4 h-4" />
          <span>Dados indisponíveis</span>
        </div>
      </div>
    );
  }

  const { icon: WeatherIcon, label } = getWeatherDetails(weather.weatherCode);

  return (
    <aside className="weather-brief" aria-label={`Clima em ${city}`}>
      <div className="weather-brief-header">
        <span className="weather-brief-kicker">Clima local</span>
        <span className="weather-brief-location"><MapPin className="w-3 h-3" />{city}</span>
      </div>

      <div className="weather-brief-current">
        <WeatherIcon className="weather-brief-icon w-6 h-6" />
        <strong>{weather.temp}<sup>°</sup></strong>
        <span>{label}</span>
      </div>

      <div className="weather-brief-metrics">
        <span>Máx. {weather.maxTemp}° · Mín. {weather.minTemp}°</span>
        <span><Droplets className="w-3 h-3" />{weather.humidity}%</span>
        <span><Wind className="w-3 h-3" />{weather.windSpeed} km/h</span>
      </div>
    </aside>
  );
}

function ViewLoading() {
  return (
    <div className="view-loading" role="status" aria-live="polite">
      <span>[</span>
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>]</span>
      <p>Organizando a página</p>
    </div>
  );
}

function SyncStatusBadge({ status }) {
  const state = status?.state || 'idle';
  const Icon = state === 'saving'
    ? Loader2
    : state === 'offline'
      ? CloudOff
      : state === 'error'
      ? AlertCircle
      : state === 'saved'
        ? CheckCircle2
        : Cloud;

  return (
    <div className={`sync-status-badge sync-status-${state}`} role="status" aria-live="polite">
      <Icon className={`w-3.5 h-3.5 ${state === 'saving' ? 'animate-spin' : ''}`} />
      <div>
        <span>{status?.label || 'Aguardando alterações'}</span>
        <small>
          {state === 'saved' && status?.updatedAt
            ? `Último salvamento às ${formatSyncStatusTime(status.updatedAt)}`
            : status?.detail || 'Dados vinculados à conta ativa'}
        </small>
      </div>
    </div>
  );
}

export default function App() {
  const prefersReducedMotion = useReducedMotion();
  const appMainRef = useRef(null);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (['dashboard', 'calendar', 'google_calendar', 'tasks', 'habits', 'notes', 'pomodoro', 'chat', 'ai_setup', 'trash'].includes(hash)) {
        return hash;
      }
    }
    return 'dashboard';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleTabChange = (tabId, replace = false) => {
    setActiveTab(tabId);
    if (typeof window !== 'undefined') {
      const stateObj = { tab: tabId };
      if (replace) {
        window.history.replaceState(stateObj, '', `#${tabId}`);
      } else {
        window.history.pushState(stateObj, '', `#${tabId}`);
      }
    }
  };

  useEffect(() => {
    const handlePopState = (e) => {
      const tabFromHash = window.location.hash.replace('#', '');
      const tabFromState = e.state?.tab;
      const targetTab = tabFromState || tabFromHash || 'dashboard';
      setActiveTab(targetTab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      appMainRef.current?.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeTab, prefersReducedMotion]);

  // Authentication State
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState(null);
  const [syncStatus, setSyncStatus] = useState(createInitialSyncStatus);

  useEffect(() => {
    const markOffline = () => {
      setSyncStatus({
        state: 'offline',
        label: 'Modo local',
        detail: 'Sem conexão. Alterações podem não sincronizar.',
        updatedAt: new Date().toISOString(),
      });
    };

    const markOnline = () => {
      setSyncStatus({
        state: 'idle',
        label: 'Conexão restaurada',
        detail: 'Novas alterações serão sincronizadas.',
        updatedAt: new Date().toISOString(),
      });
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) markOffline();

    window.addEventListener('offline', markOffline);
    window.addEventListener('online', markOnline);
    return () => {
      window.removeEventListener('offline', markOffline);
      window.removeEventListener('online', markOnline);
    };
  }, []);

  useEffect(() => {
    let unsubscribeDb = null;
    let authRunId = 0;
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      const runId = authRunId + 1;
      authRunId = runId;

      if (unsubscribeDb) {
        unsubscribeDb();
        unsubscribeDb = null;
      }

        setUser(currentUser);
      
      if (currentUser) {
        setIsAuthLoading(true);
        setSyncStatus({
          state: 'saving',
          label: 'Carregando registros',
          detail: 'Buscando dados vinculados a esta conta.',
          updatedAt: null,
        });
        const emptyData = createEmptyOrganizerData();
        setTasks(emptyData.tasks);
        setHabits(emptyData.habits);
        setNotes(emptyData.notes);
        setEvents(emptyData.events);
        setDailyHabitsState(emptyData.dailyHabitsState);
        aiActionAuditRef.current = emptyData.aiActionAudit;
        setAIActionAudit(emptyData.aiActionAudit);

        const userRef = doc(db, 'users', currentUser.uid);

        try {
          const userSnapshot = await getDoc(userRef);

          if (runId !== authRunId) return;

          if (!userSnapshot.exists()) {
            await setDoc(userRef, createEmptyUserDocument(currentUser));
          } else {
            const userData = userSnapshot.data();
            if (
              userData.ownerUid !== currentUser.uid
              || userData.ownerEmail !== (currentUser.email || null)
              || userData.schemaVersion !== ORGANIZER_SCHEMA_VERSION
            ) {
              await setDoc(userRef, createOrganizerMetadata(currentUser), { merge: true });
            }
          }
        } catch (error) {
          if (runId !== authRunId) return;
          console.error('Erro ao preparar documento do usuário:', error);
          setSyncStatus({
            state: 'error',
            label: 'Erro ao preparar dados',
            detail: 'Não foi possível abrir o documento desta conta.',
            updatedAt: new Date().toISOString(),
          });
          toast.error('Não foi possível preparar seus dados. Tente sair e entrar novamente.');
          setIsAuthLoading(false);
          return;
        }

        if (runId !== authRunId) return;

        unsubscribeDb = onSnapshot(userRef, (docSnap) => {
          if (runId !== authRunId) return;
          if (docSnap.exists()) {
            const rawData = docSnap.data();
            const data = normalizeOrganizerData(rawData);

            setTasks(data.tasks);
            setHabits(data.habits);
            setNotes(data.notes);
            setEvents(data.events);
            aiActionAuditRef.current = data.aiActionAudit;
            setAIActionAudit(data.aiActionAudit);

            if (data.dailyHabitsState) {
              const today = organizerDateKey();
              const stateDate = data.dailyHabitsState.lastDate || data.dailyHabitsState.currentDate;
              if (stateDate !== today) {
                const resetState = { lastDate: today, completed: {} };
                setDailyHabitsState(resetState);
                setDoc(userRef, {
                  dailyHabitsState: resetState,
                  ...createOrganizerMetadata(currentUser),
                }, { merge: true }).catch(console.error);
              } else {
                setDailyHabitsState({
                  lastDate: today,
                  completed: data.dailyHabitsState.completed || {},
                });
              }
            }
            setSyncStatus({
              state: 'saved',
              label: 'Dados carregados',
              detail: 'Registros sincronizados com esta conta.',
              updatedAt: new Date().toISOString(),
            });
            setIsAuthLoading(false);
          } else {
            const initialData = createEmptyOrganizerData();
            setTasks(initialData.tasks);
            setHabits(initialData.habits);
            setNotes(initialData.notes);
            setEvents(initialData.events);
            setDailyHabitsState(initialData.dailyHabitsState);
            aiActionAuditRef.current = initialData.aiActionAudit;
            setAIActionAudit(initialData.aiActionAudit);
            setDoc(userRef, createEmptyUserDocument(currentUser)).catch(console.error);
            setSyncStatus({
              state: 'saved',
              label: 'Conta preparada',
              detail: 'Novo organizador iniciado vazio.',
              updatedAt: new Date().toISOString(),
            });
            setIsAuthLoading(false);
          }
        }, (error) => {
          if (runId !== authRunId) return;
          console.error('Erro ao carregar dados do usuário:', error);
          setSyncStatus({
            state: 'error',
            label: 'Erro ao carregar dados',
            detail: 'A conexão com seus registros falhou.',
            updatedAt: new Date().toISOString(),
          });
          toast.error('Não foi possível carregar seus dados. Tente sair e entrar novamente.');
          setIsAuthLoading(false);
        });
      } else {
        if (unsubscribeDb) unsubscribeDb();
        const emptyData = createEmptyOrganizerData();
        setTasks(emptyData.tasks);
        setHabits(emptyData.habits);
        setNotes(emptyData.notes);
        setEvents(emptyData.events);
        setDailyHabitsState(emptyData.dailyHabitsState);
        aiActionAuditRef.current = emptyData.aiActionAudit;
        setAIActionAudit(emptyData.aiActionAudit);
        setGoogleAccessToken(null);
        setSyncStatus(createInitialSyncStatus());
        setIsAuthLoading(false);
      }
    });
    
    return () => {
      authRunId += 1;
      unsubscribeAuth();
      if (unsubscribeDb) unsubscribeDb();
    };
  }, []);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential && credential.accessToken) {
        setGoogleAccessToken(credential.accessToken);
        toast.success("Conta vinculada ao Google Calendar com sucesso!");
      }
    } catch (error) {
      console.error("Erro no login:", error);
      toast.error("Erro ao fazer login. Tente novamente.");
    }
  };

  const handleLogout = async () => {
    try {
      setGoogleAccessToken(null);
      setMobileMenuOpen(false);
      const emptyData = createEmptyOrganizerData();
      setTasks(emptyData.tasks);
      setHabits(emptyData.habits);
      setNotes(emptyData.notes);
      setEvents(emptyData.events);
      setDailyHabitsState(emptyData.dailyHabitsState);
      aiActionAuditRef.current = emptyData.aiActionAudit;
      setAIActionAudit(emptyData.aiActionAudit);
      setSyncStatus(createInitialSyncStatus());
      await signOut(auth);
      toast.success("Você saiu da conta.");
    } catch (error) {
      console.error("Erro ao sair:", error);
      toast.error("Erro ao sair da conta. Tente novamente.");
    }
  };

  const syncToFirestore = useCallback(async (field, data) => {
    const fieldLabel = SYNC_FIELD_LABELS[field] || 'dados';
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const message = 'Sem conexão com a internet.';
      setSyncStatus({
        state: 'offline',
        label: 'Modo local',
        detail: `Não foi possível salvar ${fieldLabel}.`,
        updatedAt: new Date().toISOString(),
      });
      toast.error('Alteração feita apenas localmente.', {
        description: 'Conecte-se à internet e tente novamente antes de fechar o app.',
      });
      return { ok: false, error: message };
    }

    if (!user) {
      const message = 'Usuário não autenticado.';
      setSyncStatus({
        state: 'error',
        label: 'Falha ao sincronizar',
        detail: message,
        updatedAt: new Date().toISOString(),
      });
      toast.error('Alteração não sincronizada.', {
        description: message,
      });
      return { ok: false, error: message };
    }

    setSyncStatus({
      state: 'saving',
      label: `Salvando ${fieldLabel}`,
      detail: 'Enviando alteração para sua conta.',
      updatedAt: null,
    });

    try {
      await setDoc(doc(db, 'users', user.uid), {
        [field]: data,
        ...createOrganizerMetadata(user),
      }, { merge: true });
      const savedAt = new Date().toISOString();
      setSyncStatus({
        state: 'saved',
        label: `${fieldLabel.charAt(0).toUpperCase()}${fieldLabel.slice(1)} salvos`,
        detail: 'Alteração confirmada no Firebase.',
        updatedAt: savedAt,
      });
      return { ok: true, updatedAt: savedAt };
    } catch (e) {
      console.error(`Erro ao sincronizar ${field}:`, e);
      const message = e.message || `Falha ao sincronizar ${fieldLabel}.`;
      setSyncStatus({
        state: 'error',
        label: 'Falha ao sincronizar',
        detail: `${fieldLabel}: ${message}`,
        updatedAt: new Date().toISOString(),
      });
      toast.error('Alteração feita apenas localmente.', {
        description: `Não consegui salvar ${fieldLabel}. Tente novamente antes de fechar o app.`,
      });
      return { ok: false, error: message };
    }
  }, [user]);

  // ESTADOS PRINCIPAIS
  const [tasks, setTasks] = useState([]);
  const [habits, setHabits] = useState([]);
  const [notes, setNotes] = useState([]);
  const [events, setEvents] = useState([]);
  const [, setAIActionAudit] = useState([]);
  const aiActionAuditRef = useRef([]);
  const aiUndoActionsRef = useRef(new Map());

  const registerAIUndo = useCallback((undo) => {
    if (!undo) return null;
    const now = Date.now();
    const entries = [...aiUndoActionsRef.current.entries()]
      .filter(([, value]) => now - value.createdAt < 10 * 60 * 1000)
      .slice(-9);
    aiUndoActionsRef.current = new Map(entries);
    const undoId = `undo-${now}-${Math.random().toString(36).slice(2, 8)}`;
    aiUndoActionsRef.current.set(undoId, { undo: structuredClone(undo), createdAt: now });
    return undoId;
  }, []);

  const recordAIAssistantAudit = useCallback(async (auditData) => {
    const entry = createAuditEntry(auditData);
    const nextEntries = appendAuditEntry(aiActionAuditRef.current, entry);
    aiActionAuditRef.current = nextEntries;
    setAIActionAudit(nextEntries);
    const syncResult = await syncToFirestore('aiActionAudit', nextEntries);
    return { ok: syncResult.ok, entry };
  }, [syncToFirestore]);

  const executeAIAssistantAction = async (proposal) => {
    const applied = applyConfirmedOrganizerAction(proposal, {
      tasks,
      notes,
      events,
      habits,
      dailyHabitsState,
      googleCalendarConnected: Boolean(googleAccessToken),
    });
    if (!applied.ok) return applied;
    const withUndo = (result, undo = applied.undo) => ({
      ...result,
      undoId: registerAIUndo(undo),
    });

    if (applied.collection === 'tasks') setTasks(applied.records);
    if (applied.collection === 'notes') setNotes(applied.records);
    if (applied.collection === 'events') setEvents(applied.records);
    if (applied.collection === 'habits') setHabits(applied.records);
    if (applied.collection === 'dailyHabitsState') setDailyHabitsState(applied.records);

    if (applied.collection === 'events') {
      const googleResult = await syncCalendarActionWithGoogle(applied, {
        accessToken: googleAccessToken,
      });
      setEvents(googleResult.records);

      const firestoreResult = await syncToFirestore('events', googleResult.records);

      if (googleResult.needsFirestoreResync) {
        if (!firestoreResult.ok) {
          const message = 'Evento criado no Organizador e no Google Calendar, mas o vínculo entre os dois não foi salvo no Firebase.';
          toast.error(message);
          return withUndo({ ok: true, collection: 'events', message, syncStatus: 'partial' }, {
            ...applied.undo,
            googleOperationSucceeded: googleResult.googleStatus === 'synced',
          });
        }
      } else if (!firestoreResult.ok && googleResult.googleStatus !== 'synced') {
        const message = `${googleResult.message} A alteração ficou local, mas não foi sincronizada com o Firebase.`;
        toast.error(message);
        return withUndo({
          ok: true,
          collection: 'events',
          message,
          syncStatus: 'local-only',
        }, { ...applied.undo, googleOperationSucceeded: false });
      }

      if (googleResult.googleStatus === 'local-only') {
        toast.error(googleResult.message);
        return withUndo({
          ok: true,
          collection: 'events',
          message: googleResult.message,
          syncStatus: 'local-only',
        }, { ...applied.undo, googleOperationSucceeded: false });
      }

      if (!firestoreResult.ok) {
        const message = 'Evento criado no Organizador e no Google Calendar, mas não foi possível salvar a atualização no Firebase.';
        toast.error(message);
        return withUndo({
          ok: true,
          collection: 'events',
          message,
          syncStatus: 'partial',
        }, {
          ...applied.undo,
          googleOperationSucceeded: true,
        });
      }

      toast.success(googleResult.message);
      return withUndo({
        ok: true,
        collection: 'events',
        message: googleResult.message,
        syncStatus: googleResult.googleStatus,
      }, {
        ...applied.undo,
        googleOperationSucceeded: googleResult.googleStatus === 'synced',
      });
    }

    const syncResult = await syncToFirestore(applied.collection, applied.records);
    if (!syncResult.ok) {
      const message = `${applied.message} A alteração ficou local, mas não foi sincronizada com o Firebase.`;
      toast.error(message);
      return withUndo({
        ok: true,
        collection: applied.collection,
        message,
        syncStatus: 'local-only',
      });
    }

    toast.success(applied.message);
    return withUndo({
      ok: true,
      collection: applied.collection,
      message: applied.message,
      syncStatus: 'synced',
    });
  };

  const undoAIAssistantAction = async (undoId) => {
    const stored = aiUndoActionsRef.current.get(undoId);
    if (!stored || Date.now() - stored.createdAt >= 10 * 60 * 1000) {
      aiUndoActionsRef.current.delete(undoId);
      return { ok: false, error: 'O prazo para desfazer esta ação expirou.' };
    }

    const undone = applyOrganizerUndo(stored.undo, {
      tasks,
      notes,
      events,
      habits,
      dailyHabitsState,
    });
    if (!undone.ok) return undone;

    if (undone.collection === 'tasks') setTasks(undone.records);
    if (undone.collection === 'notes') setNotes(undone.records);
    if (undone.collection === 'events') setEvents(undone.records);
    if (undone.collection === 'habits') setHabits(undone.records);
    if (undone.collection === 'dailyHabitsState') setDailyHabitsState(undone.records);

    const firebaseResult = await syncToFirestore(undone.collection, undone.records);
    if (!firebaseResult.ok) {
      aiUndoActionsRef.current.delete(undoId);
      const message = `${undone.message} A reversão ficou local, mas não foi sincronizada com o Firebase.`;
      toast.error(message);
      return { ok: true, collection: undone.collection, message, syncStatus: 'local-only' };
    }

    if (undone.collection === 'events' && undone.externalOperation) {
      const googleResult = await syncCalendarActionWithGoogle(undone, { accessToken: googleAccessToken });
      setEvents(googleResult.records);
      if (googleResult.needsFirestoreResync) {
        const linkSyncResult = await syncToFirestore('events', googleResult.records);
        if (!linkSyncResult.ok) {
          aiUndoActionsRef.current.delete(undoId);
          const message = 'Alteração desfeita no Organizador e no Google Calendar, mas o novo vínculo não foi salvo no Firebase.';
          toast.error(message);
          return { ok: true, collection: 'events', message, syncStatus: 'partial' };
        }
      }
      aiUndoActionsRef.current.delete(undoId);
      if (googleResult.googleStatus === 'local-only') {
        toast.error(googleResult.message);
        return { ok: true, collection: 'events', message: googleResult.message, syncStatus: 'local-only' };
      }
      const message = 'Alteração desfeita no Organizador e no Google Calendar.';
      toast.success(message);
      return { ok: true, collection: 'events', message, syncStatus: 'synced' };
    }

    aiUndoActionsRef.current.delete(undoId);
    toast.success(undone.message);
    return { ok: true, collection: undone.collection, message: undone.message, syncStatus: 'synced' };
  };

  // Estado para controlo dos Hábitos Diários e data da última atualização
  const [dailyHabitsState, setDailyHabitsState] = useState(() => {
    const todayStr = organizerDateKey();
    return {
      lastDate: todayStr,
      completed: {
        h_treino: false,
        h_dieta: false,
        h_cardio: false,
        h_estudo: false
      }
    };
  });
  const dailyHabitsStateRef = useRef(dailyHabitsState);

  useEffect(() => {
    dailyHabitsStateRef.current = dailyHabitsState;
  }, [dailyHabitsState]);

  // Efeito para verificar se o dia mudou e zerar os hábitos
  useEffect(() => {
    const todayStr = organizerDateKey();
    if (dailyHabitsState.lastDate !== todayStr) {
      const resetState = {
        lastDate: todayStr,
        completed: {},
      };
      setDailyHabitsState(resetState);
      syncToFirestore('dailyHabitsState', resetState);
    }
  }, [dailyHabitsState.lastDate, syncToFirestore]);

  const toggleDailyHabit = useCallback((habitId) => {
    const newState = toggleDailyHabitCompletion(
      dailyHabitsStateRef.current,
      habitId,
      organizerDateKey()
    );
    dailyHabitsStateRef.current = newState;
    setDailyHabitsState(newState);
    void syncToFirestore('dailyHabitsState', newState);
  }, [syncToFirestore]);

  const navItems = [
    { id: 'dashboard', label: 'Painel Principal' },
    { id: 'calendar', label: 'Calendário Mensal' },
    { id: 'tasks', label: 'Tarefas', badge: tasks.filter(t => t.status !== 'concluido' && !t.deleted).length },
    { id: 'habits', label: 'Hábitos' },
    { id: 'notes', label: 'Notas' },
    { id: 'pomodoro', label: 'Foco (Pomodoro)' },
    { id: 'chat', label: 'Mensagens' },
    { id: 'ai_setup', label: 'Ajudante do Dia' },
    { id: 'trash', label: 'Lixeira' }
  ];
  const userInitials = (user?.displayName || user?.email || 'Usuário')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');

  const handleCopyDataDiagnostics = async () => {
    if (!user) {
      toast.info('Entre na conta para gerar o diagnóstico.');
      return;
    }

    try {
      toast.loading('Gerando diagnóstico de dados...', { id: 'data-diagnostics' });
      const userRef = doc(db, 'users', user.uid);
      const snapshot = await getDoc(userRef);
      const nextDiagnostics = {
        usuario: user.email || user.uid,
        uid: user.uid,
        documento_ativo: `users/${user.uid}`,
        documento: summarizeOrganizerDocument(user, snapshot),
        estado_visivel_no_app: {
          tarefas: tasks.length,
          habitos: habits.length,
          notas: notes.length,
          eventos: events.length,
          habitos_marcados_hoje: Object.values(dailyHabitsState?.completed || {}).filter(Boolean).length,
        },
        atualizadoEm: new Date().toISOString(),
      };
      const report = JSON.stringify(nextDiagnostics, null, 2);
      try {
        await navigator.clipboard.writeText(report);
        toast.success('Diagnóstico de dados copiado.', { id: 'data-diagnostics' });
      } catch (clipboardError) {
        console.info('Diagnóstico de dados:', nextDiagnostics);
        console.error('Erro ao copiar diagnóstico:', clipboardError);
        window.prompt('Copie o diagnóstico abaixo:', report);
        toast.info('Diagnóstico gerado. Copie pela janela aberta ou pelo console.', { id: 'data-diagnostics' });
      }
    } catch (error) {
      console.error('Erro ao gerar diagnóstico:', error);
      toast.error('Não consegui gerar o diagnóstico. Veja o console do navegador.', { id: 'data-diagnostics' });
    }
  };

  if (isAuthLoading) {
    return (
      <div className="login-loading-screen" role="status" aria-label="Carregando Organizador">
        <div className="login-loading-mark">
          <span>[</span>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>]</span>
        </div>
        <p>Preparando sua edição diária</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-screen">
        <main className="login-document">
          <header className="login-document-header">
            <div className="login-wordmark">
              <span className="login-wordmark-symbol">[ p ]</span>
              <span>Organizador pessoal</span>
            </div>
            <span className="login-document-status">Acesso privado</span>
          </header>

          <div className="login-document-body">
            <section className="login-cover" aria-labelledby="login-title">
              <span className="login-kicker">Edição diária · 01</span>
              <h1 id="login-title">Passo<br />a Passo</h1>
              <div className="login-title-rule"></div>
              <p className="login-cover-lead">
                Um espaço calmo para organizar o que importa, acompanhar sua rotina e avançar um dia de cada vez.
              </p>

              <ol className="login-index" aria-label="Recursos do Organizador">
                <li><span>01</span><strong>Planeje</strong><small>tarefas e agenda</small></li>
                <li><span>02</span><strong>Acompanhe</strong><small>hábitos e foco</small></li>
                <li><span>03</span><strong>Registre</strong><small>notas e ideias</small></li>
              </ol>
            </section>

            <aside className="login-access" aria-labelledby="login-access-title">
              <div className="login-access-heading">
                <div className="login-access-mark">
                  <span>[</span>
                  <CheckSquare className="w-5 h-5" />
                  <span>]</span>
                </div>
                <span className="login-kicker">Identificação</span>
                <h2 id="login-access-title">Entrar no Organizador</h2>
                <p>Use sua conta Google para acessar seus registros sincronizados e continuar de onde parou.</p>
              </div>

              <div className="login-security-record">
                <ShieldCheck className="w-4 h-4" />
                <div>
                  <span>Conexão segura</span>
                  <p>Seus dados ficam associados à sua conta e não são exibidos para outros usuários.</p>
                </div>
              </div>

              <button onClick={handleLogin} className="login-google-button">
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>Continuar com o Google</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <p className="login-access-note">
                Ao continuar, o Google solicitará sua autorização antes de compartilhar os dados básicos da conta.
              </p>
            </aside>
          </div>

          <footer className="login-document-footer">
            <span>Passo a Passo · registro pessoal</span>
            <span>Dados sincronizados na nuvem</span>
          </footer>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell text-stone-800 font-sans antialiased relative">
      <Toaster
        position="top-right"
        theme="light"
        closeButton
        expand
        gap={10}
        duration={4200}
        offset={{ top: 18, right: 18 }}
        mobileOffset={{ top: 12, right: 12, left: 12 }}
        containerAriaLabel="Notificações do Organizador"
        toastOptions={{
          classNames: {
            toast: 'editorial-toast',
            content: 'editorial-toast-content',
            title: 'editorial-toast-title',
            description: 'editorial-toast-description',
            icon: 'editorial-toast-icon',
            closeButton: 'editorial-toast-close',
            actionButton: 'editorial-toast-action',
            cancelButton: 'editorial-toast-cancel'
          }
        }}
        icons={{
          success: <Check className="w-4 h-4" />,
          error: <X className="w-4 h-4" />,
          warning: <AlertCircle className="w-4 h-4" />,
          info: <Bell className="w-4 h-4" />,
          loading: <Loader2 className="w-4 h-4 animate-spin" />
        }}
      />

      <button
        onClick={() => setMobileMenuOpen(true)}
        className="app-menu-button app-menu-trigger"
        aria-label="Abrir Menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <SyncStatusBadge status={syncStatus} />

      {/* O Toast agora é gerenciado globalmente pelo Sonner (<Toaster />) */}

      {/* DRAWER ÚNICO A DIREITA */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="menu-drawer-backdrop fixed inset-0 z-40"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="menu-drawer fixed top-0 right-0 z-50 h-screen"
              role="dialog"
              aria-modal="true"
              aria-labelledby="menu-drawer-title"
            >
              <div className="menu-drawer-main">
                <header className="menu-drawer-header">
                  <div>
                    <span className="menu-drawer-kicker">Organizador pessoal</span>
                    <h2 id="menu-drawer-title">Menu</h2>
                  </div>
                  <button 
                    onClick={() => setMobileMenuOpen(false)} 
                    className="menu-drawer-close"
                    aria-label="Fechar menu"
                  >
                     <X className="w-5 h-5" />
                  </button>
                </header>
                
                <nav className="menu-drawer-nav" aria-label="Navegação principal">
                  <ol>
                    {navItems.map((item, index) => {
                      const isActive = activeTab === item.id;
                      return (
                        <li key={item.id}>
                          <button
                            onClick={() => {
                              handleTabChange(item.id);
                              setMobileMenuOpen(false);
                            }}
                            className={`menu-drawer-link ${isActive ? 'is-active' : ''}`}
                            aria-current={isActive ? 'page' : undefined}
                          >
                            <span className="menu-drawer-index">{String(index + 1).padStart(2, '0')}</span>
                            <span className="menu-drawer-label">{item.label}</span>
                            {item.badge > 0 && (
                              <span className="menu-drawer-badge" aria-label={`${item.badge} tarefas pendentes`}>
                                {item.badge}
                              </span>
                            )}
                            <ChevronRight className="menu-drawer-arrow w-4 h-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </nav>
              </div>

              {/* Status de Sincronização do Google Calendar */}
              <footer className="menu-drawer-footer">
                <button 
                  onClick={() => {
                    handleTabChange('google_calendar');
                    setMobileMenuOpen(false);
                  }}
                  className={`menu-calendar-status ${googleAccessToken ? 'is-connected' : ''}`}
                >
                  <div className="menu-calendar-copy">
                    <CalendarIcon className="w-4 h-4" />
                    <div>
                      <span className="menu-calendar-kicker">Integração externa</span>
                      <strong>{googleAccessToken ? 'Google Calendar conectado' : 'Conectar Google Calendar'}</strong>
                    </div>
                  </div>
                  <span className="menu-calendar-indicator" aria-hidden="true"></span>
                </button>

                <div className="menu-user-record">
                  <div className="menu-user-avatar">
                    {userInitials || 'U'}
                  </div>
                  <div className="menu-user-copy">
                    <span>Conta ativa</span>
                    <p>{user ? user.displayName : 'Usuário'}</p>
                    <small>{user ? user.email : 'Faça login'}</small>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="menu-logout-button"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair da conta</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyDataDiagnostics}
                  className="menu-diagnostics-button"
                >
                  <FileText className="w-4 h-4" />
                  <span>Copiar diagnóstico</span>
                </button>
              </footer>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Conteúdo Principal */}
      <div className="app-content min-w-0">
        <main ref={appMainRef} className="app-main">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              key={activeTab}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -3 }}
              transition={prefersReducedMotion
                ? { duration: 0.01 }
                : {
                    duration: 0.42,
                    ease: [0.22, 1, 0.36, 1],
                    opacity: { duration: 0.28, ease: 'easeOut' }
                  }}
              className="editorial-view page-transition max-w-5xl mx-auto space-y-8"
            >
              <Suspense fallback={<ViewLoading />}>
                {activeTab === 'dashboard' && (
                  <DashboardView
                    tasks={tasks}
                    setTasks={setTasks}
                    notes={notes}
                    setNotes={setNotes}
                    setActiveTab={handleTabChange}
                    dailyHabitsState={dailyHabitsState}
                    toggleDailyHabit={toggleDailyHabit}
                    habits={habits}
                    events={events}
                    syncToFirestore={syncToFirestore}
                  />
                )}
                {activeTab === 'calendar' && (
                  <CalendarView
                    events={events}
                    setEvents={setEvents}
                    syncToFirestore={syncToFirestore}
                    googleAccessToken={googleAccessToken}
                  />
                )}
                {activeTab === 'google_calendar' && (
                  <GoogleCalendarSyncView
                    googleAccessToken={googleAccessToken}
                    handleLogin={handleLogin}
                    handleLogout={handleLogout}
                  />
                )}
                {activeTab === 'tasks' && <TasksView tasks={tasks} setTasks={setTasks} syncToFirestore={syncToFirestore} />}
                {activeTab === 'habits' && <HabitsView habits={habits} setHabits={setHabits} syncToFirestore={syncToFirestore} />}
                {activeTab === 'notes' && <NotesView notes={notes} setNotes={setNotes} syncToFirestore={syncToFirestore} />}
                {activeTab === 'pomodoro' && <PomodoroView tasks={tasks} setTasks={setTasks} syncToFirestore={syncToFirestore} />}
                {activeTab === 'chat' && <ChatView currentUser={user} />}
                {activeTab === 'ai_setup' && <AISetupView onBack={() => handleTabChange('dashboard')} />}
                {activeTab === 'trash' && (
                  <TrashView
                    tasks={tasks} setTasks={setTasks}
                    habits={habits} setHabits={setHabits}
                    events={events} setEvents={setEvents}
                    notes={notes} setNotes={setNotes}
                    syncToFirestore={syncToFirestore}
                  />
                )}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {(import.meta.env.VITE_ENABLE_LOCAL_AI === 'true') && (
        <Suspense fallback={null}>
          <LocalAIAssistant
            tasks={tasks}
            habits={habits}
            notes={notes}
            events={events}
            dailyHabitsState={dailyHabitsState}
            user={user}
            googleCalendarConnected={Boolean(googleAccessToken)}
            onExecuteAction={executeAIAssistantAction}
            onUndoAction={undoAIAssistantAction}
            onAuditAction={recordAIAssistantAudit}
          />
        </Suspense>
      )}
    </div>
  );
}

function WeeklyCalendarPreview({ events }) {
  const today = new Date();
  const nextDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const formatRangeDate = (date) => date
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace('.', '')
    .toUpperCase();
  const weekRange = `${formatRangeDate(nextDays[0])} — ${formatRangeDate(nextDays[nextDays.length - 1])}`;

  return (
    <section className="weekly-agenda" aria-labelledby="weekly-agenda-title">
      <header className="weekly-agenda-header">
        <div>
          <span className="weekly-agenda-kicker">Agenda semanal · próximos 7 dias</span>
          <h2 id="weekly-agenda-title">Visão da semana</h2>
        </div>
        <span className="weekly-agenda-range">{weekRange}</span>
      </header>

      <div className="weekly-agenda-days" role="list">
        {nextDays.map((date, i) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          
          const dayEvents = events
            .filter(e => e.date === dateStr && !e.deleted)
            .sort((first, second) => (first.time || '').localeCompare(second.time || ''));
          const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
          const monthLabel = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
          
          return (
            <article key={dateStr} className={`weekly-agenda-day ${i === 0 ? 'is-today' : ''}`} role="listitem">
              <div className="weekly-agenda-date">
                <span>{i === 0 ? 'Hoje' : weekday}</span>
                <div>
                  <strong>{String(date.getDate()).padStart(2, '0')}</strong>
                  <small>{monthLabel}</small>
                </div>
              </div>

              <div className="weekly-agenda-events">
                {dayEvents.length > 0 ? (
                  <>
                    {dayEvents.slice(0, 2).map(event => (
                      <div key={event.id} className="weekly-agenda-event" title={event.title}>
                        <span className={`weekly-agenda-event-dot ${getCategoryStyle(event.category).dot}`}></span>
                        <div>
                          <time>{event.time || '--:--'}</time>
                          <p>{event.title}</p>
                        </div>
                      </div>
                    ))}
                    {dayEvents.length > 2 && <span className="weekly-agenda-more">+ {dayEvents.length - 2} eventos</span>}
                  </>
                ) : (
                  <span className="weekly-agenda-empty">Sem eventos</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

// ==========================================
// 1. VISTA DO PAINEL PRINCIPAL (DASHBOARD NOTION)
// ==========================================
function TaskNoteContent({ task, onToggle, onEdit, onDelete, completed = false, showStatusAction = true }) {
  return (
    <div className="task-note-layout">
      {showStatusAction && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggle}
          className="task-check"
          aria-label={completed ? 'Reabrir tarefa' : 'Concluir tarefa'}
        >
          {completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
        </button>
      )}
      <div className="task-note-copy">
        <span className="task-note-category">{task.category}</span>
        <p className={`task-note-title ${completed ? 'task-note-title-complete' : ''}`}>{task.title}</p>
      </div>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onEdit}
        className="task-edit"
        aria-label="Editar tarefa"
      >
        <Pencil className="w-4 h-4" />
      </button>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onDelete}
        className="task-delete"
        aria-label="Mover tarefa para a lixeira"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function DashboardView({ 
  tasks, 
  setTasks, 
  notes, 
  setNotes, 
  setActiveTab,
  dailyHabitsState,
  toggleDailyHabit,
  habits,
  events,
  syncToFirestore
}) {
  // Estado para controlar a visibilidade do Drawer de escrita de nota
  const [isNoteDrawerOpen, setIsNoteDrawerOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  
  // Estados para os campos da nova nota
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState('Trabalho');
  const [newShoppingItems, setNewShoppingItems] = useState(['']);

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const sourceStatus = source.droppableId;
    const destStatus = destination.droppableId;
    const orderedStatuses = ['a_fazer', 'em_curso', 'concluido'];

    const activeTasks = tasks.filter(t => !t.deleted);
    const deletedTasks = tasks.filter(t => t.deleted);
    const groupedTasks = orderedStatuses.reduce((acc, status) => {
      acc[status] = activeTasks.filter(t => t.status === status);
      return acc;
    }, {});

    const [removedTask] = groupedTasks[sourceStatus].splice(source.index, 1);
    if (!removedTask) return;

    const movedTask = { ...removedTask, status: destStatus };
    groupedTasks[destStatus].splice(destination.index, 0, movedTask);

    const otherActiveTasks = activeTasks.filter(t => !orderedStatuses.includes(t.status));
    const newTasks = [
      ...orderedStatuses.flatMap(status => groupedTasks[status]),
      ...otherActiveTasks,
      ...deletedTasks
    ];
    
    setTasks(newTasks);
    await persistOrganizerChange(syncToFirestore, 'tasks', newTasks);
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!newNoteTitle.trim()) return;
    const successMessage = newNoteCategory === 'Compras' ? 'Lista de compras criada!' : 'Nota criada com sucesso!';
    const noteId = Date.now().toString();
    const shoppingItems = newNoteCategory === 'Compras'
      ? createShoppingItems(newShoppingItems, noteId)
      : null;
    const newNote = {
      id: noteId,
      title: newNoteTitle.trim(),
      content: shoppingItems ? shoppingItems.map(item => item.text).join('\n') : newNoteContent.trim(),
      category: newNoteCategory,
      ...(shoppingItems ? { items: shoppingItems } : {})
    };
    const updatedNotes = [newNote, ...notes];
    setNotes(updatedNotes);
    setNewNoteTitle('');
    setNewNoteContent('');
    setNewShoppingItems(['']);
    setNewNoteCategory('Trabalho');
    setIsNoteDrawerOpen(false);
    await persistOrganizerChange(syncToFirestore, 'notes', updatedNotes, successMessage);
  };

  const handleToggleShoppingItem = async (noteId, itemIndex) => {
    const updatedNotes = toggleShoppingItemInNotes(notes, noteId, itemIndex);
    setNotes(updatedNotes);
    setSelectedNote(updatedNotes.find(note => note.id === noteId) || null);
    await persistOrganizerChange(syncToFirestore, 'notes', updatedNotes);
  };

  const handleUpdateTask = async (updatedTask) => {
    const updatedTasks = tasks.map(task => task.id === updatedTask.id ? updatedTask : task);
    setTasks(updatedTasks);
    setEditingTask(null);
    await persistOrganizerChange(syncToFirestore, 'tasks', updatedTasks, 'Tarefa atualizada com sucesso!');
  };

  const handleUpdateNote = async (updatedNote) => {
    const updatedNotes = notes.map(note => note.id === updatedNote.id ? updatedNote : note);
    setNotes(updatedNotes);
    setSelectedNote(updatedNote);
    setEditingNote(null);
    await persistOrganizerChange(
      syncToFirestore,
      'notes',
      updatedNotes,
      updatedNote.category === 'Compras' ? 'Lista atualizada com sucesso!' : 'Nota atualizada com sucesso!'
    );
  };

  const availableCategories = NOTE_CATEGORIES;
  
  const todayLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());

  return (
    <div className="editorial-page space-y-8">
      
      {/* 1. TEXTO DE BOAS-VINDAS E CLIMA NO MESMO ALINHAMENTO */}
      <div className="dashboard-masthead flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-2">
        <div>
          <div className="dashboard-kicker">Organizador pessoal · edição diária</div>
          <h1 
            className="page-title"
            style={{ fontWeight: 900 }}
          >
            Passo a Passo
          </h1>
          <h2 
            className="page-subtitle"
            style={{ fontWeight: 700 }}
          >
            Um passo de cada vez.
          </h2>
          <div className="editorial-rule"></div>
          <div className="dashboard-date">{todayLabel}</div>
        </div>
        <div className="dashboard-weather-brief"><WeatherWidget /></div>
      </div>

      {/* 2. PRÉVIA DO CALENDÁRIO SEMANAL */}
      <WeeklyCalendarPreview events={events} />

      {/* 3. SEÇÃO DE HÁBITOS DIÁRIOS (COLOCADA ACIMA DA LISTA DE TAREFAS) */}
      <div className="editorial-panel bg-white p-6 sm:p-8 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
        <div className="section-heading flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div>
              <h2 className="section-eyebrow section-heading-title">Rastreador de hábitos · 01</h2>
            </div>
          </div>
          <button onClick={() => setActiveTab('habits')} className="habit-manage-button">
            <span>Gerenciar</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Lista dos Hábitos Diários */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {habits.slice(0, 4).map((habit) => {
            const isDone = Boolean(dailyHabitsState.completed[habit.id]);
            const habitTone = getHabitTone(habit.color);
            const IconMap = {
              'Dumbbell': Dumbbell,
              'Apple': Apple,
              'Activity': Activity,
              'GraduationCap': GraduationCap
            };
            const Icon = IconMap[habit.iconName] || Activity;

            return (
              <div
                key={habit.id}
                className={`habit-tile habit-tone-${habitTone} p-4 rounded-2xl flex items-center justify-between transition-all select-none group ${
                  isDone 
                    ? 'is-done'
                    : 'hover:shadow-lg hover:-transtone-y-0.5'
                }`}
              >
                {/* Ícone e Texto */}
                <div className="flex items-center space-x-3.5">
                  <div className={`habit-tile-icon w-12 h-12 rounded-xl flex items-center justify-center bg-white shadow-sm ${isDone ? 'text-stone-400 opacity-60' : habit.iconColor || 'text-stone-800'}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col">
                    <span className={`habit-tile-label font-bold text-base ${isDone ? 'text-stone-500 line-through' : ''}`}>{habit.name}</span>
                    <span className={`habit-tile-meta text-[11px] ${isDone ? 'text-stone-400' : 'font-medium'}`}>{habit.recurrence}</span>
                  </div>
                </div>

                {/* Ação (Check) */}
                <button
                  type="button"
                  className="habit-tile-toggle"
                  onClick={() => toggleDailyHabit(habit.id)}
                  aria-pressed={isDone}
                  aria-label={isDone
                    ? `Desmarcar o hábito ${habit.name}`
                    : `Marcar o hábito ${habit.name} como concluído`}
                >
                  {isDone ? (
                    <CheckCircle2 className="habit-tile-check is-complete w-7 h-7" />
                  ) : (
                    <Circle className="habit-tile-check w-7 h-7" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. LISTA DE TAREFAS (QUADRO HORIZONTAL) */}
      <div className="editorial-panel bg-white p-6 sm:p-8 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
        <div className="section-heading flex items-center justify-between mb-4">
          <div>
            <h3 className="section-eyebrow section-heading-title">Lista de tarefas · 02</h3>
          </div>
          <span className="text-xs text-stone-400 font-medium md:hidden">Deslize para o lado →</span>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="dashboard-task-board task-board-columns flex md:grid md:grid-cols-3 gap-4 overflow-x-auto md:overflow-x-visible pb-4 pt-1 snap-x md:snap-none scrollbar-thin">
            
            {/* Coluna A Fazer */}
            <div className="dashboard-task-lane task-lane min-w-[280px] sm:min-w-[320px] md:min-w-0 bg-stone-100/80 p-4 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3 snap-start shrink-0 flex flex-col max-h-[500px]">
              <div className="dashboard-task-card-header flex items-center justify-between border-b border-stone-200 pb-2">
                <span className="dashboard-task-card-title font-bold text-xs uppercase tracking-wider text-stone-700 flex items-center space-x-1.5">
                  <span className="dashboard-task-status-dot w-2 h-2 rounded-full bg-stone-400"></span>
                  <span>A Fazer</span>
                </span>
                <span className="dashboard-task-card-count text-xs font-bold text-stone-500">
                  ({tasks.filter(t => t.status === 'a_fazer' && !t.deleted).length})
                </span>
              </div>

              <Droppable droppableId="a_fazer">
                {(provided) => (
                  <div 
                    ref={provided.innerRef} 
                    {...provided.droppableProps} 
                    className="dashboard-task-dropzone space-y-2.5 overflow-y-auto pr-1 flex-1 min-h-[100px]"
                  >
                    {tasks.filter(t => t.status === 'a_fazer' && !t.deleted).map((t, index) => {
                      const style = getCategoryStyle(t.category);
                      return (
                        <Draggable key={t.id} draggableId={t.id} index={index}>
                          {(provided, snapshot) => (
                            <div 
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                ...provided.draggableProps.style,
                                transitionDuration: snapshot.isDropAnimating ? '0.1s' : provided.draggableProps.style?.transitionDuration,
                              }}
                              className={`dashboard-task-item task-note group ${style.bg} ${snapshot.isDragging ? 'is-dragging' : ''}`}
                            >
                              <TaskNoteContent
                                task={t}
                                showStatusAction={false}
                                onEdit={() => setEditingTask(t)}
                                onDelete={async () => {
                                  const updatedTasks = tasks.map(task => task.id === t.id ? { ...task, deleted: true } : task);
                                  setTasks(updatedTasks);
                                  await persistOrganizerChange(syncToFirestore, 'tasks', updatedTasks, 'Tarefa movida para a Lixeira');
                                }}
                              />
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            {/* Coluna Em Curso */}
            <div className="dashboard-task-lane task-lane min-w-[280px] sm:min-w-[320px] md:min-w-0 bg-stone-100/80 p-4 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3 snap-start shrink-0 flex flex-col max-h-[500px]">
              <div className="dashboard-task-card-header flex items-center justify-between border-b border-stone-200 pb-2">
                <span className="dashboard-task-card-title dashboard-task-card-title-progress font-bold text-xs uppercase tracking-wider text-amber-800 flex items-center space-x-1.5">
                  <span className="dashboard-task-status-dot w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>Em Curso</span>
                </span>
                <span className="dashboard-task-card-count text-xs font-bold text-amber-800">
                  ({tasks.filter(t => t.status === 'em_curso' && !t.deleted).length})
                </span>
              </div>

              <Droppable droppableId="em_curso">
                {(provided) => (
                  <div 
                    ref={provided.innerRef} 
                    {...provided.droppableProps} 
                    className="dashboard-task-dropzone space-y-2.5 overflow-y-auto pr-1 flex-1 min-h-[100px]"
                  >
                    {tasks.filter(t => t.status === 'em_curso' && !t.deleted).map((t, index) => {
                      const style = getCategoryStyle(t.category);
                      return (
                        <Draggable key={t.id} draggableId={t.id} index={index}>
                          {(provided, snapshot) => (
                            <div 
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                ...provided.draggableProps.style,
                                transitionDuration: snapshot.isDropAnimating ? '0.1s' : provided.draggableProps.style?.transitionDuration,
                              }}
                              className={`dashboard-task-item task-note group ${style.bg} ${snapshot.isDragging ? 'is-dragging' : ''}`}
                            >
                              <TaskNoteContent
                                task={t}
                                showStatusAction={false}
                                onEdit={() => setEditingTask(t)}
                                onDelete={async () => {
                                  const updatedTasks = tasks.map(task => task.id === t.id ? { ...task, deleted: true } : task);
                                  setTasks(updatedTasks);
                                  await persistOrganizerChange(syncToFirestore, 'tasks', updatedTasks, 'Tarefa movida para a Lixeira');
                                }}
                              />
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            {/* Coluna Concluído */}
            <div className="dashboard-task-lane task-lane min-w-[280px] sm:min-w-[320px] md:min-w-0 bg-stone-100/80 p-4 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3 snap-start shrink-0 flex flex-col max-h-[500px]">
              <div className="dashboard-task-card-header flex items-center justify-between border-b border-stone-200 pb-2">
                <span className="dashboard-task-card-title dashboard-task-card-title-done font-bold text-xs uppercase tracking-wider text-emerald-800 flex items-center space-x-1.5">
                  <span className="dashboard-task-status-dot w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Concluído</span>
                </span>
                <span className="dashboard-task-card-count text-xs font-bold text-emerald-800">
                  ({tasks.filter(t => t.status === 'concluido' && !t.deleted).length})
                </span>
              </div>

              <Droppable droppableId="concluido">
                {(provided) => (
                  <div 
                    ref={provided.innerRef} 
                    {...provided.droppableProps} 
                    className="dashboard-task-dropzone space-y-2.5 overflow-y-auto pr-1 flex-1 min-h-[100px]"
                  >
                    {tasks.filter(t => t.status === 'concluido' && !t.deleted).map((t, index) => {
                      const style = getCategoryStyle(t.category);
                      return (
                        <Draggable key={t.id} draggableId={t.id} index={index}>
                          {(provided, snapshot) => (
                            <div 
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                ...provided.draggableProps.style,
                                transitionDuration: snapshot.isDropAnimating ? '0.1s' : provided.draggableProps.style?.transitionDuration,
                              }}
                              className={`dashboard-task-item task-note task-note-complete group ${style.bg} ${snapshot.isDragging ? 'is-dragging' : ''}`}
                            >
                              <TaskNoteContent
                                task={t}
                                completed
                                showStatusAction={false}
                                onEdit={() => setEditingTask(t)}
                                onDelete={async () => {
                                  const updatedTasks = tasks.map(task => task.id === t.id ? { ...task, deleted: true } : task);
                                  setTasks(updatedTasks);
                                  await persistOrganizerChange(syncToFirestore, 'tasks', updatedTasks, 'Tarefa movida para a Lixeira');
                                }}
                              />
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

          </div>
        </DragDropContext>
      </div>


      {/* 6. CARD APENAS COM NOTAS GUARDADAS E BOTÃO "ESCREVER NOTAS" ABAIXO */}
      <div className="editorial-panel bg-white p-6 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
        <div className="section-heading flex items-center justify-between border-b border-stone-100 pb-5 mb-2">
          <div>
            <h3 className="section-eyebrow section-heading-title">Notas · 03</h3>
          </div>
          <span className="text-xs font-semibold text-stone-400">
            {notes.filter(n => !n.deleted).length} {notes.filter(n => !n.deleted).length === 1 ? 'nota' : 'notas'}
          </span>
        </div>

        {notes.filter(n => !n.deleted).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {notes.filter(n => !n.deleted).map((note) => {
              const style = getCategoryStyle(note.category);
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => setSelectedNote(note)}
                  className={`note-preview-card ${style.bg}`}
                >
                  <span className="note-preview-category">{note.category}</span>
                  <span className="note-preview-open"><span>Ver nota</span><ChevronRight className="w-3 h-3" /></span>
                  <h5 className="font-bold text-stone-900 text-sm">{note.title}</h5>
                  {note.category === 'Compras' ? (
                    <ShoppingListContent note={note} preview />
                  ) : (
                    <p className="text-xs text-stone-800 leading-relaxed whitespace-pre-line">{note.content}</p>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-stone-400 italic py-2">Nenhuma nota registrada ainda.</p>
        )}

        <div className="pt-3 border-t border-stone-100 flex justify-end">
          <button
            onClick={() => setIsNoteDrawerOpen(true)}
            className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-md text-sm shadow-sm transition-all flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Escrever notas</span>
          </button>
        </div>
      </div>

      {selectedNote && (
        <div className="note-viewer-overlay fixed inset-0 z-50 flex items-center justify-center p-5 sm:p-8">
          <div
            className="note-viewer-backdrop fixed inset-0"
            onClick={() => { setSelectedNote(null); setEditingNote(null); }}
          ></div>

          <article className="note-viewer relative z-10" role="dialog" aria-modal="true" aria-labelledby="note-viewer-title">
            <header className="note-viewer-header flex items-start justify-between">
              <div>
                <span className="note-drawer-kicker">Nota ativa · {selectedNote.category}</span>
                <h2 id="note-viewer-title" className="note-viewer-title">{selectedNote.title}</h2>
              </div>
              <div className="note-viewer-header-actions">
                {!editingNote && (
                  <button type="button" onClick={() => setEditingNote(selectedNote)} className="note-viewer-edit" aria-label="Editar nota">
                    <Pencil className="w-4 h-4" />
                    <span>Editar</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setSelectedNote(null); setEditingNote(null); }}
                  className="note-drawer-close"
                  aria-label="Fechar visualização da nota"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </header>
            <div className="editorial-rule"></div>
            {editingNote ? (
              <NoteEditForm key={editingNote.id} note={editingNote} onCancel={() => setEditingNote(null)} onSave={handleUpdateNote} />
            ) : (
              <div className="note-viewer-content">
                {selectedNote.category === 'Compras' ? (
                  <ShoppingListContent
                    note={selectedNote}
                    onToggleItem={(itemIndex) => handleToggleShoppingItem(selectedNote.id, itemIndex)}
                  />
                ) : (
                  selectedNote.content || 'Esta nota ainda não possui conteúdo.'
                )}
              </div>
            )}
            <footer className="note-viewer-footer">Passo a passo · registro pessoal</footer>
          </article>
        </div>
      )}

      {/* 7. DRAWER LATERAL DIREITO PARA DIGITAR NOTAS */}
      {isNoteDrawerOpen && (
        <div className="note-drawer-overlay fixed inset-0 z-50 flex justify-end">
          <div 
            className="note-drawer-backdrop fixed inset-0 transition-opacity"
            onClick={() => setIsNoteDrawerOpen(false)}
          ></div>

          <div className="note-drawer relative w-full max-w-md bg-white h-full z-10 flex flex-col justify-between overflow-y-auto">
            <div className="note-drawer-body">
              <div className="note-drawer-header flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-teal-800" />
                  <div>
                    <span className="note-drawer-kicker">Novo registro</span>
                    <h3 className="note-drawer-title">Escrever nota</h3>
                  </div>
                </div>
                <button 
                  onClick={() => setIsNoteDrawerOpen(false)} 
                  className="note-drawer-close"
                  aria-label="Fechar nota"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form id="note-drawer-form" onSubmit={handleSaveNote} className="note-drawer-form">
                <div className="note-field">
                  <label className="note-label">
                    Título da Nota
                  </label>
                  <input 
                    type="text" 
                    placeholder="Digite o título..." 
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    className="note-input"
                    autoFocus
                  />
                </div>

                <div className="note-field">
                  <label className="note-label">
                    Categoria
                  </label>
                  <div className="note-category-list" role="group" aria-label="Categoria da nota">
                    {availableCategories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setNewNoteCategory(category)}
                        className={`note-category-option ${newNoteCategory === category ? 'is-selected' : ''}`}
                        aria-pressed={newNoteCategory === category}
                      >
                        <span className="note-category-dot" />
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="note-field note-content-field">
                  <label className="note-label">
                    {newNoteCategory === 'Compras' ? 'Itens' : 'Conteúdo'}
                  </label>
                  {newNoteCategory === 'Compras' ? (
                    <ShoppingListComposer items={newShoppingItems} onChange={setNewShoppingItems} />
                  ) : (
                    <textarea
                      placeholder="Escreva suas notas ou detalhes aqui..."
                      rows="10"
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      className="note-textarea"
                    ></textarea>
                  )}
                </div>
              </form>
            </div>

            <div className="note-drawer-actions flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsNoteDrawerOpen(false)}
                className="note-cancel-button"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="note-drawer-form"
                className="note-save-button"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Nota</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTask && (
        <TaskEditDialog
          key={editingTask.id}
          task={editingTask}
          onCancel={() => setEditingTask(null)}
          onSave={handleUpdateTask}
        />
      )}

    </div>
  );
}

// ==========================================
// 3. VISTA DE CALENDÁRIO MENSAL
// ==========================================
function CalendarView({ events, setEvents, syncToFirestore, googleAccessToken }) {
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  
  const [eventTitle, setEventTitle] = useState('');
  const [eventTime, setEventTime] = useState('09:00');
  const [eventCategory, setEventCategory] = useState('Trabalho');
  const [syncGoogle, setSyncGoogle] = useState(true);
  const [isAddingEvent, setIsAddingEvent] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => {
    const nextDate = new Date(year, month - 1, 1);
    setCurrentDate(nextDate);
    setSelectedDateStr(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-01`);
  };
  const nextMonth = () => {
    const nextDate = new Date(year, month + 1, 1);
    setCurrentDate(nextDate);
    setSelectedDateStr(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-01`);
  };

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    for (let i = 0; i < firstDayIndex; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const monthFormatted = String(month + 1).padStart(2, '0');
      const dayFormatted = String(d).padStart(2, '0');
      days.push({ dayNumber: d, dateStr: `${year}-${monthFormatted}-${dayFormatted}` });
    }
    return days;
  }, [year, month]);

  const addEvent = async (e) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    
    setIsAddingEvent(true);
    
    const newEvent = { 
      id: Date.now().toString(), 
      title: eventTitle, 
      date: selectedDateStr, 
      time: eventTime, 
      category: eventCategory,
      reminderMinutes: 15
    };

    let syncedWithGoogle = false;

    // Sincroniza com Google Calendar se o token estiver disponível e o usuário quiser
    if (googleAccessToken && syncGoogle) {
      try {
        const googleId = await addEventToGoogleCalendar(newEvent, googleAccessToken);
        if (googleId) {
          newEvent.googleEventId = googleId;
          syncedWithGoogle = true;
        }
      } catch (err) {
        toast.error(err.message || "Falha ao adicionar ao Google Calendar.");
        // Decide se continua ou se aborta a criação local também.
        // Vamos abortar a criação local para não ficar dessincronizado.
        setIsAddingEvent(false);
        return;
      }
    }

    const updatedEvents = [...events, newEvent];
    setEvents(updatedEvents);
    const saved = await persistOrganizerChange(
      syncToFirestore,
      'events',
      updatedEvents,
      syncedWithGoogle ? 'Evento adicionado ao Google Calendar!' : 'Evento adicionado ao calendário!'
    );
    
    if (saved) setEventTitle('');
    setIsAddingEvent(false);
  };

  const dayEvents = events.filter(ev => ev.date === selectedDateStr && !ev.deleted);

  return (
    <div className="calendar-view space-y-6">
      <div className="calendar-toolbar flex justify-between items-center">
        <div>
          <span className="calendar-kicker">Agenda · visão mensal</span>
          <h2 className="calendar-month-title">{MONTH_NAMES[month]} {year}</h2>
        </div>
        <div className="calendar-navigation flex space-x-2">
          <button onClick={prevMonth} className="calendar-nav-button" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={nextMonth} className="calendar-nav-button" aria-label="Próximo mês"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="calendar-layout grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="calendar-grid-panel lg:col-span-2 space-y-4">
          <div className="calendar-weekdays grid grid-cols-7 text-center">
            {DAYS_OF_WEEK.map(d => <span key={d} className="calendar-weekday">{d}</span>)}
          </div>
          <div className="calendar-days grid grid-cols-7 gap-x-2 gap-y-1">
            {calendarDays.map((item, idx) => {
              if (!item) return <div key={`empty-${idx}`} className="calendar-empty-day h-20"></div>;
              const isSelected = item.dateStr === selectedDateStr;
              const dayEvs = events.filter(e => e.date === item.dateStr && !e.deleted);

              return (
                <div
                  key={item.dateStr}
                  onClick={() => setSelectedDateStr(item.dateStr)}
                  className={`calendar-day h-20 p-1.5 flex flex-col justify-between cursor-pointer transition-all ${
                    isSelected ? 'is-selected' : ''
                  }`}
                >
                  <span className="calendar-day-number">{item.dayNumber}</span>
                  <div className="space-y-1">
                    {dayEvs.slice(0, 1).map(ev => (
                      <div key={ev.id} className="calendar-event-mark text-[9px] truncate px-1 py-0.5 flex items-center justify-between">
                        <span className="truncate">{ev.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="calendar-event-panel space-y-4">
          <div className="calendar-event-heading">
            <span className="calendar-kicker">Novo registro</span>
            <h3>Adicionar evento</h3>
            <span className="calendar-selected-date">{selectedDateStr}</span>
          </div>
          <form onSubmit={addEvent} className="calendar-event-form space-y-3">
            <input type="text" placeholder="Título do evento..." value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} className="calendar-title-field" />
            <div className="calendar-time-row flex gap-2">
              <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="calendar-time-field" />
              <div className="calendar-category-options">
                {['Trabalho', 'Pessoal', 'Saúde'].map(category => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setEventCategory(category)}
                    className={`calendar-category-option ${eventCategory === category ? 'is-selected' : ''}`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
            {googleAccessToken && (
              <label className="calendar-sync-option flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  checked={syncGoogle}
                  onChange={(e) => setSyncGoogle(e.target.checked)}
                  className="rounded border-stone-300"
                />
                <span>Sincronizar no Google Calendar</span>
              </label>
            )}
            <button type="submit" disabled={isAddingEvent} className="calendar-submit-button">
              {isAddingEvent ? 'Adicionando...' : 'Adicionar ao Calendário'}
            </button>
          </form>

          <div className="calendar-event-list space-y-2 pt-2">
            {dayEvents.map(ev => {
              const style = getCategoryStyle(ev.category);
              return (
                <div key={ev.id} className={`calendar-event-item ${style.bg} flex justify-between items-center group`}>
                  <div>
                    <span className="text-xs font-bold text-stone-800">{ev.time}</span>
                    <p className="font-semibold text-stone-900 text-sm mt-0.5">{ev.title}</p>
                  </div>
                  <button onClick={async () => {
                    const updatedEvents = events.map(e => e.id === ev.id ? { ...e, deleted: true } : e);
                    setEvents(updatedEvents);
                    
                    if (ev.googleEventId && googleAccessToken) {
                      await deleteEventFromGoogleCalendar(ev.googleEventId, googleAccessToken);
                    }
                    await persistOrganizerChange(syncToFirestore, 'events', updatedEvents, 'Evento movido para a Lixeira');
                  }} className="text-stone-500 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. VISTA DE TAREFAS
// ==========================================
function TasksView({ tasks, setTasks, syncToFirestore }) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('Trabalho');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [editingTask, setEditingTask] = useState(null);

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const updatedTasks = [...tasks, {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      category: newTaskCategory,
      priority: 'Média',
      status: 'a_fazer',
      dueDate: newTaskDueDate || null
    }];
    setTasks(updatedTasks);
    setNewTaskTitle('');
    setNewTaskDueDate('');
    await persistOrganizerChange(syncToFirestore, 'tasks', updatedTasks, 'Tarefa criada com sucesso!');
  };

  const handleUpdateTask = async (updatedTask) => {
    const updatedTasks = tasks.map(task => task.id === updatedTask.id ? updatedTask : task);
    setTasks(updatedTasks);
    setEditingTask(null);
    await persistOrganizerChange(syncToFirestore, 'tasks', updatedTasks, 'Tarefa atualizada com sucesso!');
  };

  return (
    <div className="tasks-view space-y-6">
      <form onSubmit={addTask} className="tasks-intake">
        <div className="tasks-intake-heading">
          <span className="calendar-kicker">Novo registro</span>
          <h2>Adicionar tarefa</h2>
        </div>
        <div className="tasks-intake-fields">
          <input type="text" placeholder="O que precisa ser feito?" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="task-title-field" />
          <label className="task-date-field">
            <span>Prazo · opcional</span>
            <input
              type="date"
              value={newTaskDueDate}
              onChange={(e) => setNewTaskDueDate(e.target.value)}
              aria-label="Prazo da tarefa"
            />
          </label>
          <div className="task-category-options" role="group" aria-label="Categoria da tarefa">
            {['Trabalho', 'Pessoal', 'Saúde', 'Estudos'].map(category => (
              <button
                key={category}
                type="button"
                onClick={() => setNewTaskCategory(category)}
                className={`task-category-option ${newTaskCategory === category ? 'is-selected' : ''}`}
                aria-pressed={newTaskCategory === category}
              >
                {category}
              </button>
            ))}
          </div>
          <button type="submit" className="task-submit-button">Criar tarefa</button>
        </div>
      </form>
      <div className="task-board-columns grid grid-cols-1 md:grid-cols-3 gap-6">
        {['a_fazer', 'em_curso', 'concluido'].map((statusKey) => (
          <div key={statusKey} className="task-lane bg-stone-200/60 p-4 rounded-lg space-y-3">
            <h4 className={`task-lane-heading task-lane-heading-${statusKey}`}>
              <span className="task-status-dot"></span>
              <span>{statusKey === 'a_fazer' ? 'A fazer' : statusKey === 'em_curso' ? 'Em curso' : 'Concluído'}</span>
              <span className="task-lane-count">({tasks.filter(t => t.status === statusKey && !t.deleted).length})</span>
            </h4>
            {tasks.filter(t => t.status === statusKey && !t.deleted).map(t => {
              const style = getCategoryStyle(t.category);
              return (
                <div key={t.id} className={`task-note group ${statusKey === 'concluido' ? 'task-note-complete' : ''} ${style.bg}`}>
                  <TaskNoteContent
                    task={t}
                    completed={statusKey === 'concluido'}
                    onEdit={() => setEditingTask(t)}
                    onToggle={async () => {
                      const nextStatus = statusKey === 'a_fazer' ? 'em_curso' : statusKey === 'em_curso' ? 'concluido' : 'a_fazer';
                      const updatedTasks = tasks.map(task => task.id === t.id ? { ...task, status: nextStatus } : task);
                      setTasks(updatedTasks);
                      await persistOrganizerChange(syncToFirestore, 'tasks', updatedTasks);
                    }}
                    onDelete={async () => {
                      const updatedTasks = tasks.map(task => task.id === t.id ? { ...task, deleted: true } : task);
                      setTasks(updatedTasks);
                      await persistOrganizerChange(syncToFirestore, 'tasks', updatedTasks, 'Tarefa movida para a Lixeira');
                    }}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {editingTask && (
        <TaskEditDialog
          key={editingTask.id}
          task={editingTask}
          onCancel={() => setEditingTask(null)}
          onSave={handleUpdateTask}
        />
      )}
    </div>
  );
}

// ==========================================
// 5. VISTA DE HÁBITOS
// ==========================================
function HabitsView({ habits, setHabits, syncToFirestore }) {
  const [newHabitName, setNewHabitName] = React.useState('');
  const [newHabitColor, setNewHabitColor] = React.useState('habit-color-green');
  const [recurrenceType, setRecurrenceType] = React.useState('todos_dias');
  const [selectedDays, setSelectedDays] = React.useState([]);
  const [editingHabit, setEditingHabit] = React.useState(null);

  const daysOfWeek = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  const toggleDay = (day) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleAddHabit = async (e) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    let recurrenceStr = '';
    if (recurrenceType === 'todos_dias') recurrenceStr = 'Todos os dias';
    else if (recurrenceType === 'uma_vez') recurrenceStr = 'Apenas uma vez';
    else {
      if (selectedDays.length === 0) return toast.error('Selecione pelo menos um dia!');
      recurrenceStr = selectedDays.join(', ');
    }

    const newHabit = {
      id: Date.now().toString(),
      name: newHabitName,
      color: newHabitColor,
      recurrence: recurrenceStr,
    };
    
    const updatedHabits = [newHabit, ...habits];
    setHabits(updatedHabits);
    setNewHabitName('');
    setRecurrenceType('todos_dias');
    setSelectedDays([]);
    await persistOrganizerChange(syncToFirestore, 'habits', updatedHabits, 'Hábito criado com sucesso!');
  };

  const handleUpdateHabit = async (updatedHabit) => {
    const updatedHabits = habits.map(habit => (
      habit.id === updatedHabit.id ? updatedHabit : habit
    ));
    setHabits(updatedHabits);
    setEditingHabit(null);
    await persistOrganizerChange(syncToFirestore, 'habits', updatedHabits, 'Hábito atualizado com sucesso!');
  };

  return (
    <div className="habits-view space-y-6">
      <form onSubmit={handleAddHabit} className="habits-intake">
        <div className="habits-intake-heading">
          <span className="calendar-kicker">Rastreador de hábitos · novo registro</span>
          <h2>Adicionar hábito</h2>
        </div>

        <div className="habits-intake-top">
          <input type="text" placeholder="Qual hábito deseja monitorar?" value={newHabitName} onChange={(e) => setNewHabitName(e.target.value)} className="habit-name-field" />
          <div className="habit-color-field">
            <span className="habit-field-label">Tom do registro</span>
            <div className="habit-color-options">
              {HABIT_COLOR_OPTIONS.map(c => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setNewHabitColor(c.value)}
                  aria-label={`Selecionar cor ${c.label}`}
                  title={c.label}
                  className={`habit-color-swatch ${c.swatch} ${newHabitColor === c.value ? 'is-selected' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="habit-recurrence-field">
          <span className="habit-field-label">Frequência</span>
          <div className="habit-recurrence-options">
            <button type="button" onClick={() => setRecurrenceType('todos_dias')} className={`habit-recurrence-option ${recurrenceType === 'todos_dias' ? 'is-selected' : ''}`}>Todos os dias</button>
            <button type="button" onClick={() => setRecurrenceType('dias_especificos')} className={`habit-recurrence-option ${recurrenceType === 'dias_especificos' ? 'is-selected' : ''}`}>Dias específicos</button>
            <button type="button" onClick={() => setRecurrenceType('uma_vez')} className={`habit-recurrence-option ${recurrenceType === 'uma_vez' ? 'is-selected' : ''}`}>Apenas uma vez</button>
          </div>

          {recurrenceType === 'dias_especificos' && (
            <div className="habit-day-options">
              {daysOfWeek.map(day => (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`habit-day-option ${selectedDays.includes(day) ? 'is-selected' : ''}`}
                >
                  {day}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="submit" className="habit-submit-button">Adicionar hábito</button>
      </form>

      <div className="habits-list space-y-4">
        <h3 className="section-eyebrow section-heading-title">Meus hábitos · 01</h3>
        <div className="habits-grid">
          {habits.filter(h => !h.deleted).map(h => {
            const habitTone = getHabitTone(h.color);
            const IconMap = {
              'Dumbbell': Dumbbell,
              'Apple': Apple,
              'Activity': Activity,
              'GraduationCap': GraduationCap
            };
            const Icon = IconMap[h.iconName] || Activity;

            return (
              <div key={h.id} className={`habit-note habit-tone-${habitTone} group ${h.color}`}>
                <div className="habit-note-main">
                  <div className="habit-note-head flex justify-between items-start">
                    <div className={`habit-note-icon ${h.iconColor || 'text-stone-800'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="habit-note-actions">
                      <button
                        type="button"
                        className="habit-edit"
                        onClick={() => setEditingHabit(h)}
                        aria-label={`Editar hábito ${h.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="habit-delete"
                        onClick={async () => {
                          const updatedHabits = habits.map(habit => habit.id === h.id ? { ...habit, deleted: true } : habit);
                          setHabits(updatedHabits);
                          await persistOrganizerChange(syncToFirestore, 'habits', updatedHabits, 'Hábito movido para a Lixeira');
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <h4 className="habit-note-title">{h.name}</h4>
                </div>
                <div className="habit-note-footer">
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{h.recurrence}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editingHabit && (
        <HabitEditForm
          key={editingHabit.id}
          habit={editingHabit}
          onCancel={() => setEditingHabit(null)}
          onSave={handleUpdateHabit}
        />
      )}
    </div>
  );
}

// ==========================================
// 6. VISTA DE BLOCO DE NOTAS
// ==========================================
function NotesView({ notes, setNotes, syncToFirestore }) {
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newShoppingItems, setNewShoppingItems] = useState(['']);
  const [newNoteCategory, setNewNoteCategory] = useState('Trabalho');
  const [selectedNote, setSelectedNote] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const availableCategories = NOTE_CATEGORIES;

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteTitle.trim()) return;
    const successMessage = newNoteCategory === 'Compras' ? 'Lista de compras criada!' : 'Nota criada com sucesso!';

    const noteId = Date.now().toString();
    const shoppingItems = newNoteCategory === 'Compras'
      ? createShoppingItems(newShoppingItems, noteId)
      : null;
    const newNote = {
      id: noteId,
      title: newNoteTitle.trim(),
      content: shoppingItems ? shoppingItems.map(item => item.text).join('\n') : newNoteContent.trim(),
      category: newNoteCategory,
      ...(shoppingItems ? { items: shoppingItems } : {})
    };

    const updatedNotes = [newNote, ...notes];
    setNotes(updatedNotes);
    setNewNoteTitle('');
    setNewNoteContent('');
    setNewShoppingItems(['']);
    setNewNoteCategory('Trabalho');
    await persistOrganizerChange(syncToFirestore, 'notes', updatedNotes, successMessage);
  };

  const handleToggleShoppingItem = async (noteId, itemIndex) => {
    const updatedNotes = toggleShoppingItemInNotes(notes, noteId, itemIndex);
    setNotes(updatedNotes);
    setSelectedNote(updatedNotes.find(note => note.id === noteId) || null);
    await persistOrganizerChange(syncToFirestore, 'notes', updatedNotes);
  };

  const handleUpdateNote = async (updatedNote) => {
    const updatedNotes = notes.map(note => note.id === updatedNote.id ? updatedNote : note);
    setNotes(updatedNotes);
    setSelectedNote(updatedNote);
    setEditingNote(null);
    await persistOrganizerChange(
      syncToFirestore,
      'notes',
      updatedNotes,
      updatedNote.category === 'Compras' ? 'Lista atualizada com sucesso!' : 'Nota atualizada com sucesso!'
    );
  };

  const activeNotes = notes.filter(n => !n.deleted);

  return (
    <div className="notes-view space-y-7">
      <form onSubmit={handleAddNote} className="notes-intake">
        <div className="notes-intake-heading">
          <span className="calendar-kicker">Notas · novo registro</span>
          <h2>Escrever nota</h2>
        </div>

        <div className="notes-intake-grid">
          <div className="notes-main-fields">
            <input
              type="text"
              placeholder="Título da nota"
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              className="notes-title-field"
            />
            {newNoteCategory === 'Compras' ? (
              <ShoppingListComposer items={newShoppingItems} onChange={setNewShoppingItems} />
            ) : (
              <textarea
                placeholder="Escreva suas notas ou detalhes aqui..."
                rows="7"
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                className="notes-content-field"
              ></textarea>
            )}
          </div>

          <aside className="notes-meta-fields">
            <span className="habit-field-label">Categoria</span>
            <div className="note-category-list notes-category-list" role="group" aria-label="Categoria da nota">
              {availableCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setNewNoteCategory(category)}
                  className={`note-category-option ${newNoteCategory === category ? 'is-selected' : ''}`}
                  aria-pressed={newNoteCategory === category}
                >
                  <span className="note-category-dot" />
                  {category}
                </button>
              ))}
            </div>
            <button type="submit" className="notes-submit-button">
              <Save className="w-4 h-4" />
              <span>Salvar nota</span>
            </button>
          </aside>
        </div>
      </form>

      <section className="notes-archive">
        <div className="notes-list-header">
          <h3 className="section-eyebrow section-heading-title">Minhas notas · {String(activeNotes.length).padStart(2, '0')}</h3>
        </div>

        {activeNotes.length > 0 ? (
          <div className="notes-grid">
            {activeNotes.map(n => {
              const style = getCategoryStyle(n.category);
              return (
                <article key={n.id} className={`note-preview-card notes-card ${style.bg}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedNote(n)}
                    className="notes-card-open"
                    aria-label={`Abrir nota ${n.title}`}
                  >
                    <span className="note-preview-category">{n.category}</span>
                    <h4>{n.title}</h4>
                    {n.category === 'Compras' ? (
                      <ShoppingListContent note={n} preview />
                    ) : (
                      <p>{n.content || 'Esta nota ainda não possui conteúdo.'}</p>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const updatedNotes = notes.map(note => note.id === n.id ? { ...note, deleted: true } : note);
                      setNotes(updatedNotes);
                      await persistOrganizerChange(syncToFirestore, 'notes', updatedNotes, 'Nota movida para a Lixeira');
                    }}
                    className="notes-delete-button"
                    aria-label="Mover nota para a lixeira"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="notes-empty">Nenhuma nota registrada ainda.</p>
        )}
      </section>

      {selectedNote && (
        <div className="note-viewer-overlay fixed inset-0 z-50 flex items-center justify-center p-5 sm:p-8">
          <div
            className="note-viewer-backdrop fixed inset-0"
            onClick={() => { setSelectedNote(null); setEditingNote(null); }}
          ></div>

          <article className="note-viewer relative z-10" role="dialog" aria-modal="true" aria-labelledby="notes-viewer-title">
            <header className="note-viewer-header flex items-start justify-between">
              <div>
                <span className="note-drawer-kicker">Nota ativa · {selectedNote.category}</span>
                <h2 id="notes-viewer-title" className="note-viewer-title">{selectedNote.title}</h2>
              </div>
              <div className="note-viewer-header-actions">
                {!editingNote && (
                  <button type="button" onClick={() => setEditingNote(selectedNote)} className="note-viewer-edit" aria-label="Editar nota">
                    <Pencil className="w-4 h-4" />
                    <span>Editar</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setSelectedNote(null); setEditingNote(null); }}
                  className="note-drawer-close"
                  aria-label="Fechar visualização da nota"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </header>
            <div className="editorial-rule"></div>
            {editingNote ? (
              <NoteEditForm key={editingNote.id} note={editingNote} onCancel={() => setEditingNote(null)} onSave={handleUpdateNote} />
            ) : (
              <div className="note-viewer-content">
                {selectedNote.category === 'Compras' ? (
                  <ShoppingListContent
                    note={selectedNote}
                    onToggleItem={(itemIndex) => handleToggleShoppingItem(selectedNote.id, itemIndex)}
                  />
                ) : (
                  selectedNote.content || 'Esta nota ainda não possui conteúdo.'
                )}
              </div>
            )}
            <footer className="note-viewer-footer">Passo a passo · registro pessoal</footer>
          </article>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 7. VISTA DE POMODORO
// ==========================================
function PomodoroView({ tasks, setTasks, syncToFirestore }) {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState('');

  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(time => time - 1);
      }, 1000);
    } else if (isActive && timeLeft === 0) {
      setIsActive(false);
      toast.success('Pomodoro concluído! Hora de uma pausa.');
      
      if (selectedTaskId) {
        toast.custom((t) => (
          <div className="editorial-toast-prompt pointer-events-auto">
            <span className="editorial-toast-prompt-kicker">Sessão de foco · ação</span>
            <p>Deseja marcar a tarefa focada como concluída?</p>
            <div className="editorial-toast-prompt-actions">
              <button 
                onClick={async () => {
                  const updatedTasks = tasks.map(task => task.id === selectedTaskId ? { ...task, status: 'concluido' } : task);
                  setTasks(updatedTasks);
                  await persistOrganizerChange(syncToFirestore, 'tasks', updatedTasks, 'Tarefa concluída com a sessão de foco.');
                  toast.dismiss(t);
                  setSelectedTaskId('');
                }}
                className="editorial-toast-prompt-confirm"
              >Sim</button>
              <button onClick={() => toast.dismiss(t)} className="editorial-toast-prompt-cancel">Não</button>
            </div>
          </div>
        ), { duration: 15000 });
      }
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, selectedTaskId, tasks, setTasks, syncToFirestore]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const activeTasks = tasks.filter(t => !t.deleted && t.status !== 'concluido');

  return (
    <div className="pomodoro-view max-w-xl mx-auto space-y-8">
      <div className="pomodoro-heading">
        <span className="calendar-kicker">Sessão de foco · 01</span>
        <h2>Temporizador de foco</h2>
        <p>Mantenha o foco e aumente sua produtividade.</p>
      </div>

      <div className="pomodoro-task-field space-y-3 text-left">
        <label className="habit-field-label">Tarefa em foco · opcional</label>
        <div className="pomodoro-task-select-wrap">
          <select
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            className="pomodoro-task-select"
            disabled={isActive}
          >
            <option value="">Selecione uma tarefa em andamento...</option>
            {activeTasks.map(t => (
              <option key={t.id} value={t.id}>{t.title} ({t.status === 'em_curso' ? 'Em Curso' : 'A Fazer'})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="pomodoro-clock relative overflow-hidden">
        {isActive && <div className="pomodoro-progress" style={{ width: `${(1 - (timeLeft / (25 * 60))) * 100}%` }}></div>}
        <div className="pomodoro-time">
          {formatTime(timeLeft)}
        </div>
        <span className="pomodoro-clock-caption">Intervalo de foco · 25 min</span>
      </div>

      <div className="pomodoro-actions flex justify-center space-x-4">
        <button 
          onClick={() => setIsActive(!isActive)} 
          className={`pomodoro-primary ${isActive ? 'is-paused' : ''}`}
        >
          {isActive ? 'Pausar' : 'Iniciar'}
        </button>
        <button 
          onClick={() => { setIsActive(false); setTimeLeft(25 * 60); }} 
          className="pomodoro-secondary"
        >
          Resetar
        </button>
      </div>
    </div>
  );
}

// ==========================================
// 8. VISTA DE LIXEIRA (SOFT DELETE)
// ==========================================
function TrashView({ tasks, setTasks, habits, setHabits, events, setEvents, notes, setNotes, syncToFirestore }) {
  const deletedTasks = tasks.filter(t => t.deleted);
  const deletedHabits = habits.filter(h => h.deleted);
  const deletedEvents = events.filter(e => e.deleted);
  const deletedNotes = notes.filter(n => n.deleted);
  const totalDeleted = deletedTasks.length + deletedHabits.length + deletedEvents.length + deletedNotes.length;

  const handleRestore = async (collection, setCollection, id, stateName) => {
    const updated = collection.map(item => item.id === id ? { ...item, deleted: false } : item);
    setCollection(updated);
    await persistOrganizerChange(syncToFirestore, stateName, updated, 'Item restaurado com sucesso!');
  };

  const handlePermanentDelete = async (collection, setCollection, id, stateName) => {
    const updated = collection.filter(item => item.id !== id);
    setCollection(updated);
    const saved = await persistOrganizerChange(syncToFirestore, stateName, updated);
    if (saved) toast.error('Item excluído permanentemente');
  };

  const isEmpty = deletedTasks.length === 0 && deletedHabits.length === 0 && deletedEvents.length === 0 && deletedNotes.length === 0;
  const statusLabel = {
    a_fazer: 'A fazer',
    em_curso: 'Em curso',
    concluido: 'Concluído'
  };
  const sections = [
    {
      key: 'tasks',
      eyebrow: 'Tarefas excluídas',
      label: 'Tarefas',
      items: deletedTasks,
      collection: tasks,
      setCollection: setTasks,
      stateName: 'tasks',
      icon: CheckSquare,
      tone: 'task',
      renderTitle: (item) => item.title,
      renderMeta: (item) => [item.category, statusLabel[item.status], item.dueDate].filter(Boolean).join(' · ')
    },
    {
      key: 'habits',
      eyebrow: 'Hábitos excluídos',
      label: 'Hábitos',
      items: deletedHabits,
      collection: habits,
      setCollection: setHabits,
      stateName: 'habits',
      icon: Flame,
      tone: 'habit',
      renderTitle: (item) => item.name,
      renderMeta: (item) => item.frequency === 'specific' && item.days?.length
        ? item.days.join(', ')
        : item.frequency === 'once'
          ? 'Apenas uma vez'
          : 'Todos os dias'
    },
    {
      key: 'events',
      eyebrow: 'Eventos excluídos',
      label: 'Eventos',
      items: deletedEvents,
      collection: events,
      setCollection: setEvents,
      stateName: 'events',
      icon: CalendarIcon,
      tone: 'event',
      renderTitle: (item) => item.title,
      renderMeta: (item) => [item.date, item.time, item.category].filter(Boolean).join(' · ')
    },
    {
      key: 'notes',
      eyebrow: 'Notas excluídas',
      label: 'Notas',
      items: deletedNotes,
      collection: notes,
      setCollection: setNotes,
      stateName: 'notes',
      icon: FileText,
      tone: 'note',
      renderTitle: (item) => item.title,
      renderMeta: (item) => [item.category, item.content ? `${item.content.slice(0, 72)}${item.content.length > 72 ? '…' : ''}` : null].filter(Boolean).join(' · ')
    }
  ].filter(section => section.items.length > 0);

  return (
    <div className="trash-page editorial-page">
      <div className="trash-hero">
        <div>
          <p className="section-kicker">Arquivo temporário · 09</p>
          <h2>Lixeira</h2>
          <p className="trash-subtitle">
            Itens removidos ficam separados aqui antes da exclusão definitiva.
          </p>
        </div>
        <div className="trash-counter" aria-label={`${totalDeleted} itens na lixeira`}>
          <span>{String(totalDeleted).padStart(2, '0')}</span>
          <small>{totalDeleted === 1 ? 'item' : 'itens'}</small>
        </div>
      </div>
      
      {isEmpty ? (
        <div className="trash-empty">
          <div className="trash-empty-mark">
            <Trash2 className="w-6 h-6" />
          </div>
          <p className="section-kicker">Nenhum registro arquivado</p>
          <h3>Lixeira vazia</h3>
          <p>Tudo limpo por aqui. Quando algo for removido, aparecerá nesta área.</p>
        </div>
      ) : (
        <div className="trash-sections">
          {sections.map(section => {
            const SectionIcon = section.icon;
            return (
              <section key={section.key} className="trash-section">
                <div className="trash-section-header">
                  <div className={`trash-section-icon trash-section-icon-${section.tone}`}>
                    <SectionIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <p>{section.eyebrow}</p>
                    <span>{section.items.length} {section.items.length === 1 ? 'registro' : 'registros'}</span>
                  </div>
                </div>

                <div className="trash-records">
                  {section.items.map(item => (
                    <article key={item.id} className={`trash-record trash-record-${section.tone}`}>
                      <div className="trash-record-body">
                        <span className="trash-record-type">{section.label}</span>
                        <h3>{section.renderTitle(item)}</h3>
                        {section.renderMeta(item) && <p>{section.renderMeta(item)}</p>}
                      </div>
                      <div className="trash-record-actions">
                        <button
                          type="button"
                          onClick={() => handleRestore(section.collection, section.setCollection, item.id, section.stateName)}
                          className="trash-action trash-action-restore"
                          aria-label={`Restaurar ${section.renderTitle(item)}`}
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Restaurar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePermanentDelete(section.collection, section.setCollection, item.id, section.stateName)}
                          className="trash-action trash-action-delete"
                          aria-label={`Excluir definitivamente ${section.renderTitle(item)}`}
                        >
                          <X className="w-4 h-4" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
