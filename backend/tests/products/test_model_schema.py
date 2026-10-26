"""전용 Docker DB의 초기 SQL과 ORM이 만드는 스키마를 비교한다."""

import asyncio

from sqlalchemy import MetaData, inspect, text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.schema import CreateSchema

from database import Base
from products.infrastructure.models import (
    ArtistModel, CategoryModel, ProductImageModel, ProductModel, ProductVariantModel,
)

MODELS = (ArtistModel, CategoryModel, ProductModel, ProductImageModel, ProductVariantModel)


def schema_signature(connection, table_name, schema):
    inspector = inspect(connection)
    columns = inspector.get_columns(table_name, schema=schema)
    return {
        "columns": {
            column["name"]: (
                str(column["type"]), column["nullable"], column["default"],
                # PostgreSQL identity sequence의 현재값은 데이터이며 스키마 비교에서 제외한다.
                {key: value for key, value in column.get("identity", {}).items()
                 if key in ("always", "start", "increment", "minvalue", "maxvalue", "cycle", "cache")},
            ) for column in columns
        },
        "pk": inspector.get_pk_constraint(table_name, schema=schema)["constrained_columns"],
        "unique": sorted(tuple(item["column_names"])
                         for item in inspector.get_unique_constraints(table_name, schema=schema)),
        "checks": sorted(item["sqltext"] for item in inspector.get_check_constraints(table_name, schema=schema)),
        "fk": sorted((tuple(item["constrained_columns"]), item["referred_table"],
                      tuple(item["referred_columns"]), item["options"])
                     for item in inspector.get_foreign_keys(table_name, schema=schema)),
    }


def test_orm_matches_initial_sql_on_postgresql(postgres_url):
    async def check():
        engine = create_async_engine(postgres_url)
        try:
            # fixture가 새로 만든 로컬 테스트 DB에서만 비교용 스키마를 생성한다.
            async with engine.begin() as connection:
                assert all(model.__table__.metadata is Base.metadata for model in MODELS)
                metadata = MetaData(schema="p2_orm_contract")
                for model in MODELS:
                    model.__table__.to_metadata(metadata)
                await connection.execute(CreateSchema("p2_orm_contract"))
                await connection.run_sync(metadata.create_all)
                for model in MODELS:
                    expected = await connection.run_sync(
                        lambda conn: schema_signature(conn, model.__tablename__, "public")
                    )
                    actual = await connection.run_sync(
                        lambda conn: schema_signature(conn, model.__tablename__, "p2_orm_contract")
                    )
                    assert actual == expected, model.__tablename__
                assert await connection.scalar(text(
                    "select data_type from information_schema.columns "
                    "where table_schema='public' and table_name='users' and column_name='id'"
                )) == "uuid"
        finally:
            await engine.dispose()

    asyncio.run(check())
