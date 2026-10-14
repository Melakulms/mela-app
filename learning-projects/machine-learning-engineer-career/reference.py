from math import isfinite

def baseline(records):
    if len(records) != 12 or {r["month"] for r in records} != set(range(1,13)):
        raise ValueError("Provide exactly one row per month 1 to 12")
    if any(type(r["month"]) is not int for r in records):
        raise ValueError("Month must be an integer")
    for r in records:
        v = r["demand"]
        if type(v) not in (int,float) or not isfinite(v) or v < 0:
            raise ValueError("Demand must be finite and nonnegative")
    train = [r["demand"] for r in records if r["month"] <= 8]
    validation = [r["demand"] for r in records if 9 <= r["month"] <= 10]
    test = [r["demand"] for r in records if r["month"] >= 11]
    prediction = sum(train) / len(train)
    mae = lambda values: sum(abs(v-prediction) for v in values)/len(values)
    return {"prediction": prediction,
            "validation_mae": mae(validation), "test_mae": mae(test)}
