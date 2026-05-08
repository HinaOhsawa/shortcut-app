# accounts/urls.py
from django.urls import path
from .views import (
    CookieTokenRefreshView,
    LoginView,
    LogoutView,
    ProfileView,
    RegisterView,
)

urlpatterns = [
    # トークンは HttpOnly Cookie に格納する。Authorization ヘッダフローは廃止。
    path("token/refresh/", CookieTokenRefreshView.as_view(), name="token_refresh"),
    path("profile/", ProfileView.as_view(), name="profile"),
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
]
