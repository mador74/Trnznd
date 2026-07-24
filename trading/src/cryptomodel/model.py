"""Model: a scikit-learn classifier that predicts P(next bar up).

Kept deliberately simple and standardized behind one class so the model type can
be swapped (gradient boosting <-> logistic regression) without touching the
backtest. Probabilities — not hard labels — are returned so the backtester can
apply its own decision threshold.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


@dataclass
class DirectionModel:
    """Binary up/down classifier with a scaler baked in."""

    model_type: str = "gradient_boosting"
    n_estimators: int = 200
    max_depth: int = 3
    learning_rate: float = 0.05
    random_state: int = 42
    _pipe: Pipeline | None = field(default=None, init=False, repr=False)

    def _build(self) -> Pipeline:
        if self.model_type == "gradient_boosting":
            clf = GradientBoostingClassifier(
                n_estimators=self.n_estimators,
                max_depth=self.max_depth,
                learning_rate=self.learning_rate,
                random_state=self.random_state,
            )
        elif self.model_type == "logistic":
            clf = LogisticRegression(max_iter=1000, random_state=self.random_state)
        else:
            raise ValueError(f"Unknown model_type {self.model_type!r}")
        return Pipeline([("scaler", StandardScaler()), ("clf", clf)])

    def fit(self, X: pd.DataFrame, y: pd.Series) -> "DirectionModel":
        self._pipe = self._build()
        # Guard against a degenerate training window (single class present).
        if y.nunique() < 2:
            self._pipe = None
            self._constant = int(y.iloc[0]) if len(y) else 0
        else:
            self._pipe.fit(X.values, y.values)
        return self

    def predict_proba_up(self, X: pd.DataFrame) -> np.ndarray:
        """Return P(up) for each row of X, in [0, 1]."""
        if self._pipe is None:
            # Fell back to a constant training window; emit a neutral-ish prior.
            return np.full(len(X), float(getattr(self, "_constant", 0)))
        classes = list(self._pipe.named_steps["clf"].classes_)
        proba = self._pipe.predict_proba(X.values)
        up_idx = classes.index(1) if 1 in classes else 0
        return proba[:, up_idx]

    @classmethod
    def from_config(cls, config: dict) -> "DirectionModel":
        m = config["model"]
        return cls(
            model_type=m.get("type", "gradient_boosting"),
            n_estimators=m.get("n_estimators", 200),
            max_depth=m.get("max_depth", 3),
            learning_rate=m.get("learning_rate", 0.05),
            random_state=m.get("random_state", 42),
        )
