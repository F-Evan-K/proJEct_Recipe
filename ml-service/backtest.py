"""Walk-forward validation for the one-day forecast and both candidate models."""
from collections import Counter
from datetime import date, timedelta

from forecast import VERSION, WINDOW_DAYS, eligibility, evaluate_models, metrics

PROTOCOL = "walk-forward-v1"


def summarize(days):
    statuses = Counter(day["status"] for day in days)
    scored = [day for day in days if day["status"] == "SCORED"]
    actual = [day["actual"] for day in scored]
    scores = None
    if scored:
        scores = {}
        for name in ("baseline", "randomForest", "selected"):
            predictions = [day[name] for day in scored]
            signed_error = sum(predicted - observed for predicted, observed in zip(predictions, actual))
            scores[name] = {
                **metrics(actual, predictions),
                "bias": round(signed_error / len(scored), 3),
            }
    return {
        "scored": len(scored),
        "expected": len(days),
        "skipped": {status: count for status, count in statuses.items() if status != "SCORED"},
        "scores": scores,
    }


def replay_menu(menu, dates, observations):
    timeline = sorted(observations.items())
    days = []
    for target in dates:
        window_start = target - timedelta(days=WINDOW_DAYS)
        history = [
            row for day, row in timeline
            if window_start <= day < target and not row["closed"] and not row["stockout"]
        ]
        observation = observations.get(target)
        day = {
            "date": target.isoformat(),
            "historyCount": len(history),
            "lastHistoryDate": history[-1]["businessDate"] if history else None,
            "actual": observation["quantity"] if observation is not None else None,
        }
        if observation is None:
            day["status"] = "MISSING_ACTUAL"
        elif observation["closed"]:
            day["status"] = "CLOSED"
        elif observation["stockout"]:
            day["status"] = "STOCKOUT"
        else:
            reason = eligibility(history, target)
            if reason:
                day["status"] = reason
            else:
                predictions = evaluate_models(history, target, compare_all=True)
                day.update(
                    status="SCORED",
                    baseline=predictions["baselineQuantity"],
                    randomForest=predictions["forestQuantity"],
                    selected=predictions["quantity"],
                    selectedMethod=predictions["method"],
                )
        days.append(day)
    return {"menuId": menu["id"], "name": menu["name"], "summary": summarize(days), "days": days}


def backtest(payload):
    start = date.fromisoformat(payload["startDate"])
    end = date.fromisoformat(payload["endDate"])
    dates = [start + timedelta(days=offset) for offset in range((end - start).days + 1)]
    observations = {menu["id"]: {} for menu in payload["menus"]}
    earliest = start - timedelta(days=WINDOW_DAYS)
    for row in payload["sales"]:
        day = date.fromisoformat(row["businessDate"])
        if not earliest <= day <= end:
            continue
        by_date = observations[row["menuId"]]
        if day in by_date:
            raise ValueError("Duplicate menu/date observations")
        by_date[day] = row
    menus = [replay_menu(menu, dates, observations[menu["id"]]) for menu in payload["menus"]]
    return {
        "protocol": PROTOCOL,
        "modelVersion": VERSION,
        "startDate": payload["startDate"],
        "endDate": payload["endDate"],
        "summary": summarize([day for menu in menus for day in menu["days"]]),
        "menus": menus,
    }
