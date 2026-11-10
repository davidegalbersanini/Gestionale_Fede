import * as XLSX from 'xlsx';
import { Appointment, WeddingService, Expense, Location, GiftVoucher } from '@/types';

export interface ExportFilterOptions {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  periodLabel: string;
}

export interface ExportExcelResult {
  fileName: string;
  localSuccess: boolean;
  driveSuccess: boolean;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveError?: string;
  scopeMissing?: boolean;
}

export async function exportAppointmentsToExcel(params: {
  appointments: Appointment[];
  weddings: WeddingService[];
  expenses: Expense[];
  locations: Location[];
  giftVouchers?: GiftVoucher[];
  filter: ExportFilterOptions;
}): Promise<ExportExcelResult> {
  const { appointments, weddings, expenses, locations, giftVouchers = [], filter } = params;

  const locMap = new Map<string, Location>();
  locations.forEach(l => locMap.set(l.id, l));

  // Filter items by date
  const isWithinRange = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const d = dateStr.slice(0, 10);
    if (filter.startDate && d < filter.startDate) return false;
    if (filter.endDate && d > filter.endDate) return false;
    return true;
  };

  const filteredApps = appointments.filter(a => isWithinRange(a.appointment_date));
  const filteredWeddings = weddings.filter(w => isWithinRange(w.wedding_date));
  const filteredExpenses = expenses.filter(e => isWithinRange(e.date));
  const filteredVouchers = giftVouchers.filter(v => isWithinRange(v.purchase_date));

  // Sort chronological
  filteredApps.sort((a, b) => a.appointment_date.localeCompare(b.appointment_date));
  filteredWeddings.sort((a, b) => a.wedding_date.localeCompare(b.wedding_date));
  filteredExpenses.sort((a, b) => a.date.localeCompare(b.date));
  filteredVouchers.sort((a, b) => a.purchase_date.localeCompare(b.purchase_date));

  // --- SHEET 1: PMU & Trattamenti ---
  const sheet1Data = filteredApps.map(a => {
    const loc = locMap.get(a.location_id);
    const datePart = a.appointment_date.slice(0, 10);
    const hasExplicitTime = a.appointment_date.includes('T') && !a.appointment_date.endsWith('T00:00:00') && !a.appointment_date.endsWith('T00:00:00+00:00');
    const timePart = hasExplicitTime ? a.appointment_date.split('T')[1].slice(0, 5) : '';
    const total = a.total_price !== undefined ? a.total_price : ((Number(a.payment) || 0) + (Number(a.balance) || 0));

    return {
      'Data': datePart,
      'Ora Inizio': timePart || '',
      'Ora Fine': a.end_time || '',
      'Tipologia': a.category === 'generico' ? 'Appuntamento Generico' : (a.is_touch_up ? 'Ritocco PMU' : 'Trattamento PMU'),
      'Cliente': a.client_name,
      'Sede': loc?.name || 'Studio',
      'Indirizzo Sede': loc?.address || '',
      'Trattamento': a.treatment,
      'Totale Servizio (€)': total,
      'Incasso Ricevuto (€)': Number(a.payment) || 0,
      'Da saldare (€)': Number(a.balance) || 0,
      'Stato': a.status,
      'Data Ritocco Prevista': a.touch_up_date || '',
      'Orario Ritocco': a.touch_up_time ? `${a.touch_up_time}${a.touch_up_end_time ? ' - ' + a.touch_up_end_time : ''}` : '',
      'Note': a.notes || '',
    };
  });

  // --- SHEET 2: Eventi & Cerimonie ---
  const sheet2Data = filteredWeddings.map(w => {
    const total = w.total_price !== undefined ? w.total_price : ((Number(w.trial_deposit) || 0) + (Number(w.wedding_balance) || 0));
    return {
      'Data Evento': w.wedding_date.slice(0, 10),
      'Tipologia Evento': w.event_type || 'Matrimonio',
      'Cliente / Sposa': w.bride_name,
      'Indirizzo / Location': w.address || '',
      'Persone Truccate': w.people_count || 1,
      'Totale Evento (€)': total,
      'Acconto Ricevuto (€)': Number(w.trial_deposit) || 0,
      'Da saldare (€)': Number(w.wedding_balance) || 0,
      'Data Prova Trucco': w.trial_date ? w.trial_date.slice(0, 10) : '',
      'Stato': w.status,
      'Note': w.notes || '',
    };
  });

  // --- SHEET 3: Riepilogo & Metriche Economiche ---
  const pmuAppsIncome = filteredApps.reduce((acc, a) => acc + (Number(a.payment) || 0) + (Number(a.balance) || 0), 0);
  const weddingsAppsIncome = filteredWeddings.reduce((acc, w) => {
    const tot = (Number(w.trial_deposit) || 0) + (Number(w.wedding_balance) || 0);
    return acc + (tot > 0 ? tot : (Number(w.total_price) || 0));
  }, 0);

  // Buoni Regalo: sempre assegnati a PMU
  const vouchersTotalIncome = filteredVouchers.reduce((acc, v) => {
    const val = v.initial_amount !== undefined ? v.initial_amount : (Number(v.amount) || 0);
    return acc + val;
  }, 0);

  const totalPmuIncome = pmuAppsIncome + vouchersTotalIncome;
  const totalWeddingsIncome = weddingsAppsIncome;
  const totalRevenue = totalPmuIncome + totalWeddingsIncome;
  const totalExpensesAmount = filteredExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const netEarnings = totalRevenue - totalExpensesAmount;

  // Monthly breakdown for selected range
  const monthlyMap = new Map<string, { pmu: number; weddings: number; expenses: number }>();

  filteredApps.forEach(a => {
    const m = a.appointment_date.slice(0, 7);
    const curr = monthlyMap.get(m) || { pmu: 0, weddings: 0, expenses: 0 };
    curr.pmu += (Number(a.payment) || 0) + (Number(a.balance) || 0);
    monthlyMap.set(m, curr);
  });

  filteredWeddings.forEach(w => {
    const m = w.wedding_date.slice(0, 7);
    const curr = monthlyMap.get(m) || { pmu: 0, weddings: 0, expenses: 0 };
    const tot = (Number(w.trial_deposit) || 0) + (Number(w.wedding_balance) || 0);
    curr.weddings += (tot > 0 ? tot : (Number(w.total_price) || 0));
    monthlyMap.set(m, curr);
  });

  filteredVouchers.forEach(v => {
    const m = v.purchase_date.slice(0, 7);
    const curr = monthlyMap.get(m) || { pmu: 0, weddings: 0, expenses: 0 };
    const val = v.initial_amount !== undefined ? v.initial_amount : (Number(v.amount) || 0);
    curr.pmu += val;
    monthlyMap.set(m, curr);
  });

  filteredExpenses.forEach(e => {
    const m = e.date.slice(0, 7);
    const curr = monthlyMap.get(m) || { pmu: 0, weddings: 0, expenses: 0 };
    curr.expenses += Number(e.amount) || 0;
    monthlyMap.set(m, curr);
  });

  const sortedMonths = Array.from(monthlyMap.keys()).sort();

  const summaryKPIs = [
    { 'METRICA': 'Periodo Selezionato', 'VALORE': filter.periodLabel },
    { 'METRICA': 'Fatturato Totale Complessivo (€)', 'VALORE': totalRevenue.toFixed(2) },
    { 'METRICA': 'Fatturato da PMU & Trattamenti (€)', 'VALORE': `${totalPmuIncome.toFixed(2)} (inclusi ${vouchersTotalIncome.toFixed(2)}€ da buoni regalo)` },
    { 'METRICA': 'Fatturato da Eventi & Cerimonie (€)', 'VALORE': totalWeddingsIncome.toFixed(2) },
    { 'METRICA': 'Spese Totali Sostenute (€)', 'VALORE': totalExpensesAmount.toFixed(2) },
    { 'METRICA': 'Guadagno Netto Effettivo (€)', 'VALORE': netEarnings.toFixed(2) },
    { 'METRICA': 'Numero Trattamenti PMU / Generici', 'VALORE': filteredApps.length },
    { 'METRICA': 'Numero Servizi Eventi / Sposa', 'VALORE': filteredWeddings.length },
    { 'METRICA': 'Numero Buoni Regalo Emessi', 'VALORE': `${filteredVouchers.length} (per un totale di ${vouchersTotalIncome.toFixed(2)}€)` },
    { 'METRICA': 'Totale Appuntamenti Gestiti', 'VALORE': filteredApps.length + filteredWeddings.length },
    { 'METRICA': '', 'VALORE': '' },
    { 'METRICA': '--- DETTAGLIO MESE PER MESE ---', 'VALORE': '' }
  ];

  const monthlyRows = sortedMonths.map(m => {
    const data = monthlyMap.get(m)!;
    const totRev = data.pmu + data.weddings;
    const net = totRev - data.expenses;
    return {
      'METRICA': `Mese: ${m}`,
      'VALORE': `Ricavi PMU: ${data.pmu.toFixed(2)}€ | Eventi: ${data.weddings.toFixed(2)}€ | Tot Ricavi: ${totRev.toFixed(2)}€ | Spese: ${data.expenses.toFixed(2)}€ | Netto: ${net.toFixed(2)}€`
    };
  });

  const sheet3Data = [...summaryKPIs, ...monthlyRows];

  // --- SHEET 4: Buoni Regalo ---
  const sheet4Data = filteredVouchers.map(v => {
    const initVal = v.initial_amount !== undefined ? v.initial_amount : (Number(v.amount) || 0);
    const remVal = v.remaining_amount !== undefined ? v.remaining_amount : (v.is_used ? 0 : initVal);
    let stato = 'Non Usato';
    if (remVal <= 0) stato = 'Completamente Usato';
    else if (remVal < initVal) stato = `Parzialmente Usato (${remVal.toFixed(2)}€ rimasti)`;

    return {
      'Data Acquisto': v.purchase_date,
      'Acquirente': v.buyer_name,
      'Beneficiario': v.recipient_name || 'Non specificato (al primo utilizzo)',
      'Valore Iniziale (€)': initVal,
      'Valore Rimanente (€)': remVal,
      'Stato': stato,
      'Note': v.notes || '',
    };
  });

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Create sheets
  const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
  const ws2 = XLSX.utils.json_to_sheet(sheet2Data);
  const ws3 = XLSX.utils.json_to_sheet(sheet3Data);
  const ws4 = XLSX.utils.json_to_sheet(sheet4Data.length > 0 ? sheet4Data : [{ 'Info': 'Nessun buono regalo nel periodo selezionato' }]);

  // Set nice column widths
  ws1['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 22 }, { wch: 22 },
    { wch: 16 }, { wch: 26 }, { wch: 22 }, { wch: 18 }, { wch: 18 },
    { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 30 }
  ];

  ws2['!cols'] = [
    { wch: 12 }, { wch: 18 }, { wch: 24 }, { wch: 28 }, { wch: 16 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 30 }
  ];

  ws3['!cols'] = [
    { wch: 38 }, { wch: 80 }
  ];

  ws4['!cols'] = [
    { wch: 14 }, { wch: 24 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 35 }, { wch: 35 }
  ];

  // Append sheets
  XLSX.utils.book_append_sheet(wb, ws1, 'PMU & Trattamenti');
  XLSX.utils.book_append_sheet(wb, ws2, 'Eventi & Cerimonie');
  XLSX.utils.book_append_sheet(wb, ws3, 'Riepilogo & Metriche');
  XLSX.utils.book_append_sheet(wb, ws4, 'Buoni Regalo');

  // Generate filename with timestamp (date + hour-minute)
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  const cleanFilter = filter.periodLabel.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
  const fileName = `Gestionale_Fede_Report_${cleanFilter}_${dateStr}_${timeStr}.xlsx`;

  // Upload to Google Drive (solo Drive, nessun salvataggio locale nel browser)
  try {
    const fileBase64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const res = await fetch('/api/drive/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, fileBase64 }),
    });

    const data = await res.json();
    return {
      fileName,
      localSuccess: false,
      driveSuccess: data.success === true,
      driveFileId: data.fileId,
      driveWebViewLink: data.webViewLink,
      driveError: data.error,
      scopeMissing: data.scopeMissing,
    };
  } catch (err: any) {
    return {
      fileName,
      localSuccess: false,
      driveSuccess: false,
      driveError: err.message,
    };
  }
}

