class AuthError(Exception):
    """인증 업무 처리 중 발생하는 오류입니다."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class EmailAlreadyExistsError(AuthError):
    def __init__(self):
        super().__init__(
            "EMAIL_ALREADY_EXISTS",
            "이미 가입된 이메일이에요.",
        )


class InvalidCredentialsError(AuthError):
    def __init__(self):
        super().__init__(
            "INVALID_CREDENTIALS",
            "이메일 또는 비밀번호가 올바르지 않아요.",
        )


class NotAuthenticatedError(AuthError):
    def __init__(self):
        super().__init__(
            "NOT_AUTHENTICATED",
            "로그인이 필요해요.",
        )


class InvalidResetTokenError(AuthError):
    def __init__(self):
        super().__init__(
            "UNKNOWN",
            "재설정 링크가 만료되었거나 이미 사용되었어요. 다시 요청해주세요.",
        )


class ForbiddenError(AuthError):
    def __init__(self):
        super().__init__(
            "UNKNOWN",
            "접근 권한이 없어요.",
        )