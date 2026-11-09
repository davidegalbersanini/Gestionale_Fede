'use client';

import React, { useState, useMemo } from 'react';
import { Appointment, WeddingService, Location, UnifiedEvent } from '@/types';
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
  Link as LinkIcon,
  Gift
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
  activeVouchersCount?: number;
  onOpenGiftVouchers?: () => void;
  onOpenNewPmu: (defaultDate?: string) => void;
  onOpenNewWedding: (defaultDate?: string) => void;
  onSelectPmu: (app: Appointment) => void;
  onSelectWedding: (w: WeddingService) => void;
}

export default function AgendaView({
  appointments,
  weddings,
  locations,
  activeVouchersCount = 0,
  onOpenGiftVouchers,
  onOpenNewPmu,
  onOpenNewWedding,
  onSelectPmu,
  onSelectWedding,
}: AgendaViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  // Multi-select filters: array of selected filter keys ('all', loc.id, or 'weddings')
  const [selectedFilters, setSelectedFilters] = useState<string[]>(['all']);
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

    // Appointments (PMU & Generici)
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
        address: loc?.address,
        amount: app.payment,
        balance: app.balance,
        status: app.status,
        rawPmu: app,
      });
    });

    // Weddings & Events
    weddings.forEach(w => {
      // 1. Event Day
      const eventLabel = w.event_type || 'Matrimonio';
      events.push({
        id: `${w.id}-day`,
        type: 'wedding_day',
        title: `${eventLabel} (${w.people_count || 1} pers.)`,
        client_name: w.bride_name,
        date: w.wedding_date,
        location_name: 'Location Evento',
        location_color: '#f43f5e',
        address: w.address,
        amount: w.trial_deposit,
        balance: w.wedding_balance,
        status: w.status,
        rawWedding: w,
      });

      // 2. Trial day if exists
      if (w.trial_date) {
        events.push({
          id: `${w.id}-trial`,
          type: 'wedding_trial',
          title: `Prova Trucco: ${w.bride_name}`,
          client_name: w.bride_name,
          date: w.trial_date,
          location_name: 'Studio',
          location_color: '#f59e0b',
          address: w.address,
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

  // Toggle multi-select filter
  const toggleFilter = (key: string) => {
    if (key === 'all') {
      setSelectedFilters(['all']);
      return;
    }

    let updated = selectedFilters.includes('all') ? [] : [...selectedFilters];

    if (updated.includes(key)) {
      updated = updated.filter(k => k !== key);
      if (updated.length === 0) {
        updated = ['all'];
      }
    } else {
      updated.push(key);
    }

    setSelectedFilters(updated);
  };

  // Filtered events
  const filteredEvents = useMemo(() => {
    return unifiedEvents.filter(ev => {
      // Multi-select Location / Event filter
      if (!selectedFilters.includes('all')) {
        const matchesWedding =
          selectedFilters.includes('weddings') &&
          (ev.type === 'wedding_day' || ev.type === 'wedding_trial');
        const matchesLoc = ev.rawPmu && selectedFilters.includes(ev.rawPmu.location_id);

        if (!matchesWedding && !matchesLoc) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          ev.client_name.toLowerCase().includes(q) ||
          ev.title.toLowerCase().includes(q) ||
          (ev.location_name && ev.location_name.toLowerCase().includes(q)) ||
          (ev.address && ev.address.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [unifiedEvents, selectedFilters, searchQuery]);

  // Days for monthly grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  // Selected Day formatted ISO
  const selectedDayIso = format(selectedDay, 'yyyy-MM-dd');

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
            Agenda
          </h1>
          <p className="text-stone-400 text-xs">
            {appointments.length} PMU • {weddings.length} eventi
          </p>
        </div>

        {/* The Action Buttons: PMU, Evento, Buoni */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {onOpenGiftVouchers && (
            <button
              onClick={onOpenGiftVouchers}
              className="relative px-3 py-2 rounded-2xl bg-stone-800 hover:bg-stone-700/80 border border-stone-700/80 text-amber-300 font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              title="Buoni Regalo"
            >
              <Gift className="w-4 h-4 text-amber-400" />
              <span>Buoni</span>
              {activeVouchersCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-stone-950 text-[10px] font-black">
                  {activeVouchersCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => onOpenNewPmu(selectedDayIso)}
            className="flex-1 sm:flex-none px-3.5 py-2 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-rose-950/50 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>PMU</span>
          </button>

          <button
            onClick={() => onOpenNewWedding(selectedDayIso)}
            className="flex-1 sm:flex-none px-3.5 py-2 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-pink-950/50 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Heart className="w-4 h-4 fill-white" />
            <span>Evento</span>
          </button>
        </div>
      </div>

      {/* Filters & Search & Multi-Select Chips */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-stone-900/60 p-3 rounded-2xl border border-stone-800">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cerca cliente, trattamento, luogo..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-stone-800/80 border border-stone-700/60 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
        </div>

        {/* Multi-Selection Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {/* Chip Tutte */}
          <button
            onClick={() => toggleFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              selectedFilters.includes('all')
                ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-400'
                : 'bg-stone-800 text-stone-400 hover:text-white'
            }`}
          >
            Tutte
          </button>

          {/* Sedi chips */}
          {locations.map(loc => {
            const isSelected = selectedFilters.includes(loc.id);
            return (
              <button
                key={loc.id}
                onClick={() => toggleFilter(loc.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-400'
                    : 'bg-stone-800 text-stone-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: loc.color }} />
                <span>{loc.name}</span>
              </button>
            );
          })}

          {/* Eventi chip */}
          <button
            onClick={() => toggleFilter('weddings')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              selectedFilters.includes('weddings')
                ? 'bg-pink-600 text-white shadow-sm ring-1 ring-pink-400'
                : 'bg-stone-800 text-stone-400 hover:text-white'
            }`}
          >
            <Heart className="w-3 h-3 fill-current" />
            <span>Eventi</span>
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
                        ? 'border-rose-500 bg-rose-950/30 shadow-sm ring-1 ring-rose-500/50'
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
                      onClick={() => onOpenNewPmu(selectedDayIso)}
                      className="text-xs text-rose-400 hover:underline font-semibold"
                    >
                      + Trattamento PMU
                    </button>
                    <span className="text-stone-600">•</span>
                    <button
                      onClick={() => onOpenNewWedding(selectedDayIso)}
                      className="text-xs text-pink-400 hover:underline font-semibold"
                    >
                      + Evento
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

  // Check explicit time: if date ends in T00:00 or has no T, don't show fake time!
  let timeStr = '';
  if (ev.date.includes('T')) {
    const rawTime = ev.date.split('T')[1].slice(0, 5);
    if (rawTime && rawTime !== '00:00') {
      timeStr = rawTime;
    }
  }

  const dateStr = ev.date.slice(0, 10);
  const isGeneric = ev.rawPmu?.category === 'generico';

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
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            {isWedding ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 flex items-center gap-1">
                <Heart className="w-2.5 h-2.5 fill-current" />
                {ev.type === 'wedding_day' ? (ev.rawWedding?.event_type || 'Evento') : 'Prova Trucco'}
              </span>
            ) : isGeneric ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Generico • {ev.location_name}
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

            {/* Time badge: only if explicit real time exists! */}
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

          <h4 className="text-sm font-bold text-white group-hover:text-rose-400 transition-colors truncate">
            {ev.client_name}
          </h4>
          <p className="text-stone-300 text-xs truncate">{ev.title}</p>
        </div>

        {/* Amount & Balance Badge */}
        <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
          <span className="text-sm font-bold text-emerald-400">
            {ev.amount > 0 ? `${ev.amount}€` : '0€'}
          </span>
          {ev.balance && ev.balance > 0 ? (
            <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-600/50 px-2 py-0.5 rounded-md shadow-xs">
              Da saldare: {ev.balance}€
            </span>
          ) : null}
        </div>
      </div>

      {/* Address / Google Maps link if available */}
      {ev.address && (
        <div className="mb-2 flex items-center justify-between text-[11px] text-stone-400 bg-stone-900/50 px-2.5 py-1 rounded-lg border border-stone-700/40">
          <span className="truncate flex items-center gap-1 text-stone-300">
            <MapPin className="w-3 h-3 text-rose-400 flex-shrink-0" />
            <span className="truncate">{ev.address}</span>
          </span>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-rose-400 hover:text-rose-300 ml-1.5 flex items-center gap-0.5 font-semibold flex-shrink-0"
          >
            Maps <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      )}

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
