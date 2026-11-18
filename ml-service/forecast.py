"""One-day-ahead, per-menu sales estimates. Missing days are never zero-filled."""
from datetime import date, timedelta
from statistics import mean
from math import ceil
import hashlib
import json

from sklearn.ensemble import RandomForestRegressor

VERSION = "daily-sales-v1"
MIN_OBSERVATIONS = 42


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


def estimate_menu(menu, rows, target):
    rows = sorted(rows, key=lambda r: r["businessDate"])
    usable = [r for r in rows if not r["closed"] and not r["stockout"]]
    warnings = []
    missing = 84 - len(rows)
    excluded = len(rows) - len(usable)
    if missing:
        warnings.append(f"{missing} hari tanpa catatan dalam jendela 84 hari; tidak dianggap nol.")
    if excluded:
        warnings.append(f"{excluded} catatan tutup/kehabisan stok tidak dipakai sebagai target permintaan.")
    result = {"menuId": menu["id"], "name": menu["name"], "observations": len(usable),
              "missingDays": missing, "excludedDays": excluded, "warnings": warnings,
              "quantity": None, "method": None, "evaluation": None}
    if len(usable) < MIN_OBSERVATIONS:
        return {**result, "status": "INSUFFICIENT_DATA",
                "reason": f"Butuh minimal {MIN_OBSERVATIONS} catatan hari buka tanpa stockout; tersedia {len(usable)}."}
    if (target - date.fromisoformat(usable[-1]["businessDate"])).days > 7:
        return {**result, "status": "INSUFFICIENT_DATA", "reason": "Data terakhir lebih dari 7 hari sebelum tanggal estimasi."}
    x, y = [], []
    for i in range(14, len(usable)):
        day = date.fromisoformat(usable[i]["businessDate"])
        x.append(features(day, usable[:i]))
        y.append(usable[i]["quantity"])
    # Last seven eligible dates are held out chronologically, never shuffled.
    candidate = model().fit(x[:-7], y[:-7])
    rf_predictions = candidate.predict(x[-7:]).tolist()
    holdout = usable[-7:]
    baseline_predictions = [baseline(date.fromisoformat(r["businessDate"]), usable[:len(usable)-7+i])
                            for i, r in enumerate(holdout)]
    rf_score, base_score = metrics(y[-7:], rf_predictions), metrics(y[-7:], baseline_predictions)
    # Prefer the simpler model unless the forest improves holdout MAE by at least 5%.
    use_forest = rf_score["mae"] < base_score["mae"] * 0.95
    prediction = (float(model().fit(x, y).predict([features(target, usable)])[0])
                  if use_forest else baseline(target, usable))
    result.update(status="READY", quantity=max(0, ceil(prediction)),
                  method="random_forest" if use_forest else "weekday_mean",
                  evaluation={"baseline": base_score, "randomForest": rf_score,
                              "testCount": 7, "trainCount": len(y)-7,
                              "testStart": holdout[0]["businessDate"], "testEnd": holdout[-1]["businessDate"],
                              "protocol": "chronological_one_step_ahead"})
    warnings.append("Estimasi penjualan hari buka, bukan jaminan demand. Evaluasi 7 hari belum merupakan bukti peningkatan produksi.")
    return result


def forecast(payload):
    target = date.fromisoformat(payload["targetDate"])
    start = (target - timedelta(days=84)).isoformat()
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
