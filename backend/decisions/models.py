from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import (
    MaxValueValidator,
    MinValueValidator,
    RegexValidator,
)
from django.db import models
from django.db.models import Q

from crops.models import Crop, CropVariety
from farms.models import Field
from markets.models import MarketPriceObservation
from production.models import GrowingSeason


currency_code_validator = RegexValidator(
    regex=r"^[A-Z]{3}$",
    message="Enter a three-letter uppercase currency code.",
)


class CropRecommendation(models.Model):
    class Status(models.TextChoices):
        GENERATED = "generated", "Generated"
        REVIEWED = "reviewed", "Reviewed"
        ACCEPTED = "accepted", "Accepted"
        DISMISSED = "dismissed", "Dismissed"
        SUPERSEDED = "superseded", "Superseded"

    field = models.ForeignKey(
        Field,
        on_delete=models.PROTECT,
        related_name="crop_recommendations",
    )
    crop = models.ForeignKey(
        Crop,
        on_delete=models.PROTECT,
        related_name="recommendations",
    )
    variety = models.ForeignKey(
        CropVariety,
        on_delete=models.PROTECT,
        related_name="recommendations",
        blank=True,
        null=True,
    )
    generated_at = models.DateTimeField()
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.GENERATED,
    )
    suitability_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[
            MinValueValidator(Decimal("0")),
            MaxValueValidator(Decimal("100")),
        ],
        help_text="Optional suitability score on a 0 to 100 scale.",
    )
    explanation = models.TextField(blank=True)
    supporting_factors = models.JSONField(default=dict, blank=True)
    assumptions = models.JSONField(default=dict, blank=True)
    source_reference = models.JSONField(default=list, blank=True)
    uncertainty_notes = models.TextField(blank=True)
    model_version = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "crop recommendation"
        verbose_name_plural = "crop recommendations"
        ordering = ("-generated_at",)
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(suitability_score__isnull=True)
                    | Q(
                        suitability_score__gte=Decimal("0"),
                        suitability_score__lte=Decimal("100"),
                    )
                ),
                name="crop_recommendation_score_in_range",
            ),
        ]

    def clean(self):
        super().clean()
        if (
            self.variety_id
            and self.crop_id
            and self.variety.crop_id != self.crop_id
        ):
            raise ValidationError(
                {"variety": "The selected variety must belong to the selected crop."}
            )

    def __str__(self):
        return f"{self.crop.common_name} recommendation for {self.field}"


class ProductionPlan(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PROPOSED = "proposed", "Proposed"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"
        SUPERSEDED = "superseded", "Superseded"

    field = models.ForeignKey(
        Field,
        on_delete=models.PROTECT,
        related_name="production_plans",
    )
    crop = models.ForeignKey(
        Crop,
        on_delete=models.PROTECT,
        related_name="production_plans",
    )
    variety = models.ForeignKey(
        CropVariety,
        on_delete=models.PROTECT,
        related_name="production_plans",
        blank=True,
        null=True,
    )
    growing_season = models.ForeignKey(
        GrowingSeason,
        on_delete=models.PROTECT,
        related_name="production_plans",
        blank=True,
        null=True,
    )
    crop_recommendation = models.ForeignKey(
        CropRecommendation,
        on_delete=models.PROTECT,
        related_name="production_plans",
        blank=True,
        null=True,
    )
    estimated_cost = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0"))],
    )
    currency = models.CharField(
        max_length=3,
        blank=True,
        validators=[currency_code_validator],
    )
    expected_yield = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    yield_unit = models.CharField(max_length=30, blank=True)
    assumptions = models.JSONField(default=dict, blank=True)
    source_references = models.JSONField(default=list, blank=True)
    uncertainty_notes = models.TextField(blank=True)
    model_version = models.CharField(max_length=100, blank=True)
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "production plan"
        verbose_name_plural = "production plans"
        ordering = ("-created_at",)
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(estimated_cost__isnull=True)
                    | Q(estimated_cost__gte=Decimal("0"))
                ),
                name="production_plan_estimated_cost_nonnegative",
            ),
            models.CheckConstraint(
                condition=(
                    Q(expected_yield__isnull=True)
                    | Q(expected_yield__gt=0)
                ),
                name="production_plan_expected_yield_positive",
            ),
            models.CheckConstraint(
                condition=(
                    Q(estimated_cost__isnull=True, currency="")
                    | (
                        Q(estimated_cost__isnull=False)
                        & ~Q(currency="")
                    )
                ),
                name="production_plan_cost_currency_together",
            ),
            models.CheckConstraint(
                condition=(
                    Q(expected_yield__isnull=True, yield_unit="")
                    | (
                        Q(expected_yield__isnull=False)
                        & ~Q(yield_unit="")
                    )
                ),
                name="production_plan_yield_unit_together",
            ),
        ]

    def clean(self):
        super().clean()
        errors = {}

        if (
            self.variety_id
            and self.crop_id
            and self.variety.crop_id != self.crop_id
        ):
            errors["variety"] = (
                "The selected variety must belong to the selected crop."
            )

        if self.growing_season_id:
            season = self.growing_season
            if self.field_id and season.field_id != self.field_id:
                errors["growing_season"] = (
                    "The growing season must belong to the selected field."
                )
            if self.crop_id and season.crop_id != self.crop_id:
                errors["growing_season"] = (
                    "The growing season must use the selected crop."
                )
            if season.variety_id != self.variety_id:
                errors["growing_season"] = (
                    "The growing season variety must match the plan variety."
                )

        if (
            self.crop_recommendation_id
            and self.field_id
            and self.crop_recommendation.field_id != self.field_id
        ):
            errors["crop_recommendation"] = (
                "The recommendation must be for the selected field."
            )
        if (
            self.crop_recommendation_id
            and self.crop_id
            and self.crop_recommendation.crop_id != self.crop_id
        ):
            errors["crop_recommendation"] = (
                "The recommendation must be for the selected crop."
            )
        if (
            self.crop_recommendation_id
            and self.variety_id
            and self.crop_recommendation.variety_id != self.variety_id
        ):
            errors["crop_recommendation"] = (
                "The recommendation variety must match the plan variety."
            )

        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.crop.common_name} production plan for {self.field}"


class DecisionReport(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        READY = "ready", "Ready"
        SHARED = "shared", "Shared"
        ARCHIVED = "archived", "Archived"

    field = models.ForeignKey(
        Field,
        on_delete=models.PROTECT,
        related_name="decision_reports",
    )
    crop_recommendation = models.ForeignKey(
        CropRecommendation,
        on_delete=models.PROTECT,
        related_name="decision_reports",
        blank=True,
        null=True,
    )
    production_plan = models.ForeignKey(
        ProductionPlan,
        on_delete=models.PROTECT,
        related_name="decision_reports",
        blank=True,
        null=True,
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    summary = models.TextField(blank=True)
    recommendation_text = models.TextField(blank=True)
    assumptions = models.JSONField(default=dict, blank=True)
    sources = models.JSONField(default=list, blank=True)
    model_version = models.CharField(max_length=100, blank=True)
    generated_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "decision report"
        verbose_name_plural = "decision reports"
        ordering = ("-created_at",)

    def clean(self):
        super().clean()
        errors = {}

        if (
            self.crop_recommendation_id
            and self.field_id
            and self.crop_recommendation.field_id != self.field_id
        ):
            errors["crop_recommendation"] = (
                "The recommendation must be for the selected field."
            )
        if (
            self.production_plan_id
            and self.field_id
            and self.production_plan.field_id != self.field_id
        ):
            errors["production_plan"] = (
                "The production plan must be for the selected field."
            )

        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"Decision report for {self.field} ({self.get_status_display()})"


class MarketComparison(models.Model):
    decision_report = models.ForeignKey(
        DecisionReport,
        on_delete=models.PROTECT,
        related_name="market_comparisons",
    )
    production_plan = models.ForeignKey(
        ProductionPlan,
        on_delete=models.PROTECT,
        related_name="market_comparisons",
        blank=True,
        null=True,
    )
    price_observation = models.ForeignKey(
        MarketPriceObservation,
        on_delete=models.PROTECT,
        related_name="decision_comparisons",
    )
    comparison_date = models.DateTimeField()
    quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
        help_text="Quantity in the unit of the linked market price series.",
    )
    estimated_gross_sales_value = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Estimated gross sales value before transport costs.",
    )
    estimated_transport_cost = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0"))],
        help_text="Estimated transport cost; leave blank if unknown.",
    )
    currency = models.CharField(
        max_length=3,
        validators=[currency_code_validator],
        help_text="Must match the linked market price observation currency.",
    )
    assumptions = models.JSONField(default=dict, blank=True)
    uncertainty_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "market comparison"
        verbose_name_plural = "market comparisons"
        ordering = ("-comparison_date",)
        constraints = [
            models.CheckConstraint(
                condition=Q(quantity__gt=0),
                name="market_comparison_quantity_positive",
            ),
            models.CheckConstraint(
                condition=(
                    Q(estimated_gross_sales_value__isnull=True)
                    | Q(estimated_gross_sales_value__gt=0)
                ),
                name="market_comparison_gross_value_positive",
            ),
            models.CheckConstraint(
                condition=(
                    Q(estimated_transport_cost__isnull=True)
                    | Q(estimated_transport_cost__gte=0)
                ),
                name="market_comparison_transport_cost_nonnegative",
            ),
        ]

    @property
    def estimated_net_return(self):
        if (
            self.estimated_gross_sales_value is None
            or self.estimated_transport_cost is None
        ):
            return None
        return self.estimated_gross_sales_value - self.estimated_transport_cost

    def clean(self):
        super().clean()
        errors = {}

        if (
            self.price_observation_id
            and self.currency
            and self.price_observation.currency != self.currency
        ):
            errors["currency"] = (
                "Currency must match the linked price observation."
            )

        if self.production_plan_id and self.price_observation_id:
            observation_crop_id = (
                self.price_observation.market_price.crop_id
            )
            if self.production_plan.crop_id != observation_crop_id:
                errors["price_observation"] = (
                    "The price observation crop must match the production plan crop."
                )

        if (
            self.decision_report_id
            and self.production_plan_id
            and self.decision_report.field_id != self.production_plan.field_id
        ):
            errors["production_plan"] = (
                "The production plan must belong to the report's field."
            )

        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return (
            f"Market comparison for "
            f"{self.price_observation.market_price.crop.common_name} at "
            f"{self.price_observation.market_price.market.name}"
        )
