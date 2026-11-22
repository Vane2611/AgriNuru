from django.urls import path

from .auth_views import (
    CsrfCookieView,
    LoginView,
    LogoutView,
    RegistrationView,
    SessionView,
)


app_name = "auth"

urlpatterns = [
    path("csrf/", CsrfCookieView.as_view(), name="csrf"),
    path("register/", RegistrationView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("session/", SessionView.as_view(), name="session"),
]
