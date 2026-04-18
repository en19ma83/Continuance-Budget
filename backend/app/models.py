from sqlalchemy import Column, Integer, String, Float, Date, Enum, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from app.database import Base

class EntityType(str, enum.Enum):
    PERSONAL = "PERSONAL"
    BUSINESS = "BUSINESS"

class FrequencyType(str, enum.Enum):
    WEEKLY = "WEEKLY"
    FORTNIGHTLY = "FORTNIGHTLY"
    MONTHLY_DATE = "MONTHLY_DATE"
    ANNUAL = "ANNUAL"
    ONCE = "ONCE"

class LedgerStatus(str, enum.Enum):
    PROJECTED = "PROJECTED"
    ACTUAL = "ACTUAL"
    PENDING = "PENDING"

class CategoryType(str, enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"
    TRANSFER = "TRANSFER"

class CategoryGroup(Base):
    __tablename__ = "category_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, index=True, nullable=False)
    type = Column(Enum(CategoryType), nullable=False)
    
    categories = relationship("Category", back_populates="group", cascade="all, delete-orphan")

class Category(Base):
    __tablename__ = "categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)
    group_id = Column(UUID(as_uuid=True), ForeignKey("category_groups.id"), nullable=False)
    color = Column(String, nullable=True) # Hex color string for the Calendar UI
    
    group = relationship("CategoryGroup", back_populates="categories")
    rules = relationship("RecurringRule", back_populates="category")
    ledger_entries = relationship("LedgerEntry", back_populates="category")

class AssetType(str, enum.Enum):
    PROPERTY = "PROPERTY"
    STOCK = "STOCK"
    VEHICLE = "VEHICLE"
    LOAN = "LOAN"
    OTHER = "OTHER"

class Asset(Base):
    __tablename__ = "assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    type = Column(Enum(AssetType), nullable=False)
    entity = Column(Enum(EntityType), nullable=False)
    starting_value = Column(Float, default=0.0)
    current_value = Column(Float, default=0.0)
    is_liability = Column(Boolean, default=False) # True for Loans/Debts
    currency = Column(String, default="AUD")
    
    # Amortization & Tickers
    interest_rate = Column(Float, nullable=True) # Percentage (e.g. 5.5)
    term_months = Column(Integer, nullable=True)
    loan_start_date = Column(Date, nullable=True)
    ticker = Column(String, nullable=True)
    
    # Account linkage (which account is this asset tied to, if any)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True)
    
    # Loan-to-Asset linkage: link a property asset to its mortgage liability
    linked_loan_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=True)
    
    account = relationship("Account", foreign_keys=[account_id], back_populates="assets")
    linked_loan = relationship("Asset", foreign_keys=[linked_loan_id], remote_side=lambda: Asset.id)
    history = relationship("AssetValueHistory", back_populates="asset", cascade="all, delete-orphan")
    rules = relationship("RecurringRule", back_populates="asset")
    ledger_entries = relationship("LedgerEntry", back_populates="asset")

class Account(Base):
    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=True) # e.g. "Checking", "Savings"
    entity = Column(Enum(EntityType), nullable=False)
    is_on_budget = Column(Boolean, default=True)
    starting_balance = Column(Float, default=0.0)
    currency = Column(String, default="AUD") # e.g. "AUD", "USD"
    
    rules = relationship("RecurringRule", foreign_keys="RecurringRule.account_id", back_populates="account")
    ledger_entries = relationship("LedgerEntry", foreign_keys="LedgerEntry.account_id", back_populates="account")
    assets = relationship("Asset", foreign_keys="Asset.account_id", back_populates="account")

class RecurringRule(Base):
    __tablename__ = "recurring_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    entity = Column(Enum(EntityType), nullable=False)
    name = Column(String, index=True, nullable=False)
    amount = Column(Float, nullable=False)  # Negative for expense, positive for income
    frequency_type = Column(Enum(FrequencyType), nullable=False)
    frequency_value = Column(Integer, nullable=True)  # e.g., 17 for the 17th of the month
    anchor_date = Column(Date, nullable=False)
    is_tax_deductible = Column(Boolean, default=False)
    currency = Column(String, default="AUD")
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True)
    transfer_to_account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=True)
    
    category = relationship("Category", back_populates="rules")
    account = relationship("Account", foreign_keys=[account_id], back_populates="rules")
    transfer_to_account = relationship("Account", foreign_keys=[transfer_to_account_id])
    asset = relationship("Asset", back_populates="rules")
    ledger_entries = relationship("LedgerEntry", back_populates="rule", cascade="all, delete-orphan")

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    date = Column(Date, nullable=False, index=True)
    name = Column(String, index=True, nullable=True) # Descriptive event name
    amount = Column(Float, nullable=False)
    status = Column(Enum(LedgerStatus), default=LedgerStatus.PROJECTED)
    running_balance = Column(Float, nullable=True)  # Populated via query calculation
    currency = Column(String, default="AUD")
    amount_primary = Column(Float, nullable=True) # Converted to base currency
    rule_id = Column(UUID(as_uuid=True), ForeignKey("recurring_rules.id"), nullable=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=True)

    rule = relationship("RecurringRule", back_populates="ledger_entries")
    account = relationship("Account", back_populates="ledger_entries")
    category = relationship("Category", back_populates="ledger_entries")
    asset = relationship("Asset", back_populates="ledger_entries")

class StatementTransaction(Base):
    __tablename__ = "statement_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    date = Column(Date, nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(String, nullable=False)
    entity = Column(Enum(EntityType), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True)
    is_reconciled = Column(Boolean, default=False)
    ledger_entry_id = Column(UUID(as_uuid=True), ForeignKey("ledger_entries.id"), nullable=True)
    import_hash = Column(String, unique=True, index=True) # Hash for duplicate prevention

    ledger_entry = relationship("LedgerEntry")
    account = relationship("Account")


class AssetValueHistory(Base):
    __tablename__ = "asset_value_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False)
    date = Column(Date, nullable=False)
    value = Column(Float, nullable=False)
    
    asset = relationship("Asset", back_populates="history")

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    device_tokens = relationship("DeviceToken", back_populates="user", cascade="all, delete-orphan")

class DeviceToken(Base):
    __tablename__ = "device_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String, nullable=False, unique=True)
    platform = Column(String, nullable=False)  # 'ios' | 'android'
    created_at = Column(String, nullable=True)

    user = relationship("User", back_populates="device_tokens")
