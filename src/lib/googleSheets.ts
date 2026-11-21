import { getOrCreateDriveFolder } from '@/lib/googleAuth';

export const SHEET_TABS = {
  PMU: 'PMU & Trattamenti',
  WEDDINGS: 'Eventi & Cerimonie',
  EXPENSES: 'Spese & Uscite',
  VOUCHERS: 'Buoni Regalo',
  SUMMARY: 'Riepilogo',
  LISTS: '_Liste',
} as const;

export const MASTER_SPREADSHEET_TITLE = 'Gestionale Fede — Database Master';
export const DRIVE_FOLDER_NAME = 'Gestionale Fede';
export const TEMPLATE_EXTRA_ROWS = 50;
export const PROTECTED_PREFIX = 'Gestionale Fede:';

export const TIME_DROPDOWN_OPTIONS: string[] = Array.from({ length: 27 }, (_, idx) => {
  const totalMinutes = 7 * 60 + 30 + idx * 30;
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
});

export const EVENT_TYPE_OPTIONS = [
  'Matrimonio',
  'Cerimonia / Testimone',
  'Festa Privata',
  'Shooting / Editoriale',
  'Altro Evento Makeup',
];

export const EXPENSE_CATEGORY_OPTIONS = [
  'Materiale',
  'Anestetico',
  'Corsi di Formazione',
  'Marketing / Sito',
  'Attrezzatura',
  'Varie',
];

export const STATUS_OPTIONS = ['programmato', 'completato', 'annullato'];
export const CALENDAR_OPTIONS = ['Sì', 'No'];
export const PEOPLE_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export interface GoogleApiErrorInfo {
  status: number;
  message: string;
  sheetsApiDisabled: boolean;
  scopeMissing: boolean;
  notFound: boolean;
}

export function classifyGoogleApiError(status: number, bodyText: string): GoogleApiErrorInfo {
  const lower = (bodyText || '').toLowerCase();
  const sheetsApiDisabled =
    status === 403 &&
    (lower.includes('service_disabled') ||
      lower.includes('sheets.googleapis.com') ||
      lower.includes('google sheets api has not been used') ||
      lower.includes('accessnotconfigured'));
  const scopeMissing =
    !sheetsApiDisabled &&
    status === 403 &&
    (lower.includes('insufficient') || lower.includes('access_token_scope_insufficient'));
  const notFound = status === 404;

  let message = bodyText;
  try {
    const parsed = JSON.parse(bodyText);
    if (parsed?.error?.message) {
      message = parsed.error.message;
    }
  } catch {
    // keep raw text
  }

  return { status, message, sheetsApiDisabled, scopeMissing, notFound };
}

export class GoogleSheetsApiError extends Error {
  info: GoogleApiErrorInfo;
  constructor(info: GoogleApiErrorInfo) {
    super(info.message);
    this.name = 'GoogleSheetsApiError';
    this.info = info;
  }
}

async function googleFetchJson<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new GoogleSheetsApiError(classifyGoogleApiError(res.status, errText));
  }

  return (await res.json()) as T;
}

export interface DriveFileMeta {
  id: string;
  name?: string;
  modifiedTime?: string;
  trashed?: boolean;
  webViewLink?: string;
}

export async function getDriveFileMetadata(
  accessToken: string,
  fileId: string
): Promise<DriveFileMeta | null> {
  try {
    return await googleFetchJson<DriveFileMeta>(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,modifiedTime,trashed,webViewLink`,
      accessToken
    );
  } catch (err) {
    if (err instanceof GoogleSheetsApiError && err.info.notFound) {
      return null;
    }
    throw err;
  }
}

export interface SheetTabMeta {
  sheetId: number;
  title: string;
  index: number;
  hidden: boolean;
  rowCount: number;
  protectedRanges: Array<{ protectedRangeId: number; description?: string }>;
  conditionalFormatCount: number;
}

export interface SpreadsheetStructure {
  spreadsheetId: string;
  spreadsheetUrl: string;
  tabs: Record<string, SheetTabMeta>;
}

const ORDERED_TAB_SPECS: Array<{ title: string; hidden: boolean; colCount: number }> = [
  { title: SHEET_TABS.PMU, hidden: false, colCount: 15 },
  { title: SHEET_TABS.WEDDINGS, hidden: false, colCount: 16 },
  { title: SHEET_TABS.EXPENSES, hidden: false, colCount: 6 },
  { title: SHEET_TABS.VOUCHERS, hidden: false, colCount: 8 },
  { title: SHEET_TABS.SUMMARY, hidden: false, colCount: 7 },
  { title: SHEET_TABS.LISTS, hidden: true, colCount: 5 },
];

function parseStructureResponse(raw: any): SpreadsheetStructure {
  const tabs: Record<string, SheetTabMeta> = {};
  for (const s of raw.sheets || []) {
    const props = s.properties || {};
    tabs[props.title] = {
      sheetId: Number(props.sheetId),
      title: props.title,
      index: Number(props.index ?? 0),
      hidden: Boolean(props.hidden),
      rowCount: Number(props.gridProperties?.rowCount ?? 1000),
      protectedRanges: (s.protectedRanges || []).map((pr: any) => ({
        protectedRangeId: Number(pr.protectedRangeId),
        description: pr.description,
      })),
      conditionalFormatCount: Array.isArray(s.conditionalFormats) ? s.conditionalFormats.length : 0,
    };
  }
  return {
    spreadsheetId: raw.spreadsheetId,
    spreadsheetUrl: raw.spreadsheetUrl,
    tabs,
  };
}

export async function createMasterSpreadsheet(accessToken: string): Promise<{
  spreadsheetId: string;
  spreadsheetUrl: string;
  modifiedTime?: string;
}> {
  const body = {
    properties: {
      title: MASTER_SPREADSHEET_TITLE,
      locale: 'it_IT',
      timeZone: 'Europe/Rome',
    },
    sheets: ORDERED_TAB_SPECS.map((spec, idx) => ({
      properties: {
        title: spec.title,
        index: idx,
        hidden: spec.hidden,
        gridProperties: {
          rowCount: spec.title === SHEET_TABS.SUMMARY ? 120 : 1200,
          columnCount: Math.max(spec.colCount + 2, 18),
          frozenRowCount: spec.hidden ? 1 : spec.title === SHEET_TABS.SUMMARY ? 2 : 2,
        },
        tabColorStyle:
          spec.title === SHEET_TABS.SUMMARY
            ? { rgbColor: { red: 0.14, green: 0.28, blue: 0.22 } }
            : spec.hidden
            ? undefined
            : { rgbColor: { red: 0.91, green: 0.47, blue: 0.66 } },
      },
    })),
  };

  const created = await googleFetchJson<any>(
    'https://sheets.googleapis.com/v4/spreadsheets',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );

  const spreadsheetId: string = created.spreadsheetId;
  let spreadsheetUrl: string =
    created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  let modifiedTime: string | undefined;

  const folderId = await getOrCreateDriveFolder(accessToken, DRIVE_FOLDER_NAME);
  if (folderId) {
    try {
      const currentMeta = await googleFetchJson<{ parents?: string[] }>(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}?fields=parents`,
        accessToken
      );
      const prevParents = (currentMeta.parents || []).join(',');
      const moveParams = new URLSearchParams({
        addParents: folderId,
        fields: 'id,webViewLink,modifiedTime',
      });
      if (prevParents && prevParents !== folderId) {
        moveParams.set('removeParents', prevParents);
      }
      const moved = await googleFetchJson<DriveFileMeta>(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}?${moveParams.toString()}`,
        accessToken,
        { method: 'PATCH', body: JSON.stringify({}) }
      );
      if (moved.webViewLink) spreadsheetUrl = moved.webViewLink;
      if (moved.modifiedTime) modifiedTime = moved.modifiedTime;
    } catch (e) {
      console.warn('Could not move master spreadsheet to folder:', e);
    }
  }

  return { spreadsheetId, spreadsheetUrl, modifiedTime };
}

export async function ensureSpreadsheetStructure(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetStructure> {
  const fields =
    'spreadsheetId,spreadsheetUrl,properties(locale,timeZone),sheets(properties(sheetId,title,index,hidden,gridProperties),protectedRanges(protectedRangeId,description),conditionalFormats)';

  const raw = await googleFetchJson<any>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=${encodeURIComponent(fields)}`,
    accessToken
  );

  let structure = parseStructureResponse(raw);
  const requests: any[] = [];

  // Create missing tabs if any
  for (let i = 0; i < ORDERED_TAB_SPECS.length; i++) {
    const spec = ORDERED_TAB_SPECS[i];
    if (!structure.tabs[spec.title]) {
      requests.push({
        addSheet: {
          properties: {
            title: spec.title,
            index: i,
            hidden: spec.hidden,
            gridProperties: {
              rowCount: spec.title === SHEET_TABS.SUMMARY ? 150 : 1200,
              columnCount: Math.max(spec.colCount + 2, 18),
              frozenRowCount: spec.hidden ? 1 : 2,
            },
          },
        },
      });
    }
  }

  if (requests.length > 0) {
    await googleFetchJson<any>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      accessToken,
      { method: 'POST', body: JSON.stringify({ requests }) }
    );
    const refreshed = await googleFetchJson<any>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=${encodeURIComponent(fields)}`,
      accessToken
    );
    structure = parseStructureResponse(refreshed);
  }

  // Ensure exact tab order (e.g. Riepilogo must be after all other visible tabs) & it_IT locale for ';' formulas
  const orderRequests: any[] = [];
  if (raw.properties?.locale !== 'it_IT' || raw.properties?.timeZone !== 'Europe/Rome') {
    orderRequests.push({
      updateSpreadsheetProperties: {
        properties: {
          locale: 'it_IT',
          timeZone: 'Europe/Rome',
        },
        fields: 'locale,timeZone',
      },
    });
  }
  ORDERED_TAB_SPECS.forEach((spec, targetIdx) => {
    const meta = structure.tabs[spec.title];
    if (!meta) return;
    if (meta.index !== targetIdx || meta.hidden !== spec.hidden) {
      orderRequests.push({
        updateSheetProperties: {
          properties: {
            sheetId: meta.sheetId,
            index: targetIdx,
            hidden: spec.hidden,
          },
          fields: 'index,hidden',
        },
      });
    }
  });

  if (orderRequests.length > 0) {
    await googleFetchJson<any>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      accessToken,
      { method: 'POST', body: JSON.stringify({ requests: orderRequests }) }
    );
    const refreshed = await googleFetchJson<any>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=${encodeURIComponent(fields)}`,
      accessToken
    );
    structure = parseStructureResponse(refreshed);
  }

  return structure;
}

export interface RawBidirectionalTabs {
  pmuRows: any[][];
  weddingRows: any[][];
  expenseRows: any[][];
  voucherRows: any[][];
}

export async function readAllBidirectionalTabs(
  accessToken: string,
  spreadsheetId: string
): Promise<RawBidirectionalTabs> {
  const ranges = [
    `'${SHEET_TABS.PMU}'!A3:O`,
    `'${SHEET_TABS.WEDDINGS}'!A3:P`,
    `'${SHEET_TABS.EXPENSES}'!A3:F`,
    `'${SHEET_TABS.VOUCHERS}'!A3:H`,
  ];

  const params = new URLSearchParams({
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  });
  for (const r of ranges) {
    params.append('ranges', r);
  }

  const res = await googleFetchJson<{ valueRanges?: Array<{ values?: any[][] }> }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${params.toString()}`,
    accessToken
  );

  const vrs = res.valueRanges || [];
  return {
    pmuRows: vrs[0]?.values || [],
    weddingRows: vrs[1]?.values || [],
    expenseRows: vrs[2]?.values || [],
    voucherRows: vrs[3]?.values || [],
  };
}

export interface SummaryYearBlockLayout {
  year: number;
  bannerRowIndex: number;
  headerRowIndex: number;
  firstMonthIndex: number;
  lastMonthIndex: number;
  totalRowIndex: number;
}

export interface SummaryLayoutMeta {
  annualHeaderRowIndex: number;
  annualFirstDataIndex: number;
  annualLastDataIndex: number;
  annualTotalRowIndex: number;
  yearBlocks: SummaryYearBlockLayout[];
  totalRowCount: number;
}

export interface MasterSheetWritePayload {
  pmuDataRows: any[][];
  pmuDraftRows: any[][];
  weddingDataRows: any[][];
  weddingDraftRows: any[][];
  expenseDataRows: any[][];
  expenseDraftRows: any[][];
  voucherDataRows: any[][];
  voucherDraftRows: any[][];
  listsRows: any[][];
  summaryRows: any[][];
  summaryLayout: SummaryLayoutMeta;
}

function makeSolidBg(r: number, g: number, b: number) {
  return { red: r / 255, green: g / 255, blue: b / 255 };
}

function buildDropdownValidation(values: string[], strict: boolean) {
  return {
    condition: {
      type: 'ONE_OF_LIST',
      values: values.map(v => ({ userEnteredValue: v })),
    },
    showCustomUi: true,
    strict,
  };
}

function buildRangeDropdownValidation(rangeFormula: string, strict: boolean) {
  return {
    condition: {
      type: 'ONE_OF_RANGE',
      values: [{ userEnteredValue: rangeFormula }],
    },
    showCustomUi: true,
    strict,
  };
}

function buildDateValidation() {
  return {
    condition: {
      type: 'DATE_IS_VALID',
    },
    showCustomUi: false,
    strict: false,
  };
}

function buildConditionalRule(
  sheetId: number,
  startRow: number,
  endRow: number,
  colIndex: number,
  conditionType: 'TEXT_EQ' | 'NUMBER_GREATER',
  value: string,
  bgRgb: [number, number, number],
  fgRgb: [number, number, number],
  bold: boolean = true
) {
  return {
    addConditionalFormatRule: {
      index: 0,
      rule: {
        ranges: [
          {
            sheetId,
            startRowIndex: startRow,
            endRowIndex: endRow,
            startColumnIndex: colIndex,
            endColumnIndex: colIndex + 1,
          },
        ],
        booleanRule: {
          condition: {
            type: conditionType,
            values: [{ userEnteredValue: value }],
          },
          format: {
            backgroundColor: makeSolidBg(...bgRgb),
            textFormat: {
              foregroundColor: makeSolidBg(...fgRgb),
              bold,
            },
          },
        },
      },
    },
  };
}

export function buildPmuTemplateRow(rowNum: number): any[] {
  return [
    '', // A: Data
    '', // B: Ora Inizio
    `=IF(B${rowNum}="";"";IFERROR(TEXT(IF(ISNUMBER(B${rowNum});B${rowNum};TIMEVALUE(B${rowNum}))+TIME(2;0;0);"hh:mm");""))`, // C: Ora Fine
    '', // D: Cliente
    '', // E: Sede
    '', // F: Trattamento
    `=IF(OR(E${rowNum}="";F${rowNum}="");"";IFERROR(INDEX('${SHEET_TABS.LISTS}'!$E:$E;MATCH(E${rowNum}&"|"&F${rowNum};'${SHEET_TABS.LISTS}'!$D:$D;0));""))`, // G: Totale auto da listino
    '', // H: Incassato
    '', // I: Buono Usato
    `=IF(AND(A${rowNum}="";D${rowNum}="");"";MAX(0;IF(ISNUMBER(G${rowNum});G${rowNum};0)-IF(ISNUMBER(H${rowNum});H${rowNum};0)-IF(ISNUMBER(I${rowNum});I${rowNum};0)))`, // J: Da Saldare
    `=IF(A${rowNum}="";"";IF(A${rowNum}<TODAY();"completato";"programmato"))`, // K: Stato
    '', // L: Data Ritocco
    `=IF(AND(A${rowNum}="";D${rowNum}="");"";"Sì")`, // M: Calendar
    '', // N: Note
    '', // O: ID
  ];
}

export function buildWeddingTemplateRow(rowNum: number): any[] {
  return [
    '', // A: Data Evento
    '', // B: Ora Inizio
    `=IF(B${rowNum}="";"";IFERROR(TEXT(IF(ISNUMBER(B${rowNum});B${rowNum};TIMEVALUE(B${rowNum}))+TIME(3;0;0);"hh:mm");""))`, // C: Ora Fine
    '', // D: Tipologia
    '', // E: Cliente / Sposa
    '', // F: Location / Indirizzo
    `=IF(AND(A${rowNum}="";E${rowNum}="");"";1)`, // G: Persone
    '', // H: Totale
    '', // I: Acconto
    '', // J: Buono Usato
    `=IF(AND(A${rowNum}="";E${rowNum}="");"";MAX(0;IF(ISNUMBER(H${rowNum});H${rowNum};0)-IF(ISNUMBER(I${rowNum});I${rowNum};0)-IF(ISNUMBER(J${rowNum});J${rowNum};0)))`, // K: Da Saldare
    '', // L: Data Prova
    `=IF(A${rowNum}="";"";IF(A${rowNum}<TODAY();"completato";"programmato"))`, // M: Stato
    `=IF(AND(A${rowNum}="";E${rowNum}="");"";"Sì")`, // N: Calendar
    '', // O: Note
    '', // P: ID
  ];
}

export function buildVoucherTemplateRow(rowNum: number): any[] {
  return [
    '', // A: Data Acquisto
    '', // B: Acquirente
    '', // C: Beneficiario
    '', // D: Valore Iniziale
    `=IF(D${rowNum}="";"";D${rowNum})`, // E: Valore Rimanente default = Iniziale
    `=IF(AND(A${rowNum}="";B${rowNum}="");"";IF(IF(ISNUMBER(E${rowNum});E${rowNum};0)<=0;"Esaurito";IF(IF(ISNUMBER(E${rowNum});E${rowNum};0)<IF(ISNUMBER(D${rowNum});D${rowNum};0);"Parzialmente Usato";"Attivo")))`, // F: Stato live
    '', // G: Note
    '', // H: ID
  ];
}

export async function writeAllTabsAndFormat(
  accessToken: string,
  spreadsheetId: string,
  structure: SpreadsheetStructure,
  payload: MasterSheetWritePayload
): Promise<{ modifiedTime?: string; summaryFormulaErrors: number; firstFormulaError?: string }> {
  const pmuHeaders = [
    'Data',
    'Ora Inizio',
    'Ora Fine',
    'Cliente',
    'Sede',
    'Trattamento',
    'Totale (€)',
    'Incassato (€)',
    'Buono Usato (€)',
    'Da Saldare (€)',
    'Stato',
    'Data Ritocco',
    'Calendar',
    'Note',
    'ID',
  ];
  const weddingHeaders = [
    'Data Evento',
    'Ora Inizio',
    'Ora Fine',
    'Tipologia',
    'Cliente / Sposa',
    'Location / Indirizzo',
    'Persone',
    'Totale (€)',
    'Acconto (€)',
    'Buono Usato (€)',
    'Da Saldare (€)',
    'Data Prova',
    'Stato',
    'Calendar',
    'Note',
    'ID',
  ];
  const expenseHeaders = ['Data', 'Categoria', 'Descrizione', 'Importo (€)', 'Note', 'ID'];
  const voucherHeaders = [
    'Data Acquisto',
    'Acquirente',
    'Beneficiario',
    'Valore Iniziale (€)',
    'Valore Rimanente (€)',
    'Stato',
    'Note',
    'ID',
  ];

  // Combine data rows + untouched draft rows + blank formula template rows
  const combineBidirectionalRows = (
    dataRows: any[][],
    draftRows: any[][],
    templateBuilder?: (rowNum: number) => any[]
  ) => {
    const startRow = 3;
    const base = [...dataRows, ...draftRows];
    const templates: any[][] = [];
    if (templateBuilder) {
      for (let i = 0; i < TEMPLATE_EXTRA_ROWS; i++) {
        const rNum = startRow + base.length + i;
        templates.push(templateBuilder(rNum));
      }
    }
    return {
      rows: [...base, ...templates],
      totalEndRow: startRow + base.length + (templateBuilder ? TEMPLATE_EXTRA_ROWS : 50) - 1,
      activeRowCount: base.length + TEMPLATE_EXTRA_ROWS,
    };
  };

  const pmuCombined = combineBidirectionalRows(payload.pmuDataRows, payload.pmuDraftRows, buildPmuTemplateRow);
  const wedCombined = combineBidirectionalRows(
    payload.weddingDataRows,
    payload.weddingDraftRows,
    buildWeddingTemplateRow
  );
  const expCombined = combineBidirectionalRows(payload.expenseDataRows, payload.expenseDraftRows);
  const vouCombined = combineBidirectionalRows(
    payload.voucherDataRows,
    payload.voucherDraftRows,
    buildVoucherTemplateRow
  );

  // 1. Ensure sufficient grid rows for any tab that grew large
  const gridResizeRequests: any[] = [];
  const neededRows: Record<string, number> = {
    [SHEET_TABS.PMU]: Math.max(1200, pmuCombined.rows.length + 100),
    [SHEET_TABS.WEDDINGS]: Math.max(1200, wedCombined.rows.length + 100),
    [SHEET_TABS.EXPENSES]: Math.max(1200, expCombined.rows.length + 100),
    [SHEET_TABS.VOUCHERS]: Math.max(1200, vouCombined.rows.length + 100),
    [SHEET_TABS.SUMMARY]: Math.max(150, payload.summaryRows.length + 30),
    [SHEET_TABS.LISTS]: Math.max(1200, payload.listsRows.length + 100),
  };

  for (const [title, need] of Object.entries(neededRows)) {
    const meta = structure.tabs[title];
    if (meta && meta.rowCount < need) {
      gridResizeRequests.push({
        updateSheetProperties: {
          properties: { sheetId: meta.sheetId, gridProperties: { rowCount: need } },
          fields: 'gridProperties.rowCount',
        },
      });
    }
  }
  if (gridResizeRequests.length > 0) {
    await googleFetchJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      accessToken,
      { method: 'POST', body: JSON.stringify({ requests: gridResizeRequests }) }
    );
  }

  // 2. Clear all tabs cleanly before writing updated rows
  await googleFetchJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        ranges: [
          `'${SHEET_TABS.PMU}'!A1:O`,
          `'${SHEET_TABS.WEDDINGS}'!A1:P`,
          `'${SHEET_TABS.EXPENSES}'!A1:F`,
          `'${SHEET_TABS.VOUCHERS}'!A1:H`,
          `'${SHEET_TABS.SUMMARY}'!A1:G`,
          `'${SHEET_TABS.LISTS}'!A1:E`,
        ],
      }),
    }
  );

  // 3. Batch write values + formulas across all 6 tabs
  const valueUpdates = [
    {
      range: `'${SHEET_TABS.LISTS}'!A1`,
      values: payload.listsRows,
    },
    {
      range: `'${SHEET_TABS.PMU}'!A1`,
      values: [
        [
          'PMU & TRATTAMENTI — Compila dalle righe libere in fondo (Sede/Trattamento autocompilano il Prezzo, Totale-Incassato-Buono calcola Da Saldare)',
        ],
        pmuHeaders,
        ...pmuCombined.rows,
      ],
    },
    {
      range: `'${SHEET_TABS.WEDDINGS}'!A1`,
      values: [
        [
          'EVENTI & CERIMONIE — Aggiungi o modifica liberamente: App e Google Calendar si sincronizzano ogni 5 minuti',
        ],
        weddingHeaders,
        ...wedCombined.rows,
      ],
    },
    {
      range: `'${SHEET_TABS.EXPENSES}'!A1`,
      values: [
        ['SPESE & USCITE — Inserisci spese di studio, materiali e attrezzature con categoria a tendina'],
        expenseHeaders,
        ...expCombined.rows,
      ],
    },
    {
      range: `'${SHEET_TABS.VOUCHERS}'!A1`,
      values: [
        ['BUONI REGALO — Stato e Valore Rimanente si aggiornano automaticamente all’utilizzo sugli appuntamenti'],
        voucherHeaders,
        ...vouCombined.rows,
      ],
    },
    {
      range: `'${SHEET_TABS.SUMMARY}'!A1`,
      values: payload.summaryRows,
    },
  ];

  await googleFetchJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: valueUpdates,
      }),
    }
  );

  // 4. Formatting, Data Validations, Protected Ranges (warningOnly: true), Conditional Formatting
  const batchRequests: any[] = [];

  // Remove old managed protected ranges & conditional format rules cleanly
  for (const tabMeta of Object.values(structure.tabs)) {
    for (const pr of tabMeta.protectedRanges) {
      if (!pr.description || pr.description.startsWith(PROTECTED_PREFIX)) {
        batchRequests.push({ deleteProtectedRange: { protectedRangeId: pr.protectedRangeId } });
      }
    }
    for (let i = tabMeta.conditionalFormatCount - 1; i >= 0; i--) {
      batchRequests.push({
        deleteConditionalFormatRule: { sheetId: tabMeta.sheetId, index: i },
      });
    }
  }

  const styleBidirectionalTab = (params: {
    sheetId: number;
    colCount: number;
    colWidths: number[];
    endRow: number;
    dateCols: number[];
    currencyCols: number[];
    intCols: number[];
    centerCols: number[];
    idCol: number;
  }) => {
    const { sheetId, colCount, colWidths, endRow, dateCols, currencyCols, intCols, centerCols, idCol } = params;

    // Clear old merges on header banner & set frozen row 2
    batchRequests.push({
      unmergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
      },
    });
    batchRequests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
        mergeType: 'MERGE_ALL',
      },
    });

    // Clear previous validations across active grid
    batchRequests.push({
      setDataValidation: {
        range: { sheetId, startRowIndex: 2, endRowIndex: Math.max(endRow, 1200), startColumnIndex: 0, endColumnIndex: colCount },
      },
    });

    // Row 1 Banner styling
    batchRequests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: makeSolidBg(232, 121, 168),
            textFormat: { foregroundColor: makeSolidBg(255, 255, 255), bold: true, fontSize: 10 },
            verticalAlignment: 'MIDDLE',
            horizontalAlignment: 'LEFT',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)',
      },
    });

    // Row 2 Table header styling
    batchRequests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: colCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: makeSolidBg(68, 64, 60),
            textFormat: { foregroundColor: makeSolidBg(255, 255, 255), bold: true, fontSize: 10 },
            verticalAlignment: 'MIDDLE',
            horizontalAlignment: 'CENTER',
            wrapStrategy: 'WRAP',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment,wrapStrategy)',
      },
    });

    // Row heights
    batchRequests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 28 },
        fields: 'pixelSize',
      },
    });
    batchRequests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 },
        properties: { pixelSize: 30 },
        fields: 'pixelSize',
      },
    });

    // Column widths
    colWidths.forEach((px, idx) => {
      batchRequests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: idx, endIndex: idx + 1 },
          properties: { pixelSize: px },
          fields: 'pixelSize',
        },
      });
    });

    // Base body format
    batchRequests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: endRow, startColumnIndex: 0, endColumnIndex: colCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: makeSolidBg(255, 255, 255),
            textFormat: { foregroundColor: makeSolidBg(28, 25, 23), bold: false, fontSize: 10 },
            verticalAlignment: 'MIDDLE',
            horizontalAlignment: 'LEFT',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)',
      },
    });

    // Date format
    for (const c of dateCols) {
      batchRequests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 2, endRowIndex: endRow, startColumnIndex: c, endColumnIndex: c + 1 },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'DATE', pattern: 'dd/mm/yyyy' },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
        },
      });
      batchRequests.push({
        setDataValidation: {
          range: { sheetId, startRowIndex: 2, endRowIndex: endRow, startColumnIndex: c, endColumnIndex: c + 1 },
          rule: buildDateValidation(),
        },
      });
    }

    // Currency format
    for (const c of currencyCols) {
      batchRequests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 2, endRowIndex: endRow, startColumnIndex: c, endColumnIndex: c + 1 },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'CURRENCY', pattern: '#,##0.00 "€"' },
              horizontalAlignment: 'RIGHT',
            },
          },
          fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
        },
      });
    }

    // Integer format
    for (const c of intCols) {
      batchRequests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 2, endRowIndex: endRow, startColumnIndex: c, endColumnIndex: c + 1 },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'NUMBER', pattern: '#,##0' },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
        },
      });
    }

    // Center aligned columns
    for (const c of centerCols) {
      batchRequests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 2, endRowIndex: endRow, startColumnIndex: c, endColumnIndex: c + 1 },
          cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
          fields: 'userEnteredFormat.horizontalAlignment',
        },
      });
    }

    // Subtle styling + warningOnly protection on ID column
    batchRequests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: endRow, startColumnIndex: idCol, endColumnIndex: idCol + 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: makeSolidBg(245, 245, 244),
            textFormat: { foregroundColor: makeSolidBg(120, 113, 108), fontSize: 8 },
            horizontalAlignment: 'LEFT',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    });
    batchRequests.push({
      addProtectedRange: {
        protectedRange: {
          range: { sheetId, startColumnIndex: idCol, endColumnIndex: idCol + 1 },
          description: `${PROTECTED_PREFIX} Colonna ID protetta (conferma prima di eliminare righe)`,
          warningOnly: true,
        },
      },
    });
  };

  // --- PMU Tab ---
  const pmuMeta = structure.tabs[SHEET_TABS.PMU];
  if (pmuMeta) {
    styleBidirectionalTab({
      sheetId: pmuMeta.sheetId,
      colCount: 15,
      colWidths: [110, 90, 90, 185, 145, 195, 105, 105, 105, 105, 120, 110, 88, 220, 155],
      endRow: pmuCombined.totalEndRow,
      dateCols: [0, 11],
      currencyCols: [6, 7, 8, 9],
      intCols: [],
      centerCols: [1, 2, 10, 12],
      idCol: 14,
    });
    const endIdx = pmuCombined.totalEndRow;
    // Dropdowns
    [1, 2].forEach(c => {
      batchRequests.push({
        setDataValidation: {
          range: { sheetId: pmuMeta.sheetId, startRowIndex: 2, endRowIndex: endIdx, startColumnIndex: c, endColumnIndex: c + 1 },
          rule: buildDropdownValidation(TIME_DROPDOWN_OPTIONS, false),
        },
      });
    });
    batchRequests.push({
      setDataValidation: {
        range: { sheetId: pmuMeta.sheetId, startRowIndex: 2, endRowIndex: endIdx, startColumnIndex: 3, endColumnIndex: 4 },
        rule: buildRangeDropdownValidation(`='${SHEET_TABS.LISTS}'!$A$2:$A`, false),
      },
    });
    batchRequests.push({
      setDataValidation: {
        range: { sheetId: pmuMeta.sheetId, startRowIndex: 2, endRowIndex: endIdx, startColumnIndex: 4, endColumnIndex: 5 },
        rule: buildRangeDropdownValidation(`='${SHEET_TABS.LISTS}'!$B$2:$B`, false),
      },
    });
    batchRequests.push({
      setDataValidation: {
        range: { sheetId: pmuMeta.sheetId, startRowIndex: 2, endRowIndex: endIdx, startColumnIndex: 5, endColumnIndex: 6 },
        rule: buildRangeDropdownValidation(`='${SHEET_TABS.LISTS}'!$C$2:$C`, false),
      },
    });
    batchRequests.push({
      setDataValidation: {
        range: { sheetId: pmuMeta.sheetId, startRowIndex: 2, endRowIndex: endIdx, startColumnIndex: 10, endColumnIndex: 11 },
        rule: buildDropdownValidation(STATUS_OPTIONS, true),
      },
    });
    batchRequests.push({
      setDataValidation: {
        range: { sheetId: pmuMeta.sheetId, startRowIndex: 2, endRowIndex: endIdx, startColumnIndex: 12, endColumnIndex: 13 },
        rule: buildDropdownValidation(CALENDAR_OPTIONS, true),
      },
    });
    // Conditional formats
    batchRequests.push(
      buildConditionalRule(pmuMeta.sheetId, 2, endIdx, 10, 'TEXT_EQ', 'completato', [220, 252, 231], [22, 101, 52]),
      buildConditionalRule(pmuMeta.sheetId, 2, endIdx, 10, 'TEXT_EQ', 'programmato', [224, 242, 254], [3, 105, 161]),
      buildConditionalRule(pmuMeta.sheetId, 2, endIdx, 10, 'TEXT_EQ', 'annullato', [241, 245, 249], [100, 116, 139], false),
      buildConditionalRule(pmuMeta.sheetId, 2, endIdx, 9, 'NUMBER_GREATER', '0', [254, 243, 199], [180, 83, 9])
    );
  }

  // --- Weddings Tab ---
  const wedMeta = structure.tabs[SHEET_TABS.WEDDINGS];
  if (wedMeta) {
    styleBidirectionalTab({
      sheetId: wedMeta.sheetId,
      colCount: 16,
      colWidths: [110, 90, 90, 155, 185, 210, 75, 105, 105, 105, 105, 110, 120, 88, 220, 155],
      endRow: wedCombined.totalEndRow,
      dateCols: [0, 11],
      currencyCols: [7, 8, 9, 10],
      intCols: [6],
      centerCols: [1, 2, 12, 13],
      idCol: 15,
    });
    const endIdx = wedCombined.totalEndRow;
    [1, 2].forEach(c => {
      batchRequests.push({
        setDataValidation: {
          range: { sheetId: wedMeta.sheetId, startRowIndex: 2, endRowIndex: endIdx, startColumnIndex: c, endColumnIndex: c + 1 },
          rule: buildDropdownValidation(TIME_DROPDOWN_OPTIONS, false),
        },
      });
    });
    batchRequests.push({
      setDataValidation: {
        range: { sheetId: wedMeta.sheetId, startRowIndex: 2, endRowIndex: endIdx, startColumnIndex: 3, endColumnIndex: 4 },
        rule: buildDropdownValidation(EVENT_TYPE_OPTIONS, false),
      },
    });
    batchRequests.push({
      setDataValidation: {
        range: { sheetId: wedMeta.sheetId, startRowIndex: 2, endRowIndex: endIdx, startColumnIndex: 4, endColumnIndex: 5 },
        rule: buildRangeDropdownValidation(`='${SHEET_TABS.LISTS}'!$A$2:$A`, false),
      },
    });
    batchRequests.push({
      setDataValidation: {
        range: { sheetId: wedMeta.sheetId, startRowIndex: 2, endRowIndex: endIdx, startColumnIndex: 6, endColumnIndex: 7 },
        rule: buildDropdownValidation(PEOPLE_OPTIONS, false),
      },
    });
    batchRequests.push({
      setDataValidation: {
        range: { sheetId: wedMeta.sheetId, startRowIndex: 2, endRowIndex: endIdx, startColumnIndex: 12, endColumnIndex: 13 },
        rule: buildDropdownValidation(STATUS_OPTIONS, true),
      },
    });
    batchRequests.push({
      setDataValidation: {
        range: { sheetId: wedMeta.sheetId, startRowIndex: 2, endRowIndex: endIdx, startColumnIndex: 13, endColumnIndex: 14 },
        rule: buildDropdownValidation(CALENDAR_OPTIONS, true),
      },
    });
    batchRequests.push(
      buildConditionalRule(wedMeta.sheetId, 2, endIdx, 12, 'TEXT_EQ', 'completato', [220, 252, 231], [22, 101, 52]),
      buildConditionalRule(wedMeta.sheetId, 2, endIdx, 12, 'TEXT_EQ', 'programmato', [224, 242, 254], [3, 105, 161]),
      buildConditionalRule(wedMeta.sheetId, 2, endIdx, 12, 'TEXT_EQ', 'annullato', [241, 245, 249], [100, 116, 139], false),
      buildConditionalRule(wedMeta.sheetId, 2, endIdx, 10, 'NUMBER_GREATER', '0', [254, 243, 199], [180, 83, 9])
    );
  }

  // --- Expenses Tab ---
  const expMeta = structure.tabs[SHEET_TABS.EXPENSES];
  if (expMeta) {
    styleBidirectionalTab({
      sheetId: expMeta.sheetId,
      colCount: 6,
      colWidths: [115, 175, 270, 120, 250, 155],
      endRow: expCombined.totalEndRow,
      dateCols: [0],
      currencyCols: [3],
      intCols: [],
      centerCols: [],
      idCol: 5,
    });
    batchRequests.push({
      setDataValidation: {
        range: {
          sheetId: expMeta.sheetId,
          startRowIndex: 2,
          endRowIndex: expCombined.totalEndRow,
          startColumnIndex: 1,
          endColumnIndex: 2,
        },
        rule: buildDropdownValidation(EXPENSE_CATEGORY_OPTIONS, false),
      },
    });
  }

  // --- Vouchers Tab ---
  const vouMeta = structure.tabs[SHEET_TABS.VOUCHERS];
  if (vouMeta) {
    styleBidirectionalTab({
      sheetId: vouMeta.sheetId,
      colCount: 8,
      colWidths: [120, 190, 190, 130, 140, 155, 230, 155],
      endRow: vouCombined.totalEndRow,
      dateCols: [0],
      currencyCols: [3, 4],
      intCols: [],
      centerCols: [5],
      idCol: 7,
    });
    const endIdx = vouCombined.totalEndRow;
    [1, 2].forEach(c => {
      batchRequests.push({
        setDataValidation: {
          range: { sheetId: vouMeta.sheetId, startRowIndex: 2, endRowIndex: endIdx, startColumnIndex: c, endColumnIndex: c + 1 },
          rule: buildRangeDropdownValidation(`='${SHEET_TABS.LISTS}'!$A$2:$A`, false),
        },
      });
    });
    batchRequests.push(
      buildConditionalRule(vouMeta.sheetId, 2, endIdx, 5, 'TEXT_EQ', 'Attivo', [220, 252, 231], [22, 101, 52]),
      buildConditionalRule(vouMeta.sheetId, 2, endIdx, 5, 'TEXT_EQ', 'Parzialmente Usato', [254, 243, 199], [180, 83, 9]),
      buildConditionalRule(vouMeta.sheetId, 2, endIdx, 5, 'TEXT_EQ', 'Esaurito', [241, 245, 249], [100, 116, 139], false)
    );
  }

  // --- Riepilogo Tab (Read-Only, multi-year, last visible tab) ---
  const sumMeta = structure.tabs[SHEET_TABS.SUMMARY];
  if (sumMeta) {
    const sid = sumMeta.sheetId;
    const summaryClearRows = Math.max(150, payload.summaryRows.length + 30);
    const layout = payload.summaryLayout;

    [220, 145, 145, 150, 135, 145, 145].forEach((px, idx) => {
      batchRequests.push({
        updateDimensionProperties: {
          range: { sheetId: sid, dimension: 'COLUMNS', startIndex: idx, endIndex: idx + 1 },
          properties: { pixelSize: px },
          fields: 'pixelSize',
        },
      });
    });

    batchRequests.push({
      unmergeCells: {
        range: { sheetId: sid, startRowIndex: 0, endRowIndex: summaryClearRows, startColumnIndex: 0, endColumnIndex: 7 },
      },
    });
    batchRequests.push({
      mergeCells: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 }, mergeType: 'MERGE_ALL' },
    });
    batchRequests.push({
      mergeCells: { range: { sheetId: sid, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 7 }, mergeType: 'MERGE_ALL' },
    });

    // Row heights (Row 1, Row 2, KPI Header Row 4, KPI Values Row 5)
    [
      [0, 30],
      [1, 24],
      [3, 34],
      [4, 32],
    ].forEach(([rIdx, px]) => {
      batchRequests.push({
        updateDimensionProperties: {
          range: { sheetId: sid, dimension: 'ROWS', startIndex: rIdx, endIndex: rIdx + 1 },
          properties: { pixelSize: px },
          fields: 'pixelSize',
        },
      });
    });

    // Banner Row 1 & Subtitle Row 2
    batchRequests.push({
      repeatCell: {
        range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 },
        cell: {
          userEnteredFormat: {
            backgroundColor: makeSolidBg(35, 71, 55),
            textFormat: { foregroundColor: makeSolidBg(255, 255, 255), bold: true, fontSize: 12 },
            verticalAlignment: 'MIDDLE',
            horizontalAlignment: 'LEFT',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)',
      },
    });
    batchRequests.push({
      repeatCell: {
        range: { sheetId: sid, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 7 },
        cell: {
          userEnteredFormat: {
            backgroundColor: makeSolidBg(235, 242, 238),
            textFormat: { foregroundColor: makeSolidBg(27, 58, 43), italic: true, fontSize: 10 },
            verticalAlignment: 'MIDDLE',
            horizontalAlignment: 'LEFT',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)',
      },
    });

    // Reset body format
    batchRequests.push({
      repeatCell: {
        range: { sheetId: sid, startRowIndex: 2, endRowIndex: summaryClearRows, startColumnIndex: 0, endColumnIndex: 7 },
        cell: {
          userEnteredFormat: {
            backgroundColor: makeSolidBg(255, 255, 255),
            textFormat: { foregroundColor: makeSolidBg(28, 25, 23), bold: false, fontSize: 10 },
            verticalAlignment: 'MIDDLE',
            horizontalAlignment: 'LEFT',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)',
      },
    });

    // Section 1: KPI headers (Row 4) & KPI values (Row 5)
    batchRequests.push({
      repeatCell: {
        range: { sheetId: sid, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 7 },
        cell: {
          userEnteredFormat: {
            backgroundColor: makeSolidBg(52, 98, 77),
            textFormat: { foregroundColor: makeSolidBg(255, 255, 255), bold: true, fontSize: 10 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)',
      },
    });
    batchRequests.push({
      repeatCell: {
        range: { sheetId: sid, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 6 },
        cell: {
          userEnteredFormat: {
            backgroundColor: makeSolidBg(247, 250, 248),
            textFormat: { bold: true, fontSize: 12 },
            numberFormat: { type: 'CURRENCY', pattern: '#,##0.00 "€"' },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,numberFormat,horizontalAlignment)',
      },
    });
    batchRequests.push({
      repeatCell: {
        range: { sheetId: sid, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 6, endColumnIndex: 7 },
        cell: {
          userEnteredFormat: {
            backgroundColor: makeSolidBg(254, 243, 199),
            textFormat: { foregroundColor: makeSolidBg(180, 83, 9), bold: true, fontSize: 12 },
            numberFormat: { type: 'PERCENT', pattern: '0.0%' },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,numberFormat,horizontalAlignment)',
      },
    });

    // Section 2: Annual Comparison Table
    batchRequests.push({
      updateDimensionProperties: {
        range: { sheetId: sid, dimension: 'ROWS', startIndex: layout.annualHeaderRowIndex, endIndex: layout.annualHeaderRowIndex + 1 },
        properties: { pixelSize: 28 },
        fields: 'pixelSize',
      },
    });
    batchRequests.push({
      repeatCell: {
        range: {
          sheetId: sid,
          startRowIndex: layout.annualHeaderRowIndex,
          endRowIndex: layout.annualHeaderRowIndex + 1,
          startColumnIndex: 0,
          endColumnIndex: 7,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: makeSolidBg(68, 64, 60),
            textFormat: { foregroundColor: makeSolidBg(255, 255, 255), bold: true, fontSize: 10 },
            horizontalAlignment: 'RIGHT',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    });
    batchRequests.push({
      repeatCell: {
        range: {
          sheetId: sid,
          startRowIndex: layout.annualHeaderRowIndex,
          endRowIndex: layout.annualHeaderRowIndex + 1,
          startColumnIndex: 0,
          endColumnIndex: 1,
        },
        cell: { userEnteredFormat: { horizontalAlignment: 'LEFT' } },
        fields: 'userEnteredFormat.horizontalAlignment',
      },
    });
    batchRequests.push({
      repeatCell: {
        range: {
          sheetId: sid,
          startRowIndex: layout.annualFirstDataIndex,
          endRowIndex: layout.annualLastDataIndex + 1,
          startColumnIndex: 0,
          endColumnIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'NUMBER', pattern: '0' },
            textFormat: { bold: true },
            horizontalAlignment: 'LEFT',
          },
        },
        fields: 'userEnteredFormat(numberFormat,textFormat,horizontalAlignment)',
      },
    });
    batchRequests.push({
      repeatCell: {
        range: {
          sheetId: sid,
          startRowIndex: layout.annualFirstDataIndex,
          endRowIndex: layout.annualLastDataIndex + 1,
          startColumnIndex: 1,
          endColumnIndex: 7,
        },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'CURRENCY', pattern: '#,##0.00 "€"' },
            horizontalAlignment: 'RIGHT',
          },
        },
        fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
      },
    });
    batchRequests.push({
      repeatCell: {
        range: {
          sheetId: sid,
          startRowIndex: layout.annualTotalRowIndex,
          endRowIndex: layout.annualTotalRowIndex + 1,
          startColumnIndex: 0,
          endColumnIndex: 7,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: makeSolidBg(220, 233, 226),
            textFormat: { foregroundColor: makeSolidBg(27, 58, 43), bold: true, fontSize: 10 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });
    batchRequests.push({
      repeatCell: {
        range: {
          sheetId: sid,
          startRowIndex: layout.annualTotalRowIndex,
          endRowIndex: layout.annualTotalRowIndex + 1,
          startColumnIndex: 1,
          endColumnIndex: 7,
        },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'CURRENCY', pattern: '#,##0.00 "€"' },
            horizontalAlignment: 'RIGHT',
          },
        },
        fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
      },
    });

    // Section 3: Per-Year Monthly Breakdown Blocks
    for (const block of layout.yearBlocks) {
      batchRequests.push({
        mergeCells: {
          range: {
            sheetId: sid,
            startRowIndex: block.bannerRowIndex,
            endRowIndex: block.bannerRowIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: 7,
          },
          mergeType: 'MERGE_ALL',
        },
      });
      batchRequests.push({
        updateDimensionProperties: {
          range: { sheetId: sid, dimension: 'ROWS', startIndex: block.bannerRowIndex, endIndex: block.bannerRowIndex + 1 },
          properties: { pixelSize: 26 },
          fields: 'pixelSize',
        },
      });
      batchRequests.push({
        repeatCell: {
          range: {
            sheetId: sid,
            startRowIndex: block.bannerRowIndex,
            endRowIndex: block.bannerRowIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: 7,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: makeSolidBg(52, 98, 77),
              textFormat: { foregroundColor: makeSolidBg(255, 255, 255), bold: true, fontSize: 10 },
              verticalAlignment: 'MIDDLE',
              horizontalAlignment: 'LEFT',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)',
        },
      });
      batchRequests.push({
        updateDimensionProperties: {
          range: { sheetId: sid, dimension: 'ROWS', startIndex: block.headerRowIndex, endIndex: block.headerRowIndex + 1 },
          properties: { pixelSize: 26 },
          fields: 'pixelSize',
        },
      });
      batchRequests.push({
        repeatCell: {
          range: {
            sheetId: sid,
            startRowIndex: block.headerRowIndex,
            endRowIndex: block.headerRowIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: 7,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: makeSolidBg(68, 64, 60),
              textFormat: { foregroundColor: makeSolidBg(255, 255, 255), bold: true, fontSize: 10 },
              horizontalAlignment: 'RIGHT',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      });
      batchRequests.push({
        repeatCell: {
          range: {
            sheetId: sid,
            startRowIndex: block.headerRowIndex,
            endRowIndex: block.headerRowIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: 1,
          },
          cell: { userEnteredFormat: { horizontalAlignment: 'LEFT' } },
          fields: 'userEnteredFormat.horizontalAlignment',
        },
      });
      batchRequests.push({
        repeatCell: {
          range: {
            sheetId: sid,
            startRowIndex: block.firstMonthIndex,
            endRowIndex: block.lastMonthIndex + 1,
            startColumnIndex: 1,
            endColumnIndex: 7,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'CURRENCY', pattern: '#,##0.00 "€"' },
              horizontalAlignment: 'RIGHT',
            },
          },
          fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
        },
      });
      batchRequests.push({
        repeatCell: {
          range: {
            sheetId: sid,
            startRowIndex: block.totalRowIndex,
            endRowIndex: block.totalRowIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: 7,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: makeSolidBg(220, 233, 226),
              textFormat: { foregroundColor: makeSolidBg(27, 58, 43), bold: true, fontSize: 10 },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      });
      batchRequests.push({
        repeatCell: {
          range: {
            sheetId: sid,
            startRowIndex: block.totalRowIndex,
            endRowIndex: block.totalRowIndex + 1,
            startColumnIndex: 1,
            endColumnIndex: 7,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'CURRENCY', pattern: '#,##0.00 "€"' },
              horizontalAlignment: 'RIGHT',
            },
          },
          fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
        },
      });
    }

    // Protect entire Riepilogo sheet (read-only warningOnly)
    batchRequests.push({
      addProtectedRange: {
        protectedRange: {
          range: { sheetId: sid },
          description: `${PROTECTED_PREFIX} Scheda Riepilogo di sola lettura`,
          warningOnly: true,
        },
      },
    });
  }

  // --- Protect hidden _Liste tab ---
  const listsMeta = structure.tabs[SHEET_TABS.LISTS];
  if (listsMeta) {
    batchRequests.push({
      addProtectedRange: {
        protectedRange: {
          range: { sheetId: listsMeta.sheetId },
          description: `${PROTECTED_PREFIX} Elenchi interni gestiti dall'app`,
          warningOnly: true,
        },
      },
    });
  }

  if (batchRequests.length > 0) {
    await googleFetchJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      accessToken,
      { method: 'POST', body: JSON.stringify({ requests: batchRequests }) }
    );
  }

  // Lightweight formula-error readback on Riepilogo and sample PMU balance cells
  let summaryFormulaErrors = 0;
  let firstFormulaError: string | undefined;
  try {
    const verifyParams = new URLSearchParams({ valueRenderOption: 'FORMATTED_VALUE' });
    verifyParams.append('ranges', `'${SHEET_TABS.SUMMARY}'!A4:G${Math.max(5, payload.summaryRows.length)}`);
    verifyParams.append('ranges', `'${SHEET_TABS.PMU}'!J3:J5`);
    const verifyRes = await googleFetchJson<{ valueRanges?: Array<{ values?: any[][] }> }>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${verifyParams.toString()}`,
      accessToken
    );
    const errRegex = /^#(ERROR!|REF!|NAME\?|VALUE!|DIV\/0!|N\/A|NUM!)/i;
    for (const vr of verifyRes.valueRanges || []) {
      for (const row of vr.values || []) {
        for (const cell of row || []) {
          const text = typeof cell === 'string' ? cell.trim() : '';
          if (errRegex.test(text)) {
            summaryFormulaErrors += 1;
            if (!firstFormulaError) firstFormulaError = text;
          }
        }
      }
    }
  } catch (e) {
    console.warn('Could not read back formula verification:', e);
  }

  const freshMeta = await getDriveFileMetadata(accessToken, spreadsheetId);
  return { modifiedTime: freshMeta?.modifiedTime, summaryFormulaErrors, firstFormulaError };
}
