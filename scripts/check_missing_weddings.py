import openpyxl
import json

wb = openpyxl.load_workbook("Obiettivo Range Rover.xlsx", data_only=True)
ws_mu = wb["MAKEUP"]

with open("src/data/initialData.json", encoding="utf-8") as f:
    d = json.load(f)

json_weddings = d["weddings"]
json_wedding_names = set(w["bride_name"].strip().lower() for w in json_weddings)
json_wedding_dates = set(w["wedding_date"][:10] for w in json_weddings)

excel_mu = []
for r in range(2, ws_mu.max_row + 1):
    d_val = ws_mu.cell(row=r, column=1).value
    c_name = ws_mu.cell(row=r, column=2).value
    if d_val and c_name and str(c_name).strip():
        date_str = str(d_val)[:10]
        excel_mu.append((r, str(c_name).strip(), date_str))

print(f"Total excel valid makeup: {len(excel_mu)}")
missing = []
for r, name, date_str in excel_mu:
    if name.lower() not in json_wedding_names:
        missing.append((r, name, date_str))

print(f"Missing from JSON weddings: {len(missing)}")
for m in missing:
    print(" ", m)

