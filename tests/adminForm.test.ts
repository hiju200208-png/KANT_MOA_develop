import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PRODUCT_QUERY_DEFAULTS,
  checkImageFile,
  filtersFromQuery,
  toggleSelected,
  validateLogin,
  emptyNoticeForm,
  parseStockChange,
  previewStock,
  stockLevel,
  toNoticeInput,
  toQueryString,
  validateNoticeForm,
} from "../src/services/admin/adminForm.ts";

test("관리자 목록 쿼리: 빈 값·기본값은 빼고 만든다", () => {
  assert.equal(toQueryString({ q: "", artist: "", sort: "latest", page: 1, size: 20 }, PRODUCT_QUERY_DEFAULTS), "");
  assert.equal(
    toQueryString({ q: " 응원봉 ", status: "hidden", sort: "stock_asc", page: 2, size: 20 }, PRODUCT_QUERY_DEFAULTS),
    "?q=%EC%9D%91%EC%9B%90%EB%B4%89&status=hidden&sort=stock_asc&page=2",
  );
});

test("재고 증감 입력: 부호 있는 정수만, 0·범위 초과 거절", () => {
  assert.deepEqual(parseStockChange("+10"), { value: 10 });
  assert.deepEqual(parseStockChange(" -3 "), { value: -3 });
  for (const bad of ["0", "1.5", "abc", "", "10001", "-10001"]) assert.ok("error" in parseStockChange(bad), bad);
});

test("재고 미리보기와 단계", () => {
  assert.deepEqual(previewStock(37, -40), { after: -3, ok: false });
  assert.deepEqual(previewStock(37, 10), { after: 47, ok: true });
  assert.equal(stockLevel(0, false), "out");
  assert.equal(stockLevel(8, true), "out"); // 직접 품절 처리
  assert.equal(stockLevel(5, false), "low");
  assert.equal(stockLevel(6, false), "ok");
});

test("공지 폼 검사와 요청 변환", () => {
  const empty = emptyNoticeForm();
  assert.deepEqual(Object.keys(validateNoticeForm(empty)), ["title"]);
  const errors = validateNoticeForm({ ...empty, title: "t", artistSlug: "BTS!", productId: "0" });
  assert.deepEqual(Object.keys(errors).sort(), ["artistSlug", "productId"]);
  assert.deepEqual(toNoticeInput({ ...empty, title: " 안내 ", body: "  ", artistSlug: " bts ", productId: "12", isPinned: true }), {
    title: "안내", body: null, artist_slug: "bts", product_id: 12, is_pinned: true, show_in_topbar: false,
  });
});

test("대표 이미지 파일 검사: 형식·크기", () => {
  assert.equal(checkImageFile({ type: "image/png", size: 1000 }), null);
  assert.equal(checkImageFile({ type: "image/webp", size: 5 * 1024 * 1024 }), null);
  assert.ok(checkImageFile({ type: "image/gif", size: 1000 }));
  assert.ok(checkImageFile({ type: "image/jpeg", size: 0 }));
  assert.ok(checkImageFile({ type: "image/jpeg", size: 5 * 1024 * 1024 + 1 }));
});

test("대시보드 카드 쿼리 → 목록 필터 (잘못된 값은 무시)", () => {
  const q = (o: Record<string, string>) => (k: string) => o[k] ?? null;
  assert.deepEqual(filtersFromQuery(q({ status: "hidden", stock: "low", sort: "stock_asc" })), {
    q: "", artist: "", status: "hidden", stock: "low", sort: "stock_asc",
  });
  assert.deepEqual(filtersFromQuery(q({ status: "deleted", stock: "many", sort: "price" })), {
    q: "", artist: "", status: "", stock: "", sort: "latest",
  });
});

test("일괄 선택 토글과 로그인 입력 검사", () => {
  const a = toggleSelected(new Set([1]), 2);
  assert.deepEqual([...a].sort(), [1, 2]);
  assert.deepEqual([...toggleSelected(a, 1)], [2]);
  assert.equal(validateLogin("admin@kantmoa.dev", "pw"), null);
  assert.ok(validateLogin("admin", "pw"));
  assert.ok(validateLogin("admin@kantmoa.dev", ""));
});
