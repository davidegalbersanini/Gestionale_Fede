const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let url = '';
let key = '';
const env = fs.readFileSync('.env.local', 'utf-8');
env.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/['"]/g, '');
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim().replace(/['"]/g, '');
});

const sb = createClient(url, key);

async function fetchAllRows(tableName, orderCol) {
  const allRows = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const to = from + pageSize - 1;
    let query = sb.from(tableName).select('*').range(from, to);
    if (orderCol) query = query.order(orderCol, { ascending: false });
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching', tableName, error);
      break;
    }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allRows;
}

async function run() {
  const apps = await fetchAllRows('appointments', 'appointment_date');
  console.log(`Successfully fetched ALL ${apps.length} appointments with pagination!`);
}

run();

