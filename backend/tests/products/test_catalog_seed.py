import asyncio
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

import pytest
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from products.infrastructure import seed
from products.infrastructure.models import ProductModel
from products.infrastructure.seed import ASSET_ROOT, TABLES, load_catalog, local_database_url, seed_catalog

COUNTS = {'artists': 11, 'categories': 7, 'products': 389, 'product_variants': 642,
          'product_images': 1390, 'artist_members': 13, 'artist_banners': 5,
          'home_banners': 0, 'notices': 35, 'shop_settings': 1}


@pytest.fixture
def original_images():
    manifest = json.loads((ASSET_ROOT / 'catalog-image-manifest.json').read_text(encoding='utf-8'))
    if any(not (ASSET_ROOT / path).is_file() for path in manifest['files']):
        pytest.skip('기존 Storage ZIP의 원본 이미지를 먼저 준비해주세요.')
    return manifest


@pytest.mark.parametrize('url', [None, 'invalid',
    'postgresql+asyncpg://user:secret@db.example/test',
    'postgresql+asyncpg://user:secret@127.0.0.1/test?host=db.example',
    'postgresql://user:secret@localhost/test'],
    ids=['missing', 'invalid', 'remote', 'host-override', 'wrong-driver'])
def test_seed_cli_rejects_nonlocal_targets_without_disclosing_url(url):
    with pytest.raises(ValueError) as error:
        local_database_url(url)
    assert 'secret' not in str(error.value)


def test_cli_rejects_remote_target_before_loading_default_database_settings():
    backend_root = Path(__file__).resolve().parents[2]
    env = os.environ.copy()
    env.update(DATABASE_URL='invalid-default-url', JWT_SECRET='',
               PYTHONPATH=str(backend_root / 'src'),
               P2_SEED_DATABASE_URL='postgresql+asyncpg://user:secret@db.example/test')
    result = subprocess.run([sys.executable, '-m', 'products.infrastructure.seed'],
                            cwd=backend_root, env=env, capture_output=True,
                            encoding='utf-8', errors='replace', timeout=15)
    assert result.returncode != 0
    assert 'ValueError' in result.stderr
    assert 'invalid-default-url' not in result.stderr
    assert 'secret@' not in result.stderr


def test_notice_product_references_match_explicit_original_sku_paths():
    snapshot = load_catalog()
    rules = json.loads(seed.SNAPSHOT_PATH.with_name('catalog_notice_links.json').read_text(encoding='utf-8'))
    products = {row['id']: row for row in snapshot['tables']['products']}
    notices = {row['title']: row for row in snapshot['tables']['notices']}
    for rule in rules:
        notice = notices[rule['notice_title']]
        product = products[notice['product_id']]
        assert product['thumbnail_path'] == rule['product_thumbnail_path']
        assert product['artist_id'] == notice['artist_id']


def test_all_original_images_are_unchanged_and_publicly_served(original_images):
    manifest = original_images
    assert len(manifest['files']) == 1847
    app = FastAPI()
    app.mount('/static', StaticFiles(directory=ASSET_ROOT), name='static')
    with TestClient(app) as client:
        for path, metadata in manifest['files'].items():
            response = client.get('/static/' + path)
            assert response.status_code == 200, path
            assert response.headers['content-type'].startswith('image/webp')
            assert hashlib.sha256(response.content).hexdigest() == metadata['sha256'], path
            assert len(response.content) == metadata['bytes']


def test_full_catalog_matches_source_and_reexecution_preserves_changes(original_images, postgres_url):
    async def check():
        engine = create_async_engine(postgres_url)
        try:
            async with engine.connect() as connection:
                transaction = await connection.begin()
                async with async_sessionmaker(connection, expire_on_commit=False)() as session:
                    assert await seed_catalog(session) == COUNTS
                    for table in TABLES:
                        rows = (await session.execute(text(
                            f'SELECT to_jsonb(t) FROM public."{table}" t ORDER BY id'))).scalars().all()
                        rows = [json.loads(row) if isinstance(row, str) else row for row in rows]
                        assert rows == load_catalog()['tables'][table], table
                    await session.execute(text("UPDATE products SET price=123, status='hidden', thumbnail_path='/uploads/keep.webp' WHERE id=1"))
                    await session.execute(text('UPDATE product_variants SET stock=7 WHERE id=1'))
                    # sequence가 원본 ID 이후로 진행되어 일반 INSERT도 안전하다.
                    extra = ProductModel(artist_id=1, category_id=1, name='관리자 추가 상품', price=999)
                    session.add(extra)
                    await session.flush()
                    assert extra.id > 389
                    assert await seed_catalog(session) == COUNTS
                    assert (await session.execute(text('SELECT price,status,thumbnail_path FROM products WHERE id=1'))).one() == (123, 'hidden', '/uploads/keep.webp')
                    assert await session.scalar(text('SELECT stock FROM product_variants WHERE id=1')) == 7
                    assert await session.scalar(text('SELECT count(*) FROM products')) == 390
                    assert await session.scalar(text('SELECT count(*) FROM users')) == 0
                    assert await session.scalar(text('SELECT count(*) FROM orders')) == 0
                await transaction.rollback()
        finally:
            await engine.dispose()
    asyncio.run(check())


def test_seed_is_uncommitted_and_caller_rollback_restores_empty_catalog(original_images, postgres_url):
    async def check():
        engine = create_async_engine(postgres_url)
        factory = async_sessionmaker(engine)
        try:
            async with factory() as session:
                await seed_catalog(session)
                async with factory() as observer:
                    assert await observer.scalar(text('SELECT count(*) FROM products')) == 0
                await session.rollback()
            async with factory() as observer:
                for table in TABLES:
                    assert await observer.scalar(text(f'SELECT count(*) FROM public."{table}"')) == 0
        finally:
            await engine.dispose()
    asyncio.run(check())


def test_partial_or_foreign_catalog_is_not_overwritten(original_images, postgres_url):
    async def check():
        engine = create_async_engine(postgres_url)
        try:
            async with async_sessionmaker(engine)() as session:
                await session.execute(text("INSERT INTO artists(name,name_ko,slug) VALUES ('OTHER','기존','other')"))
                with pytest.raises(ValueError, match='덮어쓰지'):
                    await seed_catalog(session)
                assert await session.scalar(text('SELECT count(*) FROM artists')) == 1
                assert await session.scalar(text('SELECT count(*) FROM products')) == 0
                await session.rollback()
        finally:
            await engine.dispose()
    asyncio.run(check())


def test_missing_original_images_prevent_any_seed_writes(postgres_url, tmp_path, monkeypatch):
    original_manifest = (ASSET_ROOT / 'catalog-image-manifest.json').read_bytes()
    (tmp_path / 'catalog-image-manifest.json').write_bytes(original_manifest)
    monkeypatch.setattr(seed, 'ASSET_ROOT', tmp_path)
    async def check():
        engine = create_async_engine(postgres_url)
        try:
            async with async_sessionmaker(engine)() as session:
                with pytest.raises(ValueError, match='이미지 누락'):
                    await seed_catalog(session)
                assert await session.scalar(text('SELECT count(*) FROM artists')) == 0
        finally:
            await engine.dispose()
    asyncio.run(check())
