const fs = require('fs');
const XLSX = require('xlsx');

function capitalizeWord(w) {
  if (!w) return '';
  if (w.includes("'")) {
    return w.split("'").map(p => capitalizeWord(p)).join("'");
  }
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/**
 * Normalizes client name, separates notes and determines if it is an event / voucher
 */
function normalizeClientRecord(raw, sheetName) {
  if (!raw) return null;
  let str = raw.toString().trim();
  if (!str) return null;

  // Non-client events / placeholders
  const lower = str.toLowerCase();
  if (lower === 'buoni regalo' || lower === 'mini tattoo day') return null;

  if (lower.includes('lentiggini consulenze') || lower.includes('consulenze lentiggini')) {
    return { isSpecial: 'treatment_slot', label: 'Consulenze Lentiggini', note: 'Slot consulenze' };
  }
  if (lower === 'gift card sop' || lower === 'gift card') {
    return { isSpecial: 'anonymous_voucher', label: 'Gift Card Sopracciglia', note: 'Gift card emessa' };
  }
  if (lower === 'makeup day' || lower === 'make-up day') {
    return { isSpecial: 'event_day', label: 'Makeup Day', note: 'Giornata trucco promozionale' };
  }

  let note = '';

  // Extract parentheses
  const parenMatch = str.match(/\(([^)]+)\)/);
  if (parenMatch) {
    note = parenMatch[1].trim();
    str = str.replace(/\([^)]+\)/, '').trim();
  }

  // Remove Buono prefixes
  if (/^buono\s+regalo\s+/i.test(str)) {
    str = str.replace(/^buono\s+regalo\s+/i, '');
  } else if (/^buono\s+/i.test(str)) {
    str = str.replace(/^buono\s+/i, '');
  }

  // Specific user mappings
  const rawKey = str.toLowerCase().replace(/\s+/g, ' ').trim();

  // Mapping rules based on user comments:
  if (rawKey === 'ritocco barbara' || rawKey === 'buono regalo ritocco barbara') {
    str = 'Barbara';
    note = note ? note + ', Ritocco' : 'Ritocco';
  } else if (rawKey === 'arianna battesimo') {
    str = 'Arianna';
    note = note ? note + ', Evento Battesimo' : 'Evento Battesimo';
  } else if (rawKey === 'giada battesimo' || rawKey === 'giada battesimo e mamma') {
    str = 'Giada';
    note = note ? note + ', Evento Battesimo con mamma' : 'Evento Battesimo con mamma';
  } else if (rawKey === 'betta') {
    str = 'Benedetta Cartia';
  } else if (rawKey === 'buzzi' || rawKey === 'buono buzzi') {
    str = 'Chiara Buzzi';
  } else if (rawKey === 'sofi candiani' || rawKey === 'sofia candiani') {
    str = 'Sofia Candiani';
  } else if (rawKey === 'giorgia carcher' || rawKey === 'giorgia cacher' || rawKey === 'giorgia cacher + mamma') {
    str = 'Giorgia Carchen';
    if (rawKey.includes('mamma')) note = note ? note + ', con mamma' : 'Con mamma';
  } else if (rawKey === 'ele cattaneo' || rawKey === 'buono ele cattaneo') {
    str = 'Eleonora Cattaneo';
  } else if (rawKey === 'lorena cliente noe' || rawKey === 'cliente noe') {
    str = 'Lorena';
    note = note ? note + ', Cliente Noemi' : 'Cliente Noemi';
  } else if (rawKey === 'giulia colletta' || rawKey === 'giulia colletta mamma e sorella') {
    str = 'Giulia Coletta';
    if (rawKey.includes('mamma')) note = note ? note + ', mamma e sorella' : 'Mamma e sorella';
  } else if (rawKey === 'martina cugi noe') {
    str = 'Martina';
    note = note ? note + ', Cugina Noemi' : 'Cugina Noemi';
  } else if (rawKey === "francesca d'aiuto" || rawKey === "francesca d’aiuto" || rawKey === "francesca daiuto") {
    str = "Francesca D'Aiuto";
  } else if (rawKey === 'jasmine e camilla' || rawKey === 'gift card jasmine e camilla') {
    str = 'Jasmine';
    note = note ? note + ', Gift card condivisa con Camilla' : 'Gift card condivisa con Camilla';
  } else if (rawKey === 'titti e evelina' || rawKey === 'evelina e titti' || rawKey === 'evelina e titti schiavoni') {
    str = 'Titti Schiavoni';
    note = note ? note + ', con Evelina' : 'Con Evelina';
  } else if (rawKey === 'francesca e federica cozzi') {
    str = 'Francesca Cozzi';
    note = note ? note + ', con Federica Cozzi' : 'Con Federica Cozzi';
  } else if (rawKey === 'leo e lela') {
    str = 'Eleonora Mantovan';
    note = note ? note + ', venuta con Manuela Mantovan' : 'Venuta con Manuela Mantovan';
  } else if (rawKey === 'vale falvo' || rawKey === 'valentina falvo') {
    str = 'Valentina Falvo';
  } else if (rawKey === 'alessia famá' || rawKey === 'alessia famà') {
    str = 'Alessia Famà';
  } else if (rawKey === 'francesa') {
    str = 'Francesca';
  } else if (rawKey === 'manuela franceschini') {
    str = 'Emanuela Franceschini';
  } else if (rawKey === 'gio shooting') {
    str = 'Gio';
    note = note ? note + ', Shooting' : 'Shooting';
  } else if (rawKey === 'lo giudice' || rawKey === 'antonella lo giudice' || rawKey === 'arianna lo giudice') {
    if (rawKey === 'lo giudice') str = 'Lo Giudice';
    else if (rawKey === 'antonella lo giudice') str = 'Antonella Lo Giudice';
    else if (rawKey === 'arianna lo giudice') str = 'Arianna Lo Giudice';
  } else if (rawKey === 'vero') {
    str = 'Veronica';
  } else if (rawKey === 'jasmine invitata' || rawKey === 'invitata jasmine') {
    str = 'Jasmine';
    note = note ? note + ', Invitata matrimonio' : 'Invitata matrimonio';
  } else if (rawKey === 'pamela isgro' || rawKey === 'pamela isgrò') {
    str = 'Pamela Isgrò';
  } else if (rawKey === 'shooting kefali') {
    str = 'Kefali';
    note = note ? note + ', Shooting' : 'Shooting';
  } else if (rawKey === 'leni' || rawKey === 'lenila leka' || rawKey === 'lenilda leka') {
    str = 'Lenilda Leka';
  } else if (rawKey === 'fra magni' || rawKey === 'buono fra magni') {
    str = 'Francesca Magni';
  } else if (rawKey === 'gisella mamma sposo') {
    str = 'Gisella';
    note = note ? note + ', Mamma sposo' : 'Mamma sposo';
  } else if (rawKey === 'fra masocco') {
    str = 'Francesca Masocco';
  } else if (rawKey === 'novi' || rawKey === 'buono regalo novi' || rawKey === 'speriìoni novella' || rawKey === 'novella speroni') {
    str = 'Novella Speroni';
  } else if (rawKey === 'zia pinu' || rawKey === 'pinu zia') {
    str = 'Zia Pinuccia';
  } else if (rawKey === 'alice rizz' || rawKey === 'buono alice rizz') {
    str = 'Alice Rizzoli';
  } else if (rawKey === 'rosella') {
    str = 'Rossella';
  } else if (rawKey === 'monica taccon') {
    str = 'Monica Tacconi';
  } else if (rawKey === 'giorgia testa corto') {
    str = 'Giorgia Testa';
    note = note ? note + ', Evento cortometraggio' : 'Evento cortometraggio';
  } else if (rawKey === 'titti') {
    str = 'Titti Schiavoni';
  } else if (rawKey === 'je tridico' || rawKey === 'buono je tridico') {
    str = 'Jessica Tridico';
  } else if (rawKey === 'vi' || rawKey === 'buono vi' || (rawKey === 'viviana' && sheetName === 'App THE TOUCH')) {
    str = 'Viviana Covalero';
  } else if (rawKey === 'gloria trucco sposa') {
    str = 'Gloria';
    note = note ? note + ', Trucco Sposa' : 'Trucco Sposa';
  } else if (rawKey.endsWith(' sposa')) {
    // "tutti quelli che hanno come cognome sposa in realta hanno solo il nome, togli il cognome e 'sposa' va nelle note"
    const baseName = str.slice(0, -6).trim();
    str = baseName;
    note = note ? note + ', Sposa' : 'Sposa';
  } else if (rawKey.includes(' e ')) {
    // "tutti quelli il cui cognome inizia con la congiunzione 'E' in realta sono clienti che hanno solo il nome e nelle note va messo che sono venuti con qualcuno"
    const parts = str.split(/\s+e\s+/i);
    str = parts[0].trim();
    const companion = parts.slice(1).join(' e ').trim();
    note = note ? note + ', con ' + companion : 'Con ' + companion;
  }

  // Capitalize nicely
  const parts = str.split(/\s+/).filter(Boolean);
  const capitalized = parts.map(capitalizeWord).join(' ');

  return {
    full_name: capitalized,
    first_name: parts.length > 1 ? parts[0] : capitalized,
    last_name: parts.length > 1 ? parts.slice(1).join(' ') : '-',
    note: note ? capitalizeWord(note) : '',
  };
}

module.exports = { normalizeClientRecord };

