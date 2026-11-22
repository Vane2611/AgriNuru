from rest_framework import serializers

from .models import FarmerProfile


class FarmerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = FarmerProfile
        fields = (
            "id",
            "user",
            "phone_number",
            "preferred_language",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "user", "created_at", "updated_at")
