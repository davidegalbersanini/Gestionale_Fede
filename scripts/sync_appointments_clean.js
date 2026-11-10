const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split('\n').forEach(l => {
  if (l.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = l.split('=')[1].trim();
  if (l.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = l.split('=')[1].trim();
});
if (!key) {
  env.split('\n').forEach(l => {
    if (l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = l.split('=')[1].trim();
  });
}

const supabase = createClient(url, key);
const initialData = JSON.parse(fs.readFileSync('src/data/initialData.json', 'utf8'));

async function syncAllToSupabase() {
  console.log('--- SYNCING APPOINTMENTS TO SUPABASE CLOUD ---');

  const allowedCols = [
    'id', 'client_id', 'client_name', 'location_id', 'treatment',
    'appointment_date', 'payment', 'balance', 'touch_up_date',
    'lead_source', 'notes', 'sync_google_calendar', 'google_calendar_event_id',
    'status', 'end_time', 'touch_up_time', 'linked_appointment_id',
    'is_touch_up', 'touch_up_end_time', 'category'
  ];

  const appointments = initialData.appointments || [];
  let inserted = 0;
  for (let i = 0; i < appointments.length; i += 100) {
    const chunk = appointments.slice(i, i + 100).map(app => {
      const clean = {};
      allowedCols.forEach(col => {
        if (app[col] !== undefined) clean[col] = app[col];
      });
      return clean;
    });

    const { error } = await supabase.from('appointments').upsert(chunk);
    if (error) {
      console.error('App chunk error at index ' + i + ':', error);
    } else {
      inserted += chunk.length;
    }
  }

  console.log('Appointments successfully synced to Supabase:', inserted, 'of', appointments.length);
}

syncAllToSupabase();

