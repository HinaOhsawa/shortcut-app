"""HttpOnly Cookie から JWT を読み取る認証クラス。

DRF の SimpleJWT JWTAuthentication を継承し、Authorization ヘッダの代わりに
Cookie からトークンを取り出して検証する。安全でない HTTP メソッドに対しては
Django CSRF middleware と同じロジックで CSRF トークンを検証する。
"""

from django.middleware.csrf import CsrfViewMiddleware
from rest_framework import exceptions
from rest_framework_simplejwt.authentication import JWTAuthentication

from .cookies import ACCESS_COOKIE_NAME


class _CSRFCheck(CsrfViewMiddleware):
    def _reject(self, request, reason):
        # process_view が文字列 reason を返すことで例外送出を呼び出し側に委ねる
        return reason


class CookieJWTAuthentication(JWTAuthentication):
    """access_token Cookie 経由の JWT 認証。

    - Authorization ヘッダがあればそちらを優先する（管理コンソール等の互換性のため）
    - Cookie から取った場合は CSRF を強制する（Authorization ヘッダ経由の場合は強制しない）
    """

    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            # Authorization: Bearer ... 経由は親クラスのフローに委ねる
            return super().authenticate(request)

        raw_token = request.COOKIES.get(ACCESS_COOKIE_NAME)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        self._enforce_csrf(request)
        return self.get_user(validated_token), validated_token

    def _enforce_csrf(self, request):
        """安全でないメソッドに対して Django の CSRF チェックを実行する。

        APIClient(enforce_csrf_checks=False) では request._dont_enforce_csrf_checks
        フラグで自動 skip されるためテスト互換性も保たれる。
        """
        if request.method in ("GET", "HEAD", "OPTIONS", "TRACE"):
            return

        check = _CSRFCheck(get_response=lambda req: None)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")
