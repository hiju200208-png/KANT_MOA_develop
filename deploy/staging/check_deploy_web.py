"""Web deploy success/rollback checks using only temporary files and fakes."""
import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('deploy_web', Path(__file__).with_name('deploy_web.py'))
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


def scenario(fail):
    with tempfile.TemporaryDirectory(prefix='kant-web-deploy-test-') as folder:
        root = Path(folder).resolve()
        base_release = root / 'site-releases/base'; base_release.mkdir(parents=True)
        release = root / 'web-releases/new'; release.mkdir(parents=True)
        env = base_release / 'site.env'; env.write_text('SITE_PORT=8022\n')
        active = {'release': str(base_release), 'env_file': str(env), 'project': 'fake-site'}
        (root / 'active-site.json').write_text(json.dumps(active))
        (release / 'web-release.json').write_text(json.dumps({'files': [], 'commit': 'fake-commit', 'source_sha256': 'fake-digest'}))
        calls = []
        def command(args, **kwargs):
            calls.append(args)
            if args[-3:-1] == ['ps', '-q']: return (args[-1] + '-id').encode()
            if args[:2] == ['docker', 'port']: return b'127.0.0.1:12345'
            if args[:2] == ['docker', 'exec'] and args[-1] == '-': return b'{"tables":{}}'
            return b''
        def inspect(cid):
            return {'Image': 'sha256:old-' + cid,
                    'State': {'Health': {'Status': 'healthy'}},
                    'Config': {'Env': ['API_INTERNAL_URL=http://api:8000']},
                    'NetworkSettings': {'Networks': {'fake-site_default': {}}},
                    'HostConfig': {'PortBindings': {'8080/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '8022'}]}}}
        def verify(base):
            if fail and base == deploy.PUBLIC: raise RuntimeError('simulated failure')
            return {'homepage': 200}
        dummy_spec = SimpleNamespace(loader=SimpleNamespace(exec_module=lambda _: None))
        with patch.object(deploy, 'ROOT', root), patch.object(deploy, 'RELEASE', release), \
             patch.object(deploy, 'command', command), patch.object(deploy, 'inspect', inspect), \
             patch.object(deploy, 'verify_web', verify), patch.object(deploy.time, 'sleep', lambda _: None), \
             patch.object(deploy.subprocess, 'run', return_value=SimpleNamespace(returncode=0)), \
             patch.object(deploy.importlib.util, 'spec_from_file_location', return_value=dummy_spec), \
             patch.object(deploy.importlib.util, 'module_from_spec', return_value=SimpleNamespace(SNAPSHOT=b'fake-read-only')):
            try: deploy.main()
            except RuntimeError: assert fail
        report = json.loads((release / 'report.json').read_text())
        current = json.loads((root / 'active-site.json').read_text())
        if fail:
            assert report['rollback'] == 'PREVIOUS_WEB_RESTORED'
            assert current == active
            assert json.loads((release / 'web.override.json').read_text())['services']['web']['image'] == 'sha256:old-web-id'
        else:
            assert report['status'] == 'WEB_DEPLOY_SUCCESS'
            assert report['api_container_unchanged'] and report['database_unchanged']
            assert current['web_commit'] == 'fake-commit'
        updates = [args for args in calls if 'up' in args]
        assert updates and all(args[-1] == 'web' and '--no-deps' in args and '--no-build' in args for args in updates)
        assert all('down' not in args and 'stop' not in args for args in calls)


scenario(False)
scenario(True)
print('WEB_ONLY_SUCCESS_AND_ROLLBACK_CHECKS_PASSED')
