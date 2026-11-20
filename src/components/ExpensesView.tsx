'use client';

import React, { useState, useMemo } from 'react';
import { Expense } from '@/types';
import ConfirmModal from '@/components/ConfirmModal';
import { Receipt, Plus, Search, Trash2, Pencil, X } from 'lucide-react';

interface ExpensesViewProps {
  expenses: Expense[];
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onUpdateExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
}

const EXPENSE_CATEGORIES = [
  'Materiale',
  'Anestetico',
  'Corsi di Formazione',
  'Marketing / Sito',
  'Attrezzatura',
  'Varie',
];

export default function ExpensesView({
  expenses,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
}: ExpensesViewProps) {
  const currentYearStr = String(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Modal state (shared for create & edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('Materiale');
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  // Delete confirm state
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  const openCreateModal = () => {
    setEditingExpense(null);
    setDate(new Date().toISOString().slice(0, 10));
    setCategory('Materiale');
    setItem('');
    setAmount('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setDate(exp.date ? exp.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setCategory(EXPENSE_CATEGORIES.includes(exp.category) ? exp.category : exp.category || 'Materiale');
    setItem(exp.item || '');
    setAmount(String(exp.amount || ''));
    setNotes(exp.notes || '');
    setIsModalOpen(true);
  };

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    expenses.forEach(e => {
      if (e.date) years.add(e.date.slice(0, 4));
    });
    return Array.from(years).sort().reverse();
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    return expenses
      .filter(e => {
        if (selectedYear !== 'all' && !e.date.startsWith(selectedYear)) return false;
        if (selectedCategory !== 'all' && !e.category.toLowerCase().includes(selectedCategory.toLowerCase())) {
          return false;
        }
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            e.item.toLowerCase().includes(q) ||
            e.category.toLowerCase().includes(q) ||
            (e.notes && e.notes.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, selectedYear, selectedCategory, search]);

  const totalAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [filteredExpenses]);

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      const cat = e.category || 'Varie';
      map[cat] = (map[cat] || 0) + (e.amount || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    if (editingExpense) {
      onUpdateExpense({
        ...editingExpense,
        date,
        category,
        item: item.trim(),
        amount: parsedAmount,
        notes: notes.trim(),
      });
    } else {
      onAddExpense({
        date,
        category,
        item: item.trim(),
        amount: parsedAmount,
        notes: notes.trim(),
      });
    }

    setIsModalOpen(false);
    setEditingExpense(null);
    setItem('');
    setAmount('');
    setNotes('');
  };

  const categoryOptions = EXPENSE_CATEGORIES.includes(category)
    ? EXPENSE_CATEGORIES
    : [category, ...EXPENSE_CATEGORIES];

  return (
    <div className="space-y-4 min-w-0 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-stone-200 p-4 rounded-3xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-rose-500" />
            Spese
          </h1>
          <p className="text-stone-500 text-xs">
            Materiali, corsi e gestione
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-3.5 py-2 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-rose-200/70 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Nuova Spesa</span>
        </button>
      </div>

      {/* Filters & Categories */}
      <div className="space-y-2.5 bg-white p-3.5 rounded-2xl border border-stone-200 min-w-0 max-w-full overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2.5 min-w-0">
          <div className="relative w-full sm:flex-1 sm:min-w-[180px] min-w-0">
            <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cerca spesa o materiale..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-stone-100 border border-stone-200 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-stone-900 placeholder-stone-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto max-w-full scrollbar-none">
            <button
              onClick={() => setSelectedYear('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 ${
                selectedYear === 'all' ? 'bg-rose-600 text-white' : 'bg-stone-100 text-stone-500 hover:text-stone-900'
              }`}
            >
              Tutti
            </button>
            {availableYears.map(yr => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 ${
                  selectedYear === yr ? 'bg-rose-600 text-white' : 'bg-stone-100 text-stone-500 hover:text-stone-900'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === 'all'
                ? 'bg-stone-200 text-stone-900'
                : 'bg-stone-50 text-stone-500 hover:text-stone-900'
            }`}
          >
            Tutte le categorie
          </button>
          {EXPENSE_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-rose-600 text-white'
                  : 'bg-stone-50 text-stone-500 hover:text-stone-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-stone-200 p-4 rounded-2xl">
          <p className="text-stone-500 text-xs font-semibold uppercase tracking-wider">
            Totale Spese ({selectedYear === 'all' ? 'Tutti gli anni' : selectedYear})
          </p>
          <p className="text-2xl font-black text-rose-600 mt-1">
            {totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5">{filteredExpenses.length} voci di spesa</p>
        </div>

        {categoryBreakdown.slice(0, 2).map(([cat, amt]) => (
          <div key={cat} className="bg-white border border-stone-200 p-4 rounded-2xl">
            <p className="text-stone-500 text-xs font-semibold uppercase tracking-wider truncate">
              {cat}
            </p>
            <p className="text-2xl font-black text-stone-900 mt-1">
              {amt.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {totalAmount > 0 ? `${((amt / totalAmount) * 100).toFixed(0)}% del totale` : '0%'}
            </p>
          </div>
        ))}
      </div>

      {/* Expenses List */}
      <div className="bg-white border border-stone-200 rounded-3xl p-4 sm:p-5">
        <div className="text-stone-500 text-xs font-semibold uppercase tracking-wider pb-3 border-b border-stone-200 flex justify-between items-center">
          <span>Elenco Spese ({filteredExpenses.length})</span>
          <span className="text-rose-600 font-bold">{totalAmount.toLocaleString('it-IT')} €</span>
        </div>

        <div className="divide-y divide-stone-200">
          {filteredExpenses.length === 0 ? (
            <p className="py-8 text-center text-stone-500 text-xs italic">
              Nessuna spesa trovata per i filtri selezionati.
            </p>
          ) : (
            filteredExpenses.map(e => (
              <div key={e.id} className="py-3 flex items-center justify-between gap-3 group">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200 truncate">
                      {e.category}
                    </span>
                    <span className="text-stone-500 text-[11px] font-mono">{e.date}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-stone-900 truncate">{e.item}</h4>
                  {e.notes && <p className="text-stone-500 text-xs truncate mt-0.5">{e.notes}</p>}
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                  <span className="text-sm sm:text-base font-black text-rose-600 mr-0.5 sm:mr-1 whitespace-nowrap">
                    -{e.amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </span>
                  <button
                    type="button"
                    onClick={() => openEditModal(e)}
                    className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 opacity-75 group-hover:opacity-100 transition-opacity"
                    title="Modifica spesa"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseToDelete(e)}
                    className="p-1.5 rounded-lg text-stone-500 hover:text-red-600 hover:bg-stone-100 opacity-75 group-hover:opacity-100 transition-opacity"
                    title="Elimina spesa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add / Edit Expense Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/35 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={e => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-md max-h-[90dvh] overflow-y-auto overflow-x-hidden p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 mb-4">
              <h3 className="text-base font-bold text-stone-900">
                {editingExpense ? 'Modifica Spesa Studio' : 'Nuova Spesa Studio'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-500 hover:text-stone-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pb-safe">
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">
                  Descrizione Spesa *
                </label>
                <input
                  type="text"
                  required
                  placeholder="es. Aghi cartridge 1RLL, Pigmenti..."
                  value={item}
                  onChange={e => setItem(e.target.value)}
                  className="w-full bg-stone-100 border border-stone-300 rounded-xl px-4 py-2.5 text-stone-900 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">
                    Importo (€) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full bg-stone-100 border border-stone-300 rounded-xl px-4 py-2.5 text-stone-900 text-sm"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">
                    Data Spesa
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-stone-100 border border-stone-300 rounded-xl px-4 py-2.5 text-stone-900 text-sm"
                >
                  {categoryOptions.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase mb-1">
                  Note Aggiuntive (Opzionale)
                </label>
                <textarea
                  rows={2}
                  placeholder="Fornitore, numero fattura o ricevuta..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-stone-100 border border-stone-300 rounded-xl px-4 py-2 text-stone-900 text-sm"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-md shadow-rose-200/60"
                >
                  {editingExpense ? 'Salva Modifiche' : 'Aggiungi Spesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(expenseToDelete)}
        title="Elimina Spesa"
        message={`Eliminare la spesa "${expenseToDelete?.item || ''}" di ${expenseToDelete?.amount || 0}€?`}
        confirmLabel="Elimina"
        onConfirm={() => {
          if (expenseToDelete) {
            onDeleteExpense(expenseToDelete.id);
          }
          setExpenseToDelete(null);
        }}
        onCancel={() => setExpenseToDelete(null)}
      />
    </div>
  );
}
