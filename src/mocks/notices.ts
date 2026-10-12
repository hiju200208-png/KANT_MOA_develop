// TODO(mock): #이슈번호 — 공지사항 테이블과 services 함수(getArtistNotices)가 생기면 이 파일을 지우고 교체
// 아티스트 페이지 Notice 영역 화면 확인용 임시 데이터입니다.

export type Notice = {
  id: number;
  artistSlug: string;
  title: string;
  publishedAt: string; // YYYY-MM-DD
  isNew: boolean;
};

const NOTICES: Notice[] = [
  { id: 1, artistSlug: "orbit-on", title: "[ORBIT:ON] 마스코트 인형 키링 판매 안내 (1인 2개 한정)", publishedAt: "2026-10-12", isNew: true },
  { id: 2, artistSlug: "orbit-on", title: "[ORBIT:ON] 공식 멤버십 카드 발송 일정 안내", publishedAt: "2026-10-10", isNew: true },
  { id: 3, artistSlug: "orbit-on", title: "[ORBIT:ON] 아크릴 키링 판매 종료 안내", publishedAt: "2026-10-08", isNew: false },
  { id: 4, artistSlug: "orbit-on", title: "[ORBIT:ON] 1st Mini Album 예약 판매 안내", publishedAt: "2026-10-01", isNew: false },
  { id: 5, artistSlug: "daylog", title: "[DAYLOG] 2nd Single 다이어리 예약 판매 안내", publishedAt: "2026-10-09", isNew: true },
  { id: 6, artistSlug: "daylog", title: "[DAYLOG] 멤버 인형 재입고 안내", publishedAt: "2026-10-04", isNew: false },
  { id: 7, artistSlug: "daylog", title: "[DAYLOG] 공식 멤버십 혜택 안내", publishedAt: "2026-09-28", isNew: false },
  { id: 8, artistSlug: "sodafm", title: "[SODAFM] 컬러 텀블러 판매 안내", publishedAt: "2026-10-11", isNew: true },
  { id: 9, artistSlug: "sodafm", title: "[SODAFM] 슬로건 타월 배송 지연 안내", publishedAt: "2026-10-05", isNew: false },
  { id: 10, artistSlug: "sodafm", title: "[SODAFM] 공식 멤버십 카드 발송 안내", publishedAt: "2026-09-30", isNew: false },
];

export function getArtistNotices(artistSlug: string, limit = 4): Notice[] {
  return NOTICES.filter((notice) => notice.artistSlug === artistSlug)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}
