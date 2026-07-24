import numpy as np
import pandas as pd

from cryptomodel.metrics import equity_curve, max_drawdown, sharpe, summarize


def test_equity_curve_compounds():
    r = pd.Series([0.1, -0.5, 0.0])
    eq = equity_curve(r)
    assert round(eq.iloc[-1], 4) == round(1.1 * 0.5 * 1.0, 4)


def test_max_drawdown_is_negative_on_decline():
    eq = pd.Series([1.0, 1.2, 0.6, 0.9])
    dd = max_drawdown(eq)
    assert round(dd, 4) == round(0.6 / 1.2 - 1.0, 4)  # -0.5


def test_sharpe_zero_when_no_variance():
    idx = pd.date_range("2024-01-01", periods=50, freq="h", tz="UTC")
    r = pd.Series(np.zeros(50), index=idx)
    assert sharpe(r, ppy=8760) == 0.0


def test_summarize_reports_core_keys():
    idx = pd.date_range("2024-01-01", periods=200, freq="h", tz="UTC")
    rng = np.random.default_rng(0)
    r = pd.Series(rng.normal(0.0005, 0.01, 200), index=idx)
    m = summarize(r)
    for key in ["total_return", "cagr", "sharpe", "max_drawdown", "hit_rate"]:
        assert key in m
