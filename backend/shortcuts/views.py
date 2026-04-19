# backend/shortcuts/views.py
from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Application, Category, Shortcut
from .serializers import (
    ApplicationSerializer,
    CategorySerializer,
    ShortcutSerializer,
)


class ShortcutListCreateView(generics.ListCreateAPIView):
    serializer_class = ShortcutSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Shortcut.objects.filter(user=self.request.user).order_by(
            "sort_order", "created_at"
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ShortcutDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ShortcutSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Shortcut.objects.filter(user=self.request.user)


class ShortcutReorderView(APIView):
    """
    POST /api/shortcuts/reorder/
    body: { "order": ["<id1>", "<id2>", ...] }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        order = request.data.get("order")
        if not isinstance(order, list):
            return Response(
                {"detail": "order (list of ids) is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        shortcuts = Shortcut.objects.filter(user=request.user, id__in=order)
        by_id = {str(s.id): s for s in shortcuts}

        to_update = []
        for index, raw_id in enumerate(order):
            shortcut = by_id.get(str(raw_id))
            if shortcut is not None:
                shortcut.sort_order = index
                to_update.append(shortcut)

        with transaction.atomic():
            Shortcut.objects.bulk_update(to_update, ["sort_order"])

        return Response({"detail": "ok", "updated": len(to_update)})


class ApplicationListCreateView(generics.ListCreateAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Application.objects.filter(user=self.request.user).order_by("name")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Category.objects.filter(user=self.request.user).order_by(
            "sort_order", "name"
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
