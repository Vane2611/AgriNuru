from django.urls import path

from .views import (
    CropRecommendationDetailView,
    CropRecommendationListCreateView,
    DecisionReportDetailView,
    DecisionReportListCreateView,
    MarketComparisonDetailView,
    MarketComparisonListCreateView,
    MLStatusView,
    ProductionPlanDetailView,
    ProductionPlanListCreateView,
)


app_name = "decisions"

urlpatterns = [
    path(
        "recommendations/",
        CropRecommendationListCreateView.as_view(),
        name="recommendation-list",
    ),
    path(
        "recommendations/<int:pk>/",
        CropRecommendationDetailView.as_view(),
        name="recommendation-detail",
    ),
    path(
        "production-plans/",
        ProductionPlanListCreateView.as_view(),
        name="production-plan-list",
    ),
    path(
        "production-plans/<int:pk>/",
        ProductionPlanDetailView.as_view(),
        name="production-plan-detail",
    ),
    path(
        "reports/",
        DecisionReportListCreateView.as_view(),
        name="report-list",
    ),
    path(
        "reports/<int:pk>/",
        DecisionReportDetailView.as_view(),
        name="report-detail",
    ),
    path(
        "market-comparisons/",
        MarketComparisonListCreateView.as_view(),
        name="market-comparison-list",
    ),
    path(
        "market-comparisons/<int:pk>/",
        MarketComparisonDetailView.as_view(),
        name="market-comparison-detail",
    ),
    path(
        "ml-status/",
        MLStatusView.as_view(),
        name="ml-status",
    ),
]
