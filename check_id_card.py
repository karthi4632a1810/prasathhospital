import csv
import os

input_path = '/home/karthikeyan/KARTHIKEYAN/PROJECTS/prasathhospital/new/registrator_data_overall_reversed_serial_matched_updated.csv'
report_path = '/home/karthikeyan/.gemini/antigravity/brain/266c9658-44db-419a-a5a6-b73542a7a91d/id_card_check_report.md'

mismatches = []
with open(input_path, newline='', encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)
    id_idx = header.index('ID Card Number') if 'ID Card Number' in header else -1
    for row in reader:
        if not row:
            continue
        serial = row[0].strip()
        # pad serial to 4 digits
        try:
            padded = str(int(serial)).zfill(4)
        except ValueError:
            padded = serial
        id_card = row[id_idx].strip() if id_idx != -1 else ''
        if padded != id_card:
            mismatches.append((serial, padded, id_card, ','.join(row)))

with open(report_path, 'w', encoding='utf-8') as out:
    out.write('# ID Card Number Verification Report\n\n')
    out.write(f'Total rows checked: {len(mismatches) + (len(open(input_path).read().splitlines()) - 1)}\n')
    out.write(f'Mismatches found: {len(mismatches)}\n\n')
    if mismatches:
        out.write('## Mismatched rows\n\n')
        out.write('| Serial | Expected ID | Actual ID | Full Row (CSV) |\n')
        out.write('|---|---|---|---|\n')
        for ser, exp, act, full in mismatches:
            out.write(f'| {ser} | {exp} | {act} | {full} |\n')
    else:
        out.write('All rows have matching ID Card Numbers.\n')

print('Report written to', report_path)
