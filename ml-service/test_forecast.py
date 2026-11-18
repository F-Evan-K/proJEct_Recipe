"""Synthetic fixtures only. These results are not measured business accuracy."""
import copy
import os
import unittest
from datetime import date, timedelta
from unittest.mock import patch

from fastapi.testclient import TestClient
from forecast import forecast, metrics, model as real_model
from main import app


def fixture(count=70, quantity=30):
    target = date(2026, 11, 19)
    return {"targetDate": target.isoformat(), "menus": [{"id": 1, "name": "Synthetic test menu"}],
            "sales": [{"menuId": 1, "businessDate": (target-timedelta(days=count-i)).isoformat(),
                       "quantity": quantity, "closed": False, "stockout": False} for i in range(count)]}


class ForecastTests(unittest.TestCase):
    def test_empty_and_short_data_never_fabricate_predictions(self):
        for count in [0, 10, 41]:
            result = forecast(fixture(count))
            self.assertEqual(result["status"], "INSUFFICIENT_DATA")
            self.assertIsNone(result["items"][0]["quantity"])

    def test_constant_series_prefers_baseline_and_zero_volume_is_defined(self):
        result = forecast(fixture())["items"][0]
        self.assertEqual((result["status"], result["quantity"], result["method"]), ("READY", 30, "weekday_mean"))
        self.assertEqual(result["evaluation"]["baseline"]["mae"], 0)
        self.assertIsNone(metrics([0]*7, [0]*7)["wape"])
        self.assertEqual(forecast(fixture(quantity=0))["items"][0]["quantity"], 0)

    def test_missing_closed_and_censored_days_are_not_zero_targets(self):
        body = fixture(42)
        body["sales"][0].update(closed=True, quantity=0)
        body["sales"][1].update(stockout=True, quantity=1)
        result = forecast(body)["items"][0]
        self.assertEqual(result["observations"], 40)
        self.assertEqual(result["excludedDays"], 2)
        self.assertEqual(result["missingDays"], 42)
        self.assertIsNone(result["quantity"])

    def test_future_and_out_of_window_records_cannot_change_forecast_or_hash(self):
        body = fixture()
        expected = forecast(body)
        body["sales"].append({**body["sales"][0], "businessDate": body["targetDate"], "quantity": 1000000})
        body["sales"].append({**body["sales"][0], "businessDate": "2020-01-01", "quantity": 1000000})
        self.assertEqual(forecast(body), expected)

    def test_fit_excludes_holdout_labels_and_preserves_time_order(self):
        body = fixture()
        for i, row in enumerate(body["sales"]): row["quantity"] = i
        calls = []
        def recording_model():
            estimator = real_model()
            fit = estimator.fit
            def record(x, y):
                calls.append(list(y))
                return fit(x, y)
            estimator.fit = record
            return estimator
        with patch("forecast.model", side_effect=recording_model):
            forecast(body)
        self.assertEqual(calls[0], list(range(14, 63)))

    def test_forest_is_selected_when_it_beats_baseline_on_synthetic_trend(self):
        body = fixture()
        for i, row in enumerate(body["sales"]): row["quantity"] = 20 + i*3
        result = forecast(body)["items"][0]
        self.assertEqual(result["method"], "random_forest")
        self.assertLess(result["evaluation"]["randomForest"]["mae"], result["evaluation"]["baseline"]["mae"] * 0.95)
        self.assertIsInstance(result["quantity"], int)
        self.assertGreaterEqual(result["quantity"], 0)

    def test_duplicate_and_stale_data(self):
        body = fixture()
        body["sales"].append(copy.copy(body["sales"][0]))
        with self.assertRaises(ValueError): forecast(body)
        body = fixture()
        body["sales"] = body["sales"][:-8]
        self.assertEqual(forecast(body)["items"][0]["status"], "INSUFFICIENT_DATA")

    def test_menus_are_independent_and_partial_is_explicit(self):
        body = fixture()
        body["menus"].append({"id": 2, "name": "No data"})
        result = forecast(body)
        self.assertEqual(result["status"], "PARTIAL")
        self.assertEqual(result["items"][0]["quantity"], 30)
        self.assertIsNone(result["items"][1]["quantity"])

    def test_http_key_and_validation(self):
        client = TestClient(app)
        with patch.dict(os.environ, {"ML_SERVICE_KEY": "synthetic-test-key"}):
            self.assertEqual(client.post("/forecast", json=fixture()).status_code, 401)
            headers = {"X-ML-Key": "synthetic-test-key"}
            self.assertEqual(client.post("/forecast", json=fixture(), headers=headers).status_code, 200)
            for change in [{"quantity": -1}, {"quantity": 1.5}, {"closed": True, "quantity": 5}]:
                body = fixture()
                body["sales"][0].update(change)
                self.assertEqual(client.post("/forecast", json=body, headers=headers).status_code, 422)
            body = fixture(); body["sales"].append(copy.copy(body["sales"][0]))
            self.assertEqual(client.post("/forecast", json=body, headers=headers).status_code, 422)


if __name__ == "__main__":
    unittest.main()
