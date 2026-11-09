'use client';

import React, { useState, useMemo } from 'react';
import { Appointment, WeddingService, Expense, Location, AppSettings, GiftVoucher } from '@/types';
import { exportAppointmentsToExcel } from '@/lib/excelExport';
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
  Target,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Gift,
  X
} from 'lucide-react';

interface DashboardViewProps {
  appointments: Appointment[];
  weddings: WeddingService[];
  expenses: Expense[];
  locations: Location[];
  vouchers?: GiftVoucher[];
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onShowToast?: (msg: string) => void;
}

export default function DashboardView({
  appointments,
  weddings,
  expenses,
  locations,
  vouchers = [],
  settings,
  onUpdateSettings,
  onShowToast,
}: DashboardViewProps) {
  const currentYearStr = String(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);

  // Excel Export Modal state
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportRange, setExportRange] = useState<'all' | 'current_year' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  // Distinct years available in data
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(currentYearStr);
    appointments.forEach(a => { if (a.appointment_date) years.add(a.appointment_date.slice(0, 4)); });
    weddings.forEach(w => { if (w.wedding_date) years.add(w.wedding_date.slice(0, 4)); });
    expenses.forEach(e => { if (e.date) years.add(e.date.slice(0, 4)); });
    vouchers.forEach(v => { if (v.purchase_date) years.add(v.purchase_date.slice(0, 4)); });
    return Array.from(years).sort().reverse();
  }, [appointments, weddings, expenses, vouchers, currentYearStr]);

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

    // PMU / Trattamenti
    appointments.forEach(app => {
      if (app.appointment_date && app.appointment_date.startsWith(selectedYear)) {
        const m = parseInt(app.appointment_date.slice(5, 7), 10) - 1;
        if (m >= 0 && m < 12) {
          months[m].pmuRevenue += (app.payment || 0);
          months[m].pmuCount += 1;
        }
      }
    });

    // Eventi & Matrimoni
    weddings.forEach(w => {
      // Event day income
      if (w.wedding_date && w.wedding_date.startsWith(selectedYear)) {
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

    // Buoni Regalo: ricavato aggiunto alla data di acquisto sempre nel PMU (sotto il cofano)
    vouchers.forEach(v => {
      if (v.purchase_date && v.purchase_date.startsWith(selectedYear)) {
        const m = parseInt(v.purchase_date.slice(5, 7), 10) - 1;
        if (m >= 0 && m < 12) {
          const voucherVal = v.initial_amount !== undefined ? v.initial_amount : (v.amount || 0);
          months[m].pmuRevenue += voucherVal;
        }
      }
    });

    // Expenses
    expenses.forEach(e => {
      if (e.date && e.date.startsWith(selectedYear)) {
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
  }, [selectedYear, appointments, weddings, expenses, vouchers]);

  // Annual Totals & Elapsed Months calculation
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

    // Monthly average: for current year, divide ONLY by elapsed months up to now!
    const isCurrentYear = selectedYear === currentYearStr;
    const elapsedMonths = isCurrentYear ? (new Date().getMonth() + 1) : 12;
    const monthlyAverage = totalRev / Math.max(1, elapsedMonths);

    return {
      totalRevenue: totalRev,
      pmuRevenue: totPmu,
      weddingRevenue: totWedding,
      totalExpenses: totExp,
      netProfit: netProf,
      monthlyAverage,
      elapsedMonths,
      isCurrentYear,
    };
  }, [monthlyData, selectedYear, currentYearStr]);

  // Annual Target (only annual target as requested)
  const targetYearly = settings.yearly_target || 35000;
  const yearlyProgress = Math.min(100, Math.round((annualStats.totalRevenue / targetYearly) * 100));

  const handleExecuteExport = async () => {
    let periodLabel = 'Tutto lo storico';
    let start: string | undefined = undefined;
    let end: string | undefined = undefined;

    if (exportRange === 'current_year') {
      periodLabel = `Anno ${currentYearStr}`;
      start = `${currentYearStr}-01-01`;
      end = `${currentYearStr}-12-31`;
    } else if (exportRange === 'custom') {
      periodLabel = `Dal ${customStartDate || 'inizio'} al ${customEndDate || 'oggi'}`;
      start = customStartDate || undefined;
      end = customEndDate || undefined;
    }

    setIsExporting(true);
    try {
      const result = await exportAppointmentsToExcel({
        appointments,
        weddings,
        expenses,
        locations,
        giftVouchers: vouchers,
        filter: {
          startDate: start,
          endDate: end,
          periodLabel,
        },
      });

      setIsExcelModalOpen(false);

      if (result.driveSuccess) {
        if (onShowToast) {
          onShowToast('File Excel salvato sul dispositivo e caricato con successo su Google Drive!');
        }
      } else if (result.scopeMissing) {
        if (onShowToast) {
          onShowToast('File salvato in locale! Riconnetti l\'Account Google nelle Impostazioni per concedere i permessi Drive.');
        }
      } else if (result.driveError?.includes('Account Google non collegato')) {
        if (onShowToast) {
          onShowToast('File salvato sul dispositivo. (Account Google non collegato per Drive).');
        }
      } else {
        if (onShowToast) {
          onShowToast('File salvato sul dispositivo. Nota: caricamento su Google Drive non riuscito.');
        }
      }
    } catch (err: any) {
      console.error('Export error:', err);
      setIsExcelModalOpen(false);
      if (onShowToast) {
        onShowToast('File scaricato sul dispositivo.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Year Switcher & Excel Export Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-900/90 border border-stone-800 p-4 rounded-3xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-rose-500" />
            Riepilogo
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Year Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {availableYears.map(yr => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedYear === yr
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-950/40'
                    : 'bg-stone-800 text-stone-400 hover:text-white'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>

          {/* Excel Export Button */}
          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Esporta Excel</span>
          </button>
        </div>
      </div>

      {/* Target Box: OBIETTIVO ANNUALE RANGE ROVER */}
      <div className="relative overflow-hidden bg-gradient-to-br from-rose-950/40 via-stone-900 to-purple-950/30 border border-rose-900/40 p-4 sm:p-5 rounded-3xl shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-amber-900/40 flex-shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">Target Annuale</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Anno {selectedYear}
                </span>
              </div>
              <p className="text-stone-400 text-xs mt-0.5">
                Obiettivo Annuo: <span className="font-bold text-white">{targetYearly.toLocaleString('it-IT')} €</span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-4 text-right border-t sm:border-t-0 border-stone-800 pt-2 sm:pt-0">
            <div>
              <p className="text-stone-400 text-[11px] uppercase font-semibold">
                Media Mensile ({annualStats.elapsedMonths} mesi)
              </p>
              <p className="text-lg sm:text-xl font-black text-rose-400">
                {annualStats.monthlyAverage.toLocaleString('it-IT', { maximumFractionDigits: 0 })} €/m
              </p>
            </div>
            <div className="border-l border-stone-800 pl-4">
              <p className="text-stone-400 text-[11px] uppercase font-semibold">Fatturato Annuo</p>
              <p className="text-lg sm:text-xl font-black text-emerald-400">
                {annualStats.totalRevenue.toLocaleString('it-IT', { maximumFractionDigits: 0 })} €
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar towards Annual Target */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-stone-300">
              Avanzamento ({annualStats.totalRevenue.toLocaleString('it-IT')}€ / {targetYearly.toLocaleString('it-IT')}€)
            </span>
            <span className="text-amber-400 font-bold">{yearlyProgress}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-stone-800 overflow-hidden p-0.5 border border-stone-700/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 transition-all duration-700 shadow-sm"
              style={{ width: `${yearlyProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* The 4 Requested Specific KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Fatturato Annuo */}
        <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 text-xs font-semibold mb-1">
            <span>Fatturato Annuo</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-white">
              {annualStats.totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 0 })} €
            </p>
          </div>
        </div>

        {/* 2. Spese Annue */}
        <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 text-xs font-semibold mb-1">
            <span>Spese Annue</span>
            <Receipt className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-rose-400">
              {annualStats.totalExpenses.toLocaleString('it-IT', { minimumFractionDigits: 0 })} €
            </p>
          </div>
        </div>

        {/* 3. Fatturato da PMU */}
        <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 text-xs font-semibold mb-1">
            <span>Fatturato PMU</span>
            <Sparkles className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-rose-300">
              {annualStats.pmuRevenue.toLocaleString('it-IT', { minimumFractionDigits: 0 })} €
            </p>
          </div>
        </div>

        {/* 4. Fatturato dai Matrimoni / Eventi */}
        <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400 text-xs font-semibold mb-1">
            <span>Fatturato Eventi</span>
            <Heart className="w-4 h-4 text-pink-400 fill-pink-400" />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black text-pink-300">
              {annualStats.weddingRevenue.toLocaleString('it-IT', { minimumFractionDigits: 0 })} €
            </p>
          </div>
        </div>
      </div>

      {/* Guadagno Netto Highlight Banner */}
      <div className="bg-stone-900/90 border border-stone-800 px-5 py-3 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-stone-300">
            Utile Netto {selectedYear}:
          </span>
        </div>
        <span className="text-lg font-black text-emerald-400">
          {annualStats.netProfit.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        </span>
      </div>

      {/* Monthly Breakdown Container: Zero Horizontal Scroll on iPhone 17 */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-stone-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Dettaglio Mese per Mese ({selectedYear})</h3>
          </div>
        </div>

        {/* Desktop / Tablet Table View (hidden on mobile) */}
        <div className="hidden md:block">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-800/60 text-stone-400 font-semibold uppercase tracking-wider border-b border-stone-800">
              <tr>
                <th className="py-3 px-4">Mese</th>
                <th className="py-3 px-3 text-right">Ricavi PMU</th>
                <th className="py-3 px-3 text-right">Eventi / Spose</th>
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

        {/* Mobile View (iPhone 17 & smartphones): Zero horizontal scroll cards */}
        <div className="block md:hidden divide-y divide-stone-800/70 p-3 space-y-2.5">
          {monthlyData.map(m => {
            const hasActivity = m.totalRevenue > 0 || m.expensesTotal > 0;
            return (
              <div
                key={m.monthIndex}
                className={`p-3 rounded-2xl border transition-all ${
                  hasActivity
                    ? 'bg-stone-800/50 border-stone-700/60'
                    : 'bg-stone-800/20 border-stone-800/40 opacity-60'
                }`}
              >
                {/* Month Name & Net Profit Header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white text-sm">{m.monthName}</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                      m.netProfit > 0
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                        : m.netProfit < 0
                        ? 'bg-rose-950/60 text-rose-400 border border-rose-800/50'
                        : 'text-stone-500'
                    }`}
                  >
                    {hasActivity ? `Netto: ${m.netProfit.toLocaleString('it-IT')} €` : 'Nessuna attività'}
                  </span>
                </div>

                {/* 2x2 Grid with exact metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-stone-900/60 p-2 rounded-xl border border-stone-800/60">
                    <span className="text-[10px] text-stone-400 block uppercase font-medium">PMU</span>
                    <span className="text-stone-200 font-bold">{m.pmuRevenue.toLocaleString('it-IT')} €</span>
                  </div>
                  <div className="bg-stone-900/60 p-2 rounded-xl border border-stone-800/60">
                    <span className="text-[10px] text-pink-400 block uppercase font-medium">Eventi</span>
                    <span className="text-pink-300 font-bold">{m.weddingRevenue.toLocaleString('it-IT')} €</span>
                  </div>
                  <div className="bg-stone-900/60 p-2 rounded-xl border border-stone-800/60">
                    <span className="text-[10px] text-white block uppercase font-bold">Totale Ricavi</span>
                    <span className="text-white font-black">{m.totalRevenue.toLocaleString('it-IT')} €</span>
                  </div>
                  <div className="bg-stone-900/60 p-2 rounded-xl border border-stone-800/60">
                    <span className="text-[10px] text-rose-400 block uppercase font-medium">Spese</span>
                    <span className="text-rose-400 font-bold">-{m.expensesTotal.toLocaleString('it-IT')} €</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Mobile Footer Totals Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-stone-800 to-stone-900 border-2 border-stone-700 mt-3 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-stone-700/60">
              <span className="text-xs font-black uppercase text-rose-400">TOTALE {selectedYear}</span>
              <span className="text-base font-black text-emerald-400">
                Netto: {annualStats.netProfit.toLocaleString('it-IT')} €
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-stone-400 block">Ricavi PMU</span>
                <span className="font-bold text-white">{annualStats.pmuRevenue.toLocaleString('it-IT')} €</span>
              </div>
              <div>
                <span className="text-[10px] text-pink-400 block">Ricavi Eventi</span>
                <span className="font-bold text-pink-300">{annualStats.weddingRevenue.toLocaleString('it-IT')} €</span>
              </div>
              <div>
                <span className="text-[10px] text-emerald-400 block font-bold">Totale Fatturato</span>
                <span className="font-black text-emerald-400 text-sm">{annualStats.totalRevenue.toLocaleString('it-IT')} €</span>
              </div>
              <div>
                <span className="text-[10px] text-rose-400 block font-medium">Totale Spese</span>
                <span className="font-black text-rose-400 text-sm">-{annualStats.totalExpenses.toLocaleString('it-IT')} €</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Excel Export Modal */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md p-6 shadow-2xl text-stone-100">
            <div className="flex items-center justify-between pb-4 border-b border-stone-800 mb-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Esporta Report Excel (.xlsx)</h3>
              </div>
              <button
                onClick={() => setIsExcelModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider">
                  Periodo
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportRange('all')}
                    className={`p-3 rounded-xl text-left border text-xs font-semibold transition-all ${
                      exportRange === 'all'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                        : 'bg-stone-800/60 border-stone-700/60 text-stone-400 hover:text-white'
                    }`}
                  >
                    Tutto lo storico
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportRange('current_year')}
                    className={`p-3 rounded-xl text-left border text-xs font-semibold transition-all ${
                      exportRange === 'current_year'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                        : 'bg-stone-800/60 border-stone-700/60 text-stone-400 hover:text-white'
                    }`}
                  >
                    Anno in corso ({currentYearStr})
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportRange('custom')}
                    className={`p-3 rounded-xl text-left border text-xs font-semibold transition-all ${
                      exportRange === 'custom'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                        : 'bg-stone-800/60 border-stone-700/60 text-stone-400 hover:text-white'
                    }`}
                  >
                    Personalizzato
                  </button>
                </div>
              </div>

              {exportRange === 'custom' && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs text-stone-400 mb-1">Da data</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={e => setCustomStartDate(e.target.value)}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-400 mb-1">A data</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={e => setCustomEndDate(e.target.value)}
                      className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsExcelModalOpen(false)}
                  disabled={isExporting}
                  className="flex-1 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-50 text-stone-300 text-xs font-semibold"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleExecuteExport}
                  disabled={isExporting}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Esportazione...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Esporta</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
