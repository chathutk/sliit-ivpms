import openpyxl, re
from pypdf import PdfReader
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

tracking_path = '/Users/school/Desktop/Industry Visit/Industry Visit - Member Tracking (1).xlsx'
wb = openpyxl.load_workbook(tracking_path)

# --- 1. Parse Zone24x7 PDF ---
reader = PdfReader('/Users/school/Desktop/Industry Visit/ZONE24X7_ PARTICIPANT_LIST_Final.pdf')
text = ''
for p in reader.pages:
    text += p.extract_text() + '\n'

lines = [l.strip() for l in text.split('\n') if l.strip()]
entries, current = [], ''
for l in lines:
    if l.startswith('ZONE24X7'): continue
    m = re.match(r'^([1-4]?[0-9])\s+(.*)', l)
    if m and int(m.group(1)) in range(1, 49):
        if current: entries.append(current)
        current = l
    else:
        current += ' ' + l
if current: entries.append(current)

zone_pdf = []
for e in entries:
    m = re.match(r'^(\d+)\s+(.+?)\s+(\d{9}[vVxX]|\d{12})\s+(Non-?[vV]eg|[vV]eg)$', e, re.IGNORECASE)
    if m:
        num, name, nic, food = m.groups()
        food_norm = 'Veg' if ('non' not in food.lower() and 'veg' in food.lower()) else 'Non-Veg'
        zone_pdf.append({
            'num': int(num),
            'name': name.strip(),
            'nic': nic.strip(),
            'food': food_norm
        })

print(f'Zone PDF participants parsed: {len(zone_pdf)}')
assert len(zone_pdf) == 48, f"Expected 48 Zone participants, got {len(zone_pdf)}"

# --- 2. Load Zone Form Responses ---
wb_zn_resp = openpyxl.load_workbook('/Users/school/Desktop/Industry Visit/Zone24x7 - Industry Visit Form (Responses).xlsx', data_only=True)
ws_resp = wb_zn_resp['Form Responses 1']
zone_resp_by_nic = {}
for r in range(2, ws_resp.max_row+1):
    nic = str(ws_resp.cell(r, 8).value or '').strip()
    if nic.endswith('.0'): nic = nic[:-2]
    if nic:
        mem_val = ws_resp.cell(r, 12).value
        mem_str = str(mem_val).strip() if mem_val is not None else None
        if mem_str and mem_str.endswith('.0'): mem_str = mem_str[:-2]
        
        phone_val = ws_resp.cell(r, 9).value
        phone_str = str(phone_val).strip() if phone_val is not None else None
        if phone_str and phone_str.endswith('.0'): phone_str = phone_str[:-2]
        if phone_str and not phone_str.startswith('0') and len(phone_str) == 9: phone_str = '0' + phone_str
        
        zone_resp_by_nic[nic] = {
            'timestamp': ws_resp.cell(r, 1).value,
            'email': str(ws_resp.cell(r, 2).value or '').strip(),
            'name': str(ws_resp.cell(r, 3).value or '').strip(),
            'gender': ws_resp.cell(r, 5).value,
            'degree': ws_resp.cell(r, 6).value,
            'year': ws_resp.cell(r, 7).value,
            'phone': phone_str,
            'active_ieee': ws_resp.cell(r, 11).value,
            'ieee_no': mem_str,
            'dietary': ws_resp.cell(r, 13).value
        }

# Pre-populate existing info from All Members
ws_all = wb['All Members']
all_members_by_nic = {}
for r in range(2, ws_all.max_row+1):
    nic = str(ws_all.cell(r, 2).value or '').strip()
    if nic:
        all_members_by_nic[nic] = {
            'row': r,
            'name': ws_all.cell(r, 1).value,
            'ieee_no': ws_all.cell(r, 3).value,
            'phone': ws_all.cell(r, 4).value,
            'email': ws_all.cell(r, 5).value,
        }

# Enrich Zone PDF participants
zone_enriched = []
for p in zone_pdf:
    nic = p['nic']
    in_resp = zone_resp_by_nic.get(nic, {})
    in_all = all_members_by_nic.get(nic, {})
    
    phone = in_resp.get('phone') or in_all.get('phone')
    email = in_resp.get('email') or in_all.get('email')
    ieee_no = in_resp.get('ieee_no') or in_all.get('ieee_no')
    degree = in_resp.get('degree')
    year = in_resp.get('year')
    ieee_mem = in_resp.get('active_ieee') or ('Yes' if ieee_no else None)
    
    zone_enriched.append({
        'num': p['num'],
        'name': p['name'],
        'nic': nic,
        'food': p['food'],
        'phone': phone,
        'email': email,
        'ieee_no': ieee_no,
        'degree': degree,
        'year': year,
        'ieee_member': ieee_mem
    })

# --- 3. Parse Cambio Data ---
wb_cambio = openpyxl.load_workbook('/Users/school/Desktop/Industry Visit/theloop_cambio_combined.xlsx', data_only=True)
ws_c = wb_cambio['Combined']
cambio_enriched = []
for r in range(2, ws_c.max_row+1):
    nic = str(ws_c.cell(r, 5).value or '').strip()
    if not nic: continue
    phone_val = ws_c.cell(r, 4).value
    phone_str = str(phone_val).strip() if phone_val is not None else None
    if phone_str and phone_str.endswith('.0'): phone_str = phone_str[:-2]
    if phone_str and not phone_str.startswith('0') and len(phone_str) == 9: phone_str = '0' + phone_str
    
    in_all = all_members_by_nic.get(nic, {})
    in_zn_resp = zone_resp_by_nic.get(nic, {})
    
    ieee_no = in_all.get('ieee_no') or in_zn_resp.get('ieee_no')
    
    cambio_enriched.append({
        'num': ws_c.cell(r, 1).value,
        'name': str(ws_c.cell(r, 2).value or '').strip(),
        'email': str(ws_c.cell(r, 3).value or '').strip(),
        'phone': phone_str,
        'nic': nic,
        'degree': ws_c.cell(r, 6).value,
        'year': ws_c.cell(r, 7).value,
        'source': ws_c.cell(r, 8).value,
        'ieee_no': ieee_no
    })

print(f'Cambio participants parsed: {len(cambio_enriched)}')
assert len(cambio_enriched) == 27, f"Expected 27 Cambio participants, got {len(cambio_enriched)}"

# Styles
font_header = Font(name='Arial', size=11, bold=True)
font_data = Font(name='Arial', size=10, bold=False)
align_left = Alignment(horizontal='left', vertical='center')
align_center = Alignment(horizontal='center', vertical='center')

# --- 4. Populate Sheet: Zone24x7 ---
ws_zone = wb['Zone24x7']
ws_zone.delete_rows(1, ws_zone.max_row+1)
zone_std_headers = ['Full Name', 'IEEE Membership No', 'NIC', 'Phone Number', 'Email Address']
for col_idx, h in enumerate(zone_std_headers, 1):
    cell = ws_zone.cell(1, col_idx, h)
    cell.font = font_header
    cell.alignment = align_left

for row_idx, p in enumerate(zone_enriched, 2):
    ws_zone.cell(row_idx, 1, p['name']).font = font_data
    ws_zone.cell(row_idx, 2, p['ieee_no']).font = font_data
    ws_zone.cell(row_idx, 3, p['nic']).font = font_data
    ws_zone.cell(row_idx, 4, p['phone']).font = font_data
    ws_zone.cell(row_idx, 5, p['email']).font = font_data

# --- 5. Populate Sheet: Zone24x7 Detailed ---
if 'Zone24x7 Detailed' in wb.sheetnames:
    ws_zone_det = wb['Zone24x7 Detailed']
    ws_zone_det.delete_rows(1, ws_zone_det.max_row+1)
else:
    ws_zone_det = wb.create_sheet('Zone24x7 Detailed')

zone_det_headers = ['#', 'Full Name', 'Email Address', 'Phone Number', 'NIC', 'Degree Program', 'Year of Study', 'Dietary Preference', 'IEEE Member', 'IEEE Membership No']
for col_idx, h in enumerate(zone_det_headers, 1):
    cell = ws_zone_det.cell(1, col_idx, h)
    cell.font = font_header
    cell.alignment = align_left

for row_idx, p in enumerate(zone_enriched, 2):
    ws_zone_det.cell(row_idx, 1, p['num']).font = font_data
    ws_zone_det.cell(row_idx, 2, p['name']).font = font_data
    ws_zone_det.cell(row_idx, 3, p['email']).font = font_data
    ws_zone_det.cell(row_idx, 4, p['phone']).font = font_data
    ws_zone_det.cell(row_idx, 5, p['nic']).font = font_data
    ws_zone_det.cell(row_idx, 6, p['degree']).font = font_data
    ws_zone_det.cell(row_idx, 7, p['year']).font = font_data
    ws_zone_det.cell(row_idx, 8, p['food']).font = font_data
    ws_zone_det.cell(row_idx, 9, p['ieee_member']).font = font_data
    ws_zone_det.cell(row_idx, 10, p['ieee_no']).font = font_data

# --- 6. Populate Sheet: Cambio ---
ws_cambio = wb['Cambio']
ws_cambio.delete_rows(1, ws_cambio.max_row+1)
cambio_std_headers = ['Full Name', 'IEEE Membership No', 'NIC', 'Phone Number', 'Email Address']
for col_idx, h in enumerate(cambio_std_headers, 1):
    cell = ws_cambio.cell(1, col_idx, h)
    cell.font = font_header
    cell.alignment = align_left

for row_idx, p in enumerate(cambio_enriched, 2):
    ws_cambio.cell(row_idx, 1, p['name']).font = font_data
    ws_cambio.cell(row_idx, 2, p['ieee_no']).font = font_data
    ws_cambio.cell(row_idx, 3, p['nic']).font = font_data
    ws_cambio.cell(row_idx, 4, p['phone']).font = font_data
    ws_cambio.cell(row_idx, 5, p['email']).font = font_data

# --- 7. Populate Sheet: Cambio Detailed ---
if 'Cambio Detailed' in wb.sheetnames:
    ws_cambio_det = wb['Cambio Detailed']
    ws_cambio_det.delete_rows(1, ws_cambio_det.max_row+1)
else:
    ws_cambio_det = wb.create_sheet('Cambio Detailed')

cambio_det_headers = ['#', 'Full Name', 'Email Address', 'Phone Number', 'NIC', 'Degree Program', 'Year of Study', 'Source']
for col_idx, h in enumerate(cambio_det_headers, 1):
    cell = ws_cambio_det.cell(1, col_idx, h)
    cell.font = font_header
    cell.alignment = align_left

for row_idx, p in enumerate(cambio_enriched, 2):
    ws_cambio_det.cell(row_idx, 1, p['num']).font = font_data
    ws_cambio_det.cell(row_idx, 2, p['name']).font = font_data
    ws_cambio_det.cell(row_idx, 3, p['email']).font = font_data
    ws_cambio_det.cell(row_idx, 4, p['phone']).font = font_data
    ws_cambio_det.cell(row_idx, 5, p['nic']).font = font_data
    ws_cambio_det.cell(row_idx, 6, p['degree']).font = font_data
    ws_cambio_det.cell(row_idx, 7, p['year']).font = font_data
    ws_cambio_det.cell(row_idx, 8, p['source']).font = font_data

# --- 8. Update Sheet: All Members ---
# Headers
cell_m1 = ws_all.cell(1, 13, 'Zone24x7')
cell_m1.font = font_header
cell_n1 = ws_all.cell(1, 14, 'Cambio')
cell_n1.font = font_header

# Fix existing row formulas and attendance
existing_rows = ws_all.max_row
zone_by_nic = {p['nic']: p for p in zone_enriched}
cambio_by_nic = {p['nic']: p for p in cambio_enriched}

tracked_nics = set()
for r in range(2, existing_rows+1):
    nic = str(ws_all.cell(r, 2).value or '').strip()
    if not nic: continue
    tracked_nics.add(nic)
    
    # Update formula in Col 6 (F)
    ws_all.cell(r, 6).value = f'=COUNTIF(G{r}:N{r},"Y")'
    ws_all.cell(r, 6).font = font_data
    
    # Check Zone24x7
    if nic in zone_by_nic:
        ws_all.cell(r, 13, 'Y').font = font_data
        ws_all.cell(r, 13).alignment = align_center
        # Enrich missing info if empty
        if not ws_all.cell(r, 3).value and zone_by_nic[nic]['ieee_no']:
            ws_all.cell(r, 3, zone_by_nic[nic]['ieee_no'])
        if not ws_all.cell(r, 4).value and zone_by_nic[nic]['phone']:
            ws_all.cell(r, 4, zone_by_nic[nic]['phone'])
        if not ws_all.cell(r, 5).value and zone_by_nic[nic]['email']:
            ws_all.cell(r, 5, zone_by_nic[nic]['email'])
            
    # Check Cambio
    if nic in cambio_by_nic:
        ws_all.cell(r, 14, 'Y').font = font_data
        ws_all.cell(r, 14).alignment = align_center
        # Enrich missing info if empty
        if not ws_all.cell(r, 3).value and cambio_by_nic[nic]['ieee_no']:
            ws_all.cell(r, 3, cambio_by_nic[nic]['ieee_no'])
        if not ws_all.cell(r, 4).value and cambio_by_nic[nic]['phone']:
            ws_all.cell(r, 4, cambio_by_nic[nic]['phone'])
        if not ws_all.cell(r, 5).value and cambio_by_nic[nic]['email']:
            ws_all.cell(r, 5, cambio_by_nic[nic]['email'])

# Append new Zone24x7 participants not yet in All Members
next_row = existing_rows + 1
new_zone_count = 0
for p in zone_enriched:
    nic = p['nic']
    if nic not in tracked_nics:
        tracked_nics.add(nic)
        ws_all.cell(next_row, 1, p['name']).font = font_data
        ws_all.cell(next_row, 2, nic).font = font_data
        ws_all.cell(next_row, 3, p['ieee_no']).font = font_data
        ws_all.cell(next_row, 4, p['phone']).font = font_data
        ws_all.cell(next_row, 5, p['email']).font = font_data
        ws_all.cell(next_row, 6, f'=COUNTIF(G{next_row}:N{next_row},"Y")').font = font_data
        ws_all.cell(next_row, 13, 'Y').font = font_data
        ws_all.cell(next_row, 13).alignment = align_center
        next_row += 1
        new_zone_count += 1

print(f'Appended {new_zone_count} new Zone24x7 members to All Members')

# Append new Cambio participants not yet in All Members
new_cambio_count = 0
for p in cambio_enriched:
    nic = p['nic']
    if nic not in tracked_nics:
        tracked_nics.add(nic)
        ws_all.cell(next_row, 1, p['name']).font = font_data
        ws_all.cell(next_row, 2, nic).font = font_data
        ws_all.cell(next_row, 3, p['ieee_no']).font = font_data
        ws_all.cell(next_row, 4, p['phone']).font = font_data
        ws_all.cell(next_row, 5, p['email']).font = font_data
        ws_all.cell(next_row, 6, f'=COUNTIF(G{next_row}:N{next_row},"Y")').font = font_data
        ws_all.cell(next_row, 14, 'Y').font = font_data
        ws_all.cell(next_row, 14).alignment = align_center
        next_row += 1
        new_cambio_count += 1

print(f'Appended {new_cambio_count} new Cambio members to All Members')
print(f'Total rows in All Members now: {ws_all.max_row}')

# Adjust sheet order nicely
desired_order = [
    'Atlas Labs Detailed', 'WSO2 Detailed', 'Codegen Detailed', 'Orange Detailed', 'Rootcode Detailed', 'IFS Detailed',
    'Zone24x7 Detailed', 'Cambio Detailed',
    'All Members',
    'Atlas Labs', 'WSO2', 'Codegen', 'Orange', 'Rootcode', 'IFS', 'Zone24x7', 'Cambio', 'Lion Beer'
]

# Save workbook
wb.save(tracking_path)
print('Updated workbook saved successfully to:', tracking_path)
