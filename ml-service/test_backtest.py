import copy
import os
import unittest
from datetime import date, timedelta
from unittest.mock import patch

from fastapi.testclient import TestClient

from backtest import backtest
from forecast import forecast
from main import app


def fixture(quantity=None):
    start = date(2026, 8, 10)
    sales = []
    for offset in range(-70, 10):
        sales.append({
            "menuId": 1,
            "businessDate": (start + timedelta(days=offset)).isoformat(),
            "quantity": quantity if quantity is not None else 80 + offset + 4 * (offset % 7),
            "closed": False,
            "stockout": False,
        })
    return {
        "startDate": start.isoformat(),
        "endDate": (start + timedelta(days=6)).isoformat(),
        "menus": [{"id": 1, "name": "Synthetic test"}],
        "sales": sales,
    }


class BacktestTests(unittest.TestCase):
    def test_first_prediction_never_depends_on_target_or_future_quantities(self):
        original = fixture()
        expected = backtest(original)["menus"][0]["days"][0]
        changed = copy.deepcopy(original)
        for row in changed["sales"]:
            if row["businessDate"] >= original["startDate"]:
                row["quantity"] = 99999
        day = backtest(changed)["menus"][0]["days"][0]
        self.assertNotEqual(day["actual"], expected["actual"])
        for field in ("baseline", "randomForest", "selected", "selectedMethod"):
            self.assertEqual(day[field], expected[field])
        self.assertLess(day["lastHistoryDate"], day["date"])

    def test_replay_matches_the_normal_forecast_for_each_date(self):
        payload = fixture()
        report = backtest(payload)
        for day in report["menus"][0]["days"]:
            estimate = forecast({
                "targetDate": day["date"], "menus": payload["menus"], "sales": payload["sales"],
            })["items"][0]
            self.assertEqual((day["selected"], day["selectedMethod"]), (estimate["quantity"], estimate["method"]))
        count = report["summary"]["scored"]
        self.assertEqual(count, 7)
        daily_bias = sum(day["selected"] - day["actual"] for day in report["menus"][0]["days"]) / count
        self.assertEqual(report["summary"]["scores"]["selected"]["bias"], round(daily_bias, 3))

    def test_zero_sales_are_scored_and_censored_days_are_explained(self):
        payload = fixture(quantity=0)
        payload["sales"][70]["closed"] = True
        payload["sales"][71]["stockout"] = True
        del payload["sales"][72]
        report = backtest(payload)
        self.assertEqual(report["summary"]["scored"], 4)
        self.assertEqual(report["summary"]["skipped"], {
            "CLOSED": 1, "STOCKOUT": 1, "MISSING_ACTUAL": 1,
        })
        self.assertEqual(report["summary"]["scores"]["baseline"], {"mae": 0, "wape": None, "bias": 0})

    def test_insufficient_and_stale_history_have_no_fabricated_scores(self):
        payload = fixture()
        payload["sales"] = payload["sales"][-15:]
        result = backtest(payload)
        self.assertEqual(result["summary"]["skipped"], {"INSUFFICIENT_HISTORY": 7})
        self.assertIsNone(result["summary"]["scores"])
        payload = fixture()
        del payload["sales"][62:70]
        self.assertEqual(backtest(payload)["menus"][0]["days"][0]["status"], "STALE_HISTORY")

    def test_http_requires_key_limits_period_and_rejects_duplicate_rows(self):
        client = TestClient(app)
        with patch.dict(os.environ, {"ML_SERVICE_KEY": "test-key"}):
            headers = {"X-ML-Key": "test-key"}
            self.assertEqual(client.post("/backtest", json=fixture()).status_code, 401)
            oversized = fixture()
            oversized["endDate"] = "2026-11-10"
            self.assertEqual(client.post("/backtest", headers=headers, json=oversized).status_code, 422)
            duplicate = fixture()
            duplicate["sales"].append(duplicate["sales"][0])
            self.assertEqual(client.post("/backtest", headers=headers, json=duplicate).status_code, 422)
            result = client.post("/backtest", headers=headers, json=fixture(quantity=10))
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()["summary"]["scored"], 7)
