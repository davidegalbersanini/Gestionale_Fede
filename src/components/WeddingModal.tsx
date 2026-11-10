'use client';

import React, { useState, useEffect } from 'react';
import { WeddingService, Client, GiftVoucher } from '@/types';
import { syncCalendarAutomatically } from '@/lib/calendar';
import { X, Calendar as CalendarIcon, Heart, Sparkles, Users, MapPin, ExternalLink, Gift, Check } from 'lucide-react';

interface WeddingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (weddingData: Omit<WeddingService, 'id'>) => void;
  onDelete?: (id: string) => void;
  initialWedding?: WeddingService | null;
  clients: Client[];
  vouchers?: GiftVoucher[];
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
  vouchers = [],
  defaultDate,
  defaultClient,
}: WeddingModalProps) {
  const [eventType, setEventType] = useState('Matrimonio');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [address, setAddress] = useState('');
  const [weddingDate, setWeddingDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [weddingTime, setWeddingTime] = useState('08:30');
  const [weddingEndTime, setWeddingEndTime] = useState('11:30');
  const [trialDate, setTrialDate] = useState('');
  const [trialTime, setTrialTime] = useState('15:00');
  const [trialEndTime, setTrialEndTime] = useState('16:30');
  const [peopleCount, setPeopleCount] = useState(1);
  const [totalPrice, setTotalPrice] = useState('');
  const [trialDeposit, setTrialDeposit] = useState('');
  const [notes, setNotes] = useState('');
  const [usedGiftVoucher, setUsedGiftVoucher] = useState(false);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string>('');
  const [voucherDeduction, setVoucherDeduction] = useState<string>('');
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
      const parts = (initialWedding.bride_name || '').trim().split(' ');
      const existingClient = clients.find(c => c.id === initialWedding.client_id || c.full_name === initialWedding.bride_name);
      if (existingClient) {
        setFirstName(existingClient.first_name || parts[0] || '');
        setLastName(existingClient.last_name && existingClient.last_name !== '-' ? existingClient.last_name : parts.slice(1).join(' '));
      } else {
        setFirstName(parts[0] || '');
        setLastName(parts.slice(1).join(' '));
      }
      setSelectedClientId(initialWedding.client_id);
      setAddress(initialWedding.address || '');
      const [wd, wt] = initialWedding.wedding_date.split('T');
      setWeddingDate(wd || defaultDate || new Date().toISOString().slice(0, 10));
      setWeddingTime(wt ? wt.slice(0, 5) : '08:30');
      setWeddingEndTime(initialWedding.end_time || '11:30');
      if (initialWedding.trial_date) {
        const [td, tt] = initialWedding.trial_date.split('T');
        setTrialDate(td || '');
        setTrialTime(tt ? tt.slice(0, 5) : '15:00');
        setTrialEndTime(initialWedding.trial_end_time || '16:30');
      } else {
        setTrialDate('');
        setTrialTime('15:00');
        setTrialEndTime('16:30');
      }
      setPeopleCount(initialWedding.people_count || 1);
      const existingTot = initialWedding.total_price || (initialWedding.trial_deposit + initialWedding.wedding_balance);
      setTotalPrice(existingTot > 0 ? String(existingTot) : '');
      setTrialDeposit(initialWedding.trial_deposit > 0 ? String(initialWedding.trial_deposit) : '');
      setNotes(initialWedding.notes || '');
      setUsedGiftVoucher(Boolean(initialWedding.used_gift_voucher));
      setSelectedVoucherId(initialWedding.used_gift_voucher_id || '');
      setVoucherDeduction(initialWedding.used_gift_voucher_amount ? String(initialWedding.used_gift_voucher_amount) : '');
      setSyncGoogleCalendar(initialWedding.sync_google_calendar !== false);
    } else {
      setEventType('Matrimonio');
      if (defaultClient) {
        setFirstName(defaultClient.first_name || defaultClient.full_name.split(' ')[0] || '');
        setLastName(defaultClient.last_name && defaultClient.last_name !== '-' ? defaultClient.last_name : defaultClient.full_name.split(' ').slice(1).join(' '));
        setSelectedClientId(defaultClient.id);
      } else {
        setFirstName('');
        setLastName('');
        setSelectedClientId(undefined);
      }
      setAddress('');
      setWeddingDate(defaultDate || new Date().toISOString().slice(0, 10));
      setWeddingTime('08:30');
      setWeddingEndTime('11:30');
      setTrialDate('');
      setTrialTime('15:00');
      setTrialEndTime('16:30');
      setPeopleCount(1);
      setTotalPrice('');
      setTrialDeposit('');
      setNotes('');
      setUsedGiftVoucher(false);
      setSelectedVoucherId('');
      setVoucherDeduction('');
      setSyncGoogleCalendar(true); // Default checked as requested
    }
  }, [initialWedding, defaultDate, defaultClient, clients]);

  if (!isOpen) return null;

  const clientSearchQuery = `${firstName} ${lastName}`.trim().toLowerCase();
  const filteredClients = clientSearchQuery
    ? clients
        .filter(c =>
          c.full_name.toLowerCase().includes(clientSearchQuery) ||
          c.first_name.toLowerCase().includes(firstName.trim().toLowerCase()) ||
          (lastName.trim() && c.last_name.toLowerCase().includes(lastName.trim().toLowerCase()))
        )
        .slice(0, 5)
    : [];

  // Economic calculations:
  const totalNum = parseFloat(totalPrice) || 0;
  const voucherDeductNum = usedGiftVoucher ? (parseFloat(voucherDeduction) || 0) : 0;
  // Maximum acceptable cash/deposit payment (cannot exceed total minus voucher)
  const maxAcceptableDeposit = Math.max(0, totalNum - voucherDeductNum);
  const depositNum = Math.min(parseFloat(trialDeposit) || 0, maxAcceptableDeposit);
  // Real-time remaining balance to be collected (cannot go below 0)
  const calculatedBalance = Math.max(0, totalNum - voucherDeductNum - depositNum);

  // Available vouchers with remaining amount > 0, plus the currently linked voucher if editing
  const availableVouchers = vouchers.filter(v => {
    if (v.id === initialWedding?.used_gift_voucher_id) return true;
    return (v.remaining_amount ?? v.amount ?? 0) > 0 && !v.is_used;
  });

  // Recommended vouchers matching current bride/client name/id
  const matchingVouchers = availableVouchers.filter(v => {
    if (!clientSearchQuery) return false;
    const nameMatch = v.recipient_name?.toLowerCase().includes(clientSearchQuery) ||
                      v.buyer_name?.toLowerCase().includes(clientSearchQuery);
    const idMatch = selectedClientId && (v.recipient_id === selectedClientId || v.buyer_id === selectedClientId);
    return nameMatch || idMatch;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const computedFullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const finalBrideName = computedFullName || eventType;
    const fullWeddingDateTime = `${weddingDate}T${weddingTime}:00`;
    const fullTrialDateTime = trialDate ? `${trialDate}T${trialTime}:00` : null;

    const weddingData: Omit<WeddingService, 'id'> = {
      bride_name: finalBrideName,
      client_id: selectedClientId,
      event_type: eventType,
      address: address.trim() || undefined,
      wedding_date: fullWeddingDateTime,
      end_time: weddingEndTime,
      trial_date: fullTrialDateTime,
      trial_end_time: trialDate ? trialEndTime : undefined,
      people_count: peopleCount,
      trial_deposit: depositNum,
      wedding_balance: calculatedBalance,
      total_price: totalNum,
      notes: notes.trim(),
      used_gift_voucher: usedGiftVoucher,
      used_gift_voucher_id: usedGiftVoucher && selectedVoucherId ? selectedVoucherId : undefined,
      used_gift_voucher_amount: usedGiftVoucher && voucherDeductNum > 0 ? voucherDeductNum : undefined,
      sync_google_calendar: syncGoogleCalendar,
      status: fullWeddingDateTime < new Date().toISOString() ? 'completato' : 'programmato',
    };

    // Google Calendar Sync with event address
    if (syncGoogleCalendar) {
      // Event 1: Event/Wedding Day
      syncCalendarAutomatically({
        title: `✨ ${eventType.toUpperCase()}: ${finalBrideName}`,
        startDate: fullWeddingDateTime,
        location: address.trim() || '',
        details: `Tipo: ${eventType}\nCliente: ${finalBrideName}\nPersone da truccare: ${peopleCount}\nIndirizzo/Luogo: ${address || 'Non specificato'}\nTotale Servizio: ${totalNum}€\nAcconto/Ricevuto: ${depositNum}€\nDa saldare: ${calculatedBalance}€\nNote: ${notes}`,
      });

      // Event 2: Trial if set
      if (fullTrialDateTime) {
        syncCalendarAutomatically({
          title: `💄 Prova Trucco: ${finalBrideName} (${eventType})`,
          startDate: fullTrialDateTime,
          location: address.trim() || '',
          details: `Prova trucco per evento del ${weddingDate}\nAcconto prova: ${depositNum}€\nNote: ${notes}`,
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
            <h2 className="text-lg font-bold text-white">
              {initialWedding ? 'Modifica Evento' : 'Nuovo Evento'}
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

          {/* Cliente / Sposa: Nome & Cognome separati con Autocomplete */}
          <div className="relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-pink-300 uppercase tracking-wider mb-1.5">
                  Nome Cliente <span className="text-stone-500 font-normal lowercase">(opzionale)</span>
                </label>
                <input
                  type="text"
                  placeholder="es. Laura"
                  value={firstName}
                  onChange={e => {
                    setFirstName(e.target.value);
                    setSelectedClientId(undefined);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2.5 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-pink-300 uppercase tracking-wider mb-1.5">
                  Cognome <span className="text-stone-500 font-normal lowercase">(opzionale)</span>
                </label>
                <input
                  type="text"
                  placeholder="es. Rossi"
                  value={lastName}
                  onChange={e => {
                    setLastName(e.target.value);
                    setSelectedClientId(undefined);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2.5 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>
            </div>

            {showSuggestions && filteredClients.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-stone-800 border border-stone-700 rounded-xl shadow-xl overflow-hidden z-20">
                {filteredClients.map(c => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => {
                      setFirstName(c.first_name || c.full_name.split(' ')[0] || '');
                      setLastName(c.last_name && c.last_name !== '-' ? c.last_name : c.full_name.split(' ').slice(1).join(' '));
                      setSelectedClientId(c.id);
                      setShowSuggestions(false);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-pink-950/40 text-stone-200 text-sm flex items-center justify-between border-b border-stone-700/50 last:border-0"
                  >
                    <div>
                      <span className="font-bold text-white">{c.first_name || c.full_name}</span>
                      {c.last_name && c.last_name !== '-' && (
                        <span className="text-stone-300 ml-1.5">{c.last_name}</span>
                      )}
                    </div>
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
                <MapPin className="w-3.5 h-3.5 text-rose-400" /> Indirizzo / Location
              </label>
              {address.trim() && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
                >
                  Maps <ExternalLink className="w-3 h-3" />
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
          </div>

          {/* Data e Orari Evento */}
          <div className="p-4 bg-stone-800/60 rounded-2xl border border-stone-700/60 space-y-3">
            <div className="flex items-center gap-2 text-pink-400 text-xs font-bold uppercase tracking-wider">
              <Heart className="w-3.5 h-3.5" /> Evento
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-stone-400 mb-1">Data *</label>
                <input
                  type="date"
                  required
                  value={weddingDate}
                  onChange={e => setWeddingDate(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Inizio</label>
                <input
                  type="time"
                  value={weddingTime}
                  onChange={e => setWeddingTime(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Fine</label>
                <input
                  type="time"
                  value={weddingEndTime}
                  onChange={e => setWeddingEndTime(e.target.value)}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <label className="block text-xs text-stone-400 mb-1">Inizio</label>
                <input
                  type="time"
                  disabled={!trialDate}
                  value={trialTime}
                  onChange={e => setTrialTime(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm disabled:opacity-40"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-400 mb-1">Fine</label>
                <input
                  type="time"
                  disabled={!trialDate}
                  value={trialEndTime}
                  onChange={e => setTrialEndTime(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm disabled:opacity-40"
                />
              </div>
            </div>
          </div>

          {/* Numero Persone */}
          <div>
            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
              Persone da truccare
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

          {/* Aspetti Economici: Totale Servizio (input), Acconto Ricevuto (input), Da saldare (calcolato) */}
          <div className="p-4 bg-stone-800/50 rounded-2xl border border-stone-700/60 space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-pink-300 uppercase tracking-wider mb-1.5">
                  Totale (€)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={totalPrice}
                  onChange={e => {
                    const val = e.target.value;
                    setTotalPrice(val);
                    const newTot = parseFloat(val) || 0;
                    const maxDep = Math.max(0, newTot - voucherDeductNum);
                    if ((parseFloat(trialDeposit) || 0) > maxDep) {
                      setTrialDeposit(maxDep > 0 ? String(maxDep) : '');
                    }
                  }}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Ricevuto (€)</span>
                  <span className="text-[10px] text-stone-400 font-normal">
                    Max: {maxAcceptableDeposit.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}€
                  </span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  max={maxAcceptableDeposit}
                  placeholder="0.00"
                  value={trialDeposit}
                  onChange={e => {
                    const rawVal = e.target.value;
                    if (rawVal === '') {
                      setTrialDeposit('');
                      return;
                    }
                    const numVal = parseFloat(rawVal);
                    if (isNaN(numVal)) {
                      setTrialDeposit('');
                      return;
                    }
                    if (numVal > maxAcceptableDeposit) {
                      setTrialDeposit(String(maxAcceptableDeposit));
                    } else if (numVal < 0) {
                      setTrialDeposit('0');
                    } else {
                      setTrialDeposit(rawVal);
                    }
                  }}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Buono Regalo Checkbox */}
            <div className="pt-2 border-t border-stone-700/60 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={usedGiftVoucher}
                  onChange={e => {
                    const checked = e.target.checked;
                    setUsedGiftVoucher(checked);
                    let newVoucherDeduct = 0;
                    if (checked && !selectedVoucherId && availableVouchers.length > 0) {
                      const bestMatch = matchingVouchers[0] || availableVouchers[0];
                      if (bestMatch) {
                        setSelectedVoucherId(bestMatch.id);
                        const rem = bestMatch.remaining_amount ?? bestMatch.amount;
                        newVoucherDeduct = totalNum > 0 ? Math.min(rem, totalNum) : rem;
                        setVoucherDeduction(String(newVoucherDeduct));
                      }
                    } else if (checked && selectedVoucherId) {
                      const curV = availableVouchers.find(v => v.id === selectedVoucherId);
                      const rem = curV ? (curV.remaining_amount ?? curV.amount) : 0;
                      newVoucherDeduct = totalNum > 0 ? Math.min(rem, totalNum) : rem;
                      setVoucherDeduction(String(newVoucherDeduct));
                    } else {
                      newVoucherDeduct = 0;
                    }

                    // Cap deposit so it doesn't exceed (total - voucher)
                    const maxDep = Math.max(0, totalNum - newVoucherDeduct);
                    if ((parseFloat(trialDeposit) || 0) > maxDep) {
                      setTrialDeposit(maxDep > 0 ? String(maxDep) : '');
                    }
                  }}
                  className="w-4 h-4 rounded border-stone-600 bg-stone-900 text-amber-500 focus:ring-0 cursor-pointer"
                />
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-amber-400" />
                  Usa Buono Regalo
                </span>
              </label>

              {usedGiftVoucher && (
                <div className="pl-6 space-y-2 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-300 mb-1">
                      Seleziona Buono
                    </label>
                    {availableVouchers.length > 0 ? (
                      <select
                        value={selectedVoucherId}
                        onChange={e => {
                          const vId = e.target.value;
                          setSelectedVoucherId(vId);
                          const chosen = availableVouchers.find(v => v.id === vId);
                          let newVoucherDeduct = 0;
                          if (chosen) {
                            const rem = chosen.remaining_amount ?? chosen.amount;
                            newVoucherDeduct = totalNum > 0 ? Math.min(rem, totalNum) : rem;
                            setVoucherDeduction(String(newVoucherDeduct));
                          } else {
                            setVoucherDeduction('');
                          }

                          // Cap deposit so it doesn't exceed (total - voucher)
                          const maxDep = Math.max(0, totalNum - newVoucherDeduct);
                          if ((parseFloat(trialDeposit) || 0) > maxDep) {
                            setTrialDeposit(maxDep > 0 ? String(maxDep) : '');
                          }
                        }}
                        className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">-- Seleziona Buono --</option>
                        {matchingVouchers.length > 0 && (
                          <optgroup label="Suggeriti per cliente">
                            {matchingVouchers.map(v => (
                              <option key={v.id} value={v.id}>
                                #{v.id.slice(-4)} {v.buyer_name} {v.recipient_name ? `→ ${v.recipient_name}` : ''} ({v.remaining_amount ?? v.amount}€)
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Tutti i Buoni">
                          {availableVouchers.map(v => (
                            <option key={v.id} value={v.id}>
                              #{v.id.slice(-4)} {v.buyer_name} {v.recipient_name ? `→ ${v.recipient_name}` : ''} ({v.remaining_amount ?? v.amount}€)
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    ) : (
                      <p className="text-xs text-amber-300/80 italic">
                        Nessun buono con credito residuo.
                      </p>
                    )}
                  </div>

                  {selectedVoucherId && (
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-300 mb-1 flex items-center justify-between">
                        <span>Importo da scalare (€)</span>
                        {(() => {
                          const curV = availableVouchers.find(v => v.id === selectedVoucherId);
                          if (!curV) return null;
                          const rem = curV.remaining_amount ?? curV.amount;
                          const maxApplicable = totalNum > 0 ? Math.min(rem, totalNum) : rem;
                          return (
                            <span className="text-[10px] text-stone-400 font-normal">
                              Max: {maxApplicable}€
                            </span>
                          );
                        })()}
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max={(() => {
                          const curV = availableVouchers.find(v => v.id === selectedVoucherId);
                          if (!curV) return undefined;
                          const rem = curV.remaining_amount ?? curV.amount;
                          return totalNum > 0 ? Math.min(rem, totalNum) : rem;
                        })()}
                        placeholder="0.00"
                        value={voucherDeduction}
                        onChange={e => {
                          const raw = e.target.value;
                          let validDed = 0;
                          if (raw === '') {
                            setVoucherDeduction('');
                            validDed = 0;
                          } else {
                            const num = parseFloat(raw);
                            if (isNaN(num)) {
                              setVoucherDeduction('');
                              validDed = 0;
                            } else {
                              const curV = availableVouchers.find(v => v.id === selectedVoucherId);
                              const rem = curV ? (curV.remaining_amount ?? curV.amount) : Infinity;
                              const maxApplicable = totalNum > 0 ? Math.min(rem, totalNum) : rem;
                              if (num > maxApplicable) {
                                validDed = maxApplicable;
                                setVoucherDeduction(String(maxApplicable));
                              } else if (num < 0) {
                                validDed = 0;
                                setVoucherDeduction('0');
                              } else {
                                validDed = num;
                                setVoucherDeduction(raw);
                              }
                            }
                          }

                          // Cap deposit so it doesn't exceed (total - voucher)
                          const maxDep = Math.max(0, totalNum - validDed);
                          if ((parseFloat(trialDeposit) || 0) > maxDep) {
                            setTrialDeposit(maxDep > 0 ? String(maxDep) : '');
                          }
                        }}
                        className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-amber-500"
                      />
                      {(() => {
                        const curV = availableVouchers.find(v => v.id === selectedVoucherId);
                        if (!curV) return null;
                        const rem = curV.remaining_amount ?? curV.amount;
                        const ded = parseFloat(voucherDeduction) || 0;
                        const left = Math.max(0, rem - ded);
                        return (
                          <p className="text-[10px] text-stone-400 mt-1">
                            Residuo attuale: <strong className="text-amber-400">{rem}€</strong> • Dopo: <strong className="text-emerald-400">{left}€</strong>
                            {!curV.recipient_name && (
                              <span className="block text-indigo-300 mt-0.5">
                                Assegna automaticamente a: <strong>{`${firstName} ${lastName}`.trim() || 'cliente'}</strong>
                              </span>
                            )}
                          </p>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Read-only Display: Da saldare (o Completamente saldato) */}
            <div className="pt-2.5 border-t border-stone-700/60 flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                Da saldare:
              </span>
              {calculatedBalance <= 0 ? (
                <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-800/60 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Saldato
                </span>
              ) : (
                <span className="text-sm font-black text-amber-300 bg-amber-950/50 px-3.5 py-1 rounded-xl border border-amber-600/50 shadow-sm">
                  {calculatedBalance.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </span>
              )}
            </div>
          </div>

          {/* Google Calendar Checkbox */}
          <div className="p-3 bg-blue-950/20 border border-blue-900/40 rounded-2xl">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <CalendarIcon className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-semibold text-white">Sincronizza Google Calendar</span>
              </div>
              <input
                type="checkbox"
                checked={syncGoogleCalendar}
                onChange={e => setSyncGoogleCalendar(e.target.checked)}
                className="w-4 h-4 rounded border-blue-700 bg-stone-900 text-blue-500 focus:ring-0 cursor-pointer"
              />
            </label>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1">
              Note
            </label>
            <textarea
              rows={2}
              placeholder="Orari, location, richieste speciali..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
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
                className="px-4 py-2.5 rounded-xl bg-red-950/60 text-red-300 border border-red-800/60 hover:bg-red-900/60 text-xs font-medium"
              >
                Elimina
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-pink-900/30 transition-all active:scale-[0.98]"
            >
              {initialWedding ? 'Salva' : 'Aggiungi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
