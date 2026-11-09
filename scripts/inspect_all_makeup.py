import openpyxl

wb = openpyxl.load_workbook("Obiettivo Range Rover.xlsx", data_only=True)
ws = wb["MAKEUP"]

rows_data = []
for r in range(2, ws.max_row + 1):
    vals = [ws.cell(row=r, column=c).value for c in range(1, 8)]
    if any(vals):
        rows_data.append((r, vals))

print(f"Total non-empty rows in MAKEUP: {len(rows_data)}")
for r, vals in rows_data[-15:]:
    print(f"Row {r}: {vals}")

