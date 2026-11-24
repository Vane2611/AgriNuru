from rest_framework import serializers

from crops.models import Crop, CropVariety
from farmers.models import FarmerProfile
from farms.models import Field

from .models import (
    GrowingSeason,
    HarvestEstimate,
    HarvestRecord,
    ProductionActivity,
    ProductionCost,
)


def get_farmer_profile(request):
    if request is None or not request.user.is_authenticated:
        return None
    return FarmerProfile.objects.filter(user=request.user).first()


class GrowingSeasonSerializer(serializers.ModelSerializer):
    field = serializers.PrimaryKeyRelatedField(
        queryset=Field.objects.none(),
    )
    crop = serializers.PrimaryKeyRelatedField(queryset=Crop.objects.all())
    variety = serializers.PrimaryKeyRelatedField(
        queryset=CropVariety.objects.all(),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = GrowingSeason
        fields = (
            "id",
            "field",
            "crop",
            "variety",
            "planting_date",
            "expected_harvest_date",
            "actual_harvest_date",
            "area_planted_hectares",
            "status",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request is not None and request.user.is_authenticated:
            self.fields["field"].queryset = Field.objects.filter(
                farm__farmer__user=request.user
            )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance
        field = attrs.get("field", getattr(instance, "field", None))
        crop = attrs.get("crop", getattr(instance, "crop", None))
        variety = attrs.get("variety", getattr(instance, "variety", None))
        planting_date = attrs.get(
            "planting_date",
            getattr(instance, "planting_date", None),
        )

        request = self.context.get("request")
        profile = get_farmer_profile(request)
        if field is not None and (
            profile is None or field.farm.farmer_id != profile.pk
        ):
            raise serializers.ValidationError(
                {"field": "Select a field belonging to your own farm."}
            )

        if variety is not None and crop is not None and variety.crop_id != crop.pk:
            raise serializers.ValidationError(
                {"variety": "The selected variety must belong to the selected crop."}
            )

        area_planted = attrs.get(
            "area_planted_hectares",
            getattr(instance, "area_planted_hectares", None),
        )
        if (
            field is not None
            and area_planted is not None
            and area_planted > field.area_hectares
        ):
            raise serializers.ValidationError(
                {
                    "area_planted_hectares": (
                        "Area planted cannot exceed the field's recorded area."
                    )
                }
            )

        errors = {}
        for date_field in ("expected_harvest_date", "actual_harvest_date"):
            harvest_date = attrs.get(
                date_field,
                getattr(instance, date_field, None),
            )
            if (
                harvest_date is not None
                and planting_date is not None
                and harvest_date < planting_date
            ):
                errors[date_field] = (
                    "Harvest date cannot be before the planting date."
                )
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class FarmerOwnedSeasonSerializer(serializers.ModelSerializer):
    growing_season = serializers.PrimaryKeyRelatedField(
        queryset=GrowingSeason.objects.none(),
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request is not None and request.user.is_authenticated:
            self.fields["growing_season"].queryset = GrowingSeason.objects.filter(
                field__farm__farmer__user=request.user
            ).select_related("field__farm__farmer")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        season = attrs.get(
            "growing_season",
            getattr(self.instance, "growing_season", None),
        )
        request = self.context.get("request")
        if season is not None and (
            request is None
            or not request.user.is_authenticated
            or not GrowingSeason.objects.filter(
                pk=season.pk,
                field__farm__farmer__user=request.user,
            ).exists()
        ):
            raise serializers.ValidationError(
                {
                    "growing_season": (
                        "Select a growing season belonging to your own farm."
                    )
                }
            )
        return attrs


class ProductionActivitySerializer(FarmerOwnedSeasonSerializer):
    class Meta:
        model = ProductionActivity
        fields = (
            "id",
            "growing_season",
            "activity_type",
            "activity_date",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        season = attrs.get(
            "growing_season",
            getattr(self.instance, "growing_season", None),
        )
        activity_date = attrs.get(
            "activity_date",
            getattr(self.instance, "activity_date", None),
        )
        activity_type = attrs.get(
            "activity_type",
            getattr(self.instance, "activity_type", None),
        )
        # Land preparation is a pre-planting activity and is explicitly exempt
        # from the planting-date lower bound.
        if activity_type == ProductionActivity.ActivityType.LAND_PREPARATION:
            return attrs
        if (
            season is not None
            and activity_date is not None
            and activity_date < season.planting_date
        ):
            raise serializers.ValidationError(
                {"activity_date": "Activity date cannot be before planting date."}
            )
        return attrs


class ProductionCostSerializer(FarmerOwnedSeasonSerializer):
    class Meta:
        model = ProductionCost
        fields = (
            "id",
            "growing_season",
            "category",
            "cost_basis",
            "amount",
            "currency",
            "cost_date",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class HarvestEstimateSerializer(FarmerOwnedSeasonSerializer):
    class Meta:
        model = HarvestEstimate
        fields = (
            "id",
            "growing_season",
            "estimated_on",
            "estimated_quantity",
            "quantity_unit",
            "estimate_source",
            "source_reference",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class HarvestRecordSerializer(FarmerOwnedSeasonSerializer):
    class Meta:
        model = HarvestRecord
        fields = (
            "id",
            "growing_season",
            "harvested_on",
            "quantity",
            "quantity_unit",
            "quality_grade",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        season = attrs.get(
            "growing_season",
            getattr(self.instance, "growing_season", None),
        )
        harvested_on = attrs.get(
            "harvested_on",
            getattr(self.instance, "harvested_on", None),
        )
        if (
            season is not None
            and harvested_on is not None
            and harvested_on < season.planting_date
        ):
            raise serializers.ValidationError(
                {"harvested_on": "Harvest date cannot be before planting date."}
            )
        return attrs
