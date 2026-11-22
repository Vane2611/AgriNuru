from django.shortcuts import get_object_or_404

from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated

from .models import FarmerProfile
from .serializers import FarmerProfileSerializer


class FarmerProfileView(RetrieveUpdateAPIView):
    serializer_class = FarmerProfileSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return FarmerProfile.objects.select_related("user").filter(
            user=self.request.user
        )

    def get_object(self):
        profile = get_object_or_404(self.get_queryset(), user=self.request.user)
        self.check_object_permissions(self.request, profile)
        return profile
