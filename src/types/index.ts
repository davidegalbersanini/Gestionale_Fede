export type LocationId = string;

export interface Location {
  id: string;
  name: string;
  color: string;
  address?: string; // Google Maps address
  active: boolean;
}

export interface ServicePrice {
  id: string;
  location_id: string;
  name: string;
  price: number;
  created_at?: string;
}

export interface Client {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string; // generated as `${first_name} ${last_name}`
  phone?: string;
  notes?: string;
  created_at?: string;
}

export type AppointmentStatus = 'completato' | 'programmato' | 'annullato';

export type AppointmentCategory = 'pmu' | 'generico';

export interface Appointment {
  id: string;
  category?: AppointmentCategory; // 'pmu' or 'generico'
  client_id?: string;
  client_name: string;
  location_id: string;
  treatment: string;
  appointment_date: string; // ISO datetime
  end_time?: string; // e.g. "12:00"
  total_price?: number; // Costo totale concordato del trattamento
  payment: number; // Denaro ricevuto / acconto incassato
  balance: number; // Importo rimanente da saldare (calcolato)
  touch_up_date?: string | null; // ISO date
  touch_up_time?: string; // e.g. "10:30"
  touch_up_end_time?: string; // e.g. "12:00"
  linked_appointment_id?: string; // ID of linked first session / touch-up
  is_touch_up?: boolean;
  lead_source?: string;
  notes?: string;
  sync_google_calendar?: boolean;
  google_calendar_event_id?: string;
  used_gift_voucher?: boolean;
  used_gift_voucher_id?: string;
  used_gift_voucher_amount?: number;
  status: AppointmentStatus;
}

export interface WeddingService {
  id: string;
  bride_name: string; // client / event contact name
  client_id?: string;
  event_type?: string; // 'Matrimonio', 'Cerimonia', 'Trucco Evento', 'Shooting'
  address?: string; // specific event/client home address
  wedding_date: string; // ISO datetime
  trial_date?: string | null; // ISO datetime
  trial_end_time?: string;
  end_time?: string;
  people_count: number;
  trial_deposit: number;
  wedding_balance: number;
  total_price: number;
  notes?: string;
  sync_google_calendar?: boolean;
  google_calendar_event_id?: string;
  used_gift_voucher?: boolean;
  used_gift_voucher_id?: string;
  used_gift_voucher_amount?: number;
  status: AppointmentStatus;
}

export interface Expense {
  id: string;
  date: string; // ISO date
  category: string;
  item: string;
  amount: number;
  notes?: string;
}

export type GiftVoucherCategory = 'pmu' | 'evento';

export interface GiftVoucher {
  id: string;
  buyer_id?: string;
  buyer_name: string;
  recipient_id?: string;
  recipient_name?: string;
  initial_amount: number; // Valore iniziale
  remaining_amount: number; // Valore residuo/rimanente
  amount: number; // Per compatibilità (uguale a initial_amount)
  category?: GiftVoucherCategory; // Sotto il cofano sempre 'pmu'
  purchase_date: string; // YYYY-MM-DD
  is_used: boolean; // true se remaining_amount <= 0
  used_date?: string | null;
  notes?: string;
  payment_method?: string;
  created_at?: string;
}

export interface AppSettings {
  pin_hash: string;
  yearly_target: number;
  monthly_target?: number;
  supabase_url?: string;
  supabase_anon_key?: string;
  google_calendar_email?: string;
}

export interface UnifiedEvent {
  id: string;
  type: 'pmu' | 'generico' | 'wedding_day' | 'wedding_trial';
  title: string;
  client_name: string;
  date: string; // ISO string
  end_time?: string;
  location_name?: string;
  location_color?: string;
  address?: string; // specific event address or location address
  amount: number;
  balance?: number;
  status: AppointmentStatus;
  rawPmu?: Appointment;
  rawWedding?: WeddingService;
}
