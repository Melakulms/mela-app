def metrics(tp, fp, fn, tn):
    values = (tp, fp, fn, tn)
    if any(type(v) is not int or v < 0 for v in values):
        raise ValueError("Counts must be nonnegative integers")
    total = sum(values)
    def ratio(top, bottom):
        return top / bottom if bottom else None
    return {"accuracy": ratio(tp + tn, total),
            "precision": ratio(tp, tp + fp),
            "recall": ratio(tp, tp + fn)}
