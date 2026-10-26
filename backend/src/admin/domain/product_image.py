"""관리자 상품 대표 이미지 업로드 규칙 (순수 Python). #39 선택 기능.

- 허용 형식: JPEG·PNG·WebP. 요청 Content-Type과 파일 앞부분(매직 바이트)이 모두 맞아야 한다.
- 크기: 1바이트 이상 5MB 이하
- 저장 이름은 서버가 새로 만든다(원본 파일명 사용 안 함). 이미지 교체도 항상 새 파일명 (캐시 문제 방지)
"""

from dataclasses import dataclass

from admin.domain.stock_adjustment import AdminDomainError

MAX_IMAGE_BYTES = 5 * 1024 * 1024

_FORMATS = {
    "image/jpeg": ("jpg", (b"\xff\xd8\xff",)),
    "image/png": ("png", (b"\x89PNG\r\n\x1a\n",)),
    "image/webp": ("webp", ()),  # RIFF....WEBP 는 아래에서 따로 검사
}


class InvalidImage(AdminDomainError):
    """형식·크기 위반 → 422."""

    message = "JPG·PNG·WebP 이미지(5MB 이하)만 올릴 수 있어요."


def _matches(content_type: str, data: bytes) -> bool:
    if content_type == "image/webp":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    return any(data.startswith(sig) for sig in _FORMATS[content_type][1])


@dataclass(frozen=True)
class ImageUpload:
    content_type: str
    data: bytes

    def __post_init__(self):
        content_type = (self.content_type or "").split(";")[0].strip().lower()
        if content_type == "image/jpg":
            content_type = "image/jpeg"
        if content_type not in _FORMATS:
            raise InvalidImage()
        if not 0 < len(self.data) <= MAX_IMAGE_BYTES:
            raise InvalidImage()
        if not _matches(content_type, self.data):
            raise InvalidImage()
        object.__setattr__(self, "content_type", content_type)

    @property
    def extension(self) -> str:
        return _FORMATS[self.content_type][0]
