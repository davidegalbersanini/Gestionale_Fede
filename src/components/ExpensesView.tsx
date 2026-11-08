'use client';

import React, { useState, useMemo } from 'react';
import { Expense } from '@/types';
import { Receipt, Plus, Search, Trash2, Calendar, Tag, DollarSign, X } from 'lucide-react';

interface ExpensesViewProps {
  expenses: Expense[];
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onDeleteExpense: (id: string) => void;
}

export default function ExpensesView({
  expenses,
  onAddExpense,
  onDeleteExpense,
}: ExpensesViewProps) {
  const [selectedYear, setSelectedYear] = useState<string>('2024');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  // New expense form state
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('Materiale');
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const categories = [
    'Materiale',
    'Anestetico',
    'Corsi di Formazione',
    'Marketing / Sito',
    'Attrezzatura',
    'Varie'
  ];

  // Distinct years available
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    expenses.forEach(e => {
      if (e.date) years.add(e.date.slice(0, 4));
    });
    return Array.from(years).sort().reverse();
  }, [expenses]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (selectedYear !== 'all' && !e.date.startsWith(selectedYear)) return false;
      if (selectedCategory !== 'all' && !e.category.toLowerCase().includes(selectedCategory.toLowerCase())) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.item.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          (e.notes && e.notes.toLowerCase().includes(q))
        );
      }
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, selectedYear, selectedCategory, search]);

  // Stats
  const totalAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [filteredExpenses]);

  // Breakdown by category
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      const cat = e.category || 'Varie';
      map[cat] = (map[cat] || 0) + (e.amount || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    onAddExpense({
      date,
      category,
      item: item.trim(),
      amount: parseFloat(amount),
      notes: notes.trim(),
    });

    setIsAddingExpense(false);
    setItem('');
    setAmount('');
    setNotes('');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-900/90 border border-stone-800 p-4 rounded-3xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-rose-500" />
            Spese dell&apos;Attività
          </h1>
          <p className="text-stone-400 text-xs">
            Monitoraggio costi materiali, formazione e gestione studio
          </p>
        </div>

        <button
          onClick={() => setIsAddingExpense(true)}
          className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-rose-950/50 flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Nuova Spesa</span>
        </button>
      </div>

      {/* KPI Cards for expenses */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl">
          <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider">
            Totale Spese ({selectedYear === 'all' ? 'Tutti gli anni' : selectedYear})
          </p>
          <p className="text-2xl font-black text-rose-400 mt-1">
            {totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5">{filteredExpenses.length} voci di spesa</p>
        </div>

        {/* Top 2 Categories preview */}
        {categoryBreakdown.slice(0, 2).map(([cat, amt]) => (
          <div key={cat} className="bg-stone-900 border border-stone-800 p-4 rounded-2xl">
            <p className="text-stone-400 text-xs font-semibold uppercase tracking-wider truncate">
              {cat}
            </p>
            <p className="text-2xl font-black text-white mt-1">
              {amt.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {totalAmount > 0 ? `${((amt / totalAmount) * 100).toFixed(0)}% del totale` : '0%'}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-stone-900/60 p-3 rounded-2xl border border-stone-800">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cerca spesa o materiale..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-stone-800/80 border border-stone-700/60 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none"
          />
        </div>

        {/* Year Filter */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setSelectedYear('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium ${
              selectedYear === 'all' ? 'bg-rose-600 text-white' : 'bg-stone-800 text-stone-400 hover:text-white'
            }`}
          >
            Tutti
          </button>
          {availableYears.map(yr => (
            <button
              key={yr}
              onClick={() => setSelectedYear(yr)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium ${
                selectedYear === yr ? 'bg-rose-600 text-white' : 'bg-stone-800 text-stone-400 hover:text-white'
              }`}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-stone-800 flex items-center justify-between text-xs text-stone-400 font-semibold uppercase tracking-wider">
          <span>Voci di Spesa Registrate</span>
          <span>{filteredExpenses.length} elementi</span>
        </div>

        <div className="divide-y divide-stone-800/60">
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-12 text-stone-500 text-sm">Nessuna spesa trovata.</div>
          ) : (
            filteredExpenses.map(e => (
              <div key={e.id} className="p-4 flex items-center justify-between hover:bg-stone-800/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-300">
                    <Receipt className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{e.item || e.category}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-800 text-stone-400 border border-stone-700">
                        {e.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-stone-400 mt-0.5">
                      <span>{e.date}</span>
                      {e.notes && <span className="text-stone-500 italic">• {e.notes}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-rose-400">
                    -{e.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €
                  </span>
                  <button
                    onClick={() => {
                      if (confirm('Eliminare questa spesa?')) onDeleteExpense(e.id);
                    }}
                    className="w-7 h-7 rounded-lg bg-stone-800 hover:bg-red-950/60 text-stone-500 hover:text-red-400 flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      {isAddingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-stone-800 mb-4">
              <h3 className="text-base font-bold text-white">Nuova Spesa</h3>
              <button onClick={() => setIsAddingExpense(false)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase mb-1">
                  Data Spesa *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2.5 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase mb-1">
                  Tipologia / Categoria
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2.5 text-white text-sm"
                >
                  {categories.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase mb-1">
                  Articolo / Descrizione
                </label>
                <input
                  type="text"
                  placeholder="es. Wipes, guanti, aghi dermografo..."
                  value={item}
                  onChange={e => setItem(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2.5 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase mb-1">
                  Importo (€) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2.5 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase mb-1">
                  Note Aggiuntive (Opzionale)
                </label>
                <input
                  type="text"
                  placeholder="Fornitore, numero rata, ecc."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2.5 text-white text-sm"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddingExpense(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-semibold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-md shadow-rose-950/40"
                >
                  Salva Spesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
