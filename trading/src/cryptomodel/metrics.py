"""Performance metrics for a per-bar strategy-return series."""

from __future__ import annotations

import numpy as np
import pandas as pd


def _periods_per_year(index: pd.DatetimeIndex) -> float:
    if len(index) < 3:
        return 365.0
    dt = np.median(np.diff(index.values).astype("timedelta64[s]").astype(float))
    if dt <= 0:
        return 365.0
    return (365 * 24 * 60 * 60) / dt


def equity_curve(returns: pd.Series) -> pd.Series:
    """Cumulative growth of 1 unit, compounding per-bar returns."""
    return (1.0 + returns.fillna(0.0)).cumprod()


def max_drawdown(equity: pd.Series) -> float:
    peak = equity.cummax()
    dd = equity / peak - 1.0
    return float(dd.min())


def sharpe(returns: pd.Series, ppy: float) -> float:
    r = returns.dropna()
    sd = r.std(ddof=0)
    if sd == 0 or len(r) == 0:
        return 0.0
    return float(r.mean() / sd * np.sqrt(ppy))


def sortino(returns: pd.Series, ppy: float) -> float:
    r = returns.dropna()
    downside = r[r < 0]
    dd = downside.std(ddof=0)
    if dd == 0 or len(r) == 0:
        return 0.0
    return float(r.mean() / dd * np.sqrt(ppy))


def summarize(
    strat_returns: pd.Series,
    positions: pd.Series | None = None,
    benchmark_returns: pd.Series | None = None,
) -> dict:
    """Compute a dict of headline metrics for a return series."""
    r = strat_returns.dropna()
    if r.empty:
        return {"n_bars": 0}

    ppy = _periods_per_year(r.index)
    eq = equity_curve(r)
    total_return = float(eq.iloc[-1] - 1.0)
    years = len(r) / ppy
    cagr = float(eq.iloc[-1] ** (1 / years) - 1.0) if years > 0 else 0.0

    metrics = {
        "n_bars": int(len(r)),
        "periods_per_year": round(ppy, 2),
        "total_return": total_return,
        "cagr": cagr,
        "ann_volatility": float(r.std(ddof=0) * np.sqrt(ppy)),
        "sharpe": sharpe(r, ppy),
        "sortino": sortino(r, ppy),
        "max_drawdown": max_drawdown(eq),
        "hit_rate": float((r > 0).mean()),
    }

    if positions is not None:
        pos = positions.reindex(r.index).fillna(0.0)
        metrics["exposure"] = float((pos != 0).mean())
        metrics["turnover_per_bar"] = float(pos.diff().abs().fillna(0.0).mean())

    if benchmark_returns is not None:
        b = benchmark_returns.reindex(r.index).dropna()
        if not b.empty:
            beq = equity_curve(b)
            metrics["benchmark_total_return"] = float(beq.iloc[-1] - 1.0)
            metrics["benchmark_sharpe"] = sharpe(b, ppy)

    return metrics
