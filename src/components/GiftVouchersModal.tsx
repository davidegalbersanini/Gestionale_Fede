'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { GiftVoucher, Client, GiftVoucherCategory } from '@/types';
import {
  Gift,
  Plus,
  X,
  Search,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  Heart,
  Trash2,
  Calendar as CalendarIcon,
  Filter,
  DollarSign,
  User,
  ArrowLeft
} from 'lucide-react';

interface GiftVouchersModalProps {
  isOpen: boolean;
  onClose: () => void;
  vouchers: GiftVoucher[];
  clients: Client[];
  onSaveVoucher: (voucherData: Omit<GiftVoucher, 'id'>) => void;
  onToggleUsed: (voucher: GiftVoucher) => void;
  onDeleteVoucher: (id: string) => void;
  defaultBuyerClient?: Client | null;
}

export default function GiftVouchersModal({
  isOpen,
  onClose,
  vouchers,
  clients,
  onSaveVoucher,
  onToggleUsed,
  onDeleteVoucher,
  defaultBuyerClient,
}: GiftVouchersModalProps) {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'used'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'pmu' | 'evento'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [buyerName, setBuyerName] = useState('');
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | undefined>();
  const [showBuyerSuggestions, setShowBuyerSuggestions] = useState(false);
  const [category, setCategory] = useState<GiftVoucherCategory>('pmu');
  const [amount, setAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // Delete confirm state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // When defaultBuyerClient changes or modal opens with a pre-selected client
  useEffect(() => {
    if (defaultBuyerClient) {
      setBuyerName(defaultBuyerClient.full_name);
      setSelectedBuyerId(defaultBuyerClient.id);
      setView('create');
    }
  }, [defaultBuyerClient, isOpen]);

  // Reset form when going back to list
  const resetForm = () => {
    setBuyerName('');
    setSelectedBuyerId(undefined);
    setCategory('pmu');
    setAmount('');
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setShowBuyerSuggestions(false);
  };

  if (!isOpen) return null;

  // Filtered clients for buyer autocomplete
  const filteredClients = buyerName.trim()
    ? clients.filter(c => c.full_name.toLowerCase().includes(buyerName.toLowerCase())).slice(0, 5)
    : [];

  // Filtered vouchers
  const filteredVouchers = vouchers.filter(v => {
    if (filterStatus === 'active' && v.is_used) return false;
    if (filterStatus === 'used' && !v.is_used) return false;
    if (filterCategory !== 'all' && v.category !== filterCategory) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchBuyer = v.buyer_name.toLowerCase().includes(q);
      const matchNotes = v.notes ? v.notes.toLowerCase().includes(q) : false;
      const matchAmount = String(v.amount).includes(q);
      return matchBuyer || matchNotes || matchAmount;
    }
    return true;
  });

  const activeCount = vouchers.filter(v => !v.is_used).length;
  const usedCount = vouchers.filter(v => v.is_used).length;
  const totalActiveAmount = vouchers.filter(v => !v.is_used).reduce((sum, v) => sum + (v.amount || 0), 0);

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Inserisci un importo valido in euro.');
      return;
    }
    if (!buyerName.trim()) {
      alert('Inserisci il nome dell\'acquirente del buono.');
      return;
    }

    onSaveVoucher({
      buyer_id: selectedBuyerId,
      buyer_name: buyerName.trim(),
      amount: parsedAmount,
      category,
      purchase_date: purchaseDate,
      is_used: false,
      notes: notes.trim() || undefined,
    });

    resetForm();
    setView('list');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-t-3xl sm:rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-800 bg-stone-900/95 backdrop-blur-md flex items-center justify-between z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            {view === 'create' ? (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setView('list');
                }}
                className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Gift className="w-5 h-5" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {view === 'create' ? 'Emetti Nuovo Buono Regalo' : 'Buoni Regalo'}
              </h2>
              <p className="text-stone-400 text-xs">
                {view === 'create'
                  ? 'Il ricavato verrà aggiunto subito agli incassi'
                  : `${activeCount} da usare (${totalActiveAmount.toFixed(0)}€) • ${usedCount} utilizzati`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {view === 'list' && (
              <button
                type="button"
                onClick={() => setView('create')}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-bold text-xs shadow-md shadow-amber-950/40 flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Nuovo</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* VIEW: CREATE NEW VOUCHER */}
          {view === 'create' && (
            <form onSubmit={handleSubmitCreate} className="space-y-4">
              
              {/* Category selector: PMU vs Evento */}
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
                  Destinazione Buono (Categoria Ricavi)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCategory('pmu')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                      category === 'pmu'
                        ? 'bg-rose-950/40 border-rose-500 text-rose-200 ring-1 ring-rose-500 shadow-md'
                        : 'bg-stone-800/60 border-stone-700 text-stone-400 hover:bg-stone-800 hover:text-white'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${category === 'pmu' ? 'bg-rose-600 text-white' : 'bg-stone-700 text-stone-400'}`}>
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">PMU & Trattamenti</div>
                      <div className="text-[11px] opacity-75">Sommato al fatturato PMU</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCategory('evento')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                      category === 'evento'
                        ? 'bg-pink-950/40 border-pink-500 text-pink-200 ring-1 ring-pink-500 shadow-md'
                        : 'bg-stone-800/60 border-stone-700 text-stone-400 hover:bg-stone-800 hover:text-white'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${category === 'evento' ? 'bg-pink-600 text-white' : 'bg-stone-700 text-stone-400'}`}>
                      <Heart className="w-4 h-4 fill-current" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">Evento / Cerimonia</div>
                      <div className="text-[11px] opacity-75">Sommato al fatturato Eventi</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Acquirente (Buyer) with autocomplete */}
              <div className="relative">
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
                  Chi acquista il Buono (Acquirente) *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Nome e cognome dell'acquirente..."
                    value={buyerName}
                    onChange={e => {
                      setBuyerName(e.target.value);
                      setSelectedBuyerId(undefined);
                      setShowBuyerSuggestions(true);
                    }}
                    onFocus={() => setShowBuyerSuggestions(true)}
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  />
                </div>

                {showBuyerSuggestions && filteredClients.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-stone-800 border border-stone-700 rounded-xl shadow-xl overflow-hidden">
                    {filteredClients.map(c => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => {
                          setBuyerName(c.full_name);
                          setSelectedBuyerId(c.id);
                          setShowBuyerSuggestions(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-stone-700 text-stone-200 text-sm flex items-center justify-between border-b border-stone-700/50 last:border-0"
                      >
                        <span className="font-medium text-white">{c.full_name}</span>
                        {c.phone && <span className="text-stone-400 text-xs">{c.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-stone-500 mt-1">
                  Se il contatto non è presente in rubrica, verrà salvato automaticamente.
                </p>
              </div>

              {/* Importo in Euro & Data Acquisto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-amber-400" /> Importo del Buono (€) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="es. 100"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2.5 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-base font-bold text-amber-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <CalendarIcon className="w-3.5 h-3.5 text-rose-400" /> Data di Acquisto *
                  </label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  />
                </div>
              </div>

              {/* Note / Dettagli opzionali */}
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
                  Note Aggiuntive (Opzionale)
                </label>
                <textarea
                  rows={2}
                  placeholder="es. Regalo compleanno per la sorella Chiara, pagato con bonifico..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setView('list');
                  }}
                  className="px-4 py-3 rounded-xl bg-stone-800 text-stone-300 hover:bg-stone-700 text-sm font-semibold transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-bold text-sm shadow-lg shadow-amber-950/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Gift className="w-4 h-4" />
                  <span>Emetti Buono Regalo</span>
                </button>
              </div>
            </form>
          )}

          {/* VIEW: LIST OF VOUCHERS */}
          {view === 'list' && (
            <>
              {/* Filter Tabs & Search */}
              <div className="space-y-2.5">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cerca per acquirente, note o importo..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-stone-800/80 border border-stone-700/60 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Filter Status: Tutti / Da Usare / Utilizzati */}
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1 bg-stone-800/70 p-1 rounded-xl border border-stone-700/60">
                    <button
                      type="button"
                      onClick={() => setFilterStatus('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        filterStatus === 'all'
                          ? 'bg-amber-500 text-stone-950 shadow-sm'
                          : 'text-stone-400 hover:text-white'
                      }`}
                    >
                      Tutti ({vouchers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterStatus('active')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        filterStatus === 'active'
                          ? 'bg-amber-500 text-stone-950 shadow-sm'
                          : 'text-stone-400 hover:text-white'
                      }`}
                    >
                      Da Usare ({activeCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterStatus('used')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        filterStatus === 'used'
                          ? 'bg-amber-500 text-stone-950 shadow-sm'
                          : 'text-stone-400 hover:text-white'
                      }`}
                    >
                      Utilizzati ({usedCount})
                    </button>
                  </div>

                  {/* Category toggle: Tutti / PMU / Evento */}
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setFilterCategory('all')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        filterCategory === 'all'
                          ? 'bg-stone-700 text-white'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      Tutte
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterCategory('pmu')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        filterCategory === 'pmu'
                          ? 'bg-rose-950 border border-rose-500/50 text-rose-300'
                          : 'text-stone-400 hover:text-rose-300'
                      }`}
                    >
                      PMU
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterCategory('evento')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        filterCategory === 'evento'
                          ? 'bg-pink-950 border border-pink-500/50 text-pink-300'
                          : 'text-stone-400 hover:text-pink-300'
                      }`}
                    >
                      Eventi
                    </button>
                  </div>
                </div>
              </div>

              {/* Vouchers List */}
              <div className="space-y-2.5 pt-1">
                {filteredVouchers.length === 0 ? (
                  <div className="p-8 text-center bg-stone-800/30 rounded-2xl border border-stone-800/80">
                    <Gift className="w-8 h-8 text-stone-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-stone-400">Nessun buono regalo trovato</p>
                    <p className="text-xs text-stone-500 mt-1">
                      {vouchers.length === 0
                        ? 'Clicca sul pulsante "+ Nuovo" per emettere il primo buono regalo.'
                        : 'Prova a modificare i filtri o la ricerca.'}
                    </p>
                  </div>
                ) : (
                  filteredVouchers.map(voucher => {
                    const isPmu = voucher.category === 'pmu';
                    const isConfirmingDelete = deleteConfirmId === voucher.id;

                    return (
                      <div
                        key={voucher.id}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                          voucher.is_used
                            ? 'bg-stone-900/60 border-stone-800/80 opacity-75'
                            : 'bg-stone-800/50 border-stone-700/80 hover:border-amber-500/50 shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          
                          {/* Left: Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {/* Category Badge */}
                              <span
                                className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                  isPmu
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                                    : 'bg-pink-950 text-pink-300 border border-pink-800/60'
                                }`}
                              >
                                {isPmu ? 'PMU' : 'Evento / Trucco'}
                              </span>

                              {/* Purchase Date */}
                              <span className="text-stone-400 text-xs flex items-center gap-1">
                                <CalendarIcon className="w-3 h-3 text-stone-500" />
                                {voucher.purchase_date}
                              </span>
                            </div>

                            {/* Buyer Name */}
                            <h4 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                              <span className="text-stone-400 text-xs font-normal">Acquirente:</span>
                              <span>{voucher.buyer_name}</span>
                            </h4>

                            {/* Notes */}
                            {voucher.notes && (
                              <p className="text-xs text-stone-400 mt-1 italic line-clamp-2">
                                &ldquo;{voucher.notes}&rdquo;
                              </p>
                            )}
                          </div>

                          {/* Right: Amount & Status Toggle */}
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            {/* Big Amount */}
                            <div className="text-right">
                              <span className="text-lg sm:text-xl font-black text-amber-300 tracking-tight">
                                {voucher.amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                              </span>
                            </div>

                            {/* Toggle Utilizzato (Sì/No) */}
                            <button
                              type="button"
                              onClick={() => onToggleUsed(voucher)}
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                                voucher.is_used
                                  ? 'bg-stone-800 border-stone-700 text-stone-400 hover:text-white'
                                  : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-950/50 hover:bg-emerald-900/70'
                              }`}
                            >
                              {voucher.is_used ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-stone-500" />
                                  <span>Utilizzato</span>
                                </>
                              ) : (
                                <>
                                  <Circle className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/30" />
                                  <span>Da Usare</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Bottom Actions Bar */}
                        <div className="mt-3 pt-2.5 border-t border-stone-800/80 flex items-center justify-between text-xs text-stone-500">
                          <span className="text-[11px]">
                            {voucher.is_used ? 'Buono già riscosso nel trattamento' : 'Disponibile per essere scalato'}
                          </span>

                          {isConfirmingDelete ? (
                            <div className="flex items-center gap-2">
                              <span className="text-red-400 text-[11px] font-semibold">Confermi?</span>
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteVoucher(voucher.id);
                                  setDeleteConfirmId(null);
                                }}
                                className="px-2 py-0.5 rounded bg-red-600 text-white font-bold text-[10px]"
                              >
                                Sì, elimina
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="text-stone-400 hover:text-white text-[10px]"
                              >
                                Annulla
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(voucher.id)}
                              className="text-stone-500 hover:text-red-400 p-1 transition-colors"
                              title="Elimina Buono"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
}
