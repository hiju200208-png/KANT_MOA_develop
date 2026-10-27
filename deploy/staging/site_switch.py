"""Switch a verified localhost candidate onto 8022; restore the old API on failure."""
import importlib.util
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import time
import urllib.error
import urllib.request

ROOT = Path.home() / 'kant-moa'
PUBLIC = 'https://letdown-kilometer-nutcase.ngrok-free.dev'
EXPECTED_SOURCE = '602d436c308c187da34377f31ee36b8b53ad5835cc6fb281ed68185de2e475c0'


def get(base, path, expected=200):
    request = urllib.request.Request(base + path, headers={'ngrok-skip-browser-warning': 'true'})
    try:
        response = urllib.request.urlopen(request, timeout=35)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        body = response.read()
        assert response.status == expected, 'Unexpected HTTP status: ' + path
        return body


def verify(base):
    health = json.loads(get(base, '/api/health'))
    assert health == {'status': 'ok', 'database': 'ok'}
    doc = json.loads(get(base, '/api/openapi.json'))
    assert {'url': '/api'} in doc['servers']
    for path in ['/products', '/artists', '/admin/products', '/orders', '/wishlist/ids']:
        assert path in doc['paths'], 'Missing API route'
    flow = doc['components']['securitySchemes']['OAuth2PasswordBearer']['flows']['password']
    assert flow['tokenUrl'] == 'auth/login'
    products = json.loads(get(base, '/api/products?size=1'))
    assert products['total'] > 0
    assert b'KANT' in get(base, '/')
    assert b'KANT' in get(base, '/login')
    assert b'/api/openapi.json' in get(base, '/api/docs')
    assert json.loads(get(base, '/api/wishlist/ids', 401))['code'] == 'NOT_AUTHENTICATED'
    get(base, '/api/admin/products', 401)
    image = products['items'][0]['thumbnail_path']
    if image:
        assert image.startswith('/static/') or image.startswith('/uploads/')
        assert get(base, '/api' + image)
    return {'public_products': products['total'], 'api_paths': len(doc['paths']),
            'homepage': 200, 'swagger': 200, 'protected_api_without_token': 401}


def switch(release):
    os.umask(0o077)
    assert release.parent == (ROOT / 'site-releases').resolve()
    ready = json.loads((release / 'report.json').read_text())
    assert ready['status'] == 'SITE_CANDIDATE_READY' and ready['database_unchanged'] is True
    assert ready['source_sha256'] == EXPECTED_SOURCE
    manifest = json.loads((release / 'site-release.json').read_text())
    assert manifest['source_sha256'] == EXPECTED_SOURCE
    for name, expected in manifest['files']:
        assert hashlib.sha256((release / name).read_bytes()).hexdigest() == expected
    # Reuse the exact candidate's read-only snapshot and command helpers.
    spec = importlib.util.spec_from_file_location('site_candidate', release / 'deploy/staging/site_candidate.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    command = module.command
    old = ['docker', 'compose', '-f', str(ROOT / 'compose.backend.yml')]
    old_id = command(old + ['ps', '-q', 'api']).decode().strip()
    assert old_id and '\n' not in old_id
    previous = json.loads(command(['docker', 'inspect', old_id]))[0]
    assert previous['State']['Health']['Status'] == 'healthy'
    assert previous['HostConfig']['PortBindings']['8000/tcp'] == [
        {'HostIp': '127.0.0.1', 'HostPort': '8022'}]
    env_path = release / 'site.env'
    original_settings = env_path.read_text()
    settings = dict(line.split('=', 1) for line in original_settings.splitlines() if line)
    assert settings['SITE_PORT'] == '8030'
    env = {**os.environ, **settings}
    compose = ['docker', 'compose', '-p', ready['project'], '--env-file', str(env_path),
               '-f', str(release / 'deploy/staging/compose.site.yml')]
    resolved = json.loads(command(compose + ['config', '--format', 'json'], env=env))
    old_env = dict(v.split('=', 1) for v in previous['Config']['Env'] if '=' in v)
    for key in ['DATABASE_URL', 'JWT_SECRET']:
        assert resolved['services']['api']['environment'][key] == old_env[key]
    candidate_id = command(compose + ['ps', '-q', 'api'], env=env).decode().strip()
    candidate = json.loads(command(['docker', 'inspect', candidate_id]))[0]
    assert candidate['State']['Health']['Status'] == 'healthy'
    active_env = dict(v.split('=', 1) for v in candidate['Config']['Env'] if '=' in v)
    for key in ['DATABASE_URL', 'JWT_SECRET']:
        assert active_env[key] == old_env[key]
    old_upload = next(m['Source'] for m in previous['Mounts'] if m['Destination'] == '/app/uploads')
    new_upload = next(m['Source'] for m in candidate['Mounts'] if m['Destination'] == '/app/uploads')
    assert old_upload == new_upload
    assets = next(m for m in candidate['Mounts'] if m['Destination'] == '/app/assets')
    assert assets['Source'] == str(ROOT / 'app/backend/assets') and assets['RW'] is False
    verify('http://127.0.0.1:8030')
    before = json.loads(command(['docker', 'exec', '-i', old_id, 'python', '-'], data=module.SNAPSHOT))
    backup = ROOT / 'backups' / ('before-' + release.name)
    backup.mkdir(parents=True, exist_ok=False)
    for name in ['compose.backend.yml', 'Dockerfile.backend', 'backend.env']:
        shutil.copy2(ROOT / name, backup / name)
        (backup / name).chmod(0o600)
    (backup / 'database-before.json').write_text(json.dumps(before, sort_keys=True))
    rollback_tag = 'kant-moa-api:before-' + release.name.lower()
    command(['docker', 'tag', previous['Image'], rollback_tag])
    (backup / 'original-api.json').write_text(json.dumps({'container': old_id, 'image': previous['Image'],
                                                        'rollback_tag': rollback_tag}))
    report = {'status': 'SITE_SWITCH_FAILED', 'release': str(release), 'source_sha256': EXPECTED_SOURCE,
              'backup': str(backup), 'database_unchanged': None, 'rollback': None}
    stopped = False
    try:
        print('Candidate rechecked; original API image and settings backed up', flush=True)
        # Set the flag before stopping so even a stop timeout triggers recovery.
        stopped = True
        command(['docker', 'stop', '--time', '20', old_id], timeout=45)
        env['SITE_PORT'] = '8022'
        command(compose + ['up', '-d', '--no-deps', '--no-build', '--force-recreate', 'gateway'], env=env, timeout=90)
        print('Gateway switched to 8022; verifying internal and public access', flush=True)
        for attempt in range(10):
            try:
                report['internal'] = verify('http://127.0.0.1:8022')
                break
            except Exception:
                if attempt == 9: raise
                time.sleep(1)
        report['public'] = verify(PUBLIC)
        after = json.loads(command(['docker', 'exec', '-i', candidate_id, 'python', '-'], data=module.SNAPSHOT))
        (release / 'database-after-switch.json').write_text(json.dumps(after, sort_keys=True))
        report['database_unchanged'] = before == after
        assert before == after, 'DB activity detected; inspect snapshots (never restore DB automatically)'
        env_path.write_text(''.join(k + '=' + v + '\n' for k, v in settings.items() if k != 'SITE_PORT') + 'SITE_PORT=8022\n')
        (ROOT / 'active-site.json').write_text(json.dumps({'release': str(release), 'project': ready['project'],
                                                        'env_file': str(env_path), 'source_sha256': EXPECTED_SOURCE}))
        report['status'] = 'SITE_DEPLOY_SUCCESS'
    except Exception as error:
        report['error_type'] = type(error).__name__
        if stopped:
            try:
                command(compose + ['stop', 'gateway'], env=env, timeout=60)
                command(['docker', 'start', old_id])
                env_path.write_text(original_settings)
                for attempt in range(20):
                    try:
                        restored = json.loads(get('http://127.0.0.1:8022', '/health'))
                        assert restored == {'status': 'ok', 'database': 'ok'}
                        break
                    except Exception:
                        if attempt == 19: raise
                        time.sleep(1)
                report['rollback'] = 'ORIGINAL_API_RESTORED'
            except Exception as rollback_error:
                report['rollback'] = 'RECOVERY_REQUIRED'
                report['rollback_error_type'] = type(rollback_error).__name__
        raise
    finally:
        (release / 'switch-report.json').write_text(json.dumps(report, indent=2))
        print(json.dumps(report), flush=True)


if __name__ == '__main__':
    switch(Path(sys.argv[1]).resolve())
