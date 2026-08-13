import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { auth, googleProvider, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, db, doc, setDoc, getDoc, collection, onSnapshot, updateDoc, deleteDoc, addDoc, query, where, orderBy, serverTimestamp } from './firebase/config';
import { addEventToGoogleCalendar, updateEventInGoogleCalendar, deleteEventFromGoogleCalendar } from './firebase/calendarAPI';
import {
  LayoutDashboard,
  CheckSquare,
  Flame,
  Calendar as CalendarIcon,
  Notebook,
  Timer,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  MessageCircle,
  Clock,
  Search,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Brain,
  Tag,
  BookOpen,
  Heart,
  Briefcase,
  User,
  Send,
  Smartphone,
  CheckCheck,
  ShieldCheck,
  Check,
  AlertCircle,
  Settings,
  BellRing,
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
  CloudRain,
  Sun,
  CloudLightning,
  Snowflake,
  MapPin,
  Loader2
} from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LocalAIAssistant } from './components/LocalAIAssistant';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Tipografia editorial: serif para títulos e sans para a interface.
if (typeof document !== 'undefined') {
  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700&display=swap';
  link.rel = 'stylesheet';
  document.head.appendChild(link);
}

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

const getCategoryIcon = (cat) => {
  switch (cat) {
    case 'Trabalho': return <Briefcase className="w-4 h-4 mr-1.5" />;
    case 'Pessoal': return <User className="w-4 h-4 mr-1.5" />;
    case 'Saúde': return <Heart className="w-4 h-4 mr-1.5" />;
    case 'Estudos': return <BookOpen className="w-4 h-4 mr-1.5" />;
    default: return <Tag className="w-4 h-4 mr-1.5" />;
  }
};

// DADOS INICIAIS DE EXEMPLO
const INITIAL_TASKS = [
  { id: '1', title: 'Rever proposta de projeto e métricas', category: 'Trabalho', priority: 'Alta', status: 'em_curso', dueDate: '2026-07-30' },
  { id: '2', title: 'Treino de corrida no parque (30 min)', category: 'Saúde', priority: 'Média', status: 'concluido', dueDate: '2026-07-30' },
  { id: '3', title: 'Ler 2 capítulos de Hábitos Atómicos', category: 'Estudos', priority: 'Baixa', status: 'a_fazer', dueDate: '2026-07-30' },
  { id: '4', title: 'Organizar despensa e compras semanais', category: 'Pessoal', priority: 'Média', status: 'a_fazer', dueDate: '2026-07-30' },
  { id: '5', title: 'Enviar relatório semanal para a equipa', category: 'Trabalho', priority: 'Alta', status: 'a_fazer', dueDate: '2026-07-31' },
  { id: '6', title: 'Consulta de avaliação física', category: 'Saúde', priority: 'Média', status: 'a_fazer', dueDate: '2026-08-01' }
];

const INITIAL_HABITS = [
  { id: 'h_treino', name: 'Treino', color: 'bg-[#4A85F6]', iconColor: 'text-[#4A85F6]', recurrence: 'Todos os dias', iconName: 'Dumbbell' },
  { id: 'h_dieta', name: 'Dieta', color: 'bg-[#FF9B6A]', iconColor: 'text-[#FF9B6A]', recurrence: 'Seg, Qui', iconName: 'Apple' },
  { id: 'h_cardio', name: 'Cardio', color: 'bg-[#9864F5]', iconColor: 'text-[#9864F5]', recurrence: 'Todos os dias', iconName: 'Activity' },
  { id: 'h_estudo', name: 'Estudo', color: 'bg-[#10B981]', iconColor: 'text-[#10B981]', recurrence: 'Todos os dias', iconName: 'GraduationCap' }
];

const INITIAL_NOTES = [
  { id: 'n1', title: 'Ideias de Layout', content: 'Design minimalista com tipografia em negrito, cards pastéis sem bordas e sombras flutuantes.', category: 'Trabalho' },
  { id: 'n2', title: 'Lista de Compras da Semana', content: '• Frutas da época\n• Granola sem açúcar\n• Café em grão', category: 'Pessoal' }
];

const INITIAL_EVENTS = [
  { id: 'e1', title: 'Reunião de Alinhamento de Equipa', date: '2026-07-30', time: '14:30', category: 'Trabalho', whatsappAlert: true, reminderMinutes: 15 },
  { id: 'e2', title: 'Consulta Médica de Rotina', date: '2026-07-30', time: '17:00', category: 'Saúde', whatsappAlert: true, reminderMinutes: 30 },
  { id: 'e3', title: 'Workshop Online: React & Tailwind', date: '2026-07-31', time: '10:00', category: 'Estudos', whatsappAlert: true, reminderMinutes: 60 }
];

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
          } catch (e) {}
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
      (err) => {
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
      <div className="flex flex-col items-end justify-center h-full">
        <Loader2 className="w-5 h-5 text-stone-300 animate-spin" />
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="flex flex-col items-end text-right opacity-50">
         <div className="flex items-center space-x-2 text-stone-400">
           <CloudSun className="w-5 h-5" />
           <span className="text-sm font-bold">Clima Indisponível</span>
         </div>
      </div>
    );
  }

  const { icon: WeatherIcon, color } = getWeatherDetails(weather.weatherCode);

  return (
    <div className="flex flex-col items-end text-right">
      <div className="flex items-center space-x-2">
        <WeatherIcon className={`w-8 h-8 ${color}`} />
        <span className="text-3xl font-black text-stone-900 tracking-tight">{weather.temp}°C</span>
      </div>
      <p className="text-[11px] text-stone-500 font-medium mt-1 uppercase tracking-wide">
        {city} • Máx {weather.maxTemp}° / Mín {weather.minTemp}°
      </p>
      <div className="flex items-center space-x-3 text-[10px] font-semibold text-stone-400 mt-1">
        <span className="flex items-center"><Droplets className="w-3 h-3 mr-1" />{weather.humidity}% Umid</span>
        <span className="flex items-center"><Wind className="w-3 h-3 mr-1" />{weather.windSpeed} km/h</span>
      </div>
    </div>
  );
}

export default function App() {
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

  // Authentication State
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState(null);

  useEffect(() => {
    let unsubscribeDb = null;
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        unsubscribeDb = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.tasks) setTasks(data.tasks);
            if (data.habits) setHabits(data.habits);
            if (data.notes) setNotes(data.notes);
            if (data.events) setEvents(data.events);
            if (data.dailyHabitsState) {
              const today = new Date().toISOString().split('T')[0];
              if (data.dailyHabitsState.currentDate !== today) {
                const resetState = { currentDate: today, completed: {} };
                setDailyHabitsState(resetState);
                updateDoc(userRef, { dailyHabitsState: resetState }).catch(console.error);
              } else {
                setDailyHabitsState(data.dailyHabitsState);
              }
            }
          } else {
            // Document doesn't exist, create it with initial data
            const initialData = {
              tasks: INITIAL_TASKS,
              habits: INITIAL_HABITS,
              notes: INITIAL_NOTES,
              events: INITIAL_EVENTS,
              dailyHabitsState: {
                currentDate: new Date().toISOString().split('T')[0],
                completed: {}
              }
            };
            setDoc(userRef, initialData);
          }
        });
      } else {
        if (unsubscribeDb) unsubscribeDb();
      }
    });
    
    return () => {
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
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  const syncToFirestore = async (field, data) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { [field]: data });
    } catch (e) {
      console.error(`Erro ao sincronizar ${field}:`, e);
    }
  };

  // ESTADOS PRINCIPAIS
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [habits, setHabits] = useState(INITIAL_HABITS);
  const [notes, setNotes] = useState(INITIAL_NOTES);
  const [events, setEvents] = useState(INITIAL_EVENTS);

  // Estado para controlo dos Hábitos Diários e data da última atualização
  const [dailyHabitsState, setDailyHabitsState] = useState(() => {
    const todayStr = new Date().toISOString().split('T')[0];
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

  // Efeito para verificar se o dia mudou e zerar os hábitos
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (dailyHabitsState.lastDate !== todayStr) {
      setDailyHabitsState({
        lastDate: todayStr,
        completed: {
          h_treino: false,
          h_dieta: false,
          h_cardio: false,
          h_estudo: false
        }
      });
    }
  }, []);

  const toggleDailyHabit = (habitId) => {
    setDailyHabitsState(prev => {
      const newState = {
        ...prev,
        completed: {
          ...prev.completed,
          [habitId]: !prev.completed[habitId]
        }
      };
      syncToFirestore('dailyHabitsState', newState);
      return newState;
    });
  };

  const navItems = [
    { id: 'dashboard', label: 'Painel Principal' },
    { id: 'calendar', label: 'Calendário Mensal' },
    { id: 'tasks', label: 'Tarefas', badge: tasks.filter(t => t.status !== 'concluido' && !t.deleted).length },
    { id: 'habits', label: 'Hábitos' },
    { id: 'notes', label: 'Notas' },
    { id: 'pomodoro', label: 'Foco (Pomodoro)' },
    { id: 'chat', label: 'Mensagens' },
    { id: 'ai_setup', label: 'Assistente IA' },
    { id: 'trash', label: 'Lixeira' }
  ];

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-screen min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <div className="login-card bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgb(0,0,0,0.06)] max-w-md w-full space-y-8 text-center border border-stone-100/50">
          <div className="login-mark w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-sm border border-emerald-100/50">
            <CheckSquare className="w-10 h-10 text-emerald-600" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black text-stone-800 tracking-tight">Organizador</h1>
            <p className="text-stone-500 font-medium text-sm leading-relaxed px-4">
              Faça login com sua conta do Google para sincronizar suas tarefas, hábitos e calendário na nuvem.
            </p>
          </div>
          
          <div className="pt-4">
            <button 
              onClick={handleLogin}
              className="w-full py-4 px-4 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-xl font-bold flex items-center justify-center space-x-3 transition-all hover:shadow-md hover:-transtone-y-0.5 active:transtone-y-0"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Continuar com o Google</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell text-stone-800 font-sans antialiased relative">
      <Toaster position="top-right" richColors />

      <button
        onClick={() => setMobileMenuOpen(true)}
        className="app-menu-button app-menu-trigger"
        aria-label="Abrir Menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* O Toast agora é gerenciado globalmente pelo Sonner (<Toaster />) */}

      {/* DRAWER ÚNICO A DIREITA */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-stone-900/20 backdrop-blur-xs z-40"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="menu-drawer fixed top-0 right-0 z-50 h-screen p-4 overflow-y-auto bg-white w-80 shadow-2xl flex flex-col justify-between"
            >
              <div>
                <div className="border-b border-stone-100 pb-4 flex items-center justify-between">
                  <span className="self-center text-xl font-bold whitespace-nowrap text-stone-900">Menu</span>
                  <button 
                    onClick={() => setMobileMenuOpen(false)} 
                    className="text-stone-500 bg-transparent hover:text-stone-900 hover:bg-stone-100 rounded-md w-9 h-9 flex items-center justify-center transition-colors"
                  >
                     <X className="w-5 h-5" />
                     <span className="sr-only">Close menu</span>
                  </button>
                </div>
                
                <div className="py-5 overflow-y-auto">
                  <ul className="space-y-1 font-medium">
                    {navItems.map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <li key={item.id}>
                          <button
                            onClick={() => {
                              handleTabChange(item.id);
                              setMobileMenuOpen(false);
                            }}
                            className={`flex items-center w-full px-3 py-2.5 rounded-md group transition-colors ${
                              isActive 
                                ? 'bg-stone-100 text-stone-900 font-bold' 
                                : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                            }`}
                          >
                            <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                            {item.badge > 0 && (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 ms-2 text-[10px] font-bold text-stone-800 bg-stone-200 rounded-md">
                                {item.badge}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              {/* Status de Sincronização do Google Calendar */}
              <div className="pt-4 border-t border-stone-200 space-y-3">
                <button 
                  onClick={() => {
                    handleTabChange('google_calendar');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full p-2.5 rounded-md text-xs flex items-center justify-between transition-colors shadow-xs ${
                    googleAccessToken 
                      ? 'bg-blue-100 text-blue-900 font-medium' 
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <CalendarIcon className={`w-3.5 h-3.5 ${googleAccessToken ? 'text-blue-700' : 'text-stone-400'}`} />
                    <span className="font-semibold">{googleAccessToken ? 'GCalendar Ativo' : 'Ativar GCalendar'}</span>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${googleAccessToken ? 'bg-blue-600' : 'bg-stone-400'}`}></span>
                </button>

                <div className="flex items-center space-x-3 px-2">
                  <div className="w-8 h-8 rounded-md bg-stone-200 text-stone-800 font-bold flex items-center justify-center text-xs">
                    GC
                  </div>
                  <div className="text-xs overflow-hidden">
                    <p className="font-semibold text-stone-800 truncate">{user ? user.displayName : 'Usuário'}</p>
                    <p className="text-stone-500 truncate font-medium">{user ? user.email : 'Faça login'}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Conteúdo Principal */}
      <div className="app-content min-w-0">
        <main className="app-main">
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="editorial-view max-w-5xl mx-auto space-y-8"
            >
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
                  tasks={tasks} 
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
                            {activeTab === 'ai_setup' && (
                <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
                  <header className="mb-8">
                    <button
                      onClick={() => handleTabChange('dashboard')}
                      className="inline-flex items-center gap-2 mb-3 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-100 px-3 py-1.5 rounded-lg border border-stone-200 shadow-xs transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar ao Painel</span>
                    </button>
                    <h1 className="text-3xl font-black text-stone-800 tracking-tight mb-2">Assistente IA Local</h1>
                    <p className="text-stone-500">Configure sua inteligência artificial privada e 100% gratuita.</p>
                  </header>

                  <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-8">
                    <div className="flex items-start gap-6 mb-8">
                      <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                        <Brain className="w-8 h-8 text-amber-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-stone-800 mb-2">Traga sua Própria IA (BYOAI)</h2>
                        <p className="text-stone-600 leading-relaxed">
                          O Organizador Pessoal foi construído com foco em <strong>privacidade absoluta</strong>.
                          Em vez de enviar suas notas e tarefas para a nuvem da OpenAI ou Google, este aplicativo
                          se conecta a uma IA que roda <strong>diretamente no seu computador</strong>.
                        </p>
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-stone-800 mb-4 border-b border-stone-100 pb-2">Como Ativar (Passo a Passo)</h3>
                    
                    <div className="space-y-6">
                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold shrink-0">1</div>
                        <div>
                          <h4 className="font-bold text-stone-800">Baixe e instale o Ollama</h4>
                          <p className="text-stone-600 text-sm mt-1">O Ollama é o motor que roda os modelos de IA no seu computador.</p>
                          <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium underline">Baixar Ollama no site oficial</a>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold shrink-0">2</div>
                        <div>
                          <h4 className="font-bold text-stone-800">Baixe o Modelo (Llama 3)</h4>
                          <p className="text-stone-600 text-sm mt-1">Abra o seu Terminal (Mac/Linux) ou Prompt de Comando (Windows) e digite o seguinte comando:</p>
                          <div className="mt-2 bg-stone-900 text-stone-200 px-4 py-2 rounded-lg font-mono text-sm inline-block">
                            ollama run llama3.2
                          </div>
                          <p className="text-stone-500 text-xs mt-2">O download tem cerca de 2GB a 4GB. Aguarde a conclusão.</p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold shrink-0">3</div>
                        <div>
                          <h4 className="font-bold text-stone-800">Deixe rodando no fundo</h4>
                          <p className="text-stone-600 text-sm mt-1">Pronto! Sempre que você quiser que o Ajudante do Dia funcione aqui no aplicativo, basta garantir que o programa Ollama esteja aberto no seu computador. Os dados nunca saem da sua máquina.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'trash' && (
                <TrashView 
                  tasks={tasks} setTasks={setTasks}
                  habits={habits} setHabits={setHabits}
                  events={events} setEvents={setEvents}
                  notes={notes} setNotes={setNotes}
                  syncToFirestore={syncToFirestore}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {(import.meta.env.VITE_ENABLE_LOCAL_AI === 'true') && <LocalAIAssistant tasks={tasks} habits={habits} notes={notes} user={user} />}
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

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayEvents = events.filter(e => e.date === todayStr && !e.deleted);

  return (
    <div className="editorial-panel bg-white p-4 sm:p-5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3">
      {/* Linha dos dias */}
      <div className="flex justify-between items-center overflow-x-auto gap-2 scrollbar-hide pb-1">
        {nextDays.map((date, i) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          
          const dayEvents = events.filter(e => e.date === dateStr && !e.deleted);
          const hasEvent = dayEvents.length > 0;
          
          return (
            <div key={i} className="flex flex-col items-center group cursor-default min-w-[2.5rem]">
              <span className={`text-[10px] font-bold uppercase mb-1.5 tracking-wider ${i === 0 ? 'text-stone-900' : 'text-stone-400'}`}>
                {i === 0 ? 'Hoje' : DAYS_OF_WEEK[date.getDay()]}
              </span>
              <div className={`w-8 h-8 rounded-full flex flex-col items-center justify-center relative transition-all ${
                i === 0 ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600 bg-stone-50 group-hover:bg-stone-100'
              }`}>
                <span className="text-sm font-black tracking-tight">{date.getDate()}</span>
              </div>
              <div className="h-1 mt-1.5 flex gap-0.5 justify-center">
                {dayEvents.slice(0, 3).map((e, idx) => {
                  const style = getCategoryStyle(e.category);
                  return <div key={idx} className={`w-1 h-1 rounded-full ${style.dot}`} title={e.title}></div>;
                })}
                {!hasEvent && <div className="w-1 h-1 rounded-full bg-transparent"></div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Prévia de Eventos de Hoje */}
      {todayEvents.length > 0 ? (
        <div className="pt-3 border-t border-stone-100/50 space-y-2">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Agendamentos de Hoje</span>
          <div className="space-y-1.5">
            {todayEvents.map(e => (
              <div key={e.id} className="flex items-center space-x-2 text-sm">
                <div className={`w-1.5 h-1.5 rounded-full ${getCategoryStyle(e.category).dot}`}></div>
                <span className="font-semibold text-stone-800 shrink-0">{e.time}</span>
                <span className="text-stone-600 truncate">{e.title}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="pt-2 border-t border-stone-100/50">
           <span className="text-xs font-medium text-stone-400">Nenhum agendamento para hoje. Aproveite o dia!</span>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 1. VISTA DO PAINEL PRINCIPAL (DASHBOARD NOTION)
// ==========================================
function TaskNoteContent({ task, onToggle, onDelete, completed = false }) {
  return (
    <div className="task-note-layout">
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onToggle}
        className="task-check"
        aria-label={completed ? 'Reabrir tarefa' : 'Concluir tarefa'}
      >
        {completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
      </button>
      <div className="task-note-copy">
        <span className="task-note-category">{task.category}</span>
        <p className={`task-note-title ${completed ? 'task-note-title-complete' : ''}`}>{task.title}</p>
      </div>
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
  
  // Estados para os campos da nova nota
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState('Trabalho');

  const toggleTaskStatus = (taskId) => {
    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          status: t.status === 'a_fazer' ? 'em_curso' : t.status === 'em_curso' ? 'concluido' : 'a_fazer'
        };
      }
      return t;
    });
    setTasks(updatedTasks);
    if(syncToFirestore) syncToFirestore('tasks', updatedTasks);
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const sourceStatus = source.droppableId;
    const destStatus = destination.droppableId;

    const activeTasks = tasks.filter(t => !t.deleted);
    const deletedTasks = tasks.filter(t => t.deleted);

    const sourceTasks = activeTasks.filter(t => t.status === sourceStatus);
    const destTasks = sourceStatus === destStatus ? sourceTasks : activeTasks.filter(t => t.status === destStatus);

    const movedTask = { ...sourceTasks[source.index], status: destStatus };
    sourceTasks.splice(source.index, 1);
    
    if (sourceStatus !== destStatus) {
      destTasks.splice(destination.index, 0, movedTask);
    } else {
      sourceTasks.splice(destination.index, 0, movedTask);
    }

    const otherActiveTasks = activeTasks.filter(t => t.status !== sourceStatus && t.status !== destStatus);
    
    let newTasks = [];
    if (sourceStatus === destStatus) {
      newTasks = [...otherActiveTasks, ...sourceTasks, ...deletedTasks];
    } else {
      newTasks = [...otherActiveTasks, ...sourceTasks, ...destTasks, ...deletedTasks];
    }
    
    setTasks(newTasks);
    if(syncToFirestore) syncToFirestore('tasks', newTasks);
  };

  const handleSaveNote = (e) => {
    e.preventDefault();
    if (!newNoteTitle.trim()) return;
    const newNote = {
      id: Date.now().toString(),
      title: newNoteTitle,
      content: newNoteContent,
      category: newNoteCategory
    };
    const updatedNotes = [newNote, ...notes];
    setNotes(updatedNotes);
    if(syncToFirestore) syncToFirestore('notes', updatedNotes);
    setNewNoteTitle('');
    setNewNoteContent('');
    setIsNoteDrawerOpen(false);
  };

  const availableCategories = ['Trabalho', 'Pessoal', 'Saúde', 'Estudos'];
  
  // Cálculo de progresso dos Hábitos
  const completedHabitsCount = Object.values(dailyHabitsState.completed).filter(Boolean).length;
  const habitsProgressPct = habits.length > 0 ? Math.round((completedHabitsCount / habits.length) * 100) : 0;

  return (
    <div className="editorial-page space-y-8">
      
      {/* 1. TEXTO DE BOAS-VINDAS E CLIMA NO MESMO ALINHAMENTO */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-2">
        <div>
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
        </div>
        <WeatherWidget />
      </div>

      {/* 2. PRÉVIA DO CALENDÁRIO SEMANAL */}
      <WeeklyCalendarPreview events={events} />

      {/* 3. SEÇÃO DE HÁBITOS DIÁRIOS (COLOCADA ACIMA DA LISTA DE TAREFAS) */}
      <div className="editorial-panel bg-white p-6 sm:p-8 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <h2 className="font-bold text-2xl text-stone-900">Rastreador de Hábitos</h2>
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
                onClick={() => toggleDailyHabit(habit.id)}
                className={`p-4 rounded-2xl flex items-center justify-between transition-all cursor-pointer select-none group ${
                  isDone 
                    ? 'bg-stone-100' 
                    : `${habit.color} hover:shadow-lg hover:-transtone-y-0.5`
                }`}
              >
                {/* Ícone e Texto */}
                <div className="flex items-center space-x-3.5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white shadow-sm ${isDone ? 'text-stone-400 opacity-60' : habit.iconColor || 'text-stone-800'}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col">
                    <span className={`font-bold text-base ${isDone ? 'text-stone-500 line-through' : 'text-white'}`}>{habit.name}</span>
                    <span className={`text-[11px] ${isDone ? 'text-stone-400' : 'text-white/80 font-medium'}`}>{habit.recurrence}</span>
                  </div>
                </div>

                {/* Ação (Check) */}
                <div>
                  {isDone ? (
                    <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                  ) : (
                    <Circle className="w-7 h-7 text-white/40 group-hover:text-white transition-colors" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. LISTA DE TAREFAS (QUADRO HORIZONTAL) */}
      <div className="editorial-panel bg-white p-6 sm:p-8 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-stone-900 text-2xl">Lista de tarefas</h3>
          <span className="text-xs text-stone-400 font-medium md:hidden">Deslize para o lado →</span>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="task-board-columns flex md:grid md:grid-cols-3 gap-4 overflow-x-auto md:overflow-x-visible pb-4 pt-1 snap-x md:snap-none scrollbar-thin">
            
            {/* Coluna A Fazer */}
            <div className="task-lane min-w-[280px] sm:min-w-[320px] md:min-w-0 bg-stone-100/80 p-4 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3 snap-start shrink-0 flex flex-col max-h-[500px]">
              <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                <span className="font-bold text-xs uppercase tracking-wider text-stone-700 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-stone-400"></span>
                  <span>A Fazer</span>
                </span>
                <span className="text-xs font-bold text-stone-500">
                  ({tasks.filter(t => t.status === 'a_fazer' && !t.deleted).length})
                </span>
              </div>

              <Droppable droppableId="a_fazer">
                {(provided) => (
                  <div 
                    ref={provided.innerRef} 
                    {...provided.droppableProps} 
                    className="space-y-2.5 overflow-y-auto pr-1 flex-1 min-h-[100px]"
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
                              className={`task-note group ${style.bg} ${snapshot.isDragging ? 'is-dragging' : ''}`}
                            >
                              <TaskNoteContent
                                task={t}
                                onToggle={() => toggleTaskStatus(t.id)}
                                onDelete={() => {
                                  const updatedTasks = tasks.map(task => task.id === t.id ? { ...task, deleted: true } : task);
                                  setTasks(updatedTasks);
                                  if(syncToFirestore) syncToFirestore('tasks', updatedTasks);
                                  toast.success('Tarefa movida para a Lixeira');
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
            <div className="task-lane min-w-[280px] sm:min-w-[320px] md:min-w-0 bg-stone-100/80 p-4 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3 snap-start shrink-0 flex flex-col max-h-[500px]">
              <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                <span className="font-bold text-xs uppercase tracking-wider text-amber-800 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>Em Curso</span>
                </span>
                <span className="text-xs font-bold text-amber-800">
                  ({tasks.filter(t => t.status === 'em_curso' && !t.deleted).length})
                </span>
              </div>

              <Droppable droppableId="em_curso">
                {(provided) => (
                  <div 
                    ref={provided.innerRef} 
                    {...provided.droppableProps} 
                    className="space-y-2.5 overflow-y-auto pr-1 flex-1 min-h-[100px]"
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
                              className={`task-note group ${style.bg} ${snapshot.isDragging ? 'is-dragging' : ''}`}
                            >
                              <TaskNoteContent
                                task={t}
                                onToggle={() => toggleTaskStatus(t.id)}
                                onDelete={() => {
                                  const updatedTasks = tasks.map(task => task.id === t.id ? { ...task, deleted: true } : task);
                                  setTasks(updatedTasks);
                                  if(syncToFirestore) syncToFirestore('tasks', updatedTasks);
                                  toast.success('Tarefa movida para a Lixeira');
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
            <div className="task-lane min-w-[280px] sm:min-w-[320px] md:min-w-0 bg-stone-100/80 p-4 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3 snap-start shrink-0 flex flex-col max-h-[500px]">
              <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                <span className="font-bold text-xs uppercase tracking-wider text-emerald-800 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Concluído</span>
                </span>
                <span className="text-xs font-bold text-emerald-800">
                  ({tasks.filter(t => t.status === 'concluido' && !t.deleted).length})
                </span>
              </div>

              <Droppable droppableId="concluido">
                {(provided) => (
                  <div 
                    ref={provided.innerRef} 
                    {...provided.droppableProps} 
                    className="space-y-2.5 overflow-y-auto pr-1 flex-1 min-h-[100px]"
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
                              className={`task-note task-note-complete group ${style.bg} ${snapshot.isDragging ? 'is-dragging' : ''}`}
                            >
                              <TaskNoteContent
                                task={t}
                                completed
                                onToggle={() => toggleTaskStatus(t.id)}
                                onDelete={() => {
                                  const updatedTasks = tasks.map(task => task.id === t.id ? { ...task, deleted: true } : task);
                                  setTasks(updatedTasks);
                                  if(syncToFirestore) syncToFirestore('tasks', updatedTasks);
                                  toast.success('Tarefa movida para a Lixeira');
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
        <div className="flex items-center justify-between border-b border-stone-100 pb-5 mb-2">
          <h3 className="font-bold text-stone-900 text-2xl flex items-center space-x-2">
            <span>Notas</span>
          </h3>
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
                  <p className="text-xs text-stone-800 leading-relaxed whitespace-pre-line">{note.content}</p>
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
            onClick={() => setSelectedNote(null)}
          ></div>

          <article className="note-viewer relative z-10" role="dialog" aria-modal="true" aria-labelledby="note-viewer-title">
            <header className="note-viewer-header flex items-start justify-between">
              <div>
                <span className="note-drawer-kicker">Nota arquivada · {selectedNote.category}</span>
                <h2 id="note-viewer-title" className="note-viewer-title">{selectedNote.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNote(null)}
                className="note-drawer-close"
                aria-label="Fechar visualização da nota"
              >
                <X className="w-5 h-5" />
              </button>
            </header>
            <div className="editorial-rule"></div>
            <div className="note-viewer-content">
              {selectedNote.content || 'Esta nota ainda não possui conteúdo.'}
            </div>
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
                    Conteúdo
                  </label>
                  <textarea
                    placeholder="Escreva as tuas notas ou detalhes aqui..."
                    rows="10"
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    className="note-textarea"
                  ></textarea>
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

    </div>
  );
}

// ==========================================
// 2. VISTA DE CONFIGURAÇÃO DO GOOGLE CALENDAR
// ==========================================
function GoogleCalendarSyncView({ googleAccessToken, handleLogin, handleLogout }) {
  return (
    <div className="space-y-6">
      <div className="bg-blue-800 text-white p-6 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-md bg-blue-700 flex items-center justify-center text-white shrink-0">
            <CalendarIcon className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Sincronização com Google Calendar</h2>
            <p className="text-blue-100 text-sm mt-0.5">
              Sincronize seus eventos criados aqui diretamente na sua agenda do Google para receber notificações push gratuitas.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-5 max-w-2xl">
        <h3 className="font-bold text-stone-900 text-base flex items-center space-x-2">
          <Settings className="w-5 h-5 text-blue-700" />
          <span>Status da Conexão</span>
        </h3>

        <div className="space-y-6">
          <div className="flex items-center space-x-3 p-4 bg-stone-50 rounded-lg border border-stone-200">
            <div className={`w-3 h-3 rounded-full ${googleAccessToken ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
            <div className="flex-1">
              <p className="font-semibold text-stone-800">
                {googleAccessToken ? 'Conectado ao Google Calendar' : 'Não conectado'}
              </p>
              <p className="text-sm text-stone-500">
                {googleAccessToken 
                  ? 'Seus novos eventos serão criados automaticamente na sua agenda principal.'
                  : 'Faça login para permitir que o aplicativo adicione eventos na sua agenda.'}
              </p>
            </div>
          </div>

          <div className="pt-2">
            {!googleAccessToken ? (
              <button
                onClick={handleLogin}
                className="w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md text-sm shadow-sm transition-all flex items-center justify-center space-x-2"
              >
                <CalendarIcon className="w-4 h-4" />
                <span>Vincular Conta do Google</span>
              </button>
            ) : (
              <button
                onClick={handleLogout}
                className="w-full md:w-auto px-6 py-3 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 font-bold rounded-md text-sm shadow-sm transition-all flex items-center justify-center space-x-2"
              >
                <span>Desvincular e Sair</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. VISTA DE CALENDÁRIO MENSAL
// ==========================================
function CalendarView({ events, setEvents, tasks, syncToFirestore, googleAccessToken }) {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 6, 1));
  const [selectedDateStr, setSelectedDateStr] = useState('2026-07-30');
  
  const [eventTitle, setEventTitle] = useState('');
  const [eventTime, setEventTime] = useState('09:00');
  const [eventCategory, setEventCategory] = useState('Trabalho');
  const [syncGoogle, setSyncGoogle] = useState(true);
  const [isAddingEvent, setIsAddingEvent] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

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

    // Sincroniza com Google Calendar se o token estiver disponível e o usuário quiser
    if (googleAccessToken && syncGoogle) {
      try {
        const googleId = await addEventToGoogleCalendar(newEvent, googleAccessToken);
        if (googleId) {
          newEvent.googleEventId = googleId;
          toast.success("Evento adicionado ao Google Calendar!");
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
    if(syncToFirestore) syncToFirestore('events', updatedEvents);
    
    setEventTitle('');
    setIsAddingEvent(false);
  };

  const dayEvents = events.filter(ev => ev.date === selectedDateStr && !ev.deleted);

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex justify-between items-center">
        <h2 className="text-xl font-bold text-stone-900">{MONTH_NAMES[month]} {year}</h2>
        <div className="flex space-x-2">
          <button onClick={prevMonth} className="p-2 border border-stone-300 rounded-md hover:bg-stone-100"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={nextMonth} className="p-2 border border-stone-300 rounded-md hover:bg-stone-100"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-5 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
          <div className="grid grid-cols-7 text-center border-b border-stone-200 pb-2">
            {DAYS_OF_WEEK.map(d => <span key={d} className="text-xs font-bold text-stone-500 uppercase">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((item, idx) => {
              if (!item) return <div key={`empty-${idx}`} className="h-20 rounded-md bg-stone-100/60"></div>;
              const isSelected = item.dateStr === selectedDateStr;
              const dayEvs = events.filter(e => e.date === item.dateStr && !e.deleted);

              return (
                <div
                  key={item.dateStr}
                  onClick={() => setSelectedDateStr(item.dateStr)}
                  className={`h-20 p-1.5 rounded-md flex flex-col justify-between cursor-pointer transition-all ${
                    isSelected ? 'bg-stone-200 ring-2 ring-stone-400 shadow-sm' : 'bg-white hover:bg-stone-50'
                  }`}
                >
                  <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded ${isSelected ? 'bg-stone-900 text-white' : 'text-stone-800'}`}>{item.dayNumber}</span>
                  <div className="space-y-1">
                    {dayEvs.slice(0, 1).map(ev => (
                      <div key={ev.id} className="text-[9px] truncate px-1 py-0.5 rounded bg-blue-200 text-blue-900 font-bold flex items-center justify-between">
                        <span className="truncate">{ev.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
          <h3 className="font-bold text-stone-800 text-sm">Adicionar Evento ({selectedDateStr})</h3>
          <form onSubmit={addEvent} className="space-y-3">
            <input type="text" placeholder="Título do evento..." value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} className="w-full px-3 py-2 rounded-md border border-stone-300 bg-stone-50 text-sm focus:outline-none" />
            <div className="flex gap-2">
              <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="w-1/2 px-3 py-2 rounded-md border border-stone-300 text-sm" />
              <select value={eventCategory} onChange={(e) => setEventCategory(e.target.value)} className="w-1/2 px-3 py-2 rounded-md border border-stone-300 text-sm">
                <option value="Trabalho">Trabalho</option>
                <option value="Pessoal">Pessoal</option>
                <option value="Saúde">Saúde</option>
              </select>
            </div>
            {googleAccessToken && (
              <label className="flex items-center space-x-2 text-xs text-stone-700 font-medium">
                <input 
                  type="checkbox" 
                  checked={syncGoogle}
                  onChange={(e) => setSyncGoogle(e.target.checked)}
                  className="rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Sincronizar no Google Calendar</span>
              </label>
            )}
            <button type="submit" disabled={isAddingEvent} className="w-full py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white font-semibold rounded-md text-sm shadow-xs transition-colors">
              {isAddingEvent ? 'Adicionando...' : 'Adicionar ao Calendário'}
            </button>
          </form>

          <div className="space-y-2 pt-2">
            {dayEvents.map(ev => {
              const style = getCategoryStyle(ev.category);
              return (
                <div key={ev.id} className={`p-3 rounded-md ${style.bg} flex justify-between items-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] group`}>
                  <div>
                    <span className="text-xs font-bold text-stone-800">{ev.time}</span>
                    <p className="font-semibold text-stone-900 text-sm mt-0.5">{ev.title}</p>
                  </div>
                  <button onClick={async () => {
                    const updatedEvents = events.map(e => e.id === ev.id ? { ...e, deleted: true } : e);
                    setEvents(updatedEvents);
                    if(syncToFirestore) syncToFirestore('events', updatedEvents);
                    
                    if (ev.googleEventId && googleAccessToken) {
                      await deleteEventFromGoogleCalendar(ev.googleEventId, googleAccessToken);
                    }
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

  const addTask = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const updatedTasks = [...tasks, { id: Date.now().toString(), title: newTaskTitle, category: newTaskCategory, priority: 'Média', status: 'a_fazer', dueDate: '2026-07-30' }];
    setTasks(updatedTasks);
    if(syncToFirestore) syncToFirestore('tasks', updatedTasks);
    setNewTaskTitle('');
  };

  return (
    <div className="space-y-6">
      <form onSubmit={addTask} className="bg-white p-4 sm:p-6 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col sm:flex-row gap-3">
        <input type="text" placeholder="Adicionar tarefa..." value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="flex-1 px-4 py-3 rounded-lg bg-stone-50 border-0 focus:ring-2 focus:ring-stone-200 text-sm focus:outline-none" />
        <select value={newTaskCategory} onChange={(e) => setNewTaskCategory(e.target.value)} className="px-4 py-3 rounded-lg bg-stone-50 border-0 focus:ring-2 focus:ring-stone-200 text-sm focus:outline-none">
          <option value="Trabalho">Trabalho</option>
          <option value="Pessoal">Pessoal</option>
          <option value="Saúde">Saúde</option>
        </select>
        <button type="submit" className="px-6 py-3 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded-lg text-sm shadow-sm transition-colors">Criar</button>
      </form>
      <div className="task-board-columns grid grid-cols-1 md:grid-cols-3 gap-6">
        {['a_fazer', 'em_curso', 'concluido'].map((statusKey) => (
          <div key={statusKey} className="task-lane bg-stone-200/60 p-4 rounded-lg space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-stone-600">{statusKey.replace('_', ' ')}</h4>
            {tasks.filter(t => t.status === statusKey && !t.deleted).map(t => {
              const style = getCategoryStyle(t.category);
              return (
                <div key={t.id} className={`task-note group ${statusKey === 'concluido' ? 'task-note-complete' : ''} ${style.bg}`}>
                  <TaskNoteContent
                    task={t}
                    completed={statusKey === 'concluido'}
                    onToggle={() => {
                      const nextStatus = statusKey === 'a_fazer' ? 'em_curso' : statusKey === 'em_curso' ? 'concluido' : 'a_fazer';
                      const updatedTasks = tasks.map(task => task.id === t.id ? { ...task, status: nextStatus } : task);
                      setTasks(updatedTasks);
                      if(syncToFirestore) syncToFirestore('tasks', updatedTasks);
                    }}
                    onDelete={() => {
                      const updatedTasks = tasks.map(task => task.id === t.id ? { ...task, deleted: true } : task);
                      setTasks(updatedTasks);
                      if(syncToFirestore) syncToFirestore('tasks', updatedTasks);
                      toast.success('Tarefa movida para a Lixeira');
                    }}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// 5. VISTA DE HÁBITOS
// ==========================================
function HabitsView({ habits, setHabits, syncToFirestore }) {
  const [newHabitName, setNewHabitName] = React.useState('');
  const [newHabitColor, setNewHabitColor] = React.useState('bg-emerald-100 text-emerald-900');
  const [recurrenceType, setRecurrenceType] = React.useState('todos_dias');
  const [selectedDays, setSelectedDays] = React.useState([]);

  const daysOfWeek = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  const habitColors = [
    { value: 'bg-emerald-100 text-emerald-900', hex: 'bg-emerald-400' },
    { value: 'bg-blue-100 text-blue-900', hex: 'bg-blue-400' },
    { value: 'bg-amber-100 text-amber-900', hex: 'bg-amber-400' },
    { value: 'bg-rose-100 text-rose-900', hex: 'bg-rose-400' },
    { value: 'bg-purple-100 text-purple-900', hex: 'bg-purple-400' },
    { value: 'bg-stone-200 text-stone-900', hex: 'bg-stone-400' }
  ];

  const toggleDay = (day) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleAddHabit = (e) => {
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
    if(syncToFirestore) syncToFirestore('habits', updatedHabits);
    setNewHabitName('');
    setRecurrenceType('todos_dias');
    setSelectedDays([]);
    toast.success('Hábito criado com sucesso!');
  };

  return (
    <div className="space-y-6">
      {/* Form de Criação */}
      <form onSubmit={handleAddHabit} className="bg-white p-6 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-5">
        <h3 className="font-bold text-stone-800 flex items-center space-x-2">
          <Plus className="w-5 h-5 text-emerald-600" />
          <span>Criar Novo Hábito</span>
        </h3>
        
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
          <input type="text" placeholder="Qual hábito queres monitorizar?" value={newHabitName} onChange={(e) => setNewHabitName(e.target.value)} className="flex-1 w-full px-3.5 py-2.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
          
          <div className="flex flex-col space-y-1.5">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Cor:</span>
            <div className="flex gap-2">
              {habitColors.map(c => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setNewHabitColor(c.value)}
                  className={`w-7 h-7 rounded-full ${c.hex} transition-all ${newHabitColor === c.value ? 'ring-2 ring-offset-2 ring-stone-800 scale-110' : 'hover:scale-110'}`}
                />
              ))}
            </div>
          </div>
        </div>
        
        <div className="space-y-3 pt-3 border-t border-stone-100">
          <span className="text-sm font-semibold text-stone-700 block">Dias de Repetição:</span>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center space-x-2 text-sm text-stone-600 cursor-pointer">
              <input type="radio" name="recurrence" checked={recurrenceType === 'todos_dias'} onChange={() => setRecurrenceType('todos_dias')} className="accent-stone-900 w-4 h-4" />
              <span>Todos os dias</span>
            </label>
            <label className="flex items-center space-x-2 text-sm text-stone-600 cursor-pointer">
              <input type="radio" name="recurrence" checked={recurrenceType === 'dias_especificos'} onChange={() => setRecurrenceType('dias_especificos')} className="accent-stone-900 w-4 h-4" />
              <span>Dias específicos</span>
            </label>
            <label className="flex items-center space-x-2 text-sm text-stone-600 cursor-pointer">
              <input type="radio" name="recurrence" checked={recurrenceType === 'uma_vez'} onChange={() => setRecurrenceType('uma_vez')} className="accent-stone-900 w-4 h-4" />
              <span>Apenas uma vez</span>
            </label>
          </div>

          {recurrenceType === 'dias_especificos' && (
            <div className="flex flex-wrap gap-2 pt-2">
              {daysOfWeek.map(day => (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors shadow-xs ${selectedDays.includes(day) ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200 text-stone-500 hover:bg-stone-50'}`}
                >
                  {day}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="pt-2">
          <button type="submit" className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-md text-sm transition-colors shadow-sm">
            Adicionar Hábito
          </button>
        </div>
      </form>

      {/* Grid de Hábitos */}
      <div className="bg-white rounded-lg p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4">
        <h3 className="font-bold text-lg text-stone-800">Meus Hábitos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {habits.filter(h => !h.deleted).map(h => {
            const IconMap = {
              'Dumbbell': Dumbbell,
              'Apple': Apple,
              'Activity': Activity,
              'GraduationCap': GraduationCap
            };
            const Icon = IconMap[h.iconName] || Activity;

            return (
              <div key={h.id} className={`p-5 rounded-2xl flex flex-col justify-between h-32 ${h.color} shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-lg transition-shadow group relative overflow-hidden`}>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-white shadow-sm ${h.iconColor || 'text-stone-800'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <button 
                      className="opacity-0 group-hover:opacity-100 bg-black/10 hover:bg-black/20 text-white p-1.5 rounded-lg transition-all" 
                      onClick={() => {
                        const updatedHabits = habits.map(habit => habit.id === h.id ? { ...habit, deleted: true } : habit);
                        setHabits(updatedHabits);
                        if(syncToFirestore) syncToFirestore('habits', updatedHabits);
                        toast.success('Hábito movido para a Lixeira');
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h4 className="font-bold text-white leading-tight line-clamp-1 text-base">{h.name}</h4>
                </div>
                <div className="mt-auto pt-2 flex items-center space-x-1.5 border-t border-white/20 relative z-10">
                  <RotateCcw className="w-3.5 h-3.5 text-white/60" />
                  <span className="text-xs font-semibold text-white/80 truncate">{h.recurrence}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 6. VISTA DE BLOCO DE NOTAS
// ==========================================
function NotesView({ notes, setNotes, syncToFirestore }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {notes.filter(n => !n.deleted).map(n => {
        const style = getCategoryStyle(n.category);
        return (
          <div key={n.id} className={`p-5 rounded-md ${style.bg} space-y-2 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-lg transition-shadow group`}>
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-stone-800">{n.category}</span>
              <button 
                onClick={() => {
                  const updatedNotes = notes.map(note => note.id === n.id ? { ...note, deleted: true } : note);
                  setNotes(updatedNotes);
                  if(syncToFirestore) syncToFirestore('notes', updatedNotes);
                  toast.success('Nota movida para a Lixeira');
                }}
                className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-rose-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <h4 className="font-bold text-stone-900">{n.title}</h4>
            <p className="text-sm text-stone-800 leading-relaxed font-normal">{n.content}</p>
          </div>
        );
      })}
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
          <div className="bg-white p-4 rounded-xl shadow-xl flex flex-col space-y-3 ring-1 ring-stone-200 pointer-events-auto">
            <p className="text-sm font-bold text-stone-800">Deseja marcar a tarefa focada como concluída?</p>
            <div className="flex space-x-2">
              <button 
                onClick={() => {
                  const updatedTasks = tasks.map(task => task.id === selectedTaskId ? { ...task, status: 'concluido' } : task);
                  setTasks(updatedTasks);
                  if(syncToFirestore) syncToFirestore('tasks', updatedTasks);
                  toast.dismiss(t);
                  setSelectedTaskId('');
                }}
                className="flex-1 bg-emerald-500 text-white text-xs font-bold py-2 rounded shadow-sm"
              >Sim</button>
              <button onClick={() => toast.dismiss(t)} className="flex-1 bg-stone-200 text-stone-700 text-xs font-bold py-2 rounded">Não</button>
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
    <div className="max-w-xl mx-auto bg-white p-8 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-8">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold text-stone-900 flex items-center justify-center space-x-2 mb-2">
          <span>Temporizador de Foco</span>
        </h3>
        <p className="text-sm text-stone-500">Mantenha o foco e aumente sua produtividade</p>
      </div>

      <div className="space-y-3 text-left">
        <label className="block text-sm font-bold text-stone-700">Focar na Tarefa (opcional):</label>
        <select 
          value={selectedTaskId} 
          onChange={(e) => setSelectedTaskId(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border-0 shadow-[0_2px_10px_rgb(0,0,0,0.04)] text-sm focus:outline-none focus:ring-2 focus:ring-stone-200 bg-white text-stone-700"
          disabled={isActive}
        >
          <option value="">Selecione uma tarefa em andamento...</option>
          {activeTasks.map(t => (
            <option key={t.id} value={t.id}>{t.title} ({t.status === 'em_curso' ? 'Em Curso' : 'A Fazer'})</option>
          ))}
        </select>
      </div>

      <div className="py-12 bg-stone-50 rounded-2xl flex flex-col items-center justify-center shadow-inner border border-stone-100 relative overflow-hidden">
        {isActive && <div className="absolute top-0 left-0 h-1 bg-rose-500 transition-all duration-1000 ease-linear" style={{ width: `${(1 - (timeLeft / (25 * 60))) * 100}%` }}></div>}
        <div className="font-mono text-7xl font-black text-stone-800 tracking-tight">
          {formatTime(timeLeft)}
        </div>
      </div>

      <div className="flex justify-center space-x-4">
        <button 
          onClick={() => setIsActive(!isActive)} 
          className={`w-32 py-3 rounded-lg font-bold text-white transition-colors shadow-sm ${isActive ? 'bg-amber-500 hover:bg-amber-600' : 'bg-rose-500 hover:bg-rose-600'}`}
        >
          {isActive ? 'Pausar' : 'Iniciar'}
        </button>
        <button 
          onClick={() => { setIsActive(false); setTimeLeft(25 * 60); }} 
          className="w-32 py-3 bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold rounded-lg transition-colors"
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

  const handleRestore = (collection, setCollection, id, stateName) => {
    const updated = collection.map(item => item.id === id ? { ...item, deleted: false } : item);
    setCollection(updated);
    if(syncToFirestore) syncToFirestore(stateName, updated);
    toast.success('Item restaurado com sucesso!');
  };

  const handlePermanentDelete = (collection, setCollection, id, stateName) => {
    const updated = collection.filter(item => item.id !== id);
    setCollection(updated);
    if(syncToFirestore) syncToFirestore(stateName, updated);
    toast.error('Item excluído permanentemente');
  };

  const isEmpty = deletedTasks.length === 0 && deletedHabits.length === 0 && deletedEvents.length === 0 && deletedNotes.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 text-stone-800">
        <Trash2 className="w-6 h-6 text-rose-500" />
        <h2 className="text-2xl font-black">Lixeira</h2>
      </div>
      
      {isEmpty ? (
        <div className="bg-white p-12 rounded-2xl text-center shadow-sm border border-stone-100">
          <Trash2 className="w-12 h-12 text-stone-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-stone-800">Lixeira Vazia</h3>
          <p className="text-stone-500">Tudo limpo por aqui.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Tarefas Deletadas */}
          {deletedTasks.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider">Tarefas Excluídas</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {deletedTasks.map(t => (
                  <div key={t.id} className="bg-white p-4 rounded-lg shadow-sm border border-rose-100 flex justify-between items-start opacity-75">
                    <div>
                      <p className="font-semibold text-stone-800 line-through decoration-rose-300">{t.title}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button onClick={() => handleRestore(tasks, setTasks, t.id, 'tasks')} className="p-1.5 text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100"><RotateCcw className="w-4 h-4" /></button>
                      <button onClick={() => handlePermanentDelete(tasks, setTasks, t.id, 'tasks')} className="p-1.5 text-rose-600 bg-rose-50 rounded hover:bg-rose-100"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hábitos Deletados */}
          {deletedHabits.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider">Hábitos Excluídos</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {deletedHabits.map(h => (
                  <div key={h.id} className="bg-white p-4 rounded-lg shadow-sm border border-rose-100 flex justify-between items-start opacity-75">
                    <p className="font-semibold text-stone-800 line-through decoration-rose-300">{h.name}</p>
                    <div className="flex space-x-2">
                      <button onClick={() => handleRestore(habits, setHabits, h.id, 'habits')} className="p-1.5 text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100"><RotateCcw className="w-4 h-4" /></button>
                      <button onClick={() => handlePermanentDelete(habits, setHabits, h.id, 'habits')} className="p-1.5 text-rose-600 bg-rose-50 rounded hover:bg-rose-100"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Eventos Deletados */}
          {deletedEvents.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider">Eventos Excluídos</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {deletedEvents.map(e => (
                  <div key={e.id} className="bg-white p-4 rounded-lg shadow-sm border border-rose-100 flex justify-between items-start opacity-75">
                    <div>
                      <p className="font-semibold text-stone-800 line-through decoration-rose-300">{e.title}</p>
                      <span className="text-xs text-stone-500">{e.date}</span>
                    </div>
                    <div className="flex space-x-2">
                      <button onClick={() => handleRestore(events, setEvents, e.id, 'events')} className="p-1.5 text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100"><RotateCcw className="w-4 h-4" /></button>
                      <button onClick={() => handlePermanentDelete(events, setEvents, e.id, 'events')} className="p-1.5 text-rose-600 bg-rose-50 rounded hover:bg-rose-100"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notas Deletadas */}
          {deletedNotes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider">Notas Excluídas</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {deletedNotes.map(n => (
                  <div key={n.id} className="bg-white p-4 rounded-lg shadow-sm border border-rose-100 flex justify-between items-start opacity-75">
                    <div>
                      <p className="font-semibold text-stone-800 line-through decoration-rose-300">{n.title}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button onClick={() => handleRestore(notes, setNotes, n.id, 'notes')} className="p-1.5 text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100"><RotateCcw className="w-4 h-4" /></button>
                      <button onClick={() => handlePermanentDelete(notes, setNotes, n.id, 'notes')} className="p-1.5 text-rose-600 bg-rose-50 rounded hover:bg-rose-100"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 8. CHAT VIEW
// ==========================================
function ChatView({ currentUser }) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatsList, setChatsList] = useState([]);
  const [isStartingNew, setIsStartingNew] = useState(false);
  const messagesEndRef = React.useRef(null);

  // Fetch list of chats
  useEffect(() => {
    if (!currentUser || !currentUser.email) return;
    const q = query(
      collection(db, 'chats'), 
      where('participants', 'array-contains', currentUser.email),
      orderBy('updatedAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChatsList(fetchedChats);
    });
    
    return () => unsubscribe();
  }, [currentUser]);

  const startChat = (e) => {
    e.preventDefault();
    if (!recipientEmail.trim() || !currentUser || !currentUser.email) return;
    
    const emails = [currentUser.email.toLowerCase().trim(), recipientEmail.toLowerCase().trim()].sort();
    const chatId = emails.join('_');
    setActiveChatId(chatId);
    setRecipientEmail('');
    setIsStartingNew(false);
  };

  useEffect(() => {
    if (!activeChatId) return;

    const messagesRef = collection(db, 'chats', activeChatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [activeChatId]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatId) return;

    const messagesRef = collection(db, 'chats', activeChatId, 'messages');
    const chatDocRef = doc(db, 'chats', activeChatId);
    
    try {
      // 1. Send the actual message
      await addDoc(messagesRef, {
        text: newMessage,
        sender: currentUser.email,
        createdAt: serverTimestamp()
      });
      
      // 2. Update or create the parent document so it appears in the chat list
      const emails = activeChatId.split('_');
      await setDoc(chatDocRef, {
        participants: emails,
        lastMessage: newMessage,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setNewMessage('');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  // Determine the name of the person we are talking to for the active chat header
  const getRecipientFromChatId = (chatId) => {
    if (!chatId || !currentUser || !currentUser.email) return '';
    return chatId.split('_').find(e => e !== currentUser.email) || currentUser.email;
  };

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-[600px] flex flex-col overflow-hidden border border-stone-100">
      {!activeChatId ? (
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50">
            <h3 className="font-bold text-stone-800">Mensagens</h3>
            <button 
              onClick={() => setIsStartingNew(!isStartingNew)}
              className="text-stone-500 hover:text-stone-900 transition-colors p-2 rounded-md hover:bg-stone-200"
            >
              {isStartingNew ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>
          </div>
          
          {isStartingNew && (
            <div className="p-4 border-b border-stone-100 bg-white">
              <form onSubmit={startChat} className="flex space-x-2">
                <input 
                  type="email" 
                  placeholder="E-mail da pessoa..." 
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="flex-1 px-4 py-2 bg-stone-50 border-0 rounded-lg focus:ring-2 focus:ring-stone-200 text-sm focus:outline-none"
                  required
                />
                <button type="submit" className="px-4 py-2 bg-stone-900 text-white font-bold rounded-lg hover:bg-stone-800 transition-colors text-sm">
                  Iniciar
                </button>
              </form>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {chatsList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 space-y-4 text-center">
                <MessageCircle className="w-12 h-12 text-stone-300" />
                <p className="text-stone-500 text-sm">Você ainda não tem conversas ativas.</p>
                <button 
                  onClick={() => setIsStartingNew(true)}
                  className="text-sm font-bold text-stone-800 hover:underline"
                >
                  Iniciar uma nova conversa
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {chatsList.map(chat => {
                  const partnerEmail = chat.participants.find(e => e !== currentUser.email) || currentUser.email;
                  return (
                    <li key={chat.id}>
                      <button 
                        onClick={() => setActiveChatId(chat.id)}
                        className="w-full flex items-center p-4 hover:bg-stone-50 transition-colors text-left"
                      >
                        <div className="w-12 h-12 rounded-full bg-stone-200 flex items-center justify-center text-stone-600 font-bold uppercase shrink-0">
                          {partnerEmail.charAt(0)}
                        </div>
                        <div className="ml-4 flex-1 overflow-hidden">
                          <p className="font-bold text-stone-800 truncate">{partnerEmail}</p>
                          <p className="text-sm text-stone-500 truncate">{chat.lastMessage || 'Nenhuma mensagem'}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50">
            <div className="flex items-center space-x-3">
              <button onClick={() => { setActiveChatId(null); setMessages([]); }} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-200 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3 ml-2">
                <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-stone-600 font-bold uppercase">
                  {getRecipientFromChatId(activeChatId).charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-stone-800 text-sm">{getRecipientFromChatId(activeChatId)}</p>
                  <p className="text-xs text-stone-400 font-medium tracking-wider">MENSAGEM PRIVADA</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF9F6]">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-stone-400 text-sm font-medium">
                Nenhuma mensagem ainda. Dê um oi! 👋
              </div>
            ) : (
              messages.map(msg => {
                const isMine = msg.sender === currentUser.email;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 text-sm ${isMine ? 'bg-stone-900 text-white rounded-2xl rounded-tr-sm shadow-sm' : 'bg-white text-stone-800 border border-stone-100 rounded-2xl rounded-tl-sm shadow-sm'}`}>
                      <p>{msg.text}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-4 bg-white border-t border-stone-100 flex items-center space-x-2">
            <input 
              type="text" 
              placeholder="Sua mensagem..." 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 px-4 py-3 bg-stone-50 border-0 rounded-full focus:ring-2 focus:ring-stone-200 text-sm focus:outline-none"
            />
            <button type="submit" className="p-3 bg-stone-900 text-white rounded-full hover:bg-stone-800 transition-colors shadow-sm" disabled={!newMessage.trim()}>
              <Send className="w-5 h-5" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
