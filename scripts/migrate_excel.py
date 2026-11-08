import zipfile
import xml.etree.ElementTree as ET
import json
import datetime
import re
import uuid
import os

xlsx_path = r"c:\Users\User\Desktop\Gestionale_Fede\Obiettivo Range Rover.xlsx"

def excel_date_to_iso(serial):
    if serial is None or serial == '':
        return None
    try:
        val = float(serial)
        dt = datetime.datetime(1899, 12, 30) + datetime.timedelta(days=val)
        return dt.strftime('%Y-%m-%d')
    except Exception:
        return None

def parse_col_letter(cell_ref):
    return re.match(r"([A-Z]+)", cell_ref).group(1)

def clean_float(val, default=0.0):
    if val is None or val == '':
        return default
    try:
        if isinstance(val, (int, float)):
            return float(val)
        val_str = str(val).replace('€', '').replace('euro', '').replace(' ', '').replace(',', '.')
        # handle multiple dots e.g. 2.400 -> 2400
        if val_str.count('.') > 1:
            val_str = val_str.replace('.', '', val_str.count('.') - 1)
        return float(val_str)
    except Exception:
        return default

def clean_str(val):
    if val is None:
        return ""
    return str(val).strip()

with zipfile.ZipFile(xlsx_path) as z:
    strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        sst = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in sst.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
            text = ''.join(t.text for t in si.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t') if t.text)
            strings.append(text)

    def get_sheet_rows(xml_path):
        sroot = ET.fromstring(z.read(xml_path))
        rows = sroot.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row')
        parsed_rows = []
        for r in rows:
            row_dict = {}
            for c in r.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                r_ref = c.get('r')
                col = parse_col_letter(r_ref)
                t = c.get('t')
                v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                val = v.text if v is not None else ''
                if t == 's' and val.isdigit():
                    val = strings[int(val)]
                row_dict[col] = val
            if any(row_dict.values()):
                parsed_rows.append(row_dict)
        return parsed_rows

    beauty_rows = get_sheet_rows('xl/worksheets/sheet1.xml')
    touch_rows = get_sheet_rows('xl/worksheets/sheet2.xml')
    spese_rows = get_sheet_rows('xl/worksheets/sheet3.xml')
    makeup_rows = get_sheet_rows('xl/worksheets/sheet4.xml')

# 1. Locations
loc_beauty_id = "loc-beauty-cent"
loc_touch_id = "loc-the-touch"

locations = [
    {"id": loc_beauty_id, "name": "Beauty Cent", "color": "#ec4899", "active": True},
    {"id": loc_touch_id, "name": "The Touch", "color": "#8b5cf6", "active": True}
]

# 2. Extract Clients
clients_dict = {} # key: normalized name -> client obj

def get_or_create_client(raw_name):
    clean_name = clean_str(raw_name)
    if not clean_name:
        return None, None
    key = clean_name.lower()
    if key not in clients_dict:
        c_id = f"client-{len(clients_dict) + 1}"
        clients_dict[key] = {
            "id": c_id,
            "full_name": clean_name,
            "phone": "",
            "email": "",
            "notes": "",
            "created_at": datetime.datetime.now().isoformat()
        }
    return clients_dict[key]["id"], clients_dict[key]["full_name"]

# 3. Appointments
appointments = []

# Process Beauty Cent
for idx, r in enumerate(beauty_rows[1:]): # skip header
    date_iso = excel_date_to_iso(r.get('A'))
    raw_name = clean_str(r.get('B'))
    if not date_iso or not raw_name or raw_name.lower() == 'cliente':
        continue
    c_id, c_name = get_or_create_client(raw_name)
    treatment = clean_str(r.get('C'))
    payment = clean_float(r.get('D'))
    balance = clean_float(r.get('E'))
    touch_up_iso = excel_date_to_iso(r.get('H'))
    
    appointments.append({
        "id": f"app-beauty-{idx+1}",
        "client_id": c_id,
        "client_name": c_name,
        "location_id": loc_beauty_id,
        "treatment": treatment,
        "appointment_date": f"{date_iso}T09:00:00",
        "payment": payment,
        "balance": balance,
        "touch_up_date": touch_up_iso,
        "lead_source": "",
        "notes": "",
        "sync_google_calendar": False,
        "status": "completato" if date_iso < "2026-11-08" else "programmato"
    })

# Process The Touch
for idx, r in enumerate(touch_rows[1:]): # skip header
    date_iso = excel_date_to_iso(r.get('A'))
    raw_name = clean_str(r.get('B'))
    if not date_iso or not raw_name or raw_name.lower() == 'cliente':
        continue
    c_id, c_name = get_or_create_client(raw_name)
    treatment = clean_str(r.get('C'))
    payment = clean_float(r.get('D'))
    balance = clean_float(r.get('E'))
    raw_src = clean_str(r.get('I'))
    lead_source = ""
    notes = ""
    if raw_src == 'T':
        lead_source = "The Touch"
    elif raw_src == 'I':
        lead_source = "Instagram"
    elif raw_src == 'P':
        lead_source = "Privato / Passaparola"
    elif raw_src:
        notes = raw_src

    appointments.append({
        "id": f"app-touch-{idx+1}",
        "client_id": c_id,
        "client_name": c_name,
        "location_id": loc_touch_id,
        "treatment": treatment,
        "appointment_date": f"{date_iso}T10:00:00",
        "payment": payment,
        "balance": balance,
        "touch_up_date": None,
        "lead_source": lead_source,
        "notes": notes,
        "sync_google_calendar": False,
        "status": "completato" if date_iso < "2026-11-08" else "programmato"
    })

# 4. Weddings & Makeup
weddings = []
extra_makeups = []

for idx, r in enumerate(makeup_rows[1:]):
    col_a = clean_str(r.get('A'))
    col_b = clean_str(r.get('B'))
    
    if not col_a or col_a.startswith('SPOSE') or col_a == 'Data Del Matrimonio':
        continue
    
    # check if this is an individual makeup row (like Fabio Facco, Deborah Aiello)
    wedding_date_iso = excel_date_to_iso(col_a)
    if not wedding_date_iso and col_a and clean_float(col_b) > 0:
        c_id, c_name = get_or_create_client(col_a)
        extra_makeups.append({
            "id": f"makeup-extra-{idx+1}",
            "client_id": c_id,
            "client_name": c_name,
            "amount": clean_float(col_b),
            "status": clean_str(r.get('C', 'Pagato'))
        })
        continue

    if not wedding_date_iso:
        continue

    bride_name = col_b
    if not bride_name:
        continue
    c_id, c_name = get_or_create_client(bride_name)

    trial_date_iso = excel_date_to_iso(r.get('C'))
    people_count = int(clean_float(r.get('D'), default=1))
    trial_deposit = clean_float(r.get('E'))
    wedding_balance = clean_float(r.get('F'))
    total_price = clean_float(r.get('G'))
    if total_price == 0:
        total_price = trial_deposit + wedding_balance

    weddings.append({
        "id": f"wedding-{idx+1}",
        "bride_name": c_name,
        "client_id": c_id,
        "wedding_date": f"{wedding_date_iso}T09:00:00",
        "trial_date": f"{trial_date_iso}T15:00:00" if trial_date_iso else None,
        "people_count": people_count,
        "trial_deposit": trial_deposit,
        "wedding_balance": wedding_balance,
        "total_price": total_price,
        "notes": "",
        "sync_google_calendar": False,
        "status": "completato" if wedding_date_iso < "2026-11-08" else "programmato"
    })

# 5. Expenses
expenses = []
for idx, r in enumerate(spese_rows[1:]):
    date_iso = excel_date_to_iso(r.get('A'))
    category = clean_str(r.get('B'))
    item = clean_str(r.get('C'))
    cost = clean_float(r.get('E'))
    
    # check side columns for course balances
    side_info = []
    for side_col, side_val in [('G', r.get('G')), ('I', r.get('I')), ('J', r.get('J')), ('K', r.get('K'))]:
        if clean_str(side_val):
            side_info.append(clean_str(side_val))
    side_notes = " - ".join(side_info)

    if not date_iso and not category and cost == 0:
        if side_notes:
            expenses.append({
                "id": f"expense-{idx+1}",
                "date": "2022-01-01",
                "category": "Corsi di Formazione",
                "item": side_notes,
                "amount": 0.0,
                "notes": side_notes
            })
        continue

    expenses.append({
        "id": f"expense-{idx+1}",
        "date": date_iso or "2022-01-01",
        "category": category or "Materiale",
        "item": item,
        "amount": cost,
        "notes": side_notes
    })

# 6. Settings & Targets
settings = {
    "pin_hash": "1234", # default initial PIN (can be changed in settings)
    "monthly_target": 2700.0, # Obiettivo media 2.700 € dal tuo foglio Excel
    "yearly_target": 35000.0, # Target annuale Obiettivo Range Rover
}

clients_list = list(clients_dict.values())

dataset = {
    "locations": locations,
    "clients": clients_list,
    "appointments": appointments,
    "weddings": weddings,
    "extra_makeups": extra_makeups,
    "expenses": expenses,
    "settings": settings
}

os.makedirs(r"c:\Users\User\Desktop\Gestionale_Fede\src\data", exist_ok=True)
json_path = r"c:\Users\User\Desktop\Gestionale_Fede\src\data\initialData.json"
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(dataset, f, ensure_ascii=False, indent=2)

print("=== MIGRATION SUMMARY ===")
print(f"Locations: {len(locations)}")
print(f"Clients (Rubrica): {len(clients_list)}")
print(f"Appointments (PMU/Tatuaggi): {len(appointments)}")
print(f"Weddings (Spose): {len(weddings)}")
print(f"Extra Makeups: {len(extra_makeups)}")
print(f"Expenses: {len(expenses)}")
print(f"Saved dataset to {json_path}")
