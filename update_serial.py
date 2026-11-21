import csv
import os

input_path = '/home/karthikeyan/KARTHIKEYAN/PROJECTS/prasathhospital/new/registrator_data_formatted - Registrator Data.csv'
output_path = '/home/karthikeyan/KARTHIKEYAN/PROJECTS/prasathhospital/new/registrator_data_formatted - Registrator Data_updated.csv'

with open(input_path, newline='', encoding='utf-8') as fin:
    reader = csv.reader(fin)
    rows = list(reader)

header = rows[0]
updated = [header]
for row in rows[1:]:
    if not row:
        continue
    # Pad Serial Number (first column) to 4 digits
    try:
        serial = int(row[0])
        row[0] = str(serial).zfill(4)
    except ValueError:
        # keep as is if not numeric
        pass
    updated.append(row)

with open(output_path, 'w', newline='', encoding='utf-8') as fout:
    writer = csv.writer(fout)
    writer.writerows(updated)

print('Updated CSV written to', output_path)
