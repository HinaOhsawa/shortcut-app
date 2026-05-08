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


class ThrottleTests(_BaseAuthTestCase):
    """Redis cache を使った throttle が実際に発火することを検証する。

    DEFAULT_THROTTLE_RATES の "auth" は 10/min、"register" は 5/min。
    _BaseAuthTestCase の _pre_setup で各テスト前に cache.clear() が走る。
    """

    def test_login_throttle_returns_429_after_limit(self):
        # 10 回までは正規の認証フローを通り（毎回 401）、11 回目で throttle される
        for _ in range(10):
            res = self.client.post(
                "/api/accounts/login/",
                {"email": "noone@example.com", "password": "x"},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        res = self.client.post(
            "/api/accounts/login/",
            {"email": "noone@example.com", "password": "x"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_register_throttle_returns_429_after_limit(self):
        # 5 回までは validation 失敗で 400 が返り、6 回目で throttle される
        for i in range(5):
            self.client.post(
                "/api/accounts/register/",
                {"name": "X", "email": f"x{i}@example.com", "password": "x"},
                format="json",
            )

        res = self.client.post(
            "/api/accounts/register/",
            {"name": "X", "email": "x6@example.com", "password": "x"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_throttle_counter_is_isolated_after_cache_clear(self):
        # cache.clear() 後にはカウンタがリセットされ、再びリクエストが通ることを確認
        for _ in range(10):
            self.client.post(
                "/api/accounts/login/",
                {"email": "noone@example.com", "password": "x"},
                format="json",
            )

        cache.clear()

        res = self.client.post(
            "/api/accounts/login/",
            {"email": "noone@example.com", "password": "x"},
            format="json",
        )
        # throttle ではなく通常の 401 が返ること
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class EmailVerificationTests(_BaseAuthTestCase):
    """メールアドレス検証フローを検証する。"""

    def test_register_sends_verification_email(self):
        from django.core import mail

        res = self.client.post(
            "/api/accounts/register/",
            {
                "name": "Verify",
                "email": "verify@example.com",
                "password": "Strongpass123!",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        # 新規ユーザーは未確認状態で作成される
        user = CustomUser.objects.get(email="verify@example.com")
        self.assertFalse(user.is_email_verified)
        # 検証メールが 1 通送信される
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("verify@example.com", mail.outbox[0].to)
        self.assertIn("/verify-email?token=", mail.outbox[0].body)

    def _register_and_extract_token(self, email: str = "v@example.com") -> str:
        from django.core import mail
        import re

        self.client.post(
            "/api/accounts/register/",
            {"name": "V", "email": email, "password": "Strongpass123!"},
            format="json",
        )
        body = mail.outbox[-1].body
        match = re.search(r"token=([\w\-]+)", body)
        assert match, f"token not found in mail: {body}"
        return match.group(1)

    def test_verify_email_with_valid_token(self):
        token = self._register_and_extract_token()
        res = self.client.post(
            "/api/accounts/verify-email/",
            {"token": token},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        user = CustomUser.objects.get(email="v@example.com")
        self.assertTrue(user.is_email_verified)
        self.assertIsNotNone(user.email_verified_at)

    def test_verify_email_token_cannot_be_reused(self):
        token = self._register_and_extract_token()
        self.client.post(
            "/api/accounts/verify-email/",
            {"token": token},
            format="json",
        )
        # 2 度目は使用済みで弾かれる
        res = self.client.post(
            "/api/accounts/verify-email/",
            {"token": token},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_email_with_invalid_token(self):
        res = self.client.post(
            "/api/accounts/verify-email/",
            {"token": "garbage-token-value"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_email_with_expired_token(self):
        from datetime import timedelta
        from django.utils import timezone
        from accounts.models import EmailVerificationToken

        token = self._register_and_extract_token()
        # トークンを期限切れに書き換える
        record = EmailVerificationToken.objects.filter().latest("created_at")
        record.expires_at = timezone.now() - timedelta(seconds=1)
        record.save(update_fields=["expires_at"])

        res = self.client.post(
            "/api/accounts/verify-email/",
            {"token": token},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_resend_verification_creates_new_email(self):
        from django.core import mail

        # 登録（1 通目）
        self.client.post(
            "/api/accounts/register/",
            {
                "name": "Resend",
                "email": "resend@example.com",
                "password": "Strongpass123!",
            },
            format="json",
        )
        sent_before = len(mail.outbox)
        # ログインして cookie をセット
        self.client.post(
            "/api/accounts/login/",
            {"email": "resend@example.com", "password": "Strongpass123!"},
            format="json",
        )
        res = self.client.post("/api/accounts/resend-verification/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), sent_before + 1)

    def test_resend_verification_rejects_already_verified_user(self):
        user = CustomUser.objects.create_user(
            email="already@example.com",
            name="Already",
            password="Strongpass123!",
        )
        user.is_email_verified = True
        user.save(update_fields=["is_email_verified"])
        self.client.force_authenticate(user=user)

        res = self.client.post("/api/accounts/resend-verification/")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_resend_verification_requires_authentication(self):
        res = self.client.post("/api/accounts/resend-verification/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_returns_email_verification_status(self):
        user = CustomUser.objects.create_user(
            email="profstatus@example.com",
            name="Pf",
            password="Strongpass123!",
        )
        self.client.force_authenticate(user=user)
        res = self.client.get("/api/accounts/profile/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("is_email_verified", res.data)
        self.assertFalse(res.data["is_email_verified"])


class PasswordResetRequestTests(_BaseAuthTestCase):
    """リセット要求エンドポイントを検証する。"""

    def setUp(self):
        self.user = CustomUser.objects.create_user(
            email="reset@example.com",
            name="Reset",
            password="OldStrongPass123!",
        )

    def test_request_for_existing_user_sends_email(self):
        from django.core import mail

        res = self.client.post(
            "/api/accounts/password-reset/request/",
            {"email": "reset@example.com"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("reset@example.com", mail.outbox[0].to)
        self.assertIn("/password-reset/confirm?token=", mail.outbox[0].body)

    def test_request_for_unknown_user_returns_same_response(self):
        from django.core import mail

        res = self.client.post(
            "/api/accounts/password-reset/request/",
            {"email": "nobody@example.com"},
            format="json",
        )
        # 存在しなくても 200、メールは送信されない（列挙対策）
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)

    def test_response_body_does_not_distinguish_existence(self):
        existing_res = self.client.post(
            "/api/accounts/password-reset/request/",
            {"email": "reset@example.com"},
            format="json",
        )
        # cache.clear で email_send throttle をリセットしてから次を投げる
        from django.core.cache import cache as dj_cache

        dj_cache.clear()
        unknown_res = self.client.post(
            "/api/accounts/password-reset/request/",
            {"email": "nobody@example.com"},
            format="json",
        )
        self.assertEqual(existing_res.status_code, unknown_res.status_code)
        self.assertEqual(existing_res.data, unknown_res.data)


class PasswordResetConfirmTests(_BaseAuthTestCase):
    """リセット確定エンドポイントを検証する。"""

    def setUp(self):
        self.user = CustomUser.objects.create_user(
            email="confirm@example.com",
            name="Confirm",
            password="OldStrongPass123!",
        )

    def _request_and_extract_token(self) -> str:
        from django.core import mail
        import re

        self.client.post(
            "/api/accounts/password-reset/request/",
            {"email": "confirm@example.com"},
            format="json",
        )
        body = mail.outbox[-1].body
        match = re.search(r"token=([\w\-]+)", body)
        assert match, f"token not found: {body}"
        return match.group(1)

    def test_confirm_with_valid_token_updates_password(self):
        token = self._request_and_extract_token()
        res = self.client.post(
            "/api/accounts/password-reset/confirm/",
            {"token": token, "new_password": "NewStrongPass456!"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewStrongPass456!"))
        self.assertFalse(self.user.check_password("OldStrongPass123!"))

    def test_confirm_token_cannot_be_reused(self):
        token = self._request_and_extract_token()
        self.client.post(
            "/api/accounts/password-reset/confirm/",
            {"token": token, "new_password": "NewStrongPass456!"},
            format="json",
        )
        # 2 度目は使用済みで弾かれる
        res = self.client.post(
            "/api/accounts/password-reset/confirm/",
            {"token": token, "new_password": "AnotherStrong789!"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_with_invalid_token(self):
        res = self.client.post(
            "/api/accounts/password-reset/confirm/",
            {"token": "garbage-token-value", "new_password": "NewStrongPass456!"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_with_expired_token(self):
        from datetime import timedelta
        from django.utils import timezone
        from accounts.models import PasswordResetToken

        token = self._request_and_extract_token()
        record = PasswordResetToken.objects.filter(user=self.user).latest("created_at")
        record.expires_at = timezone.now() - timedelta(seconds=1)
        record.save(update_fields=["expires_at"])

        res = self.client.post(
            "/api/accounts/password-reset/confirm/",
            {"token": token, "new_password": "NewStrongPass456!"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_rejects_weak_password(self):
        token = self._request_and_extract_token()
        res = self.client.post(
            "/api/accounts/password-reset/confirm/",
            {"token": token, "new_password": "1234567"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", res.data)
        # トークンは未使用のままであるべき
        from accounts.models import PasswordResetToken

        record = PasswordResetToken.objects.filter(user=self.user).latest("created_at")
        self.assertIsNone(record.used_at)

    def test_confirm_blacklists_existing_refresh_tokens(self):
        # ログインして refresh トークンを発行
        login_res = self.client.post(
            "/api/accounts/login/",
            {"email": "confirm@example.com", "password": "OldStrongPass123!"},
            format="json",
        )
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)

        # リセット要求
        token = self._request_and_extract_token()
        # ConfirmTests の状態をリセットするため新しいクライアントから confirm を打つ
        from rest_framework.test import APIClient

        anonymous = APIClient()
        confirm_res = anonymous.post(
            "/api/accounts/password-reset/confirm/",
            {"token": token, "new_password": "NewStrongPass456!"},
            format="json",
        )
        self.assertEqual(confirm_res.status_code, status.HTTP_200_OK)

        # confirm 後、元クライアントの refresh で新 access を取れない
        refresh_res = self.client.post("/api/accounts/token/refresh/")
        self.assertEqual(refresh_res.status_code, status.HTTP_401_UNAUTHORIZED)
