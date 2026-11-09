'use client';

import React, { useState, useMemo } from 'react';
import { Appointment, WeddingService, Location, UnifiedEvent } from '@/types';
import { createGoogleCalendarUrl } from '@/lib/calendar';
import {
  Calendar as CalendarIcon,
  Plus,
  Heart,
  Sparkles,
  MapPin,
  Clock,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO
} from 'date-fns';
import { it } from 'date-fns/locale';

interface AgendaViewProps {
  appointments: Appointment[];
  weddings: WeddingService[];
  locations: Location[];
  onOpenNewPmu: () => void;
  onOpenNewWedding: () => void;
  onSelectPmu: (app: Appointment) => void;
  onSelectWedding: (w: WeddingService) => void;
}

export default function AgendaView({
  appointments,
  weddings,
  locations,
  onOpenNewPmu,
  onOpenNewWedding,
  onSelectPmu,
  onSelectWedding,
}: AgendaViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  // Location map for fast lookup
  const locMap = useMemo(() => {
    const map = new Map<string, Location>();
    locations.forEach(l => map.set(l.id, l));
    return map;
  }, [locations]);

  // Merge appointments and weddings into unified events
  const unifiedEvents: UnifiedEvent[] = useMemo(() => {
    const events: UnifiedEvent[] = [];

    // PMU appointments
    appointments.forEach(app => {
      const loc = locMap.get(app.location_id);
      events.push({
        id: app.id,
        type: 'pmu',
        title: app.treatment,
        client_name: app.client_name,
        date: app.appointment_date,
        end_time: app.end_time,
        location_name: loc?.name || 'Studio',
        location_color: loc?.color || '#ec4899',
        amount: app.payment,
        balance: app.balance,
        status: app.status,
        rawPmu: app,
      });
    });

    // Weddings
    weddings.forEach(w => {
      // 1. Wedding day
      events.push({
        id: `${w.id}-day`,
        type: 'wedding_day',
        title: `Matrimonio (${w.people_count} pers.)`,
        client_name: w.bride_name,
        date: w.wedding_date,
        location_name: 'Location Sposa',
        location_color: '#f43f5e',
        amount: w.wedding_balance || w.total_price,
        balance: 0,
        status: w.status,
        rawWedding: w,
      });

      // 2. Trial day if exists
      if (w.trial_date) {
        events.push({
          id: `${w.id}-trial`,
          type: 'wedding_trial',
          title: 'Prova Trucco Sposa',
          client_name: w.bride_name,
          date: w.trial_date,
          location_name: 'Studio',
          location_color: '#f59e0b',
          amount: w.trial_deposit,
          balance: 0,
          status: w.status,
          rawWedding: w,
        });
      }
    });

    // Sort descending by date
    return events.sort((a, b) => b.date.localeCompare(a.date));
  }, [appointments, weddings, locMap]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return unifiedEvents.filter(ev => {
      // Location filter
      if (selectedLocation !== 'all') {
        if (selectedLocation === 'weddings') {
          if (ev.type !== 'wedding_day' && ev.type !== 'wedding_trial') return false;
        } else {
          if (ev.rawPmu?.location_id !== selectedLocation) return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          ev.client_name.toLowerCase().includes(q) ||
          ev.title.toLowerCase().includes(q) ||
          (ev.location_name && ev.location_name.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [unifiedEvents, selectedLocation, searchQuery]);

  // Days for monthly grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  // Events of selected day
  const selectedDayEvents = useMemo(() => {
    return filteredEvents.filter(ev => {
      try {
        const d = parseISO(ev.date);
        return isSameDay(d, selectedDay);
      } catch {
        return false;
      }
    });
  }, [filteredEvents, selectedDay]);

  return (
    <div className="space-y-4">
      {/* Top Action Bar with Two Dedicated Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-900/90 border border-stone-800 p-4 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-rose-500" />
            Agenda & Appuntamenti
          </h1>
          <p className="text-stone-400 text-xs">
            {appointments.length} trattamenti PMU e {weddings.length} spose registrati
          </p>
        </div>

        {/* The TWO distinct buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNewPmu}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-rose-950/50 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nuovo PMU</span>
          </button>

          <button
            onClick={onOpenNewWedding}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-pink-950/50 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Heart className="w-4 h-4 fill-white" />
            <span>Nuova Sposa</span>
          </button>
        </div>
      </div>

      {/* Filters & Search & View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-stone-900/60 p-3 rounded-2xl border border-stone-800">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cerca cliente, ritocco, trattamento..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-stone-800/80 border border-stone-700/60 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
        </div>

        {/* Sedi Filter */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedLocation('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              selectedLocation === 'all'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-stone-800 text-stone-400 hover:text-white'
            }`}
          >
            Tutte
          </button>
          {locations.map(loc => (
            <button
              key={loc.id}
              onClick={() => setSelectedLocation(loc.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                selectedLocation === loc.id
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-stone-800 text-stone-400 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: loc.color }} />
              {loc.name}
            </button>
          ))}
          <button
            onClick={() => setSelectedLocation('weddings')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
              selectedLocation === 'weddings'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'bg-stone-800 text-stone-400 hover:text-white'
            }`}
          >
            <Heart className="w-3 h-3 fill-current" />
            Spose
          </button>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center bg-stone-800 p-0.5 rounded-xl border border-stone-700/60">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'calendar' ? 'bg-stone-700 text-white shadow-sm' : 'text-stone-400 hover:text-white'
            }`}
          >
            Mese
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'list' ? 'bg-stone-700 text-white shadow-sm' : 'text-stone-400 hover:text-white'
            }`}
          >
            Elenco
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Calendar Grid (Col 1-2) */}
          <div className="lg:col-span-2 bg-stone-900 border border-stone-800 rounded-3xl p-4 sm:p-5 shadow-sm">
            {/* Month Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-bold text-white capitalize">
                {format(currentDate, 'MMMM yyyy', { locale: it })}
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                  className="w-8 h-8 rounded-xl bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const now = new Date();
                    setCurrentDate(now);
                    setSelectedDay(now);
                  }}
                  className="px-2.5 py-1 text-xs rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium"
                >
                  Oggi
                </button>
                <button
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                  className="w-8 h-8 rounded-xl bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(d => (
                <div key={d} className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map(day => {
                const dayIso = format(day, 'yyyy-MM-dd');
                const isSelected = isSameDay(day, selectedDay);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, new Date());

                // Find events on this day
                const dayEvents = filteredEvents.filter(ev => ev.date.startsWith(dayIso));
                const count = dayEvents.length;

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDay(day)}
                    className={`min-h-[58px] sm:min-h-[72px] p-1.5 rounded-2xl flex flex-col justify-between items-start transition-all border ${
                      isSelected
                        ? 'border-rose-500 bg-rose-950/30 shadow-sm'
                        : isToday
                        ? 'border-rose-500/40 bg-stone-800/80'
                        : 'border-stone-800/40 bg-stone-800/30 hover:bg-stone-800/60'
                    } ${!isCurrentMonth ? 'opacity-30' : ''}`}
                  >
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday
                          ? 'bg-rose-500 text-white'
                          : isSelected
                          ? 'bg-rose-950 text-rose-300'
                          : 'text-stone-300'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>

                    {/* Event indicators */}
                    {count > 0 && (
                      <div className="w-full flex items-center justify-between mt-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300">
                          {count}
                        </span>
                        <div className="flex gap-0.5">
                          {dayEvents.slice(0, 3).map((e, idx) => (
                            <span
                              key={idx}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: e.location_color || '#ec4899' }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Agenda Drawer (Col 3) */}
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-5 shadow-sm flex flex-col">
            <div className="border-b border-stone-800 pb-3 mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white capitalize">
                  {format(selectedDay, 'EEEE d MMMM yyyy', { locale: it })}
                </h3>
                <p className="text-stone-400 text-xs">
                  {selectedDayEvents.length} appuntamenti per questa giornata
                </p>
              </div>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[500px] pr-1">
              {selectedDayEvents.length === 0 ? (
                <div className="text-center py-12 text-stone-500 text-sm">
                  Nessun appuntamento in questa data.
                  <div className="mt-3 flex justify-center gap-2">
                    <button
                      onClick={onOpenNewPmu}
                      className="text-xs text-rose-400 hover:underline font-semibold"
                    >
                      + Trattamento PMU
                    </button>
                    <span className="text-stone-600">•</span>
                    <button
                      onClick={onOpenNewWedding}
                      className="text-xs text-pink-400 hover:underline font-semibold"
                    >
                      + Sposa
                    </button>
                  </div>
                </div>
              ) : (
                selectedDayEvents.map(ev => renderEventCard(ev, onSelectPmu, onSelectWedding))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Full List View */
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-4 sm:p-6 space-y-3">
          <div className="text-stone-400 text-xs font-semibold uppercase tracking-wider pb-1">
            Visualizzati {filteredEvents.length} appuntamenti
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredEvents.slice(0, 100).map(ev => renderEventCard(ev, onSelectPmu, onSelectWedding))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper card rendering
function renderEventCard(
  ev: UnifiedEvent,
  onSelectPmu: (app: Appointment) => void,
  onSelectWedding: (w: WeddingService) => void
) {
  const isWedding = ev.type === 'wedding_day' || ev.type === 'wedding_trial';
  const timeStr = ev.date.includes('T') ? ev.date.split('T')[1].slice(0, 5) : '';
  const dateStr = ev.date.slice(0, 10);

  return (
    <div
      key={ev.id}
      onClick={() => {
        if (ev.rawPmu) onSelectPmu(ev.rawPmu);
        if (ev.rawWedding) onSelectWedding(ev.rawWedding);
      }}
      className="p-3.5 rounded-2xl bg-stone-800/60 hover:bg-stone-800 border border-stone-700/60 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            {isWedding ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 flex items-center gap-1">
                <Heart className="w-2.5 h-2.5 fill-current" />
                {ev.type === 'wedding_day' ? 'Matrimonio' : 'Prova Trucco'}
              </span>
            ) : (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${ev.location_color}25`,
                  color: ev.location_color,
                }}
              >
                {ev.location_name}
              </span>
            )}
            {timeStr && (
              <span className="text-stone-300 text-[11px] font-mono flex items-center gap-1 bg-stone-900/60 px-2 py-0.5 rounded-md border border-stone-700/50">
                <Clock className="w-3 h-3 text-rose-400" />
                {timeStr}{ev.end_time ? ` - ${ev.end_time}` : ''}
              </span>
            )}
            {ev.rawPmu?.linked_appointment_id && (
              <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1 bg-amber-950/40 border border-amber-800/40 px-1.5 py-0.5 rounded">
                <LinkIcon className="w-2.5 h-2.5" />
                {ev.rawPmu.is_touch_up ? 'Ritocco collegato' : 'Ha ritocco'}
              </span>
            )}
          </div>
          <h4 className="text-sm font-bold text-white group-hover:text-rose-400 transition-colors">
            {ev.client_name}
          </h4>
          <p className="text-stone-300 text-xs">{ev.title}</p>
        </div>

        {/* Amount Badge */}
        <div className="text-right">
          <span className="text-sm font-bold text-emerald-400">
            {ev.amount > 0 ? `${ev.amount}€` : '0€'}
          </span>
          {ev.balance && ev.balance > 0 ? (
            <p className="text-[10px] text-amber-400 font-semibold">
              Saldo: {ev.balance}€
            </p>
          ) : null}
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-2 border-t border-stone-700/40 flex items-center justify-between text-[11px] text-stone-400">
        <span>{dateStr}</span>
        {ev.rawPmu?.touch_up_date && (
          <span className="text-rose-300 text-[10px] bg-rose-950/40 px-1.5 py-0.5 rounded">
            Ritocco: {ev.rawPmu.touch_up_date}
          </span>
        )}
      </div>
    </div>
  );
}

