"""Core utilities: config, db, auth, storage, websocket manager, helpers."""
import os
import uuid
import jwt
import bcrypt
import requests
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict
from dotenv import load_dotenv
from fastapi import HTTPException, Request, WebSocket
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger("teamdash")

# ---- DB ----
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---- Config ----
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
APP_NAME = "teamdash"

# ---- Time ----
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def new_id() -> str:
    return str(uuid.uuid4())

# ---- Password ----
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

# ---- JWT ----
def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

def _extract_token(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return request.cookies.get("access_token")

def public_user(u: dict) -> dict:
    if not u:
        return u
    u.pop("_id", None)
    u.pop("password_hash", None)
    return u

async def get_current_user(request: Request) -> dict:
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user.pop("password_hash", None)
    return user

async def user_from_token(token: str) -> Optional[dict]:
    try:
        payload = decode_token(token)
        return await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    except Exception:
        return None

# ---- Membership / permissions ----
DEFAULT_PERMISSIONS = {
    "can_view_shared_content": True,
    "can_upload_shared_content": True,
    "can_manage_join_requests": False,
    "can_delete_shared_content": False,
    "can_invite_members": False,
    "can_manage_permissions": False,
}

ADMIN_PERMISSIONS = {k: True for k in DEFAULT_PERMISSIONS}

async def get_membership(org_id: str, user_id: str) -> Optional[dict]:
    return await db.members.find_one(
        {"org_id": org_id, "user_id": user_id, "status": "active"}, {"_id": 0}
    )

async def require_membership(org_id: str, user_id: str) -> dict:
    m = await get_membership(org_id, user_id)
    if not m:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    return m

async def is_admin(org_id: str, user_id: str) -> bool:
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    return bool(org and org.get("admin_id") == user_id)

async def has_permission(org_id: str, user_id: str, perm: str) -> bool:
    if await is_admin(org_id, user_id):
        return True
    m = await get_membership(org_id, user_id)
    if not m:
        return False
    return bool(m.get("permissions", {}).get(perm, DEFAULT_PERMISSIONS.get(perm, False)))

# ---- Object storage ----
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
_storage_key = None

def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ---- WebSocket manager ----
class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, List[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(user_id, []).append(ws)

    def disconnect(self, user_id: str, ws: WebSocket):
        conns = self.active.get(user_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self.active.pop(user_id, None)

    async def send_to_user(self, user_id: str, message: dict):
        for ws in list(self.active.get(user_id, [])):
            try:
                await ws.send_json(message)
            except Exception:
                pass

    async def send_to_users(self, user_ids: List[str], message: dict):
        for uid in set(user_ids):
            await self.send_to_user(uid, message)

manager = ConnectionManager()

# ---- Activity + Notifications ----
async def log_activity(org_id: str, actor_id: str, action: str, target_type: str, target_id: str, private: bool = False):
    entry = {
        "id": new_id(), "org_id": org_id, "actor_id": actor_id, "action": action,
        "target_type": target_type, "target_id": target_id, "private": private,
        "created_at": now_iso(),
    }
    await db.activity_logs.insert_one(dict(entry))
    entry.pop("_id", None)
    if not private:
        members = await db.members.find({"org_id": org_id, "status": "active"}, {"_id": 0, "user_id": 1}).to_list(1000)
        actor = await db.users.find_one({"id": actor_id}, {"_id": 0, "password_hash": 0})
        payload = {"kind": "activity", "activity": entry, "actor": public_user(actor or {})}
        await manager.send_to_users([m["user_id"] for m in members if m["user_id"] != actor_id], payload)
    return entry

async def create_notification(org_id: str, user_id: str, ntype: str, source_type: str, source_id: str, actor_id: str):
    if user_id == actor_id:
        return None
    notif = {
        "id": new_id(), "org_id": org_id, "user_id": user_id, "type": ntype,
        "source_type": source_type, "source_id": source_id, "actor_id": actor_id,
        "read": False, "created_at": now_iso(),
    }
    await db.notifications.insert_one(dict(notif))
    notif.pop("_id", None)
    actor = await db.users.find_one({"id": actor_id}, {"_id": 0, "password_hash": 0})
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0, "name": 1})
    await manager.send_to_user(user_id, {
        "kind": "notification", "notification": notif,
        "actor": public_user(actor or {}), "org_name": (org or {}).get("name", ""),
    })
    return notif

import re
MENTION_RE = re.compile(r"@([a-zA-Z0-9_]+)")

async def parse_mentions(org_id: str, text: str):
    """Return (mentioned_user_ids, is_team_mention)."""
    if not text:
        return [], False
    tokens = MENTION_RE.findall(text)
    is_team = "team" in [t.lower() for t in tokens]
    mentioned = []
    if is_team:
        members = await db.members.find({"org_id": org_id, "status": "active"}, {"_id": 0, "user_id": 1}).to_list(1000)
        mentioned = [m["user_id"] for m in members]
    else:
        for tok in tokens:
            u = await db.users.find_one({"username": tok.lower()}, {"_id": 0, "id": 1})
            if u:
                m = await get_membership(org_id, u["id"])
                if m:
                    mentioned.append(u["id"])
    return list(set(mentioned)), is_team
