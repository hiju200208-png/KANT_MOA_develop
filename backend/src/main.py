import logging
from contextlib import asynccontextmanager
from time import perf_counter

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from core.config import BACKEND_ROOT, get_settings
from core.errors import register_error_handlers
from database import engine
from auth.presentation.router import router as auth_router
from products.presentation.router import router as products_router
from orders.presentation.address_router import router as address_router
from orders.presentation.cart_router import router as cart_router
from orders.presentation.order_router import router as order_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("kantmoa")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # Schema and seed operations must be explicit, never overwrite data on startup.
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        yield
    finally:
        await engine.dispose()


app = FastAPI(title="KANT MOA Project 2 API", version="0.1.0", lifespan=lifespan)
app.include_router(auth_router)
app.include_router(products_router)
for router in (address_router, cart_router, order_router):  # P3 배송지·장바구니·주문
    app.include_router(router)
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origins,
                   allow_credentials=False, allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
                   allow_headers=["Authorization", "Content-Type"])
register_error_handlers(app)


@app.middleware("http")
async def request_log(request, call_next):
    start = perf_counter()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    finally:
        # Omit raw URLs, query strings, request/response bodies and headers.
        route = request.scope.get("route")
        path = getattr(route, "path", "<unmatched-or-static>")
        logger.info("method=%s route=%s status=%s elapsed_ms=%.2f",
                    request.method, path, status, (perf_counter() - start) * 1000)


@app.get("/health")
async def health():
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except (SQLAlchemyError, OSError):
        return JSONResponse(status_code=503,
                            content={"code": "UNKNOWN", "message": "DB 연결을 확인해주세요."})
    return {"status": "ok", "database": "ok"}


# Public image directories only. Upload API and file validation are not implemented yet.
app.mount("/static", StaticFiles(directory=BACKEND_ROOT / "assets"), name="static")
app.mount("/uploads", StaticFiles(directory=BACKEND_ROOT / "uploads"), name="uploads")
