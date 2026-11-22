from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q

from farmers.models import FarmerProfile


class Farm(models.Model):
    farmer = models.ForeignKey(
        FarmerProfile,
        on_delete=models.PROTECT,
        related_name="farms",
    )
    name = models.CharField(max_length=150)
    county = models.CharField(max_length=100, blank=True)
    sub_county = models.CharField(max_length=100, blank=True)
    ward = models.CharField(max_length=100, blank=True)
    village = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "farm"
        verbose_name_plural = "farms"
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("farmer", "name"),
                name="unique_farm_name_per_farmer",
            ),
        ]

    def __str__(self):
        user = self.farmer.user
        farmer_name = user.get_full_name().strip() or user.get_username()
        return f"{self.name} ({farmer_name})"


class Field(models.Model):
    farm = models.ForeignKey(
        Farm,
        on_delete=models.PROTECT,
        related_name="fields",
    )
    name = models.CharField(max_length=150)
    area_hectares = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text="Field area in hectares. Must be greater than zero.",
    )
    latitude = models.DecimalField(
        max_digits=8,
        decimal_places=6,
        blank=True,
        null=True,
        validators=[
            MinValueValidator(Decimal("-90")),
            MaxValueValidator(Decimal("90")),
        ],
        help_text="Optional field location latitude in decimal degrees.",
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
        help_text="Optional field location longitude in decimal degrees.",
    )
    irrigation_available = models.BooleanField(
        blank=True,
        null=True,
        help_text="Leave blank if irrigation availability is unknown.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "field"
        verbose_name_plural = "fields"
        ordering = ("farm__name", "name")
        constraints = [
            models.UniqueConstraint(
                fields=("farm", "name"),
                name="unique_field_name_per_farm",
            ),
            models.CheckConstraint(
                condition=Q(area_hectares__gt=0),
                name="field_area_must_be_positive",
            ),
            models.CheckConstraint(
                condition=(
                    Q(latitude__isnull=True, longitude__isnull=True)
                    | Q(latitude__isnull=False, longitude__isnull=False)
                ),
                name="field_coordinates_must_be_paired",
            ),
            models.CheckConstraint(
                condition=(
                    Q(latitude__isnull=True)
                    | Q(latitude__gte=Decimal("-90"), latitude__lte=Decimal("90"))
                ),
                name="field_latitude_within_range",
            ),
            models.CheckConstraint(
                condition=(
                    Q(longitude__isnull=True)
                    | Q(
                        longitude__gte=Decimal("-180"),
                        longitude__lte=Decimal("180"),
                    )
                ),
                name="field_longitude_within_range",
            ),
        ]

    def __str__(self):
        return f"{self.farm.name} - {self.name}"
