"""アカウント関連のメール送信ユーティリティ。

開発時は EMAIL_BACKEND=console でコンソールに出力されるだけ、
本番は SMTP backend で実送信される（呼び出し側は意識しない）。
"""

from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import CustomUser, EmailVerificationToken, PasswordResetToken
from .tokens import generate_token


def _verification_token_lifetime() -> timedelta:
    hours = int(getattr(settings, "EMAIL_VERIFICATION_TOKEN_LIFETIME_HOURS", 24))
    return timedelta(hours=hours)


def _password_reset_token_lifetime() -> timedelta:
    hours = int(getattr(settings, "PASSWORD_RESET_TOKEN_LIFETIME_HOURS", 1))
    return timedelta(hours=hours)


def _frontend_origin() -> str:
    return getattr(settings, "FRONTEND_ORIGIN", "http://localhost:3000")


def issue_email_verification_token(user: CustomUser) -> str:
    """user に新しい検証トークンを発行し、平文を返す。

    DB には hash のみ保存。呼び出し側は平文をメール本文に埋めて送信する。
    """
    plaintext, token_hash = generate_token()
    EmailVerificationToken.objects.create(
        user=user,
        token_hash=token_hash,
        expires_at=timezone.now() + _verification_token_lifetime(),
    )
    return plaintext


def send_verification_email(user: CustomUser, plaintext_token: str) -> None:
    """検証メールを送信する。"""
    verification_url = f"{_frontend_origin()}/verify-email?token={plaintext_token}"
    body = (
        f"{user.name} 様\n\n"
        "ShortcutApp にご登録いただきありがとうございます。\n"
        "以下の URL を 24 時間以内にクリックして、メールアドレスを確認してください。\n\n"
        f"{verification_url}\n\n"
        "このメールに心当たりがない場合は無視してください。\n"
    )
    send_mail(
        subject="[ShortcutApp] メールアドレスの確認をお願いします",
        message=body,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@shortcut.local"),
        recipient_list=[user.email],
        fail_silently=False,
    )


def issue_password_reset_token(user: CustomUser) -> str:
    """user に新しいパスワードリセットトークンを発行し、平文を返す。"""
    plaintext, token_hash = generate_token()
    PasswordResetToken.objects.create(
        user=user,
        token_hash=token_hash,
        expires_at=timezone.now() + _password_reset_token_lifetime(),
    )
    return plaintext


def send_password_reset_email(user: CustomUser, plaintext_token: str) -> None:
    """パスワードリセット案内メールを送信する。"""
    reset_url = f"{_frontend_origin()}/password-reset/confirm?token={plaintext_token}"
    body = (
        f"{user.name} 様\n\n"
        "ShortcutApp のパスワード再設定のリクエストを受け付けました。\n"
        "以下の URL を 1 時間以内にクリックして、新しいパスワードを設定してください。\n\n"
        f"{reset_url}\n\n"
        "このメールに心当たりがない場合は無視してください。\n"
        "リクエストは時間経過で無効になります。\n"
    )
    send_mail(
        subject="[ShortcutApp] パスワード再設定のご案内",
        message=body,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@shortcut.local"),
        recipient_list=[user.email],
        fail_silently=False,
    )
