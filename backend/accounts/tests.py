from rest_framework import status
from rest_framework.test import APITestCase

from .models import CustomUser


class RegisterTests(APITestCase):
    url = "/api/accounts/register/"

    def test_register_success(self):
        res = self.client.post(
            self.url,
            {"name": "Alice", "email": "alice@example.com", "password": "Strongpass123!"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)
        self.assertEqual(res.data["user"]["email"], "alice@example.com")

    def test_register_rejects_weak_password(self):
        # 短すぎる + 数字のみ → AUTH_PASSWORD_VALIDATORS で弾かれる
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


class LoginTests(APITestCase):
    url = "/api/accounts/login/"

    def setUp(self):
        self.user = CustomUser.objects.create_user(
            email="login@example.com", name="Login", password="Strongpass123!"
        )

    def test_login_success(self):
        res = self.client.post(
            self.url,
            {"email": "login@example.com", "password": "Strongpass123!"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)

    def test_login_wrong_password(self):
        res = self.client.post(
            self.url,
            {"email": "login@example.com", "password": "WrongPassword!"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class LogoutTests(APITestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            email="logout@example.com", name="Logout", password="Strongpass123!"
        )
        res = self.client.post(
            "/api/accounts/login/",
            {"email": "logout@example.com", "password": "Strongpass123!"},
            format="json",
        )
        self.access = res.data["access"]
        self.refresh = res.data["refresh"]

    def test_logout_blacklists_refresh(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access}")
        res = self.client.post(
            "/api/accounts/logout/",
            {"refresh": self.refresh},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_205_RESET_CONTENT)

        # ブラックリスト後は同じ refresh を使い回せない
        refresh_res = self.client.post(
            "/api/accounts/token/refresh/",
            {"refresh": self.refresh},
            format="json",
        )
        self.assertEqual(refresh_res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_requires_authentication(self):
        res = self.client.post(
            "/api/accounts/logout/",
            {"refresh": self.refresh},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class ProfileTests(APITestCase):
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
