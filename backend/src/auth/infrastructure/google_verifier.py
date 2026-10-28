"""Google 공식 라이브러리로 ID 토큰을 검증합니다."""
import asyncio
from secrets import compare_digest

from google.auth.transport.requests import Request
from google.oauth2 import id_token

from auth.application.exceptions import InvalidCredentialsError
from auth.domain.google_identity import GoogleIdentity


class GoogleTokenVerifier:
    def __init__(self, client_id: str):
        self.client_id = client_id

    def _verify(self, credential: str, nonce: str) -> GoogleIdentity:
        if not self.client_id:
            raise InvalidCredentialsError()
        try:
            # 공식 검증은 서명·aud·iss·exp를 검사합니다. 네트워크 대기에는 상한을 둡니다.
            def transport(*args, **kwargs):
                kwargs["timeout"] = 10
                return Request()(*args, **kwargs)

            claims = id_token.verify_oauth2_token(credential, transport, audience=self.client_id)
            token_nonce = claims.get("nonce")
            if (claims.get("email_verified") is not True
                    or not isinstance(token_nonce, str)
                    or not compare_digest(token_nonce, nonce)
                    or not isinstance(claims.get("sub"), str)
                    or not isinstance(claims.get("email"), str)):
                raise ValueError("필수 정보 확인 실패")
            email = claims["email"].strip().lower()
            if "@" not in email:
                raise ValueError("이메일 확인 실패")
            name = claims.get("name")
            nickname = name.strip() if isinstance(name, str) and name.strip() else email.split("@")[0]
            return GoogleIdentity(claims["sub"], email, nickname[:50])
        except Exception:
            # 토큰·개인정보가 예외에 포함되지 않도록 공개 오류로 변환합니다.
            raise InvalidCredentialsError() from None

    async def verify(self, credential: str, nonce: str) -> GoogleIdentity:
        return await asyncio.to_thread(self._verify, credential, nonce)
