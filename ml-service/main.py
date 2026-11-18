import os
import secrets
import threading
from datetime import date
from typing import Annotated

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from forecast import forecast
from backtest import backtest

app = FastAPI(title="KitchenFlow Forecast", version="0.1.0")
run_lock = threading.Lock()


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Menu(StrictModel):
    id: Annotated[int, Field(strict=True, gt=0)]
    name: Annotated[str, Field(min_length=1, max_length=100)]


class ObservedSale(StrictModel):
    menuId: Annotated[int, Field(strict=True, gt=0)]
    businessDate: date
    quantity: Annotated[int, Field(strict=True, ge=0, le=1000000)]
    stockout: bool
    closed: bool


class Sale(ObservedSale):
    @model_validator(mode="after")
    def valid_closed(self):
        if self.closed and (self.quantity != 0 or self.stockout):
            raise ValueError("Closed days must have zero sales and cannot be stockouts")
        return self


class SalesRequest(StrictModel):
    menus: list[Menu]
    sales: list[ObservedSale]

    @model_validator(mode="after")
    def unique_menus(self):
        ids = [m.id for m in self.menus]
        if len(ids) != len(set(ids)) or any(s.menuId not in ids for s in self.sales):
            raise ValueError("Menus must be unique; sales must belong to a requested menu")
        return self


class ForecastRequest(SalesRequest):
    targetDate: date
    menus: Annotated[list[Menu], Field(max_length=20)]
    sales: Annotated[list[Sale], Field(max_length=1680)]


class BacktestRequest(SalesRequest):
    startDate: date
    endDate: date
    menus: Annotated[list[Menu], Field(min_length=1, max_length=5)]
    sales: Annotated[list[ObservedSale], Field(max_length=630)]

    @model_validator(mode="after")
    def valid_period(self):
        days = (self.endDate - self.startDate).days + 1
        if self.startDate.year < 1001 or not 7 <= days <= 42:
            raise ValueError("Evaluation range must cover 7 to 42 days")
        return self


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/forecast")
def run_forecast(body: ForecastRequest, x_ml_key: str = Header(default="")):
    return run_model(forecast, body, x_ml_key)


@app.post("/backtest")
def run_backtest(body: BacktestRequest, x_ml_key: str = Header(default="")):
    return run_model(backtest, body, x_ml_key)


def run_model(operation, body, supplied_key):
    key = os.environ.get("ML_SERVICE_KEY", "")
    if not key:
        raise HTTPException(503, "ML_SERVICE_KEY belum dikonfigurasi")
    if not secrets.compare_digest(supplied_key.encode(), key.encode()):
        raise HTTPException(401, "Invalid service key")
    if not run_lock.acquire(blocking=False):
        raise HTTPException(429, "Forecast sedang diproses. Coba lagi nanti.")
    try:
        return operation(body.model_dump(mode="json"))
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    finally:
        run_lock.release()
