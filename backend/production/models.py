from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models
from django.db.models import F, Q

from crops.models import Crop, CropVariety
from farms.models import Field


currency_code_validator = RegexValidator(
    regex=r"^[A-Z]{3}$",
    message="Enter a three-letter uppercase currency code.",
)


class GrowingSeason(models.Model):
    class Status(models.TextChoices):
        PLANNED = "planned", "Planned"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"
        ABANDONED = "abandoned", "Abandoned"

    field = models.ForeignKey(
        Field,
        on_delete=models.PROTECT,
        related_name="growing_seasons",
    )
    crop = models.ForeignKey(
        Crop,
        on_delete=models.PROTECT,
        related_name="growing_seasons",
    )
    variety = models.ForeignKey(
        CropVariety,
        on_delete=models.PROTECT,
        related_name="growing_seasons",
        blank=True,
        null=True,
    )
    planting_date = models.DateField()
    expected_harvest_date = models.DateField(
        blank=True,
        null=True,
        help_text="Optional expected date for the season's harvest.",
    )
    actual_harvest_date = models.DateField(
        blank=True,
        null=True,
        help_text="Optional date the season's harvest was completed.",
    )
    area_planted_hectares = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0.0001"))],
        help_text="Optional area planted in hectares.",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PLANNED,
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "growing season"
        verbose_name_plural = "growing seasons"
        ordering = ("-planting_date",)
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(area_planted_hectares__isnull=True)
                    | Q(area_planted_hectares__gt=0)
                ),
                name="growing_season_area_planted_positive",
            ),
            models.CheckConstraint(
                condition=(
                    Q(expected_harvest_date__isnull=True)
                    | Q(expected_harvest_date__gte=F("planting_date"))
                ),
                name="growing_season_expected_harvest_after_planting",
            ),
            models.CheckConstraint(
                condition=(
                    Q(actual_harvest_date__isnull=True)
                    | Q(actual_harvest_date__gte=F("planting_date"))
                ),
                name="growing_season_actual_harvest_after_planting",
            ),
        ]

    def clean(self):
        super().clean()
        errors = {}

        if self.variety_id and self.crop_id:
            if self.variety.crop_id != self.crop_id:
                errors["variety"] = (
                    "The selected variety must belong to the selected crop."
                )

        if self.field_id and self.area_planted_hectares is not None:
            field_area = Field.objects.filter(
                pk=self.field_id
            ).values_list("area_hectares", flat=True).first()
            if (
                field_area is not None
                and self.area_planted_hectares > field_area
            ):
                errors["area_planted_hectares"] = (
                    "Area planted cannot exceed the field's recorded area."
                )

        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.crop.common_name} on {self.field} ({self.planting_date})"


class ProductionActivity(models.Model):
    class ActivityType(models.TextChoices):
        LAND_PREPARATION = "land_preparation", "Land preparation"
        PLANTING = "planting", "Planting"
        IRRIGATION = "irrigation", "Irrigation"
        FERTILISER_APPLICATION = "fertiliser_application", "Fertiliser application"
        PEST_CONTROL = "pest_control", "Pest control"
        WEEDING = "weeding", "Weeding"
        OTHER = "other", "Other"

    growing_season = models.ForeignKey(
        GrowingSeason,
        on_delete=models.PROTECT,
        related_name="activities",
    )
    activity_type = models.CharField(
        max_length=30,
        choices=ActivityType.choices,
    )
    activity_date = models.DateField()
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "production activity"
        verbose_name_plural = "production activities"
        ordering = ("activity_date", "created_at")

    def clean(self):
        super().clean()
        # Land preparation is a pre-planting activity and is explicitly exempt
        # from the planting-date lower bound.
        if self.activity_type == self.ActivityType.LAND_PREPARATION:
            return
        if (
            self.growing_season_id
            and self.activity_date
            and self.activity_date < self.growing_season.planting_date
        ):
            raise ValidationError(
                {
                    "activity_date": (
                        "Activity date cannot be before planting date."
                    )
                }
            )

    def __str__(self):
        return (
            f"{self.get_activity_type_display()} for "
            f"{self.growing_season} on {self.activity_date}"
        )


class ProductionCost(models.Model):
    class CostCategory(models.TextChoices):
        SEEDS = "seeds", "Seeds"
        FERTILISER = "fertiliser", "Fertiliser"
        LABOUR = "labour", "Labour"
        IRRIGATION = "irrigation", "Irrigation"
        PEST_CONTROL = "pest_control", "Pest control"
        LAND_PREPARATION = "land_preparation", "Land preparation"
        MACHINERY = "machinery", "Machinery"
        OTHER = "other", "Other"

    class CostBasis(models.TextChoices):
        ACTUAL = "actual", "Actual cost"
        ESTIMATED = "estimated", "Estimated cost"

    growing_season = models.ForeignKey(
        GrowingSeason,
        on_delete=models.PROTECT,
        related_name="costs",
    )
    category = models.CharField(
        max_length=30,
        choices=CostCategory.choices,
    )
    cost_basis = models.CharField(
        max_length=10,
        choices=CostBasis.choices,
        default=CostBasis.ACTUAL,
        help_text="Indicates whether the amount is actual or estimated.",
    )
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    currency = models.CharField(
        max_length=3,
        validators=[currency_code_validator],
        help_text="Three-letter currency code, for example KES.",
    )
    cost_date = models.DateField(
        blank=True,
        null=True,
        help_text=(
            "Optional expense date for actual costs or preparation date "
            "for estimates."
        ),
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "production cost"
        verbose_name_plural = "production costs"
        ordering = ("cost_date", "created_at")
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0),
                name="production_cost_amount_positive",
            ),
        ]

    def __str__(self):
        return (
            f"{self.get_category_display()} cost for "
            f"{self.growing_season}: {self.amount} {self.currency}"
        )


class HarvestEstimate(models.Model):
    class EstimateSource(models.TextChoices):
        FARMER = "farmer", "Farmer estimate"
        EXTENSION = "extension", "Extension source"
        MODEL = "model", "Model estimate"
        OTHER = "other", "Other source"

    growing_season = models.ForeignKey(
        GrowingSeason,
        on_delete=models.PROTECT,
        related_name="harvest_estimates",
    )
    estimated_on = models.DateField(
        help_text="Date this estimate was made.",
    )
    estimated_quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    quantity_unit = models.CharField(
        max_length=30,
        help_text="Unit for the estimated quantity, such as kg or tonnes.",
    )
    estimate_source = models.CharField(
        max_length=15,
        choices=EstimateSource.choices,
        blank=True,
    )
    source_reference = models.CharField(max_length=500, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "harvest estimate"
        verbose_name_plural = "harvest estimates"
        ordering = ("-estimated_on", "-created_at")
        constraints = [
            models.CheckConstraint(
                condition=Q(estimated_quantity__gt=0),
                name="harvest_estimate_quantity_positive",
            ),
        ]

    def __str__(self):
        return (
            f"Estimated harvest for {self.growing_season}: "
            f"{self.estimated_quantity} {self.quantity_unit}"
        )


class HarvestRecord(models.Model):
    growing_season = models.ForeignKey(
        GrowingSeason,
        on_delete=models.PROTECT,
        related_name="harvest_records",
    )
    harvested_on = models.DateField()
    quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    quantity_unit = models.CharField(
        max_length=30,
        help_text="Unit for the harvested quantity, such as kg or tonnes.",
    )
    quality_grade = models.CharField(
        max_length=100,
        blank=True,
        help_text="Optional locally used grade or quality description.",
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "harvest record"
        verbose_name_plural = "harvest records"
        ordering = ("harvested_on", "created_at")
        constraints = [
            models.CheckConstraint(
                condition=Q(quantity__gt=0),
                name="harvest_record_quantity_positive",
            ),
        ]

    def clean(self):
        super().clean()
        if (
            self.growing_season_id
            and self.harvested_on
            and self.harvested_on < self.growing_season.planting_date
        ):
            raise ValidationError(
                {"harvested_on": "Harvest date cannot be before planting date."}
            )

    def __str__(self):
        return (
            f"Harvest for {self.growing_season}: "
            f"{self.quantity} {self.quantity_unit} on {self.harvested_on}"
        )
