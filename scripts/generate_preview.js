const fs = require('fs');
const XLSX = require('xlsx');

function capitalizeWord(w) {
  if (!w) return '';
  if (w.includes("'")) {
    return w.split("'").map(p => capitalizeWord(p)).join("'");
  }
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function cleanAndCapitalizeName(raw) {
  if (!raw) return { name: '', note: '' };
  let str = raw.trim();
  let note = '';

  const parenMatch = str.match(/\(([^)]+)\)/);
  if (parenMatch) {
    note = parenMatch[1].trim();
    str = str.replace(/\([^)]+\)/, '').trim();
  }

  // Handle 'Buono' prefix if present: 'Buono Fabio Facco' -> 'Fabio Facco'
  if (/^buono\s+regalo\s+/i.test(str)) {
    str = str.replace(/^buono\s+regalo\s+/i, '');
  } else if (/^buono\s+/i.test(str)) {
    str = str.replace(/^buono\s+/i, '');
  } else if (/^buoni\s+regalo/i.test(str)) {
    str = str.replace(/^buoni\s+regalo/i, '');
  }

  // Special cases
  if (str.toLowerCase() === 'gloria trucco sposa') str = 'Gloria';
  if (str.toLowerCase() === 'buona lezione make-up alessio') str = 'Alessio';
  if (str.toLowerCase() === 'gift card jasmine e camilla') {
    str = 'Jasmine E Camilla';
    note = 'Gift card condivisa';
  }

  // If compound like 'Noemi +mamma', clean to 'Noemi', add note '+ mamma'
  const plusMamma = str.match(/^(.+?)\s*\+\s*mamma$/i);
  if (plusMamma) {
    str = plusMamma[1].trim();
    note = note ? note + ', + mamma' : '+ mamma';
  }

  const eMamma = str.match(/^(.+?)\s+e\s+mamma$/i);
  if (eMamma) {
    str = eMamma[1].trim();
    note = note ? note + ', con mamma' : 'Con mamma';
  }

  const eAmica = str.match(/^(.+?)\s+e\s+amica$/i);
  if (eAmica) {
    str = eAmica[1].trim();
    note = note ? note + ', con amica' : 'Con amica';
  }

  const parts = str.split(/\s+/).filter(Boolean);
  const capitalized = parts.map(capitalizeWord).join(' ');
  return { name: capitalized, note };
}

const wb = XLSX.readFile('c:/Users/User/Desktop/Gestionale_Fede/Obiettivo Range Rover_nuovo.xlsx');
const clientMap = new Map();

['App BEAUTY CENT', 'App THE TOUCH', 'MAKEUP'].forEach(s => {
  const ws = wb.Sheets[s];
  const rows = XLSX.utils.sheet_to_json(ws);
  rows.forEach((r) => {
    let raw = (r['Cliente'] || r['Nome Sposa'] || '').toString().trim();
    if (!raw) return;
    if (s === 'MAKEUP' && /^\d+$/.test(raw) && r['Data Del Matrimonio']) {
      raw = r['Data Del Matrimonio'].toString().trim();
    }
    if (raw.toLowerCase() === 'buoni regalo' || raw.toLowerCase() === 'mini tattoo day' || raw.toLowerCase() === 'gift card') return;

    const { name, note } = cleanAndCapitalizeName(raw);
    if (!name) return;

    if (!clientMap.has(name)) {
      const parts = name.split(' ');
      const first = parts[0] || name;
      const last = parts.slice(1).join(' ') || '-';
      clientMap.set(name, {
        full_name: name,
        first_name: first,
        last_name: last,
        count: 0,
        sources: new Set(),
        notes: new Set(),
      });
    }
    const c = clientMap.get(name);
    c.count++;
    c.sources.add(s);
    if (note) c.notes.add(note);
  });
});

const sorted = Array.from(clientMap.values()).sort((a, b) => {
  const keyA = (a.last_name !== '-' ? a.last_name + ' ' + a.first_name : a.full_name).toLowerCase();
  const keyB = (b.last_name !== '-' ? b.last_name + ' ' + b.first_name : b.full_name).toLowerCase();
  return keyA.localeCompare(keyB, 'it');
});

console.log('Total extracted unique clients:', sorted.length);

const outputJson = sorted.map(c => ({
  full_name: c.full_name,
  first_name: c.first_name,
  last_name: c.last_name,
  count: c.count,
  sources: Array.from(c.sources),
  note: Array.from(c.notes).join(', ')
}));

fs.writeFileSync('c:/Users/User/Desktop/Gestionale_Fede/preview_clients.json', JSON.stringify(outputJson, null, 2));
console.log('Preview written to preview_clients.json');
