"""Build a private localhost candidate; leave the running public API unchanged."""
import json
import os
from pathlib import Path
import socket
import subprocess
import urllib.parse
import urllib.request

ROOT = Path.home() / 'kant-moa'
RELEASE = Path(__file__).resolve().parents[2]
os.umask(0o077)


def command(args, *, data=None, env=None, timeout=60):
    result = subprocess.run(args, input=data, capture_output=True, env=env, timeout=timeout)
    if result.returncode:
        raise RuntimeError('Command failed: ' + args[0])
    return result.stdout


SNAPSHOT = b'''import asyncio,hashlib,json,os
import asyncpg
async def main():
    url=os.environ['DATABASE_URL'].replace('postgresql+asyncpg://','postgresql://',1)
    con=await asyncpg.connect(url)
    try:
        async with con.transaction(isolation='repeatable_read',readonly=True):
            names=await con.fetch("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
            tables={}
            for row in names:
                name=row['tablename']; quoted='"'+name.replace('"','""')+'"'
                rows=await con.fetch('SELECT row_to_json(t)::text AS value FROM public.'+quoted+' t')
                values=sorted(r['value'] for r in rows)
                tables[name]={'count':len(values),'sha256':hashlib.sha256(('\\n'.join(values)).encode()).hexdigest()}
            seq=await con.fetch("SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename")
            print(json.dumps({'tables':tables,'sequences':[dict(r) for r in seq]},sort_keys=True))
    finally: await con.close()
asyncio.run(main())
'''


def main():
    manifest = json.loads((RELEASE / 'site-release.json').read_text())
    old = ['docker', 'compose', '-f', str(ROOT / 'compose.backend.yml')]
    cid = command(old + ['ps', '-q', 'api']).decode().strip()
    assert cid and '\n' not in cid, 'Expected one running original API'
    current = json.loads(command(['docker', 'inspect', cid]))[0]
    assert current['State']['Health']['Status'] == 'healthy'
    values = dict(v.split('=', 1) for v in current['Config']['Env'] if '=' in v)
    target = urllib.parse.urlsplit(values['DATABASE_URL'])
    assert (target.hostname, target.port, urllib.parse.unquote(target.path.lstrip('/'))) == (
        '0.tcp.jp.ngrok.io', 12799, 'kant-moa'), 'Unexpected target DB'
    assert values.get('JWT_SECRET'), 'Existing JWT required'
    mounts = {m['Destination']: m for m in current['Mounts']}
    upload = mounts['/app/uploads']['Source']
    assets = ROOT / 'app/backend/assets'
    assert len(list((assets / 'products').rglob('*.webp'))) == 1800
    assert len(list((assets / 'artists').rglob('*.webp'))) == 47
    env_file = ROOT / 'backend.env'
    assert env_file.is_file()
    with socket.socket() as check:
        check.bind(('127.0.0.1', 8030))
    before = json.loads(command(['docker', 'exec', '-i', cid, 'python', '-'], data=SNAPSHOT))
    (RELEASE / 'database-before.json').write_text(json.dumps(before, sort_keys=True))
    project = 'kant-site-' + RELEASE.name.removeprefix('site-').lower()
    env = {**os.environ, 'SITE_RELEASE': RELEASE.name, 'SITE_PORT': '8030',
           'SITE_PUBLIC_ORIGIN': 'https://letdown-kilometer-nutcase.ngrok-free.dev',
           'SITE_API_ENV_FILE': str(env_file), 'SITE_ASSET_DIR': str(assets), 'SITE_UPLOAD_DIR': upload}
    compose = ['docker', 'compose', '-p', project, '-f', str(RELEASE / 'deploy/staging/compose.site.yml')]
    # Persist only paths and public deployment settings, never DATABASE_URL/JWT.
    settings = {k: v for k, v in env.items() if k.startswith('SITE_')}
    (RELEASE / 'site.env').write_text(''.join(k + '=' + v + '\n' for k, v in settings.items()))
    report = {'status': 'CANDIDATE_FAILED', 'base_commit': manifest['base_commit'],
              'source_sha256': manifest['source_sha256'], 'release': str(RELEASE),
              'project': project, 'public_api_changed': False, 'database_unchanged': None}
    try:
        resolved = json.loads(command(compose + ['config', '--format', 'json'], env=env))
        candidate_env = resolved['services']['api']['environment']
        for key in ['DATABASE_URL', 'JWT_SECRET']:
            assert candidate_env.get(key) == values[key], 'Existing API environment differs'
        for service in ['api', 'web']:
            print('Building candidate ' + service, flush=True)
            with (RELEASE / ('build-' + service + '.log')).open('wb') as log:
                result = subprocess.run(compose + ['build', service], env=env, stdout=log,
                                        stderr=subprocess.STDOUT, timeout=1800)
            assert result.returncode == 0, 'Build failed; inspect protected server log'
        command(compose + ['up', '-d', '--wait', '--wait-timeout', '180'], env=env, timeout=240)
        base = 'http://127.0.0.1:8030'
        results = {}
        for path in ['/health', '/api/health', '/api/openapi.json', '/api/products?size=1',
                     '/api/artists', '/', '/products', '/artists', '/login', '/api/docs']:
            with urllib.request.urlopen(base + path, timeout=45) as response:
                body = response.read()
                assert response.status == 200
                if path == '/api/openapi.json':
                    doc = json.loads(body)
                    assert {'url': '/api'} in doc['servers']
                    assert '/artists' in doc['paths'] and '/admin/products' in doc['paths']
                    flow = doc['components']['securitySchemes']['OAuth2PasswordBearer']['flows']['password']
                    assert flow['tokenUrl'] == 'auth/login'
                if path == '/api/products?size=1': report['public_products'] = json.loads(body)['total']
                results[path] = response.status
        after = json.loads(command(['docker', 'exec', '-i', cid, 'python', '-'], data=SNAPSHOT))
        (RELEASE / 'database-after.json').write_text(json.dumps(after, sort_keys=True))
        report['database_unchanged'] = before == after
        assert before == after, 'DB activity detected; investigate before switching'
        # The old public container must still be running and healthy.
        old_state = json.loads(command(['docker', 'inspect', cid]))[0]['State']
        assert old_state['Running'] and old_state['Health']['Status'] == 'healthy'
        report.update(status='SITE_CANDIDATE_READY', http=results, database_unchanged=True)
    except Exception as error:
        report['error_type'] = type(error).__name__
        command(compose + ['down'], env=env, timeout=90)
        raise
    finally:
        (RELEASE / 'report.json').write_text(json.dumps(report, indent=2))
        print(json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
