"""Command-line entry point that orchestrates the research pipeline.

Subcommands:
  fetch     Download candles from Binance into the local cache.
  backtest  Run the full walk-forward backtest and print metrics.
  demo      Run backtest on synthetic data (no network needed).

Run ``python -m cryptomodel.pipeline demo`` for a zero-setup end-to-end run.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd
import yaml

from .backtest import run_backtest
from .data import fetch_binance_ohlcv, load_ohlcv

_DEFAULT_CONFIG = Path(__file__).resolve().parents[2] / "config.yaml"


def load_config(path: str | Path | None) -> dict:
    path = Path(path) if path else _DEFAULT_CONFIG
    with open(path) as f:
        return yaml.safe_load(f)


def _print_metrics(result) -> None:
    print(f"\nData source: {result.data_source}")
    print(f"Out-of-sample bars: {result.n_predictions}")
    print("\n--- Strategy performance (net of costs) ---")
    for k, v in result.metrics.items():
        if isinstance(v, float):
            if any(t in k for t in ("return", "cagr", "drawdown", "rate", "exposure", "volatility")):
                print(f"  {k:24s} {v:+.2%}")
            else:
                print(f"  {k:24s} {v:.4f}")
        else:
            print(f"  {k:24s} {v}")

    m = result.metrics
    print("\n--- Read this before trusting it ---")
    bh = m.get("benchmark_total_return")
    if bh is not None:
        verdict = "BEATS" if m.get("total_return", 0) > bh else "TRAILS"
        print(f"  Strategy {verdict} buy & hold ({m.get('total_return', 0):+.2%} vs {bh:+.2%}).")
    if result.data_source == "synthetic":
        print("  Data is SYNTHETIC (random walk) — any edge here is noise, not signal.")
    print("  Costs, slippage, and out-of-sample discipline are modeled but simplified.")
    print("  Past backtest performance does not imply future live results.")


def cmd_fetch(args: argparse.Namespace) -> int:
    cfg = load_config(args.config)
    d = cfg["data"]
    df = fetch_binance_ohlcv(
        symbol=d["symbol"], interval=d["interval"], limit=d["limit"],
        cache_dir=d.get("cache_dir", "data"), use_cache=not args.no_cache,
    )
    print(f"Fetched {len(df)} candles for {d['symbol']} {d['interval']} "
          f"({df.index[0]} -> {df.index[-1]})")
    return 0


def cmd_backtest(args: argparse.Namespace) -> int:
    cfg = load_config(args.config)
    df = load_ohlcv(cfg, offline=args.offline)
    if df.attrs.get("source") == "synthetic" and not args.offline:
        print(f"[warn] Falling back to synthetic data: "
              f"{df.attrs.get('fallback_reason', 'network unavailable')}")
    result = run_backtest(df, cfg)
    _print_metrics(result)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        result.frame.to_csv(args.out)
        print(f"\nPer-bar results written to {args.out}")
    return 0


def cmd_demo(args: argparse.Namespace) -> int:
    cfg = load_config(args.config)
    df = load_ohlcv(cfg, offline=True)
    result = run_backtest(df, cfg)
    _print_metrics(result)
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="cryptomodel", description=__doc__)
    p.add_argument("--config", help="Path to config.yaml", default=None)
    sub = p.add_subparsers(dest="command", required=True)

    pf = sub.add_parser("fetch", help="Download candles from Binance")
    pf.add_argument("--no-cache", action="store_true")
    pf.set_defaults(func=cmd_fetch)

    pb = sub.add_parser("backtest", help="Run the walk-forward backtest")
    pb.add_argument("--offline", action="store_true", help="Force synthetic data")
    pb.add_argument("--out", help="Write per-bar CSV to this path")
    pb.set_defaults(func=cmd_backtest)

    pd_ = sub.add_parser("demo", help="Backtest on synthetic data (no network)")
    pd_.set_defaults(func=cmd_demo)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
