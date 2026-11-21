import csv
import os

input_path = '/home/karthikeyan/KARTHIKEYAN/PROJECTS/prasathhospital/new/registrator_data_overall_reversed_serial_matched.csv'
output_path = '/home/karthikeyan/KARTHIKEYAN/PROJECTS/prasathhospital/new/registrator_data_overall_reversed_serial_matched_updated.csv'

with open(input_path, newline='', encoding='utf-8') as fin:
    reader = csv.reader(fin)
    rows = list(reader)

header = rows[0]
# add new column for ID Card Number
header.append('ID Card Number')

updated_rows = [header]
for row in rows[1:]:
    if not row:
        continue
    # Ensure row has enough columns (some rows may be shorter)
    while len(row) < len(header)-1:
        row.append('')
    # Pad serial number to 4 digits
    try:
        serial_int = int(row[0])
        padded = str(serial_int).zfill(4)
    except ValueError:
        padded = row[0]
    # Update full name for serial 921
    if row[0] == '921' or padded == '0921':
        row[3] = 'BHUTE SAKSHI NANDKISHOR'
    # Append ID Card Number (padded serial)
    row.append(padded)
    updated_rows.append(row)

with open(output_path, 'w', newline='', encoding='utf-8') as fout:
    writer = csv.writer(fout)
    writer.writerows(updated_rows)

print('Updated CSV written to', output_path)
