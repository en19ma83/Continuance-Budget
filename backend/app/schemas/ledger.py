from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from uuid import UUID
import enum
from app.models import EntityType, FrequencyType, LedgerStatus, AssetType, GstTreatment

class RecurringRuleBase(BaseModel):
    entity: EntityType
    name: str
    amount: float
    frequency_type: FrequencyType
    frequency_value: Optional[int] = None
    anchor_date: date
    is_tax_deductible: bool = False
    gst_treatment: Optional[GstTreatment] = GstTreatment.N_A
    category_id: Optional[UUID] = None
    account_id: Optional[UUID] = None
    transfer_to_account_id: Optional[UUID] = None
    asset_id: Optional[UUID] = None

class RecurringRuleCreate(RecurringRuleBase):
    pass

class RecurringRuleOut(RecurringRuleBase):
    id: UUID

    class Config:
        from_attributes = True

class LedgerEntryBase(BaseModel):
    date: date
    name: Optional[str] = None
    amount: float
    status: LedgerStatus
    account_id: Optional[UUID] = None

class LedgerEntryCreate(LedgerEntryBase):
    rule_id: Optional[UUID] = None

class LedgerEntryOut(LedgerEntryBase):
    id: UUID
    rule_id: Optional[UUID] = None
    running_balance: Optional[float] = None
    category_id: Optional[UUID] = None
    category_color: Optional[str] = None
    category_name: Optional[str] = None
    entity: Optional[EntityType] = None
    gst_treatment: Optional[GstTreatment] = None

    class Config:
        from_attributes = True

# Used for the match endpoint
class MatchTransactionRequest(BaseModel):
    actual_amount: float
    actual_date: date

class CategoryBase(BaseModel):
    name: str
    color: Optional[str] = None
    group_id: UUID

class CategoryCreate(CategoryBase):
    pass

class CategoryOut(CategoryBase):
    id: UUID

    class Config:
        from_attributes = True

class CategoryGroupBase(BaseModel):
    name: str
    type: str

class CategoryGroupCreate(CategoryGroupBase):
    pass

class CategoryGroupOut(CategoryGroupBase):
    id: UUID
    categories: List[CategoryOut] = []

    class Config:
        from_attributes = True

class StatementTransactionOut(BaseModel):
    id: UUID
    date: date
    amount: float
    description: str
    entity: EntityType
    is_reconciled: bool
    import_hash: str

    class Config:
        from_attributes = True

class ReconMatchRequest(BaseModel):
    statement_id: UUID
    ledger_id: UUID

class AccountBase(BaseModel):
    name: str
    type: Optional[str] = None
    entity: EntityType
    is_on_budget: bool = True
    starting_balance: float = 0.0
    # Credit card fields (nullable — only relevant when type == 'Credit Card')
    credit_limit: Optional[float] = None
    balance_tracking_method: Optional[str] = None  # 'LIMIT_REMAINING' | 'AMOUNT_OWING'
    statement_date: Optional[int] = None            # Day of month 1-31
    statement_due_days: Optional[int] = None        # Days after statement close until payment due

class AccountCreate(AccountBase):
    pass

class AccountOut(AccountBase):
    id: UUID

    class Config:
        from_attributes = True

class AssetBase(BaseModel):
    name: str
    type: AssetType
    entity: EntityType
    starting_value: float = 0.0
    current_value: float = 0.0
    is_liability: bool = False
    interest_rate: Optional[float] = None
    term_months: Optional[int] = None
    loan_start_date: Optional[date] = None
    ticker: Optional[str] = None
    account_id: Optional[UUID] = None
    linked_loan_id: Optional[UUID] = None  # For a property: link to its mortgage

class AssetCreate(AssetBase):
    pass

class AssetOut(AssetBase):
    id: UUID
    equity: Optional[float] = None       # Computed: current_value - linked_loan.current_value
    lvr: Optional[float] = None          # Computed: (loan / value) * 100

    class Config:
        from_attributes = True

class AssetValueUpdate(BaseModel):
    date: date
    value: float
