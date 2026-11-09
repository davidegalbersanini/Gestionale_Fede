import openpyxl
import json

wb = openpyxl.load_workbook("Obiettivo Range Rover.xlsx", data_only=True)
ws = wb["MAKEUP"]

with open("src/data/initialData.json", encoding="utf-8") as f:
    d = json.load(f)

json_weddings = d["weddings"]
json_names = [w["bride_name"].strip().lower() for w in json_weddings]

for r in range(2, 103):
    name_val = str(ws.cell(row=r, column=2).value or "").strip().lower()
    if name_val not in json_names:
        print(f"Row {r} not in JSON: {ws.cell(row=r, column=1).value} - {ws.cell(row=r, column=2).value}")

