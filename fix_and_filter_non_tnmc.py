import csv
import os

input_path = '/home/karthikeyan/KARTHIKEYAN/PROJECTS/prasathhospital/new/registrator_data_overall_reversed_serial_matched_updated.csv'
corrected_path = '/home/karthikeyan/KARTHIKEYAN/PROJECTS/prasathhospital/new/registrator_data_overall_reversed_serial_matched_corrected.csv'
non_tnmc_path = '/home/karthikeyan/KARTHIKEYAN/PROJECTS/prasathhospital/new/non_tnmc_exact_id.csv'

with open(input_path, newline='', encoding='utf-8') as fin:
    reader = csv.reader(fin)
    rows = list(reader)

header = rows[0]
# ensure ID Card Number column exists
if 'ID Card Number' not in header:
    header.append('ID Card Number')
id_idx = header.index('ID Card Number')

corrected_rows = [header]
non_tnmc_rows = [header]
for row in rows[1:]:
    if not row:
        continue
    # pad serial number to 4 digits
    serial = row[0].strip()
    try:
        padded = str(int(serial)).zfill(4)
    except ValueError:
        padded = serial
    # ensure row length matches header
    while len(row) < len(header):
        row.append('')
    # update ID Card Number to padded serial
    row[id_idx] = padded
    corrected_rows.append(row)
    # filter non-TNMC rows
    council = row[1].strip()
    if council != 'Tamil Nadu Medical Council':
        non_tnmc_rows.append(row)

# write corrected full CSV
with open(corrected_path, 'w', newline='', encoding='utf-8') as fout:
    writer = csv.writer(fout)
    writer.writerows(corrected_rows)

# write non-TNMC filtered CSV
with open(non_tnmc_path, 'w', newline='', encoding='utf-8') as fout:
    writer = csv.writer(fout)
    writer.writerows(non_tnmc_rows)

print('Corrected CSV written to', corrected_path)
print('Non-TNMC CSV with exact ID Card Numbers written to', non_tnmc_path)
