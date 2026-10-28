import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readOrderHistory } from '../src/services/orderHistory.ts';

for (const count of [0, 1, 100, 101, 250]) {
  test(`주문 ${count}건을 오래된 내역까지 순서대로 읽는다`, async () => {
    const rows = Array.from({ length: count }, (_, id) => ({ id, status: id >= 100 ? 'cancelled' : 'paid' }));
    const calls: number[] = [];
    const result = await readOrderHistory(async (page, size) => {
      assert.equal(size, 100);
      calls.push(page);
      return { items: rows.slice((page - 1) * size, page * size), total: count };
    });
    assert.deepEqual(result, rows);
    assert.equal(calls.length, Math.max(1, Math.ceil(count / 100)));
    assert.equal(result.filter((row) => row.status === 'cancelled').length, Math.max(0, count - 100));
  });
}

test('뒤 페이지 조회 실패를 일부 주문 목록으로 숨기지 않는다', async () => {
  await assert.rejects(readOrderHistory(async (page) => {
    if (page === 2) throw new Error('API unavailable');
    return { items: Array.from({ length: 100 }, (_, id) => id), total: 101 };
  }), /API unavailable/);
});

test('조회 중 마지막 페이지가 비면 더 요청하지 않는다', async () => {
  const calls: number[] = [];
  const result = await readOrderHistory(async (page) => {
    calls.push(page);
    return { items: page === 1 ? Array.from({ length: 100 }, (_, id) => id) : [], total: 101 };
  });
  assert.equal(result.length, 100);
  assert.deepEqual(calls, [1, 2]);
});
