import sqlite3

def revenue_report(orders, contacts):
    # Synthetic integer Birr amounts only; no external database is opened.
    if any(type(row[2]) is not int or row[2] < 0 for row in orders):
        raise ValueError("Amounts must be nonnegative integer Birr")
    db = sqlite3.connect(":memory:")
    try:
        db.execute("create table orders(id text primary key, customer text, amount integer)")
        db.execute("create table contacts(id text primary key, customer text)")
        db.executemany("insert into orders values (?,?,?)", orders)
        db.executemany("insert into contacts values (?,?)", contacts)
        naive = db.execute("select coalesce(sum(o.amount),0) from orders o join contacts c on o.customer=c.customer").fetchone()[0]
        # One row per order is retained, even for customers with no contact.
        correct = db.execute("select coalesce(sum(amount),0) from orders").fetchone()[0]
        contact_counts = dict(db.execute("select customer,count(*) from contacts group by customer"))
        return {"naive_join_total": naive, "correct_total": correct,
                "order_count": len(orders), "contact_counts": contact_counts}
    finally:
        db.close()
