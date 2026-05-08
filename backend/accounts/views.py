# accounts/views.py
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics, exceptions
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .cookies import (
    REFRESH_COOKIE_NAME,
    clear_auth_cookies,
    set_auth_cookies,
)
from .email import issue_email_verification_token, send_verification_email
from .models import EmailVerificationToken
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer
from .tokens import hash_token


def _issue_token_response(user, http_status: int) -> Response:
    """user に対して新規発行した access/refresh を Cookie でセットして返す。"""
    refresh = RefreshToken.for_user(user)
    response = Response(
        {"user": UserSerializer(user).data},
        status=http_status,
    )
    set_auth_cookies(response, access=str(refresh.access_token), refresh=str(refresh))
    return response


# ユーザープロフィール取得用ビュー
# csrftoken Cookie を確実に発行するため ensure_csrf_cookie を付与する。
# フロントエンドがアプリ起動時にここを叩けば、以後の POST 系で CSRF ヘッダを付与可能になる。
@method_decorator(ensure_csrf_cookie, name="dispatch")
class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "is_email_verified": user.is_email_verified,
        })


# ログイン用ビュー
class LoginView(generics.GenericAPIView):
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        return _issue_token_response(user, status.HTTP_200_OK)


# ユーザー登録用ビュー
class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            # 検証メールを送信。送信失敗で登録自体を失敗にしたくないため握りつぶす運用も
            # ありうるが、開発初期は問題を見逃さないため例外を伝播させる。
            plaintext = issue_email_verification_token(user)
            send_verification_email(user, plaintext)
            return _issue_token_response(user, status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Cookie ベースのリフレッシュビュー
# Body ではなく refresh_token Cookie を読んで新しい access/refresh を Cookie に再設定する
class CookieTokenRefreshView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        raw_refresh = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if not raw_refresh:
            raise exceptions.AuthenticationFailed("refresh cookie missing")

        serializer = TokenRefreshSerializer(data={"refresh": raw_refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except (TokenError, InvalidToken) as e:
            raise exceptions.AuthenticationFailed(str(e))

        data = serializer.validated_data
        response = Response(status=status.HTTP_200_OK)
        # ROTATE_REFRESH_TOKENS=True の場合は data に新しい "refresh" が含まれる
        set_auth_cookies(response, access=data["access"], refresh=data.get("refresh"))
        return response


# ログアウト用ビュー: リフレッシュトークンを blacklist し Cookie を削除する
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        raw_refresh = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()
            except TokenError:
                # 既に無効化済みでも問題なし（冪等）
                pass

        response = Response(status=status.HTTP_205_RESET_CONTENT)
        clear_auth_cookies(response)
        return response


# メールアドレス検証ビュー
# クライアントが /verify-email?token=... のクエリから取得したトークンを Body で送る
class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        plaintext = (request.data.get("token") or "").strip()
        if not plaintext:
            return Response(
                {"detail": "トークンが必要です。"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token = EmailVerificationToken.objects.filter(
            token_hash=hash_token(plaintext),
        ).select_related("user").first()
        # 「ユーザーが存在しない」「期限切れ」「使用済み」を区別せず統一エラーで返す
        if token is None or not token.is_valid():
            return Response(
                {"detail": "トークンが無効または期限切れです。"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = token.user
        now = timezone.now()
        if not user.is_email_verified:
            user.is_email_verified = True
            user.email_verified_at = now
            user.save(update_fields=["is_email_verified", "email_verified_at", "updated_at"])

        token.used_at = now
        token.save(update_fields=["used_at"])

        return Response({"detail": "メールアドレスが確認されました。"})


# 検証メール再送ビュー
class ResendVerificationView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "email_send"

    def post(self, request):
        user = request.user
        if user.is_email_verified:
            return Response(
                {"detail": "既に確認済みです。"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        plaintext = issue_email_verification_token(user)
        send_verification_email(user, plaintext)
        return Response({"detail": "確認メールを送信しました。"})
