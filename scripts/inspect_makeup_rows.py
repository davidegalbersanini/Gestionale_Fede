import openpyxl

wb = openpyxl.load_workbook("Obiettivo Range Rover.xlsx", data_only=True)
ws = wb["MAKEUP"]

for r in range(115, 132):
    row_vals = [ws.cell(row=r, column=c).value for c in range(1, 10)]
    print(f"Row {r}: {row_vals}")

