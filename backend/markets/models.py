from decimal import Decimal

from django.core.validators import (
    MaxValueValidator,
    MinValueValidator,
    RegexValidator,
)
from django.db import models
from django.db.models import Q


currency_code_validator = RegexValidator(
    regex=r"^[A-Z]{3}$",
    message="Enter a three-letter uppercase currency code.",
)


class Market(models.Model):
    class MarketType(models.TextChoices):
        WHOLESALE = "wholesale", "Wholesale market"
        RETAIL = "retail", "Retail market"
        COLLECTION_CENTRE = "collection_centre", "Collection centre"

    name = models.CharField(max_length=150)
    market_type = models.CharField(
        max_length=20,
        choices=MarketType.choices,
    )
    county = models.CharField(max_length=100, blank=True)
    sub_county = models.CharField(max_length=100, blank=True)
    latitude = models.DecimalField(
        max_digits=8,
        decimal_places=6,
        blank=True,
        null=True,
        validators=[
            MinValueValidator(Decimal("-90")),
            MaxValueValidator(Decimal("90")),
        ],
        help_text="Optional market latitude in decimal degrees.",
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        blank=True,
        null=True,
        validators=[
            MinValueValidator(Decimal("-180")),
            MaxValueValidator(Decimal("180")),
        ],
        help_text="Optional market longitude in decimal degrees.",
    )
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "market"
        verbose_name_plural = "markets"
        ordering = ("county", "name")
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(latitude__isnull=True, longitude__isnull=True)
                    | Q(latitude__isnull=False, longitude__isnull=False)
                ),
                name="market_coordinates_must_be_paired",
            ),
            models.CheckConstraint(
                condition=(
                    Q(latitude__isnull=True)
                    | Q(latitude__gte=Decimal("-90"), latitude__lte=Decimal("90"))
                ),
                name="market_latitude_within_range",
            ),
            models.CheckConstraint(
                condition=(
                    Q(longitude__isnull=True)
                    | Q(
                        longitude__gte=Decimal("-180"),
                        longitude__lte=Decimal("180"),
                    )
                ),
                name="market_longitude_within_range",
            ),
        ]

    def __str__(self):
        location = ", ".join(
            part for part in (self.sub_county, self.county) if part
        )
        return f"{self.name} ({location})" if location else self.name


class MarketPrice(models.Model):
    market = models.ForeignKey(
        Market,
        on_delete=models.PROTECT,
        related_name="price_series",
    )
    crop = models.ForeignKey(
        "crops.Crop",
        on_delete=models.PROTECT,
        related_name="market_price_series",
    )
    quantity_unit = models.CharField(
        max_length=30,
        help_text="Unit the prices apply to, such as kg, crate or bunch.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "market price series"
        verbose_name_plural = "market price series"
        ordering = ("market__name", "crop__common_name", "quantity_unit")
        constraints = [
            models.UniqueConstraint(
                fields=("market", "crop", "quantity_unit"),
                name="unique_market_crop_price_unit",
            ),
        ]

    def __str__(self):
        return (
            f"{self.crop.common_name} at {self.market.name} "
            f"per {self.quantity_unit}"
        )


class MarketPriceObservation(models.Model):
    market_price = models.ForeignKey(
        MarketPrice,
        on_delete=models.PROTECT,
        related_name="observations",
    )
    observation_date = models.DateField()
    price = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text="Observed price in the specified currency per series unit.",
    )
    currency = models.CharField(
        max_length=3,
        validators=[currency_code_validator],
        help_text="Three-letter currency code, for example KES.",
    )
    source_name = models.CharField(max_length=200)
    source_reference = models.CharField(
        max_length=500,
        blank=True,
        help_text="Optional URL, document reference or source identifier.",
    )
    grade = models.CharField(
        max_length=100,
        blank=True,
        help_text="Optional produce grade or quality description.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "market price observation"
        verbose_name_plural = "market price observations"
        ordering = ("-observation_date", "-created_at")
        constraints = [
            models.CheckConstraint(
                condition=Q(price__gt=0),
                name="market_price_observation_price_positive",
            ),
            models.UniqueConstraint(
                fields=(
                    "market_price",
                    "observation_date",
                    "source_name",
                    "grade",
                ),
                name="unique_market_price_observation_per_source",
            ),
        ]

    def __str__(self):
        return (
            f"{self.market_price.crop.common_name} at "
            f"{self.market_price.market.name}: {self.price} "
            f"{self.currency} per {self.market_price.quantity_unit} "
            f"on {self.observation_date}"
        )
