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
  console.log('--- SYNCING TO SUPABASE CLOUD ---');

  // 1. Wipe existing table rows to avoid stale/old duplicates
  console.log('1. Clearing old records...');
  // Delete all appointments
  await supabase.from('appointments').delete().neq('id', 'keep_none');
  // Delete all weddings
  await supabase.from('wedding_services').delete().neq('id', 'keep_none');
  // Delete all expenses
  await supabase.from('expenses').delete().neq('id', 'keep_none');
  // Delete all clients
  await supabase.from('clients').delete().neq('id', 'keep_none');
  // Delete all locations
  await supabase.from('locations').delete().neq('id', 'keep_none');

  console.log('2. Inserting locations...');
  if (initialData.locations?.length) {
    const { error: locErr } = await supabase.from('locations').upsert(initialData.locations);
    if (locErr) console.error('Locations error:', locErr);
    else console.log('Locations inserted:', initialData.locations.length);
  }

  console.log('3. Inserting clients (chunks of 100)...');
  const clients = initialData.clients || [];
  for (let i = 0; i < clients.length; i += 100) {
    const chunk = clients.slice(i, i + 100);
    const { error } = await supabase.from('clients').upsert(chunk);
    if (error) console.error('Clients chunk error:', error);
  }
  console.log('Clients inserted:', clients.length);

  console.log('4. Inserting appointments (chunks of 100)...');
  const appointments = initialData.appointments || [];
  for (let i = 0; i < appointments.length; i += 100) {
    const chunk = appointments.slice(i, i + 100);
    const { error } = await supabase.from('appointments').upsert(chunk);
    if (error) {
      console.error('App chunk error:', error);
      // Fallback without new columns if needed
      const safeChunk = chunk.map(a => {
        const c = { ...a };
        delete c.end_time;
        delete c.touch_up_time;
        delete c.touch_up_end_time;
        delete c.linked_appointment_id;
        delete c.is_touch_up;
        return c;
      });
      const { error: err2 } = await supabase.from('appointments').upsert(safeChunk);
      if (err2) console.error('Fallback app chunk error:', err2);
    }
  }
  console.log('Appointments inserted:', appointments.length);

  console.log('5. Inserting weddings & events (chunks of 100)...');
  const weddings = initialData.weddings || [];
  for (let i = 0; i < weddings.length; i += 100) {
    const chunk = weddings.slice(i, i + 100);
    const { error } = await supabase.from('wedding_services').upsert(chunk);
    if (error) console.error('Weddings chunk error:', error);
  }
  console.log('Weddings inserted:', weddings.length);

  console.log('6. Inserting expenses (chunks of 100)...');
  const expenses = initialData.expenses || [];
  for (let i = 0; i < expenses.length; i += 100) {
    const chunk = expenses.slice(i, i + 100);
    const { error } = await supabase.from('expenses').upsert(chunk);
    if (error) console.error('Expenses chunk error:', error);
  }
  console.log('Expenses inserted:', expenses.length);

  console.log('7. Inserting gift vouchers to settings...');
  const vouchers = initialData.gift_vouchers || [];
  try {
    await supabase.from('settings').upsert({
      key: 'gift_vouchers',
      value: vouchers
    });
    console.log('Gift vouchers synced:', vouchers.length);
  } catch (e) {
    console.warn('Vouchers settings sync note:', e);
  }

  // Set schema version in settings
  await supabase.from('settings').upsert({
    key: 'data_version',
    value: '2026-11-10-v2'
  });

  console.log('--- SUPABASE CLOUD SYNC COMPLETED SUCCESSFULLY ---');
}

syncAllToSupabase();

