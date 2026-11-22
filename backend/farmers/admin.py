from django.contrib import admin

from .models import FarmerProfile


@admin.register(FarmerProfile)
class FarmerProfileAdmin(admin.ModelAdmin):
    list_display = (
        "farmer_name",
        "user",
        "phone_number",
        "preferred_language",
        "created_at",
    )
    search_fields = (
        "user__username",
        "user__first_name",
        "user__last_name",
        "phone_number",
    )
    ordering = ("user__username",)
    autocomplete_fields = ("user",)
    readonly_fields = ("created_at", "updated_at")

    @admin.display(description="Farmer", ordering="user__last_name")
    def farmer_name(self, obj):
        return obj.user.get_full_name().strip() or obj.user.get_username()
