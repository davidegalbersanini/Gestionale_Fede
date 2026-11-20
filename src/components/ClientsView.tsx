'use client';

import React, { useState, useMemo } from 'react';
import { Client, Appointment, WeddingService, GiftVoucher } from '@/types';
import { computeClientTotalSpent, normalizeWhatsAppPhone } from '@/lib/finance';
import ConfirmModal from '@/components/ConfirmModal';
import {
  Users,
  Search,
  Plus,
  Phone,
  Calendar,
  ChevronRight,
  ChevronLeft,
  X,
  History,
  Heart,
  Trash2,
  AlertCircle,
  Gift,
  Pencil,
  Check,
} from 'lucide-react';

interface ClientsViewProps {
  clients: Client[];
  appointments: Appointment[];
  weddings: WeddingService[];
  vouchers?: GiftVoucher[];
  onSaveClient: (clientData: Partial<Client> & { full_name: string; first_name?: string; last_name?: string }) => void;
  onDeleteClient: (id: string) => void;
  onOpenNewAppointmentForClient: (client: Client) => void;
  onOpenNewWeddingForClient: (client: Client) => void;
  onOpenNewVoucherForClient?: (client: Client) => void;
}

const ITEMS_PER_PAGE = 48;

export default function ClientsView({
  clients,
  appointments,
  weddings,
  vouchers = [],
  onSaveClient,
  onDeleteClient,
  onOpenNewAppointmentForClient,
  onOpenNewWeddingForClient,
  onOpenNewVoucherForClient,
}: ClientsViewProps) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  // Edit Client state
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const openEditModal = (client: Client) => {
    let fName = client.first_name || '';
    let lName = client.last_name || '';
    if (!fName && client.full_name) {
      const parts = client.full_name.trim().split(' ');
      fName = parts[0] || '';
      lName = parts.slice(1).join(' ') || '';
    }
    setEditFirstName(fName);
    setEditLastName(lName === '-' ? '' : lName);
    setEditPhone(client.phone || '');
    setEditNotes(client.notes || '');
    setIsEditingClient(true);
  };

  const handleUpdateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    const cleanFirst = editFirstName.trim();
    const cleanLast = editLastName.trim();
    if (!cleanFirst && !cleanLast) return;

    const full_name = cleanLast ? `${cleanFirst} ${cleanLast}`.trim() : cleanFirst;

    onSaveClient({
      id: selectedClient.id,
      first_name: cleanFirst || cleanLast,
      last_name: cleanLast || '-',
      full_name,
      phone: editPhone.trim(),
      notes: editNotes.trim(),
    });

    setSelectedClient(prev =>
      prev
        ? {
            ...prev,
            first_name: cleanFirst || cleanLast,
            last_name: cleanLast || '-',
            full_name,
            phone: editPhone.trim(),
            notes: editNotes.trim(),
          }
        : null
    );

    setIsEditingClient(false);
  };

  const filteredClients = useMemo(() => {
    let list = clients;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = clients.filter(
        c =>
          c.full_name.toLowerCase().includes(q) ||
          (c.first_name && c.first_name.toLowerCase().includes(q)) ||
          (c.last_name && c.last_name.toLowerCase().includes(q)) ||
          (c.phone && c.phone.includes(q)) ||
          (c.notes && c.notes.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) =>
      a.full_name.trim().localeCompare(b.full_name.trim(), 'it', { sensitivity: 'base' })
    );
  }, [clients, search]);

  const clientHistory = useMemo(() => {
    if (!selectedClient) {
      return {
        past: [],
        upcoming: [],
        purchasedVouchers: [] as GiftVoucher[],
        receivedVouchers: [] as GiftVoucher[],
        totalSpent: 0,
        totalCount: 0,
      };
    }

    const cName = selectedClient.full_name.trim().toLowerCase();
    const today = new Date().toISOString();

    const clientPmus = appointments.filter(
      a => a.client_id === selectedClient.id || a.client_name.trim().toLowerCase() === cName
    );

    const clientWeddings = weddings.filter(
      w => w.client_id === selectedClient.id || w.bride_name.trim().toLowerCase() === cName
    );

    const purchasedVouchers = vouchers.filter(
      v => v.buyer_id === selectedClient.id || v.buyer_name.trim().toLowerCase() === cName
    );

    const receivedVouchers = vouchers.filter(
      v =>
        (v.recipient_id === selectedClient.id ||
          (v.recipient_name && v.recipient_name.trim().toLowerCase() === cName)) &&
        v.buyer_id !== selectedClient.id &&
        v.buyer_name.trim().toLowerCase() !== cName
    );

    const past: any[] = [];
    const upcoming: any[] = [];

    const totalSpent = computeClientTotalSpent(clientPmus, clientWeddings, purchasedVouchers);

    clientPmus.forEach(p => {
      const isPast = p.appointment_date < today;
      const item = {
        type: 'pmu',
        date: p.appointment_date,
        title: p.treatment,
        amount: p.payment,
        status: p.status,
        raw: p,
      };
      if (isPast) past.push(item);
      else upcoming.push(item);
    });

    clientWeddings.forEach(w => {
      const isPast = w.wedding_date < today;
      const item = {
        type: 'wedding',
        date: w.wedding_date,
        title: `${w.event_type || 'Matrimonio'} (${w.people_count} pers.)`,
        amount: w.trial_deposit || 0,
        status: w.status,
        raw: w,
      };
      if (isPast) past.push(item);
      else upcoming.push(item);
    });

    past.sort((a, b) => b.date.localeCompare(a.date));
    upcoming.sort((a, b) => a.date.localeCompare(b.date));

    return {
      past,
      upcoming,
      purchasedVouchers,
      receivedVouchers,
      totalSpent,
      totalCount: past.length + upcoming.length,
    };
  }, [selectedClient, appointments, weddings, vouchers]);

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    if (!cleanFirst && !cleanLast) return;

    const full_name = cleanLast ? `${cleanFirst} ${cleanLast}`.trim() : cleanFirst;

    onSaveClient({
      first_name: cleanFirst || cleanLast,
      last_name: cleanLast || '-',
      full_name,
      phone: newPhone.trim(),
      notes: newNotes.trim(),
    });

    setIsAddingClient(false);
    setFirstName('');
    setLastName('');
    setNewPhone('');
    setNewNotes('');
  };

  const whatsappDigits = selectedClient?.phone ? normalizeWhatsAppPhone(selectedClient.phone) : '';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white border border-stone-200 p-4 rounded-3xl">
        <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-rose-500" />
          <span>Rubrica</span>
          <span className="text-xs font-bold text-stone-500 bg-stone-100 px-2.5 py-0.5 rounded-full border border-stone-300">
            {clients.length}
          </span>
        </h1>

        <button
          onClick={() => setIsAddingClient(true)}
          className="px-3.5 py-2 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-rose-200/70 flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Nuovo</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-stone-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Cerca per nome, cognome o telefono..."
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full bg-white border border-stone-200 rounded-2xl pl-11 pr-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
      </div>

      {filteredClients.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between text-xs text-stone-500 px-1">
          <span>
            Mostrati {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredClients.length)} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredClients.length)} di {filteredClients.length} clienti
          </span>
          <span>
            Pagina {currentPage} di {Math.ceil(filteredClients.length / ITEMS_PER_PAGE)}
          </span>
        </div>
      )}

      {/* Client List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredClients.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(c => (
          <div
            key={c.id}
            onClick={() => setSelectedClient(c)}
            className="p-4 rounded-2xl bg-white hover:bg-stone-100 border border-stone-200 transition-all cursor-pointer group flex items-center justify-between"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-50 to-stone-100 border border-stone-300 flex items-center justify-center font-bold text-sm text-rose-600 group-hover:scale-105 transition-transform flex-shrink-0">
                {c.full_name ? c.full_name.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-stone-900 group-hover:text-rose-600 transition-colors truncate">
                  {c.full_name}
                </h3>
                {c.phone ? (
                  <p className="text-stone-500 text-xs flex items-center gap-1 truncate">
                    <Phone className="w-3 h-3 text-stone-500 flex-shrink-0" />
                    {c.phone}
                  </p>
                ) : (
                  <p className="text-stone-500 text-xs italic">Nessun recapito</p>
                )}
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-stone-600 group-hover:text-stone-500 transition-colors flex-shrink-0 ml-2" />
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {Math.ceil(filteredClients.length / ITEMS_PER_PAGE) > 1 && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-stone-200 text-xs sm:text-sm">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-900 font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            Precedente
          </button>

          <span className="text-stone-500 font-medium">
            Pagina <span className="text-stone-900 font-bold">{currentPage}</span> di{' '}
            <span className="text-stone-900 font-bold">{Math.ceil(filteredClients.length / ITEMS_PER_PAGE)}</span>
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredClients.length / ITEMS_PER_PAGE), p + 1))}
            disabled={currentPage >= Math.ceil(filteredClients.length / ITEMS_PER_PAGE)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-900 font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Successiva
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Client Detail Modal */}
      {selectedClient && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/35 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto"
          onClick={e => {
            if (e.target === e.currentTarget) {
              setSelectedClient(null);
              setDeleteErrorMessage(null);
            }
          }}
        >
          <div className="bg-white border border-stone-200 text-stone-900 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="sticky top-0 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-stone-200 flex items-center justify-between z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-500/30 flex items-center justify-center text-rose-600 font-black text-lg flex-shrink-0">
                  {selectedClient.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-stone-900 truncate">{selectedClient.full_name}</h2>
                    <button
                      type="button"
                      onClick={() => openEditModal(selectedClient)}
                      className="p-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-900 transition-colors flex-shrink-0"
                      title="Modifica anagrafica cliente"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-stone-500 text-xs">
                    Totale speso: <span className="font-bold text-emerald-600">{clientHistory.totalSpent}€</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedClient(null);
                  setDeleteErrorMessage(null);
                }}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 flex-shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {deleteErrorMessage && (
              <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-500/50 flex items-start gap-3 animate-fade-in text-amber-800 text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-700">Impossibile eliminare questo contatto</p>
                  <p className="mt-0.5 leading-relaxed text-amber-800">{deleteErrorMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteErrorMessage(null)}
                  className="text-amber-600 hover:text-amber-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="p-6 space-y-5">
              {/* Phone / WhatsApp quick actions */}
              <div className="flex gap-2">
                {selectedClient.phone ? (
                  <>
                    <a
                      href={`tel:${selectedClient.phone}`}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-800 text-xs font-semibold flex items-center justify-center gap-2"
                    >
                      <Phone className="w-3.5 h-3.5 text-rose-600" /> Chiama
                    </a>
                    {whatsappDigits && (
                      <a
                        href={`https://wa.me/${whatsappDigits}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center justify-center gap-2"
                      >
                        WhatsApp
                      </a>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedClient)}
                    className="flex-1 py-2 px-3 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-500 hover:text-stone-900 text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-rose-600" />
                    <span>Aggiungi numero di telefono</span>
                  </button>
                )}
              </div>

              {selectedClient.notes ? (
                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs">
                  <div className="flex items-center justify-between text-stone-500 mb-1">
                    <span className="font-semibold uppercase tracking-wider text-[10px]">Note Cliente</span>
                    <button
                      type="button"
                      onClick={() => openEditModal(selectedClient)}
                      className="text-stone-500 hover:text-stone-900"
                      title="Modifica note"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-stone-800 whitespace-pre-wrap leading-relaxed">{selectedClient.notes}</p>
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    onOpenNewAppointmentForClient(selectedClient);
                    setSelectedClient(null);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-500/40 text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5 text-rose-600" />
                  <span>PMU</span>
                </button>

                <button
                  onClick={() => {
                    onOpenNewWeddingForClient(selectedClient);
                    setSelectedClient(null);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-pink-50 hover:bg-pink-100 border border-pink-500/40 text-pink-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Heart className="w-3.5 h-3.5 text-pink-600" />
                  <span>Evento</span>
                </button>

                {onOpenNewVoucherForClient && (
                  <button
                    onClick={() => {
                      onOpenNewVoucherForClient(selectedClient);
                      setSelectedClient(null);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-500/40 text-amber-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Gift className="w-3.5 h-3.5 text-amber-600" />
                    <span>Buono</span>
                  </button>
                )}
              </div>

              {/* Buoni Acquistati */}
              <div>
                <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5" />
                  Buoni Acquistati ({clientHistory.purchasedVouchers.length})
                </h4>
                {clientHistory.purchasedVouchers.length === 0 ? (
                  <p className="text-xs text-stone-500 italic bg-stone-50 p-3 rounded-xl">
                    Nessun buono acquistato.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {clientHistory.purchasedVouchers.map((v, idx) => {
                      const initVal = v.initial_amount !== undefined ? v.initial_amount : (v.amount || 0);
                      const remVal = v.remaining_amount !== undefined ? v.remaining_amount : (v.is_used ? 0 : initVal);
                      const isFullyUsed = remVal <= 0;
                      const isPartial = remVal > 0 && remVal < initVal;

                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border text-xs flex justify-between items-center ${
                            isFullyUsed
                              ? 'bg-stone-50 border-stone-200 text-stone-500'
                              : isPartial
                              ? 'bg-amber-50 border-amber-500/50 text-amber-800'
                              : 'bg-amber-50/70 border-amber-200 text-amber-800'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-stone-900">Buono</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                  isFullyUsed
                                    ? 'bg-stone-100 text-stone-500'
                                    : isPartial
                                    ? 'bg-amber-100 text-amber-700 border border-amber-500/40'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {isFullyUsed ? 'Utilizzato' : isPartial ? 'Parzialmente Usato' : 'Da Usare'}
                              </span>
                            </div>
                            <p className="text-stone-500 text-[11px] mt-0.5">
                              {v.recipient_name ? `Per: ${v.recipient_name} • ` : 'Beneficiario non specificato • '}
                              {v.purchase_date} {v.notes ? `• ${v.notes}` : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-amber-600 text-sm">{initVal}€</span>
                            {remVal < initVal && (
                              <p className="text-[10px] text-emerald-600 font-semibold">
                                Rimasti: {remVal}€
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Buoni Ricevuti */}
              {clientHistory.receivedVouchers.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-pink-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5" />
                    Buoni Ricevuti ({clientHistory.receivedVouchers.length})
                  </h4>
                  <div className="space-y-2">
                    {clientHistory.receivedVouchers.map((v, idx) => {
                      const initVal = v.initial_amount !== undefined ? v.initial_amount : (v.amount || 0);
                      const remVal = v.remaining_amount !== undefined ? v.remaining_amount : (v.is_used ? 0 : initVal);
                      const isFullyUsed = remVal <= 0;
                      const isPartial = remVal > 0 && remVal < initVal;

                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border text-xs flex justify-between items-center ${
                            isFullyUsed
                              ? 'bg-stone-50 border-stone-200 text-stone-500'
                              : isPartial
                              ? 'bg-pink-50 border-pink-500/50 text-pink-800'
                              : 'bg-pink-50/70 border-pink-800/40 text-pink-800'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-stone-900">Da: {v.buyer_name}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                  isFullyUsed
                                    ? 'bg-stone-100 text-stone-500'
                                    : isPartial
                                    ? 'bg-pink-100 text-pink-700 border border-pink-500/40'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {isFullyUsed ? 'Utilizzato' : isPartial ? 'Parzialmente Usato' : 'Da Usare'}
                              </span>
                            </div>
                            <p className="text-stone-500 text-[11px] mt-0.5">
                              {v.purchase_date} {v.notes ? `• ${v.notes}` : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-pink-600 text-sm">{initVal}€</span>
                            <p className="text-[10px] text-emerald-600 font-semibold">
                              Disponibili: {remVal}€
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* In programma */}
              <div>
                <h4 className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  In programma ({clientHistory.upcoming.length})
                </h4>
                {clientHistory.upcoming.length === 0 ? (
                  <p className="text-xs text-stone-500 italic bg-stone-50 p-3 rounded-xl">
                    Nessun appuntamento futuro.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {clientHistory.upcoming.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-xs flex justify-between items-center">
                        <div>
                          <p className={`font-bold text-stone-900 ${item.status === 'annullato' ? 'line-through text-stone-500' : ''}`}>
                            {item.title}
                          </p>
                          <p className="text-stone-500 text-[11px]">
                            {item.date.slice(0, 10)} {item.status === 'annullato' ? '• Annullato' : ''}
                          </p>
                        </div>
                        <span className={`font-bold ${item.status === 'annullato' ? 'text-stone-500 line-through' : 'text-rose-600'}`}>
                          {item.amount}€
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Storico */}
              <div>
                <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  Storico ({clientHistory.past.length})
                </h4>
                {clientHistory.past.length === 0 ? (
                  <p className="text-xs text-stone-500 italic bg-stone-50 p-3 rounded-xl">
                    Nessun trattamento passato.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {clientHistory.past.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs flex justify-between items-center">
                        <div>
                          <p className={`font-medium text-stone-900 ${item.status === 'annullato' ? 'line-through text-stone-500' : ''}`}>
                            {item.title}
                          </p>
                          <p className="text-stone-500 text-[11px]">
                            {item.date.slice(0, 10)} {item.status === 'annullato' ? '• Annullato' : ''}
                          </p>
                        </div>
                        <span className={`font-semibold ${item.status === 'annullato' ? 'text-stone-500 line-through' : 'text-emerald-600'}`}>
                          {item.amount}€
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Delete Client */}
              <div className="pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => {
                    if (clientHistory.totalCount > 0) {
                      setDeleteErrorMessage(
                        `Impossibile eliminare: ci sono ${clientHistory.totalCount} appuntamenti collegati a questo contatto.`
                      );
                    } else {
                      setClientToDelete(selectedClient);
                    }
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    clientHistory.totalCount > 0
                      ? 'bg-stone-50 text-stone-500 border border-stone-200 hover:border-amber-700/50 hover:text-amber-600 cursor-not-allowed'
                      : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 shadow-sm active:scale-98'
                  }`}
                  title={
                    clientHistory.totalCount > 0
                      ? 'Eliminazione disattivata: ci sono appuntamenti collegati'
                      : 'Elimina contatto'
                  }
                >
                  <Trash2 className="w-4 h-4" />
                  <span>
                    {clientHistory.totalCount > 0
                      ? `Elimina (${clientHistory.totalCount} appuntamenti)`
                      : 'Elimina cliente'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {isAddingClient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/35 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={e => {
            if (e.target === e.currentTarget) setIsAddingClient(false);
          }}
        >
          <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 mb-4">
              <h3 className="text-base font-bold text-stone-900">Nuovo Cliente</h3>
              <button onClick={() => setIsAddingClient(false)} className="text-stone-500 hover:text-stone-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">
                    Nome *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="es. Martina"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2.5 text-stone-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">
                    Cognome
                  </label>
                  <input
                    type="text"
                    placeholder="Opzionale"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2.5 text-stone-900 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">
                  Telefono
                </label>
                <input
                  type="tel"
                  placeholder="es. 340 1234567"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  className="w-full bg-stone-100 border border-stone-300 rounded-xl px-4 py-2.5 text-stone-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">
                  Note
                </label>
                <textarea
                  rows={2}
                  placeholder="Preferenze, allergie, pelle..."
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  className="w-full bg-stone-100 border border-stone-300 rounded-xl px-4 py-2 text-stone-900 text-sm"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddingClient(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-md shadow-rose-200/60"
                >
                  Salva Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {isEditingClient && selectedClient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/35 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={e => {
            if (e.target === e.currentTarget) setIsEditingClient(false);
          }}
        >
          <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 mb-4">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-rose-500" />
                <h3 className="text-base font-bold text-stone-900">Modifica Cliente</h3>
              </div>
              <button onClick={() => setIsEditingClient(false)} className="text-stone-500 hover:text-stone-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateClient} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">
                    Nome *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="es. Martina"
                    value={editFirstName}
                    onChange={e => setEditFirstName(e.target.value)}
                    className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2.5 text-stone-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">
                    Cognome
                  </label>
                  <input
                    type="text"
                    placeholder="Opzionale"
                    value={editLastName}
                    onChange={e => setEditLastName(e.target.value)}
                    className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2.5 text-stone-900 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">
                  Telefono
                </label>
                <input
                  type="tel"
                  placeholder="es. 340 1234567"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  className="w-full bg-stone-100 border border-stone-300 rounded-xl px-4 py-2.5 text-stone-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">
                  Note
                </label>
                <textarea
                  rows={3}
                  placeholder="Preferenze, allergie, pelle..."
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="w-full bg-stone-100 border border-stone-300 rounded-xl px-4 py-2 text-stone-900 text-sm"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditingClient(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-md shadow-rose-200/60 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Salva Modifiche</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(clientToDelete)}
        title="Elimina Cliente"
        message={`Eliminare definitivamente "${clientToDelete?.full_name || ''}" dalla rubrica?`}
        confirmLabel="Elimina"
        onConfirm={() => {
          if (clientToDelete) {
            onDeleteClient(clientToDelete.id);
            setSelectedClient(null);
            setDeleteErrorMessage(null);
          }
          setClientToDelete(null);
        }}
        onCancel={() => setClientToDelete(null)}
      />
    </div>
  );
}
