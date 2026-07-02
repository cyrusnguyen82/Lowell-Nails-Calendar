"""
server.py — Financial API backend, FastAPI server on port 5002.
The React UI (Vite dev server, port 5300) proxies /api/* here.
"""
import os
import sys

if getattr(sys, "frozen", False):
    # PyInstaller build: routers/ and Financial.tools.* are already bundled inside the
    # executable, so no sys.path setup is needed — only the .env file (external, not code)
    # still needs to be located, and it ships next to the packaged executable.
    BASE_DIR = os.path.dirname(sys.executable)
else:
    sys.path.insert(0, os.path.dirname(__file__))
    ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    if ROOT not in sys.path:
        sys.path.insert(0, ROOT)
    BASE_DIR = ROOT

from dotenv import load_dotenv
load_dotenv(os.path.join(BASE_DIR, ".env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
import uvicorn

from routers.auth_routes import auth_router
from routers.dashboard import dashboard_router
from routers.financial import financial_router
from routers.payroll import payroll_router

app = FastAPI(title="Lowell Nails Financial API", version="1.0")

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("FLASK_SECRET_KEY", os.urandom(32).hex()),
    same_site="lax",
    https_only=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5300", "http://127.0.0.1:5300"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(financial_router, prefix="/api/financial")
app.include_router(payroll_router, prefix="/api/payroll")


@app.get("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=5002)
