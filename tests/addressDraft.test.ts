import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyDraft, formatPhone, orderAddressText, validateDraft } from "../src/components/address/addressDraft.ts";

const valid = { ...emptyDraft(), recipientName: "홍길동", recipientPhone: "010-1234-5678", postalCode: "06236", address1: "서울 강남구 테헤란로 1" };

test("배송지 검증: 올바른 입력은 오류 없음", () => {
  assert.deepEqual(validateDraft(valid), {});
});

test("배송지 검증: 필수값·형식 오류를 항목별로 알려준다", () => {
  const errors = validateDraft({ ...valid, recipientName: "  ", recipientPhone: "02-123-4567", postalCode: "1234", address1: "" });
  assert.deepEqual(Object.keys(errors).sort(), ["address1", "postalCode", "recipientName", "recipientPhone"]);
});

test("휴대폰 번호 자동 하이픈", () => {
  assert.equal(formatPhone("01012345678"), "010-1234-5678");
  assert.equal(formatPhone("0101234567"), "010-123-4567");
  assert.equal(formatPhone("010-12"), "010-12");
  assert.equal(formatPhone("010123456789999"), "010-1234-5678");
});

test("주문에 저장하는 주소 문자열", () => {
  assert.equal(orderAddressText({ address1: "서울 강남구 테헤란로 1", address2: "101호" }), "서울 강남구 테헤란로 1 101호");
  assert.equal(orderAddressText({ address1: "서울 강남구 테헤란로 1", address2: null }), "서울 강남구 테헤란로 1");
});
