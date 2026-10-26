"""관리자 공지 규칙 (순수 Python).

- 제목: 앞뒤 공백 제거 후 1~100자
- 본문: 선택, 최대 5000자. 줄 단위로 화면에 표시된다 ("## " 섹션, "- " 목록 등 기존 화면 규칙 그대로)
- 아티스트: 선택 (없으면 전체 공지). 상품: 선택 (상세 하단 "상품 보러가기")
- 사용자 화면 노출(공개 공지 조회)은 P2 담당. P4는 관리자 등록·수정·삭제만 맡는다.
"""

from dataclasses import dataclass, field

from admin.domain.stock_adjustment import AdminDomainError

MAX_TITLE_LENGTH = 100
MAX_BODY_LENGTH = 5000


class NoticeNotFound(AdminDomainError):
    """없는 공지 → 404."""

    message = "공지를 찾을 수 없어요."


class InvalidNotice(AdminDomainError):
    """공지 입력 규칙 위반 → 422."""

    message = "공지 내용을 확인해주세요."


def normalize_title(title: str) -> str:
    if not isinstance(title, str):
        raise InvalidNotice("공지 제목을 확인해주세요.")
    title = title.strip()
    if not 1 <= len(title) <= MAX_TITLE_LENGTH:
        raise InvalidNotice(f"공지 제목은 1~{MAX_TITLE_LENGTH}자로 입력해주세요.")
    return title


def normalize_body(body: str | None) -> str | None:
    if body is None:
        return None
    if len(body) > MAX_BODY_LENGTH:
        raise InvalidNotice(f"공지 본문은 {MAX_BODY_LENGTH}자 이하로 입력해주세요.")
    body = body.replace("\r\n", "\n").strip()
    return body or None


@dataclass(frozen=True)
class NoticeDraft:
    """새 공지. 생성 시 규칙을 검사한다."""

    title: str
    body: str | None = None
    artist_slug: str | None = None
    product_id: int | None = None
    is_pinned: bool = False
    show_in_topbar: bool = False

    def __post_init__(self):
        object.__setattr__(self, "title", normalize_title(self.title))
        object.__setattr__(self, "body", normalize_body(self.body))


@dataclass(frozen=True)
class NoticeChanges:
    """수정할 필드만 담는다. fields에 없는 값은 그대로 둔다."""

    values: dict = field(default_factory=dict)

    ALLOWED = ("title", "body", "artist_slug", "product_id", "is_pinned", "show_in_topbar")

    def __post_init__(self):
        unknown = set(self.values) - set(self.ALLOWED)
        if unknown:
            raise InvalidNotice()
        if not self.values:
            raise InvalidNotice("바꿀 내용을 입력해주세요.")
        cleaned = dict(self.values)
        if "title" in cleaned:
            cleaned["title"] = normalize_title(cleaned["title"])
        if "body" in cleaned:
            cleaned["body"] = normalize_body(cleaned["body"])
        for flag in ("is_pinned", "show_in_topbar"):
            if flag in cleaned and not isinstance(cleaned[flag], bool):
                raise InvalidNotice()
        object.__setattr__(self, "values", cleaned)


@dataclass(frozen=True)
class AdminNoticeRow:
    id: int
    title: str
    body: str | None
    artist_slug: str | None
    artist_name: str | None
    product_id: int | None
    product_name: str | None
    is_pinned: bool
    show_in_topbar: bool
    published_at: object  # datetime
