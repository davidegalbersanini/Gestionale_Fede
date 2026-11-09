import openpyxl

wb = openpyxl.load_workbook("Obiettivo Range Rover.xlsx", data_only=True)
for sheetname in wb.sheetnames:
    ws = wb[sheetname]
    print(f"=== Sheet: {sheetname} ({ws.max_row} rows, {ws.max_column} cols) ===")
    headers = [str(cell.value) for cell in ws[1][:15]]
    print("  Header row 1:", headers)
    if ws.max_row > 1:
        headers2 = [str(cell.value) for cell in ws[2][:15]]
        print("  Row 2:", headers2)
    # Check sample rows
    print()

