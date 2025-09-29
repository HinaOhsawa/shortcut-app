# backend/shortcuts/views.py 
from rest_framework import generics, permissions
from .models import Shortcut
from .serializers import ShortcutSerializer


class ShortcutListCreateView(generics.ListCreateAPIView):
    serializer_class = ShortcutSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # ログイン中のユーザーのショートカットだけ取得
        return Shortcut.objects.filter(user=self.request.user).order_by("sort_order", "created_at")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)