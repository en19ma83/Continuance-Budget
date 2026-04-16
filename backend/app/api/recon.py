from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List
import pandas as pd
import io
import hashlib
from uuid import UUID

from app.database import get_db
from app.models import StatementTransaction, LedgerEntry, EntityType, LedgerStatus, Account, User
from app.schemas.ledger import StatementTransactionOut, ReconMatchRequest
from app.api.auth import get_current_user
from pydantic import BaseModel

router = APIRouter()


class CreateFromStatementRequest(BaseModel):
    statement_id: UUID
    category_id: UUID
    account_id: UUID


def _clean_amount(raw: str) -> float | None:
    """Strip currency symbols, commas, whitespace; return float or None."""
    clean = str(raw).replace('$', '').replace(',', '').strip()
    if not clean or clean.lower() == 'nan':
        return None
    try:
        return float(clean)
    except ValueError:
        return None


@router.post("/import")
async def import_statement(
    entity: EntityType = Form(...),
    account_id: str = Form(...),
    date_col: str = Form("Date"),
    desc_col: str = Form("Description"),
    amount_mode: str = Form("single"),   # "single" | "split"
    amount_col: str = Form(""),          # used when amount_mode == "single"
    debit_col: str = Form(""),           # used when amount_mode == "split"
    credit_col: str = Form(""),          # used when amount_mode == "split"
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate account ownership
    try:
        acc_uuid = UUID(account_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid account_id")
    account = db.query(Account).filter(Account.id == acc_uuid, Account.user_id == current_user.id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {e}")

    # Normalise column names (strip surrounding whitespace)
    df.columns = [c.strip() for c in df.columns]

    imported_count = 0
    duplicate_count = 0

    for _, row in df.iterrows():
        try:
            if date_col not in row or desc_col not in row:
                continue

            # ── Amount resolution ────────────────────────────────────────────
            if amount_mode == "split":
                debit_val  = _clean_amount(str(row.get(debit_col,  "")))
                credit_val = _clean_amount(str(row.get(credit_col, "")))
                if debit_val is None and credit_val is None:
                    continue
                # Credit = money in (positive), Debit = money out (negative net)
                amount = (credit_val or 0.0) - (debit_val or 0.0)
            else:
                if amount_col not in row:
                    continue
                amount = _clean_amount(str(row[amount_col]))
                if amount is None:
                    continue

            description = str(row[desc_col]).strip()
            parsed_date = pd.to_datetime(str(row[date_col]), dayfirst=True).date()

            # ── Deduplication hash (scoped per user) ─────────────────────────
            raw_string = f"{parsed_date}{amount}{description}{entity}{current_user.id}"
            import_hash = hashlib.md5(raw_string.encode()).hexdigest()

            if db.query(StatementTransaction).filter(StatementTransaction.import_hash == import_hash).first():
                duplicate_count += 1
                continue

            db.add(StatementTransaction(
                date=parsed_date,
                amount=amount,
                description=description,
                entity=entity,
                account_id=acc_uuid,
                user_id=current_user.id,
                import_hash=import_hash,
            ))
            imported_count += 1

        except Exception:
            continue

    db.commit()
    return {"imported": imported_count, "duplicates": duplicate_count}


@router.get("/unmatched", response_model=List[StatementTransactionOut])
def get_unmatched(
    entity: EntityType,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(StatementTransaction)
        .filter(
            StatementTransaction.user_id == current_user.id,
            StatementTransaction.entity == entity,
            StatementTransaction.is_reconciled == False,  # noqa: E712
        )
        .order_by(StatementTransaction.date.desc())
        .all()
    )


@router.post("/match")
def match_recon(
    match_data: ReconMatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt_tx = db.query(StatementTransaction).filter(
        StatementTransaction.id == match_data.statement_id,
        StatementTransaction.user_id == current_user.id,
    ).first()
    ghost = db.query(LedgerEntry).filter(
        LedgerEntry.id == match_data.ledger_id,
        LedgerEntry.user_id == current_user.id,
    ).first()

    if not stmt_tx or not ghost:
        raise HTTPException(status_code=404, detail="Transaction not found")

    ghost.status = LedgerStatus.ACTUAL
    ghost.amount = stmt_tx.amount
    ghost.date = stmt_tx.date

    stmt_tx.is_reconciled = True
    stmt_tx.ledger_entry_id = ghost.id

    db.commit()
    return {"status": "success", "ledger_id": ghost.id}


@router.post("/create-from-statement")
def create_from_statement(
    req: CreateFromStatementRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt_tx = db.query(StatementTransaction).filter(
        StatementTransaction.id == req.statement_id,
        StatementTransaction.user_id == current_user.id,
    ).first()
    if not stmt_tx:
        raise HTTPException(status_code=404, detail="Statement item not found")

    ledger_entry = LedgerEntry(
        date=stmt_tx.date,
        name=stmt_tx.description,
        amount=stmt_tx.amount,
        status=LedgerStatus.ACTUAL,
        category_id=req.category_id,
        account_id=req.account_id,
        user_id=current_user.id,
    )
    db.add(ledger_entry)
    db.flush()

    stmt_tx.is_reconciled = True
    stmt_tx.ledger_entry_id = ledger_entry.id

    db.commit()
    return {"status": "success", "ledger_id": ledger_entry.id}
