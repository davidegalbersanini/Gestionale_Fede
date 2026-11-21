import crypto from 'crypto';
import {
  Appointment,
  AppointmentStatus,
  Client,
  Expense,
  GiftVoucher,
  Location,
  MasterSheetStatus,
  MasterSheetSyncResult,
  ServicePrice,
  WeddingService,
} from '@/types';
import {
  fetchAllServerRows,
  getServerSupabase,
  safeServerDelete,
  safeServerUpsert,
} from '@/lib/serverSupabase';
import {
  deleteGoogleCalendarEvent,
  getStoredTokens,
  getValidAccessToken,
  syncGoogleCalendarEvent,
} from '@/lib/googleAuth';
import { PASTEL_EVENT_COLORS } from '@/lib/locationColors';
import { extractDateKey, getVoucherInitialAmount, getVoucherRemainingAmount, reconcileVoucherUsage } from '@/lib/finance';
import {
  createMasterSpreadsheet,
  ensureSpreadsheetStructure,
  EVENT_TYPE_OPTIONS,
  EXPENSE_CATEGORY_OPTIONS,
  getDriveFileMetadata,
  GoogleSheetsApiError,
  readAllBidirectionalTabs,
  SHEET_TABS,
  SummaryLayoutMeta,
  SummaryYearBlockLayout,
  writeAllTabsAndFormat,
} from '@/lib/googleSheets';

export const SYNC_STATE_SETTINGS_KEY = 'google_sheets_sync_state';
export const MAX_BULK_DELETES = 5;
export const SHEET_TEMPLATE_VERSION = 2;

const DEFAULT_PMU_TREATMENTS = [
  'Ritocco',
  'Prima seduta Micro',
  'Prima seduta Sfumatura',
  'Labbra Full Lip',
  'Labbra Contorno & Sfumatura',
  'Combo laminazione',
  'Tatuaggio Fine Line',
  'Infracigliare / Eyeliner',
  'Consulenza PMU',
];

const MONTH_NAMES_IT = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

export interface SyncSnapshotsState {
  appointments: Record<string, string>;
  weddings: Record<string, string>;
  expenses: Record<string, string>;
  vouchers: Record<string, string>;
}

export interface GoogleSheetsSyncState {
  spreadsheet_id?: string;
  spreadsheet_url?: string;
  owner_email?: string;
  template_version?: number;
  last_sheet_modified_time?: string;
  dirty_from_app?: boolean;
  app_last_mutated_at?: number;
  last_synced_at?: string;
  last_sync_summary?: string;
  last_sync_warning?: string | null;
  snapshots?: SyncSnapshotsState;
}

const EMPTY_SNAPSHOTS: SyncSnapshotsState = {
  appointments: {},
  weddings: {},
  expenses: {},
  vouchers: {},
};

// ============================================================================
// Pure Parsers, Formatters & Canonical Hashing (also unit-tested directly)
// ============================================================================

export function round2(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 100) / 100;
}

export function cleanText(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
}

export function parseSheetDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw < 20000 || raw > 90000) return null;
    // Google Sheets serial date epoch is 1899-12-30 UTC
    const wholeDays = Math.floor(raw + 1e-6);
    const utcMs = Date.UTC(1899, 11, 30) + wholeDays * 86_400_000;
    const d = new Date(utcMs);
    if (isNaN(d.getTime())) return null;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const s = String(raw).trim();
  if (!s) return null;

  // ISO YYYY-MM-DD (optionally with T...)
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Italian DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY
  const itMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (itMatch) {
    const d = Number(itMatch[1]);
    const m = Number(itMatch[2]);
    let y = Number(itMatch[3]);
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2100) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return null;
}

export function parseSheetTime(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const frac = raw >= 1 ? raw % 1 : raw;
    if (frac <= 0 || frac >= 1) return '';
    const totalMins = Math.round(frac * 24 * 60) % (24 * 60);
    const hh = String(Math.floor(totalMins / 60)).padStart(2, '0');
    const mm = String(totalMins % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  const s = String(raw).trim();
  if (!s) return '';
  const match = s.match(/^(\d{1,2})[:\.](\d{2})(?::\d{2})?$/);
  if (match) {
    const hh = Number(match[1]);
    const mm = Number(match[2]);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
  }
  return '';
}

export function parseSheetNumber(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? round2(raw) : 0;
  }
  if (raw === null || raw === undefined) return 0;
  const s = String(raw)
    .replace(/[€\s]/g, '')
    .trim();
  if (!s) return 0;

  let normalized = s;
  if (s.includes(',') && s.includes('.')) {
    // e.g. 1.250,50 -> 1250.50 (if comma after dot) or 1,250.50 -> 1250.50
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      normalized = s.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    normalized = s.replace(',', '.');
  }

  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? round2(parsed) : 0;
}

export function parseSheetBool(raw: unknown, defaultVal: boolean = true): boolean {
  if (typeof raw === 'boolean') return raw;
  const s = cleanText(raw).toLowerCase();
  if (!s) return defaultVal;
  if (['no', 'false', '0', 'n', 'falso'].includes(s)) return false;
  if (['sì', 'si', 's', 'yes', 'true', '1', 'vero', 'ok', 'x'].includes(s)) return true;
  return defaultVal;
}

export function normalizeStatus(raw: unknown, isoDate?: string | null): AppointmentStatus {
  const s = cleanText(raw).toLowerCase();
  if (s === 'annullato') return 'annullato';
  if (s === 'completato') return 'completato';
  if (s === 'programmato') return 'programmato';
  if (isoDate) {
    const todayIso = formatRomeTodayIso();
    return isoDate.slice(0, 10) < todayIso ? 'completato' : 'programmato';
  }
  return 'programmato';
}

export function formatRomeTodayIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function formatRomeDateTimeLabel(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);
}

export function formatDateForSheet(iso?: string | null): string {
  const key = extractDateKey(iso);
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return '';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

export function extractWallTimeFromIso(iso?: string | null): string {
  if (!iso || !iso.includes('T')) return '';
  const timePart = iso.split('T')[1]?.slice(0, 5) || '';
  if (!/^\d{2}:\d{2}$/.test(timePart) || timePart === '00:00') return '';
  return timePart;
}

export function addHoursToTimeStr(timeStr: string, hours: number): string {
  if (!timeStr) return '';
  const match = timeStr.match(/^(\d{2}):(\d{2})$/);
  if (!match) return '';
  const totalMins = (Number(match[1]) * 60 + Number(match[2]) + Math.round(hours * 60)) % (24 * 60);
  const hh = String(Math.floor(totalMins / 60)).padStart(2, '0');
  const mm = String(totalMins % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function sha256(obj: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

export function hashPmuFields(input: {
  date: string;
  startTime: string;
  endTime: string;
  clientName: string;
  locationName: string;
  treatment: string;
  totalPrice: number;
  payment: number;
  voucherAmount: number;
  balance: number;
  status: string;
  touchUpDate: string;
  syncCalendar: boolean;
  notes: string;
}): string {
  return sha256({
    d: input.date,
    st: input.startTime,
    et: input.endTime,
    c: input.clientName.trim(),
    l: input.locationName.trim().toLowerCase(),
    t: input.treatment.trim(),
    tot: round2(input.totalPrice),
    p: round2(input.payment),
    v: round2(input.voucherAmount),
    b: round2(input.balance),
    s: input.status,
    tu: input.touchUpDate,
    cal: input.syncCalendar,
    n: input.notes.trim(),
  });
}

export function hashWeddingFields(input: {
  date: string;
  startTime: string;
  endTime: string;
  eventType: string;
  brideName: string;
  address: string;
  peopleCount: number;
  totalPrice: number;
  deposit: number;
  voucherAmount: number;
  balance: number;
  trialDate: string;
  status: string;
  syncCalendar: boolean;
  notes: string;
}): string {
  return sha256({
    d: input.date,
    st: input.startTime,
    et: input.endTime,
    etyp: input.eventType.trim(),
    c: input.brideName.trim(),
    a: input.address.trim(),
    pc: Math.max(1, Math.round(input.peopleCount || 1)),
    tot: round2(input.totalPrice),
    dep: round2(input.deposit),
    v: round2(input.voucherAmount),
    b: round2(input.balance),
    td: input.trialDate,
    s: input.status,
    cal: input.syncCalendar,
    n: input.notes.trim(),
  });
}

export function hashExpenseFields(input: {
  date: string;
  category: string;
  item: string;
  amount: number;
  notes: string;
}): string {
  return sha256({
    d: input.date,
    cat: input.category.trim(),
    i: input.item.trim(),
    a: round2(input.amount),
    n: input.notes.trim(),
  });
}

export function hashVoucherFields(input: {
  purchaseDate: string;
  buyerName: string;
  recipientName: string;
  initialAmount: number;
  remainingAmount: number;
  isUsed: boolean;
  notes: string;
}): string {
  return sha256({
    d: input.purchaseDate,
    b: input.buyerName.trim(),
    r: input.recipientName.trim(),
    init: round2(input.initialAmount),
    rem: round2(input.remainingAmount),
    u: Boolean(input.isUsed),
    n: input.notes.trim(),
  });
}

// ============================================================================
// Pure 3-Way Collection Reconciler
// ============================================================================

export interface ParsedSheetRow<TItem> {
  id: string;
  hash: string;
  item: TItem;
}

export interface ReconcileResult<TItem extends { id: string }> {
  toUpsertDb: TItem[];
  toDeleteDbIds: string[];
  deletedFromSheetItems: TItem[];
  mergedItems: TItem[];
  nextSnapshots: Record<string, string>;
  sheetNeedsRewrite: boolean;
  dbChanged: boolean;
  bulkDeleteBlockedCount: number;
  addedFromSheetCount: number;
  updatedFromSheetCount: number;
  deletedFromSheetCount: number;
}

export function reconcileCollection<TItem extends { id: string }>(params: {
  dbItems: TItem[];
  sheetParsed: Array<ParsedSheetRow<TItem>>;
  snapshotMap: Record<string, string>;
  getDbHash: (item: TItem) => string;
  mergeDbKeepMeta: (fromSheet: TItem, existingDb: TItem) => TItem;
  sheetModifiedMs: number;
  appMutatedMs: number;
  maxBulkDeletes?: number;
}): ReconcileResult<TItem> {
  const {
    dbItems,
    sheetParsed,
    snapshotMap,
    getDbHash,
    mergeDbKeepMeta,
    sheetModifiedMs,
    appMutatedMs,
    maxBulkDeletes = MAX_BULK_DELETES,
  } = params;

  const dbMap = new Map<string, TItem>();
  dbItems.forEach(it => dbMap.set(it.id, it));

  const sheetMap = new Map<string, ParsedSheetRow<TItem>>();
  sheetParsed.forEach(sr => sheetMap.set(sr.id, sr));

  const toUpsertDb: TItem[] = [];
  const candidateDeleteIds: string[] = [];
  const mergedMap = new Map<string, TItem>();
  const nextSnapshots: Record<string, string> = {};

  let sheetNeedsRewrite = false;
  let dbChanged = false;
  let addedFromSheetCount = 0;
  let updatedFromSheetCount = 0;

  // 1. Walk rows currently in Sheet
  for (const sr of sheetParsed) {
    const dbItem = dbMap.get(sr.id);
    const snapHash = snapshotMap[sr.id];

    if (!dbItem) {
      if (snapHash) {
        // Existed before, deleted on App -> remove from Sheet
        sheetNeedsRewrite = true;
      } else {
        // Brand new row created on Sheet (without prior ID or restored ID)
        toUpsertDb.push(sr.item);
        mergedMap.set(sr.id, sr.item);
        nextSnapshots[sr.id] = sr.hash;
        sheetNeedsRewrite = true; // Write generated ID, formulas & formatting
        dbChanged = true;
        addedFromSheetCount++;
      }
      continue;
    }

    const dbHash = getDbHash(dbItem);
    const sheetHash = sr.hash;

    if (sheetHash === dbHash) {
      // Identical in Sheet and DB
      mergedMap.set(sr.id, dbItem);
      nextSnapshots[sr.id] = dbHash;
      if (snapHash !== dbHash) sheetNeedsRewrite = true;
      continue;
    }

    if (!snapHash) {
      // Both exist without snapshot -> App wins on first link unless DB matches nothing; prefer App and rewrite Sheet
      mergedMap.set(sr.id, dbItem);
      nextSnapshots[sr.id] = dbHash;
      sheetNeedsRewrite = true;
      continue;
    }

    const sheetChanged = sheetHash !== snapHash;
    const appChanged = dbHash !== snapHash;

    if (sheetChanged && !appChanged) {
      // Edited on Sheet
      const merged = mergeDbKeepMeta(sr.item, dbItem);
      toUpsertDb.push(merged);
      mergedMap.set(sr.id, merged);
      nextSnapshots[sr.id] = getDbHash(merged);
      dbChanged = true;
      updatedFromSheetCount++;
      sheetNeedsRewrite = true; // Ensure formulas/dropdowns stay normalized
    } else if (!sheetChanged && appChanged) {
      // Edited on App
      mergedMap.set(sr.id, dbItem);
      nextSnapshots[sr.id] = dbHash;
      sheetNeedsRewrite = true;
    } else {
      // Concurrent edit on same row: newer timestamp wins
      if (sheetModifiedMs > appMutatedMs) {
        const merged = mergeDbKeepMeta(sr.item, dbItem);
        toUpsertDb.push(merged);
        mergedMap.set(sr.id, merged);
        nextSnapshots[sr.id] = getDbHash(merged);
        dbChanged = true;
        updatedFromSheetCount++;
      } else {
        mergedMap.set(sr.id, dbItem);
        nextSnapshots[sr.id] = dbHash;
      }
      sheetNeedsRewrite = true;
    }
  }

  // 2. Walk DB rows missing from Sheet
  for (const dbItem of dbItems) {
    if (sheetMap.has(dbItem.id)) continue;
    const snapHash = snapshotMap[dbItem.id];
    if (snapHash) {
      // Previously synced, now missing from Sheet -> deleted on Sheet
      candidateDeleteIds.push(dbItem.id);
    } else {
      // Newly created in App -> push to Sheet
      mergedMap.set(dbItem.id, dbItem);
      nextSnapshots[dbItem.id] = getDbHash(dbItem);
      sheetNeedsRewrite = true;
    }
  }

  // 3. Bulk-delete circuit breaker
  let bulkDeleteBlockedCount = 0;
  let toDeleteDbIds: string[] = [];
  const deletedFromSheetItems: TItem[] = [];

  if (candidateDeleteIds.length > maxBulkDeletes) {
    // Circuit breaker triggered: restore all missing rows on Sheet
    bulkDeleteBlockedCount = candidateDeleteIds.length;
    sheetNeedsRewrite = true;
    for (const delId of candidateDeleteIds) {
      const orig = dbMap.get(delId);
      if (orig) {
        mergedMap.set(delId, orig);
        nextSnapshots[delId] = getDbHash(orig);
      }
    }
  } else if (candidateDeleteIds.length > 0) {
    toDeleteDbIds = candidateDeleteIds;
    dbChanged = true;
    sheetNeedsRewrite = true;
    for (const delId of candidateDeleteIds) {
      const orig = dbMap.get(delId);
      if (orig) deletedFromSheetItems.push(orig);
    }
  }

  return {
    toUpsertDb,
    toDeleteDbIds,
    deletedFromSheetItems,
    mergedItems: Array.from(mergedMap.values()),
    nextSnapshots,
    sheetNeedsRewrite,
    dbChanged,
    bulkDeleteBlockedCount,
    addedFromSheetCount,
    updatedFromSheetCount,
    deletedFromSheetCount: toDeleteDbIds.length,
  };
}

// ============================================================================
// Sheet Row Serialization Helpers
// ============================================================================

function computePmuHashFromDb(
  app: Appointment,
  locNameMap: Map<string, Location>,
  fallbackLocName: string = 'Studio'
): string {
  const date = extractDateKey(app.appointment_date);
  const startTime = extractWallTimeFromIso(app.appointment_date) || '10:00';
  const endTime = app.end_time || '';
  const paid = round2(Number(app.payment) || 0);
  const voucherAmt = app.used_gift_voucher ? round2(Number(app.used_gift_voucher_amount) || 0) : 0;
  const balance = round2(Number(app.balance) || 0);
  const total =
    app.total_price !== undefined && app.total_price !== null
      ? round2(Number(app.total_price))
      : round2(paid + voucherAmt + balance);
  const locName = locNameMap.get(app.location_id)?.name || fallbackLocName;
  const status = normalizeStatus(app.status, date);
  const syncCal = app.sync_google_calendar !== false;

  return hashPmuFields({
    date,
    startTime,
    endTime,
    clientName: app.client_name || '',
    locationName: locName,
    treatment: app.treatment || '',
    totalPrice: total,
    payment: paid,
    voucherAmount: voucherAmt,
    balance,
    status,
    touchUpDate: extractDateKey(app.touch_up_date),
    syncCalendar: syncCal,
    notes: app.notes || '',
  });
}

function serializePmuRow(
  app: Appointment,
  rowNum: number,
  locNameMap: Map<string, Location>,
  fallbackLocName: string = 'Studio'
): any[] {
  const dateStr = formatDateForSheet(app.appointment_date);
  const startTime = extractWallTimeFromIso(app.appointment_date) || '10:00';
  const endTime = app.end_time || '';
  const locName = locNameMap.get(app.location_id)?.name || fallbackLocName;
  const paid = round2(Number(app.payment) || 0);
  const voucherAmt = app.used_gift_voucher ? round2(Number(app.used_gift_voucher_amount) || 0) : 0;
  const balance = round2(Number(app.balance) || 0);
  const total =
    app.total_price !== undefined && app.total_price !== null
      ? round2(Number(app.total_price))
      : round2(paid + voucherAmt + balance);

  return [
    dateStr,
    startTime,
    endTime,
    app.client_name || '',
    locName,
    app.treatment || '',
    total,
    paid,
    voucherAmt,
    `=IF(AND(A${rowNum}="";D${rowNum}="");"";MAX(0;IF(ISNUMBER(G${rowNum});G${rowNum};0)-IF(ISNUMBER(H${rowNum});H${rowNum};0)-IF(ISNUMBER(I${rowNum});I${rowNum};0)))`,
    normalizeStatus(app.status, extractDateKey(app.appointment_date)),
    formatDateForSheet(app.touch_up_date),
    app.sync_google_calendar === false ? 'No' : 'Sì',
    app.notes || '',
    app.id,
  ];
}

function computeWeddingHashFromDb(w: WeddingService): string {
  const date = extractDateKey(w.wedding_date);
  const startTime = extractWallTimeFromIso(w.wedding_date) || '08:30';
  const endTime = w.end_time || '';
  const deposit = round2(Number(w.trial_deposit) || 0);
  const voucherAmt = w.used_gift_voucher ? round2(Number(w.used_gift_voucher_amount) || 0) : 0;
  const balance = round2(Number(w.wedding_balance) || 0);
  const total =
    w.total_price !== undefined && w.total_price !== null
      ? round2(Number(w.total_price))
      : round2(deposit + voucherAmt + balance);
  const status = normalizeStatus(w.status, date);
  const syncCal = w.sync_google_calendar !== false;

  return hashWeddingFields({
    date,
    startTime,
    endTime,
    eventType: w.event_type || 'Matrimonio',
    brideName: w.bride_name || '',
    address: w.address || '',
    peopleCount: Math.max(1, Number(w.people_count) || 1),
    totalPrice: total,
    deposit,
    voucherAmount: voucherAmt,
    balance,
    trialDate: extractDateKey(w.trial_date),
    status,
    syncCalendar: syncCal,
    notes: w.notes || '',
  });
}

function serializeWeddingRow(w: WeddingService, rowNum: number): any[] {
  const dateStr = formatDateForSheet(w.wedding_date);
  const startTime = extractWallTimeFromIso(w.wedding_date) || '08:30';
  const endTime = w.end_time || '';
  const deposit = round2(Number(w.trial_deposit) || 0);
  const voucherAmt = w.used_gift_voucher ? round2(Number(w.used_gift_voucher_amount) || 0) : 0;
  const balance = round2(Number(w.wedding_balance) || 0);
  const total =
    w.total_price !== undefined && w.total_price !== null
      ? round2(Number(w.total_price))
      : round2(deposit + voucherAmt + balance);

  return [
    dateStr,
    startTime,
    endTime,
    w.event_type || 'Matrimonio',
    w.bride_name || '',
    w.address || '',
    Math.max(1, Number(w.people_count) || 1),
    total,
    deposit,
    voucherAmt,
    `=IF(AND(A${rowNum}="";E${rowNum}="");"";MAX(0;IF(ISNUMBER(H${rowNum});H${rowNum};0)-IF(ISNUMBER(I${rowNum});I${rowNum};0)-IF(ISNUMBER(J${rowNum});J${rowNum};0)))`,
    formatDateForSheet(w.trial_date),
    normalizeStatus(w.status, extractDateKey(w.wedding_date)),
    w.sync_google_calendar === false ? 'No' : 'Sì',
    w.notes || '',
    w.id,
  ];
}

function computeExpenseHashFromDb(e: Expense): string {
  return hashExpenseFields({
    date: extractDateKey(e.date),
    category: e.category || 'Materiale',
    item: e.item || '',
    amount: round2(Number(e.amount) || 0),
    notes: e.notes || '',
  });
}

function serializeExpenseRow(e: Expense): any[] {
  return [
    formatDateForSheet(e.date),
    e.category || 'Materiale',
    e.item || '',
    round2(Number(e.amount) || 0),
    e.notes || '',
    e.id,
  ];
}

function computeVoucherHashFromDb(v: GiftVoucher): string {
  const initVal = round2(getVoucherInitialAmount(v));
  const remVal = round2(getVoucherRemainingAmount(v));
  return hashVoucherFields({
    purchaseDate: extractDateKey(v.purchase_date),
    buyerName: v.buyer_name || '',
    recipientName: v.recipient_name || '',
    initialAmount: initVal,
    remainingAmount: remVal,
    isUsed: remVal <= 0,
    notes: v.notes || '',
  });
}

function serializeVoucherRow(v: GiftVoucher, rowNum: number): any[] {
  const initVal = round2(getVoucherInitialAmount(v));
  const remVal = round2(getVoucherRemainingAmount(v));
  return [
    formatDateForSheet(v.purchase_date),
    v.buyer_name || '',
    v.recipient_name || '',
    initVal,
    remVal,
    `=IF(AND(A${rowNum}="";B${rowNum}="");"";IF(IF(ISNUMBER(E${rowNum});E${rowNum};0)<=0;"Esaurito";IF(IF(ISNUMBER(E${rowNum});E${rowNum};0)<IF(ISNUMBER(D${rowNum});D${rowNum};0);"Parzialmente Usato";"Attivo")))`,
    v.notes || '',
    v.id,
  ];
}

// ============================================================================
// Reference Tab (_Liste) & Read-Only Riepilogo Tab Builders
// ============================================================================

function buildListsTabRows(
  clients: Client[],
  locations: Location[],
  servicePrices: ServicePrice[]
): any[][] {
  const locById = new Map<string, Location>();
  locations.forEach(l => locById.set(l.id, l));

  const sortedClients = Array.from(
    new Set(clients.map(c => (c.full_name || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));

  const activeLocations = locations
    .filter(l => l.active !== false)
    .map(l => l.name.trim())
    .filter(Boolean);

  const treatmentSet = new Set<string>(DEFAULT_PMU_TREATMENTS);
  servicePrices.forEach(sp => {
    if (sp.name?.trim()) treatmentSet.add(sp.name.trim());
  });
  const sortedTreatments = Array.from(treatmentSet).sort((a, b) =>
    a.localeCompare(b, 'it', { sensitivity: 'base' })
  );

  const pricePairs: Array<{ key: string; price: number }> = [];
  servicePrices.forEach(sp => {
    const loc = locById.get(sp.location_id);
    if (loc?.name && sp.name) {
      pricePairs.push({ key: `${loc.name.trim()}|${sp.name.trim()}`, price: Number(sp.price) || 0 });
    }
  });

  const maxLen = Math.max(
    sortedClients.length,
    activeLocations.length,
    sortedTreatments.length,
    pricePairs.length,
    1
  );

  const rows: any[][] = [
    ['Clienti', 'Sedi', 'Trattamenti', 'Chiave Sede|Trattamento', 'Prezzo Listino'],
  ];

  for (let i = 0; i < maxLen; i++) {
    rows.push([
      sortedClients[i] || '',
      activeLocations[i] || '',
      sortedTreatments[i] || '',
      pricePairs[i]?.key || '',
      pricePairs[i] !== undefined ? pricePairs[i].price : '',
    ]);
  }

  return rows;
}

export function buildSummaryTabRows(params: {
  years: number[];
  currentYear: number;
  yearlyTarget: number;
  syncedLabel: string;
}): { rows: any[][]; layout: SummaryLayoutMeta } {
  const { years, currentYear, yearlyTarget, syncedLabel } = params;
  const normalizedYears = Array.from(
    new Set(years.filter(y => Number.isInteger(y) && y >= 2000 && y <= 2100))
  ).sort((a, b) => b - a);
  const sortedYears = normalizedYears.length > 0 ? normalizedYears : [currentYear];

  const yearSpanLabel =
    sortedYears.length > 1
      ? `${sortedYears[sortedYears.length - 1]}–${sortedYears[0]}`
      : String(sortedYears[0]);

  const pmuRef = `'${SHEET_TABS.PMU}'`;
  const wedRef = `'${SHEET_TABS.WEDDINGS}'`;
  const expRef = `'${SHEET_TABS.EXPENSES}'`;
  const vouRef = `'${SHEET_TABS.VOUCHERS}'`;

  const n = sortedYears.length;
  const annualHeaderRowIndex = 6; // 0-based (Row 7)
  const annualFirstDataIndex = 7; // 0-based (Row 8)
  const annualLastDataIndex = 6 + n; // 0-based (Row 7 + n)
  const annualTotalRowIndex = 7 + n; // 0-based (Row 8 + n)

  const annualFirstDataRow = annualFirstDataIndex + 1;
  const annualLastDataRow = annualLastDataIndex + 1;
  const annualTotalRow = annualTotalRowIndex + 1;

  const currentYearIdx = sortedYears.indexOf(currentYear);
  const currentYearAnnualRow =
    currentYearIdx >= 0 ? annualFirstDataRow + currentYearIdx : annualFirstDataRow;

  const rows: any[][] = [
    [`RIEPILOGO FINANZIARIO (${yearSpanLabel}) — GESTIONALE FEDE (SOLA LETTURA)`],
    [
      `Ultimo aggiornamento: ${syncedLabel} • Confronto tutti gli anni e dettaglio mensile live dalle schede PMU, Eventi, Spese e Buoni Regalo`,
    ],
    [],
    [
      'Fatturato Totale (Tutti gli anni)',
      'PMU + Buoni (Totale)',
      'Eventi & Cerimonie (Totale)',
      'Spese Totali',
      'Utile Netto Totale',
      'Crediti Da Saldare',
      `Obiettivo ${currentYear} (${yearlyTarget.toLocaleString('it-IT')} €)`,
    ],
    [
      `=D${annualTotalRow}`,
      `=B${annualTotalRow}`,
      `=C${annualTotalRow}`,
      `=E${annualTotalRow}`,
      `=F${annualTotalRow}`,
      `=G${annualTotalRow}`,
      `=IFERROR(D${currentYearAnnualRow}/${Math.max(1, yearlyTarget)};0)`,
    ],
    [],
    ['Anno', 'PMU + Buoni (€)', 'Eventi (€)', 'Totale Ricavi (€)', 'Spese (€)', 'Utile Netto (€)', 'Da Saldare (€)'],
  ];

  const yearBlocks: SummaryYearBlockLayout[] = sortedYears.map((yr, bIdx) => {
    const spacerIndex = annualTotalRowIndex + 1 + bIdx * 16;
    const bannerRowIndex = spacerIndex + 1;
    const headerRowIndex = spacerIndex + 2;
    const firstMonthIndex = spacerIndex + 3;
    const lastMonthIndex = spacerIndex + 14;
    const totalRowIndex = spacerIndex + 15;
    return {
      year: yr,
      bannerRowIndex,
      headerRowIndex,
      firstMonthIndex,
      lastMonthIndex,
      totalRowIndex,
    };
  });

  // Annual Comparison Data Rows (Rows 8 .. 7 + n)
  yearBlocks.forEach(block => {
    const tRow = block.totalRowIndex + 1; // 1-based reference to block total row
    rows.push([
      block.year,
      `=B${tRow}`,
      `=C${tRow}`,
      `=D${tRow}`,
      `=E${tRow}`,
      `=F${tRow}`,
      `=G${tRow}`,
    ]);
  });

  // Annual Comparison Total Row (Row 8 + n)
  rows.push([
    'TOTALE TUTTI GLI ANNI',
    `=SUM(B${annualFirstDataRow}:B${annualLastDataRow})`,
    `=SUM(C${annualFirstDataRow}:C${annualLastDataRow})`,
    `=SUM(D${annualFirstDataRow}:D${annualLastDataRow})`,
    `=SUM(E${annualFirstDataRow}:E${annualLastDataRow})`,
    `=SUM(F${annualFirstDataRow}:F${annualLastDataRow})`,
    `=SUM(G${annualFirstDataRow}:G${annualLastDataRow})`,
  ]);

  // Per-Year Monthly Breakdown Blocks (16 rows each)
  for (const block of yearBlocks) {
    const yr = block.year;
    rows.push([]); // Spacer row
    rows.push([`DETTAGLIO MENSILE ${yr}`]);
    rows.push(['Mese', 'PMU + Buoni (€)', 'Eventi (€)', 'Totale Ricavi (€)', 'Spese (€)', 'Utile Netto (€)', 'Da Saldare (€)']);

    for (let m = 1; m <= 12; m++) {
      const r = block.firstMonthIndex + m; // 1-based spreadsheet row
      const nextYear = m === 12 ? yr + 1 : yr;
      const nextMonth = m === 12 ? 1 : m + 1;
      const startCond = `">="&DATE(${yr};${m};1)`;
      const endCond = `"<"&DATE(${nextYear};${nextMonth};1)`;

      const pmuCash =
        `=SUMIFS(${pmuRef}!$H:$H;${pmuRef}!$A:$A;${startCond};${pmuRef}!$A:$A;${endCond};${pmuRef}!$K:$K;"<>annullato")` +
        `+SUMIFS(${vouRef}!$D:$D;${vouRef}!$A:$A;${startCond};${vouRef}!$A:$A;${endCond})`;

      const wedCash =
        `=SUMIFS(${wedRef}!$I:$I;${wedRef}!$A:$A;${startCond};${wedRef}!$A:$A;${endCond};${wedRef}!$M:$M;"<>annullato")`;

      const totRev = `=B${r}+C${r}`;
      const expFormula = `=SUMIFS(${expRef}!$D:$D;${expRef}!$A:$A;${startCond};${expRef}!$A:$A;${endCond})`;
      const netFormula = `=D${r}-E${r}`;
      const balFormula =
        `=SUMIFS(${pmuRef}!$J:$J;${pmuRef}!$A:$A;${startCond};${pmuRef}!$A:$A;${endCond};${pmuRef}!$K:$K;"<>annullato")` +
        `+SUMIFS(${wedRef}!$K:$K;${wedRef}!$A:$A;${startCond};${wedRef}!$A:$A;${endCond};${wedRef}!$M:$M;"<>annullato")`;

      rows.push([
        `${MONTH_NAMES_IT[m - 1]} ${yr}`,
        pmuCash,
        wedCash,
        totRev,
        expFormula,
        netFormula,
        balFormula,
      ]);
    }

    const mStartRow = block.firstMonthIndex + 1;
    const mEndRow = block.lastMonthIndex + 1;
    rows.push([
      `TOTALE ${yr}`,
      `=SUM(B${mStartRow}:B${mEndRow})`,
      `=SUM(C${mStartRow}:C${mEndRow})`,
      `=SUM(D${mStartRow}:D${mEndRow})`,
      `=SUM(E${mStartRow}:E${mEndRow})`,
      `=SUM(F${mStartRow}:F${mEndRow})`,
      `=SUM(G${mStartRow}:G${mEndRow})`,
    ]);
  }

  return {
    rows,
    layout: {
      annualHeaderRowIndex,
      annualFirstDataIndex,
      annualLastDataIndex,
      annualTotalRowIndex,
      yearBlocks,
      totalRowCount: rows.length,
    },
  };
}

// ============================================================================
// Helper DB Queries & Google Calendar Helpers
// ============================================================================

async function loadSyncState(): Promise<GoogleSheetsSyncState> {
  const supabase = getServerSupabase();
  const { data } = await (supabase.from('settings') as any)
    .select('value')
    .eq('key', SYNC_STATE_SETTINGS_KEY)
    .single();
  if (data?.value && typeof data.value === 'object') {
    return data.value as GoogleSheetsSyncState;
  }
  return {};
}

async function saveSyncState(state: GoogleSheetsSyncState): Promise<void> {
  const supabase = getServerSupabase();
  await safeServerUpsert(supabase, 'settings', {
    key: SYNC_STATE_SETTINGS_KEY,
    value: state,
  });
}

export async function markAppDirtyForSheetSync(): Promise<void> {
  try {
    const prev = await loadSyncState();
    await saveSyncState({
      ...prev,
      dirty_from_app: true,
      app_last_mutated_at: Date.now(),
    });
  } catch (err) {
    console.warn('markAppDirtyForSheetSync failed:', err);
  }
}

export async function getMasterSheetStatus(): Promise<MasterSheetStatus> {
  const [tokens, state] = await Promise.all([getStoredTokens(), loadSyncState()]);
  const googleConnected = Boolean(tokens && (tokens.access_token || tokens.refresh_token));
  return {
    googleConnected,
    googleEmail: tokens?.email,
    spreadsheetId: state.spreadsheet_id,
    spreadsheetUrl: state.spreadsheet_url,
    ownerEmail: state.owner_email,
    lastSyncedAt: state.last_synced_at,
    lastSyncSummary: state.last_sync_summary,
    lastSyncWarning: state.last_sync_warning || null,
  };
}

function buildGeneratedId(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

function splitFirstLast(fullName: string): { first_name: string; last_name: string; full_name: string } {
  const clean = fullName.trim().replace(/\s+/g, ' ');
  const parts = clean.split(' ');
  const first_name = parts[0] || 'Cliente';
  const last_name = parts.slice(1).join(' ') || '-';
  return { first_name, last_name, full_name: clean };
}

function ensureClientForName(
  rawName: string,
  clientsByName: Map<string, Client>,
  newClientsToSave: Map<string, Client>
): { clientId?: string; normalizedName: string } {
  const clean = rawName.trim().replace(/\s+/g, ' ');
  if (!clean) return { normalizedName: '' };
  const key = clean.toLowerCase();
  const existing = clientsByName.get(key);
  if (existing) {
    return { clientId: existing.id, normalizedName: existing.full_name };
  }
  const split = splitFirstLast(clean);
  const created: Client = {
    id: buildGeneratedId('cli'),
    first_name: split.first_name,
    last_name: split.last_name,
    full_name: split.full_name,
  };
  clientsByName.set(key, created);
  newClientsToSave.set(created.id, created);
  return { clientId: created.id, normalizedName: created.full_name };
}

async function syncPmuWithGoogleCalendar(
  app: Appointment,
  locMap: Map<string, Location>
): Promise<Appointment> {
  const shouldSync = app.sync_google_calendar !== false && app.status !== 'annullato';
  if (!shouldSync) {
    if (app.google_calendar_event_id) {
      await deleteGoogleCalendarEvent(app.google_calendar_event_id);
      return { ...app, google_calendar_event_id: undefined };
    }
    return app;
  }

  const loc = locMap.get(app.location_id);
  const locationString = loc?.address ? `${loc.name} (${loc.address})` : loc?.name || '';
  const datePrefix = extractDateKey(app.appointment_date);
  const startTime = extractWallTimeFromIso(app.appointment_date) || '10:00';
  const endTime = app.end_time || addHoursToTimeStr(startTime, 2) || '12:00';
  const total = app.total_price ?? app.payment + app.balance;

  const res = await syncGoogleCalendarEvent({
    eventId: app.google_calendar_event_id,
    title: `PMU: ${app.client_name} - ${app.treatment}`,
    startDate: `${datePrefix}T${startTime}:00`,
    endDate: `${datePrefix}T${endTime}:00`,
    location: locationString,
    colorHex: loc?.color,
    details: `Tipo: Trattamento PMU\nTrattamento: ${app.treatment}\nOrario: ${startTime} - ${endTime}\nTotale Trattamento: ${total}€\nDenaro Ricevuto: ${app.payment}€\nDa Saldare: ${app.balance}€\nNote: ${app.notes || ''}`,
  });

  if (res.success && res.eventId && res.eventId !== app.google_calendar_event_id) {
    return { ...app, google_calendar_event_id: res.eventId };
  }
  return app;
}

async function syncWeddingWithGoogleCalendar(w: WeddingService): Promise<WeddingService> {
  const shouldSync = w.sync_google_calendar !== false && w.status !== 'annullato';
  if (!shouldSync) {
    let updated = { ...w };
    if (w.google_calendar_event_id) {
      await deleteGoogleCalendarEvent(w.google_calendar_event_id);
      updated.google_calendar_event_id = undefined;
    }
    if (w.google_calendar_trial_event_id) {
      await deleteGoogleCalendarEvent(w.google_calendar_trial_event_id);
      updated.google_calendar_trial_event_id = undefined;
    }
    return updated;
  }

  const updated = { ...w };
  const eventType = w.event_type || 'Matrimonio';
  const dateOnly = extractDateKey(w.wedding_date);
  const startTime = extractWallTimeFromIso(w.wedding_date) || '08:30';
  const endTime = w.end_time || '11:30';

  const mainRes = await syncGoogleCalendarEvent({
    eventId: w.google_calendar_event_id,
    title: `✨ ${eventType.toUpperCase()}: ${w.bride_name}`,
    startDate: `${dateOnly}T${startTime}:00`,
    endDate: `${dateOnly}T${endTime}:00`,
    location: w.address || '',
    colorHex: PASTEL_EVENT_COLORS.EVENT_DAY,
    details: `Tipo: ${eventType}\nCliente: ${w.bride_name}\nPersone da truccare: ${w.people_count}\nIndirizzo/Luogo: ${w.address || 'Non specificato'}\nOrario: ${startTime} - ${endTime}\nTotale Servizio: ${w.total_price}€\nAcconto/Ricevuto: ${w.trial_deposit}€\nDa saldare: ${w.wedding_balance}€\nNote: ${w.notes || ''}`,
  });

  if (mainRes.success && mainRes.eventId) {
    updated.google_calendar_event_id = mainRes.eventId;
  }

  if (w.trial_date) {
    const trialDateOnly = extractDateKey(w.trial_date);
    const trialTime = extractWallTimeFromIso(w.trial_date) || '15:00';
    const trialEnd = w.trial_end_time || '16:30';
    const trialRes = await syncGoogleCalendarEvent({
      eventId: w.google_calendar_trial_event_id,
      title: `💄 Prova Trucco: ${w.bride_name} (${eventType})`,
      startDate: `${trialDateOnly}T${trialTime}:00`,
      endDate: `${trialDateOnly}T${trialEnd}:00`,
      location: w.address || '',
      colorHex: PASTEL_EVENT_COLORS.EVENT_TRIAL,
      details: `Prova trucco per evento del ${dateOnly}\nOrario: ${trialTime} - ${trialEnd}\nAcconto prova: ${w.trial_deposit}€\nNote: ${w.notes || ''}`,
    });
    if (trialRes.success && trialRes.eventId) {
      updated.google_calendar_trial_event_id = trialRes.eventId;
    }
  } else if (w.google_calendar_trial_event_id) {
    await deleteGoogleCalendarEvent(w.google_calendar_trial_event_id);
    updated.google_calendar_trial_event_id = undefined;
  }

  return updated;
}

// ============================================================================
// Main Orchestrator
// ============================================================================

export async function runGoogleSheetsSync(options: {
  source: 'app' | 'manual' | 'cron';
  force?: boolean;
  createIfMissing?: boolean;
}): Promise<MasterSheetSyncResult> {
  const { source, force = false, createIfMissing = false } = options;

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return {
      ok: false,
      status: 'not_connected',
      error: 'Account Google non collegato. Connettilo dalle Impostazioni.',
    };
  }

  const supabase = getServerSupabase();
  const lockOwner = `${source}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  const { data: lockAcquired, error: lockErr } = await supabase.rpc('acquire_sheets_sync_lock', {
    p_owner: lockOwner,
    p_ttl_seconds: 50,
  });

  if (lockErr || !lockAcquired) {
    return {
      ok: true,
      status: 'locked',
      summary: 'Sincronizzazione già in corso.',
    };
  }

  try {
    const [tokens, prevState] = await Promise.all([getStoredTokens(), loadSyncState()]);
    const currentEmail = tokens?.email || '';

    let spreadsheetId = prevState.spreadsheet_id;
    let spreadsheetUrl = prevState.spreadsheet_url;
    let snapshots: SyncSnapshotsState = {
      appointments: { ...(prevState.snapshots?.appointments || {}) },
      weddings: { ...(prevState.snapshots?.weddings || {}) },
      expenses: { ...(prevState.snapshots?.expenses || {}) },
      vouchers: { ...(prevState.snapshots?.vouchers || {}) },
    };

    const emailChanged =
      Boolean(prevState.owner_email) &&
      Boolean(currentEmail) &&
      prevState.owner_email?.toLowerCase() !== currentEmail.toLowerCase();

    if (emailChanged) {
      spreadsheetId = undefined;
      spreadsheetUrl = undefined;
      snapshots = { ...EMPTY_SNAPSHOTS };
    }

    const templateUpgraded = (prevState.template_version || 1) < SHEET_TEMPLATE_VERSION;

    // Fast-path for cron (or background polling) when nothing changed on Drive, App is clean, and template is up to date
    if (spreadsheetId && !force && !prevState.dirty_from_app && !templateUpgraded && source === 'cron') {
      const meta = await getDriveFileMetadata(accessToken, spreadsheetId);
      if (meta && !meta.trashed) {
        if (meta.modifiedTime && meta.modifiedTime === prevState.last_sheet_modified_time) {
          return {
            ok: true,
            status: 'noop',
            spreadsheetId,
            spreadsheetUrl: meta.webViewLink || spreadsheetUrl,
            dataChanged: false,
            templateVersion: SHEET_TEMPLATE_VERSION,
          };
        }
      } else {
        // Spreadsheet missing or trashed -> recreate below
        spreadsheetId = undefined;
        spreadsheetUrl = undefined;
        snapshots = { ...EMPTY_SNAPSHOTS };
      }
    }

    // Verify file still exists on Drive if configured
    let driveMeta = spreadsheetId ? await getDriveFileMetadata(accessToken, spreadsheetId) : null;
    if (spreadsheetId && (!driveMeta || driveMeta.trashed)) {
      spreadsheetId = undefined;
      spreadsheetUrl = undefined;
      snapshots = { ...EMPTY_SNAPSHOTS };
      driveMeta = null;
    }

    if (!spreadsheetId) {
      if (!createIfMissing && source === 'cron') {
        return {
          ok: true,
          status: 'noop',
          summary: 'Foglio Google Master non ancora inizializzato.',
          dataChanged: false,
          templateVersion: SHEET_TEMPLATE_VERSION,
        };
      }
      if (!createIfMissing && source === 'app') {
        return {
          ok: true,
          status: 'noop',
          summary: 'Foglio Google Master non ancora creato.',
          dataChanged: false,
          templateVersion: SHEET_TEMPLATE_VERSION,
        };
      }

      const created = await createMasterSpreadsheet(accessToken);
      spreadsheetId = created.spreadsheetId;
      spreadsheetUrl = created.spreadsheetUrl;
      driveMeta = {
        id: spreadsheetId,
        modifiedTime: created.modifiedTime,
        webViewLink: spreadsheetUrl,
      };
      snapshots = { ...EMPTY_SNAPSHOTS };
    } else if (driveMeta?.webViewLink) {
      spreadsheetUrl = driveMeta.webViewLink;
    }

    const structure = await ensureSpreadsheetStructure(accessToken, spreadsheetId);
    if (!spreadsheetUrl) {
      spreadsheetUrl = structure.spreadsheetUrl;
    }

    // Fetch current DB state in parallel + read existing Sheet rows
    const [
      locationsRes,
      clientsRes,
      appointmentsRes,
      weddingsRes,
      expensesRes,
      vouchersRes,
      servicePricesRes,
      appSettingsRes,
      rawTabs,
    ] = await Promise.all([
      fetchAllServerRows<Location>(supabase, 'locations'),
      fetchAllServerRows<Client>(supabase, 'clients', 'created_at', false),
      fetchAllServerRows<Appointment>(supabase, 'appointments', 'appointment_date', false),
      fetchAllServerRows<WeddingService>(supabase, 'wedding_services', 'wedding_date', false),
      fetchAllServerRows<Expense>(supabase, 'expenses', 'date', false),
      fetchAllServerRows<GiftVoucher>(supabase, 'gift_vouchers', 'purchase_date', false),
      fetchAllServerRows<ServicePrice>(supabase, 'service_prices', 'name', true),
      (async () => {
        const { data } = await (supabase.from('settings') as any)
          .select('value')
          .eq('key', 'app_settings')
          .single();
        return data?.value || {};
      })(),
      readAllBidirectionalTabs(accessToken, spreadsheetId),
    ]);

    const locations = locationsRes.rows;
    const locById = new Map<string, Location>();
    const locByName = new Map<string, Location>();
    locations.forEach(l => {
      locById.set(l.id, l);
      if (l.name) locByName.set(l.name.trim().toLowerCase(), l);
    });
    const fallbackLocation = locations.find(l => l.active !== false) || locations[0] || {
      id: 'loc-studio',
      name: 'Studio',
      color: '#E879A8',
      active: true,
    };

    const clientsByName = new Map<string, Client>();
    clientsRes.rows.forEach(c => {
      if (c.full_name) clientsByName.set(c.full_name.trim().toLowerCase(), c);
    });
    const newClientsToSave = new Map<string, Client>();

    const sheetModifiedMs = driveMeta?.modifiedTime ? Date.parse(driveMeta.modifiedTime) || 0 : 0;
    const appMutatedMs = Number(prevState.app_last_mutated_at || 0);

    // --------------------
    // 1. Parse PMU rows
    // --------------------
    const pmuParsed: Array<ParsedSheetRow<Appointment>> = [];
    const pmuDraftRows: any[][] = [];
    const seenPmuIds = new Set<string>();

    for (const raw of rawTabs.pmuRows) {
      const dateIso = parseSheetDate(raw[0]);
      const startTime = parseSheetTime(raw[1]);
      const endTimeRaw = parseSheetTime(raw[2]);
      const clientName = cleanText(raw[3]);
      const locText = cleanText(raw[4]);
      const treatment = cleanText(raw[5]);
      const notes = cleanText(raw[13]);
      const rowId = cleanText(raw[14]);

      const hasUserContent = Boolean(
        dateIso || startTime || clientName || locText || treatment || parseSheetNumber(raw[7]) > 0 || raw[11] || notes || rowId
      );
      if (!hasUserContent) continue;

      if (!dateIso || !clientName) {
        if (!rowId) {
          pmuDraftRows.push(raw.slice(0, 15));
        }
        continue;
      }

      const finalStart = startTime || '10:00';
      const finalEnd = endTimeRaw || (rowId ? '' : addHoursToTimeStr(finalStart, 2));
      const matchedLoc = (locText ? locByName.get(locText.toLowerCase()) : undefined) || fallbackLocation;
      const resolvedClient = ensureClientForName(clientName, clientsByName, newClientsToSave);
      const total = parseSheetNumber(raw[6]);
      const paid = parseSheetNumber(raw[7]);
      const voucherAmt = parseSheetNumber(raw[8]);
      const computedBalance =
        total > 0 || paid > 0 || voucherAmt > 0
          ? Math.max(0, round2(total - paid - voucherAmt))
          : parseSheetNumber(raw[9]);
      const status = normalizeStatus(raw[10], dateIso);
      const touchUpDate = parseSheetDate(raw[11]);
      const syncCal = parseSheetBool(raw[12], true);

      let id = rowId || buildGeneratedId('pmu');
      if (seenPmuIds.has(id)) {
        id = buildGeneratedId('pmu');
      }
      seenPmuIds.add(id);

      const appItem: Appointment = {
        id,
        category: 'pmu',
        client_id: resolvedClient.clientId,
        client_name: resolvedClient.normalizedName || clientName,
        location_id: matchedLoc.id,
        treatment: treatment || (rowId ? '' : 'Trattamento PMU'),
        appointment_date: `${dateIso}T${finalStart}:00`,
        end_time: finalEnd || undefined,
        total_price: total > 0 ? total : round2(paid + voucherAmt + computedBalance),
        payment: paid,
        balance: computedBalance,
        touch_up_date: touchUpDate,
        notes,
        sync_google_calendar: syncCal,
        status,
      };

      const hash = computePmuHashFromDb(appItem, locById, fallbackLocation.name);
      pmuParsed.push({ id, hash, item: appItem });
    }

    // --------------------
    // 2. Parse Weddings rows
    // --------------------
    const wedParsed: Array<ParsedSheetRow<WeddingService>> = [];
    const wedDraftRows: any[][] = [];
    const seenWedIds = new Set<string>();

    for (const raw of rawTabs.weddingRows) {
      const dateIso = parseSheetDate(raw[0]);
      const startTime = parseSheetTime(raw[1]);
      const endTimeRaw = parseSheetTime(raw[2]);
      const eventType = cleanText(raw[3]);
      const brideName = cleanText(raw[4]);
      const address = cleanText(raw[5]);
      const peopleRaw = parseSheetNumber(raw[6]);
      const notes = cleanText(raw[14]);
      const rowId = cleanText(raw[15]);

      const hasPrimaryInput = Boolean(
        dateIso || startTime || eventType || brideName || address || parseSheetNumber(raw[7]) > 0 || parseSheetNumber(raw[8]) > 0 || raw[11] || notes || rowId
      );
      if (!hasPrimaryInput) continue;

      if (!dateIso || (!brideName && !eventType)) {
        if (!rowId) {
          wedDraftRows.push(raw.slice(0, 16));
        }
        continue;
      }

      const finalStart = startTime || '08:30';
      const finalEnd = endTimeRaw || (rowId ? '' : addHoursToTimeStr(finalStart, 3));
      const finalEventType = eventType || 'Matrimonio';
      const resolvedClient = brideName
        ? ensureClientForName(brideName, clientsByName, newClientsToSave)
        : { clientId: undefined, normalizedName: finalEventType };
      const peopleCount = Math.max(1, Math.round(peopleRaw || 1));
      const total = parseSheetNumber(raw[7]);
      const deposit = parseSheetNumber(raw[8]);
      const voucherAmt = parseSheetNumber(raw[9]);
      const computedBalance =
        total > 0 || deposit > 0 || voucherAmt > 0
          ? Math.max(0, round2(total - deposit - voucherAmt))
          : parseSheetNumber(raw[10]);
      const trialDate = parseSheetDate(raw[11]);
      const status = normalizeStatus(raw[12], dateIso);
      const syncCal = parseSheetBool(raw[13], true);

      let id = rowId || buildGeneratedId('wed');
      if (seenWedIds.has(id)) id = buildGeneratedId('wed');
      seenWedIds.add(id);

      const wedItem: WeddingService = {
        id,
        bride_name: resolvedClient.normalizedName || finalEventType,
        client_id: resolvedClient.clientId,
        event_type: finalEventType,
        address: address || undefined,
        wedding_date: `${dateIso}T${finalStart}:00`,
        end_time: finalEnd || undefined,
        trial_date: trialDate ? `${trialDate}T15:00:00` : null,
        trial_end_time: trialDate ? '16:30' : undefined,
        people_count: peopleCount,
        trial_deposit: deposit,
        wedding_balance: computedBalance,
        total_price: total > 0 ? total : round2(deposit + voucherAmt + computedBalance),
        notes,
        sync_google_calendar: syncCal,
        status,
      };

      const hash = computeWeddingHashFromDb(wedItem);
      wedParsed.push({ id, hash, item: wedItem });
    }

    // --------------------
    // 3. Parse Expenses rows
    // --------------------
    const expParsed: Array<ParsedSheetRow<Expense>> = [];
    const expDraftRows: any[][] = [];
    const seenExpIds = new Set<string>();

    for (const raw of rawTabs.expenseRows) {
      const dateIso = parseSheetDate(raw[0]);
      const category = cleanText(raw[1]) || 'Materiale';
      const itemDesc = cleanText(raw[2]);
      const amount = parseSheetNumber(raw[3]);
      const notes = cleanText(raw[4]);
      const rowId = cleanText(raw[5]);

      const hasUserContent = Boolean(dateIso || cleanText(raw[1]) || itemDesc || amount > 0 || notes || rowId);
      if (!hasUserContent) continue;

      if (!dateIso || !itemDesc || amount <= 0) {
        if (!rowId) {
          expDraftRows.push(raw.slice(0, 6));
        }
        continue;
      }

      let id = rowId || buildGeneratedId('exp');
      if (seenExpIds.has(id)) id = buildGeneratedId('exp');
      seenExpIds.add(id);

      const expItem: Expense = {
        id,
        date: dateIso,
        category: EXPENSE_CATEGORY_OPTIONS.includes(category) ? category : category,
        item: itemDesc,
        amount,
        notes,
      };
      expParsed.push({ id, hash: computeExpenseHashFromDb(expItem), item: expItem });
    }

    // --------------------
    // 4. Parse Gift Vouchers rows
    // --------------------
    const vouParsed: Array<ParsedSheetRow<GiftVoucher>> = [];
    const vouDraftRows: any[][] = [];
    const seenVouIds = new Set<string>();

    for (const raw of rawTabs.voucherRows) {
      const dateIso = parseSheetDate(raw[0]);
      const buyerName = cleanText(raw[1]);
      const recipientRaw = cleanText(raw[2]);
      const recipientName = recipientRaw.toLowerCase() === 'da definire' ? '' : recipientRaw;
      const initialAmount = parseSheetNumber(raw[3]);
      const remRaw = raw[4] === '' || raw[4] === null || raw[4] === undefined ? initialAmount : parseSheetNumber(raw[4]);
      const remainingAmount = Math.max(0, Math.min(initialAmount || remRaw, remRaw));
      const notes = cleanText(raw[6]);
      const rowId = cleanText(raw[7]);

      const hasUserContent = Boolean(dateIso || buyerName || recipientName || initialAmount > 0 || notes || rowId);
      if (!hasUserContent) continue;

      if (!dateIso || !buyerName || initialAmount <= 0) {
        if (!rowId) {
          vouDraftRows.push(raw.slice(0, 8));
        }
        continue;
      }

      const resolvedBuyer = ensureClientForName(buyerName, clientsByName, newClientsToSave);
      const resolvedRecipient = recipientName
        ? ensureClientForName(recipientName, clientsByName, newClientsToSave)
        : undefined;

      let id = rowId || buildGeneratedId('gv');
      if (seenVouIds.has(id)) id = buildGeneratedId('gv');
      seenVouIds.add(id);

      const vouItem: GiftVoucher = {
        id,
        buyer_id: resolvedBuyer.clientId,
        buyer_name: resolvedBuyer.normalizedName || buyerName,
        recipient_id: resolvedRecipient?.clientId,
        recipient_name: resolvedRecipient?.normalizedName || undefined,
        initial_amount: initialAmount,
        remaining_amount: remainingAmount,
        amount: initialAmount,
        category: 'pmu',
        purchase_date: dateIso,
        is_used: remainingAmount <= 0,
        notes: notes || undefined,
      };
      vouParsed.push({ id, hash: computeVoucherHashFromDb(vouItem), item: vouItem });
    }

    // --------------------
    // 5. Reconcile All 4 Collections (3-Way Diff)
    // --------------------
    const pmuRec = reconcileCollection({
      dbItems: appointmentsRes.rows,
      sheetParsed: pmuParsed,
      snapshotMap: snapshots.appointments,
      getDbHash: item => computePmuHashFromDb(item, locById, fallbackLocation.name),
      mergeDbKeepMeta: (fromSheet, existing) => ({
        ...existing,
        ...fromSheet,
        category: existing.category || fromSheet.category,
        touch_up_time: fromSheet.touch_up_date ? existing.touch_up_time || '10:00' : undefined,
        touch_up_end_time: fromSheet.touch_up_date ? existing.touch_up_end_time || '11:30' : undefined,
        linked_appointment_id: existing.linked_appointment_id,
        is_touch_up: existing.is_touch_up,
        lead_source: existing.lead_source,
        google_calendar_event_id: existing.google_calendar_event_id,
        used_gift_voucher: existing.used_gift_voucher,
        used_gift_voucher_id: existing.used_gift_voucher_id,
        used_gift_voucher_amount: existing.used_gift_voucher_amount,
      }),
      sheetModifiedMs,
      appMutatedMs,
    });

    const wedRec = reconcileCollection({
      dbItems: weddingsRes.rows,
      sheetParsed: wedParsed,
      snapshotMap: snapshots.weddings,
      getDbHash: item => computeWeddingHashFromDb(item),
      mergeDbKeepMeta: (fromSheet, existing) => ({
        ...existing,
        ...fromSheet,
        trial_date: fromSheet.trial_date
          ? existing.trial_date && existing.trial_date.startsWith(fromSheet.trial_date.slice(0, 10))
            ? existing.trial_date
            : fromSheet.trial_date
          : null,
        trial_end_time: fromSheet.trial_date ? existing.trial_end_time || '16:30' : undefined,
        google_calendar_event_id: existing.google_calendar_event_id,
        google_calendar_trial_event_id: existing.google_calendar_trial_event_id,
        used_gift_voucher: existing.used_gift_voucher,
        used_gift_voucher_id: existing.used_gift_voucher_id,
        used_gift_voucher_amount: existing.used_gift_voucher_amount,
      }),
      sheetModifiedMs,
      appMutatedMs,
    });

    const expRec = reconcileCollection({
      dbItems: expensesRes.rows,
      sheetParsed: expParsed,
      snapshotMap: snapshots.expenses,
      getDbHash: item => computeExpenseHashFromDb(item),
      mergeDbKeepMeta: (fromSheet, existing) => ({ ...existing, ...fromSheet }),
      sheetModifiedMs,
      appMutatedMs,
    });

    const vouRec = reconcileCollection({
      dbItems: vouchersRes.rows,
      sheetParsed: vouParsed,
      snapshotMap: snapshots.vouchers,
      getDbHash: item => computeVoucherHashFromDb(item),
      mergeDbKeepMeta: (fromSheet, existing) => ({
        ...existing,
        ...fromSheet,
        payment_method: existing.payment_method,
        used_date: fromSheet.is_used ? existing.used_date || formatRomeTodayIso() : null,
      }),
      sheetModifiedMs,
      appMutatedMs,
    });

    // --------------------
    // 6. Apply DB Mutations + Voucher Restorations + Google Calendar Sync
    // --------------------
    const allClientsList = [...clientsRes.rows];
    if (newClientsToSave.size > 0) {
      const newClients = Array.from(newClientsToSave.values());
      await safeServerUpsert(
        supabase,
        'clients',
        newClients.map(c => ({
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          full_name: c.full_name,
          phone: c.phone || '',
          notes: c.notes || '',
        }))
      );
      allClientsList.push(...newClients);
    }

    // Persist Gift Vouchers changes first
    if (vouRec.toUpsertDb.length > 0) {
      await safeServerUpsert(
        supabase,
        'gift_vouchers',
        vouRec.toUpsertDb.map(v => ({
          id: v.id,
          buyer_id: v.buyer_id || null,
          buyer_name: v.buyer_name,
          recipient_id: v.recipient_id || null,
          recipient_name: v.recipient_name || null,
          initial_amount: v.initial_amount,
          remaining_amount: v.remaining_amount,
          amount: v.amount,
          category: v.category || 'pmu',
          purchase_date: v.purchase_date,
          is_used: v.is_used,
          used_date: v.used_date || null,
          notes: v.notes || null,
        }))
      );
    }
    for (const delId of vouRec.toDeleteDbIds) {
      await safeServerDelete(supabase, 'gift_vouchers', delId);
    }

    // Reconcile restored voucher credit from any deleted PMU/Weddings
    let currentVouchers = vouRec.mergedItems;
    const restoredVoucherIds = new Set<string>();
    for (const delApp of pmuRec.deletedFromSheetItems) {
      if (delApp.used_gift_voucher && delApp.used_gift_voucher_id && (delApp.used_gift_voucher_amount || 0) > 0) {
        const res = reconcileVoucherUsage(
          currentVouchers,
          { voucherId: delApp.used_gift_voucher_id, amount: delApp.used_gift_voucher_amount },
          null
        );
        currentVouchers = res.updatedVouchers;
        res.changedVouchers.forEach(cv => restoredVoucherIds.add(cv.id));
      }
      if (delApp.google_calendar_event_id) {
        await deleteGoogleCalendarEvent(delApp.google_calendar_event_id);
      }
    }
    for (const delWed of wedRec.deletedFromSheetItems) {
      if (delWed.used_gift_voucher && delWed.used_gift_voucher_id && (delWed.used_gift_voucher_amount || 0) > 0) {
        const res = reconcileVoucherUsage(
          currentVouchers,
          { voucherId: delWed.used_gift_voucher_id, amount: delWed.used_gift_voucher_amount },
          null
        );
        currentVouchers = res.updatedVouchers;
        res.changedVouchers.forEach(cv => restoredVoucherIds.add(cv.id));
      }
      if (delWed.google_calendar_event_id) {
        await deleteGoogleCalendarEvent(delWed.google_calendar_event_id);
      }
      if (delWed.google_calendar_trial_event_id) {
        await deleteGoogleCalendarEvent(delWed.google_calendar_trial_event_id);
      }
    }
    if (restoredVoucherIds.size > 0) {
      const changedVouchers = currentVouchers.filter(v => restoredVoucherIds.has(v.id));
      await safeServerUpsert(supabase, 'gift_vouchers', changedVouchers);
      for (const v of changedVouchers) {
        vouRec.nextSnapshots[v.id] = computeVoucherHashFromDb(v);
      }
    }

    // Sync changed PMU appointments with Google Calendar & save to Supabase
    if (pmuRec.toUpsertDb.length > 0) {
      const calSyncedPmus: Appointment[] = [];
      for (const app of pmuRec.toUpsertDb) {
        const withCal = await syncPmuWithGoogleCalendar(app, locById);
        calSyncedPmus.push(withCal);
        const idx = pmuRec.mergedItems.findIndex(x => x.id === withCal.id);
        if (idx >= 0) pmuRec.mergedItems[idx] = withCal;
      }
      await safeServerUpsert(
        supabase,
        'appointments',
        calSyncedPmus.map(a => ({
          id: a.id,
          category: a.category || 'pmu',
          client_id: a.client_id || null,
          client_name: a.client_name,
          location_id: a.location_id,
          treatment: a.treatment,
          appointment_date: a.appointment_date,
          end_time: a.end_time || null,
          total_price: a.total_price ?? null,
          payment: a.payment,
          balance: a.balance,
          touch_up_date: a.touch_up_date || null,
          touch_up_time: a.touch_up_time || null,
          touch_up_end_time: a.touch_up_end_time || null,
          notes: a.notes || '',
          sync_google_calendar: a.sync_google_calendar !== false,
          google_calendar_event_id: a.google_calendar_event_id || null,
          status: a.status,
        }))
      );
    }
    for (const delId of pmuRec.toDeleteDbIds) {
      await safeServerDelete(supabase, 'appointments', delId);
    }

    // Sync changed Weddings with Google Calendar & save to Supabase
    if (wedRec.toUpsertDb.length > 0) {
      const calSyncedWeds: WeddingService[] = [];
      for (const w of wedRec.toUpsertDb) {
        const withCal = await syncWeddingWithGoogleCalendar(w);
        calSyncedWeds.push(withCal);
        const idx = wedRec.mergedItems.findIndex(x => x.id === withCal.id);
        if (idx >= 0) wedRec.mergedItems[idx] = withCal;
      }
      await safeServerUpsert(
        supabase,
        'wedding_services',
        calSyncedWeds.map(w => ({
          id: w.id,
          bride_name: w.bride_name,
          client_id: w.client_id || null,
          event_type: w.event_type || 'Matrimonio',
          address: w.address || '',
          wedding_date: w.wedding_date,
          end_time: w.end_time || null,
          trial_date: w.trial_date || null,
          trial_end_time: w.trial_end_time || null,
          people_count: w.people_count,
          trial_deposit: w.trial_deposit,
          wedding_balance: w.wedding_balance,
          total_price: w.total_price,
          notes: w.notes || '',
          sync_google_calendar: w.sync_google_calendar !== false,
          google_calendar_event_id: w.google_calendar_event_id || null,
          google_calendar_trial_event_id: w.google_calendar_trial_event_id || null,
          status: w.status,
        }))
      );
    }
    for (const delId of wedRec.toDeleteDbIds) {
      await safeServerDelete(supabase, 'wedding_services', delId);
    }

    // Save / delete Expenses
    if (expRec.toUpsertDb.length > 0) {
      await safeServerUpsert(
        supabase,
        'expenses',
        expRec.toUpsertDb.map(e => ({
          id: e.id,
          date: e.date,
          category: e.category,
          item: e.item,
          amount: e.amount,
          notes: e.notes || '',
        }))
      );
    }
    for (const delId of expRec.toDeleteDbIds) {
      await safeServerDelete(supabase, 'expenses', delId);
    }

    // --------------------
    // 7. Write Updated Tabs back to Google Sheet (if needed or first sync)
    // --------------------
    const totalAddedFromSheet =
      pmuRec.addedFromSheetCount +
      wedRec.addedFromSheetCount +
      expRec.addedFromSheetCount +
      vouRec.addedFromSheetCount;
    const totalUpdatedFromSheet =
      pmuRec.updatedFromSheetCount +
      wedRec.updatedFromSheetCount +
      expRec.updatedFromSheetCount +
      vouRec.updatedFromSheetCount;
    const totalDeletedFromSheet =
      pmuRec.deletedFromSheetCount +
      wedRec.deletedFromSheetCount +
      expRec.deletedFromSheetCount +
      vouRec.deletedFromSheetCount;

    const bulkBlockedParts: string[] = [];
    if (pmuRec.bulkDeleteBlockedCount > 0) bulkBlockedParts.push(`PMU (${pmuRec.bulkDeleteBlockedCount})`);
    if (wedRec.bulkDeleteBlockedCount > 0) bulkBlockedParts.push(`Eventi (${wedRec.bulkDeleteBlockedCount})`);
    if (expRec.bulkDeleteBlockedCount > 0) bulkBlockedParts.push(`Spese (${expRec.bulkDeleteBlockedCount})`);
    if (vouRec.bulkDeleteBlockedCount > 0) bulkBlockedParts.push(`Buoni (${vouRec.bulkDeleteBlockedCount})`);

    const warningMsg =
      bulkBlockedParts.length > 0
        ? `Protezione attiva: bloccata l'eliminazione simultanea di oltre ${MAX_BULK_DELETES} righe su ${bulkBlockedParts.join(', ')} e ripristinate dal database.`
        : null;

    const dbChanged = pmuRec.dbChanged || wedRec.dbChanged || expRec.dbChanged || vouRec.dbChanged || newClientsToSave.size > 0;
    const isInitialBuild = Object.keys(prevState.snapshots?.appointments || {}).length === 0 &&
      Object.keys(prevState.snapshots?.weddings || {}).length === 0 &&
      Object.keys(prevState.snapshots?.expenses || {}).length === 0 &&
      Object.keys(prevState.snapshots?.vouchers || {}).length === 0;

    const needsSheetWrite =
      force ||
      isInitialBuild ||
      templateUpgraded ||
      prevState.dirty_from_app ||
      pmuRec.sheetNeedsRewrite ||
      wedRec.sheetNeedsRewrite ||
      expRec.sheetNeedsRewrite ||
      vouRec.sheetNeedsRewrite;

    let newModifiedTime = driveMeta?.modifiedTime;
    let formulaErrors: number | undefined;
    let firstFormulaError: string | undefined;
    const now = new Date();
    const syncedLabel = formatRomeDateTimeLabel(now);
    const currentYear = Number(formatRomeTodayIso(now).slice(0, 4));
    const yearlyTarget = Number(appSettingsRes?.yearly_target) || 35000;

    if (needsSheetWrite) {
      const sortedPmus = [...pmuRec.mergedItems].sort((a, b) =>
        b.appointment_date.localeCompare(a.appointment_date)
      );
      const sortedWeddings = [...wedRec.mergedItems].sort((a, b) =>
        b.wedding_date.localeCompare(a.wedding_date)
      );
      const sortedExpenses = [...expRec.mergedItems].sort((a, b) =>
        b.date.localeCompare(a.date)
      );
      const sortedVouchers = [...currentVouchers].sort((a, b) =>
        b.purchase_date.localeCompare(a.purchase_date)
      );

      const yearSet = new Set<number>([currentYear]);
      const addYearFromStr = (iso?: string | null) => {
        if (!iso || iso.length < 4) return;
        const yr = parseInt(iso.slice(0, 4), 10);
        if (Number.isInteger(yr) && yr >= 2000 && yr <= 2100) {
          yearSet.add(yr);
        }
      };
      sortedPmus.forEach(a => addYearFromStr(a.appointment_date));
      sortedWeddings.forEach(w => addYearFromStr(w.wedding_date));
      sortedExpenses.forEach(e => addYearFromStr(e.date));
      sortedVouchers.forEach(v => addYearFromStr(v.purchase_date));
      const summaryYears = Array.from(yearSet).sort((a, b) => b - a);

      const summaryBuilt = buildSummaryTabRows({
        years: summaryYears,
        currentYear,
        yearlyTarget,
        syncedLabel,
      });

      const writeRes = await writeAllTabsAndFormat(accessToken, spreadsheetId, structure, {
        pmuDataRows: sortedPmus.map((a, idx) =>
          serializePmuRow(a, 3 + idx, locById, fallbackLocation.name)
        ),
        pmuDraftRows,
        weddingDataRows: sortedWeddings.map((w, idx) => serializeWeddingRow(w, 3 + idx)),
        weddingDraftRows: wedDraftRows,
        expenseDataRows: sortedExpenses.map(serializeExpenseRow),
        expenseDraftRows: expDraftRows,
        voucherDataRows: sortedVouchers.map((v, idx) => serializeVoucherRow(v, 3 + idx)),
        voucherDraftRows: vouDraftRows,
        listsRows: buildListsTabRows(allClientsList, locations, servicePricesRes.rows),
        summaryRows: summaryBuilt.rows,
        summaryLayout: summaryBuilt.layout,
      });

      if (writeRes.modifiedTime) {
        newModifiedTime = writeRes.modifiedTime;
      }
      formulaErrors = writeRes.summaryFormulaErrors;
      firstFormulaError = writeRes.firstFormulaError;
    }

    const summaryParts: string[] = [];
    if (totalAddedFromSheet > 0) summaryParts.push(`+${totalAddedFromSheet} dal Foglio`);
    if (totalUpdatedFromSheet > 0) summaryParts.push(`${totalUpdatedFromSheet} aggiornati dal Foglio`);
    if (totalDeletedFromSheet > 0) summaryParts.push(`${totalDeletedFromSheet} eliminati dal Foglio`);
    const summaryText =
      summaryParts.length > 0
        ? `Sincronizzato: ${summaryParts.join(', ')}`
        : needsSheetWrite
        ? 'Foglio Google aggiornato'
        : 'Tutto già sincronizzato';

    await saveSyncState({
      spreadsheet_id: spreadsheetId,
      spreadsheet_url: spreadsheetUrl,
      owner_email: currentEmail || prevState.owner_email,
      template_version: SHEET_TEMPLATE_VERSION,
      last_sheet_modified_time: newModifiedTime,
      dirty_from_app: false,
      app_last_mutated_at: prevState.app_last_mutated_at || Date.now(),
      last_synced_at: now.toISOString(),
      last_sync_summary: summaryText,
      last_sync_warning: warningMsg,
      snapshots: {
        appointments: pmuRec.nextSnapshots,
        weddings: wedRec.nextSnapshots,
        expenses: expRec.nextSnapshots,
        vouchers: vouRec.nextSnapshots,
      },
    });

    return {
      ok: true,
      status: 'synced',
      spreadsheetId,
      spreadsheetUrl,
      dataChanged: dbChanged,
      summary: summaryText,
      warning: warningMsg,
      templateVersion: SHEET_TEMPLATE_VERSION,
      formulaErrors,
      firstFormulaError,
    };
  } catch (err: any) {
    if (err instanceof GoogleSheetsApiError) {
      return {
        ok: false,
        status: 'error',
        error: err.info.sheetsApiDisabled
          ? 'Google Sheets API non ancora abilitata su Google Cloud Console.'
          : err.info.scopeMissing
          ? "Permessi Drive/Fogli mancanti: ricollega l'Account Google nelle Impostazioni."
          : err.info.message,
        sheetsApiDisabled: err.info.sheetsApiDisabled,
        scopeMissing: err.info.scopeMissing,
      };
    }
    console.error('runGoogleSheetsSync error:', err);
    return {
      ok: false,
      status: 'error',
      error: err?.message || 'Errore durante la sincronizzazione con Google Sheets',
    };
  } finally {
    try {
      await supabase.rpc('release_sheets_sync_lock', { p_owner: lockOwner });
    } catch {
      // ignore unlock error; TTL cleans up
    }
  }
}

export { EVENT_TYPE_OPTIONS, EXPENSE_CATEGORY_OPTIONS };
