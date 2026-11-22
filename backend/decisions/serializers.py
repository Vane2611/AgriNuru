import copy

from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework import serializers

from crops.models import Crop, CropVariety
from farms.models import Field
from markets.models import MarketPriceObservation
from production.models import GrowingSeason

from .models import (
    CropRecommendation,
    DecisionReport,
    MarketComparison,
    ProductionPlan,
)


def run_model_clean(serializer, attrs):
    model = serializer.Meta.model
    candidate = copy.copy(serializer.instance) if serializer.instance else model()
    for field_name, value in attrs.items():
        setattr(candidate, field_name, value)
    try:
        candidate.clean()
    except DjangoValidationError as exc:
        if hasattr(exc, "message_dict"):
            raise serializers.ValidationError(exc.message_dict) from exc
        raise serializers.ValidationError(
            {"non_field_errors": exc.messages}
        ) from exc


class FarmerOwnedRelationsSerializer(serializers.ModelSerializer):
    def owner_queryset(self, model, **lookups):
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return model.objects.none()
        return model.objects.filter(**lookups)


class CropRecommendationSerializer(FarmerOwnedRelationsSerializer):
    field = serializers.PrimaryKeyRelatedField(queryset=Field.objects.none())
    crop = serializers.PrimaryKeyRelatedField(queryset=Crop.objects.all())
    variety = serializers.PrimaryKeyRelatedField(
        queryset=CropVariety.objects.all(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = CropRecommendation
        fields = (
            "id",
            "field",
            "crop",
            "variety",
            "generated_at",
            "status",
            "suitability_score",
            "explanation",
            "supporting_factors",
            "assumptions",
            "source_reference",
            "uncertainty_notes",
            "model_version",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["field"].queryset = self.owner_queryset(
            Field,
            farm__farmer__user=self.context["request"].user,
        ) if self.context.get("request") else Field.objects.none()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance is None and "generated_at" not in attrs:
            raise serializers.ValidationError(
                {"generated_at": "A genuine generation timestamp is required."}
            )
        run_model_clean(self, attrs)
        return attrs


class ProductionPlanSerializer(FarmerOwnedRelationsSerializer):
    field = serializers.PrimaryKeyRelatedField(queryset=Field.objects.none())
    crop = serializers.PrimaryKeyRelatedField(queryset=Crop.objects.all())
    variety = serializers.PrimaryKeyRelatedField(
        queryset=CropVariety.objects.all(),
        allow_null=True,
        required=False,
    )
    growing_season = serializers.PrimaryKeyRelatedField(
        queryset=GrowingSeason.objects.none(),
        allow_null=True,
        required=False,
    )
    crop_recommendation = serializers.PrimaryKeyRelatedField(
        queryset=CropRecommendation.objects.none(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = ProductionPlan
        fields = (
            "id",
            "field",
            "crop",
            "variety",
            "growing_season",
            "crop_recommendation",
            "estimated_cost",
            "currency",
            "expected_yield",
            "yield_unit",
            "assumptions",
            "source_references",
            "uncertainty_notes",
            "model_version",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return
        owner = {"field__farm__farmer__user": request.user}
        self.fields["field"].queryset = Field.objects.filter(
            farm__farmer__user=request.user
        )
        self.fields["growing_season"].queryset = GrowingSeason.objects.filter(
            **owner
        )
        self.fields["crop_recommendation"].queryset = (
            CropRecommendation.objects.filter(**owner)
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance
        estimated_cost = attrs.get(
            "estimated_cost",
            getattr(instance, "estimated_cost", None),
        )
        currency = attrs.get("currency", getattr(instance, "currency", ""))
        expected_yield = attrs.get(
            "expected_yield",
            getattr(instance, "expected_yield", None),
        )
        yield_unit = attrs.get("yield_unit", getattr(instance, "yield_unit", ""))
        errors = {}
        if (estimated_cost is None) != (currency == ""):
            errors["currency"] = (
                "Currency is required when estimated cost is provided and "
                "must be blank when the cost is unknown."
            )
        if (expected_yield is None) != (yield_unit == ""):
            errors["yield_unit"] = (
                "Yield unit is required when expected yield is provided and "
                "must be blank when yield is unknown."
            )
        if errors:
            raise serializers.ValidationError(errors)
        run_model_clean(self, attrs)
        return attrs


class DecisionReportSerializer(FarmerOwnedRelationsSerializer):
    field = serializers.PrimaryKeyRelatedField(queryset=Field.objects.none())
    crop_recommendation = serializers.PrimaryKeyRelatedField(
        queryset=CropRecommendation.objects.none(),
        allow_null=True,
        required=False,
    )
    production_plan = serializers.PrimaryKeyRelatedField(
        queryset=ProductionPlan.objects.none(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = DecisionReport
        fields = (
            "id",
            "field",
            "crop_recommendation",
            "production_plan",
            "status",
            "summary",
            "recommendation_text",
            "assumptions",
            "sources",
            "model_version",
            "generated_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return
        owner = {"field__farm__farmer__user": request.user}
        self.fields["field"].queryset = Field.objects.filter(
            farm__farmer__user=request.user
        )
        self.fields["crop_recommendation"].queryset = (
            CropRecommendation.objects.filter(**owner)
        )
        self.fields["production_plan"].queryset = ProductionPlan.objects.filter(
            **owner
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        run_model_clean(self, attrs)
        return attrs


class MarketComparisonSerializer(FarmerOwnedRelationsSerializer):
    decision_report = serializers.PrimaryKeyRelatedField(
        queryset=DecisionReport.objects.none(),
    )
    production_plan = serializers.PrimaryKeyRelatedField(
        queryset=ProductionPlan.objects.none(),
        allow_null=True,
        required=False,
    )
    price_observation = serializers.PrimaryKeyRelatedField(
        queryset=MarketPriceObservation.objects.all(),
    )

    class Meta:
        model = MarketComparison
        fields = (
            "id",
            "decision_report",
            "production_plan",
            "price_observation",
            "comparison_date",
            "quantity",
            "estimated_gross_sales_value",
            "estimated_transport_cost",
            "currency",
            "assumptions",
            "uncertainty_notes",
            "estimated_net_return",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "estimated_net_return",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return
        owner = {"field__farm__farmer__user": request.user}
        self.fields["decision_report"].queryset = DecisionReport.objects.filter(
            field__farm__farmer__user=request.user
        )
        self.fields["production_plan"].queryset = ProductionPlan.objects.filter(
            **owner
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance
        report = attrs.get(
            "decision_report",
            getattr(instance, "decision_report", None),
        )
        plan = attrs.get(
            "production_plan",
            getattr(instance, "production_plan", None),
        )
        observation = attrs.get(
            "price_observation",
            getattr(instance, "price_observation", None),
        )
        errors = {}
        if (
            report is not None
            and plan is not None
            and report.field_id != plan.field_id
        ):
            errors["production_plan"] = (
                "The production plan must belong to the report's field."
            )
        if report is not None and observation is not None:
            observation_crop_id = observation.market_price.crop_id
            report_recommendation = report.crop_recommendation
            report_plan = report.production_plan
            if (
                report_recommendation is not None
                and report_recommendation.crop_id != observation_crop_id
            ):
                errors["price_observation"] = (
                    "The observation crop must match the report recommendation."
                )
            if (
                report_plan is not None
                and report_plan.crop_id != observation_crop_id
            ):
                errors["price_observation"] = (
                    "The observation crop must match the report production plan."
                )
            if (
                plan is not None
                and plan.crop_id != observation_crop_id
            ):
                errors["price_observation"] = (
                    "The observation crop must match the selected production plan."
                )

        currency = attrs.get("currency", getattr(instance, "currency", None))
        if (
            observation is not None
            and currency is not None
            and observation.currency != currency
        ):
            errors["currency"] = (
                "Currency must match the linked price observation."
            )
        if errors:
            raise serializers.ValidationError(errors)
        run_model_clean(self, attrs)
        return attrs
