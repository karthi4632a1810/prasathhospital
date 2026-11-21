import csv
import os

input_path = '/home/karthikeyan/KARTHIKEYAN/PROJECTS/prasathhospital/new/registrator_data_formatted - Registrator Data_updated.csv'
output_path = '/home/karthikeyan/KARTHIKEYAN/PROJECTS/prasathhospital/new/non_tnmc_registrants.csv'

with open(input_path, newline='', encoding='utf-8') as fin:
    reader = csv.reader(fin)
    rows = list(reader)

header = rows[0]
non_tnmc = [header]
for row in rows[1:]:
    if len(row) < 2:
        continue
    council = row[1].strip()
    if council != 'Tamil Nadu Medical Council':
        non_tnmc.append(row)

with open(output_path, 'w', newline='', encoding='utf-8') as fout:
    writer = csv.writer(fout)
    writer.writerows(non_tnmc)

print('Non-TNMC CSV written to', output_path)
