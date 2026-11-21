import csv
import os
import sys
from pymongo import MongoClient
import pandas as pd

MONGO_URI = os.getenv('MONGODB_URI', 'mongodb+srv://jiokarthikeyan18_db_user:Oe8OhnOrD164A0dJ@prashantdb.ma6fim0.mongodb.net/prashanth_events')
client = MongoClient(MONGO_URI)
db = client.get_default_database()
registrations = db['registrations']

csv_path = '/home/karthikeyan/KARTHIKEYAN/PROJECTS/prasathhospital/registrants_tamil_nadu_medical_council.csv'
output_path = '/home/karthikeyan/KARTHIKEYAN/PROJECTS/prasathhospital/registrants_tamil_nadu_medical_council_updated.csv'

rows = []
with open(csv_path, newline='', encoding='utf-8') as f:
    reader = csv.reader(f)
    for row in reader:
        rows.append(row)

# Assume header is first two rows (metadata lines), keep them unchanged
header_lines = rows[:2]
data_rows = rows[2:]

updated_rows = []
for row in data_rows:
    # Columns: 0 Serial Number,1 Name of the council,2 TNMC Register Number,3 Full Name,4 Email Id,5 Mobile,6 Signature
    email = row[4].strip()
    mobile = row[5].strip()
    query = {'$or': []}
    if email:
        query['$or'].append({'attendee.email': {'$regex': f'^{email}$', '$options': 'i'}})
    if mobile:
        query['$or'].append({'attendee.phone': {'$regex': f'^{mobile}$'}})
    doc = registrations.find_one(query, {'badgeNo': 1})
    badge = ''
    if doc and 'badgeNo' in doc:
        badge = str(doc['badgeNo']).zfill(4)
    # Update column 2 (Name of the council) maybe keep as is, column 3 is TNMC Register Number -> replace with badge
    row[2] = badge
    updated_rows.append(row)

# Sort by badge number numeric ascending (treat empty as large)
sorted_rows = sorted(updated_rows, key=lambda r: int(r[2]) if r[2].isdigit() else 999999)

# Write output CSV
with open(output_path, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    for h in header_lines:
        writer.writerow(h)
    for r in sorted_rows:
        writer.writerow(r)

print('Updated CSV written to', output_path)
