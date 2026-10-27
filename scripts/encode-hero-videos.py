"""Create two bandwidth-limited banner candidates without modifying original MP4s.

Usage: python scripts/encode-hero-videos.py --ffmpeg /path/to/ffmpeg
Outputs and pass logs are kept under the Git-ignored backend/.venv directory.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PROFILES = {'540p': (540, '300k', '350k'), '720p': (720, '380k', '430k')}
SOURCES = [ROOT / 'public/sources' / (name + '.mp4') for name in ['tws', 'cortis', 'le-sserafim']]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def encode(ffmpeg, output, source, profile):
    height, bitrate, peak = PROFILES[profile]
    target = output / f'{source.stem}-{profile}.mp4'
    assert target.resolve() != source.resolve() and not target.exists()
    common = [ffmpeg, '-hide_banner', '-nostdin', '-i', str(source), '-map', '0:v:0',
              '-vf', f'fps=24,scale=-2:{height}:flags=lanczos', '-c:v', 'libx264',
              '-preset', 'slow', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level:v', '3.1',
              '-b:v', bitrate, '-maxrate', peak, '-bufsize', peak, '-g', '48', '-keyint_min', '48',
              '-sc_threshold', '0', '-threads', '4', '-passlogfile', str(output / f'{source.stem}-{profile}-pass')]
    null = 'NUL' if os.name == 'nt' else '/dev/null'
    commands = [common + ['-pass', '1', '-an', '-f', 'null', null],
                common + ['-pass', '2', '-map', '0:a:0?', '-c:a', 'aac', '-b:a', '64k',
                          '-movflags', '+faststart', '-n', str(target)],
                [ffmpeg, '-hide_banner', '-v', 'error', '-i', str(target), '-f', 'null', null]]
    with (output / f'{source.stem}-{profile}.log').open('wb') as log:
        for command in commands:
            result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, timeout=300)
            if result.returncode: raise RuntimeError(f'Encoding/decoding failed: {source.name} {profile}; inspect local log')
    result = {'source': source.name, 'profile': profile, 'file': str(target),
              'bytes': target.stat().st_size, 'sha256': sha(target),
              'saved_percent': round(100 * (1 - target.stat().st_size / source.stat().st_size), 1),
              'commands': commands}
    print(json.dumps({k: v for k, v in result.items() if k != 'commands'}), flush=True)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ffmpeg', required=True)
    args = parser.parse_args()
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    output = ROOT / 'backend/.venv' / ('hero-encodes-' + stamp)
    output.mkdir(parents=True, exist_ok=False)
    before = {source.name: sha(source) for source in SOURCES}
    jobs = [(source, profile) for source in SOURCES for profile in PROFILES]
    print('Encoding candidates; original files retained: ' + str(output), flush=True)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda job: encode(args.ffmpeg, output, *job), jobs))
    assert before == {source.name: sha(source) for source in SOURCES}, 'Original video changed'
    manifest = {'original_sha256': before, 'original_unchanged': True, 'outputs': results}
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print('CANDIDATES_VERIFIED ' + str(output / 'manifest.json'), flush=True)


if __name__ == '__main__':
    main()
