from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .cookies import ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME
from .models import CustomUser


class _BaseAuthTestCase(APITestCase):
    """ScopedRateThrottle のカウンタが LocMemCache に残るため、
    各テストの先頭でクリアして隔離する。

    子クラスの setUp と衝突しないよう Django の _pre_setup フックを使う。"""

    def _pre_setup(self):
        cache.clear()
        super()._pre_setup()


def _is_cookie_cleared(client, name: str) -> bool:
    """Set-Cookie で Max-Age=0 として削除されたかを判定する。"""
    morsel = client.cookies.get(name)
    if morsel is None:
        return True
    return morsel.value == "" or morsel.get("max-age") in (0, "0")


class RegisterTests(_BaseAuthTestCase):
    url = "/api/accounts/register/"

    def test_register_success(self):
        res = self.client.post(
            self.url,
            {"name": "Alice", "email": "alice@example.com", "password": "Strongpass123!"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        # トークンは Body ではなく Cookie で返ること
        self.assertNotIn("access", res.data)
        self.assertNotIn("refresh", res.data)
        self.assertIn(ACCESS_COOKIE_NAME, res.cookies)
        self.assertIn(REFRESH_COOKIE_NAME, res.cookies)
        # HttpOnly が立っていること
        self.assertTrue(res.cookies[ACCESS_COOKIE_NAME]["httponly"])
        self.assertTrue(res.cookies[REFRESH_COOKIE_NAME]["httponly"])
        self.assertEqual(res.data["user"]["email"], "alice@example.com")

    def test_register_rejects_weak_password(self):
        res = self.client.post(
            self.url,
            {"name": "Bob", "email": "bob@example.com", "password": "1234567"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", res.data)

    def test_register_rejects_common_password(self):
        res = self.client.post(
            self.url,
            {"name": "Carol", "email": "carol@example.com", "password": "password"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", res.data)

    def test_register_rejects_duplicate_email(self):
        CustomUser.objects.create_user(
            email="dup@example.com", name="Dup", password="Strongpass123!"
        )
        res = self.client.post(
            self.url,
            {"name": "Other", "email": "dup@example.com", "password": "Strongpass123!"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", res.data)


class LoginTests(_BaseAuthTestCase):
    url = "/api/accounts/login/"

    def setUp(self):
        self.user = CustomUser.objects.create_user(
            email="login@example.com", name="Login", password="Strongpass123!"
        )

    def test_login_success_sets_cookies(self):
        res = self.client.post(
            self.url,
            {"email": "login@example.com", "password": "Strongpass123!"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertNotIn("access", res.data)
        self.assertNotIn("refresh", res.data)
        self.assertIn(ACCESS_COOKIE_NAME, res.cookies)
        self.assertIn(REFRESH_COOKIE_NAME, res.cookies)
        self.assertEqual(res.cookies[ACCESS_COOKIE_NAME]["samesite"], "Lax")

    def test_login_wrong_password(self):
        res = self.client.post(
            self.url,
            {"email": "login@example.com", "password": "WrongPassword!"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class CookieAuthenticationTests(_BaseAuthTestCase):
    """ログインで設定された Cookie で API を叩けるかを確認"""

    def setUp(self):
        self.user = CustomUser.objects.create_user(
            email="cookie@example.com", name="Cookie", password="Strongpass123!"
        )
        self.client.post(
            "/api/accounts/login/",
            {"email": "cookie@example.com", "password": "Strongpass123!"},
            format="json",
        )

    def test_authenticated_get_succeeds(self):
        # APIClient はログインで設定された Cookie を以後のリクエストで自動送信
        res = self.client.get("/api/accounts/profile/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["email"], "cookie@example.com")

    def test_unauthenticated_get_returns_401(self):
        client = APIClient()
        res = client.get("/api/accounts/profile/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class CookieTokenRefreshTests(_BaseAuthTestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            email="refresh@example.com", name="Refresh", password="Strongpass123!"
        )
        self.client.post(
            "/api/accounts/login/",
            {"email": "refresh@example.com", "password": "Strongpass123!"},
            format="json",
        )

    def test_refresh_with_cookie(self):
        res = self.client.post("/api/accounts/token/refresh/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # 新しい access_token Cookie が発行されていること
        self.assertIn(ACCESS_COOKIE_NAME, res.cookies)
        # ROTATE_REFRESH_TOKENS=True なので refresh も再発行される
        self.assertIn(REFRESH_COOKIE_NAME, res.cookies)

    def test_refresh_without_cookie_fails(self):
        client = APIClient()
        res = client.post("/api/accounts/token/refresh/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class LogoutTests(_BaseAuthTestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            email="logout@example.com", name="Logout", password="Strongpass123!"
        )
        self.client.post(
            "/api/accounts/login/",
            {"email": "logout@example.com", "password": "Strongpass123!"},
            format="json",
        )

    def test_logout_clears_cookies_and_blacklists_refresh(self):
        # Cookie で認証された状態でログアウト
        res = self.client.post("/api/accounts/logout/")
        self.assertEqual(res.status_code, status.HTTP_205_RESET_CONTENT)
        self.assertTrue(_is_cookie_cleared(self.client, ACCESS_COOKIE_NAME))
        self.assertTrue(_is_cookie_cleared(self.client, REFRESH_COOKIE_NAME))

    def test_logout_requires_authentication(self):
        client = APIClient()
        res = client.post("/api/accounts/logout/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class ProfileTests(_BaseAuthTestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            email="profile@example.com", name="Profile", password="Strongpass123!"
        )

    def test_profile_requires_authentication(self):
        res = self.client.get("/api/accounts/profile/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_returns_authenticated_user(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.get("/api/accounts/profile/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["email"], "profile@example.com")

    def test_profile_sets_csrf_cookie(self):
        # @ensure_csrf_cookie により認証成功時に csrftoken が発行される
        self.client.force_authenticate(user=self.user)
        res = self.client.get("/api/accounts/profile/")
        self.assertIn("csrftoken", res.cookies)


class CSRFEnforcementTests(_BaseAuthTestCase):
    """CSRF が enforce_csrf_checks=True のクライアントで実際に強制されるか"""

    def setUp(self):
        self.user = CustomUser.objects.create_user(
            email="csrf@example.com", name="Csrf", password="Strongpass123!"
        )

    def test_unsafe_method_without_csrf_header_is_rejected(self):
        # CSRF を強制するクライアント
        client = APIClient(enforce_csrf_checks=True)
        client.post(
            "/api/accounts/login/",
            {"email": "csrf@example.com", "password": "Strongpass123!"},
            format="json",
        )
        # access_token Cookie 経由認証 + CSRF ヘッダ無し → 403
        res = client.post("/api/accounts/logout/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_unsafe_method_with_valid_csrf_header_succeeds(self):
        client = APIClient(enforce_csrf_checks=True)
        client.post(
            "/api/accounts/login/",
            {"email": "csrf@example.com", "password": "Strongpass123!"},
            format="json",
        )
        # profile を叩いて csrftoken を発行
        client.get("/api/accounts/profile/")
        csrf_token = client.cookies["csrftoken"].value
        res = client.post(
            "/api/accounts/logout/",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(res.status_code, status.HTTP_205_RESET_CONTENT)

    def test_safe_method_does_not_require_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        # Cookie で認証
        client.post(
            "/api/accounts/login/",
            {"email": "csrf@example.com", "password": "Strongpass123!"},
            format="json",
        )
        # GET は CSRF 不要
        res = client.get("/api/accounts/profile/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
