from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404

from rest_framework import generics, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from farmers.models import FarmerProfile

from .models import (
    GrowingSeason,
    HarvestEstimate,
    HarvestRecord,
    ProductionActivity,
    ProductionCost,
)
from .serializers import (
    GrowingSeasonSerializer,
    HarvestEstimateSerializer,
    HarvestRecordSerializer,
    ProductionActivitySerializer,
    ProductionCostSerializer,
)


def parse_filter_value(query_params, name, field):
    value = query_params.get(name)
    if value is None:
        return None
    try:
        return field.run_validation(value)
    except serializers.ValidationError as exc:
        raise ValidationError({name: exc.detail}) from exc


class FarmerOwnedProductionMixin:
    permission_classes = (IsAuthenticated,)

    def get_farmer_profile(self):
        return get_object_or_404(FarmerProfile, user=self.request.user)

    def apply_filters(self, queryset, relation_prefix, date_field):
        query_params = self.request.query_params
        relation_filters = {
            "farm_id": f"{relation_prefix}field__farm_id",
            "field_id": f"{relation_prefix}field_id",
            "crop_id": f"{relation_prefix}crop_id",
            "growing_season_id": (
                f"{relation_prefix}id" if not relation_prefix else
                f"{relation_prefix[:-2]}_id"
            ),
        }

        for parameter, lookup in relation_filters.items():
            value = parse_filter_value(
                query_params,
                parameter,
                serializers.IntegerField(min_value=1),
            )
            if value is not None:
                queryset = queryset.filter(**{lookup: value})

        start_date = parse_filter_value(
            query_params,
            "start_date",
            serializers.DateField(),
        )
        end_date = parse_filter_value(
            query_params,
            "end_date",
            serializers.DateField(),
        )
        if start_date is not None and end_date is not None and start_date > end_date:
            raise ValidationError(
                {"end_date": "End date must be on or after start date."}
            )
        if start_date is not None:
            queryset = queryset.filter(**{f"{date_field}__gte": start_date})
        if end_date is not None:
            queryset = queryset.filter(**{f"{date_field}__lte": end_date})
        return queryset

    def create(self, request, *args, **kwargs):
        self.get_farmer_profile()
        return super().create(request, *args, **kwargs)


class ProtectedDeleteMixin:
    protected_delete_message = (
        "This production record cannot be deleted because it is referenced "
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


class GrowingSeasonListCreateView(
    FarmerOwnedProductionMixin,
    generics.ListCreateAPIView,
):
    serializer_class = GrowingSeasonSerializer

    def get_queryset(self):
        queryset = GrowingSeason.objects.filter(
            field__farm__farmer__user=self.request.user
        ).select_related("field__farm", "crop", "variety")
        return self.apply_filters(queryset, "", "planting_date")

    def perform_create(self, serializer):
        self.get_farmer_profile()
        serializer.save()


class GrowingSeasonDetailView(
    FarmerOwnedProductionMixin,
    ProtectedDeleteMixin,
    generics.RetrieveUpdateDestroyAPIView,
):
    serializer_class = GrowingSeasonSerializer

    def get_queryset(self):
        return GrowingSeason.objects.filter(
            field__farm__farmer__user=self.request.user
        ).select_related("field__farm", "crop", "variety")


class ProductionActivityListCreateView(
    FarmerOwnedProductionMixin,
    generics.ListCreateAPIView,
):
    serializer_class = ProductionActivitySerializer

    def get_queryset(self):
        queryset = ProductionActivity.objects.filter(
            growing_season__field__farm__farmer__user=self.request.user
        ).select_related("growing_season__field__farm", "growing_season__crop")
        return self.apply_filters(
            queryset,
            "growing_season__",
            "activity_date",
        )

    def perform_create(self, serializer):
        self.get_farmer_profile()
        serializer.save()


class ProductionActivityDetailView(
    FarmerOwnedProductionMixin,
    ProtectedDeleteMixin,
    generics.RetrieveUpdateDestroyAPIView,
):
    serializer_class = ProductionActivitySerializer

    def get_queryset(self):
        return ProductionActivity.objects.filter(
            growing_season__field__farm__farmer__user=self.request.user
        ).select_related("growing_season__field__farm", "growing_season__crop")


class ProductionCostListCreateView(
    FarmerOwnedProductionMixin,
    generics.ListCreateAPIView,
):
    serializer_class = ProductionCostSerializer

    def get_queryset(self):
        queryset = ProductionCost.objects.filter(
            growing_season__field__farm__farmer__user=self.request.user
        ).select_related("growing_season__field__farm", "growing_season__crop")
        return self.apply_filters(queryset, "growing_season__", "cost_date")

    def perform_create(self, serializer):
        self.get_farmer_profile()
        serializer.save()


class ProductionCostDetailView(
    FarmerOwnedProductionMixin,
    ProtectedDeleteMixin,
    generics.RetrieveUpdateDestroyAPIView,
):
    serializer_class = ProductionCostSerializer

    def get_queryset(self):
        return ProductionCost.objects.filter(
            growing_season__field__farm__farmer__user=self.request.user
        ).select_related("growing_season__field__farm", "growing_season__crop")


class HarvestEstimateListCreateView(
    FarmerOwnedProductionMixin,
    generics.ListCreateAPIView,
):
    serializer_class = HarvestEstimateSerializer

    def get_queryset(self):
        queryset = HarvestEstimate.objects.filter(
            growing_season__field__farm__farmer__user=self.request.user
        ).select_related("growing_season__field__farm", "growing_season__crop")
        return self.apply_filters(queryset, "growing_season__", "estimated_on")

    def perform_create(self, serializer):
        self.get_farmer_profile()
        serializer.save()


class HarvestEstimateDetailView(
    FarmerOwnedProductionMixin,
    ProtectedDeleteMixin,
    generics.RetrieveUpdateDestroyAPIView,
):
    serializer_class = HarvestEstimateSerializer

    def get_queryset(self):
        return HarvestEstimate.objects.filter(
            growing_season__field__farm__farmer__user=self.request.user
        ).select_related("growing_season__field__farm", "growing_season__crop")


class HarvestRecordListCreateView(
    FarmerOwnedProductionMixin,
    generics.ListCreateAPIView,
):
    serializer_class = HarvestRecordSerializer

    def get_queryset(self):
        queryset = HarvestRecord.objects.filter(
            growing_season__field__farm__farmer__user=self.request.user
        ).select_related("growing_season__field__farm", "growing_season__crop")
        return self.apply_filters(queryset, "growing_season__", "harvested_on")

    def perform_create(self, serializer):
        self.get_farmer_profile()
        serializer.save()


class HarvestRecordDetailView(
    FarmerOwnedProductionMixin,
    ProtectedDeleteMixin,
    generics.RetrieveUpdateDestroyAPIView,
):
    serializer_class = HarvestRecordSerializer

    def get_queryset(self):
        return HarvestRecord.objects.filter(
            growing_season__field__farm__farmer__user=self.request.user
        ).select_related("growing_season__field__farm", "growing_season__crop")
