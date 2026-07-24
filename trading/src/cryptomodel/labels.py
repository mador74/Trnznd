"""Label construction.

The target is the direction of the forward return over ``horizon`` bars:

    forward_return[t] = close[t + horizon] / close[t] - 1
    label[t]          = 1 if forward_return[t] > deadband else 0

A ``deadband`` slightly above zero (e.g. round-trip trading cost) keeps the
model from chasing moves too small to profit from after fees.
"""

from __future__ import annotations

import pandas as pd


def forward_return(close: pd.Series, horizon: int = 1) -> pd.Series:
    if horizon < 1:
        raise ValueError("horizon must be >= 1")
    return close.shift(-horizon) / close - 1.0


def make_labels(close: pd.Series, horizon: int = 1, deadband: float = 0.0) -> pd.DataFrame:
    """Return a frame with ``fwd_return`` and binary ``label`` columns.

    The last ``horizon`` rows have no known future and are dropped.
    """
    fwd = forward_return(close, horizon)
    label = (fwd > deadband).astype("int8")
    out = pd.DataFrame({"fwd_return": fwd, "label": label})
    return out.iloc[:-horizon] if horizon > 0 else out
