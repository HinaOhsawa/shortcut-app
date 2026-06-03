"""Cookie ベース JWT 認証で使用する Cookie 設定ユーティリティ。

Cookie の名前・属性をここに集約し、ビュー側からは set_auth_cookies /
clear_auth_cookies を呼ぶだけで済むようにする。
"""

from django.conf import settings

ACCESS_COOKIE_NAME = "access_token"
REFRESH_COOKIE_NAME = "refresh_token"

REFRESH_COOKIE_PATH = "/api/accounts/"


def _common_cookie_kwargs() -> dict:
    """環境に応じた共通の Cookie 属性を返す。

    Secure は SESSION_COOKIE_SECURE と連動させる。これにより:
    - dev (DEBUG=True): SESSION_COOKIE_SECURE 未設定 → False → HTTP で Cookie 送信可
    - prod HTTPS (DJANGO_FORCE_HTTPS=True): True → HTTPS のみ送信
    - HTTP-only ALB (DJANGO_FORCE_HTTPS=False): False → HTTP で Cookie 送信可
    """
    return {
        "httponly": True,
        "secure": getattr(settings, "SESSION_COOKIE_SECURE", False),
        "samesite": "Lax",
    }


def set_auth_cookies(response, *, access: str, refresh: str | None = None) -> None:
    """access / refresh Cookie をレスポンスにセットする。

    refresh が None の場合は access のみ更新する（refresh の rotation 結果が
    無いケース、例えばトークン再発行で同じ refresh を使い回すパスでは使用しない想定）。
    """
    access_lifetime = settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"]
    refresh_lifetime = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]

    response.set_cookie(
        ACCESS_COOKIE_NAME,
        access,
        max_age=int(access_lifetime.total_seconds()),
        path="/",
        **_common_cookie_kwargs(),
    )
    if refresh is not None:
        response.set_cookie(
            REFRESH_COOKIE_NAME,
            refresh,
            max_age=int(refresh_lifetime.total_seconds()),
            path=REFRESH_COOKIE_PATH,
            **_common_cookie_kwargs(),
        )


def clear_auth_cookies(response) -> None:
    """ログアウト時などに認証 Cookie を削除する。"""
    response.delete_cookie(ACCESS_COOKIE_NAME, path="/")
    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)
