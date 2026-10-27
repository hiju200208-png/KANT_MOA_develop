"""기존 18개 테이블을 검증하고 인증 차이·최초 이력을 한 트랜잭션으로 적용합니다."""

import argparse
import asyncio
import copy
from getpass import getpass
import json
import os
import re
from pathlib import Path

from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from dotenv import dotenv_values
from sqlalchemy import text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool


HEAD = "3f21520f9615"
ROOT = Path(__file__).resolve().parents[1]
TABLES = sorted("addresses artist_banners artist_likes artist_members artists cart_items categories home_banners notices order_items orders product_images product_variants products shop_settings token_blacklist users wishlists".split())
CHECKS = {"ck_users_login_method", "ck_users_email_normalized"}
INDEX = "ix_token_blacklist_expires_at"


def canonical(value):
    if isinstance(value, str):
        value = value.replace("::character varying", "::text")
        value = re.sub(r"(?:::text){2,}", "::text", value)
        return re.sub(r"\(('(?:[^']|'')*')::text\)::text", r"\1::text", value)
    return value


def schema_snapshot(connection):
    """소유자·컬럼 순서·데이터·시퀀스 현재값을 제외한 구조를 비교합니다."""
    queries = {
        "tables": "SELECT tablename AS name FROM pg_tables WHERE schemaname='public' AND tablename <> 'alembic_version' ORDER BY 1",
        "columns": """SELECT c.relname AS table_name, a.attname AS name,
            format_type(a.atttypid,a.atttypmod) AS type, a.attnotnull AS not_null,
            a.attidentity AS identity, a.attgenerated AS generated,
            pg_get_expr(d.adbin,d.adrelid) AS default_value
            FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
            JOIN pg_namespace n ON n.oid=c.relnamespace
            LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
            WHERE n.nspname='public' AND c.relkind='r' AND c.relname <> 'alembic_version'
            AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1,2""",
        "constraints": """SELECT c.relname AS table_name, k.conname AS name,
            k.contype AS type, pg_get_constraintdef(k.oid) AS definition
            FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
            JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND c.relname <> 'alembic_version'
            AND k.contype <> 'n' ORDER BY 1,2""",
        "indexes": """SELECT tablename AS table_name, indexname AS name, indexdef AS definition
            FROM pg_indexes WHERE schemaname='public' AND tablename <> 'alembic_version' ORDER BY 1,2""",
        "sequences": """SELECT c.relname AS name, format_type(s.seqtypid,NULL) AS type,
            s.seqstart AS start, s.seqincrement AS increment, s.seqmin AS min,
            s.seqmax AS max, s.seqcache AS cache, s.seqcycle AS cycle
            FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid
            JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY 1""",
        "triggers": """SELECT c.relname AS table_name, t.tgname AS name,
            pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t
            JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY 1,2""",
    }
    return {kind: [{k: canonical(v) for k, v in row.items()}
                   for row in connection.execute(text(query)).mappings()]
            for kind, query in queries.items()}


def expected_existing(reference):
    expected = copy.deepcopy(reference)
    expected["constraints"] = [row for row in expected["constraints"]
                               if not (row["table_name"] == "users" and row["name"] in CHECKS)]
    for row in expected["constraints"]:
        if row["table_name"] == "users" and row["name"] == "ck_users_role":
            row["name"] = "users_role_check"
    expected["constraints"].sort(key=lambda row: (row["table_name"], row["name"]))
    expected["indexes"] = [row for row in expected["indexes"]
                           if not (row["table_name"] == "token_blacklist" and row["name"] == INDEX)]
    return expected


def require_equal(actual, expected):
    different = [kind for kind in expected if actual[kind] != expected[kind]]
    if different:
        names = []
        for kind in different:
            names.extend(row.get("name", "unknown") for row in actual[kind] if row not in expected[kind])
        raise ValueError("예상하지 못한 스키마 차이: " + ", ".join(different) + " (" + ", ".join(names) + ")")


def adopt(connection, reference, scripts, database, user, apply):
    identity = connection.execute(text("SELECT current_database(), current_user")).one()
    if tuple(identity) != (database, user):
        raise ValueError("대상 DB·계정이 명시한 값과 다릅니다.")
    if connection.scalar(text("SELECT to_regclass('public.alembic_version')")) is not None:
        raise ValueError("Alembic 이력이 이미 존재합니다. 최초 등록을 반복하지 않습니다.")
    if apply:
        connection.execute(text("SET LOCAL lock_timeout='5s'"))
        connection.execute(text("SET LOCAL statement_timeout='30s'"))
        connection.execute(text("SELECT pg_advisory_xact_lock(hashtext('kant-moa-baseline-adoption'))"))
        # 비교 중 다른 담당자의 데이터·DDL 변경과 겹치지 않도록 짧게 잠급니다.
        connection.execute(text("LOCK TABLE " + ", ".join("public." + name for name in TABLES) + " IN SHARE MODE"))
    snapshot = schema_snapshot(connection)
    if [row["name"] for row in snapshot["tables"]] != TABLES:
        raise ValueError("예상한 업무 테이블 18개와 다릅니다.")
    require_equal(snapshot, expected_existing(reference))
    invalid = connection.scalar(text("""SELECT count(*) FROM public.users
        WHERE (password_hash IS NULL AND google_sub IS NULL)
        OR email <> lower(btrim(email)) OR length(email)=0"""))
    if invalid:
        raise ValueError("인증 제약을 위반하는 기존 회원이 있습니다.")
    if connection.scalar(text("""SELECT count(*) FROM
        (SELECT lower(btrim(email)) FROM public.users GROUP BY 1 HAVING count(*)>1) d""")):
        raise ValueError("정규화 후 중복 이메일이 있습니다.")
    if not apply:
        return {"status": "CHECK_OK", "tables": 18, "target_revision": HEAD, "changed": False}
    connection.execute(text("ALTER TABLE public.users RENAME CONSTRAINT users_role_check TO ck_users_role"))
    connection.execute(text("""ALTER TABLE public.users ADD CONSTRAINT ck_users_login_method
        CHECK (password_hash IS NOT NULL OR google_sub IS NOT NULL)"""))
    connection.execute(text("""ALTER TABLE public.users ADD CONSTRAINT ck_users_email_normalized
        CHECK (email=lower(btrim(email)) AND length(email)>0)"""))
    connection.execute(text("CREATE INDEX ix_token_blacklist_expires_at ON public.token_blacklist (expires_at)"))
    require_equal(schema_snapshot(connection), reference)
    # 비교를 통과한 동일 연결·transaction에서만 이력을 등록합니다.
    MigrationContext.configure(connection, opts={"version_table_schema": "public"}).stamp(scripts, HEAD)
    revision = connection.scalar(text("SELECT version_num FROM public.alembic_version"))
    if revision != HEAD:
        raise ValueError("최초 이력 검증에 실패했습니다.")
    return {"status": "ADOPTED", "tables": 18, "revision": revision, "changed": True}


async def run(reference_url, target_url, database, user, apply=False):
    reference_address, target_address = make_url(reference_url), make_url(target_url)
    if reference_address.host not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("비교 기준 DB는 로컬 주소만 허용합니다.")
    if reference_address == target_address:
        raise ValueError("비교 기준 DB와 대상 DB는 달라야 합니다.")
    config = Config(str(ROOT / "alembic.ini"))
    scripts = ScriptDirectory.from_config(config)
    heads = scripts.get_heads()
    # 최초 이력은 계속 3f21520f9615만 등록한다. 검토된 배송 후속 revision만 허용한다.
    known_shipping_head = (
        heads == ["4c726d1a91ab"]
        and scripts.get_revision(heads[0]).down_revision == HEAD
    )
    if heads != [HEAD] and not known_shipping_head:
        raise ValueError("저장소 head가 바뀌었습니다. 최초 이력 기준을 다시 검토하세요.")
    reference_engine = create_async_engine(reference_url, poolclass=NullPool)
    target_engine = create_async_engine(target_url, poolclass=NullPool)
    try:
        async with reference_engine.begin() as connection:
            await connection.execute(text("SET TRANSACTION READ ONLY"))
            if await connection.scalar(text("SELECT version_num FROM public.alembic_version")) != HEAD:
                raise ValueError("비교 기준 로컬 DB는 최초 baseline 3f21520f9615여야 합니다.")
            reference = await connection.run_sync(schema_snapshot)
        async with target_engine.begin() as connection:
            if not apply:
                await connection.execute(text("SET TRANSACTION READ ONLY"))
            result = await connection.run_sync(lambda conn: adopt(conn, reference, scripts, database, user, apply))
        return result
    finally:
        await reference_engine.dispose()
        await target_engine.dispose()


def main():
    parser = argparse.ArgumentParser(description="기존 공용 DB 최초 이력 등록: 기본은 읽기 전용 비교")
    parser.add_argument("--reference-url-env", default="BASELINE_REFERENCE_URL")
    parser.add_argument("--target-url-env", default="BASELINE_TARGET_URL")
    parser.add_argument("--target-host")
    parser.add_argument("--target-port", type=int, default=5432)
    parser.add_argument("--expected-database", required=True)
    parser.add_argument("--expected-user", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        reference_url = os.environ.get(args.reference_url_env) or dotenv_values(ROOT / ".env").get("DATABASE_URL")
        if not reference_url:
            raise ValueError("비교 기준 로컬 DB 설정이 필요합니다.")
        target_url = os.environ.get(args.target_url_env)
        if not target_url:
            if not args.target_host:
                raise ValueError("대상 환경변수 또는 --target-host가 필요합니다.")
            target_url = URL.create("postgresql+asyncpg", host=args.target_host, port=args.target_port,
                                    database=args.expected_database, username=args.expected_user,
                                    password=getpass("대상 DB 비밀번호(화면에 표시되지 않음): ")).render_as_string(hide_password=False)
        result = asyncio.run(run(reference_url, target_url,
                                 args.expected_database, args.expected_user, args.apply))
    except Exception as error:
        # 연결 예외에 URL·비밀번호가 포함될 수 있어 원문을 출력하지 않습니다.
        print(json.dumps({"status": "STOPPED", "error_type": type(error).__name__,
                          "message": str(error) if isinstance(error, ValueError) else "연결·실행 실패. 자격 증명을 노출하지 않고 원인을 확인하세요."}, ensure_ascii=False))
        raise SystemExit(1)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
