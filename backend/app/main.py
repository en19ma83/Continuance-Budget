from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import endpoints, recon, auth
from app.database import SessionLocal, engine, Base
from app.models import User, CategoryGroup
from app.api.auth import get_password_hash
import uuid

# Safety net: create any tables not yet handled by migrations (e.g. users)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Budget App API",
    description="Event-Based Perpetual Forecasting Engine API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(endpoints.router, prefix="/api", tags=["ledger"])
app.include_router(recon.router, prefix="/api/recon", tags=["reconciliation"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])

import os
import sys

@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        # Seed admin user
        admin_user = os.getenv("INITIAL_ADMIN_USER", "admin")
        admin_pass = os.getenv("INITIAL_ADMIN_PASS", "admin")
        admin = db.query(User).filter(User.username == admin_user).first()
        if not admin:
            db.add(User(username=admin_user, hashed_password=get_password_hash(admin_pass)))
        else:
            admin.hashed_password = get_password_hash(admin_pass)
        db.commit()

        # Seed categories only if none exist (safe to run on every restart)
        if db.query(CategoryGroup).count() == 0:
            sys.path.insert(0, '/app')
            from seed import seed
            seed()
    finally:
        db.close()

@app.get("/health")
def health_check():
    return {"status": "healthy"}
