from rest_framework import serializers
from .models import Application, Category, Shortcut


class ApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = ["id", "name", "created_at", "updated_at"]
        read_only_fields = ("id", "created_at", "updated_at")


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "sort_order"]
        read_only_fields = ("id",)


class ShortcutSerializer(serializers.ModelSerializer):
    app_name = serializers.CharField(source="app.name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Shortcut
        fields = [
            "id",
            "user",
            "app",
            "app_name",
            "category",
            "category_name",
            "command_name",
            "shortcut_key",
            "note",
            "sort_order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ("id", "user", "created_at", "updated_at")

    def create(self, validated_data):
        # user をリクエストからセット
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            validated_data["user"] = request.user
        return super().create(validated_data)
