
from app.database import SessionLocal
from app.models import LedgerEntry, Category, CategoryGroup
import json

def check_income():
    db = SessionLocal()
    # Check for entries that look like income but might not be marked as such
    entries = db.query(LedgerEntry).all()
    
    issues = []
    for entry in entries:
        category = db.query(Category).filter(Category.id == entry.category_id).first() if entry.category_id else None
        group = db.query(CategoryGroup).filter(CategoryGroup.id == category.group_id).first() if category else None
        
        if entry.amount > 0:
            # This is positive, likely income or transfer
            issues.append({
                "id": str(entry.id),
                "name": entry.name,
                "amount": entry.amount,
                "category_name": category.name if category else "None",
                "group_name": group.name if group else "None",
                "group_type": group.type if group else "None"
            })
    
    print(json.dumps(issues, indent=2))
    db.close()

if __name__ == "__main__":
    check_income()
