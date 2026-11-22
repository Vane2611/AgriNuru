from datetime import date

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from crops.models import Crop
from farmers.models import FarmerProfile
from production.models import GrowingSeason

from .models import Farm, Field


User = get_user_model()


class FarmsAPITests(APITestCase):
    def setUp(self):
        self.client = APIClient()

        self.user = User.objects.create_user(
            username="farmer-one",
            password="test-password-one",
        )
        self.profile = FarmerProfile.objects.create(user=self.user)
        self.farm = Farm.objects.create(
            farmer=self.profile,
            name="North Farm",
            county="Kisumu",
        )
        self.field = Field.objects.create(
            farm=self.farm,
            name="Plot One",
            area_hectares="1.2500",
        )

        self.other_user = User.objects.create_user(
            username="farmer-two",
            password="test-password-two",
        )
        self.other_profile = FarmerProfile.objects.create(user=self.other_user)
        self.other_farm = Farm.objects.create(
            farmer=self.other_profile,
            name="South Farm",
            county="Nakuru",
        )
        self.other_field = Field.objects.create(
            farm=self.other_farm,
            name="Plot One",
            area_hectares="2.0000",
        )

        self.farm_list_url = reverse("farms:farm-list")
        self.farm_detail_url = reverse(
            "farms:farm-detail",
            kwargs={"farm_pk": self.farm.pk},
        )
        self.field_list_url = reverse(
            "farms:field-list",
            kwargs={"farm_pk": self.farm.pk},
        )
        self.field_detail_url = reverse(
            "farms:field-detail",
            kwargs={"farm_pk": self.farm.pk, "field_pk": self.field.pk},
        )

    def authenticate_as(self, user=None):
        self.client.force_authenticate(user=user or self.user)

    def test_anonymous_users_cannot_access_farm_or_field_endpoints(self):
        requests = (
            self.client.get(self.farm_list_url),
            self.client.post(self.farm_list_url, {}, format="json"),
            self.client.get(self.farm_detail_url),
            self.client.put(self.farm_detail_url, {}, format="json"),
            self.client.patch(self.farm_detail_url, {}, format="json"),
            self.client.delete(self.farm_detail_url),
            self.client.get(self.field_list_url),
            self.client.post(self.field_list_url, {}, format="json"),
            self.client.get(self.field_detail_url),
            self.client.put(self.field_detail_url, {}, format="json"),
            self.client.patch(self.field_detail_url, {}, format="json"),
            self.client.delete(self.field_detail_url),
        )

        for response in requests:
            with self.subTest(method=response.wsgi_request.method):
                self.assertIn(
                    response.status_code,
                    (
                        status.HTTP_401_UNAUTHORIZED,
                        status.HTTP_403_FORBIDDEN,
                    ),
                )

    def test_farm_create_derives_owner_and_list_only_returns_own_farms(self):
        self.authenticate_as()
        response = self.client.post(
            self.farm_list_url,
            {
                "name": "New Farm",
                "county": "Kiambu",
                "farmer": self.other_profile.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_farm = Farm.objects.get(pk=response.data["id"])
        self.assertEqual(created_farm.farmer, self.profile)
        self.assertEqual(response.data["farmer"], self.profile.pk)

        response = self.client.get(self.farm_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {item["id"] for item in response.data},
            {self.farm.pk, created_farm.pk},
        )

    def test_farm_detail_retrieve_update_and_delete(self):
        self.authenticate_as()

        response = self.client.get(self.farm_detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.farm.pk)

        response = self.client.put(
            self.farm_detail_url,
            {"name": "Updated Farm", "county": "Kisumu"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.farm.refresh_from_db()
        self.assertEqual(self.farm.name, "Updated Farm")
        self.assertEqual(self.farm.farmer, self.profile)

        response = self.client.patch(
            self.farm_detail_url,
            {"description": "Updated description"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.farm.refresh_from_db()
        self.assertEqual(self.farm.description, "Updated description")

        response = self.client.delete(self.farm_detail_url)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(Farm.objects.filter(pk=self.farm.pk).exists())

    def test_farm_owner_isolation_for_retrieve_update_and_delete(self):
        self.authenticate_as()
        other_farm_url = reverse(
            "farms:farm-detail",
            kwargs={"farm_pk": self.other_farm.pk},
        )

        response = self.client.get(other_farm_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        response = self.client.patch(
            other_farm_url,
            {"name": "Hijacked Farm"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        response = self.client.delete(other_farm_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.other_farm.refresh_from_db()
        self.assertEqual(self.other_farm.name, "South Farm")

    def test_duplicate_farm_name_is_rejected_for_same_farmer(self):
        self.authenticate_as()

        response = self.client.post(
            self.farm_list_url,
            {"name": self.farm.name},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data)

    def test_other_farmer_can_use_same_farm_name(self):
        self.authenticate_as()

        response = self.client.post(
            self.farm_list_url,
            {"name": self.other_farm.name},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_nested_field_create_and_list_are_scoped_to_owned_farm(self):
        self.authenticate_as()

        response = self.client.post(
            self.field_list_url,
            {
                "name": "Plot Two",
                "area_hectares": "0.7500",
                "farm": self.other_farm.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_field = Field.objects.get(pk=response.data["id"])
        self.assertEqual(created_field.farm, self.farm)
        self.assertEqual(response.data["farm"], self.farm.pk)

        response = self.client.get(self.field_list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {item["id"] for item in response.data},
            {self.field.pk, created_field.pk},
        )

    def test_nested_field_endpoints_reject_unowned_farms(self):
        self.authenticate_as()
        other_farm_fields_url = reverse(
            "farms:field-list",
            kwargs={"farm_pk": self.other_farm.pk},
        )
        other_field_detail_url = reverse(
            "farms:field-detail",
            kwargs={
                "farm_pk": self.other_farm.pk,
                "field_pk": self.other_field.pk,
            },
        )

        self.assertEqual(
            self.client.get(other_farm_fields_url).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.post(
                other_farm_fields_url,
                {"name": "Unauthorized", "area_hectares": "1.0000"},
                format="json",
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )

        response = self.client.get(other_field_detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        response = self.client.patch(
            other_field_detail_url,
            {"name": "Hijacked"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        response = self.client.delete(other_field_detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        mismatched_parent_url = reverse(
            "farms:field-detail",
            kwargs={
                "farm_pk": self.farm.pk,
                "field_pk": self.other_field.pk,
            },
        )
        response = self.client.get(mismatched_parent_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.other_field.refresh_from_db()
        self.assertEqual(self.other_field.name, "Plot One")

    def test_field_detail_retrieve_update_and_delete(self):
        self.authenticate_as()

        response = self.client.get(self.field_detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.put(
            self.field_detail_url,
            {
                "name": "Updated Plot",
                "area_hectares": "1.5000",
                "latitude": "-1.234567",
                "longitude": "36.123456",
                "farm": self.other_farm.pk,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.field.refresh_from_db()
        self.assertEqual(self.field.name, "Updated Plot")
        self.assertEqual(self.field.farm, self.farm)

        response = self.client.patch(
            self.field_detail_url,
            {"irrigation_available": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.field.refresh_from_db()
        self.assertTrue(self.field.irrigation_available)

        response = self.client.delete(self.field_detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Field.objects.filter(pk=self.field.pk).exists())

    def test_field_area_and_coordinate_validation(self):
        self.authenticate_as()

        invalid_payloads = (
            {"name": "Zero", "area_hectares": "0"},
            {"name": "Negative", "area_hectares": "-1"},
            {
                "name": "Bad Latitude",
                "area_hectares": "1",
                "latitude": "91",
                "longitude": "30",
            },
            {
                "name": "Bad Longitude",
                "area_hectares": "1",
                "latitude": "1",
                "longitude": "181",
            },
            {
                "name": "Unpaired Coordinates",
                "area_hectares": "1",
                "latitude": "1",
            },
        )

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post(
                    self.field_list_url,
                    payload,
                    format="json",
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )

    def test_duplicate_field_name_is_rejected_within_farm(self):
        self.authenticate_as()

        response = self.client.post(
            self.field_list_url,
            {
                "name": self.field.name,
                "area_hectares": "1.0000",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data)

    def test_field_name_can_repeat_in_another_farm(self):
        self.authenticate_as()
        other_owned_farm = Farm.objects.create(
            farmer=self.profile,
            name="Second Farm",
        )
        other_owned_farm_fields_url = reverse(
            "farms:field-list",
            kwargs={"farm_pk": other_owned_farm.pk},
        )

        response = self.client.post(
            other_owned_farm_fields_url,
            {"name": self.field.name, "area_hectares": "0.5000"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_protected_field_deletion_returns_conflict(self):
        self.authenticate_as()
        crop = Crop.objects.create(common_name="Maize")
        GrowingSeason.objects.create(
            field=self.field,
            crop=crop,
            planting_date=date(2026, 3, 1),
        )

        response = self.client.delete(self.field_detail_url)

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(Field.objects.filter(pk=self.field.pk).exists())

    def test_authenticated_user_without_profile_cannot_create_farm(self):
        user_without_profile = User.objects.create_user(
            username="farmer-no-profile",
            password="test-password-three",
        )
        self.authenticate_as(user_without_profile)

        list_response = self.client.get(self.farm_list_url)
        create_response = self.client.post(
            self.farm_list_url,
            {"name": "Orphan Farm"},
            format="json",
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data, [])
        self.assertEqual(create_response.status_code, status.HTTP_404_NOT_FOUND)
