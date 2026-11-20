import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

function loadTsModule(relPath, extraMocks = {}) {
  const fullPath = path.resolve(relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });

  const mod = { exports: {} };
  const customRequire = id => {
    if (extraMocks[id]) return extraMocks[id];
    return require(id);
  };

  const fn = new vm.Script(
    `(function(exports, require, module, __filename, __dirname) {\n${compiled.outputText}\n})`,
    { filename: fullPath }
  );
  fn.runInThisContext()(mod.exports, customRequire, mod, fullPath, path.dirname(fullPath));
  return mod.exports;
}

const finance = loadTsModule('src/lib/finance.ts');
const googleAuth = loadTsModule('src/lib/googleAuth.ts', {
  '@supabase/supabase-js': { createClient: () => ({}) },
});

console.log('1. Testing computeMonthlyFinancials on synthetic data...');
{
  const apps = [
    {
      id: 'a1',
      client_name: 'Ana',
      location_id: 'l1',
      treatment: 'Micro',
      appointment_date: '2026-03-10T10:00:00',
      payment: 200,
      balance: 50,
      status: 'completato',
    },
    {
      id: 'a2',
      client_name: 'Bea',
      location_id: 'l1',
      treatment: 'Labbra',
      appointment_date: '2026-03-15T11:00:00',
      payment: 300,
      balance: 0,
      status: 'annullato', // Must be excluded!
    },
  ];
  const weddings = [
    // Wedding WITHOUT trial_date but paid in full
    {
      id: 'w1',
      bride_name: 'Carla',
      wedding_date: '2026-05-20T09:00:00',
      trial_date: null,
      people_count: 1,
      trial_deposit: 250,
      wedding_balance: 0,
      total_price: 250,
      status: 'completato',
    },
    // Future wedding with partial deposit & pending balance
    {
      id: 'w2',
      bride_name: 'Daria',
      wedding_date: '2026-09-10T09:00:00',
      trial_date: '2026-07-01T15:00:00',
      people_count: 2,
      trial_deposit: 100,
      wedding_balance: 300,
      total_price: 400,
      status: 'programmato',
    },
    // Cancelled wedding must be excluded
    {
      id: 'w3',
      bride_name: 'Elena',
      wedding_date: '2026-05-25T09:00:00',
      trial_date: null,
      people_count: 1,
      trial_deposit: 500,
      wedding_balance: 0,
      total_price: 500,
      status: 'annullato',
    },
  ];
  const vouchers = [
    {
      id: 'v1',
      buyer_name: 'Franca',
      initial_amount: 150,
      remaining_amount: 150,
      amount: 150,
      purchase_date: '2026-04-02',
      is_used: false,
    },
  ];
  const expenses = [
    { id: 'e1', date: '2026-03-05', category: 'Materiale', item: 'Aghi', amount: 80 },
  ];

  const { months, annual } = finance.computeMonthlyFinancials(
    '2026',
    apps,
    weddings,
    expenses,
    vouchers,
    new Date('2026-06-15T12:00:00Z')
  );

  assert.equal(months[2].pmuRevenue, 200, 'March PMU must exclude cancelled appointment');
  assert.equal(months[2].pmuCount, 1);
  assert.equal(months[2].expensesTotal, 80);
  assert.equal(months[2].netProfit, 120);
  assert.equal(months[3].pmuRevenue, 150, 'April voucher counted under PMU');
  assert.equal(months[4].weddingRevenue, 250, 'May wedding without trial_date counted properly');
  assert.equal(months[4].weddingCount, 1, 'May cancelled wedding excluded');
  assert.equal(months[6].weddingRevenue, 0, 'Deposit attributed to wedding_date month, not trial_date');
  assert.equal(months[8].weddingRevenue, 100, 'Only actual deposit counted as revenue');
  assert.equal(months[8].pendingBalance, 300, 'Pending balance tracked separately');

  assert.equal(annual.pmuRevenue, 350);
  assert.equal(annual.weddingRevenue, 350);
  assert.equal(annual.totalRevenue, 700);
  assert.equal(annual.totalExpenses, 80);
  assert.equal(annual.netProfit, 620);
  assert.equal(annual.totalPendingBalance, 350);
  assert.equal(annual.elapsedMonths, 6);
}

console.log('2. Testing computeMonthlyFinancials against initialData.json & excelBuilder parity...');
{
  const initialData = JSON.parse(fs.readFileSync('src/data/initialData.json', 'utf8'));
  const years = new Set();
  initialData.appointments.forEach(a => a.appointment_date && years.add(a.appointment_date.slice(0, 4)));
  initialData.weddings.forEach(w => w.wedding_date && years.add(w.wedding_date.slice(0, 4)));
  initialData.expenses.forEach(e => e.date && years.add(e.date.slice(0, 4)));
  (initialData.gift_vouchers || []).forEach(v => v.purchase_date && years.add(v.purchase_date.slice(0, 4)));

  let totalWeddingRevenueAllYears = 0;
  for (const yr of years) {
    const { annual } = finance.computeMonthlyFinancials(
      yr,
      initialData.appointments,
      initialData.weddings,
      initialData.expenses,
      initialData.gift_vouchers || [],
      new Date('2026-11-19T12:00:00Z')
    );

    const expectedWedCash = initialData.weddings
      .filter(w => w.status !== 'annullato' && w.wedding_date.startsWith(yr))
      .reduce((s, w) => s + (Number(w.trial_deposit) || 0), 0);
    const expectedPmuCash =
      initialData.appointments
        .filter(a => a.status !== 'annullato' && a.appointment_date.startsWith(yr))
        .reduce((s, a) => s + (Number(a.payment) || 0), 0) +
      (initialData.gift_vouchers || [])
        .filter(v => v.purchase_date.startsWith(yr))
        .reduce((s, v) => s + (Number(v.initial_amount ?? v.amount) || 0), 0);
    const expectedExpenses = initialData.expenses
      .filter(e => e.date.startsWith(yr))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    assert.equal(annual.weddingRevenue, expectedWedCash, `Wedding revenue mismatch in ${yr}`);
    assert.equal(annual.pmuRevenue, expectedPmuCash, `PMU revenue mismatch in ${yr}`);
    assert.equal(annual.totalExpenses, expectedExpenses, `Expenses mismatch in ${yr}`);
    totalWeddingRevenueAllYears += annual.weddingRevenue;
  }

  const noTrialWithDepSum = initialData.weddings
    .filter(w => w.status !== 'annullato' && !w.trial_date && Number(w.trial_deposit) > 0)
    .reduce((s, w) => s + Number(w.trial_deposit), 0);
  assert.equal(noTrialWithDepSum, 3724, 'Expected 3724 EUR from events without trial_date');
  assert.ok(totalWeddingRevenueAllYears >= noTrialWithDepSum);
}

console.log('3. Testing reconcileVoucherUsage across full lifecycle...');
{
  const baseVouchers = [
    {
      id: 'v1',
      buyer_name: 'Maria',
      initial_amount: 200,
      remaining_amount: 200,
      amount: 200,
      purchase_date: '2026-01-10',
      is_used: false,
      used_date: null,
    },
    {
      id: 'v2',
      buyer_name: 'Lucia',
      initial_amount: 100,
      remaining_amount: 100,
      amount: 100,
      purchase_date: '2026-02-10',
      is_used: false,
      used_date: null,
    },
  ];

  // Create appointment using 120 from v1
  let res = finance.reconcileVoucherUsage(
    baseVouchers,
    null,
    { voucherId: 'v1', amount: 120 },
    { id: 'c1', name: 'Giulia Verdi' },
    '2026-11-19'
  );
  assert.equal(res.changedVouchers.length, 1);
  assert.equal(res.changedVouchers[0].remaining_amount, 80);
  assert.equal(res.changedVouchers[0].is_used, false);
  assert.equal(res.changedVouchers[0].recipient_name, 'Giulia Verdi');

  // No-op edit (same voucher & same amount) -> must NOT deduct again
  res = finance.reconcileVoucherUsage(
    res.updatedVouchers,
    { voucherId: 'v1', amount: 120 },
    { voucherId: 'v1', amount: 120 },
    { id: 'c1', name: 'Giulia Verdi' },
    '2026-11-19'
  );
  assert.equal(res.changedVouchers.length, 0, 'No-op edit must not touch voucher');
  assert.equal(res.updatedVouchers.find(v => v.id === 'v1').remaining_amount, 80);

  // Increase deduction from 120 -> 200 (fully deplete v1)
  res = finance.reconcileVoucherUsage(
    res.updatedVouchers,
    { voucherId: 'v1', amount: 120 },
    { voucherId: 'v1', amount: 200 },
    { id: 'c1', name: 'Giulia Verdi' },
    '2026-11-19'
  );
  assert.equal(res.updatedVouchers.find(v => v.id === 'v1').remaining_amount, 0);
  assert.equal(res.updatedVouchers.find(v => v.id === 'v1').is_used, true);
  assert.equal(res.updatedVouchers.find(v => v.id === 'v1').used_date, '2026-11-19');

  // Decrease deduction from 200 -> 150
  res = finance.reconcileVoucherUsage(
    res.updatedVouchers,
    { voucherId: 'v1', amount: 200 },
    { voucherId: 'v1', amount: 150 },
    { id: 'c1', name: 'Giulia Verdi' },
    '2026-11-19'
  );
  assert.equal(res.updatedVouchers.find(v => v.id === 'v1').remaining_amount, 50);
  assert.equal(res.updatedVouchers.find(v => v.id === 'v1').is_used, false);
  assert.equal(res.updatedVouchers.find(v => v.id === 'v1').used_date, null);

  // Switch voucher from v1 (150) to v2 (80)
  res = finance.reconcileVoucherUsage(
    res.updatedVouchers,
    { voucherId: 'v1', amount: 150 },
    { voucherId: 'v2', amount: 80 },
    { id: 'c1', name: 'Giulia Verdi' },
    '2026-11-19'
  );
  assert.equal(res.changedVouchers.length, 2);
  assert.equal(res.updatedVouchers.find(v => v.id === 'v1').remaining_amount, 200);
  assert.equal(res.updatedVouchers.find(v => v.id === 'v2').remaining_amount, 20);

  // Uncheck / Delete appointment -> restore v2 completely (and test upper clamp)
  res = finance.reconcileVoucherUsage(
    res.updatedVouchers,
    { voucherId: 'v2', amount: 500 }, // oversized restore must clamp to 100
    null,
    undefined,
    '2026-11-19'
  );
  assert.equal(res.updatedVouchers.find(v => v.id === 'v2').remaining_amount, 100);
}

console.log('4. Testing normalizeWhatsAppPhone...');
{
  assert.equal(finance.normalizeWhatsAppPhone('340 123 4567'), '393401234567');
  assert.equal(finance.normalizeWhatsAppPhone('+39 340-1234567'), '393401234567');
  assert.equal(finance.normalizeWhatsAppPhone('0039 340 1234567'), '393401234567');
  assert.equal(finance.normalizeWhatsAppPhone('02 12345678'), '390212345678');
  assert.equal(finance.normalizeWhatsAppPhone('+41 79 123 45 67'), '41791234567');
}

console.log('5. Testing formatRomeRfc3339 (CET +01:00 and CEST +02:00)...');
{
  assert.equal(
    googleAuth.formatRomeRfc3339('2026-07-15T10:30:00'),
    '2026-07-15T10:30:00+02:00',
    'Summer time must be +02:00'
  );
  assert.equal(
    googleAuth.formatRomeRfc3339('2026-07-15T10:30:00', 90),
    '2026-07-15T12:00:00+02:00',
    'Adding 90 minutes in CEST'
  );
  assert.equal(
    googleAuth.formatRomeRfc3339('2026-01-15T10:30:00'),
    '2026-01-15T10:30:00+01:00',
    'Winter time must be +01:00'
  );
  assert.equal(
    googleAuth.formatRomeRfc3339('2026-12-20T23:30:00', 60),
    '2026-12-21T00:30:00+01:00',
    'Midnight rollover in CET'
  );
}

console.log('ALL VERIFICATION CHECKS PASSED!');
