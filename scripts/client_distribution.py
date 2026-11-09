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

histogram = {}
for c in clients:
    cid = c["id"]
    cname = c["full_name"].strip().lower()
    cnt = app_count.get(cid, 0) or app_count.get(cname, 0)
    histogram[cnt] = histogram.get(cnt, 0) + 1

print("Distribution of appointment count per client:")
for cnt in sorted(histogram.keys()):
    print(f"  {cnt} appointments: {histogram[cnt]} clients")
