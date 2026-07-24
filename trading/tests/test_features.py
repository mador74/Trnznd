import numpy as np

from cryptomodel.data import synthetic_ohlcv
from cryptomodel.features import FEATURE_COLUMNS, build_features


def test_features_have_expected_columns_and_no_nans():
    df = synthetic_ohlcv(n=500)
    feats = build_features(df)
    assert list(feats.columns) == FEATURE_COLUMNS
    assert feats.notna().all().all()
    # Warmup rows dropped -> fewer rows than input.
    assert 0 < len(feats) < len(df)


def test_features_are_causal_no_lookahead():
    """Changing a bar's future must not alter that bar's feature row."""
    df = synthetic_ohlcv(n=400)
    feats_a = build_features(df)

    # Perturb the last 5 closes only.
    df2 = df.copy()
    df2.iloc[-5:, df2.columns.get_loc("close")] *= 1.5
    feats_b = build_features(df2)

    common = feats_a.index.intersection(feats_b.index)[:-10]
    np.testing.assert_allclose(
        feats_a.loc[common].values, feats_b.loc[common].values, rtol=1e-9
    )
