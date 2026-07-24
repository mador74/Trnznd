import numpy as np
import pandas as pd

from cryptomodel.backtest import run_backtest, walk_forward_proba
from cryptomodel.data import synthetic_ohlcv
from cryptomodel.features import build_features
from cryptomodel.labels import make_labels

CONFIG = {
    "label": {"horizon": 1, "deadband": 0.0},
    "model": {"type": "logistic", "random_state": 0},
    "backtest": {
        "train_size": 200, "step": 100,
        "fee_bps": 10.0, "slippage_bps": 2.0,
        "allow_short": False, "prob_threshold": 0.5,
    },
}


def test_walk_forward_predictions_are_out_of_sample_only():
    df = synthetic_ohlcv(n=600)
    feats = build_features(df)
    labels = make_labels(df["close"], horizon=1)
    common = feats.index.intersection(labels.index)
    proba = walk_forward_proba(
        feats.loc[common], labels.loc[common, "label"],
        model_cfg=CONFIG["model"], train_size=200, step=100,
    )
    # First train_size bars are never predicted; the rest are.
    assert proba.iloc[:200].isna().all()
    assert proba.iloc[200:].notna().all()
    assert ((proba.dropna() >= 0) & (proba.dropna() <= 1)).all()


def test_backtest_runs_and_costs_reduce_return():
    df = synthetic_ohlcv(n=700)
    res = run_backtest(df, CONFIG)
    assert res.n_predictions > 0
    assert "sharpe" in res.metrics
    assert set(["proba_up", "position", "strat_return", "equity"]).issubset(res.frame.columns)

    # With costs zeroed, gross return should be >= net return.
    cfg0 = {**CONFIG, "backtest": {**CONFIG["backtest"], "fee_bps": 0.0, "slippage_bps": 0.0}}
    res0 = run_backtest(df, cfg0)
    assert res0.metrics["total_return"] >= res.metrics["total_return"] - 1e-9


def test_positions_do_not_earn_same_bar_return():
    """Strategy return at bar t must use position from bar t-1 (no lookahead)."""
    df = synthetic_ohlcv(n=500)
    res = run_backtest(df, CONFIG)
    f = res.frame
    held = f["position"].shift(1).fillna(0.0)
    # Reconstruct gross (pre-cost) strat return and compare.
    gross = held * f["asset_return"]
    # strat_return = gross - cost, so strat_return <= gross everywhere.
    assert (f["strat_return"] <= gross + 1e-12).all()
