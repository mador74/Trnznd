import pandas as pd

from cryptomodel.labels import forward_return, make_labels


def test_forward_return_matches_definition():
    close = pd.Series([100.0, 110.0, 99.0, 99.0])
    fr = forward_return(close, horizon=1)
    assert round(fr.iloc[0], 10) == 0.10   # 110/100 - 1
    assert round(fr.iloc[1], 4) == -0.1    # 99/110 - 1
    assert pd.isna(fr.iloc[-1])            # no future for last bar


def test_labels_drop_unlabelable_tail_and_use_deadband():
    close = pd.Series([100.0, 100.5, 100.0, 101.0, 100.0])
    out = make_labels(close, horizon=1, deadband=0.01)  # need > 1% move to be "up"
    assert len(out) == len(close) - 1   # last horizon row dropped
    assert set(out["label"].unique()) <= {0, 1}
    # 0.5% move up is inside the 1% deadband -> labeled 0.
    assert out["label"].iloc[0] == 0
