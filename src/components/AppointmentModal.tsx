'use client';

import React, { useState, useEffect } from 'react';
import { Appointment, Client, Location, GiftVoucher } from '@/types';
import { syncCalendarAutomatically } from '@/lib/calendar';
import { X, Calendar as CalendarIcon, Clock, DollarSign, MapPin, Tag, Sparkles, ExternalLink, Gift, Check } from 'lucide-react';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (appData: Omit<Appointment, 'id'>, createTouchUpFollowup?: boolean) => void;
  onDelete?: (id: string) => void;
  initialAppointment?: Appointment | null;
  clients: Client[];
  locations: Location[];
  vouchers?: GiftVoucher[];
  defaultDate?: string;
  defaultClient?: Client | null;
}

export default function AppointmentModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialAppointment,
  clients,
  locations,
  vouchers = [],
  defaultDate,
  defaultClient,
}: AppointmentModalProps) {
  const [clientName, setClientName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [locationId, setLocationId] = useState(locations[0]?.id || '');
  const [treatment, setTreatment] = useState('Ritocco');
  const [appointmentDate, setAppointmentDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [appointmentTime, setAppointmentTime] = useState('10:00');
  const [appointmentEndTime, setAppointmentEndTime] = useState('12:00');
  const [totalPrice, setTotalPrice] = useState('');
  const [payment, setPayment] = useState('');
  const [touchUpDate, setTouchUpDate] = useState('');
  const [touchUpTime, setTouchUpTime] = useState('10:00');
  const [touchUpEndTime, setTouchUpEndTime] = useState('11:30');
  const [createTouchUpFollowup, setCreateTouchUpFollowup] = useState(true);
  const [notes, setNotes] = useState('');
  const [usedGiftVoucher, setUsedGiftVoucher] = useState(false);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string>('');
  const [voucherDeduction, setVoucherDeduction] = useState<string>('');
  const [syncGoogleCalendar, setSyncGoogleCalendar] = useState(true);

  // Helper to add minutes/hours to HH:mm string
  const addHoursToTime = (timeStr: string, hours: number = 2): string => {
    try {
      const [h, m] = timeStr.split(':').map(Number);
      const totalM = (h || 0) * 60 + (m || 0) + Math.round(hours * 60);
      const finalH = Math.floor(totalM / 60) % 24;
      const finalM = totalM % 60;
      return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
    } catch {
      return '12:00';
    }
  };

  // Treatment presets (strictly PMU)
  const pmuTreatments = [
    'Ritocco',
    'Prima seduta Micro',
    'Prima seduta Sfumatura',
    'Labbra Full Lip',
    'Labbra Contorno & Sfumatura',
    'Combo laminazione',
    'Tatuaggio Fine Line',
    'Infracigliare / Eyeliner',
    'Consulenza PMU'
  ];

  useEffect(() => {
    if (initialAppointment) {
      setClientName(initialAppointment.client_name);
      setSelectedClientId(initialAppointment.client_id);
      setLocationId(initialAppointment.location_id);
      setTreatment(initialAppointment.treatment);
      const [d, t] = initialAppointment.appointment_date.split('T');
      const startT = t ? t.slice(0, 5) : '10:00';
      setAppointmentDate(d || defaultDate || new Date().toISOString().slice(0, 10));
      setAppointmentTime(startT);
      setAppointmentEndTime(initialAppointment.end_time || addHoursToTime(startT, 2));
      
      const existingTotal = initialAppointment.total_price !== undefined
        ? initialAppointment.total_price
        : (initialAppointment.payment || 0) + (initialAppointment.balance || 0);
      setTotalPrice(existingTotal > 0 ? String(existingTotal) : '');
      setPayment(initialAppointment.payment > 0 ? String(initialAppointment.payment) : '');
      setTouchUpDate(initialAppointment.touch_up_date || '');
      setTouchUpTime(initialAppointment.touch_up_time || '10:00');
      setTouchUpEndTime(initialAppointment.touch_up_end_time || '11:30');
      setNotes(initialAppointment.notes || '');
      setUsedGiftVoucher(Boolean(initialAppointment.used_gift_voucher));
      setSelectedVoucherId(initialAppointment.used_gift_voucher_id || '');
      setVoucherDeduction(initialAppointment.used_gift_voucher_amount ? String(initialAppointment.used_gift_voucher_amount) : '');
      setSyncGoogleCalendar(initialAppointment.sync_google_calendar !== false);
    } else {
      if (defaultClient) {
        setClientName(defaultClient.full_name);
        setSelectedClientId(defaultClient.id);
      } else {
        setClientName('');
        setSelectedClientId(undefined);
      }
      setLocationId(locations[0]?.id || '');
      setTreatment('Ritocco');
      setAppointmentDate(defaultDate || new Date().toISOString().slice(0, 10));
      setAppointmentTime('10:00');
      setAppointmentEndTime('12:00');
      setTotalPrice('');
      setPayment('');
      setTouchUpDate('');
      setTouchUpTime('10:00');
      setTouchUpEndTime('11:30');
      setCreateTouchUpFollowup(true);
      setNotes('');
      setUsedGiftVoucher(false);
      setSelectedVoucherId('');
      setVoucherDeduction('');
      setSyncGoogleCalendar(true); // Default checked as requested
    }
  }, [initialAppointment, locations, defaultDate, defaultClient]);

  if (!isOpen) return null;

  const filteredClients = clientName.trim()
    ? clients.filter(c => c.full_name.toLowerCase().includes(clientName.toLowerCase())).slice(0, 5)
    : [];

  const selectedLoc = locations.find(l => l.id === locationId);

  // Available vouchers with remaining amount > 0, plus the currently linked voucher if editing
  const availableVouchers = vouchers.filter(v => {
    if (v.id === initialAppointment?.used_gift_voucher_id) return true;
    return (v.remaining_amount ?? v.amount ?? 0) > 0 && !v.is_used;
  });

  // Recommended vouchers matching current client name/id
  const matchingVouchers = availableVouchers.filter(v => {
    if (!clientName.trim()) return false;
    const nameMatch = v.recipient_name?.toLowerCase().includes(clientName.trim().toLowerCase()) ||
                      v.buyer_name?.toLowerCase().includes(clientName.trim().toLowerCase());
    const idMatch = selectedClientId && (v.recipient_id === selectedClientId || v.buyer_id === selectedClientId);
    return nameMatch || idMatch;
  });

  // Economic calculations:
  const totalNum = parseFloat(totalPrice) || 0;
  const voucherDeductNum = usedGiftVoucher ? (parseFloat(voucherDeduction) || 0) : 0;
  // Maximum cash/card payment acceptable (cannot exceed total minus voucher)
  const maxAcceptablePayment = Math.max(0, totalNum - voucherDeductNum);
  const paymentNum = Math.min(parseFloat(payment) || 0, maxAcceptablePayment);
  // Real-time remaining balance to be collected (cannot go below 0)
  const calculatedBalance = Math.max(0, totalNum - voucherDeductNum - paymentNum);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;

    const fullDateTime = appointmentDate; // Senza orario fittizio
    const fullEndDateTime = appointmentDate;

    const appData: Omit<Appointment, 'id'> = {
      client_id: selectedClientId,
      client_name: clientName.trim(),
      location_id: locationId,
      category: 'pmu',
      treatment: treatment.trim(),
      appointment_date: fullDateTime,
      total_price: totalNum,
      payment: paymentNum,
      balance: calculatedBalance,
      touch_up_date: touchUpDate || null,
      notes: notes.trim(),
      used_gift_voucher: usedGiftVoucher,
      used_gift_voucher_id: usedGiftVoucher && selectedVoucherId ? selectedVoucherId : undefined,
      used_gift_voucher_amount: usedGiftVoucher && voucherDeductNum > 0 ? voucherDeductNum : undefined,
      sync_google_calendar: syncGoogleCalendar,
      status: fullDateTime < new Date().toISOString().slice(0, 10) ? 'completato' : 'programmato',
    };

    // Google Calendar Sync with location address if present
    if (syncGoogleCalendar) {
      const locationString = selectedLoc?.address
        ? `${selectedLoc.name} (${selectedLoc.address})`
        : selectedLoc?.name || '';

      syncCalendarAutomatically({
        eventId: initialAppointment?.google_calendar_event_id,
        title: `PMU: ${clientName.trim()} - ${treatment.trim()}`,
        startDate: fullDateTime,
        endDate: fullEndDateTime,
        location: locationString,
        colorHex: selectedLoc?.color,
        details: `Tipo: Trattamento PMU\nTrattamento: ${treatment}\nOrario: ${appointmentTime} - ${appointmentEndTime}\nTotale Trattamento: ${totalNum}€\nDenaro Ricevuto: ${paymentNum}€\nDa Saldare: ${calculatedBalance}€\nNote: ${notes}`,
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
            <span className="w-3 h-3 rounded-full animate-pulse bg-rose-500" />
            <h2 className="text-lg font-bold text-white">
              {initialAppointment ? 'Modifica PMU' : 'Nuovo PMU'}
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
              Cliente *
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

          {/* Sede di lavoro con indirizzo Google Maps */}
          <div>
            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
              Sede
            </label>
            <div className="grid grid-cols-2 gap-2">
              {locations.map(loc => (
                <button
                  type="button"
                  key={loc.id}
                  onClick={() => setLocationId(loc.id)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-medium border flex items-center justify-center gap-2 transition-all ${
                    locationId === loc.id
                      ? 'bg-rose-600/20 border-rose-500 text-rose-300 shadow-sm'
                      : 'bg-stone-800 border-stone-700 text-stone-400 hover:text-white'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: loc.color }} />
                  <span className="truncate">{loc.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Trattamento / Servizio PMU */}
          <div>
            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
              Trattamento
            </label>
            <input
              type="text"
              required
              value={treatment}
              onChange={e => setTreatment(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2.5 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm mb-2"
            />
            {/* Quick chips PMU */}
            <div className="flex flex-wrap gap-1.5">
              {pmuTreatments.map(t => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTreatment(t)}
                  className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs border border-stone-700/60 active:scale-95 transition-all"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Data Trattamento (senza orari) */}
          <div className="p-4 bg-stone-800/40 rounded-2xl border border-stone-700/50">
            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
              Data *
            </label>
            <input
              type="date"
              required
              value={appointmentDate}
              onChange={e => setAppointmentDate(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
            />
          </div>

          {/* Aspetti Economici: Totale Trattamento (input), Denaro Ricevuto (input), Da saldare (calcolato) */}
          <div className="p-4 bg-stone-800/40 rounded-2xl border border-stone-700/50 space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-rose-300 uppercase tracking-wider mb-1.5">
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
                    // If current payment exceeds the new total (net of voucher), cap payment
                    const newTotal = parseFloat(val) || 0;
                    const maxPay = Math.max(0, newTotal - voucherDeductNum);
                    if ((parseFloat(payment) || 0) > maxPay) {
                      setPayment(maxPay > 0 ? String(maxPay) : '');
                    }
                  }}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2.5 text-white font-bold placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Ricevuto (€)</span>
                  <span className="text-[10px] text-stone-400 font-normal">
                    Max: {maxAcceptablePayment.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}€
                  </span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  max={maxAcceptablePayment}
                  placeholder="0.00"
                  value={payment}
                  onChange={e => {
                    const rawVal = e.target.value;
                    if (rawVal === '') {
                      setPayment('');
                      return;
                    }
                    const numVal = parseFloat(rawVal);
                    if (isNaN(numVal)) {
                      setPayment('');
                      return;
                    }
                    // Prevent entering more money than what is owed
                    if (numVal > maxAcceptablePayment) {
                      setPayment(String(maxAcceptablePayment));
                    } else if (numVal < 0) {
                      setPayment('0');
                    } else {
                      setPayment(rawVal);
                    }
                  }}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2.5 text-white font-bold placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
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

                    // Cap payment so it doesn't exceed (total - voucher)
                    const maxPay = Math.max(0, totalNum - newVoucherDeduct);
                    if ((parseFloat(payment) || 0) > maxPay) {
                      setPayment(maxPay > 0 ? String(maxPay) : '');
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

                          // Cap payment so it doesn't exceed (total - voucher)
                          const maxPay = Math.max(0, totalNum - newVoucherDeduct);
                          if ((parseFloat(payment) || 0) > maxPay) {
                            setPayment(maxPay > 0 ? String(maxPay) : '');
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

                          // Cap payment so it doesn't exceed (total - voucher)
                          const maxPay = Math.max(0, totalNum - validDed);
                          if ((parseFloat(payment) || 0) > maxPay) {
                            setPayment(maxPay > 0 ? String(maxPay) : '');
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
                                Assegna automaticamente a: <strong>{clientName || 'cliente'}</strong>
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
                <span className="text-sm font-black text-amber-300 bg-amber-950/50 px-3 py-1 rounded-xl border border-amber-600/50 shadow-sm">
                  {calculatedBalance.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </span>
              )}
            </div>
          </div>

          {/* Data Ritocco (senza orari) */}
          <div className="p-3.5 bg-stone-800/60 rounded-2xl border border-stone-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-rose-300 uppercase tracking-wider">
                Ritocco (Opzionale)
              </label>
              {touchUpDate && (
                <button
                  type="button"
                  onClick={() => {
                    setTouchUpDate('');
                  }}
                  className="text-[11px] text-stone-400 hover:text-red-400"
                >
                  Rimuovi
                </button>
              )}
            </div>

            <div>
              <label className="block text-[11px] text-stone-400 mb-1">Data</label>
              <input
                type="date"
                value={touchUpDate}
                onChange={e => setTouchUpDate(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-sm"
              />
            </div>

            {touchUpDate && (
              <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={createTouchUpFollowup}
                  onChange={e => setCreateTouchUpFollowup(e.target.checked)}
                  className="rounded border-stone-700 bg-stone-900 text-rose-500"
                />
                <span>Crea ritocco in agenda</span>
              </label>
            )}
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
              placeholder="Dettagli pelle, pigmenti usati..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3.5 py-2 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex gap-3">
            {initialAppointment && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(initialAppointment.id);
                  onClose();
                }}
                className="px-4 py-2.5 rounded-xl bg-red-950/60 text-red-300 border border-red-800/60 hover:bg-red-900/60 text-xs font-medium transition-colors"
              >
                Elimina
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-rose-900/30 transition-all active:scale-[0.98]"
            >
              {initialAppointment ? 'Salva' : 'Aggiungi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
