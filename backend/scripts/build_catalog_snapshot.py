# /// script
# requires-python = ">=3.13"
# dependencies = ["pglast==8.7"]
# ///
"""원본 SQL의 카탈로그 DML만 새 로컬 Docker DB에서 재생해 JSON과 원본 이미지를 준비한다."""

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import secrets
import stat
import subprocess
import time
from uuid import uuid4
import zipfile

from pglast import parse_sql, split
from pglast.ast import DeleteStmt, InsertStmt, UpdateStmt

ROOT = Path(__file__).resolve().parents[2]
TABLES = ("artists", "categories", "products", "product_variants", "product_images",
          "artist_members", "artist_banners", "home_banners", "notices", "shop_settings")
IMAGE_FIELDS = {
    "artists": {"logo_path": "artists", "hero_image_path": "artists"},
    "products": {"thumbnail_path": "products"},
    "product_images": {"image_path": "products"},
    "artist_members": {"image_path": "artists"},
    "artist_banners": {"image_path": "artists"},
    "home_banners": {"image_path": "artists"},
}


def catalog_statements(source: str):
    # PostgreSQL parser로 dollar quote·문자열 속 세미콜론을 보존한다.
    for statement in split(source):
        node = parse_sql(statement)[0].stmt
        if (isinstance(node, (InsertStmt, UpdateStmt, DeleteStmt))
                and node.relation.schemaname in (None, "public")
                and node.relation.relname in TABLES):
            yield statement


def normalize_notice_links(tables: dict) -> list:
    # 원본 공지는 초기 mock의 고정 ID를 사용한다. 재구성된 ID 대신 실제 SKU 경로로 연결한다.
    path = ROOT / "backend/src/products/infrastructure/catalog_notice_links.json"
    rules = json.loads(path.read_text(encoding="utf-8"))
    remaps = []
    for rule in rules:
        notices = [n for n in tables["notices"] if n["title"] == rule["notice_title"]]
        products = [p for p in tables["products"] if p["thumbnail_path"] == rule["product_thumbnail_path"]]
        if len(notices) != 1 or len(products) != 1 or notices[0]["artist_id"] != products[0]["artist_id"]:
            raise ValueError("원본 공지와 상품의 연결을 확인해주세요.")
        notice, product = notices[0], products[0]
        if notice["product_id"] != product["id"]:
            remaps.append({"notice_id": notice["id"], "title": notice["title"],
                           "original_product_id": notice["product_id"], "product_id": product["id"]})
            notice["product_id"] = product["id"]
    return remaps


def prepare_images(archive_path: Path) -> dict:
    assets = ROOT / "backend/assets"
    manifest = {}
    with zipfile.ZipFile(archive_path) as archive:
        for info in archive.infolist():
            if info.is_dir():
                continue
            name = PurePosixPath(info.filename)
            if (name.is_absolute() or ".." in name.parts or "\\" in info.filename
                    or ":" in info.filename or stat.S_ISLNK(info.external_attr >> 16)
                    or name.parts[0] not in ("artists", "products")
                    or name.suffix.lower() != ".webp" or info.filename in manifest):
                raise ValueError("이미지 ZIP 경로·형식을 확인해주세요.")
            data = archive.read(info)
            if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
                raise ValueError("WebP 파일 형식 불일치: " + info.filename)
            target = (assets / info.filename).resolve()
            if not target.is_relative_to(assets.resolve()):
                raise ValueError("이미지 경로가 assets 밖입니다.")
            if target.exists() and target.read_bytes() != data:
                raise ValueError("기존 이미지와 원본이 다릅니다: " + info.filename)
            manifest[info.filename] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
        # 모든 파일 사전 검증 후 원본 그대로 복사한다.
        for name in manifest:
            target = assets / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(name))
    with archive_path.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    return {"source_archive": archive_path.name, "archive_sha256": digest, "files": manifest}


def build(archive_path: Path) -> None:
    images = prepare_images(archive_path)
    files = [ROOT / "supabase/seed.sql", *sorted((ROOT / "supabase/migrations").glob("*.sql"))]
    statements, sources = [], []
    for path in files:
        selected = list(catalog_statements(path.read_text(encoding="utf-8")))
        if selected:
            statements.extend(selected)
            sources.append({"path": path.relative_to(ROOT).as_posix(),
                            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                            "statements": len(selected)})
    container = "kant-catalog-source-" + uuid4().hex[:10]

    def docker(*args, data=None):
        result = subprocess.run(["docker", *args], input=data, capture_output=True, timeout=120)
        if result.returncode:
            raise RuntimeError(result.stderr.decode("utf-8", errors="replace"))
        return result.stdout.decode("utf-8")

    def sql(statement):
        return docker("exec", "-i", container, "psql", "-X", "-At", "-U", "catalog",
                      "-d", "catalog", "-v", "ON_ERROR_STOP=1", data=statement.encode("utf-8"))

    try:
        # 접속 대상 인수를 받지 않고 직접 생성한 로컬 컨테이너에서만 실행한다.
        docker("run", "-d", "--name", container, "--label", "kant.p2.test=true",
               "--env", "POSTGRES_USER=catalog", "--env", "POSTGRES_DB=catalog",
               "--env", "POSTGRES_PASSWORD=" + secrets.token_hex(24), "postgres:18-alpine")
        for _ in range(120):
            ready = subprocess.run(["docker", "exec", container, "pg_isready", "-h", "127.0.0.1",
                                    "-U", "catalog", "-d", "catalog"], capture_output=True)
            if ready.returncode == 0:
                break
            time.sleep(.5)
        else:
            raise RuntimeError("로컬 원본 재구성 DB 기동 시간 초과")
        sql((ROOT / "backend/sql/001_create_tables.sql").read_text(encoding="utf-8"))
        sql("BEGIN; SET LOCAL TIME ZONE 'UTC';\n" + ";\n".join(statements) + ";\nCOMMIT;")
        tables = {}
        for table in TABLES:
            tables[table] = json.loads(sql(
                f"SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]'::jsonb) FROM public.{table} t;"))
        missing = set()
        for table, fields in IMAGE_FIELDS.items():
            for row in tables[table]:
                for field, bucket in fields.items():
                    if row[field]:
                        relative = bucket + "/" + row[field]
                        row[field] = "/static/" + relative
                        if relative not in images["files"]:
                            missing.add(relative)
        remaps = normalize_notice_links(tables)
        snapshot = {"format_version": 1, "source": "repository SQL replay with notice reference normalization, not a live Supabase export",
                    "sources": sources, "archive_sha256": images["archive_sha256"],
                    "missing_images": sorted(missing), "notice_reference_remaps": remaps, "tables": tables}
        data_path = ROOT / "backend/src/products/infrastructure/catalog_snapshot.json"
        data_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (ROOT / "backend/assets/catalog-image-manifest.json").write_text(
            json.dumps(images, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"counts": {name: len(rows) for name, rows in tables.items()},
                          "original_images": len(images["files"]), "missing_images": sorted(missing)},
                         ensure_ascii=False))
    finally:
        subprocess.run(["docker", "rm", "--force", "--volumes", container], capture_output=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--images-only", action="store_true",
                        help="카탈로그 JSON을 재생성하지 않고 같은 ZIP의 이미지만 준비")
    args = parser.parse_args()
    if args.images_only:
        expected = json.loads((ROOT / "backend/assets/catalog-image-manifest.json").read_text(encoding="utf-8"))
        with args.archive.open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != expected["archive_sha256"]:
                raise ValueError("원본 ZIP 버전이 다릅니다.")
        prepared = prepare_images(args.archive)
        if prepared["files"] != expected["files"]:
            raise ValueError("원본 이미지 목록·내용이 다릅니다.")
        print(f"원본 이미지 {len(prepared['files'])}개 준비 완료")
    else:
        build(args.archive)
