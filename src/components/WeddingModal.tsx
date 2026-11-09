'use client';

import React, { useState, useEffect } from 'react';
import { WeddingService, Client } from '@/types';
import { syncCalendarAutomatically } from '@/lib/calendar';
import { X, Calendar as CalendarIcon, Heart, Sparkles, Users, MapPin, ExternalLink } from 'lucide-react';

interface WeddingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (weddingData: Omit<WeddingService, 'id'>) => void;
  onDelete?: (id: string) => void;
  initialWedding?: WeddingService | null;
  clients: Client[];
  defaultDate?: string;
  defaultClient?: Client | null;
}

export default function WeddingModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialWedding,
  clients,
  defaultDate,
  defaultClient,
}: WeddingModalProps) {
  const [eventType, setEventType] = useState('Matrimonio');
  const [brideName, setBrideName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [address, setAddress] = useState('');
  const [weddingDate, setWeddingDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [weddingTime, setWeddingTime] = useState('08:30');
  const [trialDate, setTrialDate] = useState('');
  const [trialTime, setTrialTime] = useState('15:00');
  const [peopleCount, setPeopleCount] = useState(1);
  const [trialDeposit, setTrialDeposit] = useState('');
  const [weddingBalance, setWeddingBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [syncGoogleCalendar, setSyncGoogleCalendar] = useState(true);

  const eventTypes = [
    'Matrimonio',
    'Cerimonia / Testimone',
    'Festa Privata',
    'Shooting / Editoriale',
    'Altro Evento Makeup'
  ];

  useEffect(() => {
    if (initialWedding) {
      setEventType(initialWedding.event_type || 'Matrimonio');
      setBrideName(initialWedding.bride_name);
      setSelectedClientId(initialWedding.client_id);
      setAddress(initialWedding.address || '');
      const [wd, wt] = initialWedding.wedding_date.split('T');
      setWeddingDate(wd || defaultDate || new Date().toISOString().slice(0, 10));
      setWeddingTime(wt ? wt.slice(0, 5) : '08:30');
      if (initialWedding.trial_date) {
        const [td, tt] = initialWedding.trial_date.split('T');
        setTrialDate(td || '');
        setTrialTime(tt ? tt.slice(0, 5) : '15:00');
      } else {
        setTrialDate('');
        setTrialTime('15:00');
      }
      setPeopleCount(initialWedding.people_count || 1);
      setTrialDeposit(initialWedding.trial_deposit > 0 ? String(initialWedding.trial_deposit) : '');
      setWeddingBalance(initialWedding.wedding_balance > 0 ? String(initialWedding.wedding_balance) : '');
      setNotes(initialWedding.notes || '');
      setSyncGoogleCalendar(initialWedding.sync_google_calendar !== false);
    } else {
      setEventType('Matrimonio');
      if (defaultClient) {
        setBrideName(defaultClient.full_name);
        setSelectedClientId(defaultClient.id);
      } else {
        setBrideName('');
        setSelectedClientId(undefined);
      }
      setAddress('');
      setWeddingDate(defaultDate || new Date().toISOString().slice(0, 10));
      setWeddingTime('08:30');
      setTrialDate('');
      setTrialTime('15:00');
      setPeopleCount(1);
      setTrialDeposit('');
      setWeddingBalance('');
      setNotes('');
      setSyncGoogleCalendar(true); // Default checked as requested
    }
  }, [initialWedding, defaultDate, defaultClient]);

  if (!isOpen) return null;

  const filteredClients = brideName.trim()
    ? clients.filter(c => c.full_name.toLowerCase().includes(brideName.toLowerCase())).slice(0, 5)
    : [];

  // Read-only calculated total (trial deposit + wedding balance)
  const depNum = parseFloat(trialDeposit) || 0;
  const balNum = parseFloat(weddingBalance) || 0;
  const totalCalculated = depNum + balNum;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brideName.trim()) return;

    const fullWeddingDateTime = `${weddingDate}T${weddingTime}:00`;
    const fullTrialDateTime = trialDate ? `${trialDate}T${trialTime}:00` : null;

    const weddingData: Omit<WeddingService, 'id'> = {
      bride_name: brideName.trim(),
      client_id: selectedClientId,
      event_type: eventType,
      address: address.trim() || undefined,
      wedding_date: fullWeddingDateTime,
      trial_date: fullTrialDateTime,
      people_count: peopleCount,
      trial_deposit: depNum,
      wedding_balance: balNum,
      total_price: totalCalculated,
      notes: notes.trim(),
      sync_google_calendar: syncGoogleCalendar,
      status: fullWeddingDateTime < new Date().toISOString() ? 'completato' : 'programmato',
    };

    // Google Calendar Sync with event address
    if (syncGoogleCalendar) {
      // Event 1: Event/Wedding Day
      syncCalendarAutomatically({
        title: `✨ ${eventType.toUpperCase()}: ${brideName.trim()}`,
        startDate: fullWeddingDateTime,
        location: address.trim() || '',
        details: `Tipo: ${eventType}\nCliente: ${brideName}\nPersone da truccare: ${peopleCount}\nIndirizzo/Luogo: ${address || 'Non specificato'}\nAcconto versato: ${depNum}€ | Saldo: ${balNum}€ (Totale: ${totalCalculated}€)\nNote: ${notes}`,
      });

      // Event 2: Trial if set
      if (fullTrialDateTime) {
        syncCalendarAutomatically({
          title: `💄 Prova Trucco: ${brideName.trim()} (${eventType})`,
          startDate: fullTrialDateTime,
          location: address.trim() || '',
          details: `Prova trucco per evento del ${weddingDate}\nAcconto prova: ${depNum}€\nNote: ${notes}`,
        });
      }
    }

    onSave(weddingData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-stone-900/95 backdrop-blur-md px-6 py-4 border-b border-stone-800 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4 fill-pink-500" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">
                {initialWedding ? 'Modifica Servizio Evento' : 'Nuovo Servizio Evento & Makeup'}
              </h2>
              <p className="text-[11px] text-stone-400">Matrimoni, cerimonie, feste e servizi trucco</p>
            </div>
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
          {/* Tipologia Evento */}
          <div>
            <label className="block text-xs font-semibold text-pink-300 uppercase tracking-wider mb-1.5">
              Tipo di Evento
            </label>
            <div className="flex flex-wrap gap-1.5">
              {eventTypes.map(t => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setEventType(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    eventType === t
                      ? 'bg-pink-600/30 border-pink-500 text-pink-300 shadow-sm'
                      : 'bg-stone-800 border-stone-700 text-stone-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Nome Cliente / Sposa */}
          <div className="relative">
            <label className="block text-xs font-semibold text-pink-300 uppercase tracking-wider mb-1.5">
              Nome Cliente / Referente Evento *
            </label>
            <input
              type="text"
              required
              placeholder="es. Laura Brambilla"
              value={brideName}
              onChange={e => {
                setBrideName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-pink-500 text-base"
            />
            {showSuggestions && filteredClients.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-stone-800 border border-stone-700 rounded-xl shadow-xl overflow-hidden z-20">
                {filteredClients.map(c => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => {
                      setBrideName(c.full_name);
                      setSelectedClientId(c.id);
                      setShowSuggestions(false);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-pink-950/40 text-stone-200 text-sm flex items-center justify-between border-b border-stone-700/50 last:border-0"
                  >
                    <span className="font-medium text-white">{c.full_name}</span>
                    {c.phone && <span className="text-stone-400 text-xs">{c.phone}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Indirizzo Evento / Domicilio Cliente (Google Maps) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-400" /> Indirizzo Evento / Domicilio Cliente
              </label>
              {address.trim() && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
                >
                  Apri su Maps <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <input
              type="text"
              placeholder="es. Via Roma 24, Legnano / Villa Carminati..."
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2.5 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
            />
            <p className="text-[11px] text-stone-500 mt-1">
              Verrà salvato sull&apos;evento del calendario e sarà cliccabile su Google Maps
            </p>
          </div>

          {/* Data e Ora Evento */}
          <div className="p-4 bg-stone-800/60 rounded-2xl border border-stone-700/60 space-y-3">
            <div className="flex items-center gap-2 text-pink-400 text-xs font-bold uppercase tracking-wider">
              <Heart className="w-3.5 h-3.5" /> Giorno dell&apos;Evento
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-stone-400 mb-1">Data Evento</label>
                <input
                  type="date"
                  required
                  value={weddingDate}
                  onChange={e => setWeddingDate(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Orario Inizio</label>
                <input
                  type="time"
                  value={weddingTime}
                  onChange={e => setWeddingTime(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
          </div>

          {/* Prova Trucco */}
          <div className="p-4 bg-stone-800/40 rounded-2xl border border-stone-700/40 space-y-3">
            <div className="flex items-center gap-2 text-stone-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Prova Trucco (Opzionale)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-stone-400 mb-1">Data Prova</label>
                <input
                  type="date"
                  value={trialDate}
                  onChange={e => setTrialDate(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Orario Prova</label>
                <input
                  type="time"
                  value={trialTime}
                  onChange={e => setTrialTime(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
          </div>

          {/* Numero Persone */}
          <div>
            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
              Numero di Persone da Truccare (Cliente + invitate)
            </label>
            <div className="flex items-center gap-3">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setPeopleCount(n)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    peopleCount === n
                      ? 'bg-pink-600/30 border-pink-500 text-pink-300 shadow-sm'
                      : 'bg-stone-800 border-stone-700 text-stone-400 hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Aspetti Economici: Acconto, Saldo e Totale NON Modificabile */}
          <div className="p-4 bg-stone-800/50 rounded-2xl border border-stone-700/60 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-stone-300 mb-1 font-medium">Acconto Ricevuto (€)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={trialDeposit}
                  onChange={e => setTrialDeposit(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-300 mb-1 font-medium">Saldo Rimanente (€)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={weddingBalance}
                  onChange={e => setWeddingBalance(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm"
                />
              </div>
            </div>

            {/* Read-only calculated total */}
            <div className="pt-2 border-t border-stone-700/60 flex items-center justify-between">
              <span className="text-xs font-semibold text-pink-300 uppercase tracking-wider">
                Totale Servizio (Ricevuto + Saldo):
              </span>
              <span className="text-base font-black text-pink-300 bg-pink-950/40 px-3 py-1 rounded-xl border border-pink-800/50">
                {totalCalculated.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            </div>
          </div>

          {/* Google Calendar Checkbox (Defaulted to checked) */}
          <div className="p-3.5 bg-gradient-to-r from-blue-950/30 to-indigo-950/30 border border-blue-900/50 rounded-2xl">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <CalendarIcon className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">Salva su Google Calendar</p>
                  <p className="text-xs text-blue-300/80">Sincronizza evento, indirizzo e prova trucco</p>
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
              Note, Location e Richieste Speciali
            </label>
            <textarea
              rows={2}
              placeholder="Orario fotografo, stile trucco desiderato, accordi speciali..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2.5 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex gap-3">
            {initialWedding && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Eliminare questo servizio evento?')) {
                    onDelete(initialWedding.id);
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
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-semibold text-sm shadow-lg shadow-pink-900/30 transition-all active:scale-[0.98]"
            >
              {initialWedding ? 'Salva Modifiche' : 'Aggiungi Evento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
