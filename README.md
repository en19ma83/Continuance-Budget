# Continuance Finance: Perpetual Forecasting Budget App

A premium, agent-built financial engine designed for dual Business/Personal budgeting with a focus on liquidity forecasting, statement reconciliation, and full net-worth analysis.

![Dashboard Preview](brain/99c5f2fc-c895-4f3c-ab67-f38b3aba508f/media__1776131365321.png)

## Core Philosophy
Most budget apps tell you where your money *went*. **Continuance** tells you where your money *is going*. By treating every future recurring bill as a "Ghost" entry in a perpetual ledger, it provides a daily running balance that reaches into the infinite future, allowing you to make spending decisions today based on your liquidity in 6 months.

## Feature Overview

### 1. Perpetual Forecasting Ledger
- **Ghost Transactions**: Every recurring rule (Rent, AWS, Paychecks) generates future-dated ledger entries.
- **Dynamic Running Balance**: See exactly how much cash you'll have on any specific date in the next 18 months.
- **Descriptive Timeline**: Entries prioritized by Event Name (e.g., "Netflix", "Rent") for instant recognition.

### 2. Multi-Currency Support
- **Global Context**: Set a global Base Currency (e.g., AUD) while managing accounts in others (USD, EUR).
- **Auto-Conversion**: Dashboard stats (Liquidity, Net Worth) automatically convert balances using real-time exchange rates.
- **Tick-Aware**: Handles specific settlement rates for individual transactions.

### 3. Integrated Asset & Loan Management
- **Linked Mortgages**: Track property/vehicle value alongside its linked loan. The system automatically calculates LVR (Loan to Value Ratio) and Equity.
- **Smart Repayments**: When you log a loan repayment, it automatically updates the remaining debt balance.
- **Stock Tracking**: Real-time stock price integration for equity assets.

### 4. Zero-Friction Reconciliation
- **Statement Staging**: Import bank CSVs into a staging area.
- **Smart Matching**: Automated suggestions match statement items to projected "Ghost" entries based on amount and date proximity.
- **Quick-Categorize**: Instantly convert unmatched bank items into categorized ledger entries (Refunds, unexpected expenses).
- **Auto-Signage**: Intelligent form that automatically handles positive/negative signs based on category type.

### 5. Setup & Customization
- **Full CRUD**: Manage accounts, assets, and categories with a clean, inline interface.
- **Dual Entity**: Toggle between Personal, Business, or Combined views instantly.

## Technology Stack
- **Backend**: FastAPI (Python 3.11), SQLAlchemy 2.0, PostgreSQL 15.
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons.
- **Logic Engines**: custom DateUtil rrule forecasting, amortization calculators, and a daily currency cache.
- **Deployment**: Docker & Docker Compose.

## Installation & Setup

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- (Optional) An API Key from [ExchangeRate-API](https://www.exchangerate-api.com/) for live currency conversion.

### Quick Start
1. **Clone the repository**:
   ```bash
   git clone https://github.com/en19ma83/Continuance-Budget.git
   cd Continuance-Budget
   ```

2. **Configure (Optional)**:
   - Open `backend/app/engine/currency.py` and add your `API_KEY` for live rates. If skipped, the system uses 1:1 fallback rates.

3. **Launch the stack**:
   ```bash
   docker compose up -d --build
   ```

4. **Access & Login**:
   - Open your browser to: `http://localhost:3000`
   - **Default Credentials**: `admin` / `admin`

### API Documentation
Once the backend is running, you can explore the interactive API docs at:
- Swagger UI: `http://localhost:8000/docs`
- Redoc: `http://localhost:8000/redoc`

## Project Structure
- **/frontend**: React (Vite) application with a premium Glassmorphism design system.
- **/backend**: FastAPI application with a custom event-based forecasting engine.
- **/docker-compose.yml**: Production-ready orchestration for the app and its PostgreSQL database.

---
Development of this project is driven by **Antigravity**, an agentic coding assistant by Google Deepmind.
