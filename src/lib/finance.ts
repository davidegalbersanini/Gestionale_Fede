import { Appointment, Expense, GiftVoucher, WeddingService } from '@/types';

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
] as const;

export function extractDateKey(isoStr?: string | null): string {
  if (!isoStr || typeof isoStr !== 'string') return '';
  return isoStr.slice(0, 10);
}

export function getVoucherInitialAmount(v: Pick<GiftVoucher, 'initial_amount' | 'amount'>): number {
  if (v.initial_amount !== undefined && v.initial_amount !== null) {
    return Number(v.initial_amount) || 0;
  }
  return Number(v.amount) || 0;
}

export function getVoucherRemainingAmount(
  v: Pick<GiftVoucher, 'initial_amount' | 'remaining_amount' | 'amount' | 'is_used'>
): number {
  if (v.remaining_amount !== undefined && v.remaining_amount !== null) {
    return Math.max(0, Number(v.remaining_amount) || 0);
  }
  return v.is_used ? 0 : getVoucherInitialAmount(v);
}

export interface MonthlyFinancialRow {
  monthIndex: number;
  monthName: string;
  prefix: string;
  pmuRevenue: number;
  weddingRevenue: number;
  totalRevenue: number;
  pendingBalance: number;
  expensesTotal: number;
  netProfit: number;
  pmuCount: number;
  weddingCount: number;
}

export interface AnnualFinancialSummary {
  totalRevenue: number;
  pmuRevenue: number;
  weddingRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalPendingBalance: number;
  elapsedMonths: number;
  monthlyAverage: number;
  isCurrentYear: boolean;
}

export function computeMonthlyFinancials(
  selectedYear: string,
  appointments: Appointment[],
  weddings: WeddingService[],
  expenses: Expense[],
  vouchers: GiftVoucher[],
  now: Date = new Date()
): { months: MonthlyFinancialRow[]; annual: AnnualFinancialSummary } {
  const months: MonthlyFinancialRow[] = Array.from({ length: 12 }, (_, i) => {
    const mStr = String(i + 1).padStart(2, '0');
    return {
      monthIndex: i,
      monthName: MONTH_NAMES_IT[i],
      prefix: `${selectedYear}-${mStr}`,
      pmuRevenue: 0,
      weddingRevenue: 0,
      totalRevenue: 0,
      pendingBalance: 0,
      expensesTotal: 0,
      netProfit: 0,
      pmuCount: 0,
      weddingCount: 0,
    };
  });

  const getMonthIndex = (dateStr?: string | null): number => {
    if (!dateStr || typeof dateStr !== 'string') return -1;
    if (!dateStr.startsWith(selectedYear)) return -1;
    const m = parseInt(dateStr.slice(5, 7), 10) - 1;
    return m >= 0 && m < 12 ? m : -1;
  };

  // PMU & Generic Appointments (exclude cancelled)
  appointments.forEach(app => {
    if (app.status === 'annullato') return;
    const m = getMonthIndex(app.appointment_date);
    if (m >= 0) {
      months[m].pmuRevenue += Number(app.payment) || 0;
      months[m].pendingBalance += Number(app.balance) || 0;
      months[m].pmuCount += 1;
    }
  });

  // Weddings & Events (exclude cancelled; count actual received cash trial_deposit in wedding month)
  weddings.forEach(w => {
    if (w.status === 'annullato') return;
    const m = getMonthIndex(w.wedding_date);
    if (m >= 0) {
      months[m].weddingRevenue += Number(w.trial_deposit) || 0;
      months[m].pendingBalance += Number(w.wedding_balance) || 0;
      months[m].weddingCount += 1;
    }
  });

  // Gift Vouchers (counted in PMU revenue at purchase date)
  vouchers.forEach(v => {
    const m = getMonthIndex(v.purchase_date);
    if (m >= 0) {
      months[m].pmuRevenue += getVoucherInitialAmount(v);
    }
  });

  // Expenses
  expenses.forEach(e => {
    const m = getMonthIndex(e.date);
    if (m >= 0) {
      months[m].expensesTotal += Number(e.amount) || 0;
    }
  });

  let totalPmu = 0;
  let totalWedding = 0;
  let totalExpenses = 0;
  let totalPendingBalance = 0;

  months.forEach(m => {
    m.totalRevenue = m.pmuRevenue + m.weddingRevenue;
    m.netProfit = m.totalRevenue - m.expensesTotal;
    totalPmu += m.pmuRevenue;
    totalWedding += m.weddingRevenue;
    totalExpenses += m.expensesTotal;
    totalPendingBalance += m.pendingBalance;
  });

  const totalRevenue = totalPmu + totalWedding;
  const netProfit = totalRevenue - totalExpenses;
  const currentYearStr = String(now.getFullYear());
  const isCurrentYear = selectedYear === currentYearStr;
  const elapsedMonths = isCurrentYear ? now.getMonth() + 1 : 12;
  const monthlyAverage = totalRevenue / Math.max(1, elapsedMonths);

  return {
    months,
    annual: {
      totalRevenue,
      pmuRevenue: totalPmu,
      weddingRevenue: totalWedding,
      totalExpenses,
      netProfit,
      totalPendingBalance,
      elapsedMonths,
      monthlyAverage,
      isCurrentYear,
    },
  };
}

export function computeClientTotalSpent(
  appointments: Appointment[],
  weddings: WeddingService[],
  purchasedVouchers: GiftVoucher[]
): number {
  let total = 0;
  purchasedVouchers.forEach(v => {
    total += getVoucherInitialAmount(v);
  });
  appointments.forEach(p => {
    if (p.status === 'annullato') return;
    total += Number(p.payment) || 0;
  });
  weddings.forEach(w => {
    if (w.status === 'annullato') return;
    total += Number(w.trial_deposit) || 0;
  });
  return total;
}

export type VoucherUsageRef = { voucherId?: string; amount?: number } | null;

export function reconcileVoucherUsage(
  vouchers: GiftVoucher[],
  prevUsage: VoucherUsageRef,
  nextUsage: VoucherUsageRef,
  autoRecipient?: { id?: string; name?: string },
  todayIso?: string
): { updatedVouchers: GiftVoucher[]; changedVouchers: GiftVoucher[] } {
  const prevId = prevUsage?.voucherId || '';
  const prevAmt = Math.max(0, Number(prevUsage?.amount) || 0);
  const nextId = nextUsage?.voucherId || '';
  const nextAmt = Math.max(0, Number(nextUsage?.amount) || 0);

  const cloned = vouchers.map(v => ({ ...v }));
  const changedIds = new Set<string>();
  const dateStamp = todayIso || new Date().toISOString().slice(0, 10);

  const sameVoucherAndAmount =
    Boolean(prevId) &&
    prevId === nextId &&
    Math.abs(prevAmt - nextAmt) < 0.0001;

  if (sameVoucherAndAmount) {
    const target = cloned.find(v => v.id === nextId);
    if (target && !target.recipient_name && autoRecipient?.name) {
      target.recipient_name = autoRecipient.name;
      target.recipient_id = autoRecipient.id;
      changedIds.add(target.id);
    }
    return {
      updatedVouchers: cloned,
      changedVouchers: cloned.filter(v => changedIds.has(v.id)),
    };
  }

  // Step A: Restore previous deduction
  if (prevId && prevAmt > 0) {
    const prevVoucher = cloned.find(v => v.id === prevId);
    if (prevVoucher) {
      const initAmount = getVoucherInitialAmount(prevVoucher);
      const currentRem = getVoucherRemainingAmount(prevVoucher);
      const restoredRem = Math.min(initAmount, currentRem + prevAmt);
      prevVoucher.initial_amount = initAmount;
      prevVoucher.amount = initAmount;
      prevVoucher.remaining_amount = restoredRem;
      prevVoucher.is_used = restoredRem <= 0;
      if (restoredRem > 0) {
        prevVoucher.used_date = null;
      }
      changedIds.add(prevVoucher.id);
    }
  }

  // Step B: Deduct new usage
  if (nextId && nextAmt > 0) {
    const nextVoucher = cloned.find(v => v.id === nextId);
    if (nextVoucher) {
      const initAmount = getVoucherInitialAmount(nextVoucher);
      const currentRem = getVoucherRemainingAmount(nextVoucher);
      const newRem = Math.max(0, currentRem - nextAmt);
      nextVoucher.initial_amount = initAmount;
      nextVoucher.amount = initAmount;
      nextVoucher.remaining_amount = newRem;
      nextVoucher.is_used = newRem <= 0;
      if (newRem <= 0) {
        nextVoucher.used_date = dateStamp;
      } else {
        nextVoucher.used_date = null;
      }
      if (!nextVoucher.recipient_name && autoRecipient?.name) {
        nextVoucher.recipient_name = autoRecipient.name;
        nextVoucher.recipient_id = autoRecipient.id;
      }
      changedIds.add(nextVoucher.id);
    }
  } else if (nextId && autoRecipient?.name) {
    const nextVoucher = cloned.find(v => v.id === nextId);
    if (nextVoucher && !nextVoucher.recipient_name) {
      nextVoucher.recipient_name = autoRecipient.name;
      nextVoucher.recipient_id = autoRecipient.id;
      changedIds.add(nextVoucher.id);
    }
  }

  return {
    updatedVouchers: cloned,
    changedVouchers: cloned.filter(v => changedIds.has(v.id)),
  };
}

export function normalizeWhatsAppPhone(phone: string): string {
  let digits = (phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if ((digits.length === 9 || digits.length === 10) && (digits.startsWith('3') || digits.startsWith('0')) && !digits.startsWith('39')) {
    digits = `39${digits}`;
  }
  return digits;
}
