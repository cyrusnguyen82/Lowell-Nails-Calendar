"""
auth.py — Authentication and module access control for BusinessOS
"""
import bcrypt
from functools import wraps
from flask import session, redirect, url_for, abort
from BusinessOS.core.db import get_db, get_active_modules


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("user_id"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


def module_required(module_name: str):
    """Decorator that checks if a module is licensed/enabled."""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not session.get("user_id"):
                return redirect(url_for("login"))
            company_id = session.get("company_id") or 1
            conn = get_db()
            cur  = conn.cursor()
            modules = get_active_modules(cur, company_id)
            cur.close(); conn.close()
            if module_name not in modules:
                abort(403)
            return f(*args, **kwargs)
        return decorated
    return decorator


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def get_current_user(cur) -> dict | None:
    uid = session.get("user_id")
    if not uid:
        return None
    cur.execute("SELECT id, username, role, email FROM bos_users WHERE id = %s", (uid,))
    row = cur.fetchone()
    return dict(row) if row else None
