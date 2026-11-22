from django.urls import path

from .views import (
    GrowingSeasonDetailView,
    GrowingSeasonListCreateView,
    HarvestEstimateDetailView,
    HarvestEstimateListCreateView,
    HarvestRecordDetailView,
    HarvestRecordListCreateView,
    ProductionActivityDetailView,
    ProductionActivityListCreateView,
    ProductionCostDetailView,
    ProductionCostListCreateView,
)


app_name = "production"

urlpatterns = [
    path("seasons/", GrowingSeasonListCreateView.as_view(), name="season-list"),
    path(
        "seasons/<int:pk>/",
        GrowingSeasonDetailView.as_view(),
        name="season-detail",
    ),
    path(
        "activities/",
        ProductionActivityListCreateView.as_view(),
        name="activity-list",
    ),
    path(
        "activities/<int:pk>/",
        ProductionActivityDetailView.as_view(),
        name="activity-detail",
    ),
    path("costs/", ProductionCostListCreateView.as_view(), name="cost-list"),
    path("costs/<int:pk>/", ProductionCostDetailView.as_view(), name="cost-detail"),
    path(
        "harvest-estimates/",
        HarvestEstimateListCreateView.as_view(),
        name="harvest-estimate-list",
    ),
    path(
        "harvest-estimates/<int:pk>/",
        HarvestEstimateDetailView.as_view(),
        name="harvest-estimate-detail",
    ),
    path(
        "harvest-records/",
        HarvestRecordListCreateView.as_view(),
        name="harvest-record-list",
    ),
    path(
        "harvest-records/<int:pk>/",
        HarvestRecordDetailView.as_view(),
        name="harvest-record-detail",
    ),
]
