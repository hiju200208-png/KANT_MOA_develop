import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { HERO_VIDEOS } from '../src/components/home/heroVideos.ts';

const manifest = JSON.parse(readFileSync(new URL('../docs/products/P2_HERO_VIDEO_ASSETS.json', import.meta.url), 'utf8'));
type Box = { type: string; start: number; data: number; end: number };
function boxes(buffer: Buffer, start = 0, end = buffer.length): Box[] {
  const result: Box[] = [];
  while (start + 8 <= end) {
    let size = buffer.readUInt32BE(start);
    const header = size === 1 ? 16 : 8;
    if (size === 1) size = Number(buffer.readBigUInt64BE(start + 8));
    if (size === 0) size = end - start;
    assert(size >= header && start + size <= end, 'Invalid MP4 box');
    result.push({ type: buffer.toString('ascii', start + 4, start + 8), start, data: start + header, end: start + size });
    start += size;
  }
  return result;
}
function child(buffer: Buffer, parent: Box, type: string): Box {
  const box = boxes(buffer, parent.data, parent.end).find((box) => box.type === type);
  assert(box, `Missing ${type}`);
  return box;
}
function movieDuration(buffer: Buffer, moov: Box): number {
  const mvhd = child(buffer, moov, 'mvhd');
  const version = buffer[mvhd.data];
  const offset = mvhd.data + (version === 1 ? 20 : 12);
  const ticks = version === 1 ? Number(buffer.readBigUInt64BE(offset + 4)) : buffer.readUInt32BE(offset + 4);
  return ticks / buffer.readUInt32BE(offset);
}

for (const asset of manifest.assets) {
  test(`hero ${asset.original}: original retained; lightweight H264/AAC, faststart and duration valid`, () => {
    const original = readFileSync(new URL(`../public/sources/${asset.original}`, import.meta.url));
    const video = readFileSync(new URL(`../public/sources/${asset.file}`, import.meta.url));
    const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex');
    assert.equal(digest(original), asset.original_sha256);
    assert.equal(digest(video), asset.sha256);
    assert.equal(video.length, asset.bytes);
    assert(video.length < original.length * 0.4, 'Expected at least 60% reduction');
    const top = boxes(video);
    const moov = top.find((box) => box.type === 'moov')!;
    assert(moov.start < top.find((box) => box.type === 'mdat')!.start, 'Metadata must precede media');
    const originalMoov = boxes(original).find((box) => box.type === 'moov')!;
    assert(Math.abs(movieDuration(video, moov) - movieDuration(original, originalMoov)) < 0.1);
    assert(video.length * 8 / movieDuration(video, moov) < 450000, 'Total average bitrate exceeds banner budget');
    const formats = boxes(video, moov.data, moov.end).filter((box) => box.type === 'trak').map((track) => {
      const mdia = child(video, track, 'mdia');
      const stsd = child(video, child(video, child(video, mdia, 'minf'), 'stbl'), 'stsd');
      const entry = stsd.data + 8;
      const format = video.toString('ascii', entry + 4, entry + 8);
      if (format === 'avc1') {
        assert.equal(video.readUInt16BE(entry + 32), 960);
        assert.equal(video.readUInt16BE(entry + 34), 540);
      }
      return format;
    });
    assert(formats.includes('avc1') && formats.includes('mp4a'), 'Video and audio must both survive');
    const slug = asset.original.replace('.mp4', '');
    assert.equal(HERO_VIDEOS[slug].src, '/sources/' + asset.file);
  });
}
