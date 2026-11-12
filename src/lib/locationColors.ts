// Palette pastello armonica, variegata e ben differenziata per le sedi di lavoro (max ~8 sedi)
// Ogni tonalità copre una famiglia cromatica nettamente diversa (Rosa, Smeraldo, Lavanda, Ambra/Ocra, Cielo, Corallo/Salmone, Menta, Indaco)
// per essere immediatamente riconoscibile a colpo d'occhio senza confondersi.
export const PASTEL_LOCATION_PALETTE: readonly string[] = [
  '#F472B6', // 1. Rosa Cipria Pastello (Beauty Center)
  '#10B981', // 2. Verde Smeraldo / Menta Intensa (The Touch)
  '#8B5CF6', // 3. Viola Lavanda / Orchidea (AliceinWondernails)
  '#F59E0B', // 4. Ambra / Senape Pastello Caldo
  '#0EA5E9', // 5. Celeste Cielo / Fiordaliso Pastello
  '#FB923C', // 6. Albicocca / Arancio Pastello
  '#14B8A6', // 7. Verde Acqua / Ottanio Pastello
  '#6366F1', // 8. Indaco / Blu Notte Pastello
] as const;

// Colori pastello distinti e dedicati al mondo Eventi & Cerimonie
export const PASTEL_EVENT_COLORS = {
  // Giorno dell'Evento / Matrimonio: Pesca Corallo Pastello elegante e romantico
  EVENT_DAY: '#FB7185',
  // Prova Trucco: Miele Dorato / Vaniglia Pastello caldo e distinto
  EVENT_TRIAL: '#FBBF24',
} as const;

/**
 * Trova il primo colore pastello della palette che non sia ancora stato utilizzato
 * tra le sedi esistenti. Se tutti sono utilizzati, riparte dal primo disponibile.
 */
export function getNextPastelLocationColor(existingLocations: Array<{ color?: string }>): string {
  const used = new Set(
    existingLocations
      .map(l => (l.color || '').toUpperCase().trim())
      .filter(Boolean)
  );

  for (const c of PASTEL_LOCATION_PALETTE) {
    if (!used.has(c.toUpperCase())) {
      return c;
    }
  }

  // Fallback se ci sono più di 8 sedi: seleziona il colore con il minor numero di duplicati
  const counts = new Map<string, number>();
  PASTEL_LOCATION_PALETTE.forEach(c => counts.set(c.toUpperCase(), 0));
  existingLocations.forEach(l => {
    const uc = (l.color || '').toUpperCase();
    if (counts.has(uc)) {
      counts.set(uc, (counts.get(uc) || 0) + 1);
    }
  });

  let minColor = PASTEL_LOCATION_PALETTE[0];
  let minCount = Infinity;
  for (const c of PASTEL_LOCATION_PALETTE) {
    const cnt = counts.get(c.toUpperCase()) || 0;
    if (cnt < minCount) {
      minCount = cnt;
      minColor = c;
    }
  }

  return minColor;
}

