"""
auth.py — Authentication and module access control for the Financial API.

Same bcrypt hashing as BusinessOS/core/auth.py; session storage moves from
Flask's `session` to Starlette's SessionMiddleware (signed cookie, same
FLASK_SECRET_KEY from .env).
"""
import bcrypt
from fastapi import Request, HTTPException

from db import get_db, get_active_modules


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def require_login(request: Request) -> dict:
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "user_id": user_id,
        "company_id": request.session.get("company_id") or 1,
        "username": request.session.get("username"),
        "role": request.session.get("role"),
    }


def check_module(request: Request, module_name: str):
    company_id = request.session.get("company_id") or 1
    conn = get_db(); cur = conn.cursor()
    modules = get_active_modules(cur, company_id)
    cur.close(); conn.close()
    if not modules:
        modules = {"payroll", "timeclock", "financial", "marketing"}
    if module_name not in modules:
        raise HTTPException(status_code=403, detail=f"Module '{module_name}' not enabled")
