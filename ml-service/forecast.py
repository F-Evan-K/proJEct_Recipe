"""One-day-ahead, per-menu sales estimates. Missing days are never zero-filled."""
from datetime import date, timedelta
from statistics import mean
from math import ceil
import hashlib
import json

from sklearn.ensemble import RandomForestRegressor

VERSION = "daily-sales-v1"
MIN_OBSERVATIONS = 42
WINDOW_DAYS = 84
MAX_GAP_DAYS = 7


def features(day, history):
    # Callers pass only observations strictly earlier than the prediction date.
    quantities = [r["quantity"] for r in history]
    same = [r["quantity"] for r in history if date.fromisoformat(r["businessDate"]).weekday() == day.weekday()]
    return [day.weekday(), mean(quantities[-7:]), mean(quantities[-28:]),
            mean(same[-4:]) if same else mean(quantities[-14:]),
            (day - date.fromisoformat(history[-1]["businessDate"])).days]


def baseline(day, history):
    return features(day, history)[3]


def metrics(actual, predicted):
    error = sum(abs(a - p) for a, p in zip(actual, predicted))
    volume = sum(actual)
    return {"mae": round(error / len(actual), 3),
            "wape": round(error / volume * 100, 3) if volume else None}


def model():
    return RandomForestRegressor(n_estimators=64, min_samples_leaf=3,
                                 max_depth=6, random_state=42, n_jobs=1)


def eligibility(usable, target):
    if len(usable) < MIN_OBSERVATIONS:
        return "INSUFFICIENT_HISTORY"
    if (target - date.fromisoformat(usable[-1]["businessDate"])).days > MAX_GAP_DAYS:
        return "STALE_HISTORY"
    return None


def evaluate_models(usable, target, compare_all=False):
    """Fit only from pre-target history, including the model selection step."""
    x, y = [], []
    for i in range(14, len(usable)):
        day = date.fromisoformat(usable[i]["businessDate"])
        x.append(features(day, usable[:i]))
        y.append(usable[i]["quantity"])
    holdout = usable[-7:]
    candidate = model().fit(x[:-7], y[:-7])
    forest_score = metrics(y[-7:], candidate.predict(x[-7:]).tolist())
    baseline_predictions = [
        baseline(date.fromisoformat(row["businessDate"]), usable[:len(usable) - 7 + index])
        for index, row in enumerate(holdout)
    ]
    baseline_score = metrics(y[-7:], baseline_predictions)
    use_forest = forest_score["mae"] < baseline_score["mae"] * 0.95
    baseline_quantity = max(0, ceil(baseline(target, usable)))
    forest_quantity = None
    if use_forest or compare_all:
        forecast_value = model().fit(x, y).predict([features(target, usable)])[0]
        forest_quantity = max(0, ceil(forecast_value))
    return {
        "quantity": forest_quantity if use_forest else baseline_quantity,
        "baselineQuantity": baseline_quantity,
        "forestQuantity": forest_quantity,
        "method": "random_forest" if use_forest else "weekday_mean",
        "evaluation": {
            "baseline": baseline_score,
            "randomForest": forest_score,
            "testCount": 7,
            "trainCount": len(y) - 7,
            "testStart": holdout[0]["businessDate"],
            "testEnd": holdout[-1]["businessDate"],
            "protocol": "chronological_one_step_ahead",
        },
    }


def estimate_menu(menu, rows, target):
    rows = sorted(rows, key=lambda r: r["businessDate"])
    usable = [r for r in rows if not r["closed"] and not r["stockout"]]
    warnings = []
    missing = WINDOW_DAYS - len(rows)
    excluded = len(rows) - len(usable)
    if missing:
        warnings.append(f"{missing} hari tanpa catatan dalam jendela 84 hari; tidak dianggap nol.")
    if excluded:
        warnings.append(f"{excluded} catatan tutup/kehabisan stok tidak dipakai sebagai target permintaan.")
    result = {"menuId": menu["id"], "name": menu["name"], "observations": len(usable),
              "missingDays": missing, "excludedDays": excluded, "warnings": warnings,
              "quantity": None, "method": None, "evaluation": None}
    reason = eligibility(usable, target)
    if reason == "INSUFFICIENT_HISTORY":
        return {**result, "status": "INSUFFICIENT_DATA",
                "reason": f"Butuh minimal {MIN_OBSERVATIONS} catatan hari buka tanpa stockout; tersedia {len(usable)}."}
    if reason == "STALE_HISTORY":
        return {**result, "status": "INSUFFICIENT_DATA", "reason": "Data terakhir lebih dari 7 hari sebelum tanggal estimasi."}
    prediction = evaluate_models(usable, target)
    result.update(status="READY", quantity=prediction["quantity"],
                  method=prediction["method"], evaluation=prediction["evaluation"])
    warnings.append("Estimasi penjualan hari buka, bukan jaminan demand. Evaluasi 7 hari belum merupakan bukti peningkatan produksi.")
    return result


def forecast(payload):
    target = date.fromisoformat(payload["targetDate"])
    start = (target - timedelta(days=WINDOW_DAYS)).isoformat()
    rows = [r for r in payload["sales"] if start <= r["businessDate"] < payload["targetDate"]]
    keys = [(r["menuId"], r["businessDate"]) for r in rows]
    if len(keys) != len(set(keys)):
        raise ValueError("Duplicate menu/date observations")
    results = [estimate_menu(m, [r for r in rows if r["menuId"] == m["id"]], target)
               for m in payload["menus"]]
    count = sum(r["status"] == "READY" for r in results)
    fingerprint = hashlib.sha256(json.dumps(sorted(rows, key=lambda r: (r["menuId"], r["businessDate"])),
                                           sort_keys=True).encode()).hexdigest()
    return {"targetDate": payload["targetDate"], "version": VERSION,
            "status": "READY" if count and count == len(results) else "PARTIAL" if count else "INSUFFICIENT_DATA",
            "dataHash": fingerprint, "windowStart": start,
            "windowEnd": (target-timedelta(days=1)).isoformat(), "items": results}
