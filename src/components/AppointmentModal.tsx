'use client';

import React, { useState, useEffect } from 'react';
import { Appointment, Client, Location } from '@/types';
import { syncCalendarAutomatically } from '@/lib/calendar';
import { X, Calendar as CalendarIcon, Clock, DollarSign, MapPin, Tag, Share2, Sparkles, AlertCircle } from 'lucide-react';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (appData: Omit<Appointment, 'id'>, createTouchUpFollowup?: boolean) => void;
  onDelete?: (id: string) => void;
  initialAppointment?: Appointment | null;
  clients: Client[];
  locations: Location[];
}

export default function AppointmentModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialAppointment,
  clients,
  locations,
}: AppointmentModalProps) {
  const [clientName, setClientName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [locationId, setLocationId] = useState(locations[0]?.id || '');
  const [treatment, setTreatment] = useState('Ritocco');
  const [appointmentDate, setAppointmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [appointmentTime, setAppointmentTime] = useState('10:00');
  const [payment, setPayment] = useState('');
  const [balance, setBalance] = useState('');
  const [touchUpDate, setTouchUpDate] = useState('');
  const [createTouchUpFollowup, setCreateTouchUpFollowup] = useState(true);
  const [leadSource, setLeadSource] = useState('Instagram');
  const [notes, setNotes] = useState('');
  const [syncGoogleCalendar, setSyncGoogleCalendar] = useState(true);

  // Common treatments for fast chip selection
  const commonTreatments = [
    'Ritocco',
    'Prima seduta Micro',
    'Prima seduta Sfumatura',
    'Labbra',
    'Combo laminazione',
    'Tatuaggio Fine Line',
    'Eyeliner'
  ];

  useEffect(() => {
    if (initialAppointment) {
      setClientName(initialAppointment.client_name);
      setSelectedClientId(initialAppointment.client_id);
      setLocationId(initialAppointment.location_id);
      setTreatment(initialAppointment.treatment);
      const [d, t] = initialAppointment.appointment_date.split('T');
      setAppointmentDate(d || new Date().toISOString().slice(0, 10));
      setAppointmentTime(t ? t.slice(0, 5) : '10:00');
      setPayment(initialAppointment.payment > 0 ? String(initialAppointment.payment) : '');
      setBalance(initialAppointment.balance > 0 ? String(initialAppointment.balance) : '');
      setTouchUpDate(initialAppointment.touch_up_date || '');
      setLeadSource(initialAppointment.lead_source || 'Instagram');
      setNotes(initialAppointment.notes || '');
      setSyncGoogleCalendar(initialAppointment.sync_google_calendar || false);
    } else {
      setClientName('');
      setSelectedClientId(undefined);
      setLocationId(locations[0]?.id || '');
      setTreatment('Ritocco');
      setAppointmentDate(new Date().toISOString().slice(0, 10));
      setAppointmentTime('10:00');
      setPayment('');
      setBalance('');
      setTouchUpDate('');
      setCreateTouchUpFollowup(true);
      setLeadSource('Instagram');
      setNotes('');
      setSyncGoogleCalendar(true);
    }
  }, [initialAppointment, locations]);

  if (!isOpen) return null;

  const filteredClients = clientName.trim()
    ? clients.filter(c => c.full_name.toLowerCase().includes(clientName.toLowerCase())).slice(0, 5)
    : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;

    const fullDateTime = `${appointmentDate}T${appointmentTime}:00`;
    const loc = locations.find(l => l.id === locationId);

    const appData: Omit<Appointment, 'id'> = {
      client_id: selectedClientId,
      client_name: clientName.trim(),
      location_id: locationId,
      treatment: treatment.trim(),
      appointment_date: fullDateTime,
      payment: parseFloat(payment) || 0,
      balance: parseFloat(balance) || 0,
      touch_up_date: touchUpDate || null,
      lead_source: leadSource,
      notes: notes.trim(),
      sync_google_calendar: syncGoogleCalendar,
      status: fullDateTime < new Date().toISOString() ? 'completato' : 'programmato',
    };

    // Automatic Google Calendar Sync in background (no new tabs!)
    if (syncGoogleCalendar) {
      syncCalendarAutomatically({
        eventId: initialAppointment?.google_calendar_event_id,
        title: `PMU: ${clientName.trim()} - ${treatment.trim()}`,
        startDate: fullDateTime,
        location: loc?.name || '',
        details: `Trattamento: ${treatment}\nPagamento: ${payment || 0}€ | Saldo: ${balance || 0}€\nNote: ${notes}`,
      }).then(res => {
        if (res.eventId && appData) {
          appData.google_calendar_event_id = res.eventId;
        }
      });
    }

    onSave(appData, touchUpDate ? createTouchUpFollowup : false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-stone-900/95 backdrop-blur-md px-6 py-4 border-b border-stone-800 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
            <h2 className="text-lg font-bold text-white">
              {initialAppointment ? 'Modifica Trattamento PMU' : 'Nuovo Trattamento PMU'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Cliente with Autocomplete */}
          <div className="relative">
            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
              Nome Cliente *
            </label>
            <input
              type="text"
              required
              placeholder="es. Laura Rossi"
              value={clientName}
              onChange={e => {
                setClientName(e.target.value);
                setShowClientSuggestions(true);
              }}
              onFocus={() => setShowClientSuggestions(true)}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-rose-500 text-base"
            />
            {showClientSuggestions && filteredClients.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-stone-800 border border-stone-700 rounded-xl shadow-xl overflow-hidden z-20">
                {filteredClients.map(c => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => {
                      setClientName(c.full_name);
                      setSelectedClientId(c.id);
                      setShowClientSuggestions(false);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-rose-950/40 text-stone-200 text-sm flex items-center justify-between border-b border-stone-700/50 last:border-0"
                  >
                    <span className="font-medium text-white">{c.full_name}</span>
                    {c.phone && <span className="text-stone-400 text-xs">{c.phone}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sede */}
          <div>
            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
              Sede di Lavoro
            </label>
            <div className="grid grid-cols-2 gap-2">
              {locations.map(loc => (
                <button
                  type="button"
                  key={loc.id}
                  onClick={() => setLocationId(loc.id)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center justify-center gap-2 transition-all ${
                    locationId === loc.id
                      ? 'bg-rose-600/20 border-rose-500 text-rose-300 shadow-sm'
                      : 'bg-stone-800 border-stone-700 text-stone-400 hover:text-white'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: loc.color }} />
                  {loc.name}
                </button>
              ))}
            </div>
          </div>

          {/* Trattamento */}
          <div>
            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
              Tipo Trattamento
            </label>
            <input
              type="text"
              required
              value={treatment}
              onChange={e => setTreatment(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2.5 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm mb-2"
            />
            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5">
              {commonTreatments.map(t => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTreatment(t)}
                  className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs border border-stone-700/60 active:scale-95"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Data e Ora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
                Data Appuntamento
              </label>
              <input
                type="date"
                required
                value={appointmentDate}
                onChange={e => setAppointmentDate(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
                Orario
              </label>
              <input
                type="time"
                value={appointmentTime}
                onChange={e => setAppointmentTime(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
              />
            </div>
          </div>

          {/* Pagamento e Saldo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
                Incasso Ricevuto (€)
              </label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={payment}
                onChange={e => setPayment(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
                Saldo Dovuto (€)
              </label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={balance}
                onChange={e => setBalance(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
              />
            </div>
          </div>

          {/* Data Ritocco */}
          <div className="p-3.5 bg-stone-800/60 rounded-2xl border border-stone-700/60 space-y-2">
            <label className="block text-xs font-semibold text-rose-300 uppercase tracking-wider">
              Data Ritocco Prevista (Opzionale)
            </label>
            <input
              type="date"
              value={touchUpDate}
              onChange={e => setTouchUpDate(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm"
            />
            {touchUpDate && (
              <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={createTouchUpFollowup}
                  onChange={e => setCreateTouchUpFollowup(e.target.checked)}
                  className="rounded border-stone-700 bg-stone-900 text-rose-500"
                />
                <span>Crea subito appuntamento di ritocco in agenda per quella data</span>
              </label>
            )}
          </div>

          {/* Fonte Contatto */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'The Touch', label: 'The Touch' },
              { id: 'Instagram', label: 'Instagram' },
              { id: 'Privato / Passaparola', label: 'Passaparola' },
            ].map(src => (
              <button
                type="button"
                key={src.id}
                onClick={() => setLeadSource(src.id)}
                className={`py-2 px-2 text-xs font-medium rounded-xl border text-center transition-all ${
                  leadSource === src.id
                    ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                    : 'bg-stone-800 border-stone-700 text-stone-400 hover:text-white'
                }`}
              >
                {src.label}
              </button>
            ))}
          </div>

          {/* Google Calendar Checkbox */}
          <div className="p-3.5 bg-gradient-to-r from-blue-950/30 to-indigo-950/30 border border-blue-900/50 rounded-2xl">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <CalendarIcon className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">Salva su Google Calendar</p>
                  <p className="text-xs text-blue-300/80">Sincronizza automaticamente data, ora e cliente</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={syncGoogleCalendar}
                onChange={e => setSyncGoogleCalendar(e.target.checked)}
                className="w-5 h-5 rounded-md border-blue-700 bg-stone-900 text-blue-500 focus:ring-0 cursor-pointer"
              />
            </label>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
              Note Aggiuntive
            </label>
            <textarea
              rows={2}
              placeholder="Dettagli pelle, pigmenti usati, richieste speciali..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2.5 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex gap-3">
            {initialAppointment && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Eliminare questo appuntamento?')) {
                    onDelete(initialAppointment.id);
                    onClose();
                  }
                }}
                className="px-4 py-3 rounded-xl bg-red-950/60 text-red-300 border border-red-800/60 hover:bg-red-900/60 text-sm font-medium"
              >
                Elimina
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm shadow-lg shadow-rose-900/30 transition-all active:scale-[0.98]"
            >
              {initialAppointment ? 'Salva Modifiche' : 'Aggiungi Appuntamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

