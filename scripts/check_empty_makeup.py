import openpyxl

wb = openpyxl.load_workbook("Obiettivo Range Rover.xlsx", data_only=True)
ws = wb["MAKEUP"]

count = 0
for r in range(2, 103):
    date_val = ws.cell(row=r, column=1).value
    name_val = ws.cell(row=r, column=2).value
    if not date_val and not name_val:
        print(f"Empty row at: {r}")
    else:
        count += 1

print(f"Valid rows between 2 and 102: {count}")

