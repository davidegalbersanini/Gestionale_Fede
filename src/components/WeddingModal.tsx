'use client';

import React, { useState, useEffect } from 'react';
import { WeddingService, Client } from '@/types';
import { openInGoogleCalendar } from '@/lib/calendar';
import { X, Calendar as CalendarIcon, Heart, Sparkles, Users } from 'lucide-react';

interface WeddingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (weddingData: Omit<WeddingService, 'id'>) => void;
  onDelete?: (id: string) => void;
  initialWedding?: WeddingService | null;
  clients: Client[];
}

export default function WeddingModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialWedding,
  clients,
}: WeddingModalProps) {
  const [brideName, setBrideName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [weddingDate, setWeddingDate] = useState(new Date().toISOString().slice(0, 10));
  const [weddingTime, setWeddingTime] = useState('08:30');
  const [trialDate, setTrialDate] = useState('');
  const [trialTime, setTrialTime] = useState('15:00');
  const [peopleCount, setPeopleCount] = useState(1);
  const [trialDeposit, setTrialDeposit] = useState('');
  const [weddingBalance, setWeddingBalance] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [syncGoogleCalendar, setSyncGoogleCalendar] = useState(true);

  useEffect(() => {
    if (initialWedding) {
      setBrideName(initialWedding.bride_name);
      setSelectedClientId(initialWedding.client_id);
      const [wd, wt] = initialWedding.wedding_date.split('T');
      setWeddingDate(wd || new Date().toISOString().slice(0, 10));
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
      setTotalPrice(initialWedding.total_price > 0 ? String(initialWedding.total_price) : '');
      setNotes(initialWedding.notes || '');
      setSyncGoogleCalendar(initialWedding.sync_google_calendar || false);
    } else {
      setBrideName('');
      setSelectedClientId(undefined);
      setWeddingDate(new Date().toISOString().slice(0, 10));
      setWeddingTime('08:30');
      setTrialDate('');
      setTrialTime('15:00');
      setPeopleCount(1);
      setTrialDeposit('');
      setWeddingBalance('');
      setTotalPrice('');
      setNotes('');
      setSyncGoogleCalendar(true);
    }
  }, [initialWedding]);

  if (!isOpen) return null;

  const filteredClients = brideName.trim()
    ? clients.filter(c => c.full_name.toLowerCase().includes(brideName.toLowerCase())).slice(0, 5)
    : [];

  const handlePriceChange = (deposit: string, balanceVal: string) => {
    const dep = parseFloat(deposit) || 0;
    const bal = parseFloat(balanceVal) || 0;
    setTotalPrice(String(dep + bal));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brideName.trim()) return;

    const fullWeddingDateTime = `${weddingDate}T${weddingTime}:00`;
    const fullTrialDateTime = trialDate ? `${trialDate}T${trialTime}:00` : null;

    const depNum = parseFloat(trialDeposit) || 0;
    const balNum = parseFloat(weddingBalance) || 0;
    const totNum = parseFloat(totalPrice) || (depNum + balNum);

    const weddingData: Omit<WeddingService, 'id'> = {
      bride_name: brideName.trim(),
      client_id: selectedClientId,
      wedding_date: fullWeddingDateTime,
      trial_date: fullTrialDateTime,
      people_count: peopleCount,
      trial_deposit: depNum,
      wedding_balance: balNum,
      total_price: totNum,
      notes: notes.trim(),
      sync_google_calendar: syncGoogleCalendar,
      status: fullWeddingDateTime < new Date().toISOString() ? 'completato' : 'programmato',
    };

    // Google Calendar Sync
    if (syncGoogleCalendar) {
      // Event 1: Wedding Day
      openInGoogleCalendar({
        title: `👰 MATRIMONIO: Sposa ${brideName.trim()}`,
        startDate: fullWeddingDateTime,
        details: `Servizio Trucco Sposa\nPersone: ${peopleCount}\nSaldo previsto: ${balNum}€ (Totale: ${totNum}€)\nNote: ${notes}`,
      });

      // Event 2: Trial if set
      if (fullTrialDateTime) {
        setTimeout(() => {
          openInGoogleCalendar({
            title: `💄 Prova Trucco: Sposa ${brideName.trim()}`,
            startDate: fullTrialDateTime,
            details: `Prova trucco per matrimonio del ${weddingDate}\nAcconto prova: ${depNum}€`,
          });
        }, 500);
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
              <Heart className="w-4 h-4 fill-pink-500" />
            </span>
            <h2 className="text-lg font-bold text-white">
              {initialWedding ? 'Modifica Servizio Sposa' : 'Nuovo Servizio Sposa & Makeup'}
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
          {/* Nome Sposa */}
          <div className="relative">
            <label className="block text-xs font-semibold text-pink-300 uppercase tracking-wider mb-1.5">
              Nome della Sposa *
            </label>
            <input
              type="text"
              required
              placeholder="es. Annamaria Rossi"
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

          {/* Data e Ora Matrimonio */}
          <div className="p-4 bg-stone-800/60 rounded-2xl border border-stone-700/60 space-y-3">
            <div className="flex items-center gap-2 text-pink-400 text-xs font-bold uppercase tracking-wider">
              <Heart className="w-3.5 h-3.5" /> Giorno del Matrimonio
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-stone-400 mb-1">Data Matrimonio</label>
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
              Numero di Persone da Truccare (Sposa + invitate)
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

          {/* Aspetti Economici: Prova, Matrimonio, Totale */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs text-stone-400 mb-1 font-medium">Acconto Prova (€)</label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={trialDeposit}
                onChange={e => {
                  setTrialDeposit(e.target.value);
                  handlePriceChange(e.target.value, weddingBalance);
                }}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1 font-medium">Saldo Matr. (€)</label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={weddingBalance}
                onChange={e => {
                  setWeddingBalance(e.target.value);
                  handlePriceChange(trialDeposit, e.target.value);
                }}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-pink-300 mb-1 font-bold">Totale (€)</label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={totalPrice}
                onChange={e => setTotalPrice(e.target.value)}
                className="w-full bg-stone-800 border border-pink-700/60 rounded-xl px-3 py-2 text-pink-300 font-bold text-sm"
              />
            </div>
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
                  <p className="text-xs text-blue-300/80">Sincronizza matrimonio e data prova trucco</p>
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

          {/* Note Sposa */}
          <div>
            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
              Note, Location e Richieste Sposa
            </label>
            <textarea
              rows={2}
              placeholder="Indirizzo preparazione, orario fotografo, stile trucco desiderato..."
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
                  if (confirm('Eliminare questo servizio sposa?')) {
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
              {initialWedding ? 'Salva Modifiche' : 'Aggiungi Sposa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
