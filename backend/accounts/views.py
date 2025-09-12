from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from .models import CustomUser
from .serializers import RegisterSerializer

# ユーザープロフィール取得用ビュー
class ProfileView(APIView):
    permission_classes = [IsAuthenticated]  # ログイン必須

    def get(self, request):
        user = request.user  # JWT からユーザーが取れる
        return Response({
            "id": user.id,
            "email": user.email,
            "name": user.name,
        })
    
# ユーザー登録用ビュー
class RegisterView(APIView):#APIView を継承したクラス
    permission_classes = [AllowAny]  # 誰でもアクセス可能

    def post(self, request):
        # シリアライザにデータを渡す
        serializer = RegisterSerializer(data=request.data)

        # is_valid() を呼ぶことで、シリアライザのフィールド定義に従ってデータが正しいかチェック
        if serializer.is_valid():

            # serializer.save() は内部で RegisterSerializer.create() を呼ぶ
            user = serializer.save()

            # JWTトークンを発行
            refresh = RefreshToken.for_user(user)

            # 作成したユーザー情報とトークンをレスポンスとして返す
            return Response(
                {
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "name": user.name,
                    },
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
                status=status.HTTP_201_CREATED,
            )
        
        # バリデーションエラーの場合はエラーメッセージを返す
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)