import { MasterSheetStatus, MasterSheetSyncResult } from '@/types';

export async function getMasterSheetStatus(): Promise<MasterSheetStatus> {
  try {
    const res = await fetch('/api/sheets/sync', { cache: 'no-store' });
    if (!res.ok) {
      return { googleConnected: false };
    }
    return (await res.json()) as MasterSheetStatus;
  } catch {
    return { googleConnected: false };
  }
}

export async function triggerMasterSheetSync(options?: {
  source?: 'app' | 'manual';
  force?: boolean;
  createIfMissing?: boolean;
}): Promise<MasterSheetSyncResult> {
  try {
    const res = await fetch('/api/sheets/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: options?.source || 'manual',
        force: Boolean(options?.force),
        createIfMissing: Boolean(options?.createIfMissing),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as MasterSheetSyncResult;
    return {
      ok: Boolean(data.ok),
      status: data.status || (res.ok ? 'synced' : 'error'),
      spreadsheetId: data.spreadsheetId,
      spreadsheetUrl: data.spreadsheetUrl,
      dataChanged: data.dataChanged,
      summary: data.summary,
      warning: data.warning,
      error: data.error,
      sheetsApiDisabled: data.sheetsApiDisabled,
      scopeMissing: data.scopeMissing,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 'error',
      error: err?.message || 'Errore di rete durante la sincronizzazione con Fogli Google.',
    };
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleBackgroundSheetPush(
  onComplete?: (result: MasterSheetSyncResult) => void,
  delayMs: number = 2500
): void {
  if (typeof window === 'undefined') return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  if (pushTimer) {
    clearTimeout(pushTimer);
  }
  pushTimer = setTimeout(async () => {
    pushTimer = null;
    const res = await triggerMasterSheetSync({ source: 'app', force: false, createIfMissing: false });
    if (onComplete) {
      onComplete(res);
    }
  }, delayMs);
}
