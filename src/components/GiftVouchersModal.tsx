'use client';

import React, { useState, useEffect } from 'react';
import { GiftVoucher, Client } from '@/types';
import { getVoucherInitialAmount, getVoucherRemainingAmount } from '@/lib/finance';
import ClientAutocomplete from '@/components/ClientAutocomplete';
import {
  Gift,
  Plus,
  X,
  Search,
  CheckCircle2,
  Circle,
  Trash2,
  Calendar as CalendarIcon,
  DollarSign,
  User,
  UserCheck,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';

interface GiftVouchersModalProps {
  isOpen: boolean;
  onClose: () => void;
  vouchers: GiftVoucher[];
  clients: Client[];
  onSaveVoucher: (voucherData: Omit<GiftVoucher, 'id'>) => void;
  onDeleteVoucher: (id: string) => void;
  defaultBuyerClient?: Client | null;
}

export default function GiftVouchersModal({
  isOpen,
  onClose,
  vouchers,
  clients,
  onSaveVoucher,
  onDeleteVoucher,
  defaultBuyerClient,
}: GiftVouchersModalProps) {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'used'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state - Buyer
  const [buyerFirstName, setBuyerFirstName] = useState('');
  const [buyerLastName, setBuyerLastName] = useState('');
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | undefined>();

  // Form state - Recipient
  const [recipientFirstName, setRecipientFirstName] = useState('');
  const [recipientLastName, setRecipientLastName] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | undefined>();

  const [amount, setAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const resetForm = () => {
    setBuyerFirstName('');
    setBuyerLastName('');
    setSelectedBuyerId(undefined);
    setRecipientFirstName('');
    setRecipientLastName('');
    setSelectedRecipientId(undefined);
    setAmount('');
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setFormError(null);
  };

  useEffect(() => {
    if (!isOpen) {
      resetForm();
      setView('list');
      setDeleteConfirmId(null);
      return;
    }

    if (defaultBuyerClient) {
      setBuyerFirstName(defaultBuyerClient.first_name || defaultBuyerClient.full_name.split(' ')[0] || '');
      setBuyerLastName(
        defaultBuyerClient.last_name && defaultBuyerClient.last_name !== '-'
          ? defaultBuyerClient.last_name
          : defaultBuyerClient.full_name.split(' ').slice(1).join(' ')
      );
      setSelectedBuyerId(defaultBuyerClient.id);
      setFormError(null);
      setView('create');
    } else {
      resetForm();
      setView('list');
    }
  }, [defaultBuyerClient, isOpen]);

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

  const filteredVouchers = vouchers.filter(v => {
    const initVal = getVoucherInitialAmount(v);
    const remVal = getVoucherRemainingAmount(v);
    const isUsed = remVal <= 0;

    if (filterStatus === 'active' && isUsed) return false;
    if (filterStatus === 'used' && !isUsed) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchBuyer = v.buyer_name.toLowerCase().includes(q);
      const matchRecipient = v.recipient_name ? v.recipient_name.toLowerCase().includes(q) : false;
      const matchNotes = v.notes ? v.notes.toLowerCase().includes(q) : false;
      const matchAmount = String(initVal).includes(q) || String(remVal).includes(q);
      return matchBuyer || matchRecipient || matchNotes || matchAmount;
    }
    return true;
  });

  const activeVouchers = vouchers.filter(v => getVoucherRemainingAmount(v) > 0);
  const usedVouchers = vouchers.filter(v => getVoucherRemainingAmount(v) <= 0);

  const activeCount = activeVouchers.length;
  const usedCount = usedVouchers.length;
  const totalRemainingAmount = activeVouchers.reduce((sum, v) => sum + getVoucherRemainingAmount(v), 0);

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Inserisci un importo valido in euro maggiore di 0.');
      return;
    }
    if (!buyerFirstName.trim()) {
      setFormError("Inserisci il nome dell'acquirente del buono.");
      return;
    }

    setFormError(null);
    const computedBuyerName = `${buyerFirstName.trim()} ${buyerLastName.trim()}`.trim();
    const computedRecipientName = `${recipientFirstName.trim()} ${recipientLastName.trim()}`.trim();

    onSaveVoucher({
      buyer_id: selectedBuyerId,
      buyer_name: computedBuyerName,
      recipient_id: selectedRecipientId,
      recipient_name: computedRecipientName || undefined,
      initial_amount: parsedAmount,
      remaining_amount: parsedAmount,
      amount: parsedAmount,
      category: 'pmu',
      purchase_date: purchaseDate,
      is_used: false,
      notes: notes.trim() || undefined,
    });

    resetForm();
    setView('list');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-stone-200 text-stone-900 rounded-t-3xl sm:rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-white/95 backdrop-blur-md flex items-center justify-between z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            {view === 'create' ? (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setView('list');
                }}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-500/40 flex items-center justify-center text-amber-600">
                <Gift className="w-5 h-5" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                {view === 'create' ? 'Nuovo Buono' : 'Buoni Regalo'}
              </h2>
              {view === 'list' && (
                <p className="text-stone-500 text-xs">
                  {`${activeCount} attivi (${totalRemainingAmount.toFixed(0)}€) • ${usedCount} usati`}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {view === 'list' && (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setView('create');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-bold text-xs shadow-md shadow-amber-200/60 flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Nuovo</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {view === 'create' && (
            <form onSubmit={handleSubmitCreate} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-500/50 text-red-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-600" />
                  Acquirente *
                </label>
                <ClientAutocomplete
                  clients={clients}
                  firstName={buyerFirstName}
                  lastName={buyerLastName}
                  onFirstNameChange={val => {
                    setBuyerFirstName(val);
                    setSelectedBuyerId(undefined);
                    setFormError(null);
                  }}
                  onLastNameChange={val => {
                    setBuyerLastName(val);
                    setSelectedBuyerId(undefined);
                  }}
                  onSelectClient={c => {
                    setBuyerFirstName(c.first_name || c.full_name.split(' ')[0] || '');
                    setBuyerLastName(
                      c.last_name && c.last_name !== '-'
                        ? c.last_name
                        : c.full_name.split(' ').slice(1).join(' ')
                    );
                    setSelectedBuyerId(c.id);
                    setFormError(null);
                  }}
                  firstNameRequired
                  firstNameLabel={null}
                  lastNameLabel={null}
                  firstNamePlaceholder="Nome acquirente *"
                  lastNamePlaceholder="Cognome (opzionale)"
                  accent="amber"
                />
              </div>

              <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200">
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-pink-600" />
                  Destinatario (Opzionale)
                </label>
                <ClientAutocomplete
                  clients={clients}
                  firstName={recipientFirstName}
                  lastName={recipientLastName}
                  onFirstNameChange={val => {
                    setRecipientFirstName(val);
                    setSelectedRecipientId(undefined);
                  }}
                  onLastNameChange={val => {
                    setRecipientLastName(val);
                    setSelectedRecipientId(undefined);
                  }}
                  onSelectClient={c => {
                    setRecipientFirstName(c.first_name || c.full_name.split(' ')[0] || '');
                    setRecipientLastName(
                      c.last_name && c.last_name !== '-'
                        ? c.last_name
                        : c.full_name.split(' ').slice(1).join(' ')
                    );
                    setSelectedRecipientId(c.id);
                  }}
                  firstNameLabel={null}
                  lastNameLabel={null}
                  firstNamePlaceholder="Nome destinatario"
                  lastNamePlaceholder="Cognome destinatario"
                  accent="pink"
                />
                <p className="text-[11px] text-stone-500 mt-1.5">
                  Se vuoto, si collegherà automaticamente alla persona all&apos;uso.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-amber-600" /> Importo (€) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    placeholder="es. 100"
                    value={amount}
                    onChange={e => {
                      setAmount(e.target.value);
                      setFormError(null);
                    }}
                    className="w-full bg-stone-100 border border-stone-300 rounded-xl px-4 py-2.5 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-base font-bold text-amber-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <CalendarIcon className="w-3.5 h-3.5 text-rose-600" /> Data *
                  </label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2.5 text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                  Note
                </label>
                <textarea
                  rows={2}
                  placeholder="Regalo compleanno, bonifico..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setView('list');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 text-stone-700 hover:bg-stone-200 text-xs sm:text-sm font-semibold transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-amber-200/60 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  <Gift className="w-4 h-4" />
                  <span>Crea Buono</span>
                </button>
              </div>
            </form>
          )}

          {view === 'list' && (
            <>
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cerca per acquirente, destinatario o note..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-stone-100 border border-stone-200 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 w-fit">
                  <button
                    type="button"
                    onClick={() => setFilterStatus('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      filterStatus === 'all'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'text-stone-500 hover:text-stone-900'
                    }`}
                  >
                    Tutti ({vouchers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('active')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      filterStatus === 'active'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'text-stone-500 hover:text-stone-900'
                    }`}
                  >
                    Attivi ({activeCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('used')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      filterStatus === 'used'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'text-stone-500 hover:text-stone-900'
                    }`}
                  >
                    Esauriti ({usedCount})
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                {filteredVouchers.length === 0 ? (
                  <div className="p-8 text-center bg-stone-50/80 rounded-2xl border border-stone-200">
                    <Gift className="w-8 h-8 text-stone-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-stone-500">Nessun buono regalo trovato</p>
                    <p className="text-xs text-stone-500 mt-1">
                      {vouchers.length === 0
                        ? 'Clicca sul pulsante "+ Nuovo" per emettere il primo buono regalo.'
                        : 'Prova a modificare i filtri o la ricerca.'}
                    </p>
                  </div>
                ) : (
                  filteredVouchers.map(voucher => {
                    const initVal = getVoucherInitialAmount(voucher);
                    const remVal = getVoucherRemainingAmount(voucher);
                    const isFullyUsed = remVal <= 0;
                    const isPartial = remVal > 0 && remVal < initVal;
                    const isConfirmingDelete = deleteConfirmId === voucher.id;

                    return (
                      <div
                        key={voucher.id}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                          isFullyUsed
                            ? 'bg-white border-stone-200 opacity-75'
                            : isPartial
                            ? 'bg-amber-50/70 border-amber-300 hover:border-amber-500/70 shadow-sm'
                            : 'bg-stone-50 border-stone-300 hover:border-amber-500/50 shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-stone-500 text-xs flex items-center gap-1">
                                <CalendarIcon className="w-3.5 h-3.5 text-stone-500" />
                                {voucher.purchase_date}
                              </span>
                            </div>

                            <h4 className="text-sm font-bold text-stone-900 truncate flex items-center gap-1.5">
                              <span className="text-stone-500 text-xs font-normal">Acquirente:</span>
                              <span>{voucher.buyer_name}</span>
                            </h4>

                            <p className="text-xs text-stone-700 mt-0.5 flex items-center gap-1.5 truncate">
                              <span className="text-stone-500 text-[11px]">Destinatario:</span>
                              {voucher.recipient_name ? (
                                <span className="font-semibold text-pink-700">{voucher.recipient_name}</span>
                              ) : (
                                <span className="text-stone-500 italic">Non assegnato</span>
                              )}
                            </p>

                            {voucher.notes && (
                              <p className="text-xs text-stone-500 mt-1 italic line-clamp-2">
                                &ldquo;{voucher.notes}&rdquo;
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <div className="text-right">
                              <span className="text-lg sm:text-xl font-black text-amber-700 tracking-tight">
                                {remVal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                              </span>
                              {remVal < initVal ? (
                                <p className="text-[11px] text-stone-500">
                                  su {initVal.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €
                                </p>
                              ) : (
                                <p className="text-[10px] text-emerald-600 font-medium">Intero</p>
                              )}
                            </div>

                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                isFullyUsed
                                  ? 'bg-stone-100 text-stone-500'
                                  : isPartial
                                  ? 'bg-amber-100 text-amber-700 border border-amber-500/30'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {isFullyUsed ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-stone-500" />
                                  <span>Esaurito</span>
                                </>
                              ) : (
                                <>
                                  <Circle className="w-2.5 h-2.5 text-emerald-600 fill-emerald-400" />
                                  <span>{isPartial ? 'In uso' : 'Attivo'}</span>
                                </>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-stone-200 flex items-center justify-end text-xs text-stone-500">
                          {isConfirmingDelete ? (
                            <div className="flex items-center gap-2">
                              <span className="text-red-600 text-[11px] font-semibold">Confermi?</span>
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
                                className="text-stone-500 hover:text-stone-900 text-[10px]"
                              >
                                Annulla
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(voucher.id)}
                              className="text-stone-500 hover:text-red-600 p-1 transition-colors"
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
