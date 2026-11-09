import json

with open("src/data/initialData.json", encoding="utf-8") as f:
    d = json.load(f)

apps = d["appointments"]
weddings = d["weddings"]

target_names = [
    "Fabio Facco",
    "Deborah Aiello",
    "Giulia moliterni",
    "Rebecca Azzarello",
    "Martina Paga",
    "Amica vi",
    "Jessica tridico",
    "Fra magni",
    "luca gagliotto"
]

for name in target_names:
    n_lower = name.lower()
    match_apps = [a for a in apps if a["client_name"].strip().lower() == n_lower]
    match_wed = [w for w in weddings if w["bride_name"].strip().lower() == n_lower]
    print(f"Name: {name} -> PMU: {len(match_apps)}, Weddings: {len(match_wed)}")

