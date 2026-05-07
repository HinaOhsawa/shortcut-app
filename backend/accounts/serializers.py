# accounts/serializers.py
from rest_framework import serializers
from .models import CustomUser
from rest_framework.validators import UniqueValidator
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import AuthenticationFailed

# ログイン用シリアライザ
class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(
        error_messages={
            "blank": "メールアドレスは必須です。",
            "invalid": "メールアドレスの形式が正しくありません。",
        }
    )
    password = serializers.CharField(
        write_only=True,
        error_messages={
            "blank": "パスワードを入力してください。",
        }
    )

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        if not email or not password:
            raise serializers.ValidationError("メールアドレスとパスワードを入力してください。")

        user = authenticate(request=self.context.get("request"), email=email, password=password)

        if not user:
            raise AuthenticationFailed("メールアドレスまたはパスワードが正しくありません。")

        if not user.is_active:
            raise AuthenticationFailed("このアカウントは無効です。")

        attrs["user"] = user
        return attrs
    

# ユーザー登録用シリアライザ
# ModelSerializer を継承
class RegisterSerializer(serializers.ModelSerializer):

    # APIレスポンスではパスワードを返さないようにするため,パスワードは書き込み専用,
    password = serializers.CharField(write_only=True,
        min_length=8,
        error_messages={
            "blank": "パスワードを入力してください。",
            "min_length": "パスワードは8文字以上で入力してください。",
        }
    )
    email = serializers.EmailField(
        validators=[UniqueValidator(queryset=CustomUser.objects.all(),
            message="このメールアドレスは既に登録されています。")],
        error_messages={
            "invalid": "メールアドレスの形式が正しくありません。",
            "blank": "メールアドレスは必須です。",
        }
    )
    name = serializers.CharField(
        max_length=50,
        error_messages={
            "blank": "名前は必須です。",
            "max_length": "名前は50文字以内で入力してください。",
        }
    )

    class Meta:
        model = CustomUser
        # API で受け付けたい/返したいフィールドを列挙
        fields = ("name", "email", "password")

    def validate_password(self, value):
        # Django の AUTH_PASSWORD_VALIDATORS（最小長・連番除外・既知漏洩等）を適用
        # ユーザー属性類似チェックのため初期化中の name/email をダミー渡し
        attrs = self.initial_data
        try:
            user = CustomUser(
                email=attrs.get("email", ""),
                name=attrs.get("name", ""),
            )
            validate_password(value, user=user)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def create(self, validated_data):
        user = CustomUser(
            email=validated_data["email"],
            name=validated_data["name"]
        )
        # パスワードはハッシュ化
        user.set_password(validated_data["password"]) 
        
        # DBに保存
        user.save()
        return user
    

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ("id", "name", "email")