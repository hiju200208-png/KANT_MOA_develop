import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextShippingStatus, type ShippingStatus } from '../src/services/shippingActions.ts';

for (const [payment, shipping, expected] of [
  ['paid', 'preparing', 'shipped'], ['paid', 'shipped', 'delivered'], ['paid', 'delivered', null],
  ['pending', 'preparing', null], ['cancelled', 'shipped', null],
] as const) {
  test(`배송 버튼: ${payment}/${shipping}`, () => {
    assert.equal(nextShippingStatus(payment, shipping as ShippingStatus), expected);
  });
}
