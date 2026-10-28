import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assetUrl, isApiImage, productDetail, productRange, productSummary, type ApiProduct } from '../src/services/catalogMapping.ts';

const origin = 'http://localhost:8000';
const row: ApiProduct = {
  id: 1, name: '한정 앨범', price: 100, status: 'on_sale', is_sold_out: true,
  thumbnail_path: '/static/products/main.webp', created_at: '2026-10-27T00:00:00Z',
  is_limited: true, is_preorder: false, release_date: null,
  artist: { slug: 'alpha', name: 'ALPHA', name_ko: '알파' }, category: { slug: 'album', name: '앨범' },
};

test('상품 응답: snake_case·계산된 품절·이미지 경로를 화면 형식으로 변환', () => {
  const result = productSummary(row, origin);
  assert.equal(result.isSoldOut, true);
  assert.equal(result.status, 'on_sale');
  assert.equal(result.thumbnailUrl, origin + row.thumbnail_path);
  assert.equal(result.artist.nameKo, '알파');
  assert.equal(result.isLimited, true);
  assert.equal(result.releaseDate, null);
  assert.equal(assetUrl(null, origin), null);
  assert.equal(assetUrl('https://images.example/main.webp', origin), 'https://images.example/main.webp');
  assert.equal(isApiImage(origin + '/uploads/products/new.webp', origin), true);
  assert.equal(isApiImage('http://other.example/static/a.webp', origin), false);
});

test('상세: 옵션의 추가금·최종 가격·무제한 구매 제한과 이미지 순서 보존', () => {
  const result = productDetail({ ...row, description: '상세', has_options: true,
    gallery_paths: ['/static/first.webp', '/static/second.webp'], detail_paths: ['/static/long.webp'],
    variants: [{ id: 2, option_name: 'A', extra_price: 25, price: 125, stock: 0, max_per_user: null, is_sold_out: true }],
  }, origin);
  assert.deepEqual(result.galleryUrls, [origin + '/static/first.webp', origin + '/static/second.webp']);
  assert.deepEqual(result.imageUrls, result.detailUrls);
  assert.deepEqual(result.variants[0], { id: 2, optionName: 'A', extraPrice: 25, price: 125, stock: 0, maxPerUser: null, isSoldOut: true });
});

for (const [offset, limit, pageSize, firstPage] of [[0, 20, 20, 1], [0, 500, 100, 1], [95, 25, 25, 4], [200, 100, 100, 3], [380, 25, 25, 16], [500, 20, 20, 26]]) {
  test(`더 보기와 비정렬 구간: offset=${offset}, limit=${limit}`, async () => {
    const rows = Array.from({ length: 387 }, (_, index) => ({ ...row, id: index + 1 }));
    const calls: number[] = [];
    const result = await productRange(async (page, size) => {
      assert.equal(size, pageSize);
      calls.push(page);
      return { items: rows.slice((page - 1) * size, page * size), total: rows.length, page, size };
    }, origin, offset, limit);
    assert.equal(result.total, 387);
    assert.deepEqual(result.items.map((p) => p.id), rows.slice(offset, offset + limit).map((p) => p.id));
    assert.equal(new Set(result.items.map((p) => p.id)).size, result.items.length);
    assert.equal(calls[0], firstPage);
    assert.ok(calls.length <= 5);
  });
}

test('조회 실패를 예비 데이터로 바꾸지 않고 전달', async () => {
  await assert.rejects(productRange(async () => { throw new Error('API failed'); }, origin), /API failed/);
  for (const [offset, limit] of [[-1, 20], [0, 0], [0, 501], [0.5, 20]]) {
    await assert.rejects(productRange(async () => { throw new Error('must not call'); }, origin, offset, limit), RangeError);
  }
});
