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

# Check if any appointment with treatment 'Buono Regalo' already exists
req = urllib.request.Request(
    f"{url}/rest/v1/appointments?treatment=ilike.*Buono*&select=id,client_name,treatment,payment",
    headers={"apikey": key, "Authorization": f"Bearer {key}"}
)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())
    print("Existing Buono Regalo appointments in Supabase:", len(data))
    for d in data:
        print(" ", d)

