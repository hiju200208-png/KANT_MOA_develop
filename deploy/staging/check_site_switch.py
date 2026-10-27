"""Exercise switch success and rollback without SSH, Docker, HTTP, or a DB."""
import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('site_switch', ROOT/'deploy/staging/site_switch.py')
site = importlib.util.module_from_spec(spec)
spec.loader.exec_module(site)


def scenario(fail):
    with tempfile.TemporaryDirectory(prefix='kant-site-switch-test-') as folder:
        root = Path(folder).resolve()
        release = root/'site-releases/site-test'; release.mkdir(parents=True)
        for name in ['compose.backend.yml', 'Dockerfile.backend', 'backend.env']:
            (root/name).write_text('fake-test-only')
        (release/'report.json').write_text(json.dumps({'status':'SITE_CANDIDATE_READY',
            'database_unchanged':True,'source_sha256':site.EXPECTED_SOURCE,'project':'test-project'}))
        (release/'site-release.json').write_text(json.dumps({'source_sha256':site.EXPECTED_SOURCE,'files':[]}))
        (release/'site.env').write_text('SITE_PORT=8030\nSITE_RELEASE=site-test\n')
        values = {'DATABASE_URL':'local-test-placeholder','JWT_SECRET':'fake-test-only'}
        def inspect(cid):
            return {'State':{'Running':True,'Health':{'Status':'healthy'}},'Image':'test-image-id',
                    'Config':{'Env':[k+'='+v for k,v in values.items()]},
                    'HostConfig':{'PortBindings':{'8000/tcp':[{'HostIp':'127.0.0.1','HostPort':'8022'}]}},
                    'Mounts':[{'Destination':'/app/uploads','Source':'fake-uploads'},
                              {'Destination':'/app/assets','Source':str(root/'app/backend/assets'),'RW':False}]}
        calls = []
        def command(args,**kwargs):
            calls.append(args)
            if args[:2]==['docker','inspect']: return json.dumps([inspect(args[2])]).encode()
            if args[-3:]==['ps','-q','api']: return b'old-id' if 'test-project' not in args else b'new-id'
            if args[-3:]==['config','--format','json']:
                return json.dumps({'services':{'api':{'environment':values}}}).encode()
            if args[:2]==['docker','exec']: return b'{"tables":{},"sequences":[]}'
            return b''
        helper = SimpleNamespace(command=command,SNAPSHOT=b'fake-read-only-snapshot')
        dummy_spec = SimpleNamespace(loader=SimpleNamespace(exec_module=lambda _:None))
        def verify(base):
            if fail and base==site.PUBLIC: raise RuntimeError('simulated public check failure')
            return {'homepage':200}
        with patch.object(site,'ROOT',root), patch.object(site,'verify',verify), \
             patch.object(site,'get',lambda *a: b'{"status":"ok","database":"ok"}'), \
             patch.object(site.importlib.util,'spec_from_file_location',return_value=dummy_spec), \
             patch.object(site.importlib.util,'module_from_spec',return_value=helper):
            try: site.switch(release)
            except RuntimeError:
                assert fail
        report = json.loads((release/'switch-report.json').read_text())
        if fail:
            assert report['rollback']=='ORIGINAL_API_RESTORED'
            assert ['docker','start','old-id'] in calls
            assert 'SITE_PORT=8030' in (release/'site.env').read_text()
            assert not (root/'active-site.json').exists()
        else:
            assert report['status']=='SITE_DEPLOY_SUCCESS' and report['database_unchanged'] is True
            assert 'SITE_PORT=8022' in (release/'site.env').read_text()
            assert (root/'active-site.json').exists()
        assert all('down' not in args and 'build' not in args for args in calls)


scenario(False)
scenario(True)
print('SWITCH_SUCCESS_AND_ROLLBACK_CHECKS_PASSED')
