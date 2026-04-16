from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List
import pandas as pd
import io
import hashlib
from app.database import get_db
from app.models import StatementTransaction, LedgerEntry, EntityType, LedgerStatus, Category, Account, User
from app.schemas.ledger import StatementTransactionOut, ReconMatchRequest
from app.api.auth import get_current_user
from pydantic import BaseModel
from uuid import UUID

class CreateFromStatementRequest(BaseModel):
    statement_id: UUID
    category_id: UUID
    account_id: UUID

router = APIRouter()

@router.post("/import")
async def import_statement(
    entity: EntityType = Form(...),
    date_col: str = Form("Date"),
    desc_col: str = Form("Description"),
    amount_col: str = Form("Amount"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")
    
    imported_count = 0
    duplicate_count = 0
    
    for _, row in df.iterrows():
        try:
            # Check if columns exist
            if date_col not in row or desc_col not in row or amount_col not in row:
                continue
                
            # Flexible amount parsing (remove symbols/commas)
            raw_amount = str(row[amount_col])
            clean_amount = raw_amount.replace('$', '').replace(',', '').strip()
            amount = float(clean_amount)
            
            description = str(row[desc_col])
            raw_date = str(row[date_col])
            parsed_date = pd.to_datetime(raw_date).date()
            
            # Generate unique hash for duplicate prevention
            raw_string = f"{parsed_date}{amount}{description}{entity}"
            import_hash = hashlib.md5(raw_string.encode()).hexdigest()
            
            # Check for duplicate
            existing = db.query(StatementTransaction).filter(StatementTransaction.import_hash == import_hash).first()
            if existing:
                duplicate_count += 1
                continue
                
            stmt_tx = StatementTransaction(
                date=parsed_date,
                amount=amount,
                description=description,
                entity=entity,
                import_hash=import_hash
            )
            db.add(stmt_tx)
            imported_count += 1
        except Exception:
            continue
            
    db.commit()
    return {"imported": imported_count, "duplicates": duplicate_count}

@router.get("/unmatched", response_model=List[StatementTransactionOut])
def get_unmatched(entity: EntityType, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(StatementTransaction).filter(
        StatementTransaction.entity == entity,
        StatementTransaction.is_reconciled == False
    ).order_by(StatementTransaction.date.desc()).all()

@router.post("/match")
def match_recon(match_data: ReconMatchRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stmt_tx = db.query(StatementTransaction).filter(StatementTransaction.id == match_data.statement_id).first()
    ghost = db.query(LedgerEntry).filter(LedgerEntry.id == match_data.ledger_id).first()
    
    if not stmt_tx or not ghost:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    # Update Ghost to Actual
    ghost.status = LedgerStatus.ACTUAL
    ghost.amount = stmt_tx.amount
    ghost.date = stmt_tx.date
    
    # Mark statement transaction as reconciled
    stmt_tx.is_reconciled = True
    stmt_tx.ledger_entry_id = ghost.id
    
    db.commit()
    return {"status": "success", "ledger_id": ghost.id}

@router.post("/create-from-statement")
def create_from_statement(req: CreateFromStatementRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stmt_tx = db.query(StatementTransaction).filter(StatementTransaction.id == req.statement_id).first()
    if not stmt_tx:
        raise HTTPException(status_code=404, detail="Statement item not found")
        
    # Create the ledger entry
    ledger_entry = LedgerEntry(
        date=stmt_tx.date,
        name=stmt_tx.description,
        amount=stmt_tx.amount,
        status=LedgerStatus.ACTUAL,
        category_id=req.category_id,
        account_id=req.account_id,
    )
    db.add(ledger_entry)
    db.flush() # Get ID
    
    # Mark as reconciled
    stmt_tx.is_reconciled = True
    stmt_tx.ledger_entry_id = ledger_entry.id
    
    db.commit()
    return {"status": "success", "ledger_id": ledger_entry.id}
