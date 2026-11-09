import urllib.request
import json
import openpyxl

url = ""
key = ""
with open(".env.local", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line.startswith("NEXT_PUBLIC_SUPABASE_URL="):
            url = line.split("=", 1)[1].strip().strip("\"'")
        if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
            key = line.split("=", 1)[1].strip().strip("\"'")

# Fetch all appointments with pagination
all_apps = []
offset = 0
while True:
    req = urllib.request.Request(
        f"{url}/rest/v1/appointments?select=id,client_id,client_name,treatment,appointment_date&offset={offset}&limit=1000",
        headers={"apikey": key, "Authorization": f"Bearer {key}"}
    )
    with urllib.request.urlopen(req) as resp:
        batch = json.loads(resp.read().decode())
        all_apps.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000

print(f"Total appointments in Supabase (with pagination): {len(all_apps)}")

# Fetch all clients
all_clients = []
offset = 0
while True:
    req = urllib.request.Request(
        f"{url}/rest/v1/clients?select=id,full_name,first_name,last_name&offset={offset}&limit=1000",
        headers={"apikey": key, "Authorization": f"Bearer {key}"}
    )
    with urllib.request.urlopen(req) as resp:
        batch = json.loads(resp.read().decode())
        all_clients.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000

print(f"Total clients in Supabase: {len(all_clients)}")

# Fetch all weddings
all_weddings = []
req = urllib.request.Request(
    f"{url}/rest/v1/wedding_services?select=id,client_id,bride_name&limit=1000",
    headers={"apikey": key, "Authorization": f"Bearer {key}"}
)
with urllib.request.urlopen(req) as resp:
    all_weddings = json.loads(resp.read().decode())

print(f"Total weddings in Supabase: {len(all_weddings)}")

# Check matching between clients and appointments
# In ClientsView:
# clientPmus = appointments.filter(a => a.client_id === selectedClient.id || a.client_name.trim().toLowerCase() === cName)
# clientWeddings = weddings.filter(w => w.client_id === selectedClient.id || w.bride_name.trim().toLowerCase() === cName)

app_client_ids = set(a.get("client_id") for a in all_apps if a.get("client_id"))
app_client_names = set((a.get("client_name") or "").strip().lower() for a in all_apps)
wed_client_ids = set(w.get("client_id") for w in all_weddings if w.get("client_id"))
wed_client_names = set((w.get("bride_name") or "").strip().lower() for w in all_weddings)

matched_clients = []
unmatched_clients = []

for c in all_clients:
    cid = c.get("id")
    cname = (c.get("full_name") or "").strip().lower()
    
    matches_app = (cid in app_client_ids) or (cname in app_client_names)
    matches_wed = (cid in wed_client_ids) or (cname in wed_client_names)
    
    if matches_app or matches_wed:
        matched_clients.append(c)
    else:
        unmatched_clients.append(c)

print(f"\nRESULTS:")
print(f"Clients WITH appointments (matched by id or name): {len(matched_clients)}")
print(f"Clients with NO appointments (unmatched): {len(unmatched_clients)}")

print(f"\nSample of unmatched clients (first 25):")
for u in unmatched_clients[:25]:
    print(" ", u)

