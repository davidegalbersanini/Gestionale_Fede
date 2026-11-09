import json

with open("src/data/initialData.json", "r", encoding="utf-8") as f:
    d = json.load(f)

for a in d["appointments"]:
    if a.get("treatment") == "Buono Regalo Makeup":
        a["location_id"] = "loc-the-touch"

with open("src/data/initialData.json", "w", encoding="utf-8") as f:
    json.dump(d, f, indent=2, ensure_ascii=False)

print("Updated location_id in initialData.json for buoni regalo!")

