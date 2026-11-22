from django.db.models import Q
from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404

from rest_framework import generics, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Crop, CropRequirement, CropVariety
from .permissions import IsAuthenticatedReadOnlyOrStaffWrite
from .serializers import (
    CropRequirementSerializer,
    CropSerializer,
    CropVarietySerializer,
)


class ProtectedDeleteMixin:
    protected_delete_message = (
        "This catalogue record cannot be deleted because it is referenced "
        "by other records."
    )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except ProtectedError:
            return Response(
                {"detail": self.protected_delete_message},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class CropListCreateView(generics.ListCreateAPIView):
    serializer_class = CropSerializer
    permission_classes = (IsAuthenticatedReadOnlyOrStaffWrite,)

    def get_queryset(self):
        queryset = Crop.objects.all()
        if not self.request.user.is_staff:
            queryset = queryset.filter(is_active=True)
        return queryset


class CropDetailView(ProtectedDeleteMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CropSerializer
    permission_classes = (IsAuthenticatedReadOnlyOrStaffWrite,)

    def get_queryset(self):
        queryset = Crop.objects.all()
        if not self.request.user.is_staff:
            queryset = queryset.filter(is_active=True)
        return queryset


class CropVarietyListCreateView(generics.ListCreateAPIView):
    serializer_class = CropVarietySerializer
    permission_classes = (IsAuthenticatedReadOnlyOrStaffWrite,)

    def get_queryset(self):
        queryset = CropVariety.objects.select_related("crop")
        if not self.request.user.is_staff:
            queryset = queryset.filter(crop__is_active=True, is_active=True)
        return queryset


class CropVarietyDetailView(
    ProtectedDeleteMixin,
    generics.RetrieveUpdateDestroyAPIView,
):
    serializer_class = CropVarietySerializer
    permission_classes = (IsAuthenticatedReadOnlyOrStaffWrite,)

    def get_queryset(self):
        queryset = CropVariety.objects.select_related("crop")
        if not self.request.user.is_staff:
            queryset = queryset.filter(crop__is_active=True, is_active=True)
        return queryset


class CropVarietyListForCropView(generics.ListAPIView):
    serializer_class = CropVarietySerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        crops = Crop.objects.all()
        if not self.request.user.is_staff:
            crops = crops.filter(is_active=True)
        crop = get_object_or_404(crops, pk=self.kwargs["crop_pk"])

        varieties = crop.varieties.all()
        if not self.request.user.is_staff:
            varieties = varieties.filter(is_active=True)
        return varieties.select_related("crop")


class CropRequirementListCreateView(generics.ListCreateAPIView):
    serializer_class = CropRequirementSerializer
    permission_classes = (IsAuthenticatedReadOnlyOrStaffWrite,)

    def get_queryset(self):
        queryset = CropRequirement.objects.select_related(
            "crop",
            "variety",
            "variety__crop",
        )
        if not self.request.user.is_staff:
            queryset = queryset.filter(
                Q(crop__is_active=True)
                | Q(variety__is_active=True, variety__crop__is_active=True)
            )

        crop_id = self.request.query_params.get("crop_id")
        variety_id = self.request.query_params.get("variety_id")
        if bool(crop_id) == bool(variety_id):
            raise ValidationError(
                {
                    "detail": (
                        "Provide exactly one filter: crop_id or variety_id."
                    )
                }
            )

        filter_name, filter_value = (
            ("crop_id", crop_id) if crop_id else ("variety_id", variety_id)
        )
        try:
            parsed_id = serializers.IntegerField(min_value=1).run_validation(
                filter_value
            )
        except serializers.ValidationError as exc:
            raise ValidationError({filter_name: exc.detail}) from exc

        return queryset.filter(**{filter_name: parsed_id})


class CropRequirementDetailView(
    ProtectedDeleteMixin,
    generics.RetrieveUpdateDestroyAPIView,
):
    serializer_class = CropRequirementSerializer
    permission_classes = (IsAuthenticatedReadOnlyOrStaffWrite,)

    def get_queryset(self):
        queryset = CropRequirement.objects.select_related(
            "crop",
            "variety",
            "variety__crop",
        )
        if not self.request.user.is_staff:
            queryset = queryset.filter(
                Q(crop__is_active=True)
                | Q(variety__is_active=True, variety__crop__is_active=True)
            )
        return queryset
