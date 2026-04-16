from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
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
from app.models import CategoryGroup, Category, Account, Asset, AssetValueHistory, AssetType
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    active_accounts = (
        db.query(Account)
        .filter(
            Account.user_id == current_user.id,
            Account.entity.in_(entities),
            Account.is_on_budget == True,
        )
        .all()
    )
    account_ids = [a.id for a in active_accounts]
    total_starting_balance = sum(a.starting_balance for a in active_accounts)

    balance_calc = (
        func.sum(LedgerEntry.amount).over(order_by=(LedgerEntry.date, LedgerEntry.id))
        + total_starting_balance
    ).label("running_balance")

    query = (
        db.query(LedgerEntry, Account.entity, balance_calc)
        .join(Account, LedgerEntry.account_id == Account.id)
        .filter(LedgerEntry.user_id == current_user.id, LedgerEntry.account_id.in_(account_ids))
        .order_by(LedgerEntry.date, LedgerEntry.id)
        .all()
    )

    categories = {str(c.id): c for c in db.query(Category).all()}

    results = []
    for entry, ent, bal in query:
        entry.running_balance = bal
        entry.entity = ent
        if entry.category_id and str(entry.category_id) in categories:
            entry.category_color = categories[str(entry.category_id)].color
            entry.category_name = categories[str(entry.category_id)].name
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


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

def _budget_stats(user_id, entities, base_currency, db):
    accounts = (
        db.query(Account)
        .filter(Account.user_id == user_id, Account.entity.in_(entities))
        .all()
    )
    on_budget_total = 0
    off_budget_total = 0

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

        if acc.is_on_budget:
            on_budget_total += current_balance_base
        else:
            off_budget_total += current_balance_base

    return {
        "on_budget": on_budget_total,
        "off_budget": off_budget_total,
        "total": on_budget_total + off_budget_total,
        "assets_total": 0,
        "liabilities_total": 0,
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
        "net_worth": budget_stats["total"] + assets_val - liabilities_val,
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
