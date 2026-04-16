# Continuance Finance — Perpetual Forecasting Engine

A self-hosted, multi-user financial engine built for dual Business/Personal budgeting with a focus on liquidity forecasting, statement reconciliation, and full net-worth analysis.

## Core Philosophy

Most budget apps tell you where your money *went*. **Continuance** tells you where your money *is going*. Every recurring rule (rent, paychecks, subscriptions) generates future-dated "Ghost" entries in a perpetual ledger, producing a live running balance that reaches 18 months ahead — so you make spending decisions today based on your liquidity in 6 months.

---

## Feature Overview

### 1. Perpetual Forecasting Ledger
- **Ghost Transactions** — Recurring rules auto-generate projected ledger entries 18 months forward.
- **Dynamic Running Balance** — See your exact cash position on any future date.
- **Timeline & Calendar Views** — Switch between a vertical timeline and a month-grid calendar with prev/next navigation.
- **Cash Flow Horizon Card** — At-a-glance projected balances at 1 month, 3 months, 6 months, and 12 months, plus a custom date picker. Each horizon shows the delta vs today.

### 2. Multi-User Registration & Isolation
- **Self-Registration** — Users register via the UI with a username (and optional email). Passwords must be 8–16 characters with upper, lower, number, and special character requirements.
- **Complete Data Isolation** — Every account, rule, ledger entry, and asset is scoped to the creating user via UUID. No data bleed between users.
- **JWT Authentication** — Tokens are issued on login and expire after 1 week.

### 3. Multi-Currency Support
- **Global Base Currency** — Set a display currency (e.g. AUD) while individual accounts are denominated in others (USD, EUR, SGD, etc.).
- **Auto-Conversion** — Dashboard stats convert balances using real-time exchange rates via ExchangeRate-API.
- **Per-Account Currency** — Each account tracks its own denomination.

### 4. Integrated Asset & Loan Management
- **Linked Pairs** — Connect a property or vehicle to its mortgage/loan. The dashboard calculates LVR (Loan-to-Value Ratio) and equity automatically.
- **Visual Connector** — Linked asset+loan pairs are displayed inside a shared bracket with a "Linked" indicator so the relationship is immediately visible.
- **Smart Repayments** — Logging a loan repayment automatically reduces the outstanding principal.
- **Stock Tracking** — Live stock price integration for equity assets via ticker symbol.

### 5. Zero-Friction Reconciliation
- **Statement Import** — Upload bank CSVs into a staging area.
- **Smart Matching** — Automated suggestions match statement rows to Ghost entries by amount and date proximity.
- **Quick-Categorise** — Convert unmatched transactions into categorised actual entries instantly.
- **Auto-Signage** — Form automatically assigns positive/negative sign based on category type (Income vs Expense).

### 6. Setup & Customisation
- **Full CRUD** — Create, edit, and delete accounts, assets, liabilities, and recurring rules.
- **Dual Entity** — Toggle between Personal, Business, or Combined views.
- **Auto-Seeded Categories** — A full chart of accounts (Fixed, Discretionary, Giving, Income, Transfer) is seeded automatically on first boot.
- **VS Code-Inspired Theme** — Dark mode uses the VS Code editor palette (`#1e1e1e` / `#2d2d30` / `#3c3c3c`); light mode uses VS Code light. Both modes are fully supported.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python 3.11), SQLAlchemy 2.0, Alembic, PostgreSQL 15 |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS v3, Lucide Icons |
| Auth | JWT (python-jose), bcrypt (passlib) |
| Engines | Custom rrule forecasting, amortization calculator, currency cache, Yahoo Finance stock prices |
| Deployment | Docker, Docker Compose (v1 and v2 compatible) |

---

## Deployment

### Prerequisites
- Docker + Docker Compose (`docker-compose` v1.29+ **or** `docker compose` v2)
- *(Optional)* An API key from [ExchangeRate-API](https://www.exchangerate-api.com/) for live currency rates

> **Proxmox LXC / lightweight Linux note:** The stack is tested and working on docker-compose 1.29.2 + Docker Engine 25+ on Ubuntu LXC containers.

### Quick Start (no configuration required)

```bash
# 1. Clone
git clone https://github.com/en19ma83/Continuance-Budget.git
cd Continuance-Budget

# 2. Launch (uses default credentials out of the box)
docker-compose up -d --build

# 3. Open the app
#    http://localhost:3000
```

On first boot the backend will:
1. Wait for PostgreSQL to be ready
2. Run all Alembic migrations automatically
3. Seed the default admin user (`admin` / `admin`)
4. Seed the full category chart of accounts

### Register Your Account

Navigate to `http://localhost:3000` and use the **Register** tab to create your account. Password requirements: 8–16 characters, must include uppercase, lowercase, number, and special character.

The seeded `admin` / `admin` account can be used for initial access if preferred.

### Environment Variables (optional)

To customise credentials or add live currency rates, create a `.env` file in the project root before running `docker-compose up`:

```env
# Database
POSTGRES_USER=budget_user
POSTGRES_PASSWORD=budget_password
POSTGRES_DB=budget_app

# JWT signing key (generated automatically if omitted)
SECRET_KEY=your-secret-here

# Initial admin user (seeded on first boot)
INITIAL_ADMIN_USER=admin
INITIAL_ADMIN_PASS=admin

# ExchangeRate-API key (optional — falls back to 1:1 rates if omitted)
CURRENCY_API_KEY=your-key-here
```

Or run the interactive setup script:
```bash
bash setup.sh
docker-compose up -d --build
```

### Resetting the Database

```bash
docker-compose down -v   # -v removes the pgdata volume
docker-compose up -d --build
```

### API Documentation

With the backend running:
- Swagger UI: `http://localhost:8000/docs`
- Redoc: `http://localhost:8000/redoc`

---

## Project Structure

```
Continuance-Budget/
├── docker-compose.yml          # Service orchestration (db, backend, frontend, pgadmin)
├── setup.sh                    # Interactive first-run credential setup
├── rebuild.sh                  # git pull + rebuild shortcut
├── backend/
│   ├── Dockerfile              # python:3.11-slim; runs migrations then uvicorn
│   ├── wait_for_db.py          # Retries DB connection before starting (solves race condition)
│   ├── seed.py                 # Category chart-of-accounts seeder
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # FastAPI app + startup seeding
│       ├── models.py           # SQLAlchemy ORM (User, Account, Asset, Rule, Ledger, …)
│       ├── api/
│       │   ├── auth.py         # JWT login + registration + password validation
│       │   └── endpoints.py    # All CRUD endpoints (user-scoped)
│       └── engine/
│           ├── forecast.py     # Perpetual ledger generation
│           ├── amortization.py # Loan projection engine
│           ├── currency.py     # Exchange rate cache
│           └── stocks.py       # Live stock price fetch
└── frontend/
    ├── Dockerfile              # Multi-stage: node:20 build → nginx:stable serve
    ├── nginx.conf              # Reverse-proxies /api/* to backend:8000
    └── src/
        ├── App.tsx             # Root shell + stats cards + Cash Flow Horizons
        └── components/
            ├── Login.tsx           # Sign In / Register with live password validation
            ├── CashFlowHorizons.tsx # 1M/3M/6M/12M/custom forecast landmarks
            ├── CalendarView.tsx    # Month-grid calendar with navigation
            ├── TimelineView.tsx    # Vertical ledger timeline
            ├── RuleForm.tsx        # Recurring rule creation form
            ├── ReconciliationCenter.tsx
            ├── ImportWizard.tsx
            └── setup/
                ├── SetupPanel.tsx
                └── AssetManager.tsx  # Asset+loan linked-pair visual grouping
```

---

## Security Notes

- PgAdmin is exposed on port `5050` with default credentials — **do not expose this port publicly** in production.
- `CORS allow_origins: ["*"]` is set for development convenience — restrict to your domain in production.
- All API endpoints are authenticated; data is strictly scoped per user.

---

## Roadmap

This is the **Community Edition** — free, open source, and self-hosted forever.

Two additional tiers are in planning:

### Mobile Edition
A free companion app (iOS + Android) built with Expo / React Native, pointing to your own self-hosted Community backend. Includes the dashboard, perpetual ledger, cash flow horizons, and a quick-add transaction flow. Statement import is desktop-only and excluded from mobile.

### Pro Edition *(paid SaaS)*
An AI-first managed version with:
- **Google Vertex AI (Gemini 2.5 Flash)** — automatic transaction categorisation, natural language financial Q&A, anomaly detection, and monthly cash flow narratives
- **Open Banking / CDR feed** — live bank transaction feeds via an accredited aggregator (no manual CSV import required)
- **Linked mobile app** — full feature set including AI Insights tab, connected to the managed Pro backend
- **Multi-seat plans** — Personal, Family, and Business tiers with Stripe billing

---

*Built with [Claude Code](https://claude.ai/code) by Anthropic.*
