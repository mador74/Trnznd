"""Data layer: fetch OHLCV candles from Binance, or generate synthetic ones.

The Binance loader uses only the public market-data REST endpoint, which needs
no API key. It paginates backwards from now and caches results as parquet so
repeated runs are cheap and reproducible.

`synthetic_ohlcv` produces a geometric-Brownian-motion price series so the whole
pipeline (features -> model -> backtest) can be exercised with no network access.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

BINANCE_BASE = "https://api.binance.com"
_KLINES_PATH = "/api/v3/klines"

# Binance caps a single klines request at 1000 candles.
_MAX_PER_REQUEST = 1000

# Milliseconds per candle for each supported interval.
_INTERVAL_MS = {
    "1m": 60_000,
    "3m": 3 * 60_000,
    "5m": 5 * 60_000,
    "15m": 15 * 60_000,
    "30m": 30 * 60_000,
    "1h": 60 * 60_000,
    "2h": 2 * 60 * 60_000,
    "4h": 4 * 60 * 60_000,
    "6h": 6 * 60 * 60_000,
    "8h": 8 * 60 * 60_000,
    "12h": 12 * 60 * 60_000,
    "1d": 24 * 60 * 60_000,
}

_COLUMNS = ["open_time", "open", "high", "low", "close", "volume"]


def interval_to_ms(interval: str) -> int:
    try:
        return _INTERVAL_MS[interval]
    except KeyError as exc:
        raise ValueError(
            f"Unsupported interval {interval!r}. Supported: {sorted(_INTERVAL_MS)}"
        ) from exc


def _cache_path(cache_dir: str | Path, symbol: str, interval: str, limit: int) -> Path:
    d = Path(cache_dir)
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{symbol}_{interval}_{limit}.parquet"


def _request_klines(symbol: str, interval: str, end_time_ms: int, limit: int) -> list:
    params = f"symbol={symbol}&interval={interval}&limit={limit}&endTime={end_time_ms}"
    url = f"{BINANCE_BASE}{_KLINES_PATH}?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "cryptomodel/0.1"})
    with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310 (trusted host)
        return json.loads(resp.read().decode("utf-8"))


def fetch_binance_ohlcv(
    symbol: str = "BTCUSDT",
    interval: str = "1h",
    limit: int = 5000,
    cache_dir: str | Path | None = "data",
    use_cache: bool = True,
    max_retries: int = 4,
) -> pd.DataFrame:
    """Fetch the most recent ``limit`` candles for ``symbol`` from Binance.

    Returns a DataFrame indexed by UTC timestamp with columns
    ``[open, high, low, close, volume]``. Results are cached to parquet.
    """
    if cache_dir is not None and use_cache:
        cache = _cache_path(cache_dir, symbol, interval, limit)
        if cache.exists():
            return pd.read_parquet(cache)

    step_ms = interval_to_ms(interval)
    end_ms = int(time.time() * 1000)
    rows: list[list] = []

    while len(rows) < limit:
        want = min(_MAX_PER_REQUEST, limit - len(rows))
        batch = None
        for attempt in range(max_retries):
            try:
                batch = _request_klines(symbol, interval, end_ms, want)
                break
            except (urllib.error.URLError, TimeoutError) as exc:
                if attempt == max_retries - 1:
                    raise RuntimeError(
                        f"Binance request failed after {max_retries} attempts: {exc}"
                    ) from exc
                time.sleep(2 ** attempt)  # exponential backoff

        if not batch:
            break
        rows = batch + rows  # prepend older candles
        # Next page ends just before the oldest candle we just received.
        end_ms = batch[0][0] - step_ms
        if len(batch) < want:
            break  # ran out of history

    if not rows:
        raise RuntimeError("Binance returned no candles.")

    df = _klines_to_frame(rows).tail(limit)

    if cache_dir is not None and use_cache:
        df.to_parquet(_cache_path(cache_dir, symbol, interval, limit))
    return df


def _klines_to_frame(rows: list[list]) -> pd.DataFrame:
    # Binance kline row: [open_time, open, high, low, close, volume, close_time, ...]
    df = pd.DataFrame(
        [r[:6] for r in rows],
        columns=_COLUMNS,
    )
    df = df.astype({c: "float64" for c in ["open", "high", "low", "close", "volume"]})
    df["open_time"] = pd.to_datetime(df["open_time"], unit="ms", utc=True)
    df = df.drop_duplicates(subset="open_time").sort_values("open_time")
    df = df.set_index("open_time")
    df.index.name = "timestamp"
    return df


def synthetic_ohlcv(
    n: int = 6000,
    interval: str = "1h",
    start_price: float = 30_000.0,
    mu: float = 0.02,
    sigma: float = 0.6,
    seed: int = 7,
) -> pd.DataFrame:
    """Generate a synthetic OHLCV series (geometric Brownian motion).

    ``mu`` and ``sigma`` are annualized drift and volatility. This is only for
    exercising the pipeline offline — it contains no real predictable structure,
    so a well-behaved model should score near chance on it.
    """
    rng = np.random.default_rng(seed)
    step_ms = interval_to_ms(interval)
    periods_per_year = (365 * 24 * 60 * 60 * 1000) / step_ms
    dt = 1.0 / periods_per_year

    shocks = rng.normal(
        loc=(mu - 0.5 * sigma**2) * dt,
        scale=sigma * np.sqrt(dt),
        size=n,
    )
    close = start_price * np.exp(np.cumsum(shocks))

    # Build plausible OHLC around each close.
    prev_close = np.concatenate([[start_price], close[:-1]])
    open_ = prev_close
    intrabar = np.abs(rng.normal(0, sigma * np.sqrt(dt), size=n)) * close
    high = np.maximum(open_, close) + intrabar
    low = np.minimum(open_, close) - intrabar
    volume = rng.lognormal(mean=3.0, sigma=0.5, size=n)

    end = pd.Timestamp.now(tz="UTC").floor("h")
    index = pd.date_range(end=end, periods=n, freq=pd.Timedelta(milliseconds=step_ms))
    index.name = "timestamp"

    return pd.DataFrame(
        {"open": open_, "high": high, "low": low, "close": close, "volume": volume},
        index=index,
    )


def load_ohlcv(config: dict, offline: bool = False) -> pd.DataFrame:
    """Load candles per the ``data`` section of ``config``.

    When ``offline`` is True (or the fetch fails), fall back to synthetic data so
    the pipeline still runs. The caller is told which source was used via the
    DataFrame's ``.attrs['source']``.
    """
    d = config["data"]
    if offline:
        df = synthetic_ohlcv(n=d["limit"], interval=d["interval"])
        df.attrs["source"] = "synthetic"
        return df
    try:
        df = fetch_binance_ohlcv(
            symbol=d["symbol"],
            interval=d["interval"],
            limit=d["limit"],
            cache_dir=d.get("cache_dir", "data"),
        )
        df.attrs["source"] = "binance"
        return df
    except Exception as exc:  # network blocked, rate limited, etc.
        df = synthetic_ohlcv(n=d["limit"], interval=d["interval"])
        df.attrs["source"] = "synthetic"
        df.attrs["fallback_reason"] = str(exc)
        return df
