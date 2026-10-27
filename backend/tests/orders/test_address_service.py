# [test] 배송지 서비스: 기본 배송지 흐름·본인 확인·commit/rollback (가짜 저장소, DB 없음)
import asyncio
from uuid import uuid4

import pytest

from orders.application.address_service import AddressService
from orders.domain.address import MAX_ADDRESSES, AddressInput
from orders.domain.exceptions import AddressAccessDenied, AddressLimitExceeded, AddressNotFound

ME = uuid4()
OTHER = uuid4()


def content(name: str = "김여름") -> AddressInput:
    return AddressInput(recipient_name=name, recipient_phone="010-1234-5678",
                        postal_code="06236", address1="서울 강남구 테헤란로 1")


@pytest.fixture
def service(address_repo, address_tx):
    return AddressService(address_repo, address_tx), address_tx


def defaults(repo, user_id=ME):
    return [a.id for a in repo.saved.values() if a.user_id == user_id and a.is_default]


# ---------- 생성 ----------

def test_first_address_becomes_default_even_if_not_requested(service, address_repo):
    svc, tx = service
    created = asyncio.run(svc.create(ME, content(), make_default=False))
    assert created.is_default and tx.commits == 1
    assert address_repo.locked_users == [ME]


def test_second_address_is_not_default_unless_requested(service, address_repo):
    svc, _ = service
    first = asyncio.run(svc.create(ME, content(), make_default=False))
    asyncio.run(svc.create(ME, content("둘째"), make_default=False))
    assert defaults(address_repo) == [first.id]


def test_new_default_replaces_old_default(service, address_repo):
    svc, _ = service
    asyncio.run(svc.create(ME, content(), make_default=False))
    second = asyncio.run(svc.create(ME, content("둘째"), make_default=True))
    assert defaults(address_repo) == [second.id]


def test_cannot_add_over_limit_and_rolls_back(service, address_repo):
    svc, tx = service
    for i in range(MAX_ADDRESSES):
        address_repo.seed(ME, content(f"이름{i}"), is_default=(i == 0))
    with pytest.raises(AddressLimitExceeded):
        asyncio.run(svc.create(ME, content("초과"), make_default=False))
    assert tx.rollbacks == 1 and len(address_repo.saved) == MAX_ADDRESSES


# ---------- 조회 ----------

def test_list_shows_only_my_addresses_default_first(service, address_repo):
    svc, _ = service
    address_repo.seed(ME, content("기본"), is_default=True)
    address_repo.seed(ME, content("최근"))
    address_repo.seed(OTHER, content("남의 것"), is_default=True)
    items, total = asyncio.run(svc.list(ME, None, 1, 20))
    assert total == 2
    assert [a.content.recipient_name for a in items] == ["기본", "최근"]


def test_get_missing_address_is_not_found(service):
    svc, _ = service
    with pytest.raises(AddressNotFound):
        asyncio.run(svc.get(ME, 999))


def test_get_other_users_address_is_denied(service, address_repo):
    svc, _ = service
    theirs = address_repo.seed(OTHER, content(), is_default=True)
    with pytest.raises(AddressAccessDenied):
        asyncio.run(svc.get(ME, theirs.id))


# ---------- 수정 ----------

def test_update_changes_content(service, address_repo):
    svc, tx = service
    mine = address_repo.seed(ME, content(), is_default=True)
    updated = asyncio.run(svc.update(ME, mine.id, content("새 이름"), make_default=False))
    assert updated.content.recipient_name == "새 이름" and tx.commits == 1


def test_update_with_default_false_keeps_default(service, address_repo):
    svc, _ = service
    mine = address_repo.seed(ME, content(), is_default=True)
    asyncio.run(svc.update(ME, mine.id, content(), make_default=False))
    assert defaults(address_repo) == [mine.id]


def test_update_with_default_true_moves_default(service, address_repo):
    svc, _ = service
    address_repo.seed(ME, content(), is_default=True)
    other = address_repo.seed(ME, content("둘째"))
    asyncio.run(svc.update(ME, other.id, content("둘째"), make_default=True))
    assert defaults(address_repo) == [other.id]


def test_update_other_users_address_is_denied_and_rolled_back(service, address_repo):
    svc, tx = service
    theirs = address_repo.seed(OTHER, content("원래"), is_default=True)
    with pytest.raises(AddressAccessDenied):
        asyncio.run(svc.update(ME, theirs.id, content("바꿈"), make_default=False))
    assert tx.rollbacks == 1 and address_repo.saved[theirs.id].content.recipient_name == "원래"


# ---------- 삭제 ----------

def test_deleting_default_promotes_latest_remaining(service, address_repo):
    svc, _ = service
    first = address_repo.seed(ME, content(), is_default=True)
    address_repo.seed(ME, content("둘째"))
    latest = address_repo.seed(ME, content("셋째"))
    asyncio.run(svc.delete(ME, first.id))
    assert first.id not in address_repo.saved
    assert defaults(address_repo) == [latest.id]


def test_deleting_non_default_keeps_default(service, address_repo):
    svc, _ = service
    first = address_repo.seed(ME, content(), is_default=True)
    second = address_repo.seed(ME, content("둘째"))
    asyncio.run(svc.delete(ME, second.id))
    assert defaults(address_repo) == [first.id]


def test_deleting_last_address_leaves_none(service, address_repo):
    svc, tx = service
    only = address_repo.seed(ME, content(), is_default=True)
    asyncio.run(svc.delete(ME, only.id))
    assert address_repo.saved == {} and tx.commits == 1


def test_delete_other_users_address_is_denied(service, address_repo):
    svc, tx = service
    theirs = address_repo.seed(OTHER, content(), is_default=True)
    with pytest.raises(AddressAccessDenied):
        asyncio.run(svc.delete(ME, theirs.id))
    assert theirs.id in address_repo.saved and tx.rollbacks == 1


# ---------- 기본 지정 ----------

def test_set_default_moves_default(service, address_repo):
    svc, _ = service
    address_repo.seed(ME, content(), is_default=True)
    other = address_repo.seed(ME, content("둘째"))
    asyncio.run(svc.set_default(ME, other.id))
    assert defaults(address_repo) == [other.id]


def test_set_default_on_missing_address_rolls_back(service, address_repo):
    svc, tx = service
    first = address_repo.seed(ME, content(), is_default=True)
    with pytest.raises(AddressNotFound):
        asyncio.run(svc.set_default(ME, 999))
    assert defaults(address_repo) == [first.id] and tx.rollbacks == 1
