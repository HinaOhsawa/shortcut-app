from django.urls import path
from .views import (
    ApplicationListCreateView,
    CategoryListCreateView,
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
        "categories/",
        CategoryListCreateView.as_view(),
        name="category-list-create",
    ),
]
