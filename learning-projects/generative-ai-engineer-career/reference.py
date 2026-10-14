def retrieve(query, trusted_role, documents):
    """Toy keyword retrieval. trusted_role must come from server auth in a real app."""
    if trusted_role not in ("learner", "staff"):
        raise PermissionError("Unknown role")
    if not isinstance(query, str):
        raise ValueError("Query must be text")
    tokens = set(query.lower().split())
    allowed = [d for d in documents if trusted_role in d["allowed_roles"]]
    return [{"id": d["id"], "text": d["text"]}
            for d in allowed if tokens.intersection(d["text"].lower().split())]
