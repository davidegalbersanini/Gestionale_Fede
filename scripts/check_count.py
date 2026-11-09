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

# Request total count with Range: 0-0 and Prefer: count=exact
req = urllib.request.Request(
    f"{url}/rest/v1/appointments?select=id",
    headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Range-Unit": "items",
        "Range": "0-0",
        "Prefer": "count=exact"
    }
)
with urllib.request.urlopen(req) as resp:
    print("Content-Range:", resp.headers.get("Content-Range"))
