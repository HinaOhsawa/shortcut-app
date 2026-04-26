from django.urls import path
from .views import (
    ApplicationDetailView,
    ApplicationListCreateView,
    CategoryDetailView,
    CategoryListCreateView,
    ShortcutDetailView,
    ShortcutListCreateView,
    ShortcutReorderView,
)

urlpatterns = [
    path("", ShortcutListCreateView.as_view(), name="shortcut-list-create"),
    path("reorder/", ShortcutReorderView.as_view(), name="shortcut-reorder"),
    path(
        "applications/",
        ApplicationListCreateView.as_view(),
        name="application-list-create",
    ),
    path(
        "applications/<uuid:pk>/",
        ApplicationDetailView.as_view(),
        name="application-detail",
    ),
    path(
        "categories/",
        CategoryListCreateView.as_view(),
        name="category-list-create",
    ),
    path(
        "categories/<uuid:pk>/",
        CategoryDetailView.as_view(),
        name="category-detail",
    ),
    path("<uuid:pk>/", ShortcutDetailView.as_view(), name="shortcut-detail"),
]
