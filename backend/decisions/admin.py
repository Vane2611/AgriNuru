from django.contrib import admin

from .models import (
    CropRecommendation,
    DecisionReport,
    MarketComparison,
    ProductionPlan,
)


class MarketComparisonInline(admin.TabularInline):
    model = MarketComparison
    extra = 0
    autocomplete_fields = ("production_plan", "price_observation")
    readonly_fields = ("created_at", "updated_at")
    show_change_link = True


@admin.register(CropRecommendation)
class CropRecommendationAdmin(admin.ModelAdmin):
    list_display = (
        "crop",
        "variety",
        "field",
        "suitability_score",
        "status",
        "generated_at",
    )
    list_filter = ("status", "crop", "field__farm__county")
    search_fields = (
        "crop__common_name",
        "variety__name",
        "field__name",
        "field__farm__name",
        "explanation",
        "model_version",
    )
    date_hierarchy = "generated_at"
    ordering = ("-generated_at",)
    autocomplete_fields = ("field", "crop", "variety")
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("field", "crop", "variety")


@admin.register(ProductionPlan)
class ProductionPlanAdmin(admin.ModelAdmin):
    list_display = (
        "crop",
        "variety",
        "field",
        "growing_season",
        "status",
        "expected_yield",
        "yield_unit",
        "estimated_cost",
        "currency",
    )
    list_filter = ("status", "crop", "field__farm__county", "currency")
    search_fields = (
        "crop__common_name",
        "variety__name",
        "field__name",
        "field__farm__name",
        "growing_season__field__name",
        "model_version",
    )
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    autocomplete_fields = (
        "field",
        "crop",
        "variety",
        "growing_season",
        "crop_recommendation",
    )
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("field", "crop", "variety", "growing_season")


@admin.register(DecisionReport)
class DecisionReportAdmin(admin.ModelAdmin):
    list_display = (
        "field",
        "status",
        "generated_at",
        "created_at",
        "model_version",
    )
    list_filter = ("status", "field__farm__county")
    search_fields = (
        "field__name",
        "field__farm__name",
        "summary",
        "recommendation_text",
        "model_version",
    )
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    autocomplete_fields = ("field", "crop_recommendation", "production_plan")
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("field",)
    inlines = (MarketComparisonInline,)


@admin.register(MarketComparison)
class MarketComparisonAdmin(admin.ModelAdmin):
    list_display = (
        "report_field",
        "crop_name",
        "market_name",
        "comparison_date",
        "quantity",
        "estimated_gross_sales_value",
        "estimated_transport_cost",
        "estimated_net_return",
        "currency",
    )
    list_filter = (
        "currency",
        "price_observation__market_price__market__county",
        "price_observation__market_price__market__market_type",
    )
    search_fields = (
        "decision_report__field__name",
        "price_observation__market_price__crop__common_name",
        "price_observation__market_price__market__name",
        "production_plan__crop__common_name",
    )
    date_hierarchy = "comparison_date"
    ordering = ("-comparison_date",)
    autocomplete_fields = ("decision_report", "production_plan", "price_observation")
    readonly_fields = ("created_at", "updated_at")
    list_select_related = (
        "decision_report__field",
        "production_plan__crop",
        "price_observation__market_price__crop",
        "price_observation__market_price__market",
    )

    @admin.display(description="Field", ordering="decision_report__field__name")
    def report_field(self, obj):
        return obj.decision_report.field

    @admin.display(
        description="Crop",
        ordering="price_observation__market_price__crop__common_name",
    )
    def crop_name(self, obj):
        return obj.price_observation.market_price.crop.common_name

    @admin.display(
        description="Market",
        ordering="price_observation__market_price__market__name",
    )
    def market_name(self, obj):
        return obj.price_observation.market_price.market.name

    @admin.display(description="Est. net return")
    def estimated_net_return(self, obj):
        return obj.estimated_net_return
