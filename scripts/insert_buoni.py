import urllib.request
import json

url = ""
key = ""
with open(".env.local", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line.startswith("NEXT_PUBLIC_SUPABASE_URL="):
            url = line.split("=", 1)[1].strip().strip("\"'")
        if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
            key = line.split("=", 1)[1].strip().strip("\"'")

# Get all clients
req = urllib.request.Request(
    f"{url}/rest/v1/clients?select=id,full_name&limit=2000",
    headers={"apikey": key, "Authorization": f"Bearer {key}"}
)
with urllib.request.urlopen(req) as resp:
    clients = json.loads(resp.read().decode())

client_map = {c["full_name"].strip().lower(): c["id"] for c in clients}

buoni = [
    ("Fabio Facco", 180.0),
    ("Deborah Aiello", 50.0),
    ("Giulia moliterni", 50.0),
    ("Rebecca Azzarello", 35.0),
    ("Martina Paga", 50.0),
    ("Amica vi", 380.0),
    ("Jessica tridico", 300.0),
    ("Fra magni", 140.0),
    ("luca gagliotto", 40.0)
]

new_apps = []
for idx, (name, amount) in enumerate(buoni):
    cid = client_map.get(name.lower())
    if not cid:
        # fuzzy match
        for k, v in client_map.items():
            if name.lower() in k or k in name.lower():
                cid = v
                break
    app_id = f"app-buono-{idx+1}"
    app = {
        "id": app_id,
        "client_id": cid,
        "client_name": name,
        "location_id": "loc-thetouch",
        "category": "generico",
        "treatment": "Buono Regalo Makeup",
        "appointment_date": "2023-12-25T10:00:00",
        "payment": amount,
        "balance": 0.0,
        "status": "completato",
        "notes": "Buono regalo registrato nel foglio MAKEUP dell'Excel"
    }
    new_apps.append(app)
    print(f"Mapped {name} ({amount}€) -> client_id: {cid}")

# Insert into Supabase
req_insert = urllib.request.Request(
    f"{url}/rest/v1/appointments",
    data=json.dumps(new_apps).encode("utf-8"),
    headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    },
    method="POST"
)
try:
    with urllib.request.urlopen(req_insert) as resp:
        print("Inserted into Supabase successfully! Status:", resp.status)
except Exception as e:
    print("Insert error:", e)

# Also update src/data/initialData.json
with open("src/data/initialData.json", "r", encoding="utf-8") as f:
    init_data = json.load(f)

existing_ids = set(a["id"] for a in init_data["appointments"])
added = 0
for na in new_apps:
    if na["id"] not in existing_ids:
        init_data["appointments"].append(na)
        added += 1

with open("src/data/initialData.json", "w", encoding="utf-8") as f:
    json.dump(init_data, f, indent=2, ensure_ascii=False)

print(f"Added {added} buoni regalo to src/data/initialData.json! Total appointments: {len(init_data['appointments'])}")

