from app.database import SessionLocal
from app.models import CategoryGroup, Category, CategoryType
from sqlalchemy import text

def seed():
    db = SessionLocal()
    
    # Fix Postgres ENUM issue with TRANSFER since Alembic autogenerate doesn't do it natively
    try:
        db.execute(text("ALTER TYPE categorytype ADD VALUE IF NOT EXISTS 'TRANSFER'"))
        db.commit()
    except Exception:
        db.rollback()
        
    db.query(Category).delete()
    db.query(CategoryGroup).delete()
    db.commit()

    groups_data = [
        {"name": "Fixed", "type": CategoryType.EXPENSE},
        {"name": "Discretionary", "type": CategoryType.EXPENSE},
        {"name": "Giving", "type": CategoryType.EXPENSE},
        {"name": "Transfer", "type": CategoryType.TRANSFER},
        {"name": "Active Income", "type": CategoryType.INCOME},
        {"name": "Passive Income", "type": CategoryType.INCOME},
    ]
    
    group_records = {} # Map name -> ID

    for data in groups_data:
        group = CategoryGroup(name=data["name"], type=data["type"])
        db.add(group)
        db.commit()
        db.refresh(group)
        group_records[group.name] = str(group.id)

    categories_data = [
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
        {"name": "Transfer", "group": "Transfer"}
    ]

    for data in categories_data:
        cat = Category(name=data["name"], group_id=group_records[data["group"]])
        db.add(cat)
    db.commit()
    print("Seed complete.")
    db.close()

if __name__ == "__main__":
    seed()
