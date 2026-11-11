// Palette pastello armonica e professionale per sedi di lavoro (max ~8 sedi)
// Ogni colore è morbido, leggibile sia su tema dark che light, e ben distinguibile dagli altri
export const PASTEL_LOCATION_PALETTE: readonly string[] = [
  '#F472B6', // Rosa Cipria / Rosa Pastello (Beauty Center)
  '#34D399', // Salvia / Menta Pastello (The Touch)
  '#A78BFA', // Lavanda / Lilla Pastello (AliceinWondernails)
  '#38BDF8', // Celeste / Azzurro Pastello
  '#FBBF24', // Pesca Dorata / Miele Pastello
  '#FB7185', // Corallo / Melone Pastello
  '#2DD4BF', // Tiffany / Acqua Pastello
  '#C084FC', // Malva Pastello
] as const;

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

