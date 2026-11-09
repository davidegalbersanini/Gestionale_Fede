import json
import urllib.request

url = ""
key = ""
with open(".env.local", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line.startswith("NEXT_PUBLIC_SUPABASE_URL="):
            url = line.split("=", 1)[1].strip().strip("\"'")
        if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
            key = line.split("=", 1)[1].strip().strip("\"'")

def fetch_table(table_name):
    req = urllib.request.Request(
        f"{url}/rest/v1/{table_name}?select=*&limit=5000",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

sb_clients = fetch_table("clients")
sb_apps = fetch_table("appointments")
sb_weddings = fetch_table("wedding_services")

print(f"Supabase counts: {len(sb_clients)} clients, {len(sb_apps)} appointments, {len(sb_weddings)} weddings")

app_c_ids = set(a.get("client_id") for a in sb_apps if a.get("client_id"))
app_c_names = set((a.get("client_name") or "").strip().lower() for a in sb_apps)
wed_c_ids = set(w.get("client_id") for w in sb_weddings if w.get("client_id"))
wed_c_names = set((w.get("bride_name") or "").strip().lower() for w in sb_weddings)

unlinked = []
linked = []
for c in sb_clients:
    cid = c.get("id")
    cname = (c.get("full_name") or "").strip().lower()
    has_id = cid in app_c_ids or cid in wed_c_ids
    has_name = cname in app_c_names or cname in wed_c_names
    if not has_id and not has_name:
        unlinked.append(c)
    else:
        linked.append(c)

print(f"Linked: {len(linked)}, Unlinked: {len(unlinked)} out of {len(sb_clients)}")
if unlinked:
    print(f"Total unlinked: {len(unlinked)}")
    print("Sample 10 unlinked:")
    for u in unlinked[:10]:
        print(" ", u.get("id"), u.get("full_name"), u.get("first_name"), u.get("last_name"))
