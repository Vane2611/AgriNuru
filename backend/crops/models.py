from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q


class Crop(models.Model):
    common_name = models.CharField(max_length=150)
    scientific_name = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "crop"
        verbose_name_plural = "crops"
        ordering = ("common_name",)

    def __str__(self):
        return self.common_name


class CropVariety(models.Model):
    crop = models.ForeignKey(
        Crop,
        on_delete=models.PROTECT,
        related_name="varieties",
    )
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    maturity_days = models.PositiveIntegerField(
        blank=True,
        null=True,
        validators=[MinValueValidator(1)],
        help_text="Optional maturity duration in days.",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "crop variety"
        verbose_name_plural = "crop varieties"
        ordering = ("crop__common_name", "name")
        constraints = [
            models.UniqueConstraint(
                fields=("crop", "name"),
                name="unique_crop_variety_name",
            ),
            models.CheckConstraint(
                condition=Q(maturity_days__isnull=True) | Q(maturity_days__gt=0),
                name="crop_variety_maturity_days_positive",
            ),
        ]

    def __str__(self):
        return f"{self.crop.common_name} - {self.name}"


class CropRequirement(models.Model):
    crop = models.ForeignKey(
        Crop,
        on_delete=models.PROTECT,
        related_name="requirements",
        blank=True,
        null=True,
    )
    variety = models.ForeignKey(
        CropVariety,
        on_delete=models.PROTECT,
        related_name="requirements",
        blank=True,
        null=True,
    )
    soil_ph_minimum = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[
            MinValueValidator(Decimal("0")),
            MaxValueValidator(Decimal("14")),
        ],
        help_text="Documented minimum soil pH on the 0 to 14 pH scale.",
    )
    soil_ph_maximum = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[
            MinValueValidator(Decimal("0")),
            MaxValueValidator(Decimal("14")),
        ],
        help_text="Documented maximum soil pH on the 0 to 14 pH scale.",
    )
    temperature_minimum_celsius = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("-273.15"))],
        help_text="Documented minimum temperature in degrees Celsius.",
    )
    temperature_maximum_celsius = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("-273.15"))],
        help_text="Documented maximum temperature in degrees Celsius.",
    )
    rainfall_minimum_mm = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0"))],
        help_text="Documented minimum rainfall depth in millimetres.",
    )
    rainfall_maximum_mm = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0"))],
        help_text="Documented maximum rainfall depth in millimetres.",
    )
    rainfall_period_days = models.PositiveIntegerField(
        blank=True,
        null=True,
        validators=[MinValueValidator(1)],
        help_text="Number of days over which the rainfall depth is defined.",
    )
    soil_type = models.CharField(max_length=150, blank=True)
    agro_ecological_zone = models.CharField(
        max_length=150,
        blank=True,
        help_text="Agroecological zone where these requirements apply, if specified.",
    )
    other_requirements = models.TextField(blank=True)
    source_reference = models.CharField(
        max_length=500,
        help_text="Citation or other reference for the documented requirements.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "crop requirement"
        verbose_name_plural = "crop requirements"
        ordering = ("created_at",)
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(crop__isnull=False, variety__isnull=True)
                    | Q(crop__isnull=True, variety__isnull=False)
                ),
                name="crop_requirement_has_one_target",
            ),
            models.CheckConstraint(
                condition=(
                    Q(soil_ph_minimum__isnull=True)
                    | Q(
                        soil_ph_minimum__gte=Decimal("0"),
                        soil_ph_minimum__lte=Decimal("14"),
                    )
                ),
                name="crop_requirement_ph_minimum_in_range",
            ),
            models.CheckConstraint(
                condition=(
                    Q(soil_ph_maximum__isnull=True)
                    | Q(
                        soil_ph_maximum__gte=Decimal("0"),
                        soil_ph_maximum__lte=Decimal("14"),
                    )
                ),
                name="crop_requirement_ph_maximum_in_range",
            ),
            models.CheckConstraint(
                condition=(
                    Q(soil_ph_minimum__isnull=True)
                    | Q(soil_ph_maximum__isnull=True)
                    | Q(soil_ph_minimum__lte=F("soil_ph_maximum"))
                ),
                name="crop_requirement_ph_minimum_lte_maximum",
            ),
            models.CheckConstraint(
                condition=(
                    Q(temperature_minimum_celsius__isnull=True)
                    | Q(temperature_minimum_celsius__gte=Decimal("-273.15"))
                ),
                name="crop_requirement_temperature_minimum_valid",
            ),
            models.CheckConstraint(
                condition=(
                    Q(temperature_maximum_celsius__isnull=True)
                    | Q(temperature_maximum_celsius__gte=Decimal("-273.15"))
                ),
                name="crop_requirement_temperature_maximum_valid",
            ),
            models.CheckConstraint(
                condition=(
                    Q(temperature_minimum_celsius__isnull=True)
                    | Q(temperature_maximum_celsius__isnull=True)
                    | Q(
                        temperature_minimum_celsius__lte=F(
                            "temperature_maximum_celsius"
                        )
                    )
                ),
                name="crop_requirement_temperature_minimum_lte_maximum",
            ),
            models.CheckConstraint(
                condition=(
                    Q(rainfall_minimum_mm__isnull=True)
                    | Q(rainfall_minimum_mm__gte=Decimal("0"))
                ),
                name="crop_requirement_rainfall_minimum_nonnegative",
            ),
            models.CheckConstraint(
                condition=(
                    Q(rainfall_maximum_mm__isnull=True)
                    | Q(rainfall_maximum_mm__gte=Decimal("0"))
                ),
                name="crop_requirement_rainfall_maximum_nonnegative",
            ),
            models.CheckConstraint(
                condition=(
                    Q(rainfall_minimum_mm__isnull=True)
                    | Q(rainfall_maximum_mm__isnull=True)
                    | Q(rainfall_minimum_mm__lte=F("rainfall_maximum_mm"))
                ),
                name="crop_requirement_rainfall_minimum_lte_maximum",
            ),
            models.CheckConstraint(
                condition=(
                    Q(
                        rainfall_minimum_mm__isnull=True,
                        rainfall_maximum_mm__isnull=True,
                        rainfall_period_days__isnull=True,
                    )
                    | (
                        (
                            Q(rainfall_minimum_mm__isnull=False)
                            | Q(rainfall_maximum_mm__isnull=False)
                        )
                        & Q(rainfall_period_days__isnull=False)
                    )
                ),
                name="crop_requirement_rainfall_has_period",
            ),
            models.CheckConstraint(
                condition=(
                    Q(rainfall_period_days__isnull=True)
                    | Q(rainfall_period_days__gt=0)
                ),
                name="crop_requirement_rainfall_period_positive",
            ),
        ]

    def __str__(self):
        target = self.crop if self.crop_id is not None else self.variety
        return f"Requirements for {target}"
