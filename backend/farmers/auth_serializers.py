from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction

from rest_framework import serializers

from .models import FarmerProfile, phone_number_validator


User = get_user_model()

DUPLICATE_ACCOUNT_IDENTIFIER_MESSAGE = (
    "These account details are not available. "
    "Please use different username or email information."
)


class RegistrationSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150, trim_whitespace=True)
    username = serializers.CharField(max_length=150, trim_whitespace=True)
    email = serializers.EmailField(max_length=254)
    phone_number = serializers.CharField(max_length=32, trim_whitespace=True)
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        style={"input_type": "password"},
    )
    confirm_password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        style={"input_type": "password"},
    )

    def validate_full_name(self, value):
        if not value.split():
            raise serializers.ValidationError("Enter your full name.")
        return " ".join(value.split())

    def validate_username(self, value):
        if not value.strip():
            raise serializers.ValidationError("Enter a username.")
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError(
                DUPLICATE_ACCOUNT_IDENTIFIER_MESSAGE
            )
        return value

    def validate_email(self, value):
        value = User.objects.normalize_email(value.strip())
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                DUPLICATE_ACCOUNT_IDENTIFIER_MESSAGE
            )
        return value

    def validate_phone_number(self, value):
        try:
            phone_number_validator(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "The passwords do not match."}
            )

        user = User(
            username=attrs["username"],
            email=attrs["email"],
        )
        try:
            password_validation.validate_password(attrs["password"], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                {"password": list(exc.messages)}
            ) from exc

        return attrs

    def create(self, validated_data):
        full_name = validated_data["full_name"]
        name_parts = full_name.split(maxsplit=1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    username=validated_data["username"],
                    email=validated_data["email"],
                    password=validated_data["password"],
                    first_name=first_name,
                    last_name=last_name,
                )
                FarmerProfile.objects.create(
                    user=user,
                    phone_number=validated_data["phone_number"],
                )
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {
                    "username": [DUPLICATE_ACCOUNT_IDENTIFIER_MESSAGE],
                }
            ) from exc
        return user


class LoginSerializer(serializers.Serializer):
    username_or_email = serializers.CharField(
        max_length=254,
        trim_whitespace=True,
    )
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        style={"input_type": "password"},
    )


class UserSessionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField(allow_blank=True)
    first_name = serializers.CharField(allow_blank=True)
    last_name = serializers.CharField(allow_blank=True)


class FarmerSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = FarmerProfile
        fields = ("phone_number", "preferred_language")
