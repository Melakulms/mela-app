from math import isfinite

def mean_score(scores):
    if not isinstance(scores, list) or not scores:
        raise ValueError("Provide a nonempty list")
    for value in scores:
        if type(value) not in (int, float) or not 0 <= value <= 100:
            raise ValueError("Scores must be numbers from 0 to 100")
        if not isfinite(value):
            raise ValueError("Scores must be finite")
    return sum(scores) / len(scores)
