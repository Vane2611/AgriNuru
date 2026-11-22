from django.urls import path

from .views import (
    FarmDetailView,
    FarmFieldDetailView,
    FarmFieldsListCreateView,
    FarmListCreateView,
)


app_name = "farms"

urlpatterns = [
    path("", FarmListCreateView.as_view(), name="farm-list"),
    path("<int:farm_pk>/", FarmDetailView.as_view(), name="farm-detail"),
    path(
        "<int:farm_pk>/fields/",
        FarmFieldsListCreateView.as_view(),
        name="field-list",
    ),
    path(
        "<int:farm_pk>/fields/<int:field_pk>/",
        FarmFieldDetailView.as_view(),
        name="field-detail",
    ),
]
