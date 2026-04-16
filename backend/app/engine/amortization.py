from datetime import date, timedelta
from typing import List, Dict
from app.models import Asset, AssetType, LedgerStatus

def calculate_projected_loan_balances(asset: Asset, ledger_entries: List[Dict], horizon_days: int = 365) -> List[Dict]:
    """
    Calculates the projected balance of a loan asset over time,
    factoring in interest calculation and repayments found in the ledger.
    """
    if asset.type != AssetType.LOAN or not asset.interest_rate:
        return []

    projected_history = []
    current_balance = asset.current_value
    current_date = date.today()
    end_date = current_date + timedelta(days=horizon_days)
    
    # Sort relevant ledger entries for this asset
    asset_payments = sorted(
        [e for e in ledger_entries if e.get("asset_id") == asset.id],
        key=lambda x: x["date"]
    )
    
    monthly_rate = (asset.interest_rate / 100) / 12
    
    # Track when we last applied interest (roughly monthly)
    last_interest_date = current_date
    
    for entry in asset_payments:
        entry_date = entry["date"]
        if isinstance(entry_date, str):
            entry_date = date.fromisoformat(entry_date)
            
        if entry_date > end_date:
            break
            
        # Apply interest if a month has passed since last_interest_date
        while (entry_date - last_interest_date).days >= 30:
            interest = current_balance * monthly_rate
            current_balance += interest
            last_interest_date += timedelta(days=30)
            projected_history.append({
                "date": last_interest_date,
                "value": current_balance,
                "type": "INTEREST_ACCRUAL"
            })

        # Apply payment (Payment is usually negative, reducing the liability)
        # For a loan, current_balance is a positive number representing debt.
        # A payment of -1000 reduces the debt.
        payment_amount = abs(entry["amount"])
        current_balance -= payment_amount
        
        projected_history.append({
            "date": entry_date,
            "value": max(0, current_balance),
            "type": "REPAYMENT",
            "ledger_entry_id": entry.get("id")
        })

    return projected_history
