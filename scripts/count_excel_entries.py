import openpyxl

wb = openpyxl.load_workbook("Obiettivo Range Rover.xlsx", data_only=True)

# 1. App BEAUTY CENT
ws_bc = wb["App BEAUTY CENT"]
bc_rows = []
for r in range(2, ws_bc.max_row + 1):
    date_val = ws_bc.cell(row=r, column=1).value
    client_val = ws_bc.cell(row=r, column=2).value
    treat_val = ws_bc.cell(row=r, column=3).value
    if date_val or client_val or treat_val:
        bc_rows.append((date_val, client_val, treat_val, ws_bc.cell(row=r, column=4).value))

print(f"App BEAUTY CENT: {len(bc_rows)} non-empty rows")

# 2. App THE TOUCH
ws_tt = wb["App THE TOUCH"]
tt_rows = []
for r in range(2, ws_tt.max_row + 1):
    date_val = ws_tt.cell(row=r, column=1).value
    client_val = ws_tt.cell(row=r, column=2).value
    treat_val = ws_tt.cell(row=r, column=3).value
    if date_val or client_val or treat_val:
        tt_rows.append((date_val, client_val, treat_val, ws_tt.cell(row=r, column=4).value))

print(f"App THE TOUCH: {len(tt_rows)} non-empty rows")

# 3. MAKEUP
ws_mu = wb["MAKEUP"]
mu_rows = []
for r in range(2, ws_mu.max_row + 1):
    date_val = ws_mu.cell(row=r, column=1).value
    client_val = ws_mu.cell(row=r, column=2).value
    if date_val or client_val:
        mu_rows.append((date_val, client_val, ws_mu.cell(row=r, column=7).value))

print(f"MAKEUP: {len(mu_rows)} non-empty rows")

