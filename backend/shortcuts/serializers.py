from rest_framework import serializers
from .models import Shortcut


class ShortcutSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shortcut
        fields = [
            "id",
            "user",
            "app",
            "category",
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