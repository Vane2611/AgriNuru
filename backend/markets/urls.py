from django.urls import path

from .views import (
    MarketDetailView,
    MarketListCreateView,
    MarketPriceDetailView,
    MarketPriceListCreateView,
    MarketPriceObservationDetailView,
    MarketPriceObservationListCreateView,
)


app_name = "markets"

urlpatterns = [
    path("", MarketListCreateView.as_view(), name="market-list"),
    path("<int:pk>/", MarketDetailView.as_view(), name="market-detail"),
    path("prices/", MarketPriceListCreateView.as_view(), name="price-list"),
    path("prices/<int:pk>/", MarketPriceDetailView.as_view(), name="price-detail"),
    path(
        "observations/",
        MarketPriceObservationListCreateView.as_view(),
        name="observation-list",
    ),
    path(
        "observations/<int:pk>/",
        MarketPriceObservationDetailView.as_view(),
        name="observation-detail",
    ),
]
