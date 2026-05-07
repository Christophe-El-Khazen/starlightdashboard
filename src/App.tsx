import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  MapPin, 
  Calendar, 
  BarChart3, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Phone, 
  UserPlus, 
  ChevronRight, 
  Search,
  Menu,
  X,
  TrendingUp,
  Ticket,
  Music,
  ArrowRight,
  Lock,
  Unlock,
  RefreshCcw,
  ExternalLink,
  Globe,
  LogOut,
  Mail,
  Key,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy,
  getDocFromServer
} from 'firebase/firestore';
import { 
  auth, 
  db, 
  loginWithGoogle, 
  logout, 
  OperationType, 
  handleFirestoreError,
  loginWithEmail,
  registerWithEmail 
} from './lib/firebase';

// --- Types ---

interface Venue {
  id: string;
  name: string;
  address: string;
  capacity: number;
}

interface StaffMember {
  id: string;
  firstName: string;
  defaultRole: string;
  phone: string;
}

interface Artist {
  id: string;
  name: string;
  type: 'DJ Pro' | 'DJ Stg' | 'Live act' | 'Guest';
  slot: string;
  lateMinutes: number;
}

interface TimelinePhase {
  id: string;
  label: string;
  time: string;
  actualTime?: string;
  status: 'pending' | 'in-progress' | 'completed';
}

interface TicketTier {
  id: string;
  label: string;
  price: number;
  sold: number;
}

interface PromoCode {
  id: string;
  code: string;
  discount: number;
  type: 'fixed' | 'percentage';
  uses: number;
}

interface EventStaff {
  id: string;
  staffId: string; // reference to global staff
  firstName: string;
  role: string;
  phone: string;
  status: 'Absent' | 'Present';
  lateMinutes: number;
  callTime: string;
}

interface Event {
  id: string;
  customId?: string;
  title: string;
  date: string;
  venueId: string;
  maxCapacity: number;
  ticketsSold: number; // Local tickets
  shotgunTickets: number; // Shotgun integration
  ticketPrice: number; // Default/Local base price
  ticketTiers: TicketTier[];
  promoCodes: PromoCode[];
  lineup: Artist[];
  staff: EventStaff[];
  timeline: TimelinePhase[];
}

type View = 'dashboard' | 'events' | 'clubs' | 'team' | 'manager' | 'shotgun';

// --- Persistent Storage Logic ---

const STORAGE_KEYS = {
  VENUES: 'em_venues',
  STAFF: 'em_staff',
  EVENTS: 'em_events'
};

// --- Sub-components (Moved outside to prevent re-renders resetting state) ---

const Sidebar = ({ currentView, setCurrentView, isMobileMenuOpen, setIsMobileMenuOpen }: any) => {
  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
    { id: 'events', label: 'Événements', icon: Calendar },
    { id: 'shotgun', label: 'Shotgun Live', icon: Globe },
    { id: 'clubs', label: 'Lieux / Clubs', icon: MapPin },
    { id: 'team', label: 'Équipe / Staff', icon: Users },
  ];

  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-[220px] bg-sidebar-bg border-r border-[#1F2937] transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex flex-col h-full">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-8 h-12">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center shadow-lg shadow-brand-primary/20 text-xl">
              🪩
            </div>
            <div className="flex flex-col">
              <span className="text-white text-[10px] font-black tracking-tighter leading-none opacity-50 uppercase">STARLIGHT</span>
              <span className="text-brand-primary text-[11px] font-bold tracking-widest leading-none uppercase">SOCIETY</span>
            </div>
          </div>
          
          <nav className="space-y-2">
            <div className="text-brand-secondary text-[11px] font-bold uppercase tracking-widest mb-4 px-2 opacity-80">Navigation</div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentView(item.id as View);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-[14px] ${
                    isActive 
                      ? 'bg-[#1F2937] text-white shadow-sm' 
                      : 'text-muted-text hover:text-slate-100 hover:bg-slate-800/30'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-primary' : ''}`} />
                  <span className="font-semibold">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        
        <div className="p-5 mt-auto border-t border-[#1F2937]">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-[12px] text-muted-text">Système synchronisé</p>
              <p className="text-[11px] font-bold text-brand-primary uppercase tracking-widest">Temps Réel Cloud</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardView = ({ stats, venues, events, setSelectedEventId, setCurrentView }: any) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <header>
      <h2 className="text-2xl font-bold text-[#E5E7EB] mb-1 uppercase tracking-tight">Tableau de bord</h2>
      <p className="text-muted-text text-sm">Suivi des indicateurs clés de performance.</p>
    </header>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[
        { label: 'Évéments', value: stats.totalEvents, sub: 'Total créés' },
        { label: 'Vendus', value: stats.totalBillets, sub: 'Billets émis' },
        { label: 'Recettes', value: `${stats.totalRecettes}€`, sub: 'Chiffre d\'affaires' },
        { label: 'Lieux', value: venues.length, sub: 'Répertoire clubs' },
      ].map((stat, i) => (
        <div key={i} className="card-neon flex flex-col justify-between h-28">
          <p className="text-muted-text text-[11px] font-bold uppercase tracking-wider">{stat.label}</p>
          <div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-[10px] text-slate-500 font-medium">↑ {stat.sub}</p>
          </div>
        </div>
      ))}
    </div>

    <div className="card-neon p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-brand-secondary uppercase tracking-widest">Prochains Événements</h3>
        <button onClick={() => setCurrentView('events')} className="text-xs text-muted-text font-semibold hover:text-brand-primary transition-colors flex items-center gap-1">
          Voir tout <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      
      {events.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-slate-500 text-sm italic">Aucun événement planifié.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.slice(0, 3).map((event: any) => {
            const venue = venues.find((v: any) => v.id === event.venueId);
            return (
              <div key={event.id} className="flex items-center justify-between p-3 rounded-lg bg-dark-bg/50 border border-card-border hover:border-brand-primary/30 transition-all cursor-pointer group" onClick={() => { setSelectedEventId(event.id); setCurrentView('manager'); }}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-card-bg border border-card-border rounded flex items-center justify-center text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-100 text-sm">{event.title}</h4>
                    <p className="text-xs text-muted-text">{event.date} • {venue?.name || 'Lieu inconnu'}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
);

const ClubsView = ({ venues, addVenue, deleteVenue }: any) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [capacity, setCapacity] = useState(100);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address) return;
    addVenue({ name, address, capacity });
    setName(''); setAddress(''); setCapacity(100);
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Répertoire des Lieux</h2>
        <p className="text-muted-text text-sm">Gérez vos clubs et salles partenaires.</p>
      </header>

      <form onSubmit={handleSubmit} className="card-neon grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-muted-text uppercase tracking-wider">Nom du Lieu</label>
          <input 
            value={name} onChange={e => setName(e.target.value)}
            className="w-full bg-dark-bg border border-card-border rounded px-3 py-2 text-xs focus:border-brand-primary focus:outline-none text-white transition-colors" 
            placeholder="ex: Le Rex Club"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-[11px] font-bold text-muted-text uppercase tracking-wider">Adresse</label>
          <input 
            value={address} onChange={e => setAddress(e.target.value)}
            className="w-full bg-dark-bg border border-card-border rounded px-3 py-2 text-xs focus:border-brand-primary focus:outline-none text-white transition-colors" 
            placeholder="ex: 5 Bvd Poissonnière, Paris"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-muted-text uppercase tracking-wider">Jauge</label>
          <div className="flex gap-2">
            <input 
              type="number" value={capacity} onChange={e => setCapacity(parseInt(e.target.value))}
              className="w-full bg-dark-bg border border-card-border rounded px-3 py-2 text-xs focus:border-brand-primary focus:outline-none text-white transition-colors" 
            />
            <button type="submit" className="btn-neon px-4">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {venues.map((v: any) => (
          <div key={v.id} className="card-neon hover:border-brand-secondary/40 transition-all flex justify-between items-start">
            <div>
              <h4 className="text-lg font-bold text-white mb-2">{v.name}</h4>
              <div className="flex items-center gap-2 text-muted-text text-xs mb-1">
                <MapPin className="w-3 h-3 text-brand-primary" />
                <span className="truncate max-w-[150px]">{v.address}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-text text-xs">
                <Users className="w-3 h-3" />
                <span>Capacité: {v.capacity} pax</span>
              </div>
            </div>
            <button onClick={() => deleteVenue(v.id)} className="text-slate-600 hover:text-red-500 p-1">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const TeamView = ({ globalStaff, addStaff, deleteStaff }: any) => {
  const [firstName, setFirstName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !role || !phone) return;
    addStaff({ firstName, defaultRole: role, phone });
    setFirstName(''); setRole(''); setPhone('');
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Équipe & Staff</h2>
        <p className="text-muted-text text-sm">Gérez les membres permanents du staff.</p>
      </header>

      <form onSubmit={handleSubmit} className="card-neon grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-muted-text uppercase tracking-wider">Prénom</label>
          <input 
            value={firstName} onChange={e => setFirstName(e.target.value)}
            className="w-full bg-dark-bg border border-card-border rounded px-3 py-2 text-xs focus:border-brand-primary focus:outline-none text-white transition-colors" 
            placeholder="Prénom"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-muted-text uppercase tracking-wider">Rôle par défaut</label>
          <input 
            value={role} onChange={e => setRole(e.target.value)}
            className="w-full bg-dark-bg border border-card-border rounded px-3 py-2 text-xs focus:border-brand-primary focus:outline-none text-white transition-colors" 
            placeholder="ex: Accueil, Bar..."
          />
        </div>
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-muted-text uppercase tracking-wider">Téléphone</label>
          <div className="flex gap-2">
            <input 
              value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full bg-dark-bg border border-card-border rounded px-3 py-2 text-xs focus:border-brand-primary focus:outline-none text-white transition-colors" 
              placeholder="06..."
            />
            <button type="submit" className="btn-neon px-4">
              <UserPlus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>

      <div className="card-neon p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#1E2129] border-b border-card-border">
            <tr>
              <th className="text-left py-3 px-4 text-xs font-bold text-muted-text uppercase">Prénom</th>
              <th className="text-left py-3 px-4 text-xs font-bold text-muted-text uppercase">Rôle</th>
              <th className="text-left py-3 px-4 text-xs font-bold text-muted-text uppercase">Téléphone</th>
              <th className="text-right py-3 px-4 text-xs font-bold text-muted-text uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border">
            {globalStaff.map((s: any) => (
              <tr key={s.id} className="hover:bg-white/5">
                <td className="py-3 px-4 font-bold text-white">{s.firstName}</td>
                <td className="py-3 px-4">
                  <span className="status-pill-neon bg-[#374151] text-muted-text">{s.defaultRole}</span>
                </td>
                <td className="py-3 px-4 text-muted-text font-mono text-xs">{s.phone}</td>
                <td className="py-3 px-4 text-right">
                  <button onClick={() => deleteStaff(s.id)} className="text-slate-600 hover:text-red-500 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const EventsView = ({ venues, events, createEvent, deleteEvent, setSelectedEventId, setCurrentView, syncShotgunEvents, isSyncing }: any) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [venueId, setVenueId] = useState('');
  const [price, setPrice] = useState(15);
  const [customId, setCustomId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !venueId) return;
    createEvent(title, date, venueId, price, customId);
    setTitle(''); setDate(''); setVenueId(''); setPrice(15); setCustomId('');
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Événements</h2>
          <p className="text-muted-text text-sm">Planification et création de nouvelles soirées.</p>
        </div>
        <button 
          onClick={syncShotgunEvents}
          disabled={isSyncing}
          className="flex items-center gap-2 bg-dark-bg border border-brand-primary/30 text-brand-primary px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-brand-primary/10 transition-all hover:scale-105 disabled:opacity-50"
        >
          <RefreshCcw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Synchronisation...' : 'Importer Shotgun'}
        </button>
      </header>

      <form onSubmit={handleSubmit} className="card-neon space-y-6 border-t-2 border-t-brand-primary">
        <h3 className="text-xs font-bold text-brand-primary uppercase tracking-widest">Nouveau Projet Événement</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-muted-text uppercase tracking-wider">Nom de la soirée</label>
            <input 
              value={title} onChange={e => setTitle(e.target.value)}
              className="w-full bg-dark-bg border border-card-border rounded px-3 py-2 text-xs focus:border-brand-primary focus:outline-none text-white transition-colors" 
              placeholder="ex: Techno All Night Vol. 1"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-muted-text uppercase tracking-wider">ID Personnalisé (Optionnel)</label>
            <input 
              value={customId} onChange={e => setCustomId(e.target.value)}
              className="w-full bg-dark-bg border border-card-border rounded px-3 py-2 text-xs focus:border-brand-primary focus:outline-none text-white transition-colors font-mono" 
              placeholder="ex: TECHNO-001"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-muted-text uppercase tracking-wider">Date</label>
            <input 
              type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full bg-dark-bg border border-card-border rounded px-3 py-2 text-xs focus:border-brand-primary focus:outline-none text-white transition-colors" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-muted-text uppercase tracking-wider">Lieu</label>
            <select 
              value={venueId} onChange={e => setVenueId(e.target.value)}
              className="w-full bg-dark-bg border border-card-border rounded px-3 py-2 text-xs focus:border-brand-primary focus:outline-none text-white transition-colors"
            >
              <option value="">Choisir un lieu...</option>
              {venues.map((v: any) => <option key={v.id} value={v.id}>{v.name} ({v.capacity} pax)</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-muted-text uppercase tracking-wider">Prix Billet Base (€)</label>
            <input 
              type="number" value={price} onChange={e => setPrice(parseInt(e.target.value))}
              className="w-full bg-dark-bg border border-card-border rounded px-3 py-2 text-xs focus:border-brand-primary focus:outline-none text-white transition-colors" 
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-neon w-full py-2 bg-brand-primary hover:bg-brand-primary/90">
              CRÉER L'ÉVÉNEMENT
            </button>
          </div>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {events.map((event: any) => {
          const venue = venues.find((v: any) => v.id === event.venueId);
          return (
            <div key={event.id} className="card-neon group hover:border-brand-secondary/30 transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="status-pill-neon bg-brand-primary/10 text-brand-primary mb-2">
                      {event.date}
                    </span>
                    <h4 className="text-lg font-bold text-white uppercase tracking-tight">{event.title}</h4>
                    <p className="text-muted-text flex items-center gap-1 mt-1 text-xs">
                      <MapPin className="w-3 h-3 text-brand-primary" /> {venue?.name || 'Inconnu'}
                    </p>
                  </div>
                  <button onClick={() => deleteEvent(event.id)} className="text-slate-600 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4 py-4 border-y border-card-border my-4">
                  <div>
                    <p className="text-[10px] text-muted-text uppercase font-bold tracking-widest">Billetterie</p>
                    <p className="text-lg font-bold text-white">{event.ticketsSold} <span className="text-xs font-normal text-slate-500">/ {event.maxCapacity}</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-text uppercase font-bold tracking-widest">Gains</p>
                    <p className="text-lg font-bold text-emerald-500">{event.ticketsSold * event.ticketPrice} €</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => { setSelectedEventId(event.id); setCurrentView('manager'); }}
                className="btn-neon w-full py-3 flex items-center justify-center gap-2"
              >
                GÉRER L'ÉVÉNEMENT <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const EventManagerView = ({ activeEvent, updateEvent, venues, globalStaff }: any) => {
  const [activeTab, setActiveTab] = useState<'infos' | 'timeline' | 'lineup' | 'staff'>('infos');
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
  
  // Timer for real-time tracking
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    }, 30000); // Check every 30s
    return () => clearInterval(timer);
  }, []);

  // Artist states
  const [artistName, setArtistName] = useState('');
  const [artistType, setArtistType] = useState<Artist['type']>('DJ Pro');
  const [artistSlot, setArtistSlot] = useState('');
  
  // Timeline editor states
  const [phaseLabel, setPhaseLabel] = useState('');
  const [phaseTime, setPhaseTime] = useState('');
  const [isLocked, setIsLocked] = useState(true);

  if (!activeEvent) return <div className="text-center py-20 text-slate-500">Sélectionnez un événement pour le gérer.</div>;

  const addArtist = () => {
    if (!artistName || !artistSlot) return;
    const newArtist: Artist = { 
      id: crypto.randomUUID(), 
      name: artistName, 
      type: artistType, 
      slot: artistSlot,
      lateMinutes: 0
    };
    updateEvent({ ...activeEvent, lineup: [...activeEvent.lineup, newArtist] });
    setArtistName(''); setArtistSlot('');
  };

  const updateArtistLate = (id: string, mins: number) => {
    const newLineup = activeEvent.lineup.map((a: any) => a.id === id ? { ...a, lateMinutes: mins } : a);
    updateEvent({ ...activeEvent, lineup: newLineup });
  };

  const addTimelinePhase = () => {
    if (!phaseLabel || !phaseTime) return;
    const newPhase: TimelinePhase = {
      id: crypto.randomUUID(),
      label: phaseLabel,
      time: phaseTime,
      status: 'pending'
    };
    updateEvent({ ...activeEvent, timeline: [...(activeEvent.timeline || []), newPhase] });
    setPhaseLabel(''); setPhaseTime('');
  };

  const removeTimelinePhase = (id: string) => {
    const newTimeline = (activeEvent.timeline || []).filter((p: any) => p.id !== id);
    updateEvent({ ...activeEvent, timeline: newTimeline });
  };

  const updateTimelinePhase = (id: string, updates: Partial<TimelinePhase>) => {
    const newTimeline = (activeEvent.timeline || []).map((p: any) => p.id === id ? { ...p, ...updates } : p);
    updateEvent({ ...activeEvent, timeline: newTimeline });
  };

  const addMinutesToTime = (timeStr: string, minsToAdd: number) => {
    if (!timeStr || minsToAdd === 0) return timeStr;
    
    // Handle ranges like "01:00 - 03:00"
    const parts = timeStr.split('-').map(p => p.trim());
    const shiftedParts = parts.map(part => {
      const [h, m] = part.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return part;
      
      let totalMins = h * 60 + m + minsToAdd;
      // Handle wrap around
      totalMins = totalMins % (24 * 60);
      if (totalMins < 0) totalMins += (24 * 60);
      
      const newH = Math.floor(totalMins / 60);
      const newM = totalMins % 60;
      return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
    });
    
    return shiftedParts.join(' - ');
  };

  const getDelayFromCompleted = (planned: string, actual?: string) => {
    if (!planned || !actual) return 0;
    const [ph, pm] = planned.split(':').map(Number);
    const [ah, am] = actual.split(':').map(Number);
    if (isNaN(ph) || isNaN(ah)) return 0;
    
    // Handle cross-day (e.g. planned 23:00, actual 01:00)
    let pTotal = ph * 60 + pm;
    let aTotal = ah * 60 + am;
    
    if (aTotal < pTotal && pTotal - aTotal > 12 * 60) {
      aTotal += 24 * 60;
    } else if (pTotal < aTotal && aTotal - pTotal > 12 * 60) {
      pTotal += 24 * 60;
    }
    
    return aTotal - pTotal;
  };

  // Combined Timeline Logic (Phases + Lineup)
  const combinedTimeline = useMemo(() => {
    const rawItems: any[] = [
      ...(activeEvent.timeline || []).map((p: any) => ({ ...p, type: 'phase' as const })),
    ];

    // Split each artist into a START and END event
    activeEvent.lineup.forEach((a: any) => {
      const times = a.slot.split('-').map((t: string) => t.trim());
      const startTime = times[0] || '00:00';
      const endTime = times[1] || startTime;

      // Start Event
      rawItems.push({
        id: `${a.id}-start`,
        originalArtistId: a.id,
        label: `START SET: ${a.name}`,
        time: startTime,
        type: 'artist-start' as const,
        status: 'pending' as any,
        lateMinutes: a.lateMinutes,
        artistType: a.type
      });

      // End Event
      rawItems.push({
        id: `${a.id}-end`,
        originalArtistId: a.id,
        label: `END SET: ${a.name}`,
        time: endTime,
        type: 'artist-end' as const,
        status: 'pending' as any,
        lateMinutes: a.lateMinutes, // End also shifts by same delay
        artistType: a.type
      });
    });

    const sortedItems = rawItems.sort((a, b) => {
      const timeA = a.time.split(' ')[0].replace('h', ':');
      const timeB = b.time.split(' ')[0].replace('h', ':');
      return timeA.localeCompare(timeB);
    });

    let currentAccumulatedDelay = 0;
    return sortedItems.map(item => {
      // Intrinsic delay of the current item (e.g. artist late) shifts its own start time
      const itemIntrinsicDelay = item.type === 'artist-start' || item.type === 'artist-end' ? (item.lateMinutes || 0) : 0;
      const projected = addMinutesToTime(item.time, currentAccumulatedDelay + itemIntrinsicDelay);
      
      // Update accumulated delay for FUTURE items
      if (item.status === 'completed' && item.type === 'phase') {
        currentAccumulatedDelay += getDelayFromCompleted(item.time, item.actualTime);
      } else if (item.type === 'artist-start' && itemIntrinsicDelay > 0) {
        // We only add the artist's late delay to the general flow when they START
        // Actually, maybe we should also consider if they end even later... 
        // For now, lateMinutes at start impacts everything following.
        currentAccumulatedDelay += itemIntrinsicDelay;
      }

      return {
        ...item,
        projectedTime: projected,
        accumulatedDelay: currentAccumulatedDelay
      };
    });
  }, [activeEvent.timeline, activeEvent.lineup]);

  const importStaff = () => {
    const currentStaffIds = activeEvent.staff.map((s: any) => s.staffId);
    const newEventStaff: EventStaff[] = globalStaff
      .filter((gs: any) => !currentStaffIds.includes(gs.id))
      .map((gs: any) => ({
        id: crypto.randomUUID(),
        staffId: gs.id,
        firstName: gs.firstName,
        role: gs.defaultRole,
        phone: gs.phone,
        status: 'Absent',
        lateMinutes: 0,
        callTime: '21:00'
      }));
    updateEvent({ ...activeEvent, staff: [...activeEvent.staff, ...newEventStaff] });
  };

  const markAllStaffPresent = () => {
    const newStaff = activeEvent.staff.map((s: any) => ({ ...s, status: 'Present' as const }));
    updateEvent({ ...activeEvent, staff: newStaff });
  };

  const toggleStaffStatus = (id: string) => {
    const newStaff = activeEvent.staff.map((s: any) => 
      s.id === id ? { ...s, status: s.status === 'Absent' ? 'Present' : 'Absent' as const } : s
    );
    updateEvent({ ...activeEvent, staff: newStaff });
  };

  const totalLineupLates = activeEvent.lineup.reduce((acc: any, a: any) => acc + a.lateMinutes, 0);
  const totalLates = totalLineupLates;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-brand-primary/20 to-brand-secondary/20 flex items-center justify-center text-3xl border-2 border-brand-primary/20 shadow-lg shadow-brand-primary/10">
            🪩
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white uppercase tracking-tight">{activeEvent.title}</h1>
            <div className="flex items-center gap-3 text-muted-text text-sm">
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded border border-white/10 font-mono text-brand-primary">
                <Clock className="w-3.5 h-3.5" />
                <span>{currentTime}</span>
              </div>
              <span>•</span>
              <span>{venues.find((v: any) => v.id === activeEvent.venueId)?.name}</span>
              <span>•</span>
              <span className={`${isLiveMode ? 'text-brand-secondary' : 'text-brand-accent'} font-bold`}>
                {isLiveMode ? 'MODE LIVE' : 'MODE RÉGLAGES'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsLiveMode(!isLiveMode)}
            className={`btn-neon px-4 py-2 flex items-center gap-2 ${!isLiveMode ? 'bg-brand-secondary' : 'bg-brand-primary'}`}
          >
            {isLiveMode ? <Calendar className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
            {isLiveMode ? 'ACTIVER RÉGLAGES' : 'ACTIVER LIVE'}
          </button>
          <div className="text-right">
            <div className="text-[11px] text-muted-text uppercase font-bold tracking-wider">Retard Total (Actifs)</div>
            <div className={`text-lg font-extrabold leading-none ${totalLates > 0 ? 'text-brand-accent' : 'text-emerald-500'}`}>
              {totalLates > 0 ? `+ ${totalLates} min ⚠️` : 'Aucun retard'}
            </div>
          </div>
        </div>
      </header>

      {/* Tab Selection */}
      <div className="flex gap-2 p-1 bg-card-bg/50 backdrop-blur-sm rounded-lg w-fit border border-card-border overflow-x-auto max-w-full">
        {[
          { id: 'infos', label: 'Ticket Manager' },
          { id: 'timeline', label: 'Planning / Phases' },
          { id: 'lineup', label: 'Line-up / Slots' },
          { id: 'staff', label: 'Pointage Staff' },
        ].map((tab: any) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`whitespace-nowrap px-4 py-2 rounded text-xs font-bold transition-all ${
              activeTab === tab.id ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-muted-text hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className="flex-1 overflow-visible">
        {activeTab === 'infos' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="card-neon md:col-span-1 border-t-2 border-t-brand-primary">
                <div className="text-[11px] text-muted-text uppercase font-bold mb-4 tracking-wider">TOTAL VENDUS</div>
                <div className="text-2xl font-bold text-white mb-2">
                  {activeEvent.ticketsSold + (activeEvent.shotgunTickets || 0)} <span className="text-sm font-normal text-slate-500 uppercase tracking-tight">/ {activeEvent.maxCapacity}</span>
                </div>
                <div className="flex gap-2 text-[9px] font-bold uppercase mb-2">
                  <span className="text-brand-primary">Local: {activeEvent.ticketsSold}</span>
                  <span className="text-brand-secondary">Shotgun: {activeEvent.shotgunTickets || 0}</span>
                </div>
                <div className="h-2 bg-[#334155] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary transition-all duration-500"
                    style={{ width: `${((activeEvent.ticketsSold + (activeEvent.shotgunTickets || 0)) / activeEvent.maxCapacity) * 100}%` }}
                  />
                </div>
              </div>

              <div className="card-neon md:col-span-1">
                <div className="text-[11px] text-muted-text uppercase font-bold mb-4 tracking-wider">RECETTES ESTIMÉES</div>
                <div className="text-2xl font-bold text-white mb-1">
                  {(activeEvent.ticketsSold * activeEvent.ticketPrice) + 
                   (activeEvent.ticketTiers || []).reduce((acc: number, t: any) => acc + (t.sold * t.price), 0) +
                   ((activeEvent.shotgunTickets || 0) * activeEvent.ticketPrice) // Simplified for mock
                  } €
                </div>
                <div className="text-[11px] text-brand-accent font-bold">↑ Opération calculée</div>
              </div>

              <div className="card-neon md:col-span-2 overflow-hidden flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-[11px] text-muted-text uppercase font-bold tracking-wider">BILLETTERIE RAPIDE (LOCAL)</div>
                    <div className="text-sm text-slate-500 mt-1">Saisie guichet standard</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-white">{activeEvent.ticketPrice},00 €</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => updateEvent({ ...activeEvent, ticketsSold: Math.min(activeEvent.maxCapacity, activeEvent.ticketsSold + 1) })}
                    className="btn-neon h-14 flex flex-col items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-[10px] uppercase font-black">+ 1 BILLET</span>
                  </button>
                  <button 
                    onClick={() => updateEvent({ ...activeEvent, ticketsSold: Math.min(activeEvent.maxCapacity, activeEvent.ticketsSold + 5) })}
                    className="btn-neon h-14 flex flex-col items-center justify-center gap-1 bg-brand-secondary hover:bg-brand-secondary/90 transition-colors"
                  >
                    <div className="flex gap-[-2px]"><Plus className="w-3 h-3" /><Plus className="w-3 h-3" /></div>
                    <span className="text-[10px] uppercase font-black">+ 5 BILLETS</span>
                  </button>
                </div>
              </div>

              {/* Shotgun Simulation Toggle */}
              <div className="card-neon md:col-span-4 border-l-4 border-l-brand-secondary bg-brand-secondary/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-brand-secondary rounded flex items-center justify-center text-white">
                      <Ticket className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">INTEGRATION SHOTGUN</h4>
                      <p className="text-[10px] text-muted-text uppercase tracking-widest">Synchronisation temps réel activée</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-text font-bold uppercase">Billets Shotgun</p>
                      <p className="text-xl font-mono font-bold text-brand-secondary">{activeEvent.shotgunTickets || 0}</p>
                    </div>
                    <button 
                      onClick={() => updateEvent({ ...activeEvent, shotgunTickets: (activeEvent.shotgunTickets || 0) + Math.floor(Math.random() * 3) })}
                      className="btn-neon-ghost border-brand-secondary text-brand-secondary hover:bg-brand-secondary hover:text-white"
                    >
                      FORCER SYNC
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Ticket Tiers & Promo Codes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="card-neon p-0 overflow-hidden">
                  <div className="p-4 border-b border-card-border bg-sidebar-bg/50 flex justify-between items-center">
                    <h3 className="text-[11px] font-bold text-brand-primary uppercase tracking-widest">Catégories de Tarifs</h3>
                    <button 
                      onClick={() => {
                        const label = prompt('Nom du tarif?');
                        const price = parseFloat(prompt('Prix?') || '0');
                        if (label && !isNaN(price)) {
                          const newTier: TicketTier = { id: crypto.randomUUID(), label, price, sold: 0 };
                          updateEvent({ ...activeEvent, ticketTiers: [...(activeEvent.ticketTiers || []), newTier] });
                        }
                      }}
                      className="text-[10px] text-brand-primary hover:underline font-bold"
                    >
                      + AJOUTER
                    </button>
                  </div>
                  <div className="divide-y divide-card-border">
                    {(activeEvent.ticketTiers || []).map((tier: any) => (
                      <div key={tier.id} className="p-4 flex items-center justify-between hover:bg-white/5">
                        <div>
                          <p className="text-xs font-bold text-white">{tier.label}</p>
                          <p className="text-[10px] text-muted-text">{tier.price} €</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs font-bold text-white">{tier.sold}</p>
                            <p className="text-[9px] text-muted-text uppercase">Vendus</p>
                          </div>
                          <button onClick={() => {
                             const newTiers = activeEvent.ticketTiers.map((t: any) => t.id === tier.id ? { ...t, sold: t.sold + 1 } : t);
                             updateEvent({ ...activeEvent, ticketTiers: newTiers });
                          }} className="btn-neon p-1 px-2 text-[10px]">+</button>
                          <button onClick={() => {
                             const newTiers = activeEvent.ticketTiers.filter((t: any) => t.id !== tier.id);
                             updateEvent({ ...activeEvent, ticketTiers: newTiers });
                          }} className="text-slate-600 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                    {(activeEvent.ticketTiers || []).length === 0 && <p className="p-4 text-xs text-slate-500 italic">Aucun tarif spécifique.</p>}
                  </div>
               </div>

               <div className="card-neon p-0 overflow-hidden">
                  <div className="p-4 border-b border-card-border bg-sidebar-bg/50 flex justify-between items-center">
                    <h3 className="text-[11px] font-bold text-brand-secondary uppercase tracking-widest">Codes Promo</h3>
                    <button 
                      onClick={() => {
                        const code = prompt('Code?');
                        const disc = parseFloat(prompt('Réduction?') || '0');
                        if (code && !isNaN(disc)) {
                          const newPromo: PromoCode = { id: crypto.randomUUID(), code, discount: disc, type: 'fixed', uses: 0 };
                          updateEvent({ ...activeEvent, promoCodes: [...(activeEvent.promoCodes || []), newPromo] });
                        }
                      }}
                      className="text-[10px] text-brand-secondary hover:underline font-bold"
                    >
                      + GÉNÉRER
                    </button>
                  </div>
                  <div className="divide-y divide-card-border">
                    {(activeEvent.promoCodes || []).map((promo: any) => (
                      <div key={promo.id} className="p-4 flex items-center justify-between hover:bg-white/5">
                        <div className="flex items-center gap-3">
                          <div className="px-2 py-1 bg-brand-secondary/10 border border-brand-secondary/30 rounded font-mono text-[10px] text-brand-secondary font-bold">
                            {promo.code}
                          </div>
                          <p className="text-[10px] text-white">-{promo.discount}€</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs font-bold text-white">{promo.uses}</p>
                            <p className="text-[9px] text-muted-text uppercase">Utilisations</p>
                          </div>
                          <button onClick={() => {
                             const newPromos = activeEvent.promoCodes.map((p: any) => p.id === promo.id ? { ...p, uses: p.uses + 1 } : p);
                             updateEvent({ ...activeEvent, promoCodes: newPromos });
                          }} className="btn-neon p-1 px-2 text-[10px] bg-brand-secondary">+</button>
                          <button onClick={() => {
                             const newPromos = activeEvent.promoCodes.filter((p: any) => p.id !== promo.id);
                             updateEvent({ ...activeEvent, promoCodes: newPromos });
                          }} className="text-slate-600 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                    {(activeEvent.promoCodes || []).length === 0 && <p className="p-4 text-xs text-slate-500 italic">Aucun code actif.</p>}
                  </div>
               </div>
            </div>

            {/* Technical Summary */}
            <div className="card-neon p-0 overflow-hidden">
              <div className="p-4 border-b border-card-border bg-sidebar-bg/50">
                <h3 className="text-[11px] font-bold text-brand-secondary uppercase tracking-widest">Fiche d'Identité Technique</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-card-border border-b border-card-border">
                 {[
                  { label: 'Artistes', val: activeEvent.lineup.length },
                  { label: 'Staff Présent', val: `${activeEvent.staff.filter((s: any) => s.status === 'Present').length} / ${activeEvent.staff.length}` },
                  { label: 'Jauge Totale', val: activeEvent.maxCapacity },
                  { label: 'ID RÉF.', val: activeEvent.customId || activeEvent.id.slice(0, 8).toUpperCase() }
                 ].map((item, i) => (
                  <div key={i} className="p-4 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-muted-text uppercase font-bold mb-1 tracking-tight">{item.label}</span>
                    <span className="text-lg font-bold text-white">{item.val}</span>
                  </div>
                 ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="manager-grid grid grid-cols-1 md:grid-cols-[1fr_340px] gap-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-sidebar-bg/50 p-3 rounded-lg border border-card-border overflow-hidden relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-brand-primary"></div>
                <div className="pl-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-text">Timeline Live</div>
                  <div className="text-xs font-bold text-white uppercase">{activeEvent.title}</div>
                </div>
                <div className="flex items-center gap-3">
                   <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-brand-primary tabular-nums">
                        {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[8px] font-bold text-muted-text uppercase">En direct</span>
                   </div>
                   <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse shadow-[0_0_8px_rgba(37,99,235,0.8)]"></div>
                </div>
              </div>

              <div className="space-y-3">
                {combinedTimeline.map((item: any) => (
                  <div 
                    key={item.id} 
                    className={`card-neon py-3 px-4 flex items-center gap-4 transition-all duration-300 group ${
                      item.status === 'completed' ? 'opacity-60 border-brand-primary/30' : 
                      item.status === 'in-progress' ? 'border-brand-primary bg-brand-primary/5 shadow-lg shadow-brand-primary/5 ring-1 ring-brand-primary/20 scale-[1.01]' : 'hover:border-white/10'
                    }`}
                  >
                    <div className="flex flex-col min-w-[110px] border-r border-card-border pr-4 gap-1.5">
                      <div className="flex justify-between items-center bg-dark-bg/30 px-2 py-0.5 rounded border border-card-border/30">
                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Prévu</span>
                        <span className="text-[10px] font-mono font-bold text-slate-500 tabular-nums">{item.time.split(' - ')[0]}</span>
                      </div>
                      <div className={`flex justify-between items-center px-2 py-1 rounded border shadow-sm transition-all ${
                        item.projectedTime !== item.time 
                        ? 'bg-brand-accent/5 border-brand-accent/40 ring-1 ring-brand-accent/20' 
                        : 'bg-brand-primary/5 border-brand-primary/40'
                      }`}>
                        <span className={`text-[7px] font-black uppercase tracking-tighter ${item.projectedTime !== item.time ? 'text-brand-accent' : 'text-brand-primary'}`}>
                          {item.projectedTime !== item.time ? 'Décalé' : 'Normal'}
                        </span>
                        <span className={`text-[11px] font-mono font-bold tabular-nums ${item.projectedTime !== item.time ? 'text-brand-accent' : 'text-brand-primary'}`}>
                          {item.projectedTime.split(' - ')[0]}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${item.status === 'in-progress' ? 'text-brand-primary' : 'text-white'}`}>
                          {item.label}
                        </span>
                        {(item.type === 'artist-start' || item.type === 'artist-end') && (
                          <span className={`px-1.5 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-widest ${
                            item.type === 'artist-start' ? 'bg-brand-secondary/10 border-brand-secondary/30 text-brand-secondary' : 'bg-slate-800 border-slate-700 text-slate-400 opacity-60'
                          }`}>
                            {item.type === 'artist-start' ? 'DÉBUT SET' : 'FIN SET'}
                          </span>
                        )}
                        {item.status === 'in-progress' && (
                           <motion.span 
                            animate={{ opacity: [1, 0.4, 1] }} 
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="bg-brand-primary/20 text-brand-primary text-[8px] font-black px-1.5 py-0.5 rounded border border-brand-primary/40 uppercase"
                           >
                            En Cours
                           </motion.span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1">
                        {item.status === 'completed' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-brand-primary uppercase">Réalisé à:</span>
                            <span className="text-[10px] font-mono font-bold text-white bg-dark-bg px-1.5 py-0.5 rounded border border-card-border shadow-inner">
                              {item.actualTime || '--:--'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                             {item.status === 'in-progress' ? (
                               <motion.span 
                                animate={{ opacity: [1, 0.4, 1] }} 
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="bg-brand-primary/20 text-brand-primary text-[8px] font-black px-1.5 py-0.5 rounded border border-brand-primary/40 uppercase"
                               >
                                En Cours
                               </motion.span>
                             ) : currentTime >= (item.projectedTime.split(' - ')[0]) ? (
                               <motion.span 
                                animate={{ opacity: [1, 0.4, 1], scale: [1, 1.05, 1] }}
                                transition={{ repeat: Infinity, duration: 1 }}
                                className="bg-brand-accent text-white text-[9px] font-black px-2 py-0.5 rounded shadow-[0_0_10px_rgba(239,68,68,0.4)] uppercase tracking-widest flex items-center gap-1"
                               >
                                <AlertTriangle className="w-2.5 h-2.5" /> À DÉMARRER
                               </motion.span>
                             ) : (
                               <span className="text-[10px] font-bold text-slate-500 uppercase italic">En attente...</span>
                             )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {!isLocked ? (
                        <>
                          {item.type === 'phase' && (
                            <>
                              {item.status === 'pending' && (
                                <button 
                                  onClick={() => updateTimelinePhase(item.id, { status: 'in-progress' })}
                                  className="text-[10px] bg-brand-primary text-white px-3 py-1.5 rounded font-black hover:opacity-90 transition-all uppercase tracking-wider"
                                >
                                  Lancer
                                </button>
                              )}
                              {item.status === 'in-progress' && (
                                <button 
                                  onClick={() => {
                                    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                                    updateTimelinePhase(item.id, { status: 'completed', actualTime: now });
                                  }}
                                  className="text-[10px] bg-brand-secondary text-white px-3 py-1.5 rounded font-black hover:opacity-90 transition-all uppercase tracking-wider shadow-lg shadow-brand-secondary/20"
                                >
                                  Terminer
                                </button>
                              )}
                              {item.status === 'completed' && (
                                <button 
                                  onClick={() => updateTimelinePhase(item.id, { status: 'pending', actualTime: undefined })}
                                  className="text-[10px] text-muted-text hover:text-white uppercase font-black tracking-widest px-2 py-1"
                                >
                                  Reset
                                </button>
                              )}
                            </>
                          )}
                          {item.type === 'artist' && (
                            <div className="flex items-center bg-dark-bg border border-card-border rounded px-1 transition-colors hover:border-brand-accent/50">
                              <span className="text-[9px] text-muted-text font-black px-1 uppercase whitespace-nowrap">Retard:</span>
                              <input 
                                type="number" 
                                value={item.lateMinutes || 0}
                                onChange={(e) => updateArtistLate(item.id, parseInt(e.target.value) || 0)}
                                className="w-10 bg-transparent text-center text-sm font-black text-brand-accent focus:outline-none p-1"
                              />
                              <span className="text-[9px] text-muted-text font-black px-1">MIN</span>
                            </div>
                          )}
                        </>
                      ) : (
                        item.type === 'phase' && (
                          <button 
                            onClick={() => removeTimelinePhase(item.id)}
                            className="text-slate-600 hover:text-red-500 p-2 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
                
                {combinedTimeline.length === 0 && (
                  <div className="p-12 text-center card-neon border-dashed border-card-border">
                    <div className="flex flex-col items-center gap-3">
                      <Clock className="w-8 h-8 text-slate-800" />
                      <div className="text-slate-500 text-xs font-bold uppercase tracking-widest italic">Aucune phase définie pour cet événement.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
               <div className="card-neon bg-sidebar-bg/30">
                 <h3 className="text-[11px] font-bold text-brand-primary uppercase tracking-[0.2em] mb-4">Actions Planning</h3>
                 <div className="space-y-3">
                    <button 
                      onClick={() => setIsLocked(!isLocked)}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded text-[10px] font-black transition-all uppercase tracking-widest border ${
                        isLocked ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' : 'bg-dark-bg border-card-border text-muted-text hover:text-white'
                      }`}
                    >
                      {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      {isLocked ? 'MODE EDITION OFF' : 'MODE EDITION ON'}
                    </button>

                    {!isLocked ? (
                      <div className="p-4 bg-dark-bg rounded border border-card-border space-y-3 mt-4 border-t-2 border-t-brand-primary">
                        <div className="text-[9px] font-black text-muted-text uppercase tracking-widest mb-2">Ajouter un jalon</div>
                        <input 
                          value={phaseLabel} onChange={e => setPhaseLabel(e.target.value)}
                          className="w-full bg-sidebar-bg border border-card-border rounded px-3 py-2 text-xs text-white focus:border-brand-primary outline-none" 
                          placeholder="Nom de la phase"
                        />
                        <input 
                          type="time" value={phaseTime} onChange={e => setPhaseTime(e.target.value)}
                          className="w-full bg-sidebar-bg border border-card-border rounded px-3 py-2 text-xs text-white focus:border-brand-primary outline-none font-mono" 
                        />
                        <button onClick={addTimelinePhase} className="btn-neon w-full py-2 bg-brand-primary">
                           AJOUTER JALON
                        </button>
                      </div>
                    ) : (
                      <div className="p-6 text-center bg-dark-bg shadow-inner rounded-xl border border-card-border">
                         <div className="text-[40px] mb-2">🔒</div>
                         <div className="text-[10px] font-black text-muted-text uppercase tracking-widest">Planning Verrouillé</div>
                         <p className="text-[9px] text-slate-600 mt-1 uppercase">Désactivez le mode édition pour modifier la structure</p>
                      </div>
                    )}
                 </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'lineup' && (
          <div className="manager-grid grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
            <div className="flex flex-col gap-4">
              <div className="card-neon border-t-2 border-t-brand-secondary">
                <h3 className="text-xs font-bold text-brand-secondary uppercase tracking-widest mb-4">Programmation Artiste</h3>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-text uppercase">Nom de l'artiste</label>
                    <input 
                      value={artistName} onChange={e => setArtistName(e.target.value)}
                      className="w-full bg-dark-bg border border-card-border rounded px-3 py-2 text-xs focus:border-brand-primary focus:outline-none text-white transition-colors" 
                      placeholder="ex: Amelie Lens"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-text uppercase">Catégorie</label>
                    <select 
                      value={artistType} onChange={e => setArtistType(e.target.value as any)}
                      className="w-full bg-dark-bg border border-card-border rounded px-3 py-2 text-xs focus:border-brand-primary focus:outline-none text-white transition-colors"
                    >
                      <option value="DJ Pro">DJ Pro</option>
                      <option value="DJ Stg">DJ Stg</option>
                      <option value="Live act">Live act</option>
                      <option value="Guest">Guest</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-text uppercase">Slot Horaire</label>
                    <input 
                      value={artistSlot} onChange={e => setArtistSlot(e.target.value)}
                      className="w-full bg-dark-bg border border-card-border rounded px-3 py-2 text-xs focus:border-brand-primary focus:outline-none text-white transition-colors font-mono" 
                      placeholder="ex: 01:00 - 03:00"
                    />
                  </div>
                  <button onClick={addArtist} className="btn-neon w-full flex items-center justify-center gap-2 mt-2 bg-brand-secondary">
                     <Plus className="w-3 h-3" /> AJOUTER AU LINEUP
                  </button>
                </div>
              </div>
            </div>

            <div className="card-neon p-0 overflow-hidden">
              <div className="bg-sidebar-bg/50 p-4 border-b border-card-border">
                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Slots Programmés</h3>
              </div>
              <table className="w-full text-[13px] border-collapse">
                <thead className="bg-dark-bg/50">
                  <tr className="border-b border-card-border">
                    <th className="text-left py-4 px-6 text-[10px] text-muted-text font-black uppercase tracking-wider">Horaire</th>
                    <th className="text-left py-4 px-6 text-[10px] text-muted-text font-black uppercase tracking-wider">Artiste</th>
                    <th className="text-left py-4 px-6 text-[10px] text-muted-text font-black uppercase tracking-wider">Type</th>
                    <th className="text-right py-4 px-6 text-[10px] text-muted-text font-black uppercase tracking-wider">Gestion Retard</th>
                    <th className="text-right py-4 px-6 text-[10px] text-muted-text font-black uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border/50">
                  {activeEvent.lineup.map((artist: any, idx: number) => (
                    <tr key={artist.id} className={`${idx % 2 === 0 ? '' : 'bg-sidebar-bg/10'} hover:bg-brand-primary/5 transition-all duration-300 group`}>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-mono text-brand-primary font-black text-sm tracking-tighter">{artist.slot}</span>
                          {artist.lateMinutes > 0 && (
                            <span className="text-[9px] text-brand-accent font-black uppercase mt-0.5">+{artist.lateMinutes} min de retard</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 border border-white/5 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                            {artist.name[0]}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-white text-sm">{artist.name}</span>
                            {artist.lateMinutes > 0 && <span className="text-[8px] text-brand-accent font-bold uppercase animate-pulse">En retard</span>}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                          artist.type === 'DJ Pro' ? 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary' :
                          artist.type === 'DJ Stg' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' :
                          artist.type === 'Live act' ? 'bg-brand-secondary/10 border-brand-secondary/30 text-brand-secondary' :
                          'bg-slate-800 border-slate-700 text-slate-400'
                        }`}>
                          {artist.type}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center bg-dark-bg border border-card-border rounded px-1 group-hover:border-brand-accent/50 transition-all shadow-inner">
                          <input 
                            type="number" 
                            value={artist.lateMinutes || 0}
                            onChange={(e) => updateArtistLate(artist.id, parseInt(e.target.value) || 0)}
                            className="w-12 bg-transparent text-center text-xs font-black text-brand-accent focus:outline-none p-1.5"
                          />
                          <span className="text-[9px] text-muted-text font-black px-1 uppercase pr-2">min</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation();
                            updateEvent({ ...activeEvent, lineup: activeEvent.lineup.filter((a: any) => a.id !== artist.id) }); 
                          }}
                          className="text-slate-500 hover:text-red-500 p-3 transition-all hover:scale-110 flex items-center justify-center ml-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {activeEvent.lineup.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-600 italic text-sm tracking-widest uppercase">
                        Aucun artiste programmé pour le moment
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="manager-grid grid grid-cols-1 md:grid-cols-[1fr_340px] gap-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-sidebar-bg/50 p-3 rounded-lg border border-card-border">
                <div className="text-xs font-bold uppercase tracking-widest text-muted-text">Équipe sur place <span className="text-white">({activeEvent.staff.length})</span></div>
                <div className="flex gap-2">
                  <button 
                    onClick={markAllStaffPresent}
                    className="text-[10px] bg-brand-primary/20 text-brand-primary border border-brand-primary/30 px-3 py-1.5 rounded font-black hover:bg-brand-primary hover:text-white transition-all uppercase"
                  >
                    ✓ Tout Pointer
                  </button>
                  <button onClick={importStaff} className="text-[10px] btn-neon-ghost border-dashed border-muted-text hover:border-brand-secondary hover:text-white transition-all uppercase font-black">
                    + Appeler Staff Répertoire
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeEvent.staff.map((s: any) => (
                  <div key={s.id} className={`flex items-center gap-3 p-3 bg-dark-bg/40 border border-card-border rounded-lg transition-all ${s.status === 'Present' ? 'border-brand-primary/50 bg-brand-primary/5 shadow-sm shadow-brand-primary/10' : 'opacity-80'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold relative shrink-0 ${s.status === 'Present' ? 'bg-brand-primary text-white' : 'bg-slate-800 text-muted-text'}`}>
                      {s.firstName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">{s.firstName}</span>
                      </div>
                      <div className="text-[10px] text-muted-text truncate">{s.role} • Convoc: {s.callTime}</div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          if (s.status === 'Absent') {
                            markAllStaffPresent();
                          } else {
                            toggleStaffStatus(s.id);
                          }
                        }}
                        className={`p-2 rounded font-bold text-sm transition-all ${
                          s.status === 'Present' ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20' : 'btn-neon-ghost'
                        }`}
                      >
                        {s.status === 'Present' ? '✓' : 'Pointer'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="card-neon bg-brand-primary/5 border-brand-primary/20">
                <h3 className="text-xs font-bold text-brand-primary uppercase tracking-widest mb-4">Résumé Pointage</h3>
                <div className="grid grid-cols-2 gap-2 mb-4 text-center">
                  <div className="bg-dark-bg/60 p-3 rounded border border-card-border">
                    <div className="text-[10px] text-muted-text uppercase font-bold mb-1">Présents</div>
                    <div className="text-xl font-bold text-white">{activeEvent.staff.filter((s: any) => s.status === 'Present').length}</div>
                  </div>
                  <div className="bg-dark-bg/60 p-3 rounded border border-card-border">
                    <div className="text-[10px] text-muted-text uppercase font-bold mb-1">En attente</div>
                    <div className="text-xl font-bold text-slate-500">{activeEvent.staff.filter((s: any) => s.status === 'Absent').length}</div>
                  </div>
                </div>
                <button className="btn-neon w-full bg-brand-primary hover:bg-brand-primary/90 uppercase text-[10px] font-black tracking-widest">Extraire Rapport Presence</button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  // --- State ---
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [venues, setVenues] = useState<Venue[]>([]);
  const [globalStaff, setGlobalStaff] = useState<StaffMember[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // --- Synchronization via Firestore (Public) ---
  useEffect(() => {
    const unsubVenues = onSnapshot(collection(db, 'venues'), 
      (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as Venue);
        setVenues(data);
        setIsLoaded(true);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'venues')
    );

    const unsubStaff = onSnapshot(collection(db, 'staff'), 
      (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as StaffMember);
        setGlobalStaff(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'staff')
    );

    const unsubEvents = onSnapshot(query(collection(db, 'events'), orderBy('date', 'desc')), 
      (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data() as Event);
        setEvents(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'events')
    );

    return () => {
      unsubVenues();
      unsubStaff();
      unsubEvents();
    };
  }, []);

  // --- Computed Stats ---
  const stats = useMemo(() => {
    const totalBillets = events.reduce((acc, ev) => acc + ev.ticketsSold, 0);
    const totalRecettes = events.reduce((acc, ev) => acc + (ev.ticketsSold * (ev.ticketPrice || 0)), 0);
    return {
      totalEvents: events.length,
      totalBillets,
      totalRecettes
    };
  }, [events]);

  const activeEvent = useMemo(() => {
    return events.find(e => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  const [isSyncing, setIsSyncing] = useState(false);

  const syncShotgunEvents = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/shotgun/events');
      const data = await response.json();

      if (data.error) {
        let errorMsg = `${data.error}\n\n`;
        if (data.errors) {
          errorMsg += data.errors.map((e: any) => `- ${e.url}: ${e.status}`).join('\n');
        } else {
          errorMsg += data.details || '';
        }
        alert(errorMsg);
        return;
      }

      const shotgunEvents = Array.isArray(data) ? data : (data.events || []);
      
      const newItems: Event[] = shotgunEvents.map((sg: any) => {
        const sgId = `SG-${sg.id}`;
        if (events.some(e => e.customId === sgId)) return null;

        return {
          id: crypto.randomUUID(),
          customId: sgId,
          title: sg.name || 'Sans titre',
          date: sg.beginAt ? sg.beginAt.split('T')[0] : '',
          venueId: '',
          maxCapacity: sg.capacity || 0,
          ticketsSold: sg.ticketsSold || 0,
          shotgunTickets: sg.ticketsSold || 0,
          ticketPrice: 0,
          ticketTiers: [],
          promoCodes: [],
          lineup: [],
          staff: [],
          timeline: [
            { id: '1', label: 'Installation', time: '18:00', status: 'pending' },
            { id: '2', label: 'Ouverture Portes', time: '21:00', status: 'pending' },
            { id: '3', label: 'Start Music', time: '22:00', status: 'pending' },
            { id: '4', label: 'Closing', time: '05:00', status: 'pending' },
            { id: '5', label: 'Désinstallation', time: '06:00', status: 'pending' },
          ]
        };
      }).filter((e: any): e is Event => e !== null);

      if (newItems.length > 0) {
        for (const item of newItems) {
          await setDoc(doc(db, 'events', item.id), item);
        }
      }
      alert(`${newItems.length} événements importés.`);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la récupération des données Shotgun.");
    } finally {
      setIsSyncing(false);
    }
  };

  // --- Handlers ---
  const addVenue = async (venueData: Omit<Venue, 'id'>) => {
    const id = crypto.randomUUID();
    const newVenue = { ...venueData, id };
    try {
      await setDoc(doc(db, 'venues', id), newVenue);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `venues/${id}`);
    }
  };

  const deleteVenue = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'venues', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `venues/${id}`);
    }
  };

  const addStaff = async (staffData: Omit<StaffMember, 'id'>) => {
    const id = crypto.randomUUID();
    const newStaff = { ...staffData, id };
    try {
      await setDoc(doc(db, 'staff', id), newStaff);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `staff/${id}`);
    }
  };

  const deleteStaff = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'staff', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `staff/${id}`);
    }
  };

  const createEvent = async (title: string, date: string, venueId: string, price: number, customId?: string) => {
    const venue = venues.find(v => v.id === venueId);
    const id = crypto.randomUUID();
    const newEvent: Event = {
      id,
      customId: customId || '',
      title,
      date,
      venueId,
      maxCapacity: venue?.capacity || 0,
      ticketsSold: 0,
      shotgunTickets: 0,
      ticketPrice: price,
      ticketTiers: [],
      promoCodes: [],
      lineup: [],
      staff: [],
      timeline: [
        { id: '1', label: 'Installation', time: '18:00', status: 'pending' },
        { id: '2', label: 'Ouverture Portes', time: '21:00', status: 'pending' },
        { id: '3', label: 'Start Music', time: '22:00', status: 'pending' },
        { id: '4', label: 'Closing', time: '05:00', status: 'pending' },
        { id: '5', label: 'Désinstallation', time: '06:00', status: 'pending' },
      ]
    };
    try {
      await setDoc(doc(db, 'events', id), newEvent);
      setSelectedEventId(id);
      setCurrentView('manager');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `events/${id}`);
    }
  };

  const updateEvent = async (updatedEvent: Event) => {
    try {
      await setDoc(doc(db, 'events', updatedEvent.id), updatedEvent);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `events/${updatedEvent.id}`);
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'events', id));
      if (selectedEventId === id) setSelectedEventId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `events/${id}`);
    }
  };

  if (!isLoaded) return (
    <div className="min-h-screen bg-[#0f0f12] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium tracking-widest animate-pulse uppercase">Synchronisation Cloud...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-dark-bg selection:bg-brand-primary selection:text-white">
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        isMobileMenuOpen={isMobileMenuOpen} 
        setIsMobileMenuOpen={setIsMobileMenuOpen} 
      />
      
      <main className="lg:ml-[220px] p-4 md:p-8 lg:p-6 transition-all duration-300">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between mb-8 bg-sidebar-bg p-4 rounded-xl border border-card-border">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center text-sm shadow-inner shadow-white/10">
                🪩
              </div>
             <div className="flex flex-col">
                <span className="text-white text-[10px] font-black tracking-tighter leading-none opacity-50 uppercase">STARLIGHT</span>
                <span className="text-brand-primary text-[11px] font-bold tracking-widest leading-none uppercase">SOCIETY</span>
             </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-muted-text hover:text-white">
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <div className="max-w-[1400px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
            >
              {currentView === 'dashboard' && (
                <DashboardView 
                  stats={stats} 
                  venues={venues} 
                  events={events} 
                  setSelectedEventId={setSelectedEventId} 
                  setCurrentView={setCurrentView} 
                />
              )}
              {currentView === 'clubs' && (
                <ClubsView 
                  venues={venues} 
                  addVenue={addVenue} 
                  deleteVenue={deleteVenue} 
                />
              )}
              {currentView === 'team' && (
                <TeamView 
                  globalStaff={globalStaff} 
                  addStaff={addStaff} 
                  deleteStaff={deleteStaff} 
                />
              )}
              {currentView === 'events' && (
                <EventsView 
                  venues={venues} 
                  events={events} 
                  createEvent={createEvent} 
                  deleteEvent={deleteEvent} 
                  setSelectedEventId={setSelectedEventId} 
                  setCurrentView={setCurrentView} 
                  syncShotgunEvents={syncShotgunEvents}
                  isSyncing={isSyncing}
                />
              )}
              {currentView === 'shotgun' && (
                <div className="h-[calc(100vh-160px)] w-full rounded-2xl overflow-hidden border border-white/10 bg-dark-bg shadow-2xl relative">
                  {(() => {
                    const rawValue = import.meta.env.VITE_SHOTGUN_URL || 'starlight-society';
                    const shotgunUrl = rawValue.startsWith('http') 
                      ? rawValue 
                      : `https://shotgun.live/organizers/${rawValue}`;
                    
                    return (
                      <>
                        <div className="absolute top-4 right-4 z-10">
                          <a 
                            href={shotgunUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-brand-primary text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform flex items-center justify-center border border-white/20"
                            title="Ouvrir dans un nouvel onglet"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                        <iframe 
                          src={shotgunUrl} 
                          className="w-full h-full border-none bg-white"
                          title="Ma page Shotgun"
                          referrerPolicy="no-referrer"
                        />
                      </>
                    );
                  })()}
                </div>
              )}
              {currentView === 'manager' && (
                <EventManagerView 
                  activeEvent={activeEvent} 
                  updateEvent={updateEvent} 
                  venues={venues} 
                  globalStaff={globalStaff} 
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
