import uuid
from django.db import models
from django.conf import settings


class Application(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="applications"
    )
    name = models.CharField(max_length=100, default="Untitled")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "applications"
        unique_together = ("user", "name")
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.user})"


class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="categories"
    )
    name = models.CharField(max_length=50, default="未分類")
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = "categories"
        unique_together = ("user", "name")
        ordering = ["sort_order", "name"]

    def __str__(self):
        return f"{self.name} ({self.user})"


class Shortcut(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE, # アプリ削除時にショートカットも削除
        related_name="shortcuts"
    )
    app = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name="shortcuts",
        null=True,
        blank=True
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shortcuts"
    )

    command_name = models.CharField(max_length=100)
    shortcut_key = models.CharField(max_length=50)
    note = models.TextField(blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "shortcuts"
        unique_together = ("user", "app", "command_name", "shortcut_key")
        ordering = ["sort_order", "created_at"]

    def save(self, *args, **kwargs):
        # アプリが未指定ならデフォルトアプリを自動セット
        if self.app is None:
            default_app, _ = Application.objects.get_or_create(
                user=self.user,
                name="Untitled",
            )
            self.app = default_app

        # カテゴリが未指定なら「未分類」を自動セット
        if self.category is None:
            default_category, _ = Category.objects.get_or_create(
                user=self.user,
                name="未分類",
                defaults={"sort_order": 0}
            )
            self.category = default_category

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.shortcut_key} → {self.command_name}"