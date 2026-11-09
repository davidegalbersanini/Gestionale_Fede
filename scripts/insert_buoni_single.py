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

for idx, (name, amount) in enumerate(buoni):
    cid = client_map.get(name.lower())
    app_id = f"app-buono-makeup-{idx+1}"
    app = {
        "id": app_id,
        "client_id": cid,
        "client_name": name,
        "location_id": "loc-the-touch",
        "category": "generico",
        "treatment": "Buono Regalo Makeup",
        "appointment_date": "2023-12-25T10:00:00",
        "payment": amount,
        "balance": 0.0,
        "status": "completato",
        "notes": "Buono regalo registrato nel foglio MAKEUP dell'Excel"
    }

    req_insert = urllib.request.Request(
        f"{url}/rest/v1/appointments",
        data=json.dumps(app).encode("utf-8"),
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req_insert) as resp:
            print(f"Upserted {name} ({amount}€): status {resp.status}")
    except urllib.error.HTTPError as e:
        print(f"Error {name}:", e.code, e.read().decode())
