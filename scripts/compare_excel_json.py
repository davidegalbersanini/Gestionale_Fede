import openpyxl
import json

wb = openpyxl.load_workbook("Obiettivo Range Rover.xlsx", data_only=True)

with open("src/data/initialData.json", encoding="utf-8") as f:
    d = json.load(f)

json_apps = d["appointments"]
print(f"Appointments in initialData.json: {len(json_apps)}")

# Check Beauty Center rows
ws_bc = wb["App BEAUTY CENT"]
bc_valid = 0
for r in range(2, ws_bc.max_row + 1):
    c_name = ws_bc.cell(row=r, column=2).value
    d_val = ws_bc.cell(row=r, column=1).value
    if c_name and str(c_name).strip() and d_val:
        bc_valid += 1

print(f"Valid Beauty Cent rows: {bc_valid}")

# Check The Touch rows
ws_tt = wb["App THE TOUCH"]
tt_valid = 0
for r in range(2, ws_tt.max_row + 1):
    c_name = ws_tt.cell(row=r, column=2).value
    d_val = ws_tt.cell(row=r, column=1).value
    if c_name and str(c_name).strip() and d_val:
        tt_valid += 1

print(f"Valid The Touch rows: {tt_valid}")
print(f"Total valid in Excel: {bc_valid + tt_valid}")

# Check Makeup
ws_mu = wb["MAKEUP"]
mu_valid = 0
for r in range(2, ws_mu.max_row + 1):
    c_name = ws_mu.cell(row=r, column=2).value
    d_val = ws_mu.cell(row=r, column=1).value
    if c_name and str(c_name).strip() and d_val:
        mu_valid += 1

print(f"Valid MAKEUP rows: {mu_valid}")
print(f"Weddings in initialData.json: {len(d['weddings'])}")

# Check Spese
ws_sp = wb["Spese"]
sp_valid = 0
for r in range(2, ws_sp.max_row + 1):
    d_val = ws_sp.cell(row=r, column=1).value
    art = ws_sp.cell(row=r, column=3).value
    cost = ws_sp.cell(row=r, column=5).value
    if d_val and (art or cost):
        sp_valid += 1

print(f"Valid Spese rows: {sp_valid}")
print(f"Expenses in initialData.json: {len(d['expenses'])}")

