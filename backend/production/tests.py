from datetime import date

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from crops.models import Crop, CropVariety
from farmers.models import FarmerProfile
from farms.models import Farm, Field

from .models import (
    GrowingSeason,
    HarvestEstimate,
    HarvestRecord,
    ProductionActivity,
    ProductionCost,
)


User = get_user_model()


class ProductionAPITests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="production-farmer",
            password="test-password",
        )
        self.profile = FarmerProfile.objects.create(user=self.user)
        self.farm = Farm.objects.create(
            farmer=self.profile,
            name="Main Farm",
            county="Kisumu",
        )
        self.field = Field.objects.create(
            farm=self.farm,
            name="Field One",
            area_hectares="2.0000",
        )
        self.crop = Crop.objects.create(common_name="Maize")
        self.variety = CropVariety.objects.create(
            crop=self.crop,
            name="Local variety",
        )
        self.season = GrowingSeason.objects.create(
            field=self.field,
            crop=self.crop,
            variety=self.variety,
            planting_date=date(2025, 1, 10),
            area_planted_hectares="1.5000",
        )

        self.other_user = User.objects.create_user(
            username="other-production-farmer",
            password="test-password",
        )
        self.other_profile = FarmerProfile.objects.create(user=self.other_user)
        self.other_farm = Farm.objects.create(
            farmer=self.other_profile,
            name="Other Farm",
        )
        self.other_field = Field.objects.create(
            farm=self.other_farm,
            name="Other Field",
            area_hectares="1.0000",
        )
        self.other_season = GrowingSeason.objects.create(
            field=self.other_field,
            crop=self.crop,
            planting_date=date(2025, 1, 10),
        )

        self.season_list_url = reverse("production:season-list")
        self.activity_list_url = reverse("production:activity-list")
        self.cost_list_url = reverse("production:cost-list")
        self.estimate_list_url = reverse("production:harvest-estimate-list")
        self.harvest_list_url = reverse("production:harvest-record-list")

    def authenticate_as(self, user=None):
        self.client.force_authenticate(user=user or self.user)

    def season_detail_url(self, season=None):
        return reverse(
            "production:season-detail",
            kwargs={"pk": (season or self.season).pk},
        )

    def activity_detail_url(self, record):
        return reverse("production:activity-detail", kwargs={"pk": record.pk})

    def cost_detail_url(self, record):
        return reverse("production:cost-detail", kwargs={"pk": record.pk})

    def estimate_detail_url(self, record):
        return reverse(
            "production:harvest-estimate-detail",
            kwargs={"pk": record.pk},
        )

    def harvest_detail_url(self, record):
        return reverse("production:harvest-record-detail", kwargs={"pk": record.pk})

    def test_anonymous_access_is_denied_for_collection_and_detail_endpoints(self):
        activity = ProductionActivity.objects.create(
            growing_season=self.season,
            activity_type=ProductionActivity.ActivityType.WEEDING,
            activity_date=date(2025, 2, 1),
        )
        cost = ProductionCost.objects.create(
            growing_season=self.season,
            category=ProductionCost.CostCategory.SEEDS,
            amount="10.00",
            currency="KES",
        )
        estimate = HarvestEstimate.objects.create(
            growing_season=self.season,
            estimated_on=date(2025, 2, 1),
            estimated_quantity="20.000",
            quantity_unit="kg",
        )
        harvest = HarvestRecord.objects.create(
            growing_season=self.season,
            harvested_on=date(2025, 2, 1),
            quantity="15.000",
            quantity_unit="kg",
        )
        endpoints = (
            (self.season_list_url, self.season_detail_url()),
            (self.activity_list_url, self.activity_detail_url(activity)),
            (self.cost_list_url, self.cost_detail_url(cost)),
            (self.estimate_list_url, self.estimate_detail_url(estimate)),
            (self.harvest_list_url, self.harvest_detail_url(harvest)),
        )

        for collection_url, detail_url in endpoints:
            for url in (collection_url, detail_url):
                with self.subTest(url=url):
                    response = self.client.get(url)
                    self.assertIn(
                        response.status_code,
                        (
                            status.HTTP_401_UNAUTHORIZED,
                            status.HTTP_403_FORBIDDEN,
                        ),
                    )

    def test_all_five_models_support_create_retrieve_update_and_delete(self):
        self.authenticate_as()
        created_season_response = self.client.post(
            self.season_list_url,
            {
                "field": self.field.pk,
                "crop": self.crop.pk,
                "planting_date": "2025-03-01",
                "area_planted_hectares": "1.0000",
                "notes": "API-created season",
            },
            format="json",
        )
        self.assertEqual(
            created_season_response.status_code,
            status.HTTP_201_CREATED,
        )
        season_id = created_season_response.data["id"]
        season_url = reverse(
            "production:season-detail",
            kwargs={"pk": season_id},
        )
        self.assertEqual(self.client.get(season_url).status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.client.patch(
                season_url,
                {"notes": "Updated season"},
                format="json",
            ).status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.client.delete(season_url).status_code,
            status.HTTP_204_NO_CONTENT,
        )

        child_cases = (
            (
                self.activity_list_url,
                {
                    "growing_season": self.season.pk,
                    "activity_type": "weeding",
                    "activity_date": "2025-02-01",
                },
                ProductionActivity.objects,
                self.activity_detail_url,
                {"notes": "Updated activity"},
            ),
            (
                self.cost_list_url,
                {
                    "growing_season": self.season.pk,
                    "category": "seeds",
                    "cost_basis": "actual",
                    "amount": "125.50",
                    "currency": "KES",
                    "cost_date": "2025-02-01",
                },
                ProductionCost.objects,
                self.cost_detail_url,
                {"notes": "Updated cost"},
            ),
            (
                self.estimate_list_url,
                {
                    "growing_season": self.season.pk,
                    "estimated_on": "2025-02-01",
                    "estimated_quantity": "80.500",
                    "quantity_unit": "kg",
                    "estimate_source": "farmer",
                    "source_reference": "Farmer estimate",
                },
                HarvestEstimate.objects,
                self.estimate_detail_url,
                {"notes": "Updated estimate"},
            ),
            (
                self.harvest_list_url,
                {
                    "growing_season": self.season.pk,
                    "harvested_on": "2025-03-01",
                    "quantity": "70.500",
                    "quantity_unit": "kg",
                    "quality_grade": "Grade A",
                },
                HarvestRecord.objects,
                self.harvest_detail_url,
                {"notes": "Updated harvest"},
            ),
        )

        for collection_url, payload, manager, detail_url_for, update in child_cases:
            with self.subTest(collection_url=collection_url):
                create_response = self.client.post(
                    collection_url,
                    payload,
                    format="json",
                )
                self.assertEqual(
                    create_response.status_code,
                    status.HTTP_201_CREATED,
                    create_response.data,
                )
                record = manager.get(pk=create_response.data["id"])
                detail_url = detail_url_for(record)
                self.assertEqual(
                    self.client.get(detail_url).status_code,
                    status.HTTP_200_OK,
                )
                update_response = self.client.patch(
                    detail_url,
                    update,
                    format="json",
                )
                self.assertEqual(
                    update_response.status_code,
                    status.HTTP_200_OK,
                    update_response.data,
                )
                self.assertEqual(
                    self.client.delete(detail_url).status_code,
                    status.HTTP_204_NO_CONTENT,
                )

    def test_season_and_child_records_are_scoped_to_the_authenticated_farmer(self):
        self.authenticate_as()
        other_activity = ProductionActivity.objects.create(
            growing_season=self.other_season,
            activity_type=ProductionActivity.ActivityType.WEEDING,
            activity_date=date(2025, 2, 1),
        )

        self.assertEqual(
            {item["id"] for item in self.client.get(self.season_list_url).data},
            {self.season.pk},
        )
        self.assertEqual(
            {item["id"] for item in self.client.get(self.activity_list_url).data},
            set(),
        )
        self.assertEqual(
            self.client.get(
                reverse(
                    "production:season-detail",
                    kwargs={"pk": self.other_season.pk},
                )
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.get(self.activity_detail_url(other_activity)).status_code,
            status.HTTP_404_NOT_FOUND,
        )

        response = self.client.post(
            self.activity_list_url,
            {
                "growing_season": self.other_season.pk,
                "activity_type": "weeding",
                "activity_date": "2025-02-01",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("growing_season", response.data)

        response = self.client.patch(
            self.activity_detail_url(
                ProductionActivity.objects.create(
                    growing_season=self.season,
                    activity_type=ProductionActivity.ActivityType.WEEDING,
                    activity_date=date(2025, 2, 1),
                )
            ),
            {"growing_season": self.other_season.pk},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_season_validates_field_ownership_variety_and_planted_area(self):
        self.authenticate_as()
        payload = {
            "field": self.field.pk,
            "crop": self.crop.pk,
            "planting_date": "2025-02-01",
        }

        other_field_response = self.client.post(
            self.season_list_url,
            {**payload, "field": self.other_field.pk},
            format="json",
        )
        self.assertEqual(
            other_field_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("field", other_field_response.data)

        other_crop = Crop.objects.create(common_name="Beans")
        response = self.client.post(
            self.season_list_url,
            {
                **payload,
                "variety": self.variety.pk,
                "crop": other_crop.pk,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("variety", response.data)

        response = self.client.post(
            self.season_list_url,
            {**payload, "area_planted_hectares": "2.0001"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("area_planted_hectares", response.data)

        response = self.client.post(
            self.season_list_url,
            {
                **payload,
                "expected_harvest_date": "2025-01-31",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expected_harvest_date", response.data)

    def test_activity_and_harvest_date_validation(self):
        self.authenticate_as()
        activity_response = self.client.post(
            self.activity_list_url,
            {
                "growing_season": self.season.pk,
                "activity_type": "irrigation",
                "activity_date": "2025-01-09",
            },
            format="json",
        )
        self.assertEqual(
            activity_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("activity_date", activity_response.data)

        harvest_response = self.client.post(
            self.harvest_list_url,
            {
                "growing_season": self.season.pk,
                "harvested_on": "2025-01-09",
                "quantity": "1.000",
                "quantity_unit": "kg",
            },
            format="json",
        )
        self.assertEqual(harvest_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("harvested_on", harvest_response.data)

    def test_cost_and_harvest_quantities_must_be_positive(self):
        self.authenticate_as()
        cost_response = self.client.post(
            self.cost_list_url,
            {
                "growing_season": self.season.pk,
                "category": "seeds",
                "amount": "0",
                "currency": "KES",
            },
            format="json",
        )
        self.assertEqual(cost_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("amount", cost_response.data)

        estimate_response = self.client.post(
            self.estimate_list_url,
            {
                "growing_season": self.season.pk,
                "estimated_on": "2025-02-01",
                "estimated_quantity": "0",
                "quantity_unit": "kg",
            },
            format="json",
        )
        self.assertEqual(
            estimate_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("estimated_quantity", estimate_response.data)

        harvest_response = self.client.post(
            self.harvest_list_url,
            {
                "growing_season": self.season.pk,
                "harvested_on": "2025-02-01",
                "quantity": "0",
                "quantity_unit": "kg",
            },
            format="json",
        )
        self.assertEqual(harvest_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("quantity", harvest_response.data)

    def test_filters_cover_farm_field_crop_season_and_date_range(self):
        self.authenticate_as()
        activity = ProductionActivity.objects.create(
            growing_season=self.season,
            activity_type=ProductionActivity.ActivityType.WEEDING,
            activity_date=date(2025, 2, 1),
        )
        second_farm = Farm.objects.create(
            farmer=self.profile,
            name="Second Farm",
        )
        second_field = Field.objects.create(
            farm=second_farm,
            name="Second Field",
            area_hectares="1.0000",
        )
        second_crop = Crop.objects.create(common_name="Beans")
        second_season = GrowingSeason.objects.create(
            field=second_field,
            crop=second_crop,
            planting_date=date(2025, 3, 1),
        )
        second_activity = ProductionActivity.objects.create(
            growing_season=second_season,
            activity_type=ProductionActivity.ActivityType.PLANTING,
            activity_date=date(2025, 3, 1),
        )

        filters = (
            ("farm_id", self.farm.pk, activity.pk),
            ("field_id", self.field.pk, activity.pk),
            ("crop_id", self.crop.pk, activity.pk),
            ("growing_season_id", self.season.pk, activity.pk),
            ("start_date", "2025-02-01", activity.pk),
            ("end_date", "2025-02-01", activity.pk),
        )
        for parameter, value, expected_id in filters:
            with self.subTest(parameter=parameter):
                response = self.client.get(
                    self.activity_list_url,
                    {parameter: value},
                )
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                expected_ids = (
                    {activity.pk, second_activity.pk}
                    if parameter == "start_date"
                    else {expected_id}
                )
                self.assertEqual(
                    {item["id"] for item in response.data},
                    expected_ids,
                )

        response = self.client.get(
            self.activity_list_url,
            {
                "farm_id": second_farm.pk,
                "field_id": second_field.pk,
                "crop_id": second_crop.pk,
                "growing_season_id": second_season.pk,
            },
        )
        self.assertEqual(
            {item["id"] for item in response.data},
            {second_activity.pk},
        )

        invalid_filter_response = self.client.get(
            self.activity_list_url,
            {"field_id": "not-an-id"},
        )
        self.assertEqual(
            invalid_filter_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        reversed_date_response = self.client.get(
            self.activity_list_url,
            {"start_date": "2025-03-01", "end_date": "2025-02-01"},
        )
        self.assertEqual(
            reversed_date_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_season_list_supports_farm_field_crop_season_and_date_filters(self):
        self.authenticate_as()
        filters = (
            ("farm_id", self.farm.pk),
            ("field_id", self.field.pk),
            ("crop_id", self.crop.pk),
            ("growing_season_id", self.season.pk),
            ("start_date", "2025-01-10"),
            ("end_date", "2025-01-10"),
        )
        for parameter, value in filters:
            with self.subTest(parameter=parameter):
                response = self.client.get(
                    self.season_list_url,
                    {parameter: value},
                )
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(
                    {item["id"] for item in response.data},
                    {self.season.pk},
                )

    def test_protected_season_deletion_returns_conflict(self):
        self.authenticate_as()
        ProductionActivity.objects.create(
            growing_season=self.season,
            activity_type=ProductionActivity.ActivityType.WEEDING,
            activity_date=date(2025, 2, 1),
        )

        response = self.client.delete(self.season_detail_url())

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(GrowingSeason.objects.filter(pk=self.season.pk).exists())
        self.assertIn("detail", response.data)

    def test_user_without_farmer_profile_cannot_access_or_create_records(self):
        user_without_profile = User.objects.create_user(
            username="no-farmer-profile",
            password="test-password",
        )
        self.authenticate_as(user_without_profile)
        collection_urls = (
            self.season_list_url,
            self.activity_list_url,
            self.cost_list_url,
            self.estimate_list_url,
            self.harvest_list_url,
        )

        for url in collection_urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data, [])

        season_response = self.client.post(
            self.season_list_url,
            {
                "field": self.field.pk,
                "crop": self.crop.pk,
                "planting_date": "2025-04-01",
            },
            format="json",
        )
        child_response = self.client.post(
            self.activity_list_url,
            {
                "growing_season": self.season.pk,
                "activity_type": "weeding",
                "activity_date": "2025-02-01",
            },
            format="json",
        )
        self.assertEqual(season_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(child_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(
            self.client.get(self.season_detail_url()).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_record_identifiers_and_timestamps_are_read_only(self):
        self.authenticate_as()
        activity = ProductionActivity.objects.create(
            growing_season=self.season,
            activity_type=ProductionActivity.ActivityType.WEEDING,
            activity_date=date(2025, 2, 1),
        )
        original_id = activity.pk
        response = self.client.patch(
            self.activity_detail_url(activity),
            {
                "id": original_id + 100,
                "created_at": "2000-01-01T00:00:00Z",
                "updated_at": "2000-01-01T00:00:00Z",
                "notes": "Updated through API",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        activity.refresh_from_db()
        self.assertEqual(activity.pk, original_id)
        self.assertEqual(activity.notes, "Updated through API")
