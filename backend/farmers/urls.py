from django.urls import path

from .views import FarmerProfileView


app_name = "farmers"

urlpatterns = [
    path("me/", FarmerProfileView.as_view(), name="profile"),
]
