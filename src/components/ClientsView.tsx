'use client';

import React, { useState, useMemo } from 'react';
import { Client, Appointment, WeddingService, GiftVoucher } from '@/types';
import {
  Users,
  Search,
  Plus,
  Phone,
  Calendar,
  Clock,
  ChevronRight,
  X,
  History,
  Sparkles,
  Heart,
  DollarSign,
  Trash2,
  AlertCircle,
  Gift
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
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  // Filter clients
  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      c =>
        c.full_name.toLowerCase().includes(q) ||
        (c.first_name && c.first_name.toLowerCase().includes(q)) ||
        (c.last_name && c.last_name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q))
    );
  }, [clients, search]);

  // History for selected client
  const clientHistory = useMemo(() => {
    if (!selectedClient) return { past: [], upcoming: [], clientVouchers: [] as GiftVoucher[], totalSpent: 0, totalCount: 0 };

    const cName = selectedClient.full_name.trim().toLowerCase();
    const today = new Date().toISOString();

    const clientPmus = appointments.filter(
      a => a.client_id === selectedClient.id || a.client_name.trim().toLowerCase() === cName
    );

    const clientWeddings = weddings.filter(
      w => w.client_id === selectedClient.id || w.bride_name.trim().toLowerCase() === cName
    );

    const clientVouchers = vouchers.filter(
      v => v.buyer_id === selectedClient.id || v.buyer_name.trim().toLowerCase() === cName
    );

    const past: any[] = [];
    const upcoming: any[] = [];
    let totalSpent = 0;

    // Vouchers bought also count as spent by this buyer!
    clientVouchers.forEach(v => {
      totalSpent += v.amount || 0;
    });

    clientPmus.forEach(p => {
      totalSpent += p.payment || 0;
      const isPast = p.appointment_date < today;
      const item = { type: 'pmu', date: p.appointment_date, title: p.treatment, amount: p.payment, raw: p };
      if (isPast) past.push(item);
      else upcoming.push(item);
    });

    clientWeddings.forEach(w => {
      totalSpent += (w.trial_deposit || 0) + (w.wedding_balance || 0);
      const isPast = w.wedding_date < today;
      const item = {
        type: 'wedding',
        date: w.wedding_date,
        title: `${w.event_type || 'Matrimonio'} (${w.people_count} pers.)`,
        amount: w.total_price || ((w.trial_deposit || 0) + (w.wedding_balance || 0)),
        raw: w
      };
      if (isPast) past.push(item);
      else upcoming.push(item);
    });

    past.sort((a, b) => b.date.localeCompare(a.date));
    upcoming.sort((a, b) => a.date.localeCompare(b.date));

    return { past, upcoming, clientVouchers, totalSpent, totalCount: past.length + upcoming.length };
  }, [selectedClient, appointments, weddings, vouchers]);

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    const full_name = `${firstName.trim()} ${lastName.trim()}`;

    onSaveClient({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-stone-900/90 border border-stone-800 p-4 rounded-3xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-rose-500" />
            Rubrica Clienti
          </h1>
          <p className="text-stone-400 text-xs">
            {clients.length} contatti memorizzati nello storico
          </p>
        </div>

        <button
          onClick={() => setIsAddingClient(true)}
          className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-rose-950/50 flex items-center gap-2 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Nuovo Cliente</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-stone-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Cerca per nome, cognome o telefono..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-stone-900 border border-stone-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
        />
      </div>

      {/* Client List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredClients.slice(0, 90).map(c => (
          <div
            key={c.id}
            onClick={() => setSelectedClient(c)}
            className="p-4 rounded-2xl bg-stone-900 hover:bg-stone-800/80 border border-stone-800 transition-all cursor-pointer group flex items-center justify-between"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-stone-800 to-stone-700 border border-stone-700 flex items-center justify-center font-bold text-sm text-rose-400 group-hover:scale-105 transition-transform flex-shrink-0">
                {c.full_name ? c.full_name.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white group-hover:text-rose-400 transition-colors truncate">
                  {c.full_name}
                </h3>
                {c.phone ? (
                  <p className="text-stone-400 text-xs flex items-center gap-1 truncate">
                    <Phone className="w-3 h-3 text-stone-500 flex-shrink-0" />
                    {c.phone}
                  </p>
                ) : (
                  <p className="text-stone-500 text-xs italic">Nessun recapito</p>
                )}
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-stone-600 group-hover:text-stone-400 transition-colors flex-shrink-0 ml-2" />
          </div>
        ))}
      </div>

      {/* Client Detail Drawer / Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-stone-900/95 backdrop-blur-md px-6 py-4 border-b border-stone-800 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 font-black text-lg">
                  {selectedClient.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedClient.full_name}</h2>
                  <p className="text-stone-400 text-xs">
                    Totale speso: <span className="font-bold text-emerald-400">{clientHistory.totalSpent}€</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedClient(null);
                  setDeleteErrorMessage(null);
                }}
                className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message for Blocked Delete */}
            {deleteErrorMessage && (
              <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-amber-950/60 border border-amber-500/50 flex items-start gap-3 animate-fade-in text-amber-200 text-xs">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-300">Impossibile eliminare questo contatto</p>
                  <p className="mt-0.5 leading-relaxed text-amber-200/90">{deleteErrorMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteErrorMessage(null)}
                  className="text-amber-400 hover:text-amber-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Phone / WhatsApp quick actions */}
              <div className="flex gap-2">
                {selectedClient.phone ? (
                  <>
                    <a
                      href={`tel:${selectedClient.phone}`}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 text-xs font-semibold flex items-center justify-center gap-2"
                    >
                      <Phone className="w-3.5 h-3.5 text-rose-400" /> Chiama
                    </a>
                    <a
                      href={`https://wa.me/${selectedClient.phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2"
                    >
                      WhatsApp
                    </a>
                  </>
                ) : (
                  <div className="text-xs text-stone-500 italic">Nessun numero di telefono inserito</div>
                )}
              </div>

              {/* Actions: Book PMU, Event or Issue Gift Voucher for this client */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                  Azioni Rapide
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      onOpenNewAppointmentForClient(selectedClient);
                      setSelectedClient(null);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 text-rose-400" />
                    <span>+ Nuovo PMU</span>
                  </button>

                  <button
                    onClick={() => {
                      onOpenNewWeddingForClient(selectedClient);
                      setSelectedClient(null);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/40 text-pink-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Heart className="w-3.5 h-3.5 text-pink-400" />
                    <span>+ Nuovo Evento</span>
                  </button>

                  {onOpenNewVoucherForClient && (
                    <button
                      onClick={() => {
                        onOpenNewVoucherForClient(selectedClient);
                        setSelectedClient(null);
                      }}
                      className="py-2.5 px-3 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Gift className="w-3.5 h-3.5 text-amber-400" />
                      <span>+ Nuovo Buono</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Buoni Regalo Acquistati da questo cliente */}
              <div>
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5" />
                  Buoni Regalo Acquistati ({clientHistory.clientVouchers.length})
                </h4>
                {clientHistory.clientVouchers.length === 0 ? (
                  <p className="text-xs text-stone-500 italic bg-stone-800/40 p-3 rounded-xl">
                    Nessun buono regalo acquistato da questo cliente.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {clientHistory.clientVouchers.map((v, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs flex justify-between items-center ${
                          v.is_used
                            ? 'bg-stone-800/40 border-stone-800 text-stone-400'
                            : 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">
                              {v.category === 'pmu' ? 'Buono PMU' : 'Buono Evento'}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                v.is_used
                                  ? 'bg-stone-800 text-stone-400'
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                              }`}
                            >
                              {v.is_used ? 'Utilizzato' : 'Da Usare'}
                            </span>
                          </div>
                          <p className="text-stone-400 text-[11px] mt-0.5">
                            Acquistato il {v.purchase_date} {v.notes ? `• ${v.notes}` : ''}
                          </p>
                        </div>
                        <span className="font-bold text-amber-400 text-sm">{v.amount}€</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upcoming Scheduled Appointments */}
              <div>
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  In programma ({clientHistory.upcoming.length})
                </h4>
                {clientHistory.upcoming.length === 0 ? (
                  <p className="text-xs text-stone-500 italic bg-stone-800/40 p-3 rounded-xl">
                    Nessun appuntamento futuro programmato.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {clientHistory.upcoming.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/40 text-xs flex justify-between items-center">
                        <div>
                          <p className="font-bold text-white">{item.title}</p>
                          <p className="text-stone-400 text-[11px]">{item.date.slice(0, 10)}</p>
                        </div>
                        <span className="font-bold text-rose-400">{item.amount}€</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Past Treatments History */}
              <div>
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  Storico Trattamenti Passati ({clientHistory.past.length})
                </h4>
                {clientHistory.past.length === 0 ? (
                  <p className="text-xs text-stone-500 italic bg-stone-800/40 p-3 rounded-xl">
                    Nessun trattamento passato registrato.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {clientHistory.past.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-stone-800/60 border border-stone-700/60 text-xs flex justify-between items-center">
                        <div>
                          <p className="font-medium text-white">{item.title}</p>
                          <p className="text-stone-400 text-[11px]">{item.date.slice(0, 10)}</p>
                        </div>
                        <span className="font-semibold text-emerald-400">{item.amount}€</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Delete Client Section */}
              <div className="pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => {
                    const hasAppointments = clientHistory.totalCount > 0;
                    if (hasAppointments) {
                      setDeleteErrorMessage(
                        `Questo contatto non può essere eliminato perché ha ${clientHistory.totalCount} appuntament${clientHistory.totalCount === 1 ? 'o' : 'i'} associat${clientHistory.totalCount === 1 ? 'o' : 'i'} (${clientHistory.past.length} passat${clientHistory.past.length === 1 ? 'o' : 'i'} e ${clientHistory.upcoming.length} futur${clientHistory.upcoming.length === 1 ? 'o' : 'i'}). Elimina prima gli appuntamenti collegati se desideri rimuovere il contatto.`
                      );
                    } else {
                      if (confirm(`Sei sicura di voler eliminare definitivamente "${selectedClient.full_name}" dalla rubrica?`)) {
                        onDeleteClient(selectedClient.id);
                        setSelectedClient(null);
                        setDeleteErrorMessage(null);
                      }
                    }
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    clientHistory.totalCount > 0
                      ? 'bg-stone-800/50 text-stone-500 border border-stone-800 hover:border-amber-700/50 hover:text-amber-400 cursor-not-allowed'
                      : 'bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 shadow-sm active:scale-98'
                  }`}
                  title={
                    clientHistory.totalCount > 0
                      ? 'Eliminazione disattivata: ci sono appuntamenti collegati'
                      : 'Elimina contatto dalla rubrica'
                  }
                >
                  <Trash2 className="w-4 h-4" />
                  <span>
                    {clientHistory.totalCount > 0
                      ? `Elimina Contatto (Disattivato: ${clientHistory.totalCount} appuntament${clientHistory.totalCount === 1 ? 'o' : 'i'})`
                      : 'Elimina Contatto dalla Rubrica'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {isAddingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-stone-800 mb-4">
              <h3 className="text-base font-bold text-white">Nuovo Contatto Rubrica</h3>
              <button onClick={() => setIsAddingClient(false)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase mb-1">
                    Nome *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="es. Martina"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2.5 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase mb-1">
                    Cognome *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="es. Raimondi"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2.5 text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase mb-1">
                  Telefono (Opzionale)
                </label>
                <input
                  type="tel"
                  placeholder="es. 340 1234567"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2.5 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase mb-1">
                  Note Tecniche (Opzionale)
                </label>
                <textarea
                  rows={2}
                  placeholder="Preferenze, allergie, note pelle..."
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2 text-white text-sm"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddingClient(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-semibold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-md shadow-rose-950/40"
                >
                  Salva Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
