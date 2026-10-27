import { SearchIcon } from "@/components/layout/Icons";

// 상품 검색창. /search?q=검색어 로 이동 (자바스크립트 없이도 동작하는 GET 폼)
export function SearchForm({ defaultValue = "", autoFocus = false }: { defaultValue?: string; autoFocus?: boolean }) {
  return (
    <form action="/search" role="search" className="relative">
      <label htmlFor="product-search" className="sr-only">상품 검색</label>
      <input
        id="product-search"
        name="q"
        type="search"
        maxLength={100}
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder="상품명이나 아티스트로 검색"
        className="h-12 w-full rounded-full border border-line bg-white pr-14 pl-5 text-base outline-none focus:border-foreground"
      />
      <button type="submit" aria-label="검색" className="absolute top-1 right-1 grid size-10 place-items-center rounded-full bg-foreground text-white">
        <SearchIcon />
      </button>
    </form>
  );
}
