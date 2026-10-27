# [test] 배송지 입력 검증·기본 배송지 규칙 단위 테스트 (DB 없이 순수 도메인만 검증)
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from orders.domain.address import (
    MAX_ADDRESSES,
    Address,
    AddressInput,
    ensure_can_add,
    is_default_on_create,
    pick_next_default,
)
from orders.domain.exceptions import AddressAccessDenied, AddressLimitExceeded, InvalidAddressValue

NOW = datetime(2026, 10, 26, 12, 0, tzinfo=timezone.utc)
OWNER_ID = uuid4()


def make_input(**overrides) -> AddressInput:
    values = {"recipient_name": "김여름", "recipient_phone": "010-1234-5678",
              "postal_code": "06236", "address1": "서울 강남구 테헤란로 1"}
    values.update(overrides)
    return AddressInput(**values)


def make_address(address_id: int, minutes: int = 0, is_default: bool = False) -> Address:
    return Address(id=address_id, user_id=OWNER_ID, content=make_input(), is_default=is_default,
                   created_at=NOW + timedelta(minutes=minutes))


# ---------- 입력값 ----------

def test_input_trims_values_and_blank_optional_becomes_none():
    content = make_input(recipient_name="  김여름 ", address2="   ", label=" 집 ")
    assert content.recipient_name == "김여름"
    assert content.address2 is None
    assert content.label == "집"


@pytest.mark.parametrize("phone", ["01012345678", "010-1234-5678", "011-123-4567"])
def test_valid_phone_formats(phone):
    assert make_input(recipient_phone=phone).recipient_phone == phone


@pytest.mark.parametrize("overrides", [
    {"recipient_name": "   "},
    {"recipient_name": "가" * 51},
    {"recipient_phone": "02-123-4567"},  # 휴대폰 번호가 아님
    {"recipient_phone": "010-1234"},  # 자릿수 부족
    {"postal_code": "1234"},
    {"postal_code": "1234a"},
    {"address1": ""},
    {"address2": "가" * 201},
    {"label": "가" * 21},
], ids=["blank-name", "long-name", "landline", "short-phone", "short-postal", "postal-letter",
        "empty-address1", "long-address2", "long-label"])
def test_bad_input_is_rejected(overrides):
    with pytest.raises(InvalidAddressValue):
        make_input(**overrides)


# ---------- 본인 확인 ----------

def test_owner_can_access_own_address():
    make_address(1).ensure_owned_by(OWNER_ID)


def test_other_user_cannot_access_address():
    with pytest.raises(AddressAccessDenied) as error:
        make_address(1).ensure_owned_by(uuid4())
    assert error.value.code == "UNKNOWN"


# ---------- 기본 배송지 ----------

def test_first_address_is_always_default():
    assert is_default_on_create(existing_count=0, requested=False) is True


def test_later_address_is_default_only_when_requested():
    assert is_default_on_create(existing_count=2, requested=False) is False
    assert is_default_on_create(existing_count=2, requested=True) is True


def test_next_default_is_latest_remaining_address():
    older, newer = make_address(1, minutes=0), make_address(2, minutes=5)
    assert pick_next_default([newer, older]) is newer


def test_next_default_breaks_same_time_by_larger_id():
    first, second = make_address(3), make_address(4)
    assert pick_next_default([first, second]) is second


def test_no_next_default_when_nothing_remains():
    assert pick_next_default([]) is None


# ---------- 개수 제한 ----------

def test_can_add_until_limit():
    ensure_can_add(MAX_ADDRESSES - 1)


def test_cannot_add_over_limit():
    with pytest.raises(AddressLimitExceeded):
        ensure_can_add(MAX_ADDRESSES)
