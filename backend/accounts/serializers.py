from rest_framework import serializers
from .models import CustomUser
from rest_framework.validators import UniqueValidator


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