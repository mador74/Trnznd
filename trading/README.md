# cryptomodel — crypto trading research & backtest

A Python pipeline to build and **honestly evaluate** a predictive model for crypto
markets on Binance data. It is deliberately scoped to **research + backtest only**:
nothing here connects to an exchange account or places real orders. Getting the
research foundation right is the prerequisite for any paper- or live-trading step
later.

```
data (Binance/synthetic) → features → labels → walk-forward model → backtest → metrics
```

## Why start here (and not with a live bot)

Most crypto "trading models" lose money because the backtest lied — it peeked at
the future, ignored fees, or evaluated in-sample. This project is built to *not*
lie:

- **No lookahead.** Features use only data up to each bar's close; a position
  chosen at bar `t` earns bar `t+1`'s return, never its own bar's.
- **Walk-forward, out-of-sample.** The model is refit on an expanding window and
  only ever predicts bars it was never trained on.
- **Costs are real.** Taker fees + slippage are charged on every change in
  exposure.
- **A benchmark you can't hide from.** Every run is compared to buy & hold.

If the strategy can't beat buy & hold *net of costs, out-of-sample*, it isn't real.

## Install

```bash
cd trading
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Quickstart

Run the whole pipeline on synthetic data — no network, no API key:

```bash
PYTHONPATH=src python -m cryptomodel.pipeline demo
```

On a machine with Binance access, fetch real candles and backtest them:

```bash
PYTHONPATH=src python -m cryptomodel.pipeline fetch
PYTHONPATH=src python -m cryptomodel.pipeline backtest --out artifacts/backtest.csv
```

> **Note:** Binance's public API is geo-restricted in some regions and was blocked
> in the environment this was built in. If a fetch fails, the pipeline automatically
> falls back to synthetic data and tells you so. On synthetic (random-walk) data the
> strategy is *expected* to lose after costs — that's the backtest being honest.

## Configuration

Everything is driven by [`config.yaml`](config.yaml): the symbol/interval, the
prediction horizon, the model type and hyperparameters, and the backtest settings
(train window, refit cadence, fees, slippage, long-only vs long/short, decision
threshold).

## Project layout

```
trading/
├── config.yaml                 # all knobs
├── src/cryptomodel/
│   ├── data.py                 # Binance klines fetch (+cache) & synthetic generator
│   ├── features.py             # causal technical-indicator features
│   ├── labels.py               # forward-return direction labels
│   ├── model.py                # sklearn classifier (gradient boosting / logistic)
│   ├── backtest.py             # walk-forward predictions + vectorized P&L
│   ├── metrics.py              # Sharpe, Sortino, max drawdown, hit rate, turnover
│   └── pipeline.py             # CLI: fetch | backtest | demo
└── tests/                      # pytest suite (incl. explicit no-lookahead checks)
```

## Metrics reported

Total return, CAGR, annualized volatility, Sharpe, Sortino, max drawdown, hit
rate, exposure, turnover, trade count — each alongside the buy & hold benchmark.

## Roadmap (once the research holds up)

1. **Validate an edge** — feature work, purged/embargoed cross-validation, and
   robustness across symbols and time periods before believing any Sharpe.
2. **Paper trading** — wire the same signal to Binance's testnet with a live data
   loop and position/risk manager. No real funds.
3. **Live trading** — only after paper results match backtest expectations, with
   hard risk limits (max position, daily loss stop, kill switch) and secrets kept
   out of the repo (`.env`, never committed).

## ⚠️ Risk disclaimer

This is research software for education, not financial advice. Crypto trading can
lose you money quickly. Backtest performance does **not** predict live results
(overfitting, regime change, slippage, and exchange outages all bite). Never trade
money you can't afford to lose, and review the code yourself before risking capital.
