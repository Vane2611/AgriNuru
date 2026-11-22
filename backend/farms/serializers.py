from rest_framework import serializers

from .models import Farm, Field


class FarmSerializer(serializers.ModelSerializer):
    farmer = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Farm
        fields = (
            "id",
            "farmer",
            "name",
            "county",
            "sub_county",
            "ward",
            "village",
            "description",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "farmer", "created_at", "updated_at")

    def validate_name(self, value):
        request = self.context.get("request")
        farmer_id = getattr(
            getattr(request, "user", None),
            "farmer_profile",
            None,
        )
        if farmer_id is None:
            return value

        duplicate_farms = Farm.objects.filter(farmer=farmer_id, name=value)
        if self.instance is not None:
            duplicate_farms = duplicate_farms.exclude(pk=self.instance.pk)
        if duplicate_farms.exists():
            raise serializers.ValidationError(
                "You already have a farm with this name."
            )
        return value


class FieldSerializer(serializers.ModelSerializer):
    farm = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Field
        fields = (
            "id",
            "farm",
            "name",
            "area_hectares",
            "latitude",
            "longitude",
            "irrigation_available",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "farm", "created_at", "updated_at")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        latitude = attrs.get(
            "latitude",
            getattr(self.instance, "latitude", None),
        )
        longitude = attrs.get(
            "longitude",
            getattr(self.instance, "longitude", None),
        )

        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError(
                {
                    "latitude": (
                        "Latitude and longitude must both be provided "
                        "or both be omitted."
                    ),
                    "longitude": (
                        "Latitude and longitude must both be provided "
                        "or both be omitted."
                    ),
                }
            )

        farm = self.context.get("farm")
        if farm is not None and "name" in attrs:
            duplicate_fields = Field.objects.filter(
                farm=farm,
                name=attrs["name"],
            )
            if self.instance is not None:
                duplicate_fields = duplicate_fields.exclude(pk=self.instance.pk)
            if duplicate_fields.exists():
                raise serializers.ValidationError(
                    {"name": "This farm already has a field with this name."}
                )

        return attrs
