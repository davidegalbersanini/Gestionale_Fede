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

app = {
    "id": "app-buono-makeup-1",
    "client_id": "client-572",
    "client_name": "Fabio Facco",
    "location_id": "loc-thetouch",
    "treatment": "Buono Regalo Makeup",
    "appointment_date": "2023-12-25T10:00:00",
    "payment": 180.0,
    "balance": 0.0,
    "status": "completato"
}

req = urllib.request.Request(
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
    with urllib.request.urlopen(req) as resp:
        print("Success:", resp.status)
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code, e.read().decode())

