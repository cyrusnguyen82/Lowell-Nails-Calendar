"""
auth_routes.py — Login / logout / current-user session endpoints.
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

from db import get_db, get_company, get_active_modules
from auth import verify_password

auth_router = APIRouter(tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@auth_router.post("/login")
def login(req: LoginRequest, request: Request):
    conn = get_db(); cur = conn.cursor()
    cur.execute(
        "SELECT id, company_id, password_hash, role FROM bos_users WHERE username=%s",
        (req.username,)
    )
    user = cur.fetchone()
    cur.close(); conn.close()

    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    request.session["user_id"] = user["id"]
    request.session["company_id"] = user["company_id"]
    request.session["role"] = user["role"]
    request.session["username"] = req.username
    return {"success": True, "username": req.username, "role": user["role"]}


@auth_router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"success": True}


@auth_router.get("/me")
def me(request: Request):
    if not request.session.get("user_id"):
        raise HTTPException(status_code=401, detail="Not authenticated")

    conn = get_db(); cur = conn.cursor()
    company = get_company(cur)
    modules = get_active_modules(cur, request.session.get("company_id") or 1)
    cur.close(); conn.close()

    return {
        "username": request.session.get("username"),
        "role": request.session.get("role"),
        "company": company,
        "modules": sorted(modules) if modules else ["payroll", "financial"],
    }
