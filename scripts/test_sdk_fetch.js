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

async function test() {
  const { data, count, error } = await sb.from('appointments').select('*', { count: 'exact' });
  console.log(`supabase-js fetched: ${data.length} appointments! Total count in db: ${count}`);
}

test();

