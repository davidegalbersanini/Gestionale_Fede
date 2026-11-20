import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import {
  getServerSupabase,
  fetchAllServerRows,
  safeServerUpsert,
  safeServerDelete,
} from '@/lib/serverSupabase';
import {
  Location,
  Client,
  Appointment,
  WeddingService,
  Expense,
  GiftVoucher,
  ServicePrice,
  AppSettings,
} from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const supabase = getServerSupabase();

    const [
      locationsRes,
      clientsRes,
      appointmentsRes,
      weddingsRes,
      expensesRes,
      vouchersRes,
      servicePricesRes,
      appSettingsRes,
    ] = await Promise.all([
      fetchAllServerRows<Location>(supabase, 'locations'),
      fetchAllServerRows<Client>(supabase, 'clients', 'created_at', false),
      fetchAllServerRows<Appointment>(supabase, 'appointments', 'appointment_date', false),
      fetchAllServerRows<WeddingService>(supabase, 'wedding_services', 'wedding_date', false),
      fetchAllServerRows<Expense>(supabase, 'expenses', 'date', false),
      fetchAllServerRows<GiftVoucher>(supabase, 'gift_vouchers', 'purchase_date', false),
      fetchAllServerRows<ServicePrice>(supabase, 'service_prices', 'name', true),
      (async (): Promise<Partial<AppSettings> | null> => {
        try {
          const { data, error } = await (supabase.from('settings') as any)
            .select('value')
            .eq('key', 'app_settings')
            .single();
          if (error || !data?.value || typeof data.value !== 'object') return null;
          // Strip pin_hash so it is never sent to the browser
          const { yearly_target, monthly_target, google_calendar_email } = data.value as AppSettings;
          return { yearly_target, monthly_target, google_calendar_email };
        } catch {
          return null;
        }
      })(),
    ]);

    return NextResponse.json({
      locations: { data: locationsRes.rows, ok: locationsRes.ok },
      clients: { data: clientsRes.rows, ok: clientsRes.ok },
      appointments: { data: appointmentsRes.rows, ok: appointmentsRes.ok },
      weddings: { data: weddingsRes.rows, ok: weddingsRes.ok },
      expenses: { data: expensesRes.rows, ok: expensesRes.ok },
      vouchers: { data: vouchersRes.rows, ok: vouchersRes.ok },
      servicePrices: { data: servicePricesRes.rows, ok: servicePricesRes.ok },
      appSettings: appSettingsRes,
    });
  } catch (err: any) {
    console.error('GET /api/data error:', err);
    return NextResponse.json(
      { error: err.message || 'Errore nel caricamento dei dati dal cloud.' },
      { status: 500 }
    );
  }
}

const ENTITY_TABLE_MAP: Record<string, string> = {
  location: 'locations',
  locations: 'locations',
  client: 'clients',
  appointment: 'appointments',
  wedding: 'wedding_services',
  expense: 'expenses',
  voucher: 'gift_vouchers',
  service_price: 'service_prices',
};

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { action, entity, payload, id } = body || {};

    const supabase = getServerSupabase();

    if (entity === 'settings' && action === 'upsert') {
      const { data: existingRow } = await (supabase.from('settings') as any)
        .select('value')
        .eq('key', 'app_settings')
        .single();
      const existing =
        existingRow?.value && typeof existingRow.value === 'object' ? existingRow.value : {};

      const merged = {
        ...existing,
        ...(payload?.yearly_target !== undefined ? { yearly_target: Number(payload.yearly_target) || 35000 } : {}),
        ...(payload?.monthly_target !== undefined ? { monthly_target: Number(payload.monthly_target) } : {}),
        ...(payload?.google_calendar_email !== undefined ? { google_calendar_email: payload.google_calendar_email } : {}),
      };

      const res = await safeServerUpsert(supabase, 'settings', {
        key: 'app_settings',
        value: merged,
      });
      return NextResponse.json(res, { status: res.ok ? 200 : 500 });
    }

    const table = typeof entity === 'string' ? ENTITY_TABLE_MAP[entity] : undefined;
    if (!table) {
      return NextResponse.json({ ok: false, error: 'Entità non valida' }, { status: 400 });
    }

    if (action === 'upsert') {
      if (!payload || typeof payload !== 'object') {
        return NextResponse.json({ ok: false, error: 'Payload mancante' }, { status: 400 });
      }
      const res = await safeServerUpsert(supabase, table, payload);
      return NextResponse.json(res, { status: res.ok ? 200 : 500 });
    }

    if (action === 'delete') {
      if (!id || typeof id !== 'string') {
        return NextResponse.json({ ok: false, error: 'ID mancante' }, { status: 400 });
      }
      const res = await safeServerDelete(supabase, table, id);
      return NextResponse.json(res, { status: res.ok ? 200 : 500 });
    }

    return NextResponse.json({ ok: false, error: 'Azione non valida' }, { status: 400 });
  } catch (err: any) {
    console.error('POST /api/data error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Errore nel salvataggio dei dati sul cloud.' },
      { status: 500 }
    );
  }
}
