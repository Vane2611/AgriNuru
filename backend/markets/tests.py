from datetime import date

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from crops.models import Crop

from .models import Market, MarketPrice, MarketPriceObservation


User = get_user_model()


class MarketsAPITests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.farmer = User.objects.create_user(
            username="market-farmer",
            password="test-password",
        )
        self.staff = User.objects.create_user(
            username="market-staff",
            password="test-password",
            is_staff=True,
        )

        self.market = Market.objects.create(
            name="Central Market",
            market_type=Market.MarketType.WHOLESALE,
            county="Kisumu",
            sub_county="Kisumu Central",
            latitude="-0.0917",
            longitude="34.7680",
        )
        self.inactive_market = Market.objects.create(
            name="Inactive Market",
            market_type=Market.MarketType.RETAIL,
            county="Nakuru",
            sub_county="Nakuru Town",
            is_active=False,
        )
        self.crop = Crop.objects.create(common_name="Maize")
        self.other_crop = Crop.objects.create(common_name="Beans")
        self.price_series = MarketPrice.objects.create(
            market=self.market,
            crop=self.crop,
            quantity_unit="kg",
        )
        self.other_price_series = MarketPrice.objects.create(
            market=self.market,
            crop=self.other_crop,
            quantity_unit="crate",
        )
        self.inactive_price_series = MarketPrice.objects.create(
            market=self.inactive_market,
            crop=self.crop,
            quantity_unit="kg",
        )
        self.observation = MarketPriceObservation.objects.create(
            market_price=self.price_series,
            observation_date=date(2025, 1, 10),
            price="42.5000",
            currency="KES",
            source_name="County agriculture report",
            source_reference="Report-2025-01",
            grade="Grade A",
        )
        self.later_observation = MarketPriceObservation.objects.create(
            market_price=self.price_series,
            observation_date=date(2025, 2, 10),
            price="45.0000",
            currency="KES",
            source_name="Market survey",
            source_reference="Survey-2025-02",
            grade="",
        )
        self.inactive_observation = MarketPriceObservation.objects.create(
            market_price=self.inactive_price_series,
            observation_date=date(2025, 1, 10),
            price="50.0000",
            currency="KES",
            source_name="Historical report",
        )

        self.market_list_url = reverse("markets:market-list")
        self.market_detail_url = reverse(
            "markets:market-detail",
            kwargs={"pk": self.market.pk},
        )
        self.price_list_url = reverse("markets:price-list")
        self.price_detail_url = reverse(
            "markets:price-detail",
            kwargs={"pk": self.price_series.pk},
        )
        self.observation_list_url = reverse("markets:observation-list")
        self.observation_detail_url = reverse(
            "markets:observation-detail",
            kwargs={"pk": self.observation.pk},
        )

    def authenticate_as(self, user=None):
        self.client.force_authenticate(user=user or self.farmer)

    def test_anonymous_users_are_denied_for_collection_and_detail_endpoints(self):
        endpoints = (
            self.market_list_url,
            self.market_detail_url,
            self.price_list_url,
            self.price_detail_url,
            self.observation_list_url,
            self.observation_detail_url,
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

        post_responses = (
            self.client.post(self.market_list_url, {}, format="json"),
            self.client.post(self.price_list_url, {}, format="json"),
            self.client.post(self.observation_list_url, {}, format="json"),
        )
        for response in post_responses:
            self.assertIn(
                response.status_code,
                (
                    status.HTTP_401_UNAUTHORIZED,
                    status.HTTP_403_FORBIDDEN,
                ),
            )

    def test_authenticated_users_can_read_shared_market_information(self):
        self.authenticate_as()
        responses = (
            self.client.get(self.market_list_url),
            self.client.get(self.market_detail_url),
            self.client.get(self.price_list_url),
            self.client.get(self.price_detail_url),
            self.client.get(self.observation_list_url),
            self.client.get(self.observation_detail_url),
        )
        for response in responses:
            with self.subTest(status=response.status_code):
                self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_ordinary_users_cannot_write_shared_market_data(self):
        self.authenticate_as()
        responses = (
            self.client.post(
                self.market_list_url,
                {
                    "name": "Unauthorized Market",
                    "market_type": "retail",
                },
                format="json",
            ),
            self.client.patch(
                self.market_detail_url,
                {"name": "Changed"},
                format="json",
            ),
            self.client.delete(self.market_detail_url),
            self.client.post(
                self.price_list_url,
                {
                    "market": self.market.pk,
                    "crop": self.crop.pk,
                    "quantity_unit": "bag",
                },
                format="json",
            ),
            self.client.patch(
                self.price_detail_url,
                {"quantity_unit": "bag"},
                format="json",
            ),
            self.client.delete(self.price_detail_url),
            self.client.post(
                self.observation_list_url,
                {
                    "market_price": self.price_series.pk,
                    "observation_date": "2025-03-01",
                    "price": "49.0000",
                    "currency": "KES",
                    "source_name": "Test source",
                },
                format="json",
            ),
            self.client.patch(
                self.observation_detail_url,
                {"price": "99.0000"},
                format="json",
            ),
            self.client.delete(self.observation_detail_url),
        )
        for response in responses:
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.market.refresh_from_db()
        self.observation.refresh_from_db()
        self.assertEqual(self.market.name, "Central Market")
        self.assertEqual(str(self.observation.price), "42.5000")

    def test_farmers_only_see_active_markets_and_their_price_data(self):
        self.authenticate_as()
        market_response = self.client.get(self.market_list_url)
        self.assertEqual(market_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {item["id"] for item in market_response.data},
            {self.market.pk},
        )

        inactive_market_url = reverse(
            "markets:market-detail",
            kwargs={"pk": self.inactive_market.pk},
        )
        inactive_price_url = reverse(
            "markets:price-detail",
            kwargs={"pk": self.inactive_price_series.pk},
        )
        inactive_observation_url = reverse(
            "markets:observation-detail",
            kwargs={"pk": self.inactive_observation.pk},
        )
        self.assertEqual(
            self.client.get(inactive_market_url).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.get(inactive_price_url).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.get(inactive_observation_url).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            {item["id"] for item in self.client.get(self.price_list_url).data},
            {self.price_series.pk, self.other_price_series.pk},
        )
        self.assertEqual(
            {
                item["id"]
                for item in self.client.get(self.observation_list_url).data
            },
            {self.observation.pk, self.later_observation.pk},
        )

    def test_staff_can_manage_active_and_inactive_records(self):
        self.authenticate_as(self.staff)
        inactive_market_url = reverse(
            "markets:market-detail",
            kwargs={"pk": self.inactive_market.pk},
        )
        inactive_price_url = reverse(
            "markets:price-detail",
            kwargs={"pk": self.inactive_price_series.pk},
        )
        inactive_observation_url = reverse(
            "markets:observation-detail",
            kwargs={"pk": self.inactive_observation.pk},
        )
        for endpoint in (
            inactive_market_url,
            inactive_price_url,
            inactive_observation_url,
        ):
            self.assertEqual(
                self.client.get(endpoint).status_code,
                status.HTTP_200_OK,
            )

    def test_staff_can_create_retrieve_update_and_delete_all_resources(self):
        self.authenticate_as(self.staff)

        market_response = self.client.post(
            self.market_list_url,
            {
                "name": "New Market",
                "market_type": "collection_centre",
                "county": "Kiambu",
                "sub_county": "Limuru",
                "description": "Market data record",
            },
            format="json",
        )
        self.assertEqual(market_response.status_code, status.HTTP_201_CREATED)
        market_id = market_response.data["id"]
        market_url = reverse("markets:market-detail", kwargs={"pk": market_id})
        self.assertEqual(self.client.get(market_url).status_code, status.HTTP_200_OK)
        update_market_response = self.client.patch(
            market_url,
            {"description": "Updated description"},
            format="json",
        )
        self.assertEqual(
            update_market_response.status_code,
            status.HTTP_200_OK,
        )

        price_response = self.client.post(
            self.price_list_url,
            {
                "market": market_id,
                "crop": self.crop.pk,
                "quantity_unit": "bag",
            },
            format="json",
        )
        self.assertEqual(price_response.status_code, status.HTTP_201_CREATED)
        price_id = price_response.data["id"]
        price_url = reverse("markets:price-detail", kwargs={"pk": price_id})
        self.assertEqual(self.client.get(price_url).status_code, status.HTTP_200_OK)
        update_price_response = self.client.patch(
            price_url,
            {"quantity_unit": "crate"},
            format="json",
        )
        self.assertEqual(update_price_response.status_code, status.HTTP_200_OK)

        observation_payload = {
            "market_price": price_id,
            "observation_date": "2025-04-10",
            "price": "33.2500",
            "currency": "KES",
            "source_name": "County report",
            "source_reference": "Report-2025-04",
            "grade": "Grade B",
        }
        observation_response = self.client.post(
            self.observation_list_url,
            observation_payload,
            format="json",
        )
        self.assertEqual(
            observation_response.status_code,
            status.HTTP_201_CREATED,
        )
        observation_id = observation_response.data["id"]
        observation_url = reverse(
            "markets:observation-detail",
            kwargs={"pk": observation_id},
        )
        self.assertEqual(
            self.client.get(observation_url).status_code,
            status.HTTP_200_OK,
        )
        update_observation_response = self.client.patch(
            observation_url,
            {"source_reference": "Updated-Report-Reference"},
            format="json",
        )
        self.assertEqual(
            update_observation_response.status_code,
            status.HTTP_200_OK,
        )
        stored_observation = MarketPriceObservation.objects.get(pk=observation_id)
        self.assertEqual(stored_observation.source_name, "County report")
        self.assertEqual(
            stored_observation.source_reference,
            "Updated-Report-Reference",
        )
        self.assertEqual(stored_observation.grade, "Grade B")
        self.assertEqual(stored_observation.currency, "KES")

        self.assertEqual(
            self.client.delete(observation_url).status_code,
            status.HTTP_204_NO_CONTENT,
        )
        self.assertEqual(
            self.client.delete(price_url).status_code,
            status.HTTP_204_NO_CONTENT,
        )
        self.assertEqual(
            self.client.delete(market_url).status_code,
            status.HTTP_204_NO_CONTENT,
        )

    def test_market_filters_and_invalid_parameters(self):
        self.authenticate_as()
        response = self.client.get(
            self.market_list_url,
            {"county": "kisumu", "sub_county": "KISUMU CENTRAL"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {item["id"] for item in response.data},
            {self.market.pk},
        )

        invalid_market_type_url = self.market_list_url + "?county="
        response = self.client.get(invalid_market_type_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("county", response.data)

    def test_market_price_filters_and_invalid_parameters(self):
        self.authenticate_as()
        response = self.client.get(
            self.price_list_url,
            {
                "market_id": self.market.pk,
                "crop_id": self.crop.pk,
                "quantity_unit": "KG",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {item["id"] for item in response.data},
            {self.price_series.pk},
        )

        response = self.client.get(
            self.price_list_url,
            {"market_id": "not-an-id"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("market_id", response.data)

        response = self.client.get(
            self.price_list_url,
            {"crop_id": "0"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("crop_id", response.data)

        response = self.client.get(
            self.price_list_url,
            {"quantity_unit": ""},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("quantity_unit", response.data)

    def test_observation_filters_and_malformed_filter_parameters(self):
        self.authenticate_as()
        response = self.client.get(
            self.observation_list_url,
            {
                "market_price_id": self.price_series.pk,
                "market_id": self.market.pk,
                "crop_id": self.crop.pk,
                "start_date": "2025-01-01",
                "end_date": "2025-01-31",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {item["id"] for item in response.data},
            {self.observation.pk},
        )

        invalid_params = (
            {"market_price_id": "bad"},
            {"market_id": "bad"},
            {"crop_id": "0"},
            {"start_date": "not-a-date"},
            {"end_date": ""},
            {"start_date": "2025-02-01", "end_date": "2025-01-01"},
        )
        for params in invalid_params:
            with self.subTest(params=params):
                response = self.client.get(self.observation_list_url, params)
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )

    def test_observation_rejects_price_series_that_conflicts_with_market_or_crop(self):
        self.authenticate_as()
        response = self.client.get(
            self.observation_list_url,
            {
                "market_price_id": self.price_series.pk,
                "market_id": self.inactive_market.pk,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("market_price_id", response.data)

        response = self.client.get(
            self.observation_list_url,
            {
                "market_price_id": self.price_series.pk,
                "crop_id": self.other_crop.pk,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("market_price_id", response.data)

    def test_market_coordinates_must_be_paired_and_within_range(self):
        self.authenticate_as(self.staff)
        base_payload = {
            "name": "Coordinate Test Market",
            "market_type": "retail",
        }
        invalid_payloads = (
            {**base_payload, "latitude": "-1.0"},
            {**base_payload, "longitude": "36.0"},
            {
                **base_payload,
                "latitude": "91",
                "longitude": "36",
            },
            {
                **base_payload,
                "latitude": "-1",
                "longitude": "181",
            },
        )
        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post(
                    self.market_list_url,
                    payload,
                    format="json",
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )

        response = self.client.post(
            self.market_list_url,
            {
                **base_payload,
                "latitude": "-1.2864",
                "longitude": "36.8172",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_observation_validates_positive_prices_and_currency_codes(self):
        self.authenticate_as(self.staff)
        base_payload = {
            "market_price": self.price_series.pk,
            "observation_date": "2025-03-10",
            "currency": "KES",
            "source_name": "Valid source",
        }
        for price in ("0", "-1.00"):
            with self.subTest(price=price):
                response = self.client.post(
                    self.observation_list_url,
                    {**base_payload, "price": price},
                    format="json",
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )
                self.assertIn("price", response.data)

        for currency in ("kes", "US", "USDX"):
            with self.subTest(currency=currency):
                response = self.client.post(
                    self.observation_list_url,
                    {
                        **base_payload,
                        "price": "40.0000",
                        "currency": currency,
                    },
                    format="json",
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )
                self.assertIn("currency", response.data)

    def test_duplicate_series_and_observation_records_are_rejected(self):
        self.authenticate_as(self.staff)
        duplicate_series_response = self.client.post(
            self.price_list_url,
            {
                "market": self.market.pk,
                "crop": self.crop.pk,
                "quantity_unit": "kg",
            },
            format="json",
        )
        self.assertEqual(
            duplicate_series_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        duplicate_observation_response = self.client.post(
            self.observation_list_url,
            {
                "market_price": self.price_series.pk,
                "observation_date": "2025-01-10",
                "price": "99.0000",
                "currency": "KES",
                "source_name": "County agriculture report",
                "source_reference": "A different reference",
                "grade": "Grade A",
            },
            format="json",
        )
        self.assertEqual(
            duplicate_observation_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            MarketPriceObservation.objects.filter(
                market_price=self.price_series,
                observation_date=date(2025, 1, 10),
                source_name="County agriculture report",
                grade="Grade A",
            ).count(),
            1,
        )

    def test_observation_creation_preserves_historical_entries(self):
        self.authenticate_as(self.staff)
        response = self.client.post(
            self.observation_list_url,
            {
                "market_price": self.price_series.pk,
                "observation_date": "2025-03-10",
                "price": "48.7500",
                "currency": "KES",
                "source_name": "New dated survey",
                "source_reference": "Survey-2025-03",
                "grade": "Grade A",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            MarketPriceObservation.objects.filter(
                market_price=self.price_series
            ).count(),
            3,
        )
        self.observation.refresh_from_db()
        self.assertEqual(str(self.observation.price), "42.5000")
        self.assertEqual(self.observation.source_name, "County agriculture report")
        self.assertEqual(
            self.observation.source_reference,
            "Report-2025-01",
        )

    def test_ids_and_timestamps_are_read_only(self):
        self.authenticate_as(self.staff)
        original_market_id = self.market.pk
        response = self.client.patch(
            self.market_detail_url,
            {
                "id": original_market_id + 100,
                "created_at": "2000-01-01T00:00:00Z",
                "updated_at": "2000-01-01T00:00:00Z",
                "description": "Read-only fields ignored",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.market.refresh_from_db()
        self.assertEqual(self.market.pk, original_market_id)
        self.assertEqual(self.market.description, "Read-only fields ignored")

        response = self.client.patch(
            self.observation_detail_url,
            {
                "id": self.observation.pk + 100,
                "created_at": "2000-01-01T00:00:00Z",
                "updated_at": "2000-01-01T00:00:00Z",
                "source_reference": "Updated source ref",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.observation.refresh_from_db()
        self.assertEqual(self.observation.source_reference, "Updated source ref")

    def test_deleting_referenced_market_or_price_series_returns_conflict(self):
        self.authenticate_as(self.staff)
        market_response = self.client.delete(self.market_detail_url)
        self.assertEqual(market_response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(Market.objects.filter(pk=self.market.pk).exists())
        self.assertIn("detail", market_response.data)

        price_response = self.client.delete(self.price_detail_url)
        self.assertEqual(price_response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(
            MarketPrice.objects.filter(pk=self.price_series.pk).exists()
        )
        self.assertIn("detail", price_response.data)

    def test_unreferenced_observation_can_be_deleted(self):
        self.authenticate_as(self.staff)
        response = self.client.delete(self.observation_detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            MarketPriceObservation.objects.filter(pk=self.observation.pk).exists()
        )
