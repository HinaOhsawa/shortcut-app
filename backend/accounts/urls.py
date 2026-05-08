# accounts/urls.py
from django.urls import path
from .views import (
    CookieTokenRefreshView,
    LoginView,
    LogoutView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    ProfileView,
    RegisterView,
    ResendVerificationView,
    VerifyEmailView,
)

urlpatterns = [
    # トークンは HttpOnly Cookie に格納する。Authorization ヘッダフローは廃止。
    path("token/refresh/", CookieTokenRefreshView.as_view(), name="token_refresh"),
    path("profile/", ProfileView.as_view(), name="profile"),
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("verify-email/", VerifyEmailView.as_view(), name="verify_email"),
    path(
        "resend-verification/",
        ResendVerificationView.as_view(),
        name="resend_verification",
    ),
    path(
        "password-reset/request/",
        PasswordResetRequestView.as_view(),
        name="password_reset_request",
    ),
    path(
        "password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
]
