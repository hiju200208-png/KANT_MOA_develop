// Regression check: a pending product API must not delay the first video banner.
// Only a local fake API is used; no database or deployed server is contacted.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artists = ['tws', 'bts'].map((slug, i) => ({ id: i + 1, slug, name: slug.toUpperCase(),
  name_ko: slug.toUpperCase(), logo_path: null, hero_image_path: null, theme_color: '#111111', tagline: null }));
const requests = [];
const pending = [];
let released = false;
let failProducts = false;
let stop = false;
const api = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  if (url.pathname === '/__release') {
    released = true;
    failProducts = url.searchParams.has('fail');
    pending.splice(0).forEach((respond) => respond());
    return send({ released: true });
  }
  if (url.pathname === '/__stop') { stop = true; return send({ stop: true }); }
  requests.push(url);
  if (url.pathname === '/artists') return send(artists);
  if (url.pathname === '/artists/like-counts') return send({ 1: 0, 2: 10 });
  if (url.pathname === '/notices/topbar' || url.pathname === '/shop-settings') return send(null);
  if (url.pathname === '/products' || url.pathname === '/products/best') {
    const respond = () => {
      if (failProducts) return send({ code: 'UNKNOWN', message: 'Local simulated failure' }, 503);
      if (url.pathname === '/products/best') return send([]);
      const slug = url.searchParams.get('artist');
      const artist = artists.find((row) => row.slug === slug) ?? artists[0];
      send({ items: [{ id: artist.id, name: `${artist.name} LOCAL PRODUCT`, price: 30000,
        status: 'on_sale', is_sold_out: false, thumbnail_path: null, artist,
        category: { slug: 'album', name: 'Album' }, is_limited: false, is_preorder: false,
        release_date: null, created_at: new Date().toISOString() }], total: 1, page: 1, size: 20 });
    };
    if (released) respond(); else pending.push(respond);
    return;
  }
  send([]);
});
await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve));
const apiOrigin = `http://127.0.0.1:${api.address().port}`;
const portProbe = createServer();
await new Promise((resolve) => portProbe.listen(0, '127.0.0.1', resolve));
const port = portProbe.address().port;
await new Promise((resolve) => portProbe.close(resolve));
const site = `http://127.0.0.1:${port}`;
const logPath = path.join(tmpdir(), `kant-hero-check-${process.pid}.log`);
const log = createWriteStream(logPath);
const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_API_URL: apiOrigin, API_INTERNAL_URL: apiOrigin },
  stdio: ['ignore', 'pipe', 'pipe'],
});
next.stdout.pipe(log); next.stderr.pipe(log);
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (next.exitCode !== null) throw new Error(`Next exited; inspect ${logPath}`);
    try { if ((await fetch(site + '/login', { signal: AbortSignal.timeout(1500) })).ok) { ready = true; break; } }
    catch { /* Startup/first compilation. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(ready, `Next did not start; inspect ${logPath}`);
  const response = await fetch(site, { signal: AbortSignal.timeout(120000) });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = '';
  while (!/<video\b[^>]*src="\/sources\/tws\.mp4"/.test(html)) {
    const chunk = await reader.read();
    assert(!chunk.done, 'Homepage ended without the initial video');
    html += decoder.decode(chunk.value, { stream: true });
  }
  assert.equal(released, false, 'Video must arrive while all product responses are held');
  assert(!html.includes('data-precedence="default"'), 'Font stylesheet must not suspend the banner');
  assert(requests.every((url) => !(url.pathname === '/products/best' && url.searchParams.get('artist') === 'tws')),
    'Video slides must not request best-product selection');
  console.log('PASS: initial video HTML arrived while product APIs were pending');
  console.log(JSON.stringify({ site, apiOrigin, logPath, waiting: process.argv.includes('--hold') }));
  if (process.argv.includes('--hold')) {
    const until = Date.now() + 600000;
    while (!released && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!released) await fetch(apiOrigin + '/__release' + (process.argv.includes('--fail-products') ? '?fail=1' : ''));
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    html += decoder.decode(chunk.value, { stream: true });
  }
  if (!failProducts) assert(html.includes('BTS LOCAL PRODUCT'), 'Deferred product data must still stream');
  console.log(failProducts ? 'PASS: product failure did not remove the video banner' : 'PASS: deferred product data streamed after release');
  if (process.argv.includes('--hold')) {
    console.log('READY_FOR_BROWSER: release completed; /__stop on the fake API finishes the check');
    const until = Date.now() + 600000;
    while (!stop && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 250));
  }
} finally {
  released = true;
  pending.splice(0).forEach((respond) => respond());
  const exited = once(next, 'exit');
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(next.pid), '/T', '/F'], { stdio: 'ignore' });
  else next.kill('SIGTERM');
  if (next.exitCode === null) await exited;
  api.closeAllConnections();
  await new Promise((resolve) => api.close(resolve));
  log.end();
}
