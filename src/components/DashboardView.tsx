'use client';

import React, { useState, useMemo } from 'react';
import { Appointment, WeddingService, Expense, Location, AppSettings, GiftVoucher, ToastVariant } from '@/types';
import { downloadAppointmentsExcel, exportAppointmentsToExcel } from '@/lib/excelExport';
import { computeMonthlyFinancials } from '@/lib/finance';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  Heart,
  Sparkles,
  Award,
  ArrowUpRight,
  FileSpreadsheet,
  Download,
  UploadCloud,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
  X,
} from 'lucide-react';

interface DashboardViewProps {
  appointments: Appointment[];
  weddings: WeddingService[];
  expenses: Expense[];
  locations: Location[];
  vouchers?: GiftVoucher[];
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onShowToast?: (msg: string, variant?: ToastVariant) => void;
}

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

export default function DashboardView({
  appointments,
  weddings,
  expenses,
  locations,
  vouchers = [],
  settings,
  onShowToast,
}: DashboardViewProps) {
  const nowDate = new Date();
  const currentYearStr = String(nowDate.getFullYear());
  const currentMonthIdx = nowDate.getMonth();
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);

  // Excel Export Modal state
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [exportAction, setExportAction] = useState<'download' | 'drive' | null>(null);
  const [exportRange, setExportRange] = useState<'all' | 'selected_year' | 'current_month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [exportSuccessInfo, setExportSuccessInfo] = useState<{ fileName: string; webViewLink?: string } | null>(null);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(currentYearStr);
    appointments.forEach(a => {
      if (a.appointment_date) years.add(a.appointment_date.slice(0, 4));
    });
    weddings.forEach(w => {
      if (w.wedding_date) years.add(w.wedding_date.slice(0, 4));
    });
    expenses.forEach(e => {
      if (e.date) years.add(e.date.slice(0, 4));
    });
    vouchers.forEach(v => {
      if (v.purchase_date) years.add(v.purchase_date.slice(0, 4));
    });
    return Array.from(years).sort().reverse();
  }, [appointments, weddings, expenses, vouchers, currentYearStr]);

  const { months: monthlyData, annual: annualStats } = useMemo(() => {
    return computeMonthlyFinancials(selectedYear, appointments, weddings, expenses, vouchers);
  }, [selectedYear, appointments, weddings, expenses, vouchers]);

  const targetYearly = settings.yearly_target || 35000;
  const yearlyProgress = Math.min(100, Math.round((annualStats.totalRevenue / targetYearly) * 100));

  const buildFilterOptions = () => {
    let periodLabel = 'Tutto lo storico';
    let start: string | undefined;
    let end: string | undefined;

    if (exportRange === 'selected_year') {
      periodLabel = `Anno ${selectedYear}`;
      start = `${selectedYear}-01-01`;
      end = `${selectedYear}-12-31`;
    } else if (exportRange === 'current_month') {
      const mPadded = String(currentMonthIdx + 1).padStart(2, '0');
      const lastDay = new Date(Number(currentYearStr), currentMonthIdx + 1, 0).getDate();
      periodLabel = `${MONTH_NAMES[currentMonthIdx]} ${currentYearStr}`;
      start = `${currentYearStr}-${mPadded}-01`;
      end = `${currentYearStr}-${mPadded}-${String(lastDay).padStart(2, '0')}`;
    } else if (exportRange === 'custom') {
      periodLabel = `Dal ${customStartDate || 'inizio'} al ${customEndDate || 'oggi'}`;
      start = customStartDate || undefined;
      end = customEndDate || undefined;
    }

    return { startDate: start, endDate: end, periodLabel };
  };

  const handleDownloadLocalExcel = async () => {
    setExportAction('download');
    try {
      const result = await downloadAppointmentsExcel({
        appointments,
        weddings,
        expenses,
        locations,
        giftVouchers: vouchers,
        filter: buildFilterOptions(),
      });

      if (result.localSuccess) {
        setIsExcelModalOpen(false);
        onShowToast?.(`Report "${result.fileName}" scaricato sul dispositivo.`, 'success');
      } else {
        onShowToast?.(result.error || 'Errore durante il download del report Excel.', 'error');
      }
    } catch {
      onShowToast?.('Errore durante la generazione del report Excel.', 'error');
    } finally {
      setExportAction(null);
    }
  };

  const handleExecuteDriveExport = async () => {
    setExportAction('drive');
    try {
      const result = await exportAppointmentsToExcel({
        appointments,
        weddings,
        expenses,
        locations,
        giftVouchers: vouchers,
        filter: buildFilterOptions(),
      });

      if (result.driveSuccess) {
        setExportSuccessInfo({
          fileName: result.fileName,
          webViewLink: result.driveWebViewLink,
        });
        onShowToast?.('Report Excel caricato con successo su Google Drive!', 'success');
      } else {
        setIsExcelModalOpen(false);
        if (result.scopeMissing) {
          onShowToast?.(
            "Caricamento non riuscito: ricollega l'Account Google nelle Impostazioni per concedere i permessi Drive.",
            'error'
          );
        } else if (result.driveError?.includes('Account Google non collegato')) {
          onShowToast?.(
            'Errore: collega prima il tuo Account Google nelle Impostazioni per caricare il file su Drive.',
            'error'
          );
        } else {
          onShowToast?.(
            `Caricamento su Drive non riuscito: ${result.driveError || 'Verifica la connessione Google'}`,
            'error'
          );
        }
      }
    } catch (err) {
      console.error('Export error:', err);
      setIsExcelModalOpen(false);
      onShowToast?.('Errore durante la generazione o il caricamento del report su Google Drive.', 'error');
    } finally {
      setExportAction(null);
    }
  };

  const isBusy = exportAction !== null;

  return (
    <div className="space-y-5 min-w-0 max-w-full">
      {/* Header & Year Switcher & Excel Export Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-stone-200 p-4 rounded-3xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-rose-500" />
            Riepilogo
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full scrollbar-none">
            {availableYears.map(yr => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                  selectedYear === yr
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-200/60'
                    : 'bg-stone-100 text-stone-500 hover:text-stone-900'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setExportSuccessInfo(null);
              setIsExcelModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-500/40 text-emerald-700 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-sm shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Esporta Excel</span>
          </button>
        </div>
      </div>

      {/* Target Box */}
      <div className="relative overflow-hidden bg-gradient-to-br from-rose-50 via-white to-amber-50/60 border border-rose-200 p-4 sm:p-5 rounded-3xl shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-amber-200/60 flex-shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-stone-900">Target Annuale</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-500/30">
                  Anno {selectedYear}
                </span>
              </div>
              <p className="text-stone-500 text-xs mt-0.5">
                Obiettivo Annuo: <span className="font-bold text-stone-900">{targetYearly.toLocaleString('it-IT')} €</span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 text-left sm:text-right border-t sm:border-t-0 border-stone-200 pt-2 sm:pt-0 min-w-0">
            <div className="min-w-0">
              <p className="text-stone-500 text-[11px] uppercase font-semibold">
                Media Mensile ({annualStats.elapsedMonths} mesi)
              </p>
              <p className="text-lg sm:text-xl font-black text-rose-600 truncate">
                {annualStats.monthlyAverage.toLocaleString('it-IT', { maximumFractionDigits: 0 })} €/m
              </p>
            </div>
            <div className="border-l border-stone-200 pl-3 sm:pl-4 min-w-0">
              <p className="text-stone-500 text-[11px] uppercase font-semibold">Fatturato Annuo</p>
              <p className="text-lg sm:text-xl font-black text-emerald-600 truncate">
                {annualStats.totalRevenue.toLocaleString('it-IT', { maximumFractionDigits: 0 })} €
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between gap-2 text-xs font-semibold min-w-0">
            <span className="text-stone-700 truncate">
              Avanzamento ({annualStats.totalRevenue.toLocaleString('it-IT')}€ / {targetYearly.toLocaleString('it-IT')}€)
            </span>
            <span className="text-amber-600 font-bold shrink-0">{yearlyProgress}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-stone-100 overflow-hidden p-0.5 border border-stone-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 transition-all duration-700 shadow-sm"
              style={{ width: `${yearlyProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4 Specific KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white border border-stone-200 p-3 sm:p-4 rounded-2xl flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1 text-stone-500 text-xs font-semibold mb-1">
            <span className="truncate">Fatturato Annuo</span>
            <DollarSign className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="min-w-0">
            <p className="text-lg sm:text-2xl font-black text-stone-900 truncate">
              {annualStats.totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 0 })} €
            </p>
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-3 sm:p-4 rounded-2xl flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1 text-stone-500 text-xs font-semibold mb-1">
            <span className="truncate">Spese Annue</span>
            <Receipt className="w-4 h-4 text-rose-600 shrink-0" />
          </div>
          <div className="min-w-0">
            <p className="text-lg sm:text-2xl font-black text-rose-600 truncate">
              {annualStats.totalExpenses.toLocaleString('it-IT', { minimumFractionDigits: 0 })} €
            </p>
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-3 sm:p-4 rounded-2xl flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1 text-stone-500 text-xs font-semibold mb-1">
            <span className="truncate">Fatturato PMU</span>
            <Sparkles className="w-4 h-4 text-rose-600 shrink-0" />
          </div>
          <div className="min-w-0">
            <p className="text-lg sm:text-2xl font-black text-rose-700 truncate">
              {annualStats.pmuRevenue.toLocaleString('it-IT', { minimumFractionDigits: 0 })} €
            </p>
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-3 sm:p-4 rounded-2xl flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-1 text-stone-500 text-xs font-semibold mb-1">
            <span className="truncate">Fatturato Eventi</span>
            <Heart className="w-4 h-4 text-pink-600 fill-pink-400 shrink-0" />
          </div>
          <div className="min-w-0">
            <p className="text-lg sm:text-2xl font-black text-pink-700 truncate">
              {annualStats.weddingRevenue.toLocaleString('it-IT', { minimumFractionDigits: 0 })} €
            </p>
          </div>
        </div>
      </div>

      {/* Guadagno Netto & Crediti Da Saldare */}
      <div className="bg-white border border-stone-200 px-5 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-semibold text-stone-700">
            Utile Netto {selectedYear}:
          </span>
          <span className="text-lg font-black text-emerald-600">
            {annualStats.netProfit.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </span>
        </div>

        {annualStats.totalPendingBalance > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-300 px-3 py-1 rounded-xl">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>
              Da saldare: {annualStats.totalPendingBalance.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
          </div>
        )}
      </div>

      {/* Monthly Breakdown */}
      <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-stone-900">Dettaglio Mese per Mese ({selectedYear})</h3>
          </div>
        </div>

        {/* Desktop / Tablet Table View */}
        <div className="hidden md:block">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-500 font-semibold uppercase tracking-wider border-b border-stone-200">
              <tr>
                <th className="py-3 px-4">Mese</th>
                <th className="py-3 px-3 text-right">Ricavi PMU</th>
                <th className="py-3 px-3 text-right">Eventi / Spose</th>
                <th className="py-3 px-3 text-right font-bold text-stone-900">Totale Ricavi</th>
                <th className="py-3 px-3 text-right text-rose-600">Spese</th>
                <th className="py-3 px-4 text-right font-black text-emerald-600">Guadagno Netto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-800">
              {monthlyData.map(m => (
                <tr key={m.monthIndex} className="hover:bg-stone-50/80 transition-colors">
                  <td className="py-3 px-4 font-bold text-stone-900">{m.monthName}</td>
                  <td className="py-3 px-3 text-right text-stone-700">
                    {m.pmuRevenue > 0 ? `${m.pmuRevenue.toLocaleString('it-IT')} €` : '-'}
                  </td>
                  <td className="py-3 px-3 text-right text-pink-700">
                    {m.weddingRevenue > 0 ? `${m.weddingRevenue.toLocaleString('it-IT')} €` : '-'}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-stone-900">
                    {m.totalRevenue > 0 ? `${m.totalRevenue.toLocaleString('it-IT')} €` : '-'}
                  </td>
                  <td className="py-3 px-3 text-right text-rose-600">
                    {m.expensesTotal > 0 ? `-${m.expensesTotal.toLocaleString('it-IT')} €` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-600">
                    {m.totalRevenue > 0 || m.expensesTotal > 0
                      ? `${m.netProfit.toLocaleString('it-IT')} €`
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-stone-100 font-bold text-stone-900 border-t-2 border-stone-300">
              <tr>
                <td className="py-3.5 px-4 text-rose-600 uppercase">TOTALE {selectedYear}</td>
                <td className="py-3.5 px-3 text-right">{annualStats.pmuRevenue.toLocaleString('it-IT')} €</td>
                <td className="py-3.5 px-3 text-right text-pink-700">{annualStats.weddingRevenue.toLocaleString('it-IT')} €</td>
                <td className="py-3.5 px-3 text-right font-black text-lg">{annualStats.totalRevenue.toLocaleString('it-IT')} €</td>
                <td className="py-3.5 px-3 text-right text-rose-600">-{annualStats.totalExpenses.toLocaleString('it-IT')} €</td>
                <td className="py-3.5 px-4 text-right font-black text-lg text-emerald-600">{annualStats.netProfit.toLocaleString('it-IT')} €</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile View */}
        <div className="block md:hidden p-3 space-y-2.5">
          {monthlyData.map(m => {
            const hasActivity = m.totalRevenue > 0 || m.expensesTotal > 0;
            return (
              <div
                key={m.monthIndex}
                className={`p-3 rounded-2xl border transition-all min-w-0 ${
                  hasActivity
                    ? 'bg-stone-50 border-stone-200'
                    : 'bg-stone-50/50 border-stone-200/70 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-stone-900 text-sm">{m.monthName}</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                      m.netProfit > 0
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : m.netProfit < 0
                        ? 'bg-rose-100/60 text-rose-600 border border-rose-800/50'
                        : 'text-stone-500'
                    }`}
                  >
                    {hasActivity ? `Netto: ${m.netProfit.toLocaleString('it-IT')} €` : 'Nessuna attività'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2 rounded-xl border border-stone-200 min-w-0">
                    <span className="text-[10px] text-stone-500 block uppercase font-medium">PMU</span>
                    <span className="text-stone-800 font-bold truncate block">{m.pmuRevenue.toLocaleString('it-IT')} €</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-stone-200 min-w-0">
                    <span className="text-[10px] text-pink-600 block uppercase font-medium">Eventi</span>
                    <span className="text-pink-700 font-bold truncate block">{m.weddingRevenue.toLocaleString('it-IT')} €</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-stone-200 min-w-0">
                    <span className="text-[10px] text-stone-900 block uppercase font-bold">Totale Ricavi</span>
                    <span className="text-stone-900 font-black truncate block">{m.totalRevenue.toLocaleString('it-IT')} €</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-stone-200 min-w-0">
                    <span className="text-[10px] text-rose-600 block uppercase font-medium">Spese</span>
                    <span className="text-rose-600 font-bold truncate block">-{m.expensesTotal.toLocaleString('it-IT')} €</span>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="p-4 rounded-2xl bg-gradient-to-br from-stone-50 to-stone-100 border-2 border-stone-300 mt-3 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200">
              <span className="text-xs font-black uppercase text-rose-600">TOTALE {selectedYear}</span>
              <span className="text-base font-black text-emerald-600">
                Netto: {annualStats.netProfit.toLocaleString('it-IT')} €
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="min-w-0">
                <span className="text-[10px] text-stone-500 block">Ricavi PMU</span>
                <span className="font-bold text-stone-900 truncate block">{annualStats.pmuRevenue.toLocaleString('it-IT')} €</span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-pink-600 block">Ricavi Eventi</span>
                <span className="font-bold text-pink-700 truncate block">{annualStats.weddingRevenue.toLocaleString('it-IT')} €</span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-emerald-600 block font-bold">Totale Fatturato</span>
                <span className="font-black text-emerald-600 text-sm truncate block">{annualStats.totalRevenue.toLocaleString('it-IT')} €</span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-rose-600 block font-medium">Totale Spese</span>
                <span className="font-black text-rose-600 text-sm truncate block">-{annualStats.totalExpenses.toLocaleString('it-IT')} €</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Excel Export Modal */}
      {isExcelModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/35 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={e => {
            if (e.target === e.currentTarget && !isBusy) {
              setExportSuccessInfo(null);
              setIsExcelModalOpen(false);
            }
          }}
        >
          <div className="bg-white border border-stone-200 rounded-3xl w-full max-w-md max-h-[90dvh] overflow-y-auto overflow-x-hidden p-4 sm:p-6 shadow-2xl text-stone-900">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 mb-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-stone-900">Esporta Report Excel</h3>
              </div>
              <button
                onClick={() => {
                  setExportSuccessInfo(null);
                  setIsExcelModalOpen(false);
                }}
                disabled={isBusy}
                className="text-stone-500 hover:text-stone-900 disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {exportSuccessInfo ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-500/40 flex flex-col items-center text-center gap-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                  <h4 className="text-sm font-bold text-stone-900">Report caricato con successo!</h4>
                  <p className="text-xs text-stone-700 break-all">{exportSuccessInfo.fileName}</p>
                  <p className="text-[11px] text-emerald-700">
                    Cartella Drive: <span className="font-semibold">Gestionale Fede - Report</span>
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  {exportSuccessInfo.webViewLink && (
                    <a
                      href={exportSuccessInfo.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-200/70 transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Apri File su Google Drive</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setExportSuccessInfo(null);
                      setIsExcelModalOpen(false);
                    }}
                    className="py-2.5 px-5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold"
                  >
                    Chiudi
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    Periodo
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setExportRange('all')}
                      className={`p-3 rounded-xl text-left border text-xs font-semibold transition-all ${
                        exportRange === 'all'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                          : 'bg-stone-50 border-stone-200 text-stone-500 hover:text-stone-900'
                      }`}
                    >
                      Tutto lo storico
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportRange('selected_year')}
                      className={`p-3 rounded-xl text-left border text-xs font-semibold transition-all ${
                        exportRange === 'selected_year'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                          : 'bg-stone-50 border-stone-200 text-stone-500 hover:text-stone-900'
                      }`}
                    >
                      Anno selezionato ({selectedYear})
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportRange('current_month')}
                      className={`p-3 rounded-xl text-left border text-xs font-semibold transition-all ${
                        exportRange === 'current_month'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                          : 'bg-stone-50 border-stone-200 text-stone-500 hover:text-stone-900'
                      }`}
                    >
                      Mese corrente ({MONTH_NAMES[currentMonthIdx]} {currentYearStr})
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportRange('custom')}
                      className={`p-3 rounded-xl text-left border text-xs font-semibold transition-all ${
                        exportRange === 'custom'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                          : 'bg-stone-50 border-stone-200 text-stone-500 hover:text-stone-900'
                      }`}
                    >
                      Personalizzato
                    </button>
                  </div>
                </div>

                {exportRange === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="min-w-0">
                      <label className="block text-xs text-stone-500 mb-1">Da data</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={e => setCustomStartDate(e.target.value)}
                        className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 text-xs"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-xs text-stone-500 mb-1">A data</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={e => setCustomEndDate(e.target.value)}
                        className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={handleDownloadLocalExcel}
                    disabled={isBusy}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 disabled:opacity-50 border border-stone-300 text-stone-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    {exportAction === 'download' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Generazione...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 text-emerald-600" />
                        <span>Scarica Excel</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteDriveExport}
                    disabled={isBusy}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-200/70 transition-all"
                  >
                    {exportAction === 'drive' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Caricamento...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4" />
                        <span>Carica su Drive</span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsExcelModalOpen(false)}
                  disabled={isBusy}
                  className="w-full py-2 text-stone-500 hover:text-stone-900 text-xs font-medium disabled:opacity-40"
                >
                  Annulla
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
