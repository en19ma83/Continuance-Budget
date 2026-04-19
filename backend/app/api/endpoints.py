from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from uuid import UUID
import datetime

from app.database import get_db
from app.models import RecurringRule, LedgerEntry, EntityType, LedgerStatus
from app.schemas.ledger import (
    RecurringRuleBase, RecurringRuleCreate, RecurringRuleOut,
    LedgerEntryCreate, LedgerEntryOut,
    MatchTransactionRequest,
    AccountCreate, AccountOut,
    AssetCreate, AssetOut, AssetValueUpdate
)
from app.models import CategoryGroup, Category, Account, Asset, AssetValueHistory, AssetType, DeviceToken
from app.schemas.ledger import CategoryGroupCreate, CategoryGroupOut, CategoryCreate, CategoryOut
from app.engine.forecast import generate_forecast
from app.engine.amortization import calculate_projected_loan_balances
from app.engine.currency import convert, get_supported_currencies, get_rates
from app.engine.stocks import get_stock_price
from app.api.auth import get_current_user, User

router = APIRouter()


# ---------------------------------------------------------------------------
# Ledger
# ---------------------------------------------------------------------------

@router.get("/ledger", response_model=List[LedgerEntryOut])
def get_ledger(
    entities: List[EntityType] = Query([...]),
    account_ids: Optional[List[UUID]] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Fetch all on-budget accounts for the entity filter
    account_query = db.query(Account).filter(
        Account.user_id == current_user.id,
        Account.entity.in_(entities),
        Account.is_on_budget == True,
    )
    all_active_accounts = account_query.all()

    # If account_ids filter provided, restrict to those specific accounts
    if account_ids:
        active_accounts = [a for a in all_active_accounts if a.id in account_ids]
    else:
        active_accounts = all_active_accounts

    ledger_account_ids = [a.id for a in active_accounts]
    total_starting_balance = sum(a.starting_balance for a in active_accounts)

    balance_calc = (
        func.sum(LedgerEntry.amount).over(order_by=(LedgerEntry.date, LedgerEntry.id))
        + total_starting_balance
    ).label("running_balance")

    query = (
        db.query(LedgerEntry, Account.entity, balance_calc)
        .join(Account, LedgerEntry.account_id == Account.id)
        .filter(LedgerEntry.user_id == current_user.id, LedgerEntry.account_id.in_(ledger_account_ids))
        .order_by(LedgerEntry.date, LedgerEntry.id)
        .all()
    )

    categories = {str(c.id): c for c in db.query(Category).all()}
    accounts_map = {str(a.id): a for a in all_active_accounts}

    results = []
    for entry, ent, bal in query:
        entry.running_balance = bal
        entry.entity = ent
        if entry.category_id and str(entry.category_id) in categories:
            entry.category_color = categories[str(entry.category_id)].color
            entry.category_name = categories[str(entry.category_id)].name
        acc = accounts_map.get(str(entry.account_id)) if entry.account_id else None
        if acc:
            entry.account_name = acc.name
            entry.account_type = acc.type
        results.append(entry)

    return results


# ---------------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------------

@router.post("/rules", response_model=RecurringRuleOut)
def create_rule(
    rule_data: RecurringRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_rule = RecurringRule(**rule_data.model_dump(), user_id=current_user.id)
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)

    projected_entries = generate_forecast(db_rule, months_ahead=18)
    for entry in projected_entries:
        entry.user_id = current_user.id
        db.add(entry)
    db.commit()

    return db_rule


@router.put("/rules/{rule_id}", response_model=RecurringRuleOut)
def update_rule(
    rule_id: UUID,
    rule_data: RecurringRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_rule = (
        db.query(RecurringRule)
        .filter(RecurringRule.id == rule_id, RecurringRule.user_id == current_user.id)
        .first()
    )
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    for key, value in rule_data.model_dump().items():
        setattr(db_rule, key, value)

    db.query(LedgerEntry).filter(
        LedgerEntry.rule_id == rule_id,
        LedgerEntry.user_id == current_user.id,
        LedgerEntry.status == LedgerStatus.PROJECTED,
    ).delete()

    projected_entries = generate_forecast(db_rule, months_ahead=18)
    for entry in projected_entries:
        entry.user_id = current_user.id
        db.add(entry)

    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.delete("/rules/{rule_id}")
def delete_rule(
    rule_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rule = (
        db.query(RecurringRule)
        .filter(RecurringRule.id == rule_id, RecurringRule.user_id == current_user.id)
        .first()
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

@router.post("/transactions", response_model=LedgerEntryOut)
def create_transaction(
    tx_data: LedgerEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_tx = LedgerEntry(**tx_data.model_dump(), status=LedgerStatus.ACTUAL, user_id=current_user.id)
    db.add(db_tx)
    db.commit()
    db.refresh(db_tx)
    return db_tx


@router.delete("/transactions/{tx_id}")
def delete_transaction(
    tx_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.id == tx_id, LedgerEntry.user_id == current_user.id)
        .first()
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(tx)
    db.commit()
    return {"status": "deleted"}


@router.post("/transactions/{ghost_id}/match", response_model=LedgerEntryOut)
def match_transaction(
    ghost_id: UUID,
    match_data: MatchTransactionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ghost = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.id == ghost_id, LedgerEntry.user_id == current_user.id)
        .first()
    )
    if not ghost:
        raise HTTPException(status_code=404, detail="Ghost projection not found")

    ghost.status = LedgerStatus.ACTUAL
    ghost.amount = match_data.actual_amount
    ghost.date = match_data.actual_date

    if ghost.asset_id:
        asset = (
            db.query(Asset)
            .filter(Asset.id == ghost.asset_id, Asset.user_id == current_user.id)
            .first()
        )
        if asset:
            payment_amount = abs(match_data.actual_amount)
            asset.current_value = max(0, asset.current_value - payment_amount)
            history = AssetValueHistory(
                asset_id=asset.id, date=match_data.actual_date, value=asset.current_value
            )
            db.add(history)

    db.commit()
    db.refresh(ghost)
    return ghost


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------

@router.get("/accounts", response_model=List[AccountOut])
def get_accounts(
    entities: List[EntityType] = Query([...]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Account)
        .filter(Account.user_id == current_user.id, Account.entity.in_(entities))
        .all()
    )


@router.post("/accounts", response_model=AccountOut)
def create_account(
    account_data: AccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_account = Account(**account_data.model_dump(), user_id=current_user.id)
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account


@router.put("/accounts/{account_id}", response_model=AccountOut)
def update_account(
    account_id: UUID,
    account_data: AccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_account = (
        db.query(Account)
        .filter(Account.id == account_id, Account.user_id == current_user.id)
        .first()
    )
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")

    for key, value in account_data.model_dump().items():
        setattr(db_account, key, value)

    db.commit()
    db.refresh(db_account)
    return db_account


@router.delete("/accounts/{account_id}")
def delete_account(
    account_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_account = (
        db.query(Account)
        .filter(Account.id == account_id, Account.user_id == current_user.id)
        .first()
    )
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")

    db.query(LedgerEntry).filter(
        LedgerEntry.account_id == account_id,
        LedgerEntry.user_id == current_user.id,
    ).delete()
    db.delete(db_account)
    db.commit()
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Categories (global reference data — no user isolation)
# ---------------------------------------------------------------------------

@router.get("/categories/groups", response_model=List[CategoryGroupOut])
def get_category_groups(db: Session = Depends(get_db)):
    return db.query(CategoryGroup).all()


@router.post("/categories/groups", response_model=CategoryGroupOut)
def create_category_group(
    group_data: CategoryGroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_group = CategoryGroup(**group_data.model_dump())
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group


@router.delete("/categories/groups/{group_id}")
def delete_category_group(
    group_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = db.query(CategoryGroup).filter(CategoryGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Category group not found")
    db.delete(group)
    db.commit()
    return {"status": "deleted"}


@router.post("/categories", response_model=CategoryOut)
def create_category(
    cat_data: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_cat = Category(**cat_data.model_dump())
    db.add(db_cat)
    db.commit()
    db.refresh(db_cat)
    return db_cat


@router.put("/categories/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: UUID,
    cat_data: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for key, value in cat_data.model_dump().items():
        setattr(cat, key, value)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(cat)
    db.commit()
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Liability Summary (Item 6 + 8)
# ---------------------------------------------------------------------------

@router.get("/liabilities/summary")
def get_liabilities_summary(
    entities: List[EntityType] = Query([...]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns a combined liability picture:
    - Credit card accounts: current balance derived from ledger (projected spend per statement period)
    - Loan/mortgage assets marked is_liability=True: current_value + interest_rate
    """
    result = []
    today = datetime.date.today()

    # ── CC Accounts ──────────────────────────────────────────────────────────
    cc_accounts = (
        db.query(Account)
        .filter(
            Account.user_id == current_user.id,
            Account.entity.in_(entities),
            Account.type == "Credit Card",
        )
        .all()
    )

    for acc in cc_accounts:
        # Actual spend recorded against this CC
        actual_sum = (
            db.query(func.sum(LedgerEntry.amount))
            .filter(
                LedgerEntry.account_id == acc.id,
                LedgerEntry.user_id == current_user.id,
                LedgerEntry.status == LedgerStatus.ACTUAL,
            )
            .scalar() or 0
        )
        # Projected spend for the current statement period
        stmt_close_day = acc.statement_date or 1
        if today.day <= stmt_close_day:
            period_start = (today.replace(day=1) - datetime.timedelta(days=1)).replace(day=stmt_close_day + 1) \
                if stmt_close_day < today.day else today.replace(day=1)
        else:
            period_start = today.replace(day=stmt_close_day + 1) if stmt_close_day < 28 else today.replace(day=1)

        projected_period = (
            db.query(func.sum(LedgerEntry.amount))
            .filter(
                LedgerEntry.account_id == acc.id,
                LedgerEntry.user_id == current_user.id,
                LedgerEntry.status == LedgerStatus.PROJECTED,
                LedgerEntry.date >= period_start,
                LedgerEntry.date <= today.replace(day=stmt_close_day) if stmt_close_day >= today.day
                    else (today.replace(month=today.month % 12 + 1, day=stmt_close_day) if today.month < 12
                          else today.replace(year=today.year + 1, month=1, day=stmt_close_day)),
            )
            .scalar() or 0
        )

        # Amount owing = starting_balance offset + all actual debits (negative amounts = spend)
        amount_owing = acc.starting_balance + actual_sum
        # Flip sign: CC spend is negative amounts; amount_owing represents what's owed (positive)
        amount_owing_display = -amount_owing if amount_owing < 0 else amount_owing

        utilisation = None
        if acc.credit_limit and acc.credit_limit > 0:
            utilisation = round((amount_owing_display / acc.credit_limit) * 100, 1)

        # Statement due date
        due_date = None
        if acc.statement_date and acc.statement_due_days:
            try:
                stmt_month = today.month if today.day <= acc.statement_date else (today.month % 12 + 1)
                stmt_year = today.year if stmt_month >= today.month else today.year + 1
                close_date = datetime.date(stmt_year, stmt_month, acc.statement_date)
                due_date = (close_date + datetime.timedelta(days=acc.statement_due_days)).isoformat()
            except ValueError:
                due_date = None

        result.append({
            "id": str(acc.id),
            "name": acc.name,
            "type": "credit_card",
            "balance": round(amount_owing_display, 2),
            "credit_limit": acc.credit_limit,
            "utilisation": utilisation,
            "balance_tracking_method": acc.balance_tracking_method or "AMOUNT_OWING",
            "projected_this_period": round(-projected_period, 2),
            "statement_due_date": due_date,
        })

    # ── Loan / Mortgage Assets ───────────────────────────────────────────────
    liability_assets = (
        db.query(Asset)
        .filter(
            Asset.user_id == current_user.id,
            Asset.entity.in_(entities),
            Asset.is_liability == True,
        )
        .all()
    )

    for asset in liability_assets:
        lvr = None
        if asset.linked_loan_id:
            # This asset IS the loan; find its linked property
            prop = (
                db.query(Asset)
                .filter(Asset.linked_loan_id == asset.id, Asset.user_id == current_user.id)
                .first()
            )
            if prop and prop.current_value > 0:
                lvr = round((asset.current_value / prop.current_value) * 100, 1)

        asset_type = "mortgage" if asset.type == AssetType.LOAN else "loan"
        result.append({
            "id": str(asset.id),
            "name": asset.name,
            "type": asset_type,
            "balance": round(asset.current_value, 2),
            "interest_rate": asset.interest_rate,
            "lvr": lvr,
            "credit_limit": None,
            "utilisation": None,
            "projected_this_period": None,
            "statement_due_date": None,
        })

    return result


# ---------------------------------------------------------------------------
# Ledger entry update (Item 9 — edit transactions)
# ---------------------------------------------------------------------------

from pydantic import BaseModel as _PydBaseModel

class LedgerEntryUpdate(_PydBaseModel):
    date: Optional[datetime.date] = None
    name: Optional[str] = None
    amount: Optional[float] = None
    status: Optional[LedgerStatus] = None
    category_id: Optional[UUID] = None


@router.put("/transactions/{tx_id}", response_model=LedgerEntryOut)
def update_transaction(
    tx_id: UUID,
    update: LedgerEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.id == tx_id, LedgerEntry.user_id == current_user.id)
        .first()
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    for field, value in update.model_dump(exclude_none=True).items():
        setattr(tx, field, value)

    db.commit()
    db.refresh(tx)
    return tx


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

def _budget_stats(user_id, entities, base_currency, db):
    accounts = (
        db.query(Account)
        .filter(Account.user_id == user_id, Account.entity.in_(entities))
        .all()
    )
    on_budget_total = 0   # liquid cash (Checking / Savings on-budget)
    off_budget_total = 0  # withheld cash (off-budget non-CC)
    cc_owing = 0.0        # total CC balance currently owed (a liability)
    cc_limit_total = 0.0  # total CC credit limit across all cards

    for acc in accounts:
        acc_currency = acc.currency or "AUD"
        actual_sum = (
            db.query(func.sum(LedgerEntry.amount))
            .filter(
                LedgerEntry.account_id == acc.id,
                LedgerEntry.user_id == user_id,
                LedgerEntry.status == LedgerStatus.ACTUAL,
            )
            .scalar()
            or 0
        )
        current_balance = acc.starting_balance + actual_sum
        current_balance_base = convert(current_balance, acc_currency, base_currency)

        if acc.type == "Credit Card":
            # CC spend is recorded as negative amounts. A negative running balance
            # means the user owes that amount — treat it as a liability, never as
            # liquid cash. A positive balance (e.g. overpayment) is ignored for safety.
            owing = max(0.0, -current_balance_base)
            cc_owing += owing
            if acc.credit_limit:
                cc_limit_total += convert(acc.credit_limit, acc_currency, base_currency)
        elif acc.is_on_budget:
            on_budget_total += current_balance_base
        else:
            off_budget_total += current_balance_base

    return {
        "on_budget": on_budget_total,
        "off_budget": off_budget_total,
        "total": on_budget_total + off_budget_total,
        "cc_owing": round(cc_owing, 2),
        "cc_limit": round(cc_limit_total, 2),
        "assets_total": 0,
        "liabilities_total": 0,
        "equity_total": 0,
        "net_worth": 0,
        "base_currency": base_currency,
    }


@router.get("/stats")
def get_stats(
    entities: List[EntityType] = Query([...]),
    base_currency: str = Query("AUD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _budget_stats(current_user.id, entities, base_currency, db)


@router.get("/v2/stats")
def get_stats_v2(
    entities: List[EntityType] = Query([...]),
    base_currency: str = Query("AUD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    budget_stats = _budget_stats(current_user.id, entities, base_currency, db)

    assets = (
        db.query(Asset)
        .filter(Asset.user_id == current_user.id, Asset.entity.in_(entities))
        .all()
    )

    assets_val = 0
    liabilities_val = 0
    equity_total = 0

    for a in assets:
        if a.is_liability:
            liabilities_val += a.current_value
        else:
            assets_val += a.current_value
            if a.linked_loan_id:
                loan = (
                    db.query(Asset)
                    .filter(Asset.id == a.linked_loan_id, Asset.user_id == current_user.id)
                    .first()
                )
                if loan:
                    equity_total += a.current_value - loan.current_value

    return {
        **budget_stats,
        "assets_total": assets_val,
        "liabilities_total": liabilities_val,
        "equity_total": equity_total,
        # Net worth = liquid cash + assets − asset liabilities (loans/mortgages) − CC owing
        "net_worth": budget_stats["total"] + assets_val - liabilities_val - budget_stats["cc_owing"],
        "base_currency": budget_stats.get("base_currency", "AUD"),
    }


# ---------------------------------------------------------------------------
# Currency
# ---------------------------------------------------------------------------

@router.get("/currencies")
def get_currencies():
    return {"supported": get_supported_currencies()}


# ---------------------------------------------------------------------------
# Assets
# ---------------------------------------------------------------------------

@router.get("/assets", response_model=List[AssetOut])
def get_assets(
    entities: List[EntityType] = Query([...]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assets = (
        db.query(Asset)
        .filter(Asset.user_id == current_user.id, Asset.entity.in_(entities))
        .all()
    )
    result = []
    for a in assets:
        item = AssetOut.model_validate(a)
        if a.linked_loan_id:
            loan = (
                db.query(Asset)
                .filter(Asset.id == a.linked_loan_id, Asset.user_id == current_user.id)
                .first()
            )
            if loan:
                item.equity = a.current_value - loan.current_value
                item.lvr = (
                    round((loan.current_value / a.current_value) * 100, 1)
                    if a.current_value > 0
                    else None
                )
        result.append(item)
    return result


@router.post("/assets", response_model=AssetOut)
def create_asset(
    asset_data: AssetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_asset = Asset(**asset_data.model_dump(), user_id=current_user.id)
    db_asset.current_value = db_asset.starting_value
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)

    history = AssetValueHistory(
        asset_id=db_asset.id, date=datetime.date.today(), value=db_asset.current_value
    )
    db.add(history)
    db.commit()

    return db_asset


@router.put("/assets/{asset_id}", response_model=AssetOut)
def update_asset(
    asset_id: UUID,
    asset_data: AssetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_asset = (
        db.query(Asset)
        .filter(Asset.id == asset_id, Asset.user_id == current_user.id)
        .first()
    )
    if not db_asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    for key, value in asset_data.model_dump().items():
        setattr(db_asset, key, value)

    db.commit()
    db.refresh(db_asset)
    return db_asset


@router.delete("/assets/{asset_id}")
def delete_asset(
    asset_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_asset = (
        db.query(Asset)
        .filter(Asset.id == asset_id, Asset.user_id == current_user.id)
        .first()
    )
    if not db_asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    db.query(AssetValueHistory).filter(AssetValueHistory.asset_id == asset_id).delete()
    db.delete(db_asset)
    db.commit()
    return {"status": "deleted"}


@router.post("/assets/{asset_id}/value")
def update_asset_value(
    asset_id: UUID,
    update: AssetValueUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset = (
        db.query(Asset)
        .filter(Asset.id == asset_id, Asset.user_id == current_user.id)
        .first()
    )
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    asset.current_value = update.value
    history = AssetValueHistory(asset_id=asset.id, date=update.date, value=update.value)
    db.add(history)
    db.commit()
    return {"status": "updated", "current_value": asset.current_value}


@router.post("/assets/sync-prices")
def sync_stock_prices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assets = (
        db.query(Asset)
        .filter(Asset.user_id == current_user.id, Asset.ticker != None)
        .all()
    )
    updated_count = 0

    for asset in assets:
        new_price = get_stock_price(asset.ticker)
        if new_price is not None:
            asset.current_value = new_price
            history = AssetValueHistory(
                asset_id=asset.id, date=datetime.date.today(), value=new_price
            )
            db.add(history)
            updated_count += 1

    db.commit()
    return {"status": "success", "updated": updated_count}


@router.get("/assets/{asset_id}/projection")
def get_asset_projection(
    asset_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset = (
        db.query(Asset)
        .filter(Asset.id == asset_id, Asset.user_id == current_user.id)
        .first()
    )
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    dummy_req = type("obj", (object,), {"entities": [asset.entity], "horizon_days": 365})
    ledger = generate_forecast(dummy_req, db)
    return calculate_projected_loan_balances(asset, ledger)


# ---------------------------------------------------------------------------
# Device Tokens (push notifications — mobile edition)
# ---------------------------------------------------------------------------

class _DeviceRegisterRequest(_PydBaseModel):
    token: str
    platform: str

@router.post("/devices/register", status_code=204)
def register_device(
    payload: _DeviceRegisterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(DeviceToken).filter(DeviceToken.token == payload.token).first()
    if existing:
        existing.user_id = current_user.id
        existing.platform = payload.platform
    else:
        db.add(DeviceToken(user_id=current_user.id, token=payload.token, platform=payload.platform))
    db.commit()

@router.delete("/devices/unregister/{token}", status_code=204)
def unregister_device(
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(DeviceToken).filter(
        DeviceToken.token == token,
        DeviceToken.user_id == current_user.id,
    ).delete()
    db.commit()
