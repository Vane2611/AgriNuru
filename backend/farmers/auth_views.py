import threading
import time

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.core.cache import cache
from django.db import connection, transaction
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import BaseThrottle

from .auth_serializers import (
    FarmerSessionSerializer,
    LoginSerializer,
    RegistrationSerializer,
    UserSessionSerializer,
)
from .models import FarmerProfile


User = get_user_model()


class LoginRateThrottle(BaseThrottle):
    process_locks = {}
    process_locks_guard = threading.Lock()

    def allow_request(self, request, view):
        ident = self.get_ident(request)
        if not ident:
            return True

        cache_key = f"login-throttle:{ident}"
        limit = settings.LOGIN_THROTTLE_LIMIT
        duration = settings.LOGIN_THROTTLE_DURATION

        with self.process_locks_guard:
            process_lock = self.process_locks.setdefault(cache_key, threading.Lock())

        with process_lock:
            if connection.vendor == "postgresql":
                return self._allow_postgresql_request(
                    cache_key,
                    limit,
                    duration,
                )
            return self._allow_cached_request(cache_key, limit, duration)

    def _allow_postgresql_request(self, cache_key, limit, duration):
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT pg_advisory_xact_lock(hashtext(%s))",
                    [cache_key],
                )
            return self._allow_cached_request(cache_key, limit, duration)

    def _allow_cached_request(self, cache_key, limit, duration):
        now = time.time()
        count = cache.get(cache_key)
        if count is None:
            if cache.add(cache_key, 1, timeout=duration):
                cache.add(
                    f"{cache_key}:started",
                    now,
                    timeout=duration,
                )
                self.retry_after = None
                return True
            count = cache.get(cache_key)

        if count is None:
            count = 0

        if count >= limit:
            started = cache.get(f"{cache_key}:started", now)
            elapsed = max(0, now - float(started))
            self.retry_after = max(1, int(duration - elapsed))
            return False

        count = cache.incr(cache_key)
        if count > limit:
            started = cache.get(f"{cache_key}:started", now)
            elapsed = max(0, now - float(started))
            self.retry_after = max(1, int(duration - elapsed))
            return False

        self.retry_after = None
        return True

    def wait(self):
        if self.retry_after is None:
            return None
        return max(1, int(self.retry_after))


def session_payload(user):
    profile = FarmerProfile.objects.filter(user=user).first()
    return {
        "is_authenticated": True,
        "user": UserSessionSerializer(user).data,
        "farmer_profile": (
            FarmerSessionSerializer(profile).data if profile is not None else None
        ),
    }


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfCookieView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def get(self, request):
        return Response({"detail": "CSRF cookie set."}, status=status.HTTP_200_OK)


@method_decorator(csrf_protect, name="dispatch")
class RegistrationView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                "detail": "Registration completed. You can now sign in.",
                "user": UserSessionSerializer(user).data,
                "farmer_profile": FarmerSessionSerializer(
                    user.farmer_profile
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (LoginRateThrottle,)

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["username_or_email"]
        password = serializer.validated_data["password"]

        username = identifier
        if "@" in identifier:
            matching_usernames = list(
                User.objects.filter(email__iexact=identifier)
                .order_by("pk")
                .values_list("username", flat=True)[:2]
            )
            if len(matching_usernames) != 1:
                return Response(
                    {"detail": "Invalid username/email or password."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            username = matching_usernames[0]

        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response(
                {"detail": "Invalid username/email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        login(request, user)
        return Response(session_payload(user), status=status.HTTP_200_OK)


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        logout(request)
        return Response(
            {"detail": "You have been signed out."},
            status=status.HTTP_200_OK,
        )


class SessionView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"is_authenticated": False}, status=status.HTTP_200_OK)
        return Response(session_payload(request.user), status=status.HTTP_200_OK)
