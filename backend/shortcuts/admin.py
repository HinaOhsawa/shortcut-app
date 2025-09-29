from django.contrib import admin
from .models import Application, Category, Shortcut


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "name", "created_at", "updated_at")
    list_filter = ("user", "created_at")
    search_fields = ("name", "user__email")  # ユーザーのメールで検索可能
    ordering = ("created_at",)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "name", "sort_order")
    list_filter = ("user",)
    search_fields = ("name", "user__email")
    ordering = ("sort_order",)


@admin.register(Shortcut)
class ShortcutAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "app", "category", "command_name", "shortcut_key", "created_at")
    list_filter = ("user", "app", "category")
    search_fields = ("command_name", "shortcut_key", "user__email")
    ordering = ("created_at",)