"""Read-only server inventory. Never print environment values or credentials."""
import json
from pathlib import Path
import shutil
import subprocess
import urllib.parse

ROOT = Path.home()/'kant-moa'


def run(args):
    result = subprocess.run(args,capture_output=True,text=True,timeout=30)
    if result.returncode: raise RuntimeError('Read-only command failed: '+args[0])
    return result.stdout.strip()


def main():
    compose = ['docker','compose','-f',str(ROOT/'compose.backend.yml')]
    cid = run(compose+['ps','-q','api'])
    if not cid or '\n' in cid: raise RuntimeError('Expected exactly one existing API')
    container = json.loads(run(['docker','inspect',cid]))[0]
    values = dict(item.split('=',1) for item in container['Config']['Env'] if '=' in item)
    url = urllib.parse.urlsplit(values.get('DATABASE_URL',''))
    mounts = container.get('Mounts',[])
    uploads = next((m for m in mounts if m['Destination']=='/app/uploads'),None)
    assets = next((m for m in mounts if m['Destination']=='/app/assets'),None)
    source_assets = ROOT/'app/backend/assets'
    report = {
        'status':'PREFLIGHT_OK',
        'app_commit':run(['git','-C',str(ROOT/'app'),'rev-parse','HEAD']),
        'api_image':container['Config']['Image'],
        'api_image_id':container['Image'],
        'api_health':container.get('State',{}).get('Health',{}).get('Status'),
        'api_ports':container['HostConfig'].get('PortBindings',{}),
        'target_db_matches':urllib.parse.unquote(url.path.lstrip('/'))=='kant-moa' and urllib.parse.unquote(url.username or '')=='kant-moa',
        'jwt_present':bool(values.get('JWT_SECRET')),
        'uploads_mount':({'type':uploads['Type'],'source':uploads['Source']} if uploads else None),
        'assets_mount':({'type':assets['Type'],'source':assets['Source']} if assets else None),
        'source_products_webp':len(list((source_assets/'products').rglob('*.webp'))),
        'source_artists_webp':len(list((source_assets/'artists').rglob('*.webp'))),
        'backend_env_exists':(ROOT/'backend.env').is_file(),
        'compose_version':run(['docker','compose','version','--short']),
        'free_disk_mb':shutil.disk_usage(ROOT).free//1024//1024,
        'database_changed':False,
    }
    print(json.dumps(report,ensure_ascii=False))


if __name__=='__main__':
    try: main()
    except Exception as error:
        print(json.dumps({'status':'PREFLIGHT_FAILED','error_type':type(error).__name__}))
        raise SystemExit(1)
