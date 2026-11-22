from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import Crop, CropRequirement, CropVariety


User = get_user_model()


class CropCatalogueAPITests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.farmer = User.objects.create_user(
            username="catalogue-farmer",
            password="test-password",
        )
        self.staff = User.objects.create_user(
            username="catalogue-staff",
            password="test-password",
            is_staff=True,
        )

        self.active_crop = Crop.objects.create(
            common_name="Maize",
            is_active=True,
        )
        self.inactive_crop = Crop.objects.create(
            common_name="Inactive crop",
            is_active=False,
        )
        self.active_variety = CropVariety.objects.create(
            crop=self.active_crop,
            name="Open Pollinated",
            is_active=True,
        )
        self.inactive_variety = CropVariety.objects.create(
            crop=self.active_crop,
            name="Retired Variety",
            is_active=False,
        )
        self.inactive_crop_variety = CropVariety.objects.create(
            crop=self.inactive_crop,
            name="Hidden Variety",
            is_active=True,
        )
        self.crop_requirement = CropRequirement.objects.create(
            crop=self.active_crop,
            source_reference="Agricultural extension reference",
            soil_ph_minimum="5.00",
            soil_ph_maximum="7.00",
        )
        self.variety_requirement = CropRequirement.objects.create(
            variety=self.active_variety,
            source_reference="Variety information sheet",
            rainfall_minimum_mm="400.00",
            rainfall_period_days=90,
        )
        self.inactive_crop_requirement = CropRequirement.objects.create(
            crop=self.inactive_crop,
            source_reference="Historical crop reference",
        )
        self.inactive_variety_requirement = CropRequirement.objects.create(
            variety=self.inactive_variety,
            source_reference="Retired variety reference",
        )
        self.inactive_parent_variety_requirement = CropRequirement.objects.create(
            variety=self.inactive_crop_variety,
            source_reference="Inactive crop variety reference",
        )

        self.crop_list_url = reverse("crops:crop-list")
        self.crop_detail_url = reverse(
            "crops:crop-detail",
            kwargs={"pk": self.active_crop.pk},
        )
        self.variety_list_url = reverse("crops:variety-list")
        self.variety_detail_url = reverse(
            "crops:variety-detail",
            kwargs={"pk": self.active_variety.pk},
        )
        self.crop_varieties_url = reverse(
            "crops:crop-variety-list",
            kwargs={"crop_pk": self.active_crop.pk},
        )
        self.requirement_list_url = reverse("crops:requirement-list")

    def authenticate_as(self, user=None):
        self.client.force_authenticate(user=user or self.farmer)

    def test_anonymous_access_is_denied(self):
        endpoints = (
            self.crop_list_url,
            self.crop_detail_url,
            self.crop_varieties_url,
            self.variety_list_url,
            self.variety_detail_url,
            f"{self.requirement_list_url}?crop_id={self.active_crop.pk}",
            reverse(
                "crops:requirement-detail",
                kwargs={"pk": self.crop_requirement.pk},
            ),
        )

        for endpoint in endpoints:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoint)
                self.assertIn(
                    response.status_code,
                    (
                        status.HTTP_401_UNAUTHORIZED,
                        status.HTTP_403_FORBIDDEN,
                    ),
                )

    def test_farmer_can_list_and_retrieve_active_crops(self):
        self.authenticate_as()

        response = self.client.get(self.crop_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {item["id"] for item in response.data},
            {self.active_crop.pk},
        )

        response = self.client.get(self.crop_detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["common_name"], "Maize")

        inactive_url = reverse(
            "crops:crop-detail",
            kwargs={"pk": self.inactive_crop.pk},
        )
        response = self.client.get(inactive_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_farmers_only_see_active_varieties_of_active_crops(self):
        self.authenticate_as()

        response = self.client.get(self.variety_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {item["id"] for item in response.data},
            {self.active_variety.pk},
        )

        response = self.client.get(self.crop_varieties_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {item["id"] for item in response.data},
            {self.active_variety.pk},
        )

        inactive_crop_varieties_url = reverse(
            "crops:crop-variety-list",
            kwargs={"crop_pk": self.inactive_crop.pk},
        )
        response = self.client.get(inactive_crop_varieties_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_farmers_cannot_create_update_or_delete_catalogue_records(self):
        self.authenticate_as()
        crop_detail_url = reverse(
            "crops:crop-detail",
            kwargs={"pk": self.active_crop.pk},
        )
        variety_detail_url = reverse(
            "crops:variety-detail",
            kwargs={"pk": self.active_variety.pk},
        )
        requirement_detail_url = reverse(
            "crops:requirement-detail",
            kwargs={"pk": self.crop_requirement.pk},
        )
        requirement_payload = {
            "crop": self.active_crop.pk,
            "source_reference": "Farmer submitted reference",
        }

        responses = (
            self.client.post(
                self.crop_list_url,
                {"common_name": "Unauthorized crop"},
                format="json",
            ),
            self.client.patch(
                crop_detail_url,
                {"description": "Unauthorized"},
                format="json",
            ),
            self.client.delete(crop_detail_url),
            self.client.post(
                self.variety_list_url,
                {"crop": self.active_crop.pk, "name": "Unauthorized variety"},
                format="json",
            ),
            self.client.patch(
                variety_detail_url,
                {"name": "Unauthorized"},
                format="json",
            ),
            self.client.delete(variety_detail_url),
            self.client.post(
                self.requirement_list_url,
                requirement_payload,
                format="json",
            ),
            self.client.patch(
                requirement_detail_url,
                {"source_reference": "Unauthorized"},
                format="json",
            ),
            self.client.delete(requirement_detail_url),
        )

        for response in responses:
            with self.subTest(status=response.status_code):
                self.assertEqual(
                    response.status_code,
                    status.HTTP_403_FORBIDDEN,
                )

    def test_staff_can_create_update_and_delete_catalogue_records(self):
        self.authenticate_as(self.staff)

        response = self.client.post(
            self.crop_list_url,
            {"common_name": "New Crop"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_crop_id = response.data["id"]
        created_crop_url = reverse(
            "crops:crop-detail",
            kwargs={"pk": created_crop_id},
        )
        response = self.client.patch(
            created_crop_url,
            {"description": "Updated by staff"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["description"], "Updated by staff")
        self.assertEqual(
            self.client.delete(created_crop_url).status_code,
            status.HTTP_204_NO_CONTENT,
        )

        response = self.client.post(
            self.variety_list_url,
            {
                "crop": self.active_crop.pk,
                "name": "New Variety",
                "maturity_days": 120,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_variety_id = response.data["id"]
        created_variety_url = reverse(
            "crops:variety-detail",
            kwargs={"pk": created_variety_id},
        )
        response = self.client.patch(
            created_variety_url,
            {"name": "Updated Variety"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Updated Variety")
        self.assertEqual(
            self.client.delete(created_variety_url).status_code,
            status.HTTP_204_NO_CONTENT,
        )

        response = self.client.post(
            self.requirement_list_url,
            {
                "crop": self.active_crop.pk,
                "source_reference": "Staff source",
                "soil_ph_minimum": "4.50",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_requirement_id = response.data["id"]
        created_requirement_url = reverse(
            "crops:requirement-detail",
            kwargs={"pk": created_requirement_id},
        )
        response = self.client.patch(
            created_requirement_url,
            {"soil_ph_maximum": "7.50"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["soil_ph_maximum"], "7.50")
        self.assertEqual(
            self.client.delete(created_requirement_url).status_code,
            status.HTTP_204_NO_CONTENT,
        )

    def test_staff_can_view_inactive_crops_and_varieties(self):
        self.authenticate_as(self.staff)

        crop_response = self.client.get(self.crop_list_url)
        self.assertEqual(crop_response.status_code, status.HTTP_200_OK)
        self.assertIn(
            self.inactive_crop.pk,
            {item["id"] for item in crop_response.data},
        )

        variety_response = self.client.get(self.variety_list_url)
        self.assertEqual(variety_response.status_code, status.HTTP_200_OK)
        self.assertIn(
            self.inactive_variety.pk,
            {item["id"] for item in variety_response.data},
        )

    def test_requirement_list_requires_exactly_one_valid_filter(self):
        self.authenticate_as()

        for query in (
            "",
            f"?crop_id={self.active_crop.pk}&variety_id={self.active_variety.pk}",
            "?crop_id=not-an-id",
            "?variety_id=0",
        ):
            with self.subTest(query=query):
                response = self.client.get(f"{self.requirement_list_url}{query}")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_requirements_can_be_filtered_by_crop_and_variety(self):
        self.authenticate_as()

        response = self.client.get(
            self.requirement_list_url,
            {"crop_id": self.active_crop.pk},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {item["id"] for item in response.data},
            {self.crop_requirement.pk},
        )

        response = self.client.get(
            self.requirement_list_url,
            {"variety_id": self.active_variety.pk},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {item["id"] for item in response.data},
            {self.variety_requirement.pk},
        )

    def test_farmers_cannot_access_requirements_for_inactive_targets(self):
        self.authenticate_as()

        for filter_name, target_id in (
            ("crop_id", self.inactive_crop.pk),
            ("variety_id", self.inactive_variety.pk),
            ("variety_id", self.inactive_crop_variety.pk),
        ):
            with self.subTest(filter_name=filter_name, target_id=target_id):
                response = self.client.get(
                    self.requirement_list_url,
                    {filter_name: target_id},
                )
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data, [])

        for requirement in (
            self.inactive_crop_requirement,
            self.inactive_variety_requirement,
            self.inactive_parent_variety_requirement,
        ):
            detail_url = reverse(
                "crops:requirement-detail",
                kwargs={"pk": requirement.pk},
            )
            response = self.client.get(detail_url)
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_staff_can_filter_and_view_inactive_requirements(self):
        self.authenticate_as(self.staff)

        response = self.client.get(
            self.requirement_list_url,
            {"crop_id": self.inactive_crop.pk},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {item["id"] for item in response.data},
            {self.inactive_crop_requirement.pk},
        )

        response = self.client.get(
            reverse(
                "crops:requirement-detail",
                kwargs={"pk": self.inactive_variety_requirement.pk},
            )
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_staff_requirement_must_target_exactly_one_crop_or_variety(self):
        self.authenticate_as(self.staff)

        payloads = (
            {"source_reference": "No target"},
            {
                "crop": self.active_crop.pk,
                "variety": self.active_variety.pk,
                "source_reference": "Two targets",
            },
        )
        for payload in payloads:
            with self.subTest(payload=payload):
                response = self.client.post(
                    self.requirement_list_url,
                    payload,
                    format="json",
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )

    def test_staff_requirement_validates_minimum_maximum_ranges(self):
        self.authenticate_as(self.staff)

        invalid_payloads = (
            {
                "crop": self.active_crop.pk,
                "soil_ph_minimum": "8.00",
                "soil_ph_maximum": "5.00",
                "source_reference": "pH source",
            },
            {
                "crop": self.active_crop.pk,
                "temperature_minimum_celsius": "30.00",
                "temperature_maximum_celsius": "20.00",
                "source_reference": "Temperature source",
            },
            {
                "crop": self.active_crop.pk,
                "rainfall_minimum_mm": "600.00",
                "rainfall_maximum_mm": "400.00",
                "rainfall_period_days": 90,
                "source_reference": "Rainfall source",
            },
            {
                "crop": self.active_crop.pk,
                "rainfall_minimum_mm": "400.00",
                "source_reference": "Missing rainfall period",
            },
            {
                "crop": self.active_crop.pk,
                "soil_ph_minimum": "15.00",
                "source_reference": "Invalid pH source",
            },
        )

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post(
                    self.requirement_list_url,
                    payload,
                    format="json",
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )

    def test_staff_rejects_nonexistent_variety_crop_relationship(self):
        self.authenticate_as(self.staff)

        response = self.client.post(
            self.variety_list_url,
            {
                "crop": 999999,
                "name": "Orphan Variety",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("crop", response.data)

    def test_protected_crop_and_variety_deletion_returns_conflict(self):
        self.authenticate_as(self.staff)

        crop_url = reverse(
            "crops:crop-detail",
            kwargs={"pk": self.active_crop.pk},
        )
        variety_url = reverse(
            "crops:variety-detail",
            kwargs={"pk": self.active_variety.pk},
        )

        crop_response = self.client.delete(crop_url)
        variety_response = self.client.delete(variety_url)

        self.assertEqual(crop_response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(variety_response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(Crop.objects.filter(pk=self.active_crop.pk).exists())
        self.assertTrue(
            CropVariety.objects.filter(pk=self.active_variety.pk).exists()
        )
