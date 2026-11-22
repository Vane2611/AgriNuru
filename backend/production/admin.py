from django.contrib import admin

from .models import (
    GrowingSeason,
    HarvestEstimate,
    HarvestRecord,
    ProductionActivity,
    ProductionCost,
)


class ProductionActivityInline(admin.TabularInline):
    model = ProductionActivity
    extra = 0
    autocomplete_fields = ("growing_season",)
    readonly_fields = ("created_at", "updated_at")
    show_change_link = True


class ProductionCostInline(admin.TabularInline):
    model = ProductionCost
    extra = 0
    autocomplete_fields = ("growing_season",)
    readonly_fields = ("created_at", "updated_at")
    show_change_link = True


class HarvestEstimateInline(admin.TabularInline):
    model = HarvestEstimate
    extra = 0
    autocomplete_fields = ("growing_season",)
    readonly_fields = ("created_at", "updated_at")
    show_change_link = True


class HarvestRecordInline(admin.TabularInline):
    model = HarvestRecord
    extra = 0
    autocomplete_fields = ("growing_season",)
    readonly_fields = ("created_at", "updated_at")
    show_change_link = True


@admin.register(GrowingSeason)
class GrowingSeasonAdmin(admin.ModelAdmin):
    list_display = (
        "crop",
        "variety",
        "field",
        "planting_date",
        "expected_harvest_date",
        "actual_harvest_date",
        "status",
    )
    list_filter = ("status", "crop", "field__farm__county")
    search_fields = (
        "crop__common_name",
        "variety__name",
        "field__name",
        "field__farm__name",
        "field__farm__farmer__user__username",
    )
    date_hierarchy = "planting_date"
    ordering = ("-planting_date",)
    autocomplete_fields = ("field", "crop", "variety")
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("field", "field__farm", "crop", "variety")
    inlines = (
        ProductionActivityInline,
        ProductionCostInline,
        HarvestEstimateInline,
        HarvestRecordInline,
    )


@admin.register(ProductionActivity)
class ProductionActivityAdmin(admin.ModelAdmin):
    list_display = (
        "activity_type",
        "growing_season",
        "activity_date",
        "created_at",
    )
    list_filter = ("activity_type",)
    search_fields = (
        "growing_season__crop__common_name",
        "growing_season__field__name",
        "growing_season__field__farm__name",
        "notes",
    )
    date_hierarchy = "activity_date"
    autocomplete_fields = ("growing_season",)
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("growing_season", "growing_season__crop")


@admin.register(ProductionCost)
class ProductionCostAdmin(admin.ModelAdmin):
    list_display = (
        "category",
        "cost_basis",
        "growing_season",
        "amount",
        "currency",
        "cost_date",
    )
    list_filter = ("category", "cost_basis", "currency")
    search_fields = (
        "growing_season__crop__common_name",
        "growing_season__field__name",
        "growing_season__field__farm__name",
        "notes",
    )
    date_hierarchy = "cost_date"
    autocomplete_fields = ("growing_season",)
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("growing_season", "growing_season__crop")


@admin.register(HarvestEstimate)
class HarvestEstimateAdmin(admin.ModelAdmin):
    list_display = (
        "growing_season",
        "estimated_on",
        "estimated_quantity",
        "quantity_unit",
        "estimate_source",
    )
    list_filter = ("estimate_source", "quantity_unit")
    search_fields = (
        "growing_season__crop__common_name",
        "growing_season__field__name",
        "source_reference",
    )
    date_hierarchy = "estimated_on"
    autocomplete_fields = ("growing_season",)
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("growing_season", "growing_season__crop")


@admin.register(HarvestRecord)
class HarvestRecordAdmin(admin.ModelAdmin):
    list_display = (
        "growing_season",
        "harvested_on",
        "quantity",
        "quantity_unit",
        "quality_grade",
    )
    list_filter = ("quantity_unit", "quality_grade")
    search_fields = (
        "growing_season__crop__common_name",
        "growing_season__field__name",
        "quality_grade",
        "notes",
    )
    date_hierarchy = "harvested_on"
    autocomplete_fields = ("growing_season",)
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("growing_season", "growing_season__crop")
