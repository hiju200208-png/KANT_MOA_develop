"""Check the public Supabase URL for the preserved original TWS video, without keys.

Usage: python scripts/check-tws-storage.py --url https://PROJECT.supabase.co/storage/v1/object/public/BUCKET/FILE.mp4
"""
import argparse
import hashlib
import json
from pathlib import Path
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    args = parser.parse_args()
    url = urllib.parse.urlsplit(args.url)
    assert url.scheme == 'https' and (url.hostname or '').endswith('.supabase.co')
    assert url.path.startswith('/storage/v1/object/public/') and url.path.endswith('.mp4')
    assert not url.username and not url.password and not url.query and not url.fragment, 'Use a public URL without tokens'
    original = (ROOT / 'public/sources/tws.mp4').read_bytes()
    expected = hashlib.sha256(original).hexdigest()
    headers = {'Accept-Encoding': 'identity'}
    request = urllib.request.Request(args.url, headers={**headers, 'Range': 'bytes=0-1023'})
    with urllib.request.urlopen(request, timeout=30) as response:
        assert response.status == 206, 'Partial download unavailable'
        assert response.headers.get_content_type() == 'video/mp4'
        assert response.read(1025) == original[:1024], 'Partial bytes differ from the original'
    samples = []
    for _ in range(2):
        start = time.monotonic()
        with urllib.request.urlopen(urllib.request.Request(args.url, headers=headers), timeout=40) as response:
            first_byte = time.monotonic() - start
            assert response.status == 200 and response.headers.get_content_type() == 'video/mp4'
            data = response.read(len(original) + 1)
            elapsed = time.monotonic() - start
            assert len(data) == len(original) and hashlib.sha256(data).hexdigest() == expected, 'Not the original TWS file'
            samples.append({'status': response.status, 'bytes': len(data),
                            'first_byte_seconds': round(first_byte, 3), 'download_seconds': round(elapsed, 3),
                            'average_mbps': round(len(data) * 8 / elapsed / 1000000, 3),
                            'cache_status': response.headers.get('cf-cache-status'), 'age': response.headers.get('age')})
    report = {'status': 'TWS_STORAGE_VERIFIED', 'url': args.url, 'sha256': expected,
              'range_status': 206, 'samples': samples,
              'note': 'Single-client download measurements; not playback-start time or a buffering guarantee.'}
    output = ROOT / 'backend/.venv/tws-storage-trial/storage-report.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
