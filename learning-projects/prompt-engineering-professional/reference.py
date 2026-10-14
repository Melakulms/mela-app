def evaluate(expected, actual):
    fields = {"event", "date", "room"}
    if not isinstance(expected, dict) or set(expected) != fields:
        raise ValueError("Invalid evaluation fixture")
    if not isinstance(actual, dict):
        return {"schema_valid": False, "correct_fields": 0, "field_accuracy": 0}
    valid = set(actual) == fields and all(v is None or isinstance(v,str) for v in actual.values())
    correct = sum(k in actual and actual[k] == expected[k] and
                  type(actual[k]) is type(expected[k]) for k in fields)
    return {"schema_valid": valid, "correct_fields": correct, "field_accuracy": correct/3}
