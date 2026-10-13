import assert from "node:assert/strict";
import { test } from "node:test";
import { calcShippingFee } from "../src/lib/shipping.ts";

// 운영 설정과 같은 값: 5만 원 이상 무료, 그 미만 3,000원 (create_order와 같은 규칙)
const rule = { freeShippingThreshold: 50000, shippingFee: 3000 };

test("기준 금액 미만이면 배송비를 붙인다", () => {
  assert.equal(calcShippingFee(6000, rule), 3000);
  assert.equal(calcShippingFee(49999, rule), 3000);
});

test("기준 금액 이상이면 무료", () => {
  assert.equal(calcShippingFee(50000, rule), 0);
  assert.equal(calcShippingFee(59000, rule), 0);
});

test("담긴 상품이 없으면 배송비도 없다", () => {
  assert.equal(calcShippingFee(0, rule), 0);
});
