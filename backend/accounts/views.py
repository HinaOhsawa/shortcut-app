from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

class ProfileView(APIView):
    permission_classes = [IsAuthenticated]  # ログイン必須

    def get(self, request):
        user = request.user  # JWT からユーザーが取れる
        return Response({
            "id": user.id,
            "email": user.email,
            "name": user.name,
        })