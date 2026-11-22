from rest_framework import serializers

from .models import Crop, CropRequirement, CropVariety


class CropSerializer(serializers.ModelSerializer):
    class Meta:
        model = Crop
        fields = (
            "id",
            "common_name",
            "scientific_name",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class CropVarietySerializer(serializers.ModelSerializer):
    class Meta:
        model = CropVariety
        fields = (
            "id",
            "crop",
            "name",
            "description",
            "maturity_days",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class CropRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = CropRequirement
        fields = (
            "id",
            "crop",
            "variety",
            "soil_ph_minimum",
            "soil_ph_maximum",
            "temperature_minimum_celsius",
            "temperature_maximum_celsius",
            "rainfall_minimum_mm",
            "rainfall_maximum_mm",
            "rainfall_period_days",
            "soil_type",
            "agro_ecological_zone",
            "other_requirements",
            "source_reference",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance

        crop = attrs.get("crop", getattr(instance, "crop", None))
        variety = attrs.get("variety", getattr(instance, "variety", None))
        if (crop is None) == (variety is None):
            raise serializers.ValidationError(
                "A requirement must belong to exactly one crop or variety."
            )

        if crop is not None and variety is not None:
            raise serializers.ValidationError(
                "A requirement cannot belong to both a crop and a variety."
            )

        ranges = (
            ("soil_ph_minimum", "soil_ph_maximum"),
            ("temperature_minimum_celsius", "temperature_maximum_celsius"),
            ("rainfall_minimum_mm", "rainfall_maximum_mm"),
        )
        errors = {}
        for minimum_field, maximum_field in ranges:
            minimum = attrs.get(
                minimum_field,
                getattr(instance, minimum_field, None),
            )
            maximum = attrs.get(
                maximum_field,
                getattr(instance, maximum_field, None),
            )
            if minimum is not None and maximum is not None and minimum > maximum:
                errors[maximum_field] = (
                    f"{maximum_field.replace('_', ' ').capitalize()} must be "
                    f"greater than or equal to {minimum_field.replace('_', ' ')}."
                )

        rainfall_minimum = attrs.get(
            "rainfall_minimum_mm",
            getattr(instance, "rainfall_minimum_mm", None),
        )
        rainfall_maximum = attrs.get(
            "rainfall_maximum_mm",
            getattr(instance, "rainfall_maximum_mm", None),
        )
        rainfall_period = attrs.get(
            "rainfall_period_days",
            getattr(instance, "rainfall_period_days", None),
        )
        if (
            rainfall_minimum is not None or rainfall_maximum is not None
        ) and rainfall_period is None:
            errors["rainfall_period_days"] = (
                "A rainfall period is required when a rainfall value is provided."
            )
        elif (
            rainfall_minimum is None
            and rainfall_maximum is None
            and rainfall_period is not None
        ):
            errors["rainfall_period_days"] = (
                "A rainfall period requires at least one rainfall value."
            )

        if errors:
            raise serializers.ValidationError(errors)
        return attrs
