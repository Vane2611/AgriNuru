from django.contrib import admin

from .models import Crop, CropRequirement, CropVariety


@admin.register(Crop)
class CropAdmin(admin.ModelAdmin):
    list_display = (
        "common_name",
        "scientific_name",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active",)
    search_fields = ("common_name", "scientific_name", "description")
    ordering = ("common_name",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(CropVariety)
class CropVarietyAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "crop",
        "maturity_days",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active", "crop")
    search_fields = ("name", "crop__common_name", "crop__scientific_name")
    ordering = ("crop__common_name", "name")
    autocomplete_fields = ("crop",)
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("crop",)


@admin.register(CropRequirement)
class CropRequirementAdmin(admin.ModelAdmin):
    list_display = (
        "requirement_target",
        "soil_ph_minimum",
        "soil_ph_maximum",
        "temperature_minimum_celsius",
        "temperature_maximum_celsius",
        "agro_ecological_zone",
        "created_at",
    )
    list_filter = ("crop", "variety", "agro_ecological_zone")
    search_fields = (
        "crop__common_name",
        "variety__name",
        "variety__crop__common_name",
        "soil_type",
        "agro_ecological_zone",
        "source_reference",
    )
    date_hierarchy = "created_at"
    autocomplete_fields = ("crop", "variety")
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("crop", "variety", "variety__crop")

    @admin.display(description="Crop or variety")
    def requirement_target(self, obj):
        return obj.crop or obj.variety
