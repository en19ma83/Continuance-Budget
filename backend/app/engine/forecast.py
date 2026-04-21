import uuid
from dateutil.rrule import rrule, MONTHLY, WEEKLY, YEARLY
from datetime import datetime, timedelta
from app.models import RecurringRule, LedgerEntry, LedgerStatus, FrequencyType

def generate_forecast(rule: RecurringRule, months_ahead: int = 12) -> list[LedgerEntry]:
    """
    Generates a list of projected LedgerEntry objects based on a RecurringRule.
    """
    # Convert date to datetime if necessary to use with dateutil
    start = datetime.combine(rule.anchor_date, datetime.min.time())
    until = datetime.now() + timedelta(days=30 * months_ahead)
    
    dates = []
    
    if rule.frequency_type == FrequencyType.MONTHLY_DATE:
        # Derive the day-of-month from the anchor date itself (frequency_value is ignored)
        dates = rrule(MONTHLY, dtstart=start, bymonthday=rule.anchor_date.day, until=until)
    
    elif rule.frequency_type == FrequencyType.FORTNIGHTLY:
        # Generates every second week matching the start weekday
        dates = rrule(WEEKLY, interval=2, dtstart=start, until=until)
        
    elif rule.frequency_type == FrequencyType.WEEKLY:
        # Generates every week
        dates = rrule(WEEKLY, interval=1, dtstart=start, until=until)
        
    elif rule.frequency_type == FrequencyType.ANNUAL:
        # Generates once a year
        dates = rrule(YEARLY, dtstart=start, until=until)

    elif rule.frequency_type == FrequencyType.QUARTERLY:
        # Generates every 3 months
        dates = rrule(MONTHLY, interval=3, dtstart=start, until=until)

    elif rule.frequency_type == FrequencyType.BI_ANNUAL:
        # Generates every 6 months
        dates = rrule(MONTHLY, interval=6, dtstart=start, until=until)
        
    elif rule.frequency_type == FrequencyType.ONCE:
        dates = [start]
        
    entries = []
    for d in dates:
        # Primary Entry (Outflow from source or Inflow if positive)
        if not rule.account_id:
            continue
            
        entry = LedgerEntry(
            id=uuid.uuid4(),
            date=d.date(),
            name=rule.name,
            amount=rule.amount,
            status=LedgerStatus.PROJECTED,
            rule_id=rule.id,
            account_id=rule.account_id,
            category_id=rule.category_id,
            asset_id=rule.asset_id
        )
        entries.append(entry)

        # Mirror Entry for Transfers
        if rule.transfer_to_account_id:
            # Try to get account names for better labeling
            source_abbr = rule.account.name if rule.account else "?"
            dest_abbr = rule.transfer_to_account.name if rule.transfer_to_account else "?"
            
            # Original entry gets "To [Dest]" context if name is generic
            if entry.name == "Transfer":
                entry.name = f"Transfer to {dest_abbr}"
            
            mirror = LedgerEntry(
                id=uuid.uuid4(),
                date=d.date(),
                name=f"Transfer from {source_abbr}" if entry.name.startswith("Transfer") else f"Mirror: {entry.name}",
                amount=-rule.amount,
                status=LedgerStatus.PROJECTED,
                rule_id=rule.id,
                account_id=rule.transfer_to_account_id,
                category_id=rule.category_id,
                asset_id=rule.asset_id
            )
            entries.append(mirror)
        
    return entries
