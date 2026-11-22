from datetime import date

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from crops.models import Crop, CropVariety
from farmers.models import FarmerProfile
from farms.models import Farm, Field
from markets.models import Market, MarketPrice, MarketPriceObservation
from production.models import GrowingSeason

from .models import (
    CropRecommendation,
    DecisionReport,
    MarketComparison,
    ProductionPlan,
)


User = get_user_model()


class DecisionsAPITests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="decision-farmer",
            password="test-password",
        )
        self.profile = FarmerProfile.objects.create(user=self.user)
        self.farm = Farm.objects.create(
            farmer=self.profile,
            name="Farmer Farm",
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
            name="Local maize",
        )
        self.season = GrowingSeason.objects.create(
            field=self.field,
            crop=self.crop,
            variety=self.variety,
            planting_date=date(2025, 1, 1),
            area_planted_hectares="1.5000",
        )
        self.recommendation = CropRecommendation.objects.create(
            field=self.field,
            crop=self.crop,
            variety=self.variety,
            generated_at="2025-01-02T10:00:00Z",
            suitability_score="78.50",
            explanation="Existing supported recommendation.",
            supporting_factors={"soil": "recorded"},
            assumptions={"rainfall": "unknown"},
            source_reference=["source-record-1"],
            uncertainty_notes="Rainfall information is incomplete.",
            model_version="test-model-1",
        )
        self.plan = ProductionPlan.objects.create(
            field=self.field,
            crop=self.crop,
            variety=self.variety,
            growing_season=self.season,
            crop_recommendation=self.recommendation,
            estimated_cost="5000.00",
            currency="KES",
            expected_yield="120.000",
            yield_unit="kg",
            assumptions={"yield": "estimate"},
            source_references=["extension-reference"],
            uncertainty_notes="Yield estimate is uncertain.",
            model_version="test-model-2",
        )
        self.report = DecisionReport.objects.create(
            field=self.field,
            crop_recommendation=self.recommendation,
            production_plan=self.plan,
            summary="Existing report summary.",
            recommendation_text="Existing recommendation text.",
            assumptions={"market": "not yet assessed"},
            sources=["report-source"],
            model_version="report-model-1",
        )
        self.market = Market.objects.create(
            name="Central Market",
            market_type=Market.MarketType.WHOLESALE,
            county="Kisumu",
        )
        self.price_series = MarketPrice.objects.create(
            market=self.market,
            crop=self.crop,
            quantity_unit="kg",
        )
        self.observation = MarketPriceObservation.objects.create(
            market_price=self.price_series,
            observation_date=date(2025, 2, 1),
            price="40.0000",
            currency="KES",
            source_name="County survey",
            source_reference="survey-2025-02",
            grade="Grade A",
        )
        self.comparison = MarketComparison.objects.create(
            decision_report=self.report,
            production_plan=self.plan,
            price_observation=self.observation,
            comparison_date="2025-02-02T10:00:00Z",
            quantity="20.000",
            estimated_gross_sales_value="800.00",
            estimated_transport_cost="100.00",
            currency="KES",
            assumptions={"quantity": "user supplied"},
            uncertainty_notes="Transport amount is an estimate.",
        )

        self.other_user = User.objects.create_user(
            username="other-decision-farmer",
            password="test-password",
            is_staff=True,
        )
        self.other_profile = FarmerProfile.objects.create(user=self.other_user)
        self.other_farm = Farm.objects.create(
            farmer=self.other_profile,
            name="Other Farmer Farm",
        )
        self.other_field = Field.objects.create(
            farm=self.other_farm,
            name="Other Field",
            area_hectares="1.0000",
        )
        self.other_season = GrowingSeason.objects.create(
            field=self.other_field,
            crop=self.crop,
            planting_date=date(2025, 1, 1),
        )
        self.other_recommendation = CropRecommendation.objects.create(
            field=self.other_field,
            crop=self.crop,
            generated_at="2025-01-02T10:00:00Z",
        )
        self.other_plan = ProductionPlan.objects.create(
            field=self.other_field,
            crop=self.crop,
        )
        self.other_report = DecisionReport.objects.create(
            field=self.other_field,
        )

        self.recommendation_list_url = reverse("decisions:recommendation-list")
        self.plan_list_url = reverse("decisions:production-plan-list")
        self.report_list_url = reverse("decisions:report-list")
        self.comparison_list_url = reverse("decisions:market-comparison-list")
        self.recommendation_detail_url = reverse(
            "decisions:recommendation-detail",
            kwargs={"pk": self.recommendation.pk},
        )
        self.plan_detail_url = reverse(
            "decisions:production-plan-detail",
            kwargs={"pk": self.plan.pk},
        )
        self.report_detail_url = reverse(
            "decisions:report-detail",
            kwargs={"pk": self.report.pk},
        )
        self.comparison_detail_url = reverse(
            "decisions:market-comparison-detail",
            kwargs={"pk": self.comparison.pk},
        )

    def authenticate_as(self, user=None):
        self.client.force_authenticate(user=user or self.user)

    def test_anonymous_access_is_denied_for_all_decision_resources(self):
        endpoints = (
            self.recommendation_list_url,
            self.recommendation_detail_url,
            self.plan_list_url,
            self.plan_detail_url,
            self.report_list_url,
            self.report_detail_url,
            self.comparison_list_url,
            self.comparison_detail_url,
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

    def test_farmer_can_read_own_decisions_but_cannot_read_other_farmer_records(self):
        self.authenticate_as()
        for endpoint in (
            self.recommendation_detail_url,
            self.plan_detail_url,
            self.report_detail_url,
            self.comparison_detail_url,
        ):
            with self.subTest(endpoint=endpoint):
                self.assertEqual(
                    self.client.get(endpoint).status_code,
                    status.HTTP_200_OK,
                )

        other_detail_urls = (
            reverse(
                "decisions:recommendation-detail",
                kwargs={"pk": self.other_recommendation.pk},
            ),
            reverse(
                "decisions:production-plan-detail",
                kwargs={"pk": self.other_plan.pk},
            ),
            reverse(
                "decisions:report-detail",
                kwargs={"pk": self.other_report.pk},
            ),
        )
        for endpoint in other_detail_urls:
            with self.subTest(endpoint=endpoint):
                self.assertEqual(
                    self.client.get(endpoint).status_code,
                    status.HTTP_404_NOT_FOUND,
                )

        own_list_ids = (
            (
                self.recommendation_list_url,
                {self.recommendation.pk},
            ),
            (self.plan_list_url, {self.plan.pk}),
            (self.report_list_url, {self.report.pk}),
            (self.comparison_list_url, {self.comparison.pk}),
        )
        for endpoint, expected in own_list_ids:
            response = self.client.get(endpoint)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual({item["id"] for item in response.data}, expected)

    def test_staff_status_does_not_bypass_decision_ownership(self):
        self.authenticate_as(self.other_user)
        for endpoint in (
            self.recommendation_detail_url,
            self.plan_detail_url,
            self.report_detail_url,
            self.comparison_detail_url,
        ):
            with self.subTest(endpoint=endpoint):
                self.assertEqual(
                    self.client.get(endpoint).status_code,
                    status.HTTP_404_NOT_FOUND,
                )
                self.assertEqual(
                    self.client.patch(
                        endpoint,
                        {"status": "dismissed"},
                        format="json",
                    ).status_code,
                    status.HTTP_404_NOT_FOUND,
                )
                self.assertEqual(
                    self.client.delete(endpoint).status_code,
                    status.HTTP_404_NOT_FOUND,
                )

    def test_user_without_farmer_profile_cannot_access_or_create_decisions(self):
        user_without_profile = User.objects.create_user(
            username="decision-no-profile",
            password="test-password",
        )
        self.authenticate_as(user_without_profile)
        for endpoint in (
            self.recommendation_list_url,
            self.recommendation_detail_url,
            self.plan_list_url,
            self.plan_detail_url,
            self.report_list_url,
            self.report_detail_url,
            self.comparison_list_url,
            self.comparison_detail_url,
        ):
            with self.subTest(endpoint=endpoint):
                self.assertEqual(
                    self.client.get(endpoint).status_code,
                    status.HTTP_404_NOT_FOUND,
                )

        response = self.client.post(
            self.recommendation_list_url,
            {
                "field": self.field.pk,
                "crop": self.crop.pk,
                "generated_at": "2025-03-01T10:00:00Z",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_retrieve_update_and_delete_all_four_models(self):
        self.authenticate_as()

        recommendation_response = self.client.post(
            self.recommendation_list_url,
            {
                "field": self.field.pk,
                "crop": self.crop.pk,
                "variety": self.variety.pk,
                "generated_at": "2025-03-01T10:00:00Z",
                "suitability_score": "81.25",
                "explanation": "Farmer-provided recommendation record.",
                "supporting_factors": {"soil": "observed"},
                "assumptions": {"rainfall": "unknown"},
                "source_reference": ["ref-1"],
                "uncertainty_notes": "Weather details are incomplete.",
                "model_version": "recorded-model-version",
            },
            format="json",
        )
        self.assertEqual(
            recommendation_response.status_code,
            status.HTTP_201_CREATED,
            recommendation_response.data,
        )
        new_recommendation_id = recommendation_response.data["id"]
        recommendation_url = reverse(
            "decisions:recommendation-detail",
            kwargs={"pk": new_recommendation_id},
        )
        self.assertEqual(
            self.client.get(recommendation_url).status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.client.patch(
                recommendation_url,
                {"uncertainty_notes": "Updated uncertainty"},
                format="json",
            ).status_code,
            status.HTTP_200_OK,
        )

        plan_response = self.client.post(
            self.plan_list_url,
            {
                "field": self.field.pk,
                "crop": self.crop.pk,
                "variety": self.variety.pk,
                "growing_season": self.season.pk,
                "crop_recommendation": new_recommendation_id,
                "estimated_cost": None,
                "currency": "",
                "expected_yield": None,
                "yield_unit": "",
                "assumptions": {"cost": "unknown"},
                "source_references": ["plan-source"],
                "uncertainty_notes": "Yield is unknown.",
                "model_version": "future-model",
                "status": "draft",
            },
            format="json",
        )
        self.assertEqual(plan_response.status_code, status.HTTP_201_CREATED)
        new_plan_id = plan_response.data["id"]
        plan_url = reverse(
            "decisions:production-plan-detail",
            kwargs={"pk": new_plan_id},
        )
        self.assertEqual(self.client.get(plan_url).status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.client.patch(
                plan_url,
                {"uncertainty_notes": "Revised uncertainty"},
                format="json",
            ).status_code,
            status.HTTP_200_OK,
        )

        report_response = self.client.post(
            self.report_list_url,
            {
                "field": self.field.pk,
                "crop_recommendation": new_recommendation_id,
                "production_plan": new_plan_id,
                "summary": "Recorded decision report.",
                "recommendation_text": "Review options with an extension officer.",
                "assumptions": {"transport": "unknown"},
                "sources": ["report-source-2"],
                "model_version": "decision-model-version",
                "generated_at": None,
                "status": "draft",
            },
            format="json",
        )
        self.assertEqual(
            report_response.status_code,
            status.HTTP_201_CREATED,
            report_response.data,
        )
        new_report_id = report_response.data["id"]
        report_url = reverse(
            "decisions:report-detail",
            kwargs={"pk": new_report_id},
        )
        self.assertEqual(
            self.client.get(report_url).status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.client.patch(
                report_url,
                {"summary": "Updated summary"},
                format="json",
            ).status_code,
            status.HTTP_200_OK,
        )

        comparison_response = self.client.post(
            self.comparison_list_url,
            {
                "decision_report": new_report_id,
                "production_plan": new_plan_id,
                "price_observation": self.observation.pk,
                "comparison_date": "2025-03-02T10:00:00Z",
                "quantity": "10.000",
                "estimated_gross_sales_value": None,
                "estimated_transport_cost": None,
                "currency": "KES",
                "assumptions": {"transport": "not provided"},
                "uncertainty_notes": "Values remain unknown.",
            },
            format="json",
        )
        self.assertEqual(
            comparison_response.status_code,
            status.HTTP_201_CREATED,
            comparison_response.data,
        )
        new_comparison_id = comparison_response.data["id"]
        comparison_url = reverse(
            "decisions:market-comparison-detail",
            kwargs={"pk": new_comparison_id},
        )
        self.assertEqual(
            self.client.get(comparison_url).status_code,
            status.HTTP_200_OK,
        )
        self.assertIsNone(comparison_response.data["estimated_net_return"])
        self.assertEqual(
            self.client.patch(
                comparison_url,
                {"uncertainty_notes": "Updated comparison uncertainty"},
                format="json",
            ).status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.client.delete(comparison_url).status_code,
            status.HTTP_204_NO_CONTENT,
        )
        self.assertEqual(
            self.client.delete(report_url).status_code,
            status.HTTP_204_NO_CONTENT,
        )
        self.assertEqual(
            self.client.delete(plan_url).status_code,
            status.HTTP_204_NO_CONTENT,
        )
        self.assertEqual(
            self.client.delete(recommendation_url).status_code,
            status.HTTP_204_NO_CONTENT,
        )

    def test_recommendation_requires_explicit_generation_timestamp_and_valid_score(self):
        self.authenticate_as()
        payload = {"field": self.field.pk, "crop": self.crop.pk}
        response = self.client.post(
            self.recommendation_list_url,
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("generated_at", response.data)

        for score in ("-0.01", "100.01"):
            with self.subTest(score=score):
                response = self.client.post(
                    self.recommendation_list_url,
                    {
                        **payload,
                        "generated_at": "2025-04-01T10:00:00Z",
                        "suitability_score": score,
                    },
                    format="json",
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )
                self.assertIn("suitability_score", response.data)

    def test_field_crop_variety_and_recommendation_ownership_are_validated(self):
        self.authenticate_as()
        base = {
            "field": self.field.pk,
            "crop": self.crop.pk,
            "generated_at": "2025-04-01T10:00:00Z",
        }
        response = self.client.post(
            self.recommendation_list_url,
            {**base, "field": self.other_field.pk},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("field", response.data)

        other_crop = Crop.objects.create(common_name="Beans")
        response = self.client.post(
            self.recommendation_list_url,
            {**base, "crop": other_crop.pk, "variety": self.variety.pk},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("variety", response.data)

        response = self.client.post(
            self.plan_list_url,
            {
                "field": self.field.pk,
                "crop": self.crop.pk,
                "crop_recommendation": self.other_recommendation.pk,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("crop_recommendation", response.data)

    def test_plan_validates_season_and_recommendation_consistency(self):
        self.authenticate_as()
        other_crop = Crop.objects.create(common_name="Beans")
        other_season = GrowingSeason.objects.create(
            field=self.field,
            crop=other_crop,
            planting_date=date(2025, 1, 1),
        )
        response = self.client.post(
            self.plan_list_url,
            {
                "field": self.field.pk,
                "crop": self.crop.pk,
                "variety": self.variety.pk,
                "growing_season": other_season.pk,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("growing_season", response.data)

        response = self.client.post(
            self.plan_list_url,
            {
                "field": self.field.pk,
                "crop": self.crop.pk,
                "crop_recommendation": self.other_recommendation.pk,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("crop_recommendation", response.data)

        response = self.client.post(
            self.plan_list_url,
            {
                "field": self.field.pk,
                "crop": self.crop.pk,
                "estimated_cost": "20.00",
                "currency": "",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(
            self.plan_list_url,
            {
                "field": self.field.pk,
                "crop": self.crop.pk,
                "expected_yield": "10.000",
                "yield_unit": "",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_report_rejects_recommendation_or_plan_from_another_field(self):
        self.authenticate_as()
        response = self.client.post(
            self.report_list_url,
            {
                "field": self.field.pk,
                "crop_recommendation": self.other_recommendation.pk,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("crop_recommendation", response.data)

        response = self.client.post(
            self.report_list_url,
            {
                "field": self.field.pk,
                "production_plan": self.other_plan.pk,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("production_plan", response.data)

    def test_market_comparison_validates_report_plan_observation_and_currency(self):
        self.authenticate_as()
        other_crop = Crop.objects.create(common_name="Beans")
        other_series = MarketPrice.objects.create(
            market=self.market,
            crop=other_crop,
            quantity_unit="kg",
        )
        other_observation = MarketPriceObservation.objects.create(
            market_price=other_series,
            observation_date=date(2025, 2, 1),
            price="30.0000",
            currency="USD",
            source_name="Other crop source",
        )
        base = {
            "decision_report": self.report.pk,
            "production_plan": self.plan.pk,
            "price_observation": self.observation.pk,
            "comparison_date": "2025-04-01T10:00:00Z",
            "quantity": "10.000",
            "currency": "KES",
        }
        response = self.client.post(
            self.comparison_list_url,
            {**base, "price_observation": other_observation.pk},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("price_observation", response.data)

        response = self.client.post(
            self.comparison_list_url,
            {**base, "currency": "USD"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("currency", response.data)

        response = self.client.post(
            self.comparison_list_url,
            {**base, "decision_report": self.other_report.pk},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("decision_report", response.data)

        other_field_report = DecisionReport.objects.create(field=self.field)
        other_field_plan = ProductionPlan.objects.create(
            field=self.other_field,
            crop=self.crop,
        )
        response = self.client.post(
            self.comparison_list_url,
            {
                **base,
                "decision_report": other_field_report.pk,
                "production_plan": other_field_plan.pk,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("production_plan", response.data)

    def test_patch_revalidates_model_clean_relationship_rules(self):
        self.authenticate_as()
        other_crop = Crop.objects.create(common_name="Beans")
        other_season = GrowingSeason.objects.create(
            field=self.field,
            crop=other_crop,
            planting_date=date(2025, 1, 1),
        )
        response = self.client.patch(
            self.plan_detail_url,
            {"growing_season": other_season.pk},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("growing_season", response.data)

        response = self.client.patch(
            self.report_detail_url,
            {"field": self.other_field.pk},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("field", response.data)

        response = self.client.patch(
            self.comparison_detail_url,
            {"currency": "USD"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("currency", response.data)

    def test_invalid_numeric_and_currency_values_are_rejected(self):
        self.authenticate_as()
        for payload in (
            {"estimated_cost": "-1.00", "currency": "KES"},
            {"expected_yield": "0", "yield_unit": "kg"},
            {"currency": "kes"},
        ):
            with self.subTest(payload=payload):
                response = self.client.patch(
                    self.plan_detail_url,
                    payload,
                    format="json",
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )

        for payload in (
            {"quantity": "0"},
            {"estimated_gross_sales_value": "0"},
            {"estimated_transport_cost": "-1"},
            {"currency": "KESX"},
        ):
            with self.subTest(payload=payload):
                response = self.client.patch(
                    self.comparison_detail_url,
                    payload,
                    format="json",
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )

    def test_filters_are_owner_scoped_and_validate_values(self):
        self.authenticate_as()
        filter_cases = (
            (
                self.recommendation_list_url,
                {
                    "farm_id": self.farm.pk,
                    "field_id": self.field.pk,
                    "crop_id": self.crop.pk,
                    "status": "generated",
                    "start_date": "2025-01-01",
                    "end_date": "2025-01-03",
                },
                self.recommendation.pk,
            ),
            (
                self.plan_list_url,
                {
                    "farm_id": self.farm.pk,
                    "field_id": self.field.pk,
                    "crop_id": self.crop.pk,
                    "status": "draft",
                },
                self.plan.pk,
            ),
            (
                self.report_list_url,
                {
                    "farm_id": self.farm.pk,
                    "field_id": self.field.pk,
                    "crop_id": self.crop.pk,
                    "status": "draft",
                },
                self.report.pk,
            ),
            (
                self.comparison_list_url,
                {
                    "farm_id": self.farm.pk,
                    "field_id": self.field.pk,
                    "crop_id": self.crop.pk,
                    "status": "draft",
                    "start_date": "2025-02-01",
                    "end_date": "2025-02-03",
                },
                self.comparison.pk,
            ),
        )
        for endpoint, params, expected_id in filter_cases:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoint, params)
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(
                    {item["id"] for item in response.data},
                    {expected_id},
                )

        invalid_filters = (
            (self.recommendation_list_url, {"farm_id": "bad"}),
            (self.plan_list_url, {"field_id": "0"}),
            (self.report_list_url, {"status": "not-a-status"}),
            (self.comparison_list_url, {"crop_id": "bad"}),
            (
                self.recommendation_list_url,
                {"start_date": "2025-02-01", "end_date": "2025-01-01"},
            ),
            (self.report_list_url, {"start_date": "bad-date"}),
        )
        for endpoint, params in invalid_filters:
            with self.subTest(endpoint=endpoint, params=params):
                response = self.client.get(endpoint, params)
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )

    def test_ids_and_timestamps_are_read_only(self):
        self.authenticate_as()
        response = self.client.patch(
            self.recommendation_detail_url,
            {
                "id": self.recommendation.pk + 100,
                "created_at": "2000-01-01T00:00:00Z",
                "updated_at": "2000-01-01T00:00:00Z",
                "explanation": "Updated explanation",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.recommendation.refresh_from_db()
        self.assertEqual(response.data["id"], self.recommendation.pk)
        self.assertEqual(self.recommendation.explanation, "Updated explanation")

        response = self.client.patch(
            self.comparison_detail_url,
            {
                "id": self.comparison.pk + 100,
                "created_at": "2000-01-01T00:00:00Z",
                "updated_at": "2000-01-01T00:00:00Z",
                "assumptions": {"updated": True},
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.comparison.refresh_from_db()
        self.assertEqual(response.data["id"], self.comparison.pk)
        self.assertEqual(self.comparison.assumptions, {"updated": True})

    def test_protected_deletions_return_conflict(self):
        self.authenticate_as()
        protected_cases = (
            (self.recommendation_detail_url, self.recommendation.pk),
            (self.plan_detail_url, self.plan.pk),
            (self.report_detail_url, self.report.pk),
        )
        for endpoint, pk in protected_cases:
            with self.subTest(endpoint=endpoint):
                response = self.client.delete(endpoint)
                self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
                self.assertIn("detail", response.data)
                if endpoint == self.recommendation_detail_url:
                    self.assertTrue(
                        CropRecommendation.objects.filter(pk=pk).exists()
                    )
                elif endpoint == self.plan_detail_url:
                    self.assertTrue(ProductionPlan.objects.filter(pk=pk).exists())
                else:
                    self.assertTrue(DecisionReport.objects.filter(pk=pk).exists())
