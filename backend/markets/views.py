from django.db.models.deletion import ProtectedError

from rest_framework import generics, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Market, MarketPrice, MarketPriceObservation
from .permissions import IsAuthenticatedReadOnlyOrStaffWrite
from .serializers import (
    MarketPriceObservationSerializer,
    MarketPriceSerializer,
    MarketSerializer,
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


def parse_identifier(query_params, name):
    return parse_filter(
        query_params,
        name,
        serializers.IntegerField(min_value=1),
    )


class StaffWriteProtectedDeleteMixin:
    protected_delete_message = (
        "This market record cannot be deleted because it is referenced "
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


class MarketListCreateView(generics.ListCreateAPIView):
    serializer_class = MarketSerializer
    permission_classes = (IsAuthenticatedReadOnlyOrStaffWrite,)

    def get_queryset(self):
        queryset = Market.objects.all()
        if not self.request.user.is_staff:
            queryset = queryset.filter(is_active=True)

        county = parse_filter(
            self.request.query_params,
            "county",
            serializers.CharField(allow_blank=False),
        )
        sub_county = parse_filter(
            self.request.query_params,
            "sub_county",
            serializers.CharField(allow_blank=False),
        )
        if county is not None:
            queryset = queryset.filter(county__iexact=county)
        if sub_county is not None:
            queryset = queryset.filter(sub_county__iexact=sub_county)
        return queryset


class MarketDetailView(
    StaffWriteProtectedDeleteMixin,
    generics.RetrieveUpdateDestroyAPIView,
):
    serializer_class = MarketSerializer
    permission_classes = (IsAuthenticatedReadOnlyOrStaffWrite,)

    def get_queryset(self):
        queryset = Market.objects.all()
        if not self.request.user.is_staff:
            queryset = queryset.filter(is_active=True)
        return queryset


class MarketPriceListCreateView(generics.ListCreateAPIView):
    serializer_class = MarketPriceSerializer
    permission_classes = (IsAuthenticatedReadOnlyOrStaffWrite,)

    def get_queryset(self):
        queryset = MarketPrice.objects.select_related("market", "crop")
        if not self.request.user.is_staff:
            queryset = queryset.filter(market__is_active=True)

        for parameter, lookup in (
            ("market_id", "market_id"),
            ("crop_id", "crop_id"),
        ):
            value = parse_identifier(self.request.query_params, parameter)
            if value is not None:
                queryset = queryset.filter(**{lookup: value})

        quantity_unit = parse_filter(
            self.request.query_params,
            "quantity_unit",
            serializers.CharField(allow_blank=False),
        )
        if quantity_unit is not None:
            queryset = queryset.filter(quantity_unit__iexact=quantity_unit)
        return queryset


class MarketPriceDetailView(
    StaffWriteProtectedDeleteMixin,
    generics.RetrieveUpdateDestroyAPIView,
):
    serializer_class = MarketPriceSerializer
    permission_classes = (IsAuthenticatedReadOnlyOrStaffWrite,)

    def get_queryset(self):
        queryset = MarketPrice.objects.select_related("market", "crop")
        if not self.request.user.is_staff:
            queryset = queryset.filter(market__is_active=True)
        return queryset


class MarketPriceObservationListCreateView(generics.ListCreateAPIView):
    serializer_class = MarketPriceObservationSerializer
    permission_classes = (IsAuthenticatedReadOnlyOrStaffWrite,)

    def visible_price_series(self):
        queryset = MarketPrice.objects.select_related("market", "crop")
        if not self.request.user.is_staff:
            queryset = queryset.filter(market__is_active=True)
        return queryset

    def get_queryset(self):
        queryset = MarketPriceObservation.objects.select_related(
            "market_price",
            "market_price__market",
            "market_price__crop",
        )
        if not self.request.user.is_staff:
            queryset = queryset.filter(market_price__market__is_active=True)

        params = self.request.query_params
        series_id = parse_identifier(params, "market_price_id")
        market_id = parse_identifier(params, "market_id")
        crop_id = parse_identifier(params, "crop_id")
        start_date = parse_filter(params, "start_date", serializers.DateField())
        end_date = parse_filter(params, "end_date", serializers.DateField())

        if start_date is not None and end_date is not None and start_date > end_date:
            raise ValidationError(
                {"end_date": "End date must be on or after start date."}
            )

        if series_id is not None:
            visible_series = self.visible_price_series().filter(pk=series_id)
            if visible_series.exists() and (
                (market_id is not None and not visible_series.filter(
                    market_id=market_id
                ).exists())
                or (crop_id is not None and not visible_series.filter(
                    crop_id=crop_id
                ).exists())
            ):
                raise ValidationError(
                    {
                        "market_price_id": (
                            "The selected price series does not match the "
                            "provided market_id or crop_id filter."
                        )
                    }
                )
            queryset = queryset.filter(market_price_id=series_id)

        if market_id is not None:
            queryset = queryset.filter(market_price__market_id=market_id)
        if crop_id is not None:
            queryset = queryset.filter(market_price__crop_id=crop_id)
        if start_date is not None:
            queryset = queryset.filter(observation_date__gte=start_date)
        if end_date is not None:
            queryset = queryset.filter(observation_date__lte=end_date)
        return queryset


class MarketPriceObservationDetailView(
    StaffWriteProtectedDeleteMixin,
    generics.RetrieveUpdateDestroyAPIView,
):
    serializer_class = MarketPriceObservationSerializer
    permission_classes = (IsAuthenticatedReadOnlyOrStaffWrite,)

    def get_queryset(self):
        queryset = MarketPriceObservation.objects.select_related(
            "market_price",
            "market_price__market",
            "market_price__crop",
        )
        if not self.request.user.is_staff:
            queryset = queryset.filter(market_price__market__is_active=True)
        return queryset
