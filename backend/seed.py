from app.database import SessionLocal
from app.models import CategoryGroup, Category, CategoryType
from sqlalchemy import text

PERSONAL_GROUPS = [
    {"name": "Fixed", "type": CategoryType.EXPENSE},
    {"name": "Discretionary", "type": CategoryType.EXPENSE},
    {"name": "Giving", "type": CategoryType.EXPENSE},
    {"name": "Transfer", "type": CategoryType.TRANSFER},
    {"name": "Active Income", "type": CategoryType.INCOME},
    {"name": "Passive Income", "type": CategoryType.INCOME},
]

PERSONAL_CATEGORIES = [
    {"name": "Housing", "group": "Fixed"},
    {"name": "Grocery", "group": "Fixed"},
    {"name": "Take-out", "group": "Fixed"},
    {"name": "Restaurant", "group": "Fixed"},
    {"name": "Utilities", "group": "Fixed"},
    {"name": "Subscriptions", "group": "Fixed"},
    {"name": "Transportation", "group": "Fixed"},
    {"name": "Household", "group": "Fixed"},
    {"name": "Clothing", "group": "Discretionary"},
    {"name": "Self Care", "group": "Discretionary"},
    {"name": "Travel", "group": "Discretionary"},
    {"name": "Entertainment", "group": "Discretionary"},
    {"name": "Big Purchases", "group": "Discretionary"},
    {"name": "Gift", "group": "Giving"},
    {"name": "Charity", "group": "Giving"},
    {"name": "Paycheck", "group": "Active Income"},
    {"name": "Investment Income", "group": "Passive Income"},
    {"name": "Transfer", "group": "Transfer"},
]

# Xero-aligned Business Chart of Accounts
BUSINESS_GROUPS = [
    {"name": "BIZ · Revenue", "type": CategoryType.INCOME},
    {"name": "BIZ · COGS", "type": CategoryType.EXPENSE},
    {"name": "BIZ · Operating Expenses", "type": CategoryType.EXPENSE},
    {"name": "BIZ · Owner / Capital", "type": CategoryType.TRANSFER},
]

BUSINESS_CATEGORIES = [
    # Revenue
    {"name": "Sales Revenue", "group": "BIZ · Revenue"},
    {"name": "Service Revenue", "group": "BIZ · Revenue"},
    {"name": "Interest Income", "group": "BIZ · Revenue"},
    {"name": "Other Income", "group": "BIZ · Revenue"},
    # COGS
    {"name": "Cost of Goods Sold", "group": "BIZ · COGS"},
    {"name": "Direct Labour", "group": "BIZ · COGS"},
    {"name": "Freight & Delivery", "group": "BIZ · COGS"},
    # Operating Expenses
    {"name": "Advertising & Marketing", "group": "BIZ · Operating Expenses"},
    {"name": "Bank Charges", "group": "BIZ · Operating Expenses"},
    {"name": "Depreciation", "group": "BIZ · Operating Expenses"},
    {"name": "Insurance", "group": "BIZ · Operating Expenses"},
    {"name": "IT & Software", "group": "BIZ · Operating Expenses"},
    {"name": "Legal & Accounting", "group": "BIZ · Operating Expenses"},
    {"name": "Office Supplies", "group": "BIZ · Operating Expenses"},
    {"name": "Rent & Occupancy", "group": "BIZ · Operating Expenses"},
    {"name": "Subscriptions & SaaS", "group": "BIZ · Operating Expenses"},
    {"name": "Travel & Accommodation", "group": "BIZ · Operating Expenses"},
    {"name": "Utilities (BIZ)", "group": "BIZ · Operating Expenses"},
    {"name": "Wages & Salaries", "group": "BIZ · Operating Expenses"},
    {"name": "Superannuation", "group": "BIZ · Operating Expenses"},
    {"name": "GST Clearing", "group": "BIZ · Operating Expenses"},
    # Owner / Capital
    {"name": "Owner Drawings", "group": "BIZ · Owner / Capital"},
    {"name": "Capital Contribution", "group": "BIZ · Owner / Capital"},
]


def _seed_groups(db, groups_data, categories_data):
    """Seed a set of groups+categories, skipping groups that already exist by name."""
    group_records = {}
    for data in groups_data:
        existing = db.query(CategoryGroup).filter(CategoryGroup.name == data["name"]).first()
        if existing:
            group_records[existing.name] = str(existing.id)
            continue
        group = CategoryGroup(name=data["name"], type=data["type"])
        db.add(group)
        db.commit()
        db.refresh(group)
        group_records[group.name] = str(group.id)

    for data in categories_data:
        group_id = group_records.get(data["group"])
        if not group_id:
            continue
        already = db.query(Category).filter(
            Category.name == data["name"],
            Category.group_id == group_id
        ).first()
        if not already:
            db.add(Category(name=data["name"], group_id=group_id))
    db.commit()


def seed():
    db = SessionLocal()

    # Fix Postgres ENUM issue with TRANSFER since Alembic autogenerate doesn't do it natively
    try:
        db.execute(text("ALTER TYPE categorytype ADD VALUE IF NOT EXISTS 'TRANSFER'"))
        db.commit()
    except Exception:
        db.rollback()

    _seed_groups(db, PERSONAL_GROUPS, PERSONAL_CATEGORIES)
    _seed_groups(db, BUSINESS_GROUPS, BUSINESS_CATEGORIES)

    print("Seed complete.")
    db.close()


def seed_business_only():
    """Call this to add business categories to an existing install."""
    db = SessionLocal()
    _seed_groups(db, BUSINESS_GROUPS, BUSINESS_CATEGORIES)
    print("Business categories seeded.")
    db.close()


if __name__ == "__main__":
    seed()
