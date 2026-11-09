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

# Fetch first 1000 appointments
req = urllib.request.Request(
    f"{url}/rest/v1/appointments?select=id,client_id,client_name,appointment_date&order=appointment_date.desc&limit=1000",
    headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }
)
with urllib.request.urlopen(req) as resp:
    apps_1000 = json.loads(resp.read().decode())

print(f"Oldest appointment in the 1000: {apps_1000[-1]['appointment_date']}")
print(f"Newest appointment in the 1000: {apps_1000[0]['appointment_date']}")

# Fetch the remaining 269 appointments (offset 1000)
req2 = urllib.request.Request(
    f"{url}/rest/v1/appointments?select=id,client_id,client_name,appointment_date&order=appointment_date.desc&offset=1000&limit=1000",
    headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }
)
with urllib.request.urlopen(req2) as resp:
    apps_remaining = json.loads(resp.read().decode())

print(f"Remaining appointments cut off: {len(apps_remaining)}")
if apps_remaining:
    print(f"Range of cut off appointments: from {apps_remaining[-1]['appointment_date']} to {apps_remaining[0]['appointment_date']}")
    cut_off_client_ids = set(a.get("client_id") for a in apps_remaining if a.get("client_id"))
    first_1000_client_ids = set(a.get("client_id") for a in apps_1000 if a.get("client_id"))
    only_in_cutoff = cut_off_client_ids - first_1000_client_ids
    print(f"Number of clients whose ONLY appointments were in the cut off 269: {len(only_in_cutoff)}")
