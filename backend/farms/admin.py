from django.contrib import admin

from .models import Farm, Field


@admin.register(Farm)
class FarmAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "farmer",
        "county",
        "sub_county",
        "created_at",
    )
    list_filter = ("county", "sub_county")
    search_fields = (
        "name",
        "farmer__user__username",
        "farmer__user__first_name",
        "farmer__user__last_name",
        "county",
        "sub_county",
        "ward",
        "village",
    )
    ordering = ("name",)
    autocomplete_fields = ("farmer",)
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("farmer__user",)


@admin.register(Field)
class FieldAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "farm",
        "area_hectares",
        "irrigation_available",
        "created_at",
    )
    list_filter = ("irrigation_available", "farm__county")
    search_fields = ("name", "farm__name", "farm__farmer__user__username")
    ordering = ("farm__name", "name")
    autocomplete_fields = ("farm",)
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("farm", "farm__farmer__user")
