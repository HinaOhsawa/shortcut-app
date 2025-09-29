from django.urls import path
from .views import ShortcutListCreateView

urlpatterns = [
    path("", ShortcutListCreateView.as_view(), name="shortcut-list-create"),
]