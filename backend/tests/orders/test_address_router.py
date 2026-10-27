# [test] 배송지 API: 상태 코드(200·201·204·401·403·404·409·422)와 {code, message} 응답 형식 (가짜 저장소, DB 없음)
from dataclasses import dataclass
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from core.errors import register_error_handlers
from orders.application.address_service import AddressService
from orders.domain.address import MAX_ADDRESSES, AddressInput
from orders.presentation.address_router import router
from orders.presentation.dependencies import get_address_service, get_current_user

ME = uuid4()
OTHER = uuid4()

BODY = {"label": "집", "recipient_name": "김여름", "recipient_phone": "010-1234-5678",
        "postal_code": "06236", "address1": "서울 강남구 테헤란로 1", "address2": "101동"}


@dataclass
class FakeUser:
    id: UUID


def sample(name="김여름") -> AddressInput:
    return AddressInput(recipient_name=name, recipient_phone="010-1234-5678",
                        postal_code="06236", address1="서울 강남구 테헤란로 1")


@pytest.fixture
def app(address_repo, address_tx):
    app = FastAPI()
    register_error_handlers(app)
    app.include_router(router)
    app.dependency_overrides[get_address_service] = lambda: AddressService(address_repo, address_tx)
    return app


@pytest.fixture
def client(app):
    app.dependency_overrides[get_current_user] = lambda: FakeUser(ME)
    return TestClient(app)


# ---------- 정상 ----------

def test_create_returns_201_and_first_is_default(client):
    res = client.post("/addresses", json=BODY)
    assert res.status_code == 201
    data = res.json()
    assert data["is_default"] is True and data["recipient_name"] == "김여름"
    assert set(data) == {"id", "label", "recipient_name", "recipient_phone", "postal_code",
                         "address1", "address2", "is_default", "created_at"}


def test_list_returns_page_shape(client, address_repo):
    address_repo.seed(ME, sample("기본"), is_default=True)
    address_repo.seed(ME, sample("최근"))
    address_repo.seed(OTHER, sample("남의 것"), is_default=True)
    res = client.get("/addresses", params={"page": 1, "size": 20})
    assert res.status_code == 200
    body = res.json()
    assert (body["total"], body["page"], body["size"]) == (2, 1, 20)
    assert [a["recipient_name"] for a in body["items"]] == ["기본", "최근"]


def test_get_update_set_default_delete_flow(client, address_repo):
    first = address_repo.seed(ME, sample(), is_default=True)
    second = address_repo.seed(ME, sample("둘째"))
    assert client.get(f"/addresses/{second.id}").status_code == 200
    res = client.put(f"/addresses/{second.id}", json=BODY | {"recipient_name": "수정"})
    assert res.status_code == 200 and res.json()["recipient_name"] == "수정"
    assert client.patch(f"/addresses/{second.id}/default").status_code == 204
    assert address_repo.saved[second.id].is_default and not address_repo.saved[first.id].is_default
    assert client.delete(f"/addresses/{second.id}").status_code == 204
    assert address_repo.saved[first.id].is_default  # 남은 배송지가 다시 기본


# ---------- 401 ----------

def test_without_login_is_401(app):
    # get_current_user를 바꾸지 않으면 실제(또는 P1 통합 전 대체) 의존성이 토큰이 없다고 401을 낸다.
    res = TestClient(app).get("/addresses")
    assert res.status_code == 401
    assert res.json()["code"] == "NOT_AUTHENTICATED"


# ---------- 403 / 404 ----------

@pytest.mark.parametrize("method, suffix", [("get", ""), ("put", ""), ("delete", ""), ("patch", "/default")])
def test_other_users_address_is_403(client, address_repo, method, suffix):
    theirs = address_repo.seed(OTHER, sample(), is_default=True)
    kwargs = {"json": BODY} if method == "put" else {}
    res = getattr(client, method)(f"/addresses/{theirs.id}{suffix}", **kwargs)
    assert res.status_code == 403
    assert res.json() == {"code": "UNKNOWN", "message": "다른 사람의 배송지예요."}


def test_missing_address_is_404(client):
    res = client.get("/addresses/999")
    assert res.status_code == 404 and res.json()["code"] == "UNKNOWN"


# ---------- 409 ----------

def test_over_limit_is_409(client, address_repo):
    for i in range(MAX_ADDRESSES):
        address_repo.seed(ME, sample(f"이름{i}"), is_default=(i == 0))
    res = client.post("/addresses", json=BODY)
    assert res.status_code == 409 and res.json()["code"] == "UNKNOWN"


# ---------- 422 ----------

@pytest.mark.parametrize("body", [
    BODY | {"postal_code": "123"},  # 도메인 규칙 위반
    BODY | {"recipient_phone": "02-123-4567"},
    BODY | {"recipient_name": "   "},
    {k: v for k, v in BODY.items() if k != "address1"},  # 필수 칸 누락 (스키마)
    BODY | {"user_id": str(uuid4())},  # 모르는 칸은 거부 (남의 user_id를 넣는 시도)
], ids=["postal", "phone", "blank-name", "missing-address1", "extra-user-id"])
def test_bad_body_is_422(client, body):
    res = client.post("/addresses", json=body)
    assert res.status_code == 422 and set(res.json()) == {"code", "message"}


@pytest.mark.parametrize("params", [{"page": 0}, {"size": 101}])
def test_bad_page_is_422(client, params):
    assert client.get("/addresses", params=params).status_code == 422


def test_bad_path_id_is_422(client):
    assert client.get("/addresses/0").status_code == 422
