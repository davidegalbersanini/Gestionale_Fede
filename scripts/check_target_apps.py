import json
with open("src/data/initialData.json", encoding="utf-8") as f:
    d = json.load(f)

apps = d["appointments"]
print(f"Total appointments in initialData.json: {len(apps)}")
target_ids = ["client-494", "client-495", "client-434", "client-435", "client-436", "client-437"]
for a in apps:
    if a.get("client_id") in target_ids:
        print(f"Found in initialData.json: {a['client_id']} -> {a['client_name']} ({a['appointment_date']})")
