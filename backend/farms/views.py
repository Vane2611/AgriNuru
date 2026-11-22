from django.db.models import ProtectedError
from django.shortcuts import get_object_or_404

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from farmers.models import FarmerProfile

from .models import Farm, Field
from .serializers import FarmSerializer, FieldSerializer


class FarmerOwnedQuerysetMixin:
    permission_classes = (IsAuthenticated,)

    def get_farmer_profile(self):
        return get_object_or_404(
            FarmerProfile,
            user=self.request.user,
        )

    def get_owned_farm(self):
        return get_object_or_404(
            Farm.objects.select_related("farmer"),
            pk=self.kwargs["farm_pk"],
            farmer__user=self.request.user,
        )


class FarmListCreateView(FarmerOwnedQuerysetMixin, generics.ListCreateAPIView):
    serializer_class = FarmSerializer

    def get_queryset(self):
        return Farm.objects.filter(
            farmer__user=self.request.user
        ).select_related("farmer__user")

    def perform_create(self, serializer):
        serializer.save(farmer=self.get_farmer_profile())


class FarmDetailView(FarmerOwnedQuerysetMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FarmSerializer
    lookup_url_kwarg = "farm_pk"

    def get_queryset(self):
        return Farm.objects.filter(
            farmer__user=self.request.user
        ).select_related("farmer__user")

    def destroy(self, request, *args, **kwargs):
        farm = self.get_object()
        try:
            self.perform_destroy(farm)
        except ProtectedError:
            return Response(
                {
                    "detail": (
                        "This farm cannot be deleted because it has "
                        "fields or related historical records."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class FarmFieldsListCreateView(
    FarmerOwnedQuerysetMixin,
    generics.ListCreateAPIView,
):
    serializer_class = FieldSerializer

    def get_queryset(self):
        return Field.objects.filter(
            farm__pk=self.kwargs["farm_pk"],
            farm__farmer__user=self.request.user,
        ).select_related("farm", "farm__farmer")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["farm"] = self.get_owned_farm()
        return context

    def perform_create(self, serializer):
        serializer.save(farm=self.get_owned_farm())


class FarmFieldDetailView(
    FarmerOwnedQuerysetMixin,
    generics.RetrieveUpdateDestroyAPIView,
):
    serializer_class = FieldSerializer
    lookup_url_kwarg = "field_pk"

    def get_queryset(self):
        return Field.objects.filter(
            farm__pk=self.kwargs["farm_pk"],
            farm__farmer__user=self.request.user,
        ).select_related("farm", "farm__farmer")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["farm"] = self.get_owned_farm()
        return context

    def destroy(self, request, *args, **kwargs):
        field = self.get_object()
        try:
            self.perform_destroy(field)
        except ProtectedError:
            return Response(
                {
                    "detail": (
                        "This field cannot be deleted because it has "
                        "related production or historical records."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
