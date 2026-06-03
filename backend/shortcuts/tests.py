from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import CustomUser

from .models import Application, Category, Shortcut


class AuthenticationRequiredTests(APITestCase):
    """全エンドポイントが未認証アクセスを拒否することを確認"""

    def test_shortcuts_list_requires_auth(self):
        res = self.client.get("/api/shortcuts/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_applications_list_requires_auth(self):
        res = self.client.get("/api/shortcuts/applications/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_categories_list_requires_auth(self):
        res = self.client.get("/api/shortcuts/categories/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_reorder_requires_auth(self):
        res = self.client.post("/api/shortcuts/reorder/", {"order": []}, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class IsolationTestsBase(APITestCase):
    """ユーザー間でリソースが分離されていることを確認するための共通setup"""

    def setUp(self):
        self.alice = CustomUser.objects.create_user(
            email="alice@example.com", name="Alice", password="Strongpass123!"
        )
        self.bob = CustomUser.objects.create_user(
            email="bob@example.com", name="Bob", password="Strongpass123!"
        )

        self.alice_app = Application.objects.create(user=self.alice, name="Alice App")
        self.bob_app = Application.objects.create(user=self.bob, name="Bob App")

        self.alice_cat = Category.objects.create(user=self.alice, name="Alice Cat")
        self.bob_cat = Category.objects.create(user=self.bob, name="Bob Cat")

        self.alice_shortcut = Shortcut.objects.create(
            user=self.alice,
            app=self.alice_app,
            category=self.alice_cat,
            command_name="alice cmd",
            shortcut_key="Cmd + A",
        )
        self.bob_shortcut = Shortcut.objects.create(
            user=self.bob,
            app=self.bob_app,
            category=self.bob_cat,
            command_name="bob cmd",
            shortcut_key="Cmd + B",
        )


class ShortcutIsolationTests(IsolationTestsBase):
    def test_list_returns_only_own_shortcuts(self):
        self.client.force_authenticate(user=self.alice)
        res = self.client.get("/api/shortcuts/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = {item["id"] for item in res.data}
        self.assertIn(str(self.alice_shortcut.id), ids)
        self.assertNotIn(str(self.bob_shortcut.id), ids)

    def test_cannot_retrieve_other_users_shortcut(self):
        self.client.force_authenticate(user=self.alice)
        res = self.client.get(f"/api/shortcuts/{self.bob_shortcut.id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_update_other_users_shortcut(self):
        self.client.force_authenticate(user=self.alice)
        res = self.client.patch(
            f"/api/shortcuts/{self.bob_shortcut.id}/",
            {"command_name": "hijacked"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.bob_shortcut.refresh_from_db()
        self.assertEqual(self.bob_shortcut.command_name, "bob cmd")

    def test_cannot_delete_other_users_shortcut(self):
        self.client.force_authenticate(user=self.alice)
        res = self.client.delete(f"/api/shortcuts/{self.bob_shortcut.id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Shortcut.objects.filter(id=self.bob_shortcut.id).exists())

    def test_reorder_only_affects_own_shortcuts(self):
        # Alice が Bob のショートカット ID を含めて reorder してもサイレントに無視されるべき
        self.client.force_authenticate(user=self.alice)
        res = self.client.post(
            "/api/shortcuts/reorder/",
            {"order": [str(self.bob_shortcut.id), str(self.alice_shortcut.id)]},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Bob のショートカットの sort_order は変わっていないこと
        original_order = self.bob_shortcut.sort_order
        self.bob_shortcut.refresh_from_db()
        self.assertEqual(self.bob_shortcut.sort_order, original_order)


class ApplicationIsolationTests(IsolationTestsBase):
    def test_list_returns_only_own_applications(self):
        self.client.force_authenticate(user=self.alice)
        res = self.client.get("/api/shortcuts/applications/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = {item["id"] for item in res.data}
        self.assertIn(str(self.alice_app.id), ids)
        self.assertNotIn(str(self.bob_app.id), ids)

    def test_cannot_retrieve_other_users_application(self):
        self.client.force_authenticate(user=self.alice)
        res = self.client.get(f"/api/shortcuts/applications/{self.bob_app.id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_update_other_users_application(self):
        self.client.force_authenticate(user=self.alice)
        res = self.client.patch(
            f"/api/shortcuts/applications/{self.bob_app.id}/",
            {"name": "hijacked"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.bob_app.refresh_from_db()
        self.assertEqual(self.bob_app.name, "Bob App")

    def test_cannot_delete_other_users_application(self):
        self.client.force_authenticate(user=self.alice)
        res = self.client.delete(f"/api/shortcuts/applications/{self.bob_app.id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Application.objects.filter(id=self.bob_app.id).exists())


class CategoryIsolationTests(IsolationTestsBase):
    def test_list_returns_only_own_categories(self):
        self.client.force_authenticate(user=self.alice)
        res = self.client.get("/api/shortcuts/categories/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = {item["id"] for item in res.data}
        self.assertIn(str(self.alice_cat.id), ids)
        self.assertNotIn(str(self.bob_cat.id), ids)

    def test_cannot_retrieve_other_users_category(self):
        self.client.force_authenticate(user=self.alice)
        res = self.client.get(f"/api/shortcuts/categories/{self.bob_cat.id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_update_other_users_category(self):
        self.client.force_authenticate(user=self.alice)
        res = self.client.patch(
            f"/api/shortcuts/categories/{self.bob_cat.id}/",
            {"name": "hijacked"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.bob_cat.refresh_from_db()
        self.assertEqual(self.bob_cat.name, "Bob Cat")

    def test_cannot_delete_other_users_category(self):
        self.client.force_authenticate(user=self.alice)
        res = self.client.delete(f"/api/shortcuts/categories/{self.bob_cat.id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Category.objects.filter(id=self.bob_cat.id).exists())


class CreateAttributesOwnerTests(IsolationTestsBase):
    """作成時に request.user が必ず所有者として設定される"""

    def test_create_shortcut_assigns_current_user(self):
        self.client.force_authenticate(user=self.alice)
        res = self.client.post(
            "/api/shortcuts/",
            {
                "command_name": "new cmd",
                "shortcut_key": "Cmd + N",
                "app": str(self.alice_app.id),
                "category": str(self.alice_cat.id),
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        created = Shortcut.objects.get(id=res.data["id"])
        self.assertEqual(created.user, self.alice)

    def test_create_application_assigns_current_user(self):
        self.client.force_authenticate(user=self.alice)
        res = self.client.post(
            "/api/shortcuts/applications/",
            {"name": "new app"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        created = Application.objects.get(id=res.data["id"])
        self.assertEqual(created.user, self.alice)

    def test_create_category_assigns_current_user(self):
        self.client.force_authenticate(user=self.alice)
        res = self.client.post(
            "/api/shortcuts/categories/",
            {"name": "new cat"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        created = Category.objects.get(id=res.data["id"])
        self.assertEqual(created.user, self.alice)
