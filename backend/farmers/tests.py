import time
import os
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory, APITestCase

from .models import FarmerProfile
from .auth_serializers import DUPLICATE_ACCOUNT_IDENTIFIER_MESSAGE
from .auth_views import LoginRateThrottle
from config.settings import env_bool, parse_login_throttle_rate


User = get_user_model()


class FarmerProfileAPITests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.profile_url = reverse("farmers:profile")

        self.user = User.objects.create_user(
            username="farmer-one",
            password="test-password-one",
        )
        self.profile = FarmerProfile.objects.create(
            user=self.user,
            phone_number="+254712345678",
            preferred_language="en",
        )

        self.other_user = User.objects.create_user(
            username="farmer-two",
            password="test-password-two",
        )
        self.other_profile = FarmerProfile.objects.create(
            user=self.other_user,
            phone_number="+254723456789",
            preferred_language="sw-KE",
        )

    def test_anonymous_users_cannot_get_put_or_patch_profile(self):
        requests = (
            self.client.get(self.profile_url),
            self.client.put(self.profile_url, {}, format="json"),
            self.client.patch(self.profile_url, {}, format="json"),
        )

        for response in requests:
            with self.subTest(method=response.wsgi_request.method):
                self.assertIn(
                    response.status_code,
                    (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
                )

    def test_authenticated_user_retrieves_own_profile(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.profile_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(response.data),
            {"id", "user", "phone_number", "preferred_language",
             "created_at", "updated_at"},
        )
        self.assertEqual(response.data["id"], self.profile.pk)
        self.assertEqual(response.data["user"], self.user.pk)
        self.assertEqual(response.data["phone_number"], self.profile.phone_number)
        self.assertEqual(
            response.data["preferred_language"],
            self.profile.preferred_language,
        )

    def test_authenticated_user_can_update_profile_fields(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(
            self.profile_url,
            {
                "phone_number": "+254734567890",
                "preferred_language": "sw-KE",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.phone_number, "+254734567890")
        self.assertEqual(self.profile.preferred_language, "sw-KE")

    def test_authenticated_user_can_put_profile(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.put(
            self.profile_url,
            {
                "phone_number": "+254734567890",
                "preferred_language": "sw",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.phone_number, "+254734567890")
        self.assertEqual(self.profile.preferred_language, "sw")

    def test_user_cannot_access_or_modify_another_users_profile(self):
        self.client.force_authenticate(user=self.user)
        other_profile_url = f"{self.profile_url}{self.other_profile.pk}/"

        response = self.client.patch(
            other_profile_url,
            {"phone_number": "+254745678901"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.other_profile.refresh_from_db()
        self.assertEqual(self.other_profile.phone_number, "+254723456789")

        response = self.client.patch(
            self.profile_url,
            {"phone_number": "+254745678901"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.profile.refresh_from_db()
        self.other_profile.refresh_from_db()
        self.assertEqual(self.profile.phone_number, "+254745678901")
        self.assertEqual(self.other_profile.phone_number, "+254723456789")

    def test_read_only_fields_cannot_be_changed(self):
        self.client.force_authenticate(user=self.user)
        original_created_at = self.profile.created_at
        attempted_timestamp = "2099-01-01T00:00:00Z"

        response = self.client.patch(
            self.profile_url,
            {
                "id": self.other_profile.pk,
                "user": self.other_user.pk,
                "created_at": attempted_timestamp,
                "updated_at": attempted_timestamp,
                "preferred_language": "sw",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.profile.refresh_from_db()
        self.assertEqual(response.data["id"], self.profile.pk)
        self.assertEqual(response.data["user"], self.user.pk)
        self.assertEqual(self.profile.user_id, self.user.pk)
        self.assertEqual(self.profile.created_at, original_created_at)
        self.assertNotEqual(response.data["created_at"], attempted_timestamp)
        self.assertNotEqual(response.data["updated_at"], attempted_timestamp)

    def test_user_without_profile_receives_not_found(self):
        user_without_profile = User.objects.create_user(
            username="farmer-without-profile",
            password="test-password-three",
        )
        self.client.force_authenticate(user=user_without_profile)

        response = self.client.get(self.profile_url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_post_is_not_allowed(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(self.profile_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_invalid_profile_values_are_rejected(self):
        self.client.force_authenticate(user=self.user)

        invalid_payloads = (
            {"phone_number": "not-a-phone-number"},
            {"preferred_language": "invalid_tag"},
        )
        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.patch(
                    self.profile_url,
                    payload,
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        self.profile.refresh_from_db()
        self.assertEqual(self.profile.phone_number, "+254712345678")
        self.assertEqual(self.profile.preferred_language, "en")


class FarmerAuthenticationAPITests(APITestCase):
    registration_url = reverse("auth:register")
    login_url = reverse("auth:login")
    logout_url = reverse("auth:logout")
    csrf_url = reverse("auth:csrf")
    session_url = reverse("auth:session")
    valid_password = "T0ugh!Vineyard#74"

    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        cache.clear()
        self.existing_user = User.objects.create_user(
            username="existing-farmer",
            email="existing@example.com",
            password=self.valid_password,
            first_name="Existing",
            last_name="Farmer",
        )
        self.existing_profile = FarmerProfile.objects.create(
            user=self.existing_user,
            phone_number="+254712345678",
        )

    def csrf_headers(self):
        response = self.client.get(self.csrf_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("csrftoken", self.client.cookies)
        return {
            "HTTP_X_CSRFTOKEN": self.client.cookies["csrftoken"].value,
        }

    def registration_payload(self, **overrides):
        return {
            "full_name": "Amina Wanjiku Njoroge",
            "username": "amina-farmer",
            "email": "amina@example.com",
            "phone_number": "+254723456789",
            "password": self.valid_password,
            "confirm_password": self.valid_password,
            **overrides,
        }

    def test_csrf_endpoint_sets_cookie_and_returns_success(self):
        response = self.client.get(self.csrf_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"detail": "CSRF cookie set."})
        self.assertIn("csrftoken", self.client.cookies)

    def test_registration_requires_csrf_token(self):
        response = self.client.post(
            self.registration_url,
            self.registration_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(User.objects.filter(username="amina-farmer").exists())

    def test_registration_creates_user_and_profile_without_logging_in(self):
        headers = self.csrf_headers()

        response = self.client.post(
            self.registration_url,
            self.registration_payload(),
            format="json",
            **headers,
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="amina-farmer")
        self.assertTrue(user.check_password(self.valid_password))
        self.assertEqual(user.first_name, "Amina")
        self.assertEqual(user.last_name, "Wanjiku Njoroge")
        self.assertEqual(user.email, "amina@example.com")
        self.assertEqual(user.farmer_profile.phone_number, "+254723456789")
        self.assertEqual(response.data["farmer_profile"]["phone_number"], "+254723456789")
        self.assertNotIn("password", response.data)
        self.assertNotIn("confirm_password", response.data)
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_registration_rejects_duplicate_username_case_insensitively(self):
        response = self.client.post(
            self.registration_url,
            self.registration_payload(username="EXISTING-FARMER"),
            format="json",
            **self.csrf_headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)
        self.assertEqual(
            response.data["username"][0],
            DUPLICATE_ACCOUNT_IDENTIFIER_MESSAGE,
        )
        self.assertEqual(User.objects.filter(username__iexact="existing-farmer").count(), 1)

    def test_registration_rejects_duplicate_email_case_insensitively(self):
        response = self.client.post(
            self.registration_url,
            self.registration_payload(email="EXISTING@example.com"),
            format="json",
            **self.csrf_headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)
        self.assertEqual(
            response.data["email"][0],
            DUPLICATE_ACCOUNT_IDENTIFIER_MESSAGE,
        )
        self.assertEqual(User.objects.filter(email__iexact="existing@example.com").count(), 1)

    def test_registration_rejects_invalid_email(self):
        response = self.client.post(
            self.registration_url,
            self.registration_payload(email="not-an-email"),
            format="json",
            **self.csrf_headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_registration_rejects_weak_password(self):
        response = self.client.post(
            self.registration_url,
            self.registration_payload(
                password="password",
                confirm_password="password",
            ),
            format="json",
            **self.csrf_headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)
        self.assertFalse(User.objects.filter(username="amina-farmer").exists())

    def test_registration_rejects_password_mismatch(self):
        response = self.client.post(
            self.registration_url,
            self.registration_payload(confirm_password="Different!Password83"),
            format="json",
            **self.csrf_headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("confirm_password", response.data)

    def test_registration_rejects_missing_required_fields(self):
        payload = self.registration_payload()
        for field in (
            "full_name",
            "username",
            "email",
            "phone_number",
            "password",
            "confirm_password",
        ):
            with self.subTest(field=field):
                invalid_payload = {key: value for key, value in payload.items() if key != field}
                response = self.client.post(
                    self.registration_url,
                    invalid_payload,
                    format="json",
                    **self.csrf_headers(),
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )
                self.assertIn(field, response.data)

    def test_registration_creates_user_and_profile_atomically(self):
        invalid_payload = self.registration_payload(phone_number="not a phone")
        response = self.client.post(
            self.registration_url,
            invalid_payload,
            format="json",
            **self.csrf_headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username="amina-farmer").exists())
        self.assertFalse(FarmerProfile.objects.filter(user__username="amina-farmer").exists())

    def test_simulated_concurrent_registration_conflict_is_controlled(self):
        payload = self.registration_payload()
        with patch.object(
            User.objects,
            "create_user",
            side_effect=IntegrityError("duplicate unique identifier"),
        ):
            response = self.client.post(
                self.registration_url,
                payload,
                format="json",
                **self.csrf_headers(),
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)
        self.assertEqual(
            response.data["username"][0],
            DUPLICATE_ACCOUNT_IDENTIFIER_MESSAGE,
        )

    def test_login_requires_csrf_token(self):
        response = self.client.post(
            self.login_url,
            {
                "username_or_email": self.existing_user.username,
                "password": self.valid_password,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_login_with_username_establishes_persistent_session(self):
        response = self.client.post(
            self.login_url,
            {
                "username_or_email": self.existing_user.username,
                "password": self.valid_password,
            },
            format="json",
            **self.csrf_headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_authenticated"])
        self.assertEqual(response.data["user"]["username"], "existing-farmer")
        self.assertEqual(
            self.client.get(self.session_url).data["user"]["id"],
            self.existing_user.pk,
        )

    @override_settings(
        LOGIN_THROTTLE_LIMIT=2,
        LOGIN_THROTTLE_DURATION=60,
    )
    def test_login_rate_limit_rejects_repeated_attempts(self):
        with patch.object(
            LoginRateThrottle,
            "get_ident",
            return_value="127.0.0.1",
        ):
            for attempt in range(2):
                response = self.client.post(
                    self.login_url,
                    {
                        "username_or_email": self.existing_user.username,
                        "password": "incorrect-password",
                    },
                    format="json",
                    **self.csrf_headers(),
                )
                self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

            response = self.client.post(
                self.login_url,
                {
                    "username_or_email": self.existing_user.username,
                    "password": "incorrect-password",
                },
                format="json",
                **self.csrf_headers(),
            )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("detail", response.data)
        self.assertIn("Retry-After", response)
        detail = str(response.data["detail"]).lower()
        self.assertNotIn("username", detail)
        self.assertNotIn("email", detail)

    @override_settings(
        LOGIN_THROTTLE_LIMIT=1,
        LOGIN_THROTTLE_DURATION=10,
    )
    def test_login_allowed_again_after_natural_throttle_expiry(self):
        with patch.object(
            LoginRateThrottle,
            "get_ident",
            return_value="127.0.0.1",
        ):
            first_response = self.client.post(
                self.login_url,
                {
                    "username_or_email": self.existing_user.username,
                    "password": "incorrect-password",
                },
                format="json",
                **self.csrf_headers(),
            )
            self.assertEqual(first_response.status_code, status.HTTP_401_UNAUTHORIZED)

            throttled_response = self.client.post(
                self.login_url,
                {
                    "username_or_email": self.existing_user.username,
                    "password": "incorrect-password",
                },
                format="json",
                **self.csrf_headers(),
            )

        self.assertEqual(
            throttled_response.status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
        )
        self.assertIn("Retry-After", throttled_response)

        time.sleep(10.1)
        success_response = self.client.post(
            self.login_url,
            {
                "username_or_email": self.existing_user.username,
                "password": self.valid_password,
            },
            format="json",
            **self.csrf_headers(),
        )
        self.assertEqual(success_response.status_code, status.HTTP_200_OK)

    def test_invalid_login_throttle_rate_is_rejected_by_settings_parser(self):
        for value in ("invalid", "0/min", "-1/min", "10/hourly", "ten/min"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    parse_login_throttle_rate(value)

    def test_login_throttle_ignores_forwarded_header_by_default(self):
        factory = APIRequestFactory()
        request = factory.post(
            self.login_url,
            {},
            format="json",
            HTTP_X_FORWARDED_FOR="203.0.113.10",
            REMOTE_ADDR="127.0.0.1",
        )
        throttle = LoginRateThrottle()
        self.assertEqual(throttle.get_ident(request), "127.0.0.1")

    @override_settings(
        LOGIN_THROTTLE_LIMIT=1,
        LOGIN_THROTTLE_DURATION=60,
    )
    def test_login_allowed_again_after_throttle_history_is_cleared(self):
        first_response = self.client.post(
            self.login_url,
            {
                "username_or_email": self.existing_user.username,
                "password": "incorrect-password",
            },
            format="json",
            **self.csrf_headers(),
        )
        self.assertEqual(first_response.status_code, status.HTTP_401_UNAUTHORIZED)

        throttled_response = self.client.post(
            self.login_url,
            {
                "username_or_email": self.existing_user.username,
                "password": "incorrect-password",
            },
            format="json",
            **self.csrf_headers(),
        )
        self.assertEqual(
            throttled_response.status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

        cache.clear()
        success_response = self.client.post(
            self.login_url,
            {
                "username_or_email": self.existing_user.username,
                "password": self.valid_password,
            },
            format="json",
            **self.csrf_headers(),
        )
        self.assertEqual(success_response.status_code, status.HTTP_200_OK)

    def test_login_with_email_is_case_insensitive(self):
        response = self.client.post(
            self.login_url,
            {
                "username_or_email": "EXISTING@EXAMPLE.COM",
                "password": self.valid_password,
            },
            format="json",
            **self.csrf_headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["username"], "existing-farmer")

    def test_login_invalid_credentials_use_generic_error(self):
        for password in (self.valid_password, "incorrect-password"):
            with self.subTest(password=password):
                response = self.client.post(
                    self.login_url,
                    {
                        "username_or_email": (
                            "nonexistent@example.com"
                            if password == self.valid_password
                            else self.existing_user.username
                        ),
                        "password": password,
                    },
                    format="json",
                    **self.csrf_headers(),
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_401_UNAUTHORIZED,
                )
                self.assertEqual(
                    response.data["detail"],
                    "Invalid username/email or password.",
                )

    def test_logout_requires_authentication_and_csrf_then_clears_session(self):
        anonymous_response = self.client.post(
            self.logout_url,
            {},
            format="json",
            **self.csrf_headers(),
        )
        self.assertEqual(
            anonymous_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        login_response = self.client.post(
            self.login_url,
            {
                "username_or_email": self.existing_user.username,
                "password": self.valid_password,
            },
            format="json",
            **self.csrf_headers(),
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        logout_response = self.client.post(
            self.logout_url,
            {},
            format="json",
            **self.csrf_headers(),
        )

        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)
        self.assertFalse(self.client.get(self.session_url).data["is_authenticated"])

    def test_session_endpoint_returns_only_authentication_state_for_anonymous_user(self):
        response = self.client.get(self.session_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"is_authenticated": False})

    def test_invalid_session_cookie_cannot_access_protected_profile(self):
        self.client.force_login(self.existing_user)
        self.client.cookies["sessionid"] = "expired-or-invalid-session"

        response = self.client.get(reverse("farmers:profile"))

        self.assertIn(
            response.status_code,
            (
                status.HTTP_401_UNAUTHORIZED,
                status.HTTP_403_FORBIDDEN,
            ),
        )

    def test_session_endpoint_returns_user_and_farmer_profile_when_authenticated(self):
        self.client.force_login(self.existing_user)

        response = self.client.get(self.session_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_authenticated"])
        self.assertEqual(
            response.data["user"],
            {
                "id": self.existing_user.pk,
                "username": "existing-farmer",
                "email": "existing@example.com",
                "first_name": "Existing",
                "last_name": "Farmer",
            },
        )
        self.assertEqual(
            response.data["farmer_profile"],
            {
                "phone_number": "+254712345678",
                "preferred_language": "",
            },
        )

    def test_authenticated_user_without_farmer_profile_gets_null_profile(self):
        user_without_profile = User.objects.create_user(
            username="no-farmer-profile",
            password=self.valid_password,
        )
        self.client.force_login(user_without_profile)

        response = self.client.get(self.session_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_authenticated"])
        self.assertIsNone(response.data["farmer_profile"])

    def test_missing_django_debug_defaults_to_false(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertFalse(env_bool("DJANGO_DEBUG", default=False))

    def test_django_debug_true_enables_development_mode(self):
        with patch.dict(os.environ, {"DJANGO_DEBUG": "true"}):
            self.assertTrue(env_bool("DJANGO_DEBUG", default=False))

    def test_django_debug_false_disables_debug_mode(self):
        with patch.dict(os.environ, {"DJANGO_DEBUG": "false"}):
            self.assertFalse(env_bool("DJANGO_DEBUG", default=False))

    def test_development_cookie_settings_preserve_http_local_frontend(self):
        if settings.DEBUG:
            self.assertFalse(settings.SESSION_COOKIE_SECURE)
            self.assertFalse(settings.CSRF_COOKIE_SECURE)
        self.assertTrue(settings.SESSION_COOKIE_HTTPONLY)
        self.assertFalse(settings.CSRF_COOKIE_HTTPONLY)
        self.assertEqual(settings.SESSION_COOKIE_SAMESITE, "Lax")
        self.assertEqual(settings.CSRF_COOKIE_SAMESITE, "Lax")

    @override_settings(
        DEBUG=False,
        SESSION_COOKIE_SECURE=True,
        CSRF_COOKIE_SECURE=True,
        SESSION_COOKIE_HTTPONLY=True,
        CSRF_COOKIE_HTTPONLY=False,
        SESSION_COOKIE_SAMESITE="Lax",
        CSRF_COOKIE_SAMESITE="Lax",
    )
    def test_production_cookie_security_flags(self):
        self.assertTrue(settings.SESSION_COOKIE_SECURE)
        self.assertTrue(settings.CSRF_COOKIE_SECURE)
        self.assertTrue(settings.SESSION_COOKIE_HTTPONLY)
        self.assertFalse(settings.CSRF_COOKIE_HTTPONLY)
        self.assertEqual(settings.SESSION_COOKIE_SAMESITE, "Lax")
        self.assertEqual(settings.CSRF_COOKIE_SAMESITE, "Lax")

    def test_session_and_csrf_cookies_match_frontend_requirements(self):
        csrf_response = self.client.get(self.csrf_url)
        self.assertEqual(csrf_response.status_code, status.HTTP_200_OK)
        self.assertIn("csrftoken", self.client.cookies)
        csrf_cookie = self.client.cookies["csrftoken"]
        self.assertFalse(csrf_cookie["httponly"])

        login_response = self.client.post(
            self.login_url,
            {
                "username_or_email": self.existing_user.username,
                "password": self.valid_password,
            },
            format="json",
            **self.csrf_headers(),
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertIn("sessionid", self.client.cookies)
        session_cookie = self.client.cookies["sessionid"]
        self.assertTrue(session_cookie["httponly"])
