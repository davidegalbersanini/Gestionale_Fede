'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Appointment, AppointmentStatus, Client, Location, GiftVoucher, ServicePrice } from '@/types';
import ClientAutocomplete from '@/components/ClientAutocomplete';
import GiftVoucherSection from '@/components/GiftVoucherSection';
import { X, Calendar as CalendarIcon, Clock, Sparkles, Check } from 'lucide-react';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (appData: Omit<Appointment, 'id'>, createTouchUpFollowup?: boolean) => void;
  onDelete?: (id: string) => void;
  initialAppointment?: Appointment | null;
  clients: Client[];
  locations: Location[];
  servicePrices?: ServicePrice[];
  vouchers?: GiftVoucher[];
  defaultDate?: string;
  defaultClient?: Client | null;
}

const PMU_TREATMENTS = [
  'Ritocco',
  'Prima seduta Micro',
  'Prima seduta Sfumatura',
  'Labbra Full Lip',
  'Labbra Contorno & Sfumatura',
  'Combo laminazione',
  'Tatuaggio Fine Line',
  'Infracigliare / Eyeliner',
  'Consulenza PMU',
];

function addHoursToTime(timeStr: string, hours: number = 2): string {
  try {
    const [h, m] = timeStr.split(':').map(Number);
    const totalM = (h || 0) * 60 + (m || 0) + Math.round(hours * 60);
    const finalH = Math.floor(totalM / 60) % 24;
    const finalM = totalM % 60;
    return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
  } catch {
    return '12:00';
  }
}

export default function AppointmentModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialAppointment,
  clients,
  locations,
  servicePrices = [],
  vouchers = [],
  defaultDate,
  defaultClient,
}: AppointmentModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
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
  const [status, setStatus] = useState<AppointmentStatus>('programmato');

  const clientsRef = useRef(clients);
  clientsRef.current = clients;
  const locationsRef = useRef(locations);
  locationsRef.current = locations;

  useEffect(() => {
    if (!isOpen) return;

    const currentClients = clientsRef.current;
    const currentLocations = locationsRef.current;

    if (initialAppointment) {
      const parts = (initialAppointment.client_name || '').trim().split(' ');
      const existingClient = currentClients.find(
        c => c.id === initialAppointment.client_id || c.full_name === initialAppointment.client_name
      );
      if (existingClient) {
        setFirstName(existingClient.first_name || parts[0] || '');
        setLastName(
          existingClient.last_name && existingClient.last_name !== '-'
            ? existingClient.last_name
            : parts.slice(1).join(' ')
        );
      } else {
        setFirstName(parts[0] || '');
        setLastName(parts.slice(1).join(' '));
      }
      setSelectedClientId(initialAppointment.client_id);
      setLocationId(initialAppointment.location_id);
      setTreatment(initialAppointment.treatment);
      const [d, t] = initialAppointment.appointment_date.split('T');
      const startT = t ? t.slice(0, 5) : '10:00';
      setAppointmentDate(d || defaultDate || new Date().toISOString().slice(0, 10));
      setAppointmentTime(startT);
      setAppointmentEndTime(initialAppointment.end_time || addHoursToTime(startT, 2));

      const existingTotal =
        initialAppointment.total_price !== undefined
          ? initialAppointment.total_price
          : (initialAppointment.payment || 0) + (initialAppointment.balance || 0);
      setTotalPrice(existingTotal > 0 ? String(existingTotal) : '');
      setPayment(initialAppointment.payment > 0 ? String(initialAppointment.payment) : '');
      setTouchUpDate(initialAppointment.touch_up_date || '');
      setTouchUpTime(initialAppointment.touch_up_time || '10:00');
      setTouchUpEndTime(initialAppointment.touch_up_end_time || '11:30');
      setCreateTouchUpFollowup(false);
      setNotes(initialAppointment.notes || '');
      setUsedGiftVoucher(Boolean(initialAppointment.used_gift_voucher));
      setSelectedVoucherId(initialAppointment.used_gift_voucher_id || '');
      setVoucherDeduction(
        initialAppointment.used_gift_voucher_amount
          ? String(initialAppointment.used_gift_voucher_amount)
          : ''
      );
      setSyncGoogleCalendar(initialAppointment.sync_google_calendar !== false);
      setStatus(initialAppointment.status || 'programmato');
    } else {
      if (defaultClient) {
        setFirstName(defaultClient.first_name || defaultClient.full_name.split(' ')[0] || '');
        setLastName(
          defaultClient.last_name && defaultClient.last_name !== '-'
            ? defaultClient.last_name
            : defaultClient.full_name.split(' ').slice(1).join(' ')
        );
        setSelectedClientId(defaultClient.id);
      } else {
        setFirstName('');
        setLastName('');
        setSelectedClientId(undefined);
      }
      setLocationId(currentLocations[0]?.id || '');
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
      setSyncGoogleCalendar(true);
      setStatus('programmato');
    }
  }, [isOpen, initialAppointment, defaultDate, defaultClient]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const clientSearchQuery = `${firstName} ${lastName}`.trim().toLowerCase();
  const computedDisplayName = `${firstName} ${lastName}`.trim();

  // Economic calculations
  const totalNum = parseFloat(totalPrice) || 0;
  const voucherDeductNum = usedGiftVoucher ? parseFloat(voucherDeduction) || 0 : 0;
  const maxAcceptablePayment = Math.max(0, totalNum - voucherDeductNum);
  const paymentNum = Math.min(parseFloat(payment) || 0, maxAcceptablePayment);
  const calculatedBalance = Math.max(0, totalNum - voucherDeductNum - paymentNum);

  const capPaymentForDeduction = (nextDedStr: string) => {
    setVoucherDeduction(nextDedStr);
    const validDed = parseFloat(nextDedStr) || 0;
    const maxPay = Math.max(0, totalNum - validDed);
    if ((parseFloat(payment) || 0) > maxPay) {
      setPayment(maxPay > 0 ? String(maxPay) : '');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) return;

    const computedFullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const fullDateTime = appointmentTime ? `${appointmentDate}T${appointmentTime}:00` : appointmentDate;
    const computedStatus: AppointmentStatus = initialAppointment
      ? status
      : fullDateTime < new Date().toISOString()
      ? 'completato'
      : 'programmato';

    const appData: Omit<Appointment, 'id'> = {
      client_id: selectedClientId,
      client_name: computedFullName,
      location_id: locationId,
      category: initialAppointment?.category || 'pmu',
      treatment: treatment.trim(),
      appointment_date: fullDateTime,
      end_time: appointmentEndTime || undefined,
      total_price: totalNum,
      payment: paymentNum,
      balance: calculatedBalance,
      touch_up_date: touchUpDate || null,
      touch_up_time: touchUpDate && touchUpTime ? touchUpTime : undefined,
      touch_up_end_time: touchUpDate && touchUpEndTime ? touchUpEndTime : undefined,
      notes: notes.trim(),
      used_gift_voucher: usedGiftVoucher && Boolean(selectedVoucherId),
      used_gift_voucher_id: usedGiftVoucher && selectedVoucherId ? selectedVoucherId : undefined,
      used_gift_voucher_amount:
        usedGiftVoucher && selectedVoucherId && voucherDeductNum > 0 ? voucherDeductNum : undefined,
      sync_google_calendar: syncGoogleCalendar,
      status: computedStatus,
    };

    const shouldCreateFollowup =
      Boolean(touchUpDate) &&
      !initialAppointment?.linked_appointment_id &&
      createTouchUpFollowup;

    onSave(appData, shouldCreateFollowup);
    onClose();
  };

  const locServices = servicePrices.filter(sp => sp.location_id === locationId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/35 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-stone-200 text-stone-900 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-stone-200 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-rose-600 fill-rose-500/30" />
            </span>
            <h2 className="text-lg font-bold text-stone-900">
              {initialAppointment ? 'Modifica PMU' : 'Nuovo PMU'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Cliente: Nome & Cognome separati con Autocomplete */}
          <ClientAutocomplete
            clients={clients}
            firstName={firstName}
            lastName={lastName}
            onFirstNameChange={val => {
              setFirstName(val);
              setSelectedClientId(undefined);
            }}
            onLastNameChange={val => {
              setLastName(val);
              setSelectedClientId(undefined);
            }}
            onSelectClient={c => {
              setFirstName(c.first_name || c.full_name.split(' ')[0] || '');
              setLastName(
                c.last_name && c.last_name !== '-'
                  ? c.last_name
                  : c.full_name.split(' ').slice(1).join(' ')
              );
              setSelectedClientId(c.id);
            }}
            firstNameRequired
            firstNameLabel="Nome *"
            lastNameLabel={
              <>
                Cognome <span className="text-stone-500 font-normal lowercase">(opzionale)</span>
              </>
            }
            accent="rose"
          />

          {/* Sede di lavoro */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
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
                      ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm'
                      : 'bg-stone-100 border-stone-300 text-stone-500 hover:text-stone-900'
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Trattamento *
              </label>
              {locServices.length > 0 && (
                <span className="text-[10px] text-stone-500">
                  {locServices.length} dal listino
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={treatment}
              onChange={e => setTreatment(e.target.value)}
              className="w-full bg-stone-100 border border-stone-300 rounded-xl px-4 py-2.5 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm mb-2"
            />

            <div className="flex flex-wrap gap-1.5">
              {locServices.length > 0
                ? locServices.map(srv => (
                    <button
                      type="button"
                      key={srv.id}
                      onClick={() => {
                        setTreatment(srv.name);
                        const curTotal = parseFloat(totalPrice) || 0;
                        if (curTotal === 0 && srv.price > 0) {
                          setTotalPrice(String(srv.price));
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 text-xs border border-stone-200 active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <span>{srv.name}</span>
                      <span className="text-[11px] font-bold text-emerald-600">{srv.price}€</span>
                    </button>
                  ))
                : PMU_TREATMENTS.map(t => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setTreatment(t)}
                      className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs border border-stone-200 active:scale-95 transition-all"
                    >
                      {t}
                    </button>
                  ))}
            </div>
          </div>

          {/* Data e Orari Trattamento */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                  Data *
                </label>
                <input
                  type="date"
                  required
                  value={appointmentDate}
                  onChange={e => setAppointmentDate(e.target.value)}
                  className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-rose-600" />
                  Inizio
                </label>
                <input
                  type="time"
                  value={appointmentTime}
                  onChange={e => {
                    const newStart = e.target.value;
                    setAppointmentTime(newStart);
                    if (newStart) {
                      setAppointmentEndTime(addHoursToTime(newStart, 2));
                    }
                  }}
                  className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-stone-500" />
                  Fine
                </label>
                <input
                  type="time"
                  value={appointmentEndTime}
                  onChange={e => setAppointmentEndTime(e.target.value)}
                  className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Stato appuntamento (in modifica) */}
          {initialAppointment && (
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                Stato Appuntamento
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'programmato', label: 'Programmato', activeClass: 'bg-sky-50 border-sky-500 text-sky-700' },
                    { id: 'completato', label: 'Completato', activeClass: 'bg-emerald-50 border-emerald-500 text-emerald-700' },
                    { id: 'annullato', label: 'Annullato', activeClass: 'bg-red-50 border-red-500 text-red-700' },
                  ] as const
                ).map(opt => (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setStatus(opt.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      status === opt.id
                        ? opt.activeClass
                        : 'bg-stone-100 border-stone-300 text-stone-500 hover:text-stone-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Aspetti Economici */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-rose-700 uppercase tracking-wider mb-1.5">
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
                    const newTotal = parseFloat(val) || 0;
                    const maxPay = Math.max(0, newTotal - voucherDeductNum);
                    if ((parseFloat(payment) || 0) > maxPay) {
                      setPayment(maxPay > 0 ? String(maxPay) : '');
                    }
                  }}
                  className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2.5 text-stone-900 font-bold placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Ricevuto (€)</span>
                  <span className="text-[10px] text-stone-500 font-normal">
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
                    if (numVal > maxAcceptablePayment) {
                      setPayment(String(maxAcceptablePayment));
                    } else if (numVal < 0) {
                      setPayment('0');
                    } else {
                      setPayment(rawVal);
                    }
                  }}
                  className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2.5 text-stone-900 font-bold placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
            </div>

            <GiftVoucherSection
              vouchers={vouchers}
              usedGiftVoucher={usedGiftVoucher}
              selectedVoucherId={selectedVoucherId}
              voucherDeduction={voucherDeduction}
              totalNum={totalNum}
              clientSearchQuery={clientSearchQuery}
              selectedClientId={selectedClientId}
              clientDisplayName={computedDisplayName}
              previouslyUsedVoucherId={initialAppointment?.used_gift_voucher_id}
              previouslyUsedAmount={initialAppointment?.used_gift_voucher_amount}
              onChangeUsed={setUsedGiftVoucher}
              onChangeVoucherId={setSelectedVoucherId}
              onChangeDeduction={capPaymentForDeduction}
            />

            {/* Da saldare */}
            <div className="pt-2.5 border-t border-stone-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                Da saldare:
              </span>
              {calculatedBalance <= 0 ? (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Saldato
                </span>
              ) : (
                <span className="text-sm font-black text-amber-700 bg-amber-50 px-3 py-1 rounded-xl border border-amber-300 shadow-sm">
                  {calculatedBalance.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </span>
              )}
            </div>
          </div>

          {/* Data e Orari Ritocco */}
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-rose-700 uppercase tracking-wider">
                Ritocco (Opzionale)
              </label>
              {touchUpDate && (
                <button
                  type="button"
                  onClick={() => setTouchUpDate('')}
                  className="text-[11px] text-stone-500 hover:text-red-600"
                >
                  Rimuovi
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Data</label>
                <input
                  type="date"
                  value={touchUpDate}
                  onChange={e => setTouchUpDate(e.target.value)}
                  className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] text-stone-500 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-rose-600" />
                  Inizio
                </label>
                <input
                  type="time"
                  disabled={!touchUpDate}
                  value={touchUpTime}
                  onChange={e => {
                    const newStart = e.target.value;
                    setTouchUpTime(newStart);
                    if (newStart) {
                      setTouchUpEndTime(addHoursToTime(newStart, 1.5));
                    }
                  }}
                  className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 text-sm disabled:opacity-40"
                />
              </div>
              <div>
                <label className="block text-[11px] text-stone-500 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-stone-500" />
                  Fine
                </label>
                <input
                  type="time"
                  disabled={!touchUpDate}
                  value={touchUpEndTime}
                  onChange={e => setTouchUpEndTime(e.target.value)}
                  className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 text-sm disabled:opacity-40"
                />
              </div>
            </div>

            {touchUpDate && !initialAppointment?.linked_appointment_id && (
              <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={createTouchUpFollowup}
                  onChange={e => setCreateTouchUpFollowup(e.target.checked)}
                  className="rounded border-stone-300 bg-white text-rose-500"
                />
                <span>Crea ritocco in agenda con questi orari</span>
              </label>
            )}
          </div>

          {/* Google Calendar Checkbox */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-blue-100 border border-blue-500/30 flex items-center justify-center text-blue-600">
                  <CalendarIcon className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-semibold text-stone-900">Sincronizza Google Calendar</span>
              </div>
              <input
                type="checkbox"
                checked={syncGoogleCalendar}
                onChange={e => setSyncGoogleCalendar(e.target.checked)}
                className="w-4 h-4 rounded border-blue-300 bg-white text-blue-500 focus:ring-0 cursor-pointer"
              />
            </label>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
              Note
            </label>
            <textarea
              rows={2}
              placeholder="Dettagli pelle, pigmenti usati..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3.5 py-2 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
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
                className="px-4 py-2.5 rounded-xl bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 text-xs font-medium transition-colors"
              >
                Elimina
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-rose-200/60 transition-all active:scale-[0.98]"
            >
              {initialAppointment ? 'Salva' : 'Aggiungi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
