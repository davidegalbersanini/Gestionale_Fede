import os
import sys
import json
import urllib.request
import urllib.error

def run_migration(sql_query: str):
    env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env.local')
    secret_key = None
    supabase_url = None

    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('SUPABASE_SERVICE_ROLE_KEY='):
                    secret_key = line.split('=', 1)[1].strip()
                elif line.startswith('NEXT_PUBLIC_SUPABASE_URL='):
                    supabase_url = line.split('=', 1)[1].strip()

    if not secret_key or not supabase_url:
        print('Error: Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL in .env.local')
        sys.exit(1)

    url = f"{supabase_url.rstrip('/')}/rest/v1/rpc/exec_sql"
    headers = {
        'apikey': secret_key,
        'Authorization': f'Bearer {secret_key}',
        'User-Agent': 'SupabaseAdmin/1.0',
        'Content-Type': 'application/json'
    }
    data = json.dumps({'query': sql_query}).encode('utf-8')
    req = urllib.request.Request(url, headers=headers, data=data, method='POST')

    try:
        with urllib.request.urlopen(req) as resp:
            print(f'Migration executed successfully (Status: {resp.status})')
            return True
    except urllib.error.HTTPError as e:
        print(f'Migration failed (HTTP {e.code}): {e.read().decode("utf-8")}')
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python db_migrate.py "SQL QUERY"')
        sys.exit(1)
    run_migration(sys.argv[1])
