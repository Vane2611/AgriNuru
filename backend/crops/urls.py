from django.urls import path

from .views import (
    CropDetailView,
    CropListCreateView,
    CropRequirementDetailView,
    CropRequirementListCreateView,
    CropVarietyDetailView,
    CropVarietyListCreateView,
    CropVarietyListForCropView,
)


app_name = "crops"

urlpatterns = [
    path("", CropListCreateView.as_view(), name="crop-list"),
    path("<int:pk>/", CropDetailView.as_view(), name="crop-detail"),
    path(
        "<int:crop_pk>/varieties/",
        CropVarietyListForCropView.as_view(),
        name="crop-variety-list",
    ),
    path("varieties/", CropVarietyListCreateView.as_view(), name="variety-list"),
    path(
        "varieties/<int:pk>/",
        CropVarietyDetailView.as_view(),
        name="variety-detail",
    ),
    path(
        "requirements/",
        CropRequirementListCreateView.as_view(),
        name="requirement-list",
    ),
    path(
        "requirements/<int:pk>/",
        CropRequirementDetailView.as_view(),
        name="requirement-detail",
    ),
]
