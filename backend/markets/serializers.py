from rest_framework import serializers

from .models import Market, MarketPrice, MarketPriceObservation


class MarketSerializer(serializers.ModelSerializer):
    class Meta:
        model = Market
        fields = (
            "id",
            "name",
            "market_type",
            "county",
            "sub_county",
            "latitude",
            "longitude",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance
        latitude = attrs.get("latitude", getattr(instance, "latitude", None))
        longitude = attrs.get("longitude", getattr(instance, "longitude", None))

        if (latitude is None) != (longitude is None):
            message = (
                "Latitude and longitude must both be provided or both be omitted."
            )
            raise serializers.ValidationError(
                {"latitude": message, "longitude": message}
            )
        return attrs


class MarketPriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketPrice
        fields = (
            "id",
            "market",
            "crop",
            "quantity_unit",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class MarketPriceObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketPriceObservation
        fields = (
            "id",
            "market_price",
            "observation_date",
            "price",
            "currency",
            "source_name",
            "source_reference",
            "grade",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance
        market_price = attrs.get(
            "market_price",
            getattr(instance, "market_price", None),
        )
        observation_date = attrs.get(
            "observation_date",
            getattr(instance, "observation_date", None),
        )
        source_name = attrs.get(
            "source_name",
            getattr(instance, "source_name", None),
        )
        grade = attrs.get("grade", getattr(instance, "grade", ""))

        if (
            market_price is not None
            and observation_date is not None
            and source_name is not None
            and MarketPriceObservation.objects.filter(
                market_price=market_price,
                observation_date=observation_date,
                source_name=source_name,
                grade=grade,
            )
            .exclude(pk=getattr(instance, "pk", None))
            .exists()
        ):
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "An observation already exists for this series, date, "
                        "source and grade."
                    ]
                }
            )
        return attrs
