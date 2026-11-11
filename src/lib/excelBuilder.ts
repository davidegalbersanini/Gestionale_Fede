import ExcelJS from 'exceljs';
import { Appointment, WeddingService, Expense, Location, GiftVoucher } from '@/types';

export interface ExportFilterOptions {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  periodLabel: string;
}

export interface ExcelReportInput {
  appointments: Appointment[];
  weddings: WeddingService[];
  expenses: Expense[];
  locations: Location[];
  giftVouchers?: GiftVoucher[];
  filter: ExportFilterOptions;
}

const CURRENCY_FMT = '#,##0.00 "€";[Red]-#,##0.00 "€";0.00 "€"';
const DATE_FMT = 'dd/mm/yyyy';
const PCT_FMT = '0.0%';
const INT_FMT = '#,##0';

const COLORS = {
  primaryDark: 'FF234737',     // Corporate Dark Sage / Forest
  headerBg: 'FF34624D',        // Table Header Sage
  sectionBg: 'FFEBF2EE',       // Soft Sage Section Banner
  totalBg: 'FFDCE9E2',         // Total Row Soft Sage
  zebraBg: 'FFF7FAF8',         // Subtle Sage Zebra Row
  white: 'FFFFFFFF',
  border: 'FFC9D6CF',          // Light Sage Border
  textDark: 'FF1E293B',
  textSageDark: 'FF1B3A2B',
  textMuted: 'FF64748B',
  amberBg: 'FFFEF3C7',
  amberText: 'FFB45309',
  greenBg: 'FFDCFCE7',
  greenText: 'FF166534',
  skyBg: 'FFE0F2FE',
  skyText: 'FF0369A1',
  redBg: 'FFFEE2E2',
  redText: 'FFB91C1C',
  slateBg: 'FFF1F5F9',
};

const MONTH_NAMES_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: COLORS.border } },
  left: { style: 'thin', color: { argb: COLORS.border } },
  bottom: { style: 'thin', color: { argb: COLORS.border } },
  right: { style: 'thin', color: { argb: COLORS.border } },
};

const TOTAL_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: COLORS.primaryDark } },
  left: { style: 'thin', color: { argb: COLORS.border } },
  bottom: { style: 'double', color: { argb: COLORS.primaryDark } },
  right: { style: 'thin', color: { argb: COLORS.border } },
};

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function parseIsoToUtcDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const match = dateStr.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function formatDateIt(dateStr?: string | null): string {
  if (!dateStr) return '';
  const match = dateStr.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateStr;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function styleBanner(
  ws: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  colCount: number
) {
  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.white } };
  titleCell.fill = solidFill(COLORS.primaryDark);
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, colCount);
  const subCell = ws.getCell(2, 1);
  subCell.value = subtitle;
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.textSageDark } };
  subCell.fill = solidFill(COLORS.sectionBg);
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 20;
}

function styleTableHeader(
  row: ExcelJS.Row,
  headers: string[],
  numericCols: Set<number> = new Set(),
  centeredCols: Set<number> = new Set()
) {
  row.height = 26;
  headers.forEach((h, idx) => {
    const colNum = idx + 1;
    const cell = row.getCell(colNum);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.white } };
    cell.fill = solidFill(COLORS.headerBg);
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.primaryDark } },
      bottom: { style: 'medium', color: { argb: COLORS.primaryDark } },
      left: { style: 'thin', color: { argb: COLORS.primaryDark } },
      right: { style: 'thin', color: { argb: COLORS.primaryDark } },
    };
    const horizontal: ExcelJS.Alignment['horizontal'] = numericCols.has(colNum)
      ? 'right'
      : centeredCols.has(colNum)
      ? 'center'
      : 'left';
    cell.alignment = { vertical: 'middle', horizontal, wrapText: true };
  });
}

function styleEmptyPlaceholder(ws: ExcelJS.Worksheet, rowNum: number, colCount: number, message: string) {
  ws.mergeCells(rowNum, 1, rowNum, colCount);
  const cell = ws.getCell(rowNum, 1);
  cell.value = message;
  cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.textMuted } };
  cell.fill = solidFill(COLORS.zebraBg);
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(rowNum).height = 24;
  for (let c = 1; c <= colCount; c++) {
    ws.getCell(rowNum, c).border = THIN_BORDER;
  }
}

function configureSheetPrintAndFreeze(
  ws: ExcelJS.Worksheet,
  freezeRow: number,
  colCount: number,
  lastFilterRow: number,
  enableAutoFilter: boolean
) {
  ws.views = [{ state: 'frozen', ySplit: freezeRow, topLeftCell: `A${freezeRow + 1}` }];
  if (enableAutoFilter && lastFilterRow >= freezeRow) {
    ws.autoFilter = {
      from: { row: freezeRow, column: 1 },
      to: { row: lastFilterRow, column: colCount },
    };
  }
  ws.pageSetup = {
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
}

function applyStatusBadge(cell: ExcelJS.Cell, status: string) {
  const s = (status || '').toLowerCase();
  if (s === 'completato' || s === 'completamente usato') {
    cell.fill = solidFill(COLORS.greenBg);
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.greenText } };
  } else if (s === 'programmato' || s === 'non usato') {
    cell.fill = solidFill(COLORS.skyBg);
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.skyText } };
  } else if (s.includes('parzialmente')) {
    cell.fill = solidFill(COLORS.amberBg);
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.amberText } };
  } else if (s === 'annullato') {
    cell.fill = solidFill(COLORS.slateBg);
    cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.textMuted } };
  }
}

function applyBalanceHighlight(cell: ExcelJS.Cell, amount: number, isCancelled: boolean) {
  if (isCancelled) {
    cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.textMuted } };
    return;
  }
  if (amount > 0.005) {
    cell.fill = solidFill(COLORS.amberBg);
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.amberText } };
  } else {
    cell.fill = solidFill(COLORS.greenBg);
    cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.greenText } };
  }
}

function buildPmuSheet(
  wb: ExcelJS.Workbook,
  apps: Appointment[],
  locMap: Map<string, Location>,
  subtitle: string
) {
  const ws = wb.addWorksheet('PMU & Trattamenti', { properties: { tabColor: { argb: COLORS.headerBg } } });
  const headers = [
    'Data', 'Orario', 'Tipologia', 'Cliente', 'Sede', 'Trattamento',
    'Totale (€)', 'Incassato (€)', 'Buono Usato (€)', 'Da Saldare (€)',
    'Stato', 'Ritocco Previsto', 'Note',
  ];
  const colWidths = [13, 15, 20, 22, 18, 24, 15, 15, 15, 15, 14, 19, 32];
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  styleBanner(ws, 'PMU & TRATTAMENTI — DETTAGLIO APPUNTAMENTI', subtitle, headers.length);
  styleTableHeader(
    ws.getRow(3),
    headers,
    new Set([7, 8, 9, 10]),
    new Set([1, 2, 11])
  );

  let rowNum = 4;
  let sumTotal = 0;
  let sumPaid = 0;
  let sumVoucher = 0;
  let sumBalance = 0;

  if (apps.length === 0) {
    styleEmptyPlaceholder(ws, rowNum, headers.length, 'Nessun trattamento o appuntamento nel periodo selezionato');
    rowNum++;
  } else {
    apps.forEach((a, idx) => {
      const row = ws.getRow(rowNum);
      row.height = 21;
      const isCancelled = a.status === 'annullato';
      const baseFill = solidFill(idx % 2 === 1 ? COLORS.zebraBg : COLORS.white);

      const hasExplicitTime =
        a.appointment_date.includes('T') &&
        !a.appointment_date.endsWith('T00:00:00') &&
        !a.appointment_date.endsWith('T00:00:00+00:00');
      const startTime = hasExplicitTime ? a.appointment_date.split('T')[1].slice(0, 5) : '';
      const timeRange = startTime ? (a.end_time ? `${startTime} - ${a.end_time}` : startTime) : '-';

      const paid = Number(a.payment) || 0;
      const voucherUsed = a.used_gift_voucher ? (Number(a.used_gift_voucher_amount) || 0) : 0;
      const balance = Number(a.balance) || 0;
      const total = a.total_price !== undefined && a.total_price !== null
        ? Number(a.total_price)
        : paid + voucherUsed + balance;

      if (!isCancelled) {
        sumTotal += total;
        sumPaid += paid;
        sumVoucher += voucherUsed;
        sumBalance += balance;
      }

      const touchUpLabel = a.touch_up_date
        ? `${formatDateIt(a.touch_up_date)}${a.touch_up_time ? ' ' + a.touch_up_time : ''}`
        : '';

      const locName = locMap.get(a.location_id)?.name || 'Studio';
      const tipo = a.category === 'generico'
        ? 'Generico'
        : a.is_touch_up
        ? 'Ritocco PMU'
        : 'Trattamento PMU';

      const values: (Date | string | number | null)[] = [
        parseIsoToUtcDate(a.appointment_date),
        timeRange,
        tipo,
        a.client_name,
        locName,
        a.treatment,
        total,
        paid,
        voucherUsed,
        balance,
        a.status,
        touchUpLabel,
        a.notes || '',
      ];

      values.forEach((val, cIdx) => {
        const colNum = cIdx + 1;
        const cell = row.getCell(colNum);
        cell.value = val;
        cell.border = THIN_BORDER;
        cell.fill = baseFill;
        cell.font = {
          name: 'Calibri',
          size: 10,
          strike: isCancelled,
          color: { argb: isCancelled ? COLORS.textMuted : COLORS.textDark },
        };

        if (colNum === 1) {
          cell.numFmt = DATE_FMT;
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNum === 2 || colNum === 11) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNum >= 7 && colNum <= 10) {
          cell.numFmt = CURRENCY_FMT;
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: colNum === 13 };
        }
      });

      applyBalanceHighlight(row.getCell(10), balance, isCancelled);
      applyStatusBadge(row.getCell(11), a.status);

      rowNum++;
    });
  }

  const lastDataRow = apps.length > 0 ? 3 + apps.length : 3;
  const totalRowNum = rowNum;
  const totalRow = ws.getRow(totalRowNum);
  totalRow.height = 24;

  for (let c = 1; c <= headers.length; c++) {
    const cell = totalRow.getCell(c);
    cell.fill = solidFill(COLORS.totalBg);
    cell.border = TOTAL_BORDER;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.textSageDark } };
    cell.alignment = { vertical: 'middle', horizontal: c >= 7 && c <= 10 ? 'right' : 'left' };
  }
  totalRow.getCell(1).value = 'TOTALE (esclusi annullati)';
  ws.mergeCells(totalRowNum, 1, totalRowNum, 6);

  const setSumCell = (colIdx: number, colLetter: string, res: number) => {
    const cell = totalRow.getCell(colIdx);
    cell.numFmt = CURRENCY_FMT;
    cell.value = apps.length > 0
      ? { formula: `SUMIFS(${colLetter}4:${colLetter}${lastDataRow}, K4:K${lastDataRow}, "<>annullato")`, result: res }
      : 0;
  };
  setSumCell(7, 'G', sumTotal);
  setSumCell(8, 'H', sumPaid);
  setSumCell(9, 'I', sumVoucher);
  setSumCell(10, 'J', sumBalance);

  configureSheetPrintAndFreeze(ws, 3, headers.length, lastDataRow, apps.length > 0);

  return {
    firstDataRow: 4,
    lastDataRow,
    totalRowNum,
    hasRows: apps.length > 0,
    sumTotal,
    sumPaid,
    sumVoucher,
    sumBalance,
  };
}

function buildWeddingsSheet(
  wb: ExcelJS.Workbook,
  weddings: WeddingService[],
  subtitle: string
) {
  const ws = wb.addWorksheet('Eventi & Cerimonie', { properties: { tabColor: { argb: COLORS.headerBg } } });
  const headers = [
    'Data Evento', 'Tipologia', 'Cliente / Sposa', 'Location / Indirizzo', 'Persone',
    'Totale (€)', 'Acconto / Incassato (€)', 'Buono Usato (€)', 'Da Saldare (€)',
    'Prova Trucco', 'Stato', 'Note',
  ];
  const colWidths = [14, 17, 24, 28, 10, 15, 20, 15, 15, 14, 14, 32];
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  styleBanner(ws, 'EVENTI & CERIMONIE — DETTAGLIO SERVIZI', subtitle, headers.length);
  styleTableHeader(
    ws.getRow(3),
    headers,
    new Set([5, 6, 7, 8, 9]),
    new Set([1, 10, 11])
  );

  let rowNum = 4;
  let sumPeople = 0;
  let sumTotal = 0;
  let sumPaid = 0;
  let sumVoucher = 0;
  let sumBalance = 0;

  if (weddings.length === 0) {
    styleEmptyPlaceholder(ws, rowNum, headers.length, 'Nessun evento o cerimonia nel periodo selezionato');
    rowNum++;
  } else {
    weddings.forEach((w, idx) => {
      const row = ws.getRow(rowNum);
      row.height = 21;
      const isCancelled = w.status === 'annullato';
      const baseFill = solidFill(idx % 2 === 1 ? COLORS.zebraBg : COLORS.white);

      const people = Number(w.people_count) || 1;
      const paid = Number(w.trial_deposit) || 0;
      const voucherUsed = w.used_gift_voucher ? (Number(w.used_gift_voucher_amount) || 0) : 0;
      const balance = Number(w.wedding_balance) || 0;
      const total = w.total_price !== undefined && w.total_price !== null
        ? Number(w.total_price)
        : paid + voucherUsed + balance;

      if (!isCancelled) {
        sumPeople += people;
        sumTotal += total;
        sumPaid += paid;
        sumVoucher += voucherUsed;
        sumBalance += balance;
      }

      const values: (Date | string | number | null)[] = [
        parseIsoToUtcDate(w.wedding_date),
        w.event_type || 'Matrimonio',
        w.bride_name,
        w.address || '',
        people,
        total,
        paid,
        voucherUsed,
        balance,
        parseIsoToUtcDate(w.trial_date),
        w.status,
        w.notes || '',
      ];

      values.forEach((val, cIdx) => {
        const colNum = cIdx + 1;
        const cell = row.getCell(colNum);
        cell.value = val;
        cell.border = THIN_BORDER;
        cell.fill = baseFill;
        cell.font = {
          name: 'Calibri',
          size: 10,
          strike: isCancelled,
          color: { argb: isCancelled ? COLORS.textMuted : COLORS.textDark },
        };

        if (colNum === 1 || colNum === 10) {
          cell.numFmt = DATE_FMT;
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNum === 5) {
          cell.numFmt = INT_FMT;
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (colNum >= 6 && colNum <= 9) {
          cell.numFmt = CURRENCY_FMT;
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (colNum === 11) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: colNum === 12 };
        }
      });

      applyBalanceHighlight(row.getCell(9), balance, isCancelled);
      applyStatusBadge(row.getCell(11), w.status);

      rowNum++;
    });
  }

  const lastDataRow = weddings.length > 0 ? 3 + weddings.length : 3;
  const totalRowNum = rowNum;
  const totalRow = ws.getRow(totalRowNum);
  totalRow.height = 24;

  for (let c = 1; c <= headers.length; c++) {
    const cell = totalRow.getCell(c);
    cell.fill = solidFill(COLORS.totalBg);
    cell.border = TOTAL_BORDER;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.textSageDark } };
    cell.alignment = { vertical: 'middle', horizontal: c >= 5 && c <= 9 ? 'right' : 'left' };
  }
  totalRow.getCell(1).value = 'TOTALE (esclusi annullati)';
  ws.mergeCells(totalRowNum, 1, totalRowNum, 4);

  const setSumCell = (colIdx: number, colLetter: string, res: number, isInt = false) => {
    const cell = totalRow.getCell(colIdx);
    cell.numFmt = isInt ? INT_FMT : CURRENCY_FMT;
    cell.value = weddings.length > 0
      ? { formula: `SUMIFS(${colLetter}4:${colLetter}${lastDataRow}, K4:K${lastDataRow}, "<>annullato")`, result: res }
      : 0;
  };
  setSumCell(5, 'E', sumPeople, true);
  setSumCell(6, 'F', sumTotal);
  setSumCell(7, 'G', sumPaid);
  setSumCell(8, 'H', sumVoucher);
  setSumCell(9, 'I', sumBalance);

  configureSheetPrintAndFreeze(ws, 3, headers.length, lastDataRow, weddings.length > 0);

  return {
    firstDataRow: 4,
    lastDataRow,
    totalRowNum,
    hasRows: weddings.length > 0,
    sumTotal,
    sumPaid,
    sumVoucher,
    sumBalance,
  };
}

function buildExpensesSheet(
  wb: ExcelJS.Workbook,
  expenses: Expense[],
  subtitle: string
) {
  const ws = wb.addWorksheet('Spese & Uscite', { properties: { tabColor: { argb: COLORS.redText } } });
  const headers = ['Data', 'Categoria', 'Voce / Descrizione', 'Importo (€)', 'Note'];
  const colWidths = [14, 22, 34, 16, 40];
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  styleBanner(ws, 'SPESE & USCITE — DETTAGLIO ANALITICO', subtitle, headers.length);
  styleTableHeader(ws.getRow(3), headers, new Set([4]), new Set([1]));

  let rowNum = 4;
  let sumExpenses = 0;

  if (expenses.length === 0) {
    styleEmptyPlaceholder(ws, rowNum, headers.length, 'Nessuna spesa registrata nel periodo selezionato');
    rowNum++;
  } else {
    expenses.forEach((e, idx) => {
      const row = ws.getRow(rowNum);
      row.height = 21;
      const baseFill = solidFill(idx % 2 === 1 ? COLORS.zebraBg : COLORS.white);
      const amount = Number(e.amount) || 0;
      sumExpenses += amount;

      const values: (Date | string | number | null)[] = [
        parseIsoToUtcDate(e.date),
        e.category || 'Varie',
        e.item || '-',
        amount,
        e.notes || '',
      ];

      values.forEach((val, cIdx) => {
        const colNum = cIdx + 1;
        const cell = row.getCell(colNum);
        cell.value = val;
        cell.border = THIN_BORDER;
        cell.fill = baseFill;
        cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
        if (colNum === 1) {
          cell.numFmt = DATE_FMT;
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNum === 4) {
          cell.numFmt = CURRENCY_FMT;
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: colNum === 5 };
        }
      });

      rowNum++;
    });
  }

  const lastDataRow = expenses.length > 0 ? 3 + expenses.length : 3;
  const totalRowNum = rowNum;
  const totalRow = ws.getRow(totalRowNum);
  totalRow.height = 24;

  for (let c = 1; c <= headers.length; c++) {
    const cell = totalRow.getCell(c);
    cell.fill = solidFill(COLORS.totalBg);
    cell.border = TOTAL_BORDER;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.textSageDark } };
    cell.alignment = { vertical: 'middle', horizontal: c === 4 ? 'right' : 'left' };
  }
  totalRow.getCell(1).value = 'TOTALE SPESE';
  ws.mergeCells(totalRowNum, 1, totalRowNum, 3);
  const sumCell = totalRow.getCell(4);
  sumCell.numFmt = CURRENCY_FMT;
  sumCell.value = expenses.length > 0
    ? { formula: `SUM(D4:D${lastDataRow})`, result: sumExpenses }
    : 0;

  configureSheetPrintAndFreeze(ws, 3, headers.length, lastDataRow, expenses.length > 0);

  return {
    firstDataRow: 4,
    lastDataRow,
    totalRowNum,
    hasRows: expenses.length > 0,
    sumExpenses,
  };
}

function buildVouchersSheet(
  wb: ExcelJS.Workbook,
  vouchers: GiftVoucher[],
  subtitle: string
) {
  const ws = wb.addWorksheet('Buoni Regalo', { properties: { tabColor: { argb: COLORS.headerBg } } });
  const headers = [
    'Data Acquisto', 'Acquirente', 'Beneficiario', 'Pagamento',
    'Valore Iniziale (€)', 'Valore Rimanente (€)', 'Già Utilizzato (€)',
    'Stato', 'Data Utilizzo', 'Note',
  ];
  const colWidths = [15, 22, 24, 15, 17, 18, 17, 21, 15, 32];
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  styleBanner(ws, 'BUONI REGALO — DETTAGLIO EMISSIONI & RESIDUI', subtitle, headers.length);
  styleTableHeader(
    ws.getRow(3),
    headers,
    new Set([5, 6, 7]),
    new Set([1, 4, 8, 9])
  );

  let rowNum = 4;
  let sumInitial = 0;
  let sumRemaining = 0;
  let sumUsed = 0;

  if (vouchers.length === 0) {
    styleEmptyPlaceholder(ws, rowNum, headers.length, 'Nessun buono regalo emesso nel periodo selezionato');
    rowNum++;
  } else {
    vouchers.forEach((v, idx) => {
      const row = ws.getRow(rowNum);
      row.height = 21;
      const baseFill = solidFill(idx % 2 === 1 ? COLORS.zebraBg : COLORS.white);

      const initVal = v.initial_amount !== undefined && v.initial_amount !== null
        ? Number(v.initial_amount)
        : (Number(v.amount) || 0);
      const remVal = v.remaining_amount !== undefined && v.remaining_amount !== null
        ? Number(v.remaining_amount)
        : (v.is_used ? 0 : initVal);
      const usedVal = Math.max(0, initVal - remVal);

      sumInitial += initVal;
      sumRemaining += remVal;
      sumUsed += usedVal;

      let stato = 'Non Usato';
      if (remVal <= 0) stato = 'Completamente Usato';
      else if (remVal < initVal) stato = 'Parzialmente Usato';

      const values: (Date | string | number | null)[] = [
        parseIsoToUtcDate(v.purchase_date),
        v.buyer_name,
        v.recipient_name || 'Da definire',
        v.payment_method || '-',
        initVal,
        remVal,
        null, // formula E - F
        stato,
        parseIsoToUtcDate(v.used_date),
        v.notes || '',
      ];

      values.forEach((val, cIdx) => {
        const colNum = cIdx + 1;
        const cell = row.getCell(colNum);
        cell.border = THIN_BORDER;
        cell.fill = baseFill;
        cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };

        if (colNum === 7) {
          cell.value = { formula: `MAX(0, E${rowNum}-F${rowNum})`, result: usedVal };
          cell.numFmt = CURRENCY_FMT;
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {
          cell.value = val;
          if (colNum === 1 || colNum === 9) {
            cell.numFmt = DATE_FMT;
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNum === 4 || colNum === 8) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNum === 5 || colNum === 6) {
            cell.numFmt = CURRENCY_FMT;
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: colNum === 10 };
          }
        }
      });

      applyStatusBadge(row.getCell(8), stato);
      rowNum++;
    });
  }

  const lastDataRow = vouchers.length > 0 ? 3 + vouchers.length : 3;
  const totalRowNum = rowNum;
  const totalRow = ws.getRow(totalRowNum);
  totalRow.height = 24;

  for (let c = 1; c <= headers.length; c++) {
    const cell = totalRow.getCell(c);
    cell.fill = solidFill(COLORS.totalBg);
    cell.border = TOTAL_BORDER;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.textSageDark } };
    cell.alignment = { vertical: 'middle', horizontal: c >= 5 && c <= 7 ? 'right' : 'left' };
  }
  totalRow.getCell(1).value = 'TOTALE BUONI';
  ws.mergeCells(totalRowNum, 1, totalRowNum, 4);

  const setSumCell = (colIdx: number, colLetter: string, res: number) => {
    const cell = totalRow.getCell(colIdx);
    cell.numFmt = CURRENCY_FMT;
    cell.value = vouchers.length > 0
      ? { formula: `SUM(${colLetter}4:${colLetter}${lastDataRow})`, result: res }
      : 0;
  };
  setSumCell(5, 'E', sumInitial);
  setSumCell(6, 'F', sumRemaining);
  setSumCell(7, 'G', sumUsed);

  configureSheetPrintAndFreeze(ws, 3, headers.length, lastDataRow, vouchers.length > 0);

  return {
    firstDataRow: 4,
    lastDataRow,
    totalRowNum,
    hasRows: vouchers.length > 0,
    sumInitial,
    sumRemaining,
    sumUsed,
  };
}

function styleSectionTitle(ws: ExcelJS.Worksheet, rowNum: number, title: string, colCount: number) {
  ws.mergeCells(rowNum, 1, rowNum, colCount);
  const cell = ws.getCell(rowNum, 1);
  cell.value = title;
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.primaryDark } };
  cell.fill = solidFill(COLORS.sectionBg);
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(rowNum).height = 24;
  for (let c = 1; c <= colCount; c++) {
    ws.getCell(rowNum, c).border = {
      top: { style: 'thin', color: { argb: COLORS.primaryDark } },
      bottom: { style: 'thin', color: { argb: COLORS.primaryDark } },
      left: { style: 'thin', color: { argb: COLORS.border } },
      right: { style: 'thin', color: { argb: COLORS.border } },
    };
  }
}

function getRomeNowParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return {
    day: map.day,
    month: map.month,
    year: map.year,
    hour: map.hour === '24' ? '00' : map.hour,
    minute: map.minute,
  };
}

function joinFormulaParts(parts: string[], result: number): ExcelJS.CellValue {
  if (parts.length === 0) return 0;
  return { formula: parts.join('+'), result };
}

export async function buildExcelReportBuffer(input: ExcelReportInput): Promise<{
  buffer: Buffer;
  fileName: string;
}> {
  const { appointments, weddings, expenses, locations, giftVouchers = [], filter } = input;

  const locMap = new Map<string, Location>();
  locations.forEach(l => locMap.set(l.id, l));

  const isWithinRange = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const d = dateStr.slice(0, 10);
    if (filter.startDate && d < filter.startDate) return false;
    if (filter.endDate && d > filter.endDate) return false;
    return true;
  };

  const filteredApps = appointments
    .filter(a => isWithinRange(a.appointment_date))
    .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date));
  const filteredWeddings = weddings
    .filter(w => isWithinRange(w.wedding_date))
    .sort((a, b) => a.wedding_date.localeCompare(b.wedding_date));
  const filteredExpenses = expenses
    .filter(e => isWithinRange(e.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const filteredVouchers = giftVouchers
    .filter(v => isWithinRange(v.purchase_date))
    .sort((a, b) => a.purchase_date.localeCompare(b.purchase_date));

  const now = new Date();
  const romeNow = getRomeNowParts(now);
  const generatedLabel = `Periodo: ${filter.periodLabel}   |   Generato il ${romeNow.day}/${romeNow.month}/${romeNow.year} alle ${romeNow.hour}:${romeNow.minute}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gestionale Fede';
  wb.created = now;

  // Create Riepilogo first so it appears as the opening tab, then populate after detail sheets calculate row coordinates
  const summaryWs = wb.addWorksheet('Riepilogo & Metriche', {
    properties: { tabColor: { argb: COLORS.primaryDark } },
  });

  // Build detail sheets
  const pmuMeta = buildPmuSheet(wb, filteredApps, locMap, generatedLabel);
  const wedMeta = buildWeddingsSheet(wb, filteredWeddings, generatedLabel);
  const expMeta = buildExpensesSheet(wb, filteredExpenses, generatedLabel);
  const vouchMeta = buildVouchersSheet(wb, filteredVouchers, generatedLabel);

  // --- POPULATE SHEET 1: Riepilogo & Metriche ---
  const summaryColWidths = [30, 22, 20, 20, 20, 20, 22];
  summaryColWidths.forEach((w, i) => { summaryWs.getColumn(i + 1).width = w; });
  styleBanner(summaryWs, 'GESTIONALE FEDE — REPORT ECONOMICO & DIREZIONALE', generatedLabel, 7);

  let r = 4;

  // 1) KPI FINANZIARI
  styleSectionTitle(summaryWs, r++, '1. PANORAMICA FINANZIARIA & CREDITI', 7);
  styleTableHeader(summaryWs.getRow(r++), ['Metrica', 'Importo / Valore', 'Note esplicative', '', '', '', ''], new Set([2]));
  // Merge Note esplicative header C..G
  summaryWs.mergeCells(r - 1, 3, r - 1, 7);

  const pmuPaidRef = `'PMU & Trattamenti'!H${pmuMeta.totalRowNum}`;
  const pmuTotRef = `'PMU & Trattamenti'!G${pmuMeta.totalRowNum}`;
  const pmuBalRef = `'PMU & Trattamenti'!J${pmuMeta.totalRowNum}`;
  const wedPaidRef = `'Eventi & Cerimonie'!G${wedMeta.totalRowNum}`;
  const wedTotRef = `'Eventi & Cerimonie'!F${wedMeta.totalRowNum}`;
  const wedBalRef = `'Eventi & Cerimonie'!I${wedMeta.totalRowNum}`;
  const expTotRef = `'Spese & Uscite'!D${expMeta.totalRowNum}`;
  const vouchInitRef = `'Buoni Regalo'!E${vouchMeta.totalRowNum}`;

  const totalIncassatoReale = pmuMeta.sumPaid + vouchMeta.sumInitial + wedMeta.sumPaid;
  const guadagnoNettoReale = totalIncassatoReale - expMeta.sumExpenses;
  const totalDaSaldare = pmuMeta.sumBalance + wedMeta.sumBalance;
  const volumeLordoConcordato = pmuMeta.sumTotal + wedMeta.sumTotal;

  const kpiFirstRow = r;
  const kpiRows: Array<{
    label: string;
    formula: string;
    result: number;
    note: string;
    isTotal?: boolean;
    isNet?: boolean;
    isBalance?: boolean;
  }> = [
    {
      label: 'Incassato Reale PMU & Trattamenti',
      formula: pmuPaidRef,
      result: pmuMeta.sumPaid,
      note: 'Denaro incassato direttamente su trattamenti PMU e generici',
    },
    {
      label: 'Incassato Reale Buoni Regalo Emessi',
      formula: vouchInitRef,
      result: vouchMeta.sumInitial,
      note: 'Valore dei buoni venduti nel periodo (assegnati a PMU)',
    },
    {
      label: 'Incassato Reale Eventi & Cerimonie',
      formula: wedPaidRef,
      result: wedMeta.sumPaid,
      note: 'Acconti e pagamenti ricevuti per sposa ed eventi',
    },
    {
      label: 'TOTALE INCASSATO REALE',
      formula: `SUM(B${kpiFirstRow}:B${kpiFirstRow + 2})`,
      result: totalIncassatoReale,
      note: 'Somma effettiva della cassa incassata nel periodo',
      isTotal: true,
    },
    {
      label: 'TOTALE SPESE SOSTENUTE',
      formula: expTotRef,
      result: expMeta.sumExpenses,
      note: 'Totale uscite registrate nel foglio Spese & Uscite',
    },
    {
      label: 'GUADAGNO NETTO REALE',
      formula: `B${kpiFirstRow + 3}-B${kpiFirstRow + 4}`,
      result: guadagnoNettoReale,
      note: 'Incassato Reale meno Spese Sostenute',
      isNet: true,
    },
    {
      label: 'Crediti Da Saldare — PMU & Trattamenti',
      formula: pmuBalRef,
      result: pmuMeta.sumBalance,
      note: 'Quote rimanenti ancora da riscuotere sui trattamenti PMU',
      isBalance: true,
    },
    {
      label: 'Crediti Da Saldare — Eventi & Cerimonie',
      formula: wedBalRef,
      result: wedMeta.sumBalance,
      note: 'Saldi ancora aperti su matrimoni ed eventi',
      isBalance: true,
    },
    {
      label: 'TOTALE CREDITI DA SALDARE',
      formula: `B${kpiFirstRow + 6}+B${kpiFirstRow + 7}`,
      result: totalDaSaldare,
      note: 'Totale generale ancora da incassare dai clienti',
      isTotal: true,
      isBalance: true,
    },
    {
      label: 'Volume Lordo Concordato (Servizi)',
      formula: `${pmuTotRef}+${wedTotRef}`,
      result: volumeLordoConcordato,
      note: 'Valore totale servizi prenotati (inclusi saldi futuri e buoni applicati)',
    },
  ];

  kpiRows.forEach((item, idx) => {
    const row = summaryWs.getRow(r);
    row.height = item.isTotal || item.isNet ? 23 : 20;
    summaryWs.mergeCells(r, 3, r, 7);

    const cLabel = row.getCell(1);
    const cVal = row.getCell(2);
    const cNote = row.getCell(3);

    cLabel.value = item.label;
    cVal.value = { formula: item.formula, result: item.result };
    cVal.numFmt = CURRENCY_FMT;
    cNote.value = item.note;

    const bg = item.isNet
      ? (item.result >= 0 ? COLORS.greenBg : COLORS.redBg)
      : item.isTotal
      ? COLORS.totalBg
      : idx % 2 === 1
      ? COLORS.zebraBg
      : COLORS.white;

    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c);
      cell.fill = solidFill(bg);
      cell.border = item.isTotal || item.isNet ? TOTAL_BORDER : THIN_BORDER;
    }

    cLabel.font = {
      name: 'Calibri',
      size: 10,
      bold: Boolean(item.isTotal || item.isNet),
      color: { argb: item.isNet ? (item.result >= 0 ? COLORS.greenText : COLORS.redText) : COLORS.textDark },
    };
    cLabel.alignment = { vertical: 'middle', horizontal: 'left' };

    cVal.font = {
      name: 'Calibri',
      size: item.isNet || item.isTotal ? 11 : 10,
      bold: Boolean(item.isTotal || item.isNet || item.isBalance),
      color: {
        argb: item.isNet
          ? (item.result >= 0 ? COLORS.greenText : COLORS.redText)
          : item.isBalance && item.result > 0.005
          ? COLORS.amberText
          : COLORS.textDark,
      },
    };
    cVal.alignment = { vertical: 'middle', horizontal: 'right' };

    cNote.font = { name: 'Calibri', size: 9, italic: true, color: { argb: COLORS.textMuted } };
    cNote.alignment = { vertical: 'middle', horizontal: 'left' };

    if (item.isBalance && !item.isTotal && item.result > 0.005) {
      cVal.fill = solidFill(COLORS.amberBg);
    }

    r++;
  });

  // 2) ANDAMENTO MESE PER MESE
  r++;
  styleSectionTitle(summaryWs, r++, '2. ANDAMENTO MESE PER MESE (INCASSI REALI VS SPESE)', 7);
  styleTableHeader(
    summaryWs.getRow(r++),
    [
      'Mese', 'Incassi PMU + Buoni (€)', 'Incassi Eventi (€)',
      'Totale Incassato (€)', 'Da Saldare (€)', 'Spese (€)', 'Guadagno Netto (€)',
    ],
    new Set([2, 3, 4, 5, 6, 7])
  );

  // Collect months
  const monthBuckets = new Map<string, {
    pmuCash: number;
    vouchersCash: number;
    wedCash: number;
    pmuBal: number;
    wedBal: number;
    expenses: number;
  }>();

  const ensureMonth = (ym: string) => {
    let b = monthBuckets.get(ym);
    if (!b) {
      b = { pmuCash: 0, vouchersCash: 0, wedCash: 0, pmuBal: 0, wedBal: 0, expenses: 0 };
      monthBuckets.set(ym, b);
    }
    return b;
  };

  // If full single year filter (YYYY-01-01..YYYY-12-31), pre-seed all 12 months
  if (
    filter.startDate &&
    filter.endDate &&
    filter.startDate.slice(0, 4) === filter.endDate.slice(0, 4) &&
    filter.startDate.endsWith('-01-01') &&
    filter.endDate.endsWith('-12-31')
  ) {
    const yr = filter.startDate.slice(0, 4);
    for (let m = 1; m <= 12; m++) {
      ensureMonth(`${yr}-${String(m).padStart(2, '0')}`);
    }
  }

  filteredApps.forEach(a => {
    if (a.status === 'annullato') return;
    const ym = a.appointment_date.slice(0, 7);
    const b = ensureMonth(ym);
    b.pmuCash += Number(a.payment) || 0;
    b.pmuBal += Number(a.balance) || 0;
  });
  filteredVouchers.forEach(v => {
    const ym = v.purchase_date.slice(0, 7);
    const b = ensureMonth(ym);
    const initVal = v.initial_amount !== undefined && v.initial_amount !== null
      ? Number(v.initial_amount)
      : (Number(v.amount) || 0);
    b.vouchersCash += initVal;
  });
  filteredWeddings.forEach(w => {
    if (w.status === 'annullato') return;
    const ym = w.wedding_date.slice(0, 7);
    const b = ensureMonth(ym);
    b.wedCash += Number(w.trial_deposit) || 0;
    b.wedBal += Number(w.wedding_balance) || 0;
  });
  filteredExpenses.forEach(e => {
    const ym = e.date.slice(0, 7);
    const b = ensureMonth(ym);
    b.expenses += Number(e.amount) || 0;
  });

  const sortedMonths = Array.from(monthBuckets.keys()).sort();
  const monthStartRow = r;

  if (sortedMonths.length === 0) {
    styleEmptyPlaceholder(summaryWs, r++, 7, 'Nessun dato mensile disponibile nel periodo selezionato');
  } else {
    sortedMonths.forEach((ym, idx) => {
      const [yStr, mStr] = ym.split('-');
      const yr = Number(yStr);
      const mo = Number(mStr);
      const lastDay = new Date(Date.UTC(yr, mo, 0)).getUTCDate();
      const dStart = `DATE(${yr},${mo},1)`;
      const dEnd = `DATE(${yr},${mo},${lastDay})`;

      const b = monthBuckets.get(ym)!;
      const pmuPlusVouchers = b.pmuCash + b.vouchersCash;
      const totInc = pmuPlusVouchers + b.wedCash;
      const totBal = b.pmuBal + b.wedBal;
      const net = totInc - b.expenses;

      const row = summaryWs.getRow(r);
      row.height = 21;
      const bg = idx % 2 === 1 ? COLORS.zebraBg : COLORS.white;

      for (let c = 1; c <= 7; c++) {
        const cell = row.getCell(c);
        cell.fill = solidFill(bg);
        cell.border = THIN_BORDER;
        cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
        if (c >= 2) {
          cell.numFmt = CURRENCY_FMT;
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      }

      row.getCell(1).value = `${MONTH_NAMES_IT[mo - 1] || mStr} ${yr}`;

      // Col B: Incassi PMU + Buoni
      const colBParts: string[] = [];
      if (pmuMeta.hasRows) {
        colBParts.push(`SUMIFS('PMU & Trattamenti'!$H$4:$H$${pmuMeta.lastDataRow}, 'PMU & Trattamenti'!$A$4:$A$${pmuMeta.lastDataRow}, ">="&${dStart}, 'PMU & Trattamenti'!$A$4:$A$${pmuMeta.lastDataRow}, "<="&${dEnd}, 'PMU & Trattamenti'!$K$4:$K$${pmuMeta.lastDataRow}, "<>annullato")`);
      }
      if (vouchMeta.hasRows) {
        colBParts.push(`SUMIFS('Buoni Regalo'!$E$4:$E$${vouchMeta.lastDataRow}, 'Buoni Regalo'!$A$4:$A$${vouchMeta.lastDataRow}, ">="&${dStart}, 'Buoni Regalo'!$A$4:$A$${vouchMeta.lastDataRow}, "<="&${dEnd})`);
      }
      row.getCell(2).value = joinFormulaParts(colBParts, pmuPlusVouchers);

      // Col C: Incassi Eventi
      row.getCell(3).value = wedMeta.hasRows
        ? {
            formula: `SUMIFS('Eventi & Cerimonie'!$G$4:$G$${wedMeta.lastDataRow}, 'Eventi & Cerimonie'!$A$4:$A$${wedMeta.lastDataRow}, ">="&${dStart}, 'Eventi & Cerimonie'!$A$4:$A$${wedMeta.lastDataRow}, "<="&${dEnd}, 'Eventi & Cerimonie'!$K$4:$K$${wedMeta.lastDataRow}, "<>annullato")`,
            result: b.wedCash,
          }
        : 0;

      // Col D: Totale Incassato
      row.getCell(4).value = { formula: `B${r}+C${r}`, result: totInc };
      row.getCell(4).font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.textDark } };

      // Col E: Da Saldare
      const colEParts: string[] = [];
      if (pmuMeta.hasRows) {
        colEParts.push(`SUMIFS('PMU & Trattamenti'!$J$4:$J$${pmuMeta.lastDataRow}, 'PMU & Trattamenti'!$A$4:$A$${pmuMeta.lastDataRow}, ">="&${dStart}, 'PMU & Trattamenti'!$A$4:$A$${pmuMeta.lastDataRow}, "<="&${dEnd}, 'PMU & Trattamenti'!$K$4:$K$${pmuMeta.lastDataRow}, "<>annullato")`);
      }
      if (wedMeta.hasRows) {
        colEParts.push(`SUMIFS('Eventi & Cerimonie'!$I$4:$I$${wedMeta.lastDataRow}, 'Eventi & Cerimonie'!$A$4:$A$${wedMeta.lastDataRow}, ">="&${dStart}, 'Eventi & Cerimonie'!$A$4:$A$${wedMeta.lastDataRow}, "<="&${dEnd}, 'Eventi & Cerimonie'!$K$4:$K$${wedMeta.lastDataRow}, "<>annullato")`);
      }
      row.getCell(5).value = joinFormulaParts(colEParts, totBal);
      if (totBal > 0.005) {
        row.getCell(5).font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.amberText } };
      }

      // Col F: Spese
      row.getCell(6).value = expMeta.hasRows
        ? {
            formula: `SUMIFS('Spese & Uscite'!$D$4:$D$${expMeta.lastDataRow}, 'Spese & Uscite'!$A$4:$A$${expMeta.lastDataRow}, ">="&${dStart}, 'Spese & Uscite'!$A$4:$A$${expMeta.lastDataRow}, "<="&${dEnd})`,
            result: b.expenses,
          }
        : 0;

      // Col G: Guadagno Netto
      row.getCell(7).value = { formula: `D${r}-F${r}`, result: net };
      row.getCell(7).font = {
        name: 'Calibri',
        size: 10,
        bold: true,
        color: { argb: net >= 0 ? COLORS.greenText : COLORS.redText },
      };

      r++;
    });
  }

  const monthLastRow = sortedMonths.length > 0 ? monthStartRow + sortedMonths.length - 1 : monthStartRow;
  const monthTotalRow = summaryWs.getRow(r);
  monthTotalRow.height = 24;
  for (let c = 1; c <= 7; c++) {
    const cell = monthTotalRow.getCell(c);
    cell.fill = solidFill(COLORS.totalBg);
    cell.border = TOTAL_BORDER;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.textSageDark } };
    cell.alignment = { vertical: 'middle', horizontal: c >= 2 ? 'right' : 'left' };
  }
  monthTotalRow.getCell(1).value = 'TOTALE PERIODO';
  const monthColLetters = ['B', 'C', 'D', 'E', 'F', 'G'];
  const monthTotalsResult = [
    pmuMeta.sumPaid + vouchMeta.sumInitial,
    wedMeta.sumPaid,
    totalIncassatoReale,
    totalDaSaldare,
    expMeta.sumExpenses,
    guadagnoNettoReale,
  ];
  monthColLetters.forEach((colLetter, i) => {
    const cell = monthTotalRow.getCell(i + 2);
    cell.numFmt = CURRENCY_FMT;
    cell.value = sortedMonths.length > 0
      ? { formula: `SUM(${colLetter}${monthStartRow}:${colLetter}${monthLastRow})`, result: monthTotalsResult[i] }
      : 0;
  });
  r++;

  // 3) RIPARTIZIONE PER SEDE DI LAVORO
  r++;
  styleSectionTitle(summaryWs, r++, '3. RIPARTIZIONE PMU PER SEDE DI LAVORO', 7);
  styleTableHeader(
    summaryWs.getRow(r++),
    ['Sede di Lavoro', 'N° Appuntamenti', 'Incassato Reale (€)', 'Buoni Usati (€)', 'Da Saldare (€)', 'Totale Concordato (€)', '% su Incassato PMU'],
    new Set([2, 3, 4, 5, 6, 7])
  );

  const locStats = new Map<string, { count: number; paid: number; voucher: number; balance: number; total: number }>();
  locations.filter(l => l.active).forEach(l => {
    locStats.set(l.name, { count: 0, paid: 0, voucher: 0, balance: 0, total: 0 });
  });
  filteredApps.forEach(a => {
    if (a.status === 'annullato') return;
    const locName = locMap.get(a.location_id)?.name || 'Studio';
    const curr = locStats.get(locName) || { count: 0, paid: 0, voucher: 0, balance: 0, total: 0 };
    const paid = Number(a.payment) || 0;
    const voucherUsed = a.used_gift_voucher ? (Number(a.used_gift_voucher_amount) || 0) : 0;
    const balance = Number(a.balance) || 0;
    const total = a.total_price !== undefined && a.total_price !== null
      ? Number(a.total_price)
      : paid + voucherUsed + balance;
    curr.count += 1;
    curr.paid += paid;
    curr.voucher += voucherUsed;
    curr.balance += balance;
    curr.total += total;
    locStats.set(locName, curr);
  });

  const sortedLocNames = Array.from(locStats.entries())
    .sort((a, b) => b[1].paid - a[1].paid || b[1].total - a[1].total)
    .map(([name]) => name);

  const locStartRow = r;
  const locTotalRowNum = locStartRow + (sortedLocNames.length > 0 ? sortedLocNames.length : 1);

  if (sortedLocNames.length === 0) {
    styleEmptyPlaceholder(summaryWs, r++, 7, 'Nessuna sede configurata o utilizzata nel periodo');
  } else {
    sortedLocNames.forEach((locName, idx) => {
      const s = locStats.get(locName)!;
      const row = summaryWs.getRow(r);
      row.height = 21;
      const bg = idx % 2 === 1 ? COLORS.zebraBg : COLORS.white;
      for (let c = 1; c <= 7; c++) {
        const cell = row.getCell(c);
        cell.fill = solidFill(bg);
        cell.border = THIN_BORDER;
        cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right' };
      }
      row.getCell(1).value = locName;

      row.getCell(2).numFmt = INT_FMT;
      row.getCell(2).value = pmuMeta.hasRows
        ? {
            formula: `COUNTIFS('PMU & Trattamenti'!$E$4:$E$${pmuMeta.lastDataRow}, A${r}, 'PMU & Trattamenti'!$K$4:$K$${pmuMeta.lastDataRow}, "<>annullato")`,
            result: s.count,
          }
        : 0;

      const setLocSum = (colNum: number, targetCol: string, res: number) => {
        const cell = row.getCell(colNum);
        cell.numFmt = CURRENCY_FMT;
        cell.value = pmuMeta.hasRows
          ? {
              formula: `SUMIFS('PMU & Trattamenti'!$${targetCol}$4:$${targetCol}$${pmuMeta.lastDataRow}, 'PMU & Trattamenti'!$E$4:$E$${pmuMeta.lastDataRow}, A${r}, 'PMU & Trattamenti'!$K$4:$K$${pmuMeta.lastDataRow}, "<>annullato")`,
              result: res,
            }
          : 0;
      };
      setLocSum(3, 'H', s.paid);
      setLocSum(4, 'I', s.voucher);
      setLocSum(5, 'J', s.balance);
      setLocSum(6, 'G', s.total);

      const pct = pmuMeta.sumPaid > 0 ? s.paid / pmuMeta.sumPaid : 0;
      row.getCell(7).numFmt = PCT_FMT;
      row.getCell(7).value = {
        formula: `IF($C$${locTotalRowNum}>0, C${r}/$C$${locTotalRowNum}, 0)`,
        result: pct,
      };
      r++;
    });
  }

  const locLastRow = sortedLocNames.length > 0 ? locStartRow + sortedLocNames.length - 1 : locStartRow;
  const locTotalRow = summaryWs.getRow(r);
  locTotalRow.height = 24;
  for (let c = 1; c <= 7; c++) {
    const cell = locTotalRow.getCell(c);
    cell.fill = solidFill(COLORS.totalBg);
    cell.border = TOTAL_BORDER;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.textSageDark } };
    cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right' };
  }
  locTotalRow.getCell(1).value = 'TOTALE SEDI';
  const totalCountApps = filteredApps.filter(a => a.status !== 'annullato').length;
  locTotalRow.getCell(2).numFmt = INT_FMT;
  locTotalRow.getCell(2).value = sortedLocNames.length > 0
    ? { formula: `SUM(B${locStartRow}:B${locLastRow})`, result: totalCountApps }
    : 0;
  [
    { col: 3, letter: 'C', res: pmuMeta.sumPaid },
    { col: 4, letter: 'D', res: pmuMeta.sumVoucher },
    { col: 5, letter: 'E', res: pmuMeta.sumBalance },
    { col: 6, letter: 'F', res: pmuMeta.sumTotal },
  ].forEach(info => {
    const cell = locTotalRow.getCell(info.col);
    cell.numFmt = CURRENCY_FMT;
    cell.value = sortedLocNames.length > 0
      ? { formula: `SUM(${info.letter}${locStartRow}:${info.letter}${locLastRow})`, result: info.res }
      : 0;
  });
  locTotalRow.getCell(7).numFmt = PCT_FMT;
  locTotalRow.getCell(7).value = pmuMeta.sumPaid > 0 ? 1 : 0;
  r++;

  // 4) RIPARTIZIONE SPESE PER CATEGORIA
  r++;
  styleSectionTitle(summaryWs, r++, '4. RIPARTIZIONE SPESE PER CATEGORIA', 4);
  styleTableHeader(
    summaryWs.getRow(r++),
    ['Categoria Spesa', 'N° Voci', 'Totale Speso (€)', '% su Totale Spese'],
    new Set([2, 3, 4])
  );

  const expCatStats = new Map<string, { count: number; total: number }>();
  filteredExpenses.forEach(e => {
    const cat = e.category || 'Varie';
    const curr = expCatStats.get(cat) || { count: 0, total: 0 };
    curr.count += 1;
    curr.total += Number(e.amount) || 0;
    expCatStats.set(cat, curr);
  });

  const sortedExpCats = Array.from(expCatStats.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([cat]) => cat);

  const catStartRow = r;
  const catTotalRowNum = catStartRow + (sortedExpCats.length > 0 ? sortedExpCats.length : 1);

  if (sortedExpCats.length === 0) {
    styleEmptyPlaceholder(summaryWs, r++, 4, 'Nessuna spesa registrata nel periodo selezionato');
  } else {
    sortedExpCats.forEach((cat, idx) => {
      const s = expCatStats.get(cat)!;
      const row = summaryWs.getRow(r);
      row.height = 21;
      const bg = idx % 2 === 1 ? COLORS.zebraBg : COLORS.white;
      for (let c = 1; c <= 4; c++) {
        const cell = row.getCell(c);
        cell.fill = solidFill(bg);
        cell.border = THIN_BORDER;
        cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right' };
      }
      row.getCell(1).value = cat;
      row.getCell(2).numFmt = INT_FMT;
      row.getCell(2).value = expMeta.hasRows
        ? { formula: `COUNTIF('Spese & Uscite'!$B$4:$B$${expMeta.lastDataRow}, A${r})`, result: s.count }
        : 0;
      row.getCell(3).numFmt = CURRENCY_FMT;
      row.getCell(3).value = expMeta.hasRows
        ? { formula: `SUMIF('Spese & Uscite'!$B$4:$B$${expMeta.lastDataRow}, A${r}, 'Spese & Uscite'!$D$4:$D$${expMeta.lastDataRow})`, result: s.total }
        : 0;
      const pct = expMeta.sumExpenses > 0 ? s.total / expMeta.sumExpenses : 0;
      row.getCell(4).numFmt = PCT_FMT;
      row.getCell(4).value = { formula: `IF($C$${catTotalRowNum}>0, C${r}/$C$${catTotalRowNum}, 0)`, result: pct };
      r++;
    });
  }

  const catLastRow = sortedExpCats.length > 0 ? catStartRow + sortedExpCats.length - 1 : catStartRow;
  const catTotalRow = summaryWs.getRow(r);
  catTotalRow.height = 24;
  for (let c = 1; c <= 4; c++) {
    const cell = catTotalRow.getCell(c);
    cell.fill = solidFill(COLORS.totalBg);
    cell.border = TOTAL_BORDER;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.textSageDark } };
    cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right' };
  }
  catTotalRow.getCell(1).value = 'TOTALE SPESE';
  catTotalRow.getCell(2).numFmt = INT_FMT;
  catTotalRow.getCell(2).value = sortedExpCats.length > 0
    ? { formula: `SUM(B${catStartRow}:B${catLastRow})`, result: filteredExpenses.length }
    : 0;
  catTotalRow.getCell(3).numFmt = CURRENCY_FMT;
  catTotalRow.getCell(3).value = sortedExpCats.length > 0
    ? { formula: `SUM(C${catStartRow}:C${catLastRow})`, result: expMeta.sumExpenses }
    : 0;
  catTotalRow.getCell(4).numFmt = PCT_FMT;
  catTotalRow.getCell(4).value = expMeta.sumExpenses > 0 ? 1 : 0;

  configureSheetPrintAndFreeze(summaryWs, 2, 7, 2, false);

  // Filename
  const dateStr = `${romeNow.year}-${romeNow.month}-${romeNow.day}`;
  const timeStr = `${romeNow.hour}-${romeNow.minute}`;
  const cleanFilter = filter.periodLabel.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
  const fileName = `Gestionale_Fede_Report_${cleanFilter}_${dateStr}_${timeStr}.xlsx`;

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    fileName,
  };
}
