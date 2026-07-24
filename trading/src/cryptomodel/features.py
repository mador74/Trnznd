"""Feature engineering.

Every feature is computed from information available *up to and including* the
close of each bar, then used to predict the NEXT bar. To avoid lookahead the
model layer shifts features/labels appropriately; here we just make sure no
feature peeks forward (all rolling windows look backwards).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# Names of the engineered feature columns (kept explicit so train/predict agree).
FEATURE_COLUMNS = [
    "ret_1",
    "ret_3",
    "ret_6",
    "ret_12",
    "rsi_14",
    "macd_hist",
    "bb_pctb",
    "atr_pct_14",
    "vol_zscore_20",
    "mom_24",
    "dist_sma_50",
]


def _rsi(close: pd.Series, window: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    avg_gain = gain.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0.0, np.nan)
    return 100 - (100 / (1 + rs))


def _macd_hist(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.Series:
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd = ema_fast - ema_slow
    signal_line = macd.ewm(span=signal, adjust=False).mean()
    return macd - signal_line


def _bollinger_pctb(close: pd.Series, window: int = 20, n_std: float = 2.0) -> pd.Series:
    mid = close.rolling(window).mean()
    std = close.rolling(window).std()
    upper = mid + n_std * std
    lower = mid - n_std * std
    return (close - lower) / (upper - lower)


def _atr_pct(df: pd.DataFrame, window: int = 14) -> pd.Series:
    prev_close = df["close"].shift(1)
    tr = pd.concat(
        [
            df["high"] - df["low"],
            (df["high"] - prev_close).abs(),
            (df["low"] - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    atr = tr.rolling(window).mean()
    return atr / df["close"]


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Return a DataFrame of features aligned to ``df``'s index.

    Rows with insufficient history (NaNs from warmup windows) are dropped.
    """
    close = df["close"]
    out = pd.DataFrame(index=df.index)

    out["ret_1"] = close.pct_change(1)
    out["ret_3"] = close.pct_change(3)
    out["ret_6"] = close.pct_change(6)
    out["ret_12"] = close.pct_change(12)
    out["rsi_14"] = _rsi(close, 14)
    out["macd_hist"] = _macd_hist(close)
    out["bb_pctb"] = _bollinger_pctb(close)
    out["atr_pct_14"] = _atr_pct(df, 14)

    vol = df["volume"]
    out["vol_zscore_20"] = (vol - vol.rolling(20).mean()) / vol.rolling(20).std()
    out["mom_24"] = close.pct_change(24)
    sma_50 = close.rolling(50).mean()
    out["dist_sma_50"] = (close - sma_50) / sma_50

    out = out[FEATURE_COLUMNS]
    return out.replace([np.inf, -np.inf], np.nan).dropna()
