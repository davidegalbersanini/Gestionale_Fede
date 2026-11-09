import json
with open("src/data/initialData.json", encoding="utf-8") as f:
    d = json.load(f)

clients = d["clients"]
apps = d["appointments"]
weddings = d["weddings"]

# Count appointments per client
app_count = {}
for a in apps:
    cid = a.get("client_id")
    cname = (a.get("client_name") or "").strip().lower()
    if cid:
        app_count[cid] = app_count.get(cid, 0) + 1
    if cname:
        app_count[cname] = app_count.get(cname, 0) + 1

for w in weddings:
    cid = w.get("client_id")
    bname = (w.get("bride_name") or "").strip().lower()
    if cid:
        app_count[cid] = app_count.get(cid, 0) + 1
    if bname:
        app_count[bname] = app_count.get(bname, 0) + 1

with_apps = 0
zero_apps = []

for c in clients:
    cid = c["id"]
    cname = c["full_name"].strip().lower()
    total = app_count.get(cid, 0) or app_count.get(cname, 0)
    if total > 0:
        with_apps += 1
    else:
        zero_apps.append(c)

print(f"Total clients in initialData: {len(clients)}")
print(f"Clients WITH appointments: {with_apps}")
print(f"Clients with ZERO appointments: {len(zero_apps)}")
print("Zero apps list:")
for z in zero_apps:
    print(z)
