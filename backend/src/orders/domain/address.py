# [domain] 배송지: 입력값 검증과 기본 배송지 규칙
import re
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from orders.domain.exceptions import AddressAccessDenied, AddressLimitExceeded, InvalidAddressValue

# 규칙: 한 사람이 저장할 수 있는 배송지는 최대 10개 (프론트 addressDraft.ts의 MAX_ADDRESSES와 같다).
MAX_ADDRESSES = 10

# 칸별 최대 글자 수. 배송지명 20자는 프론트 입력칸과 같고, 나머지는 서버가 정한 넉넉한 상한이다.
MAX_LABEL = 20
MAX_NAME = 50
MAX_ADDRESS = 200

# 규칙: 휴대폰 번호는 숫자만 남겼을 때 01로 시작하는 10~11자리, 우편번호는 숫자 5자리 (프론트 검증과 같다).
_PHONE = re.compile(r"01\d{8,9}")
_POSTAL_CODE = re.compile(r"\d{5}")


def _required(value: str, field: str, max_length: int) -> str:
    """필수 칸: 앞뒤 공백을 지우고, 비었거나 너무 길면 막는다."""
    value = (value or "").strip()
    if not value:
        raise InvalidAddressValue(f"{field}을(를) 입력해주세요.")
    if len(value) > max_length:
        raise InvalidAddressValue(f"{field}은(는) {max_length}자 이하로 입력해주세요.")
    return value


def _optional(value: str | None, field: str, max_length: int) -> str | None:
    """선택 칸: 공백뿐이면 '입력 안 함(None)'으로 저장한다."""
    value = (value or "").strip()
    if not value:
        return None
    if len(value) > max_length:
        raise InvalidAddressValue(f"{field}은(는) {max_length}자 이하로 입력해주세요.")
    return value


@dataclass(frozen=True)
class AddressInput:
    """사용자가 입력한 배송지 내용. 만들 때 값을 정리하고 검사한다."""

    recipient_name: str
    recipient_phone: str
    postal_code: str
    address1: str
    address2: str | None = None
    label: str | None = None

    def __post_init__(self) -> None:
        self._set("recipient_name", _required(self.recipient_name, "받는 분 이름", MAX_NAME))
        self._set("address1", _required(self.address1, "기본 주소", MAX_ADDRESS))
        self._set("address2", _optional(self.address2, "상세 주소", MAX_ADDRESS))
        self._set("label", _optional(self.label, "배송지명", MAX_LABEL))

        # 연락처는 하이픈·공백을 빼고 비교하되, 저장은 사용자가 입력한 모양(앞뒤 공백만 제거)을 유지한다.
        phone = (self.recipient_phone or "").strip()
        if not _PHONE.fullmatch(re.sub(r"\D", "", phone)) or len(phone) > 20:
            raise InvalidAddressValue("휴대폰 번호를 정확히 입력해주세요.")
        self._set("recipient_phone", phone)

        postal_code = (self.postal_code or "").strip()
        if not _POSTAL_CODE.fullmatch(postal_code):
            raise InvalidAddressValue("우편번호 5자리를 입력해주세요.")
        self._set("postal_code", postal_code)

    def _set(self, name: str, value: str | None) -> None:
        # 값이 바뀌지 않는(frozen) 객체라서, 만들 때 정리한 값만 이 방법으로 넣는다.
        object.__setattr__(self, name, value)


@dataclass
class Address:
    """저장된 배송지 한 건."""

    id: int
    user_id: UUID
    content: AddressInput
    is_default: bool
    created_at: datetime

    def ensure_owned_by(self, user_id: UUID) -> None:
        """규칙: 배송지는 등록한 본인만 보고·고치고·지울 수 있다."""
        if self.user_id != user_id:
            raise AddressAccessDenied("다른 사람의 배송지예요.")


def ensure_can_add(existing_count: int) -> None:
    """규칙: 이미 최대 개수만큼 저장했다면 더 추가할 수 없다."""
    if existing_count >= MAX_ADDRESSES:
        raise AddressLimitExceeded(f"배송지는 최대 {MAX_ADDRESSES}개까지 저장할 수 있어요.")


def is_default_on_create(existing_count: int, requested: bool) -> bool:
    """새 배송지를 기본으로 둘지 정한다.

    규칙: 첫 배송지는 요청과 상관없이 기본 배송지가 된다 (기본 배송지가 0개가 되지 않게).
    두 번째부터는 사용자가 기본으로 요청했을 때만 기본이 된다.
    """
    return existing_count == 0 or requested


def pick_next_default(remaining: list[Address]) -> Address | None:
    """기본 배송지를 지운 뒤 새 기본 배송지를 고른다.

    규칙: 남은 배송지 중 가장 최근에 등록한 것 (같은 시각이면 번호가 큰 것). 남은 게 없으면 None.
    """
    if not remaining:
        return None
    return max(remaining, key=lambda address: (address.created_at, address.id))
