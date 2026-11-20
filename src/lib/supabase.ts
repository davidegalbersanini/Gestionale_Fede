import {
  Location,
  Client,
  Appointment,
  WeddingService,
  Expense,
  AppSettings,
  GiftVoucher,
  ServicePrice,
} from '@/types';

let cloudErrorHandler: ((msg: string) => void) | null = null;
let authExpiredHandler: (() => void) | null = null;

export function setCloudErrorHandler(fn: ((msg: string) => void) | null): void {
  cloudErrorHandler = fn;
}

export function setAuthExpiredHandler(fn: (() => void) | null): void {
  authExpiredHandler = fn;
}

function notifyCloudError(msg: string): void {
  if (cloudErrorHandler) {
    cloudErrorHandler(msg);
  }
}

async function mutateServer(body: {
  action: 'upsert' | 'delete';
  entity: string;
  payload?: any;
  id?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 401) {
      authExpiredHandler?.();
      return { ok: false, error: 'Sessione scaduta. Inserisci nuovamente il PIN.' };
    }

    const data = await res.json().catch(() => ({ ok: false }));
    if (!res.ok || data.ok === false) {
      const msg = data.error || `Errore sincronizzazione cloud (${body.entity}).`;
      notifyCloudError(msg);
      return { ok: false, error: msg };
    }

    return { ok: true };
  } catch {
    notifyCloudError(`Errore di rete nella sincronizzazione cloud (${body.entity}).`);
    return { ok: false, error: 'Errore di rete' };
  }
}

export interface TableSyncResult<T> {
  data: T[];
  ok: boolean;
}

export interface CloudFetchResult {
  locations: TableSyncResult<Location>;
  clients: TableSyncResult<Client>;
  appointments: TableSyncResult<Appointment>;
  weddings: TableSyncResult<WeddingService>;
  expenses: TableSyncResult<Expense>;
  vouchers: TableSyncResult<GiftVoucher>;
  servicePrices: TableSyncResult<ServicePrice>;
  appSettings: Partial<AppSettings> | null;
}

export const CloudSync = {
  async fetchAll(): Promise<CloudFetchResult | null> {
    try {
      const res = await fetch('/api/data', { cache: 'no-store' });
      if (res.status === 401) {
        authExpiredHandler?.();
        return null;
      }
      if (!res.ok) {
        return null;
      }
      return (await res.json()) as CloudFetchResult;
    } catch (err) {
      console.warn('CloudSync fetchAll failed, offline or error:', err);
      return null;
    }
  },

  async upsertLocation(loc: Location) {
    return mutateServer({
      action: 'upsert',
      entity: 'location',
      payload: {
        id: loc.id,
        name: loc.name,
        color: loc.color,
        address: loc.address || '',
        active: loc.active ?? true,
      },
    });
  },

  async deleteLocation(id: string) {
    return mutateServer({ action: 'delete', entity: 'location', id });
  },

  async syncAllLocations(locations: Location[]) {
    const records = locations.map(l => ({
      id: l.id,
      name: l.name,
      color: l.color,
      address: l.address || '',
      active: l.active ?? true,
    }));
    return mutateServer({ action: 'upsert', entity: 'locations', payload: records });
  },

  async upsertClient(client: Client) {
    return mutateServer({ action: 'upsert', entity: 'client', payload: client });
  },

  async deleteClient(id: string) {
    return mutateServer({ action: 'delete', entity: 'client', id });
  },

  async upsertAppointment(app: Appointment) {
    return mutateServer({ action: 'upsert', entity: 'appointment', payload: app });
  },

  async deleteAppointment(id: string) {
    return mutateServer({ action: 'delete', entity: 'appointment', id });
  },

  async upsertWedding(wedding: WeddingService) {
    return mutateServer({ action: 'upsert', entity: 'wedding', payload: wedding });
  },

  async deleteWedding(id: string) {
    return mutateServer({ action: 'delete', entity: 'wedding', id });
  },

  async upsertExpense(expense: Expense) {
    return mutateServer({ action: 'upsert', entity: 'expense', payload: expense });
  },

  async deleteExpense(id: string) {
    return mutateServer({ action: 'delete', entity: 'expense', id });
  },

  async upsertGiftVoucher(voucher: GiftVoucher, _allVouchersFallback?: GiftVoucher[]) {
    return mutateServer({ action: 'upsert', entity: 'voucher', payload: voucher });
  },

  async deleteGiftVoucher(id: string, _allVouchersFallback?: GiftVoucher[]) {
    return mutateServer({ action: 'delete', entity: 'voucher', id });
  },

  async upsertServicePrice(item: ServicePrice, _allFallback?: ServicePrice[]) {
    return mutateServer({ action: 'upsert', entity: 'service_price', payload: item });
  },

  async deleteServicePrice(id: string, _allFallback?: ServicePrice[]) {
    return mutateServer({ action: 'delete', entity: 'service_price', id });
  },

  async upsertAppSettings(settings: AppSettings) {
    return mutateServer({
      action: 'upsert',
      entity: 'settings',
      payload: {
        yearly_target: settings.yearly_target,
        monthly_target: settings.monthly_target,
        google_calendar_email: settings.google_calendar_email,
      },
    });
  },
};
