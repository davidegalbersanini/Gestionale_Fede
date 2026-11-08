'use client';

import React, { useState, useMemo } from 'react';
import { Appointment, WeddingService, Expense, AppSettings } from '@/types';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Heart,
  Sparkles,
  Calendar,
  Award,
  ChevronRight,
  ArrowUpRight,
  Target
} from 'lucide-react';

interface DashboardViewProps {
  appointments: Appointment[];
  weddings: WeddingService[];
  expenses: Expense[];
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
}

export default function DashboardView({
  appointments,
  weddings,
  expenses,
  settings,
  onUpdateSettings,
}: DashboardViewProps) {
  const [selectedYear, setSelectedYear] = useState<string>('2024');

  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  // Distinct years
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    appointments.forEach(a => years.add(a.appointment_date.slice(0, 4)));
    weddings.forEach(w => years.add(w.wedding_date.slice(0, 4)));
    expenses.forEach(e => years.add(e.date.slice(0, 4)));
    return Array.from(years).sort().reverse();
  }, [appointments, weddings, expenses]);

  // Aggregate monthly stats for selected year
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const mStr = String(i + 1).padStart(2, '0');
      const prefix = `${selectedYear}-${mStr}`;
      return {
        monthIndex: i,
        monthName: monthNames[i],
        prefix,
        pmuRevenue: 0,
        weddingRevenue: 0,
        expensesTotal: 0,
        netProfit: 0,
        totalRevenue: 0,
        pmuCount: 0,
        weddingCount: 0,
      };
    });

    // PMU
    appointments.forEach(app => {
      if (app.appointment_date.startsWith(selectedYear)) {
        const m = parseInt(app.appointment_date.slice(5, 7), 10) - 1;
        if (m >= 0 && m < 12) {
          months[m].pmuRevenue += (app.payment || 0);
          months[m].pmuCount += 1;
        }
      }
    });

    // Weddings
    weddings.forEach(w => {
      // Wedding day income
      if (w.wedding_date.startsWith(selectedYear)) {
        const m = parseInt(w.wedding_date.slice(5, 7), 10) - 1;
        if (m >= 0 && m < 12) {
          months[m].weddingRevenue += (w.wedding_balance || 0);
          months[m].weddingCount += 1;
        }
      }
      // Trial day income if trial was this year
      if (w.trial_date && w.trial_date.startsWith(selectedYear)) {
        const m = parseInt(w.trial_date.slice(5, 7), 10) - 1;
        if (m >= 0 && m < 12) {
          months[m].weddingRevenue += (w.trial_deposit || 0);
        }
      }
    });

    // Expenses
    expenses.forEach(e => {
      if (e.date.startsWith(selectedYear)) {
        const m = parseInt(e.date.slice(5, 7), 10) - 1;
        if (m >= 0 && m < 12) {
          months[m].expensesTotal += (e.amount || 0);
        }
      }
    });

    // Compute totals
    months.forEach(m => {
      m.totalRevenue = m.pmuRevenue + m.weddingRevenue;
      m.netProfit = m.totalRevenue - m.expensesTotal;
    });

    return months;
  }, [selectedYear, appointments, weddings, expenses]);

  // Annual Totals
  const annualStats = useMemo(() => {
    let totPmu = 0;
    let totWedding = 0;
    let totExp = 0;

    monthlyData.forEach(m => {
      totPmu += m.pmuRevenue;
      totWedding += m.weddingRevenue;
      totExp += m.expensesTotal;
    });

    const totalRev = totPmu + totWedding;
    const netProf = totalRev - totExp;
    const activeMonths = monthlyData.filter(m => m.totalRevenue > 0).length || 1;
    const monthlyAverage = totalRev / activeMonths;

    return {
      totalRevenue: totalRev,
      pmuRevenue: totPmu,
      weddingRevenue: totWedding,
      totalExpenses: totExp,
      netProfit: netProf,
      monthlyAverage,
      activeMonths,
    };
  }, [monthlyData]);

  // Target Progress
  const targetMonthly = settings.monthly_target || 2700;
  const targetYearly = settings.yearly_target || 35000;
  const monthlyProgress = Math.min(100, Math.round((annualStats.monthlyAverage / targetMonthly) * 100));
  const yearlyProgress = Math.min(100, Math.round((annualStats.totalRevenue / targetYearly) * 100));

  return (
    <div className="space-y-5">
      {/* Header & Year Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-900/90 border border-stone-800 p-4 rounded-3xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-rose-500" />
            Riepilogo & Obiettivi
          </h1>
          <p className="text-stone-400 text-xs">
            Performance economica, fatturato e avanzamento obiettivi
          </p>
        </div>

        {/* Year Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {availableYears.map(yr => (
            <button
              key={yr}
              onClick={() => setSelectedYear(yr)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedYear === yr
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-950/40'
                  : 'bg-stone-800 text-stone-400 hover:text-white'
              }`}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>

      {/* Target Box: OBIETTIVO RANGE ROVER */}
      <div className="relative overflow-hidden bg-gradient-to-br from-rose-950/40 via-stone-900 to-purple-950/30 border border-rose-900/40 p-5 rounded-3xl shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-amber-900/40">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">Obiettivo Range Rover</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Target {selectedYear}
                </span>
              </div>
              <p className="text-stone-400 text-xs mt-0.5">
                Obiettivo Media Mensile: <span className="font-bold text-white">{targetMonthly} €/mese</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-stone-400 text-[11px] uppercase font-semibold">Media Attuale / Mese</p>
              <p className="text-xl font-black text-rose-400">
                {annualStats.monthlyAverage.toLocaleString('it-IT', { maximumFractionDigits: 0 })} €
              </p>
            </div>
            <div className="border-l border-stone-800 pl-4">
              <p className="text-stone-400 text-[11px] uppercase font-semibold">Fatturato Annuo</p>
              <p className="text-xl font-black text-emerald-400">
                {annualStats.totalRevenue.toLocaleString('it-IT', { maximumFractionDigits: 0 })} €
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-stone-300">Avanzamento target media ({annualStats.activeMonths} mesi attivi)</span>
            <span className="text-amber-400 font-bold">{monthlyProgress}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-stone-800 overflow-hidden p-0.5 border border-stone-700/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 transition-all duration-700 shadow-sm"
              style={{ width: `${monthlyProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Ricavi Totali */}
        <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-stone-400 text-xs font-semibold mb-1">
            <span>Fatturato {selectedYear}</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-white">
            {annualStats.totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 0 })} €
          </p>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-stone-400">
            <span>PMU: {annualStats.pmuRevenue.toLocaleString('it-IT', { maximumFractionDigits: 0 })}€</span>
            <span>•</span>
            <span className="text-pink-400">Spose: {annualStats.weddingRevenue.toLocaleString('it-IT', { maximumFractionDigits: 0 })}€</span>
          </div>
        </div>

        {/* Spese Totali */}
        <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-stone-400 text-xs font-semibold mb-1">
            <span>Spese {selectedYear}</span>
            <Receipt className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-400">
            {annualStats.totalExpenses.toLocaleString('it-IT', { minimumFractionDigits: 0 })} €
          </p>
          <p className="text-[11px] text-stone-500 mt-1">Materiali e gestione</p>
        </div>

        {/* Guadagno Netto */}
        <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-stone-400 text-xs font-semibold mb-1">
            <span>Guadagno Netto</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">
            {annualStats.netProfit.toLocaleString('it-IT', { minimumFractionDigits: 0 })} €
          </p>
          <p className="text-[11px] text-stone-500 mt-1">Al netto delle spese</p>
        </div>

        {/* Spose & Matrimoni */}
        <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-stone-400 text-xs font-semibold mb-1">
            <span>Incasso Matrimoni</span>
            <Heart className="w-4 h-4 text-pink-400 fill-pink-400" />
          </div>
          <p className="text-2xl font-black text-pink-300">
            {annualStats.weddingRevenue.toLocaleString('it-IT', { minimumFractionDigits: 0 })} €
          </p>
          <p className="text-[11px] text-stone-500 mt-1">Prove e matrimoni</p>
        </div>
      </div>

      {/* Monthly Breakdown Table (Excel-like view) */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-stone-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Dettaglio Mese per Mese ({selectedYear})</h3>
            <p className="text-stone-500 text-xs">Confronto ricavi, spese e guadagno netto</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-800/60 text-stone-400 font-semibold uppercase tracking-wider border-b border-stone-800">
              <tr>
                <th className="py-3 px-4">Mese</th>
                <th className="py-3 px-3 text-right">Ricavi PMU</th>
                <th className="py-3 px-3 text-right">Matrimoni</th>
                <th className="py-3 px-3 text-right font-bold text-white">Totale Ricavi</th>
                <th className="py-3 px-3 text-right text-rose-400">Spese</th>
                <th className="py-3 px-4 text-right font-black text-emerald-400">Guadagno Netto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/50 text-stone-200">
              {monthlyData.map(m => (
                <tr key={m.monthIndex} className="hover:bg-stone-800/30 transition-colors">
                  <td className="py-3 px-4 font-bold text-white">
                    {m.monthName}
                  </td>
                  <td className="py-3 px-3 text-right text-stone-300">
                    {m.pmuRevenue > 0 ? `${m.pmuRevenue.toLocaleString('it-IT')} €` : '-'}
                  </td>
                  <td className="py-3 px-3 text-right text-pink-300">
                    {m.weddingRevenue > 0 ? `${m.weddingRevenue.toLocaleString('it-IT')} €` : '-'}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-white">
                    {m.totalRevenue > 0 ? `${m.totalRevenue.toLocaleString('it-IT')} €` : '-'}
                  </td>
                  <td className="py-3 px-3 text-right text-rose-400">
                    {m.expensesTotal > 0 ? `-${m.expensesTotal.toLocaleString('it-IT')} €` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-400">
                    {m.totalRevenue > 0 || m.expensesTotal > 0
                      ? `${m.netProfit.toLocaleString('it-IT')} €`
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Table Footer Totals */}
            <tfoot className="bg-stone-800/90 font-bold text-white border-t-2 border-stone-700">
              <tr>
                <td className="py-3.5 px-4 text-rose-400 uppercase">TOTALE {selectedYear}</td>
                <td className="py-3.5 px-3 text-right">{annualStats.pmuRevenue.toLocaleString('it-IT')} €</td>
                <td className="py-3.5 px-3 text-right text-pink-300">{annualStats.weddingRevenue.toLocaleString('it-IT')} €</td>
                <td className="py-3.5 px-3 text-right font-black text-lg">{annualStats.totalRevenue.toLocaleString('it-IT')} €</td>
                <td className="py-3.5 px-3 text-right text-rose-400">-{annualStats.totalExpenses.toLocaleString('it-IT')} €</td>
                <td className="py-3.5 px-4 text-right font-black text-lg text-emerald-400">{annualStats.netProfit.toLocaleString('it-IT')} €</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

