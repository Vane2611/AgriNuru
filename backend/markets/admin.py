from django.contrib import admin

from .models import Market, MarketPrice, MarketPriceObservation


class MarketPriceInline(admin.TabularInline):
    model = MarketPrice
    extra = 0
    autocomplete_fields = ("crop",)
    readonly_fields = ("created_at", "updated_at")
    show_change_link = True


class MarketPriceObservationInline(admin.TabularInline):
    model = MarketPriceObservation
    extra = 0
    readonly_fields = ("created_at", "updated_at")
    show_change_link = True


@admin.register(Market)
class MarketAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "market_type",
        "county",
        "sub_county",
        "is_active",
    )
    list_filter = ("market_type", "is_active", "county", "sub_county")
    search_fields = ("name", "county", "sub_county", "description")
    ordering = ("county", "name")
    readonly_fields = ("created_at", "updated_at")
    inlines = (MarketPriceInline,)


@admin.register(MarketPrice)
class MarketPriceAdmin(admin.ModelAdmin):
    list_display = ("crop", "market", "quantity_unit", "created_at")
    list_filter = ("market__county", "crop")
    search_fields = (
        "crop__common_name",
        "crop__scientific_name",
        "market__name",
        "market__county",
        "quantity_unit",
    )
    ordering = ("market__name", "crop__common_name", "quantity_unit")
    autocomplete_fields = ("market", "crop")
    readonly_fields = ("created_at", "updated_at")
    list_select_related = ("market", "crop")
    inlines = (MarketPriceObservationInline,)


@admin.register(MarketPriceObservation)
class MarketPriceObservationAdmin(admin.ModelAdmin):
    list_display = (
        "market_price",
        "observation_date",
        "price",
        "currency",
        "grade",
        "source_name",
    )
    list_filter = ("currency", "grade", "source_name")
    search_fields = (
        "market_price__market__name",
        "market_price__crop__common_name",
        "source_name",
        "source_reference",
        "grade",
    )
    date_hierarchy = "observation_date"
    autocomplete_fields = ("market_price",)
    readonly_fields = ("created_at", "updated_at")
    list_select_related = (
        "market_price",
        "market_price__market",
        "market_price__crop",
    )
