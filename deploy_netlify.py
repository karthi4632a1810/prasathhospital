import os
import zipfile
import urllib.request
import json

TOKEN = 'nfp_vuUg3SNk44aZj2gxk6iZvy4g1y5grAhH1003'

def package_and_deploy(dist_dir, site_id, name, zip_path=None):
    if not zip_path:
        zip_path = f"{dist_dir}.zip"
    if os.path.exists(zip_path):
        os.remove(zip_path)
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(dist_dir):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, dist_dir).replace('\\', '/')
                z.write(full_path, rel_path)
    
    with open(zip_path, 'rb') as f:
        data = f.read()
    
    url = f"https://api.netlify.com/api/v1/sites/{site_id}/deploys"
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            'Authorization': f'Bearer {TOKEN}',
            'Content-Type': 'application/zip'
        },
        method='POST'
    )
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        print(f"{name} deployed! Deploy ID: {res.get('id')} State: {res.get('state')}")

if __name__ == '__main__':
    package_and_deploy('frontend-public/dist', '5df8ec3c-1790-4101-9951-e717983f066b', 'frontend-public', 'frontend-public/public-dist.zip')
    package_and_deploy('frontend-admin/dist', '875aebdc-1647-4c07-97e5-7e8453604e4c', 'frontend-admin', 'frontend-admin/admin-dist.zip')
