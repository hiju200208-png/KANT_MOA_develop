import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

logger = logging.getLogger("kantmoa")


class ApiError(Exception):
    """HTTP boundary exception; pure domain modules must not import this module."""

    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError):
        headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
        return JSONResponse(status_code=exc.status_code,
                            content={"code": exc.code, "message": exc.message}, headers=headers)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError):
        # Do not echo submitted values (especially passwords) into errors.
        return JSONResponse(status_code=422,
                            content={"code": "UNKNOWN", "message": "입력 형식을 확인해주세요."})

    @app.exception_handler(HTTPException)
    async def http_handler(request: Request, exc: HTTPException):
        code = "NOT_AUTHENTICATED" if exc.status_code == 401 else "UNKNOWN"
        messages = {401: "로그인이 필요해요.", 403: "접근 권한이 없어요.",
                    404: "요청한 데이터를 찾을 수 없어요."}
        return JSONResponse(status_code=exc.status_code,
                            content={"code": code, "message": messages.get(exc.status_code, "요청을 처리할 수 없어요.")},
                            headers=exc.headers)

    @app.exception_handler(Exception)
    async def unexpected_handler(request: Request, exc: Exception):
        # Exception text can contain SQL parameters and credentials; log only its type.
        logger.error("unhandled_error type=%s", type(exc).__name__)
        return JSONResponse(status_code=500,
                            content={"code": "UNKNOWN", "message": "잠시 후 다시 시도해주세요."})
