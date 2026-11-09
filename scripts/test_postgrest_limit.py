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

# Try with limit=10000
req = urllib.request.Request(
    f"{url}/rest/v1/appointments?select=id&limit=10000",
    headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }
)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())
    print(f"Requested limit=10000, got: {len(data)} items!")
    print("Content-Range header:", resp.headers.get("Content-Range"))

