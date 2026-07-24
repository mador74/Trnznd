"""Walk-forward prediction and a lookahead-free vectorized backtest.

Timing convention (critical for avoiding lookahead):

  * Features at bar ``t`` use only information through the close of ``t``.
  * The model produces P(up) for bar ``t``; from it we choose a target
    position ``position[t]`` — the exposure we hold going INTO bar ``t+1``.
  * The strategy return realized on bar ``t+1`` is
    ``position[t] * asset_return[t+1]`` minus transaction cost whenever the
    position changes.

So predictions are strictly out-of-sample (walk-forward), and a position never
earns the same bar's return it was computed from.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .features import FEATURE_COLUMNS, build_features
from .labels import make_labels
from .metrics import equity_curve, summarize
from .model import DirectionModel


@dataclass
class BacktestResult:
    frame: pd.DataFrame          # per-bar: proba, position, asset_return, strat_return, equity
    metrics: dict                # strategy performance summary
    n_predictions: int
    data_source: str = "unknown"


def walk_forward_proba(
    features: pd.DataFrame,
    labels: pd.Series,
    model_cfg: dict,
    train_size: int,
    step: int,
) -> pd.Series:
    """Produce out-of-sample P(up) for every bar after the initial train window.

    Refits an expanding-window model every ``step`` bars. Only bars that were
    never in any training window receive a prediction.
    """
    idx = features.index
    n = len(features)
    if n <= train_size:
        raise ValueError(
            f"Not enough rows ({n}) for train_size={train_size}. "
            "Lower backtest.train_size or fetch more candles."
        )

    proba = pd.Series(np.nan, index=idx, dtype="float64")
    model = DirectionModel.from_config({"model": model_cfg})

    start = train_size
    while start < n:
        end = min(start + step, n)
        # Expanding window: everything strictly before the test block.
        X_train = features.iloc[:start]
        y_train = labels.iloc[:start]
        model.fit(X_train, y_train)

        X_test = features.iloc[start:end]
        proba.iloc[start:end] = model.predict_proba_up(X_test)
        start = end

    return proba


def run_backtest(df: pd.DataFrame, config: dict) -> BacktestResult:
    """End-to-end: features -> labels -> walk-forward preds -> simulated P&L."""
    bt = config["backtest"]
    label_cfg = config["label"]

    features = build_features(df)
    labels_df = make_labels(
        df["close"], horizon=label_cfg["horizon"], deadband=label_cfg.get("deadband", 0.0)
    )

    # Align features and labels on their common index (drops warmup + last horizon).
    common = features.index.intersection(labels_df.index)
    features = features.loc[common, FEATURE_COLUMNS]
    labels = labels_df.loc[common, "label"]

    proba = walk_forward_proba(
        features,
        labels,
        model_cfg=config["model"],
        train_size=bt["train_size"],
        step=bt["step"],
    )

    # Restrict to bars that actually got an out-of-sample prediction.
    oos = proba.dropna().index
    frame = pd.DataFrame(index=oos)
    frame["proba_up"] = proba.loc[oos]

    # Target position decided at close of each bar.
    threshold = bt.get("prob_threshold", 0.5)
    allow_short = bt.get("allow_short", False)
    long_signal = (frame["proba_up"] > threshold).astype("int8")
    if allow_short:
        frame["position"] = np.where(long_signal == 1, 1.0, -1.0)
    else:
        frame["position"] = long_signal.astype("float64")

    # Asset return realized on THIS bar (close-to-close).
    asset_ret = df["close"].pct_change().reindex(oos)
    frame["asset_return"] = asset_ret

    # Position chosen at t earns the return of t+1 -> shift positions forward.
    held = frame["position"].shift(1).fillna(0.0)

    # Costs: charged on the change in exposure (entry/exit/flip), per side.
    cost_rate = (bt.get("fee_bps", 0.0) + bt.get("slippage_bps", 0.0)) / 10_000.0
    trade_size = frame["position"].diff().abs().fillna(frame["position"].abs())
    cost = trade_size * cost_rate

    frame["strat_return"] = held * frame["asset_return"] - cost
    frame["equity"] = equity_curve(frame["strat_return"])
    frame["buy_hold_equity"] = equity_curve(frame["asset_return"])

    metrics = summarize(
        frame["strat_return"],
        positions=frame["position"],
        benchmark_returns=frame["asset_return"],
    )
    metrics["cost_bps_per_side"] = round(cost_rate * 10_000.0, 3)
    metrics["n_trades"] = int((trade_size > 0).sum())

    return BacktestResult(
        frame=frame,
        metrics=metrics,
        n_predictions=len(oos),
        data_source=df.attrs.get("source", "unknown"),
    )
