from django.db.models import Q
from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404

from rest_framework import generics, serializers, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .ml_status import ML_READINESS_STATUS

from farmers.models import FarmerProfile

from .models import (
    CropRecommendation,
    DecisionReport,
    MarketComparison,
    ProductionPlan,
)
from .serializers import (
    CropRecommendationSerializer,
    DecisionReportSerializer,
    MarketComparisonSerializer,
    ProductionPlanSerializer,
)


def parse_filter(query_params, name, field):
    if name not in query_params:
        return None
    value = query_params.get(name)
    if not value:
        raise ValidationError({name: "This filter must not be blank."})
    try:
        return field.run_validation(value)
    except serializers.ValidationError as exc:
        raise ValidationError({name: exc.detail}) from exc


def parse_common_filters(query_params):
    filters = {"farm_id": None, "field_id": None, "crop_id": None}
    for parameter in ("farm_id", "field_id", "crop_id"):
        value = parse_filter(
            query_params,
            parameter,
            serializers.IntegerField(min_value=1),
        )
        if value is not None:
            filters[parameter] = value
    start_date = parse_filter(
        query_params,
        "start_date",
        serializers.DateField(),
    )
    end_date = parse_filter(
        query_params,
        "end_date",
        serializers.DateField(),
    )
    if (
        start_date is not None
        and end_date is not None
        and start_date > end_date
    ):
        raise ValidationError(
            {"end_date": "End date must be on or after start date."}
        )
    filters["start_date"] = start_date
    filters["end_date"] = end_date
    return filters


def apply_field_filters(queryset, filters):
    farm_id = filters["farm_id"]
    field_id = filters["field_id"]
    if farm_id is not None:
        queryset = queryset.filter(field__farm_id=farm_id)
    if field_id is not None:
        queryset = queryset.filter(field_id=field_id)
    return queryset


def apply_date_filters(queryset, date_field, filters):
    start_date = filters["start_date"]
    end_date = filters["end_date"]
    if start_date is not None:
        queryset = queryset.filter(**{f"{date_field}__date__gte": start_date})
    if end_date is not None:
        queryset = queryset.filter(**{f"{date_field}__date__lte": end_date})
    return queryset


class FarmerDecisionMixin:
    permission_classes = (IsAuthenticated,)

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not FarmerProfile.objects.filter(user=request.user).exists():
            raise NotFound("A farmer profile is required to access decisions.")

    def get_farmer_profile(self):
        return get_object_or_404(FarmerProfile, user=self.request.user)

    def owned_records(self, queryset):
        return queryset.filter(field__farm__farmer__user=self.request.user)

    def apply_status_filter(self, queryset, status_value, choices):
        value = parse_filter(
            self.request.query_params,
            "status",
            serializers.ChoiceField(choices=choices),
        )
        return queryset.filter(**{status_value: value}) if value else queryset


class ProtectedDecisionDeleteMixin:
    protected_delete_message = (
        "This decision record cannot be deleted because it is referenced "
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


class CropRecommendationListCreateView(
    FarmerDecisionMixin,
    generics.ListCreateAPIView,
):
    serializer_class = CropRecommendationSerializer

    def get_queryset(self):
        queryset = self.owned_records(
            CropRecommendation.objects.select_related(
                "field__farm",
                "crop",
                "variety",
            )
        )
        filters = parse_common_filters(self.request.query_params)
        queryset = apply_field_filters(queryset, filters)
        crop_id = filters["crop_id"]
        if crop_id is not None:
            queryset = queryset.filter(crop_id=crop_id)
        queryset = self.apply_status_filter(
            queryset,
            "status",
            CropRecommendation.Status.choices,
        )
        return apply_date_filters(queryset, "generated_at", filters)

    def perform_create(self, serializer):
        self.get_farmer_profile()
        serializer.save()


class CropRecommendationDetailView(
    FarmerDecisionMixin,
    ProtectedDecisionDeleteMixin,
    generics.RetrieveUpdateDestroyAPIView,
):
    serializer_class = CropRecommendationSerializer

    def get_queryset(self):
        return self.owned_records(
            CropRecommendation.objects.select_related(
                "field__farm",
                "crop",
                "variety",
            )
        )


class ProductionPlanListCreateView(
    FarmerDecisionMixin,
    generics.ListCreateAPIView,
):
    serializer_class = ProductionPlanSerializer

    def get_queryset(self):
        queryset = self.owned_records(
            ProductionPlan.objects.select_related(
                "field__farm",
                "crop",
                "variety",
                "growing_season",
                "crop_recommendation",
            )
        )
        filters = parse_common_filters(self.request.query_params)
        queryset = apply_field_filters(queryset, filters)
        if filters["crop_id"] is not None:
            queryset = queryset.filter(crop_id=filters["crop_id"])
        queryset = self.apply_status_filter(
            queryset,
            "status",
            ProductionPlan.Status.choices,
        )
        return apply_date_filters(queryset, "created_at", filters)

    def perform_create(self, serializer):
        self.get_farmer_profile()
        serializer.save()


class ProductionPlanDetailView(
    FarmerDecisionMixin,
    ProtectedDecisionDeleteMixin,
    generics.RetrieveUpdateDestroyAPIView,
):
    serializer_class = ProductionPlanSerializer

    def get_queryset(self):
        return self.owned_records(
            ProductionPlan.objects.select_related(
                "field__farm",
                "crop",
                "variety",
                "growing_season",
                "crop_recommendation",
            )
        )


class DecisionReportListCreateView(
    FarmerDecisionMixin,
    generics.ListCreateAPIView,
):
    serializer_class = DecisionReportSerializer

    def get_queryset(self):
        queryset = self.owned_records(
            DecisionReport.objects.select_related(
                "field__farm",
                "crop_recommendation",
                "production_plan",
            )
        )
        filters = parse_common_filters(self.request.query_params)
        queryset = apply_field_filters(queryset, filters)
        if filters["crop_id"] is not None:
            queryset = queryset.filter(
                Q(crop_recommendation__crop_id=filters["crop_id"])
                | Q(production_plan__crop_id=filters["crop_id"])
            )
        queryset = self.apply_status_filter(
            queryset,
            "status",
            DecisionReport.Status.choices,
        )
        return apply_date_filters(queryset, "created_at", filters)

    def perform_create(self, serializer):
        self.get_farmer_profile()
        serializer.save()


class DecisionReportDetailView(
    FarmerDecisionMixin,
    ProtectedDecisionDeleteMixin,
    generics.RetrieveUpdateDestroyAPIView,
):
    serializer_class = DecisionReportSerializer

    def get_queryset(self):
        return self.owned_records(
            DecisionReport.objects.select_related(
                "field__farm",
                "crop_recommendation",
                "production_plan",
            )
        )


class MarketComparisonListCreateView(
    FarmerDecisionMixin,
    generics.ListCreateAPIView,
):
    serializer_class = MarketComparisonSerializer

    def get_queryset(self):
        queryset = MarketComparison.objects.filter(
            decision_report__field__farm__farmer__user=self.request.user
        ).select_related(
            "decision_report__field__farm",
            "decision_report__crop_recommendation",
            "decision_report__production_plan",
            "production_plan",
            "price_observation__market_price__crop",
            "price_observation__market_price__market",
        )
        filters = parse_common_filters(self.request.query_params)
        if filters["farm_id"] is not None:
            queryset = queryset.filter(
                decision_report__field__farm_id=filters["farm_id"]
            )
        if filters["field_id"] is not None:
            queryset = queryset.filter(
                decision_report__field_id=filters["field_id"]
            )
        if filters["crop_id"] is not None:
            queryset = queryset.filter(
                price_observation__market_price__crop_id=filters["crop_id"]
            )
        queryset = self.apply_status_filter(
            queryset,
            "decision_report__status",
            DecisionReport.Status.choices,
        )
        return apply_date_filters(queryset, "comparison_date", filters)

    def perform_create(self, serializer):
        self.get_farmer_profile()
        serializer.save()


class MarketComparisonDetailView(
    FarmerDecisionMixin,
    ProtectedDecisionDeleteMixin,
    generics.RetrieveUpdateDestroyAPIView,
):
    serializer_class = MarketComparisonSerializer

    def get_queryset(self):
        return MarketComparison.objects.filter(
            decision_report__field__farm__farmer__user=self.request.user
        ).select_related(
            "decision_report__field__farm",
            "decision_report__crop_recommendation",
            "decision_report__production_plan",
            "production_plan",
            "price_observation__market_price__crop",
            "price_observation__market_price__market",
        )


class MLStatusView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response(ML_READINESS_STATUS)
