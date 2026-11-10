const fs = require('fs');
const XLSX = require('xlsx');
const { normalizeClientRecord } = require('./normalize_rules.js');

function excelDateToISO(serial) {
  if (!serial) return null;
  if (typeof serial === 'string') {
    const s = serial.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const n = Number(s);
    if (!isNaN(n)) return excelDateToISO(n);
    return null;
  }
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return date_info.toISOString().slice(0, 10);
}

const wb = XLSX.readFile('c:/Users/User/Desktop/Gestionale_Fede/Obiettivo Range Rover_nuovo.xlsx');

// 1. LOCATIONS
const locations = [
  { id: 'loc-thetouch', name: 'The Touch', color: '#f43f5e', address: 'The Touch Monza', active: true },
  { id: 'loc-beautycent', name: 'Beauty Cent', color: '#ec4899', address: 'Beauty Cent', active: true },
  { id: 'loc-studio', name: 'Studio Privato', color: '#8b5cf6', address: '', active: true }
];

const clientsMap = new Map(); // full_name -> Client

function getOrCreateClient(fullName, firstName, lastName, note) {
  if (!fullName) return undefined;
  const cleanFull = fullName.trim();
  if (!cleanFull) return undefined;

  if (clientsMap.has(cleanFull)) {
    const existing = clientsMap.get(cleanFull);
    if (note && !existing.notes.includes(note)) {
      existing.notes = existing.notes ? existing.notes + ', ' + note : note;
    }
    return existing;
  }

  const id = 'client-' + (clientsMap.size + 1);
  const clientObj = {
    id,
    first_name: firstName || cleanFull.split(' ')[0] || cleanFull,
    last_name: lastName || (cleanFull.split(' ').slice(1).join(' ') || '-'),
    full_name: cleanFull,
    phone: '',
    notes: note || '',
    created_at: new Date().toISOString()
  };
  clientsMap.set(cleanFull, clientObj);
  return clientObj;
}

const appointments = [];
const weddings = [];
const giftVouchers = [];
const expenses = [];

// --- A. Process App BEAUTY CENT ---
const wsBeauty = wb.Sheets['App BEAUTY CENT'];
const rowsBeauty = XLSX.utils.sheet_to_json(wsBeauty);

rowsBeauty.forEach((r, idx) => {
  const dateStr = excelDateToISO(r['c']);
  if (!dateStr) return;

  const rawClient = (r['Cliente'] || '').toString().trim();
  const treatment = (r['Trattamento'] || 'PMU').toString().trim();
  const payment = Number(r['Pagamento']) || 0;
  const balance = Number(r['Saldo']) || 0;
  const total = payment + balance;
  const touchUpDateStr = excelDateToISO(r['Data Ritocco']);

  // Check special rows
  if (rawClient.toLowerCase().includes('gift card sop')) {
    // Generate Gift Voucher
    giftVouchers.push({
      id: 'voucher-beauty-' + (idx + 1),
      buyer_name: 'Acquisto Gift Card',
      recipient_name: 'Da Assegnare',
      initial_amount: payment || 220,
      remaining_amount: payment || 220,
      amount: payment || 220,
      category: 'pmu',
      purchase_date: dateStr,
      is_used: false,
      notes: 'Gift Card Sopracciglia'
    });
    return;
  }

  const norm = normalizeClientRecord(rawClient, 'App BEAUTY CENT');
  if (!norm) return;

  const client = getOrCreateClient(norm.full_name, norm.first_name, norm.last_name, norm.note);

  appointments.push({
    id: 'app-beauty-' + (idx + 1),
    category: 'pmu',
    client_id: client ? client.id : undefined,
    client_name: norm.full_name,
    location_id: 'loc-beautycent',
    treatment: treatment || 'Ritocco',
    appointment_date: dateStr, // Date only without fake time
    total_price: total,
    payment: payment,
    balance: balance,
    touch_up_date: touchUpDateStr || null,
    notes: norm.note || '',
    status: dateStr < new Date().toISOString().slice(0, 10) ? 'completato' : 'programmato'
  });
});

// --- B. Process App THE TOUCH ---
const wsTouch = wb.Sheets['App THE TOUCH'];
const rowsTouch = XLSX.utils.sheet_to_json(wsTouch);

rowsTouch.forEach((r, idx) => {
  const dateSerial = r[' '] || r['c'];
  const dateStr = excelDateToISO(dateSerial);
  if (!dateStr) return;

  const rawClient = (r['Cliente'] || '').toString().trim();
  const treatment = (r['Trattamento'] || 'PMU').toString().trim();
  const payment = Number(r['Pagamento']) || 0;
  const balance = Number(r['Saldo']) || 0;
  const total = payment + balance;

  // Check special non-client
  if (rawClient.toLowerCase().includes('lentiggini consulenze')) {
    appointments.push({
      id: 'app-touch-' + (idx + 1),
      category: 'pmu',
      client_name: 'Consulenze Lentiggini',
      location_id: 'loc-thetouch',
      treatment: 'Consulenze Lentiggini',
      appointment_date: dateStr,
      total_price: total,
      payment: payment,
      balance: balance,
      notes: 'Giornata consulenze lentiggini',
      status: dateStr < new Date().toISOString().slice(0, 10) ? 'completato' : 'programmato'
    });
    return;
  }

  const isBuonoRow = rawClient.toLowerCase().startsWith('buono ') || rawClient.toLowerCase().startsWith('buono regalo ');

  const norm = normalizeClientRecord(rawClient, 'App THE TOUCH');
  if (!norm) return;

  const client = getOrCreateClient(norm.full_name, norm.first_name, norm.last_name, norm.note);

  // If this row was originally an emission / purchase of a voucher:
  if (isBuonoRow && payment > 0) {
    giftVouchers.push({
      id: 'voucher-touch-' + (idx + 1),
      buyer_id: client ? client.id : undefined,
      buyer_name: norm.full_name,
      recipient_id: client ? client.id : undefined,
      recipient_name: norm.full_name,
      initial_amount: payment,
      remaining_amount: 0, // Used at that appointment
      amount: payment,
      category: 'pmu',
      purchase_date: dateStr,
      used_date: dateStr,
      is_used: true,
      notes: 'Buono emesso e utilizzato per ' + (treatment || 'trattamento')
    });
  }

  appointments.push({
    id: 'app-touch-' + (idx + 1),
    category: 'pmu',
    client_id: client ? client.id : undefined,
    client_name: norm.full_name,
    location_id: 'loc-thetouch',
    treatment: treatment || 'Ritocco',
    appointment_date: dateStr, // Date only without fake time
    total_price: total,
    payment: payment,
    balance: balance,
    touch_up_date: null,
    used_gift_voucher: isBuonoRow,
    used_gift_voucher_amount: isBuonoRow ? payment : undefined,
    notes: norm.note || (isBuonoRow ? 'Pagato con Buono Regalo' : ''),
    status: dateStr < new Date().toISOString().slice(0, 10) ? 'completato' : 'programmato'
  });
});

// --- C. Process MAKEUP (Events only) ---
const wsMakeup = wb.Sheets['MAKEUP'];
const rowsMakeup = XLSX.utils.sheet_to_json(wsMakeup);

rowsMakeup.forEach((r, idx) => {
  let rawDate = r['Data Del Matrimonio'];
  let rawName = (r['Nome Sposa'] || '').toString().trim();

  // Handle the bottom block where columns are shifted
  if (/^\d+$/.test(rawName) && rawDate && isNaN(Number(rawDate))) {
    const buyerName = rawDate.toString().trim();
    const amount = Number(rawName) || 0;
    const note = (r['Data della Prova Trucco'] || '').toString().trim();

    const norm = normalizeClientRecord(buyerName, 'MAKEUP');
    const client = norm ? getOrCreateClient(norm.full_name, norm.first_name, norm.last_name, norm.note) : undefined;

    giftVouchers.push({
      id: 'voucher-makeup-' + (idx + 1),
      buyer_id: client ? client.id : undefined,
      buyer_name: norm ? norm.full_name : buyerName,
      recipient_id: client ? client.id : undefined,
      recipient_name: norm ? norm.full_name : buyerName,
      initial_amount: amount,
      remaining_amount: 0,
      amount: amount,
      category: 'pmu',
      purchase_date: '2024-12-24', // Christmas vouchers block
      used_date: '2024-12-24',
      is_used: true,
      notes: note || 'Buono Regalo'
    });
    return;
  }

  const dateStr = excelDateToISO(rawDate);
  if (!dateStr) return;

  const trialDateStr = excelDateToISO(r['Data della Prova Trucco']);
  const peopleCount = Number(r['Numero di prs. ']) || 1;
  const deposit = Number(r['Incasso alla prova']) || 0;
  const balance = Number(r['Incasso al Matr.']) || 0;
  const total = Number(r['TOTALE']) || (deposit + balance);

  if (rawName.toLowerCase() === 'buoni regalo') return;

  if (rawName.toLowerCase() === 'gift card') {
    giftVouchers.push({
      id: 'voucher-makeup-' + (idx + 1),
      buyer_name: 'Acquisto Gift Card',
      recipient_name: 'Da Assegnare',
      initial_amount: total || 81,
      remaining_amount: 0,
      amount: total || 81,
      category: 'pmu',
      purchase_date: dateStr,
      used_date: dateStr,
      is_used: true,
      notes: 'Gift Card Make-up'
    });
    return;
  }

  if (rawName.toLowerCase() === 'makeup day') {
    // Event without client
    weddings.push({
      id: 'wedding-' + (idx + 1),
      bride_name: 'Makeup Day',
      client_id: undefined,
      event_type: 'Trucco Evento',
      wedding_date: dateStr,
      trial_date: null,
      people_count: peopleCount,
      trial_deposit: deposit,
      wedding_balance: balance,
      total_price: total,
      notes: 'Giornata promozionale Makeup Day',
      status: dateStr < new Date().toISOString().slice(0, 10) ? 'completato' : 'programmato'
    });
    return;
  }

  const norm = normalizeClientRecord(rawName, 'MAKEUP');
  let client = undefined;
  let clientDisplayName = rawName;

  if (norm) {
    clientDisplayName = norm.full_name;
    client = getOrCreateClient(norm.full_name, norm.first_name, norm.last_name, norm.note);
  }

  // Determine event type
  let eventType = 'Matrimonio';
  const rawLower = rawName.toLowerCase();
  if (rawLower.includes('battesimo')) eventType = 'Cerimonia';
  else if (rawLower.includes('shooting')) eventType = 'Shooting';
  else if (rawLower.includes('corto')) eventType = 'Shooting';
  else if (rawLower.includes('invitata') || rawLower.includes('festa')) eventType = 'Trucco Evento';

  weddings.push({
    id: 'wedding-' + (idx + 1),
    bride_name: clientDisplayName,
    client_id: client ? client.id : undefined,
    event_type: eventType,
    wedding_date: dateStr,
    trial_date: trialDateStr || null,
    people_count: peopleCount,
    trial_deposit: deposit,
    wedding_balance: balance,
    total_price: total,
    notes: norm?.note || '',
    status: dateStr < new Date().toISOString().slice(0, 10) ? 'completato' : 'programmato'
  });
});

// --- D. Process Spese ---
const wsSpese = wb.Sheets['Spese'];
const rowsSpese = XLSX.utils.sheet_to_json(wsSpese);

rowsSpese.forEach((r, idx) => {
  const dateStr = excelDateToISO(r['Data']);
  if (!dateStr) return;

  const category = (r['Tipologia'] || 'Varie').toString().trim();
  const item = (r['Articolo'] || category).toString().trim();
  const amount = Number(r['Costo']) || 0;
  if (amount <= 0) return;

  expenses.push({
    id: 'expense-' + (idx + 1),
    date: dateStr,
    category: category,
    item: item,
    amount: amount,
    notes: ''
  });
});

// Clients list sorted alphabetically by Cognome, Nome
const clientsList = Array.from(clientsMap.values()).sort((a, b) => {
  const keyA = (a.last_name !== '-' ? a.last_name + ' ' + a.first_name : a.full_name).toLowerCase();
  const keyB = (b.last_name !== '-' ? b.last_name + ' ' + b.first_name : b.full_name).toLowerCase();
  return keyA.localeCompare(keyB, 'it');
});

console.log('--- RECAP IMPORT ---');
console.log('Locations:', locations.length);
console.log('Clients in Rubrica:', clientsList.length);
console.log('Appointments (PMU):', appointments.length);
console.log('Weddings & Events:', weddings.length);
console.log('Gift Vouchers:', giftVouchers.length);
console.log('Expenses:', expenses.length);

const finalData = {
  locations,
  clients: clientsList,
  appointments,
  weddings,
  gift_vouchers: giftVouchers,
  expenses,
  settings: {
    pin_hash: '1234',
    yearly_target: 35000
  }
};

fs.writeFileSync('src/data/initialData.json', JSON.stringify(finalData, null, 2));
console.log('src/data/initialData.json successfully updated!');

