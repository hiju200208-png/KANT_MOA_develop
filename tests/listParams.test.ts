import assert from "node:assert/strict";
import { test } from "node:test";
import { buildListHref, parseLimit, parseSort, PAGE_SIZE } from "../src/components/product/listParams.ts";
import { formatPrice } from "../src/lib/formatPrice.ts";

test("정렬: 허용된 값만 받고 나머지는 최신순", () => {
  assert.equal(parseSort({ sort: "price_asc" }), "price_asc");
  assert.equal(parseSort({ sort: ["price_desc", "latest"] }), "price_desc");
  assert.equal(parseSort({ sort: "drop table" }), "latest");
  assert.equal(parseSort({}), "latest");
});

test("더보기 개수: 기본 20, 최대 500으로 제한 (전체 상품 목록을 끝까지 볼 수 있게)", () => {
  assert.equal(parseLimit({}), PAGE_SIZE);
  assert.equal(parseLimit({ limit: "40" }), 40);
  assert.equal(parseLimit({ limit: "5" }), PAGE_SIZE);
  assert.equal(parseLimit({ limit: "abc" }), PAGE_SIZE);
  assert.equal(parseLimit({ limit: "100000" }), 500);
});

test("목록 주소: 기본값은 생략, 기존 쿼리에는 이어 붙임", () => {
  assert.equal(buildListHref("/artists/bts", "latest"), "/artists/bts");
  assert.equal(buildListHref("/artists/bts", "price_asc", 40), "/artists/bts?sort=price_asc&limit=40");
  assert.equal(buildListHref("/artists/bts?category=album", "price_desc"), "/artists/bts?category=album&sort=price_desc");
});

test("가격 표시", () => {
  assert.equal(formatPrice(12000), "12,000원");
  assert.equal(formatPrice(0), "0원");
});
