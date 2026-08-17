"""Team Dashboard & Notes Platform - API server."""
import logging
from typing import Optional, List
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, UploadFile, File, Form, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import Response as FastResponse
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import os

from core import (
    db, logger, new_id, now_iso, hash_password, verify_password, create_token,
    get_current_user, user_from_token, public_user, DEFAULT_PERMISSIONS, ADMIN_PERMISSIONS,
    get_membership, require_membership, is_admin, has_permission,
    init_storage, put_object, get_object, APP_NAME, manager,
    log_activity, create_notification, parse_mentions,
)

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="TeamDash API")
api = APIRouter(prefix="/api")

@api.get("/")
async def health():
    return {"status": "ok", "service": "teamdash"}

# ============ MODELS ============
class RegisterReq(BaseModel):
    name: str
    email: EmailStr
    password: str
    username: Optional[str] = None

class LoginReq(BaseModel):
    identifier: str  # email or username
    password: str

class OrgCreateReq(BaseModel):
    name: str

class InviteReq(BaseModel):
    max_uses: int = 100

class InviteEmailReq(BaseModel):
    email: EmailStr

class PermUpdateReq(BaseModel):
    permissions: dict

class NoteReq(BaseModel):
    title: Optional[str] = "Untitled"
    content: Optional[str] = ""
    drawing_data: Optional[str] = None
    visibility: Optional[str] = "private"
    folder_id: Optional[str] = None
    caption: Optional[str] = ""

class FolderReq(BaseModel):
    name: str
    type: str = "notes"

class ChatSendReq(BaseModel):
    channel: str
    content: str

class ProfileReq(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    phone_number: Optional[str] = None
    avatar_url: Optional[str] = None
    email_visibility: Optional[str] = None
    phone_visibility: Optional[str] = None

class PasswordReq(BaseModel):
    current_password: str
    new_password: str

class AppearanceReq(BaseModel):
    background_type: Optional[str] = None
    background_value: Optional[str] = None
    window_outline_color: Optional[str] = None
    window_outline_width: Optional[int] = None
    text_size: Optional[str] = None
    text_color: Optional[str] = None
    auto_adapt_text: Optional[bool] = None

class LayoutItem(BaseModel):
    id: Optional[str] = None
    content_type: str
    content_id: Optional[str] = None
    x: float
    y: float
    width: float
    height: float
    z_index: int = 1

class LayoutSaveReq(BaseModel):
    items: List[LayoutItem]

class VisibilityReq(BaseModel):
    visibility: str

# ============ AUTH ============
@api.post("/auth/register")
async def register(req: RegisterReq, response: Response):
    email = req.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    username = (req.username or "").lower().strip() or None
    if username and await db.users.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="Username already taken")
    user = {
        "id": new_id(), "name": req.name, "email": email, "username": username,
        "phone_number": None, "password_hash": hash_password(req.password),
        "avatar_url": None, "last_active_org_id": None,
        "email_visibility": "private", "phone_visibility": "private",
        "created_at": now_iso(),
    }
    await db.users.insert_one(dict(user))
    token = create_token(user["id"])
    return {"token": token, "user": public_user(user)}

@api.post("/auth/login")
async def login(req: LoginReq):
    ident = req.identifier.lower().strip()
    user = await db.users.find_one({"$or": [{"email": ident}, {"username": ident}]})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"])
    return {"token": token, "user": public_user(user)}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api.post("/auth/logout")
async def logout():
    return {"ok": True}

# ============ ORGANIZATIONS ============
async def org_summary(org: dict, user_id: str) -> dict:
    member_count = await db.members.count_documents({"org_id": org["id"], "status": "active"})
    admin = await is_admin(org["id"], user_id)
    m = await get_membership(org["id"], user_id)
    perms = ADMIN_PERMISSIONS if admin else (m or {}).get("permissions", DEFAULT_PERMISSIONS)
    return {
        "id": org["id"], "name": org["name"], "admin_id": org["admin_id"],
        "default_visibility": org.get("default_visibility", "private"),
        "logo_url": org.get("logo_url"),
        "member_count": member_count, "is_admin": admin, "permissions": perms,
    }

@api.post("/orgs")
async def create_org(req: OrgCreateReq, user: dict = Depends(get_current_user)):
    org = {"id": new_id(), "name": req.name, "admin_id": user["id"],
           "default_visibility": "private", "created_at": now_iso()}
    await db.organizations.insert_one(dict(org))
    await db.members.insert_one({
        "id": new_id(), "org_id": org["id"], "user_id": user["id"],
        "default_visibility": "private", "status": "active",
        "permissions": dict(DEFAULT_PERMISSIONS), "created_at": now_iso(),
    })
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_active_org_id": org["id"]}})
    return await org_summary(org, user["id"])

@api.get("/orgs")
async def list_orgs(user: dict = Depends(get_current_user)):
    memberships = await db.members.find({"user_id": user["id"], "status": "active"}, {"_id": 0}).to_list(1000)
    out = []
    for m in memberships:
        org = await db.organizations.find_one({"id": m["org_id"]}, {"_id": 0})
        if org:
            out.append(await org_summary(org, user["id"]))
    return out

@api.post("/orgs/{org_id}/switch")
async def switch_org(org_id: str, user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_active_org_id": org_id}})
    return {"ok": True}

@api.patch("/orgs/{org_id}/default-visibility")
async def set_default_visibility(org_id: str, req: VisibilityReq, user: dict = Depends(get_current_user)):
    if not await is_admin(org_id, user["id"]):
        raise HTTPException(status_code=403, detail="Admin only")
    await db.organizations.update_one({"id": org_id}, {"$set": {"default_visibility": req.visibility}})
    return {"ok": True}

# ============ INVITES & JOIN ============
@api.post("/orgs/{org_id}/invite-link")
async def create_invite(org_id: str, req: InviteReq, user: dict = Depends(get_current_user)):
    if not await has_permission(org_id, user["id"], "can_invite_members"):
        raise HTTPException(status_code=403, detail="No invite permission")
    token = new_id().replace("-", "")[:12]
    await db.invite_links.insert_one({
        "id": new_id(), "org_id": org_id, "token": token,
        "max_uses": req.max_uses, "uses": 0, "created_at": now_iso(),
    })
    return {"token": token}

@api.get("/invite/{token}")
async def invite_info(token: str):
    inv = await db.invite_links.find_one({"token": token}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invalid invite")
    org = await db.organizations.find_one({"id": inv["org_id"]}, {"_id": 0})
    return {"org_id": org["id"], "org_name": org["name"]}

@api.post("/invite/{token}/join")
async def join_via_invite(token: str, user: dict = Depends(get_current_user)):
    inv = await db.invite_links.find_one({"token": token}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invalid invite")
    org_id = inv["org_id"]
    existing = await db.members.find_one({"org_id": org_id, "user_id": user["id"]})
    if existing:
        if existing["status"] != "active":
            await db.members.update_one({"id": existing["id"]}, {"$set": {"status": "active"}})
        return {"ok": True, "org_id": org_id}
    # create join request
    existing_req = await db.join_requests.find_one({"org_id": org_id, "user_id": user["id"], "status": "pending"})
    if not existing_req:
        await db.join_requests.insert_one({
            "id": new_id(), "org_id": org_id, "user_id": user["id"],
            "status": "pending", "created_at": now_iso(),
        })
        # notify admins/managers
        org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
        await create_notification(org_id, org["admin_id"], "join_request", "join_request", user["id"], user["id"] if False else "system")
    return {"ok": True, "org_id": org_id, "pending": True}

@api.post("/orgs/{org_id}/invite-email")
async def invite_email(org_id: str, req: InviteEmailReq, user: dict = Depends(get_current_user)):
    if not await has_permission(org_id, user["id"], "can_invite_members"):
        raise HTTPException(status_code=403, detail="No invite permission")
    invited = await db.users.find_one({"email": req.email.lower().strip()})
    if not invited:
        raise HTTPException(status_code=404, detail="No user with that email. Ask them to sign up first, or share an invite link.")
    if await db.members.find_one({"org_id": org_id, "user_id": invited["id"]}):
        raise HTTPException(status_code=400, detail="Already a member")
    await db.members.insert_one({
        "id": new_id(), "org_id": org_id, "user_id": invited["id"],
        "default_visibility": "private", "status": "active",
        "permissions": dict(DEFAULT_PERMISSIONS), "created_at": now_iso(),
    })
    return {"ok": True}

@api.get("/orgs/{org_id}/requests")
async def list_requests(org_id: str, user: dict = Depends(get_current_user)):
    if not await has_permission(org_id, user["id"], "can_manage_join_requests"):
        raise HTTPException(status_code=403, detail="No permission")
    reqs = await db.join_requests.find({"org_id": org_id, "status": "pending"}, {"_id": 0}).to_list(1000)
    for r in reqs:
        u = await db.users.find_one({"id": r["user_id"]}, {"_id": 0, "password_hash": 0})
        r["user"] = public_user(u or {})
    return reqs

@api.post("/orgs/{org_id}/requests/{req_id}/{action}")
async def handle_request(org_id: str, req_id: str, action: str, user: dict = Depends(get_current_user)):
    if not await has_permission(org_id, user["id"], "can_manage_join_requests"):
        raise HTTPException(status_code=403, detail="No permission")
    jr = await db.join_requests.find_one({"id": req_id, "org_id": org_id}, {"_id": 0})
    if not jr:
        raise HTTPException(status_code=404, detail="Request not found")
    if action == "approve":
        await db.join_requests.update_one({"id": req_id}, {"$set": {"status": "approved"}})
        if not await db.members.find_one({"org_id": org_id, "user_id": jr["user_id"]}):
            await db.members.insert_one({
                "id": new_id(), "org_id": org_id, "user_id": jr["user_id"],
                "default_visibility": "private", "status": "active",
                "permissions": dict(DEFAULT_PERMISSIONS), "created_at": now_iso(),
            })
    else:
        await db.join_requests.update_one({"id": req_id}, {"$set": {"status": "denied"}})
    return {"ok": True}

# ============ MEMBERS & PERMISSIONS ============
@api.get("/orgs/{org_id}/members")
async def list_members(org_id: str, user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    members = await db.members.find({"org_id": org_id, "status": "active"}, {"_id": 0}).to_list(1000)
    out = []
    for m in members:
        u = await db.users.find_one({"id": m["user_id"]}, {"_id": 0, "password_hash": 0})
        if not u:
            continue
        pu = public_user(dict(u))
        # contact visibility
        if pu.get("email_visibility") != "shared_with_team" and u["id"] != user["id"]:
            pu["email"] = None
        if pu.get("phone_visibility") != "shared_with_team" and u["id"] != user["id"]:
            pu["phone_number"] = None
        out.append({
            "member_id": m["id"], "user_id": m["user_id"], "user": pu,
            "is_admin": org["admin_id"] == m["user_id"],
            "permissions": ADMIN_PERMISSIONS if org["admin_id"] == m["user_id"] else m.get("permissions", DEFAULT_PERMISSIONS),
        })
    return out

@api.patch("/orgs/{org_id}/members/{member_id}/permissions")
async def update_permissions(org_id: str, member_id: str, req: PermUpdateReq, user: dict = Depends(get_current_user)):
    if not await has_permission(org_id, user["id"], "can_manage_permissions"):
        raise HTTPException(status_code=403, detail="No permission")
    m = await db.members.find_one({"id": member_id, "org_id": org_id}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    if await is_admin(org_id, m["user_id"]):
        raise HTTPException(status_code=400, detail="Cannot change the org creator's permissions")
    perms = dict(DEFAULT_PERMISSIONS)
    perms.update(m.get("permissions", {}))
    for k in DEFAULT_PERMISSIONS:
        if k in req.permissions:
            perms[k] = bool(req.permissions[k])
    await db.members.update_one({"id": member_id}, {"$set": {"permissions": perms}})
    await log_activity(org_id, user["id"], "updated permissions for", "member", m["user_id"])
    await create_notification(org_id, m["user_id"], "permission_change", "note", member_id, user["id"])
    return {"ok": True, "permissions": perms}

# ============ FOLDERS ============
@api.get("/orgs/{org_id}/folders")
async def list_folders(org_id: str, type: Optional[str] = None, user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    q = {"org_id": org_id, "owner_id": user["id"]}
    if type:
        q["type"] = type
    return await db.folders.find(q, {"_id": 0}).to_list(1000)

@api.post("/orgs/{org_id}/folders")
async def create_folder(org_id: str, req: FolderReq, user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    f = {"id": new_id(), "org_id": org_id, "owner_id": user["id"], "name": req.name,
         "type": req.type, "created_at": now_iso()}
    await db.folders.insert_one(dict(f))
    return f

@api.delete("/orgs/{org_id}/folders/{folder_id}")
async def delete_folder(org_id: str, folder_id: str, user: dict = Depends(get_current_user)):
    await db.folders.delete_one({"id": folder_id, "owner_id": user["id"]})
    return {"ok": True}

# ============ NOTES ============
def note_public(n: dict) -> dict:
    n.pop("_id", None)
    return n

@api.get("/orgs/{org_id}/notes")
async def list_notes(org_id: str, sort: str = "updated", user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    notes = await db.notes.find({"org_id": org_id, "owner_id": user["id"]}, {"_id": 0}).to_list(2000)
    key = {"updated": "updated_at", "created": "created_at", "alpha": "title"}.get(sort, "updated_at")
    notes.sort(key=lambda x: (x.get(key) or ""), reverse=(key != "title"))
    return notes

@api.get("/orgs/{org_id}/notes/{note_id}")
async def get_note(org_id: str, note_id: str, user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    n = await db.notes.find_one({"id": note_id, "org_id": org_id}, {"_id": 0})
    if not n:
        raise HTTPException(status_code=404, detail="Note not found")
    if n["owner_id"] != user["id"]:
        if n.get("visibility") != "shared" or not await has_permission(org_id, user["id"], "can_view_shared_content"):
            raise HTTPException(status_code=403, detail="No access")
    return n

@api.post("/orgs/{org_id}/notes")
async def create_note(org_id: str, req: NoteReq, user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    n = {
        "id": new_id(), "owner_id": user["id"], "org_id": org_id,
        "title": req.title or "Untitled", "content": req.content or "",
        "drawing_data": req.drawing_data, "visibility": req.visibility or "private",
        "folder_id": req.folder_id, "caption": req.caption or "",
        "created_at": now_iso(), "updated_at": now_iso(), "last_autosaved_at": now_iso(),
    }
    await db.notes.insert_one(dict(n))
    await log_activity(org_id, user["id"], "created note", "note", n["id"], private=(n["visibility"] != "shared"))
    return note_public(n)

@api.put("/orgs/{org_id}/notes/{note_id}")
async def update_note(org_id: str, note_id: str, req: NoteReq, user: dict = Depends(get_current_user)):
    n = await db.notes.find_one({"id": note_id, "org_id": org_id}, {"_id": 0})
    if not n:
        raise HTTPException(status_code=404, detail="Note not found")
    if n["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your note")
    was_shared = n.get("visibility") == "shared"
    upd = {"title": req.title, "content": req.content, "drawing_data": req.drawing_data,
           "visibility": req.visibility, "folder_id": req.folder_id, "caption": req.caption,
           "updated_at": now_iso(), "last_autosaved_at": now_iso()}
    upd = {k: v for k, v in upd.items() if v is not None or k in ("drawing_data", "folder_id", "caption")}
    await db.notes.update_one({"id": note_id}, {"$set": upd})
    new_shared = req.visibility == "shared"
    if new_shared and not was_shared:
        await log_activity(org_id, user["id"], "shared note", "note", note_id)
    # parse mentions in caption
    if req.caption:
        mentioned, is_team = await parse_mentions(org_id, req.caption)
        for uid in mentioned:
            await create_notification(org_id, uid, "team_mention" if is_team else "mention", "note", note_id, user["id"])
    return {"ok": True}

@api.delete("/orgs/{org_id}/notes/{note_id}")
async def delete_note(org_id: str, note_id: str, user: dict = Depends(get_current_user)):
    n = await db.notes.find_one({"id": note_id, "org_id": org_id}, {"_id": 0})
    if not n:
        raise HTTPException(status_code=404, detail="Note not found")
    is_owner = n["owner_id"] == user["id"]
    if not is_owner:
        # only shared content deletable by others with permission
        if n.get("visibility") != "shared":
            raise HTTPException(status_code=403, detail="Cannot delete another member's private content")
        if not await has_permission(org_id, user["id"], "can_delete_shared_content"):
            raise HTTPException(status_code=403, detail="No delete permission")
    await db.notes.delete_one({"id": note_id})
    await db.dashboard_items.delete_many({"content_id": note_id})
    await log_activity(org_id, user["id"], "deleted note", "note", note_id, private=(n.get("visibility") != "shared"))
    return {"ok": True}

# ============ FILES ============
@api.post("/orgs/{org_id}/files/upload")
async def upload_file(org_id: str, file: UploadFile = File(...), visibility: str = Form("private"),
                      caption: str = Form(""), folder_id: str = Form(None),
                      user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    if visibility == "shared" and not await has_permission(org_id, user["id"], "can_upload_shared_content"):
        raise HTTPException(status_code=403, detail="No permission to upload shared content")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    path = f"{APP_NAME}/uploads/{user['id']}/{new_id()}.{ext}"
    data = await file.read()
    content_type = file.content_type or "application/octet-stream"
    result = put_object(path, data, content_type)
    rec = {
        "id": new_id(), "owner_id": user["id"], "org_id": org_id,
        "filename": file.filename, "type": content_type, "size": result.get("size", len(data)),
        "storage_path": result["path"], "visibility": visibility,
        "folder_id": folder_id or None, "caption": caption or "", "ext": ext,
        "is_deleted": False, "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.files.insert_one(dict(rec))
    rec.pop("_id", None)
    await log_activity(org_id, user["id"], "uploaded file", "file", rec["id"], private=(visibility != "shared"))
    if caption:
        mentioned, is_team = await parse_mentions(org_id, caption)
        for uid in mentioned:
            await create_notification(org_id, uid, "team_mention" if is_team else "mention", "file", rec["id"], user["id"])
    return rec

@api.get("/orgs/{org_id}/files")
async def list_files(org_id: str, scope: str = "mine", user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    if scope == "mine":
        q = {"org_id": org_id, "owner_id": user["id"], "is_deleted": False}
    else:
        q = {"org_id": org_id, "owner_id": user["id"], "is_deleted": False}
    files = await db.files.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return files

@api.get("/orgs/{org_id}/files/{file_id}/meta")
async def file_meta(org_id: str, file_id: str, user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    rec = await db.files.find_one({"id": file_id, "org_id": org_id, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")
    if rec["owner_id"] != user["id"]:
        if rec.get("visibility") != "shared" or not await has_permission(org_id, user["id"], "can_view_shared_content"):
            raise HTTPException(status_code=403, detail="No access")
    return rec

@api.get("/files/{file_id}/download")
async def download_file(file_id: str, request: Request, auth: str = Query(None)):
    token = auth
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    u = await user_from_token(token) if token else None
    if not u:
        raise HTTPException(status_code=401, detail="Not authenticated")
    rec = await db.files.find_one({"id": file_id, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")
    # permission: owner OR shared + can_view
    if rec["owner_id"] != u["id"]:
        if rec["visibility"] != "shared":
            raise HTTPException(status_code=403, detail="Private file")
        if not await has_permission(rec["org_id"], u["id"], "can_view_shared_content"):
            raise HTTPException(status_code=403, detail="No view permission")
    data, ctype = get_object(rec["storage_path"])
    return FastResponse(content=data, media_type=rec.get("type", ctype),
                        headers={"Content-Disposition": f'inline; filename="{rec["filename"]}"'})

@api.patch("/orgs/{org_id}/files/{file_id}/visibility")
async def file_visibility(org_id: str, file_id: str, req: VisibilityReq, user: dict = Depends(get_current_user)):
    rec = await db.files.find_one({"id": file_id, "org_id": org_id}, {"_id": 0})
    if not rec or rec["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your file")
    await db.files.update_one({"id": file_id}, {"$set": {"visibility": req.visibility, "updated_at": now_iso()}})
    if req.visibility == "shared":
        await log_activity(org_id, user["id"], "shared file", "file", file_id)
    return {"ok": True}

@api.delete("/orgs/{org_id}/files/{file_id}")
async def delete_file(org_id: str, file_id: str, user: dict = Depends(get_current_user)):
    rec = await db.files.find_one({"id": file_id, "org_id": org_id}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")
    if rec["owner_id"] != user["id"]:
        if rec.get("visibility") != "shared":
            raise HTTPException(status_code=403, detail="Cannot delete another member's private content")
        if not await has_permission(org_id, user["id"], "can_delete_shared_content"):
            raise HTTPException(status_code=403, detail="No delete permission")
    await db.files.update_one({"id": file_id}, {"$set": {"is_deleted": True}})
    await db.dashboard_items.delete_many({"content_id": file_id})
    await log_activity(org_id, user["id"], "deleted file", "file", file_id, private=(rec.get("visibility") != "shared"))
    return {"ok": True}

# ============ SHARED CONTENT ============
@api.get("/orgs/{org_id}/shared")
async def shared_content(org_id: str, owner_id: Optional[str] = None, type: Optional[str] = None,
                         user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    if not await has_permission(org_id, user["id"], "can_view_shared_content"):
        return {"files": [], "notes": [], "no_permission": True}
    fq = {"org_id": org_id, "visibility": "shared", "is_deleted": False}
    nq = {"org_id": org_id, "visibility": "shared"}
    if owner_id:
        fq["owner_id"] = owner_id
        nq["owner_id"] = owner_id
    files = [] if type == "note" else await db.files.find(fq, {"_id": 0}).sort("created_at", -1).to_list(2000)
    notes = [] if type == "file" else await db.notes.find(nq, {"_id": 0}).sort("updated_at", -1).to_list(2000)
    # attach owner names
    async def owner(uid):
        u = await db.users.find_one({"id": uid}, {"_id": 0, "name": 1, "avatar_url": 1, "id": 1})
        return u or {}
    for f in files:
        f["owner"] = await owner(f["owner_id"])
    for n in notes:
        n["owner"] = await owner(n["owner_id"])
    return {"files": files, "notes": notes}

# ============ DASHBOARD LAYOUT ============
@api.get("/orgs/{org_id}/layout")
async def get_layout(org_id: str, user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    items = await db.dashboard_items.find({"org_id": org_id, "owner_id": user["id"]}, {"_id": 0}).to_list(1000)
    return items

@api.put("/orgs/{org_id}/layout")
async def save_layout(org_id: str, req: LayoutSaveReq, user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    await db.dashboard_items.delete_many({"org_id": org_id, "owner_id": user["id"]})
    docs = []
    for it in req.items:
        docs.append({
            "id": it.id or new_id(), "owner_id": user["id"], "org_id": org_id,
            "content_type": it.content_type, "content_id": it.content_id,
            "x": it.x, "y": it.y, "width": it.width, "height": it.height, "z_index": it.z_index,
        })
    if docs:
        await db.dashboard_items.insert_many(docs)
    return {"ok": True, "count": len(docs)}

# ============ APPEARANCE ============
DEFAULT_APPEARANCE = {
    "background_type": "color", "background_value": "", "window_outline_color": "#E63946",
    "window_outline_width": 1, "text_size": "medium", "text_color": "#0A0A0B", "auto_adapt_text": True,
}

@api.get("/orgs/{org_id}/appearance")
async def get_appearance(org_id: str, user: dict = Depends(get_current_user)):
    a = await db.appearances.find_one({"org_id": org_id, "user_id": user["id"]}, {"_id": 0})
    if not a:
        return dict(DEFAULT_APPEARANCE)
    return {k: a.get(k, v) for k, v in DEFAULT_APPEARANCE.items()}

@api.put("/orgs/{org_id}/appearance")
async def save_appearance(org_id: str, req: AppearanceReq, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in req.model_dump().items() if v is not None}
    await db.appearances.update_one(
        {"org_id": org_id, "user_id": user["id"]},
        {"$set": {**upd, "org_id": org_id, "user_id": user["id"]}}, upsert=True,
    )
    return {"ok": True}

# ============ CHAT ============
@api.get("/orgs/{org_id}/messages")
async def get_messages(org_id: str, channel: str, user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    msgs = await db.chat_messages.find({"org_id": org_id, "channel": channel}, {"_id": 0}).sort("created_at", 1).to_list(500)
    for m in msgs:
        u = await db.users.find_one({"id": m["sender_id"]}, {"_id": 0, "name": 1, "avatar_url": 1, "id": 1})
        m["sender"] = u or {}
    return msgs

def dm_channel(a: str, b: str) -> str:
    return "dm:" + ":".join(sorted([a, b]))

@api.post("/orgs/{org_id}/messages")
async def send_message(org_id: str, req: ChatSendReq, user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    mentioned, is_team = await parse_mentions(org_id, req.content)
    msg = {
        "id": new_id(), "org_id": org_id, "channel": req.channel, "sender_id": user["id"],
        "content": req.content, "mentions": mentioned, "is_team_mention": is_team,
        "created_at": now_iso(),
    }
    await db.chat_messages.insert_one(dict(msg))
    msg.pop("_id", None)
    sender = await db.users.find_one({"id": user["id"]}, {"_id": 0, "name": 1, "avatar_url": 1, "id": 1})
    msg["sender"] = sender or {}
    # broadcast to channel recipients
    if req.channel.startswith("dm:"):
        parts = req.channel[3:].split(":")
        recipients = parts
    else:
        members = await db.members.find({"org_id": org_id, "status": "active"}, {"_id": 0, "user_id": 1}).to_list(1000)
        recipients = [m["user_id"] for m in members]
    await manager.send_to_users(recipients, {"kind": "chat", "message": msg})
    # notifications for mentions
    for uid in mentioned:
        await create_notification(org_id, uid, "team_mention" if is_team else "mention", "chat_message", msg["id"], user["id"])
    return msg

# ============ ACTIVITY & NOTIFICATIONS ============
@api.get("/orgs/{org_id}/activity")
async def get_activity(org_id: str, user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    logs = await db.activity_logs.find(
        {"org_id": org_id, "$or": [{"private": False}, {"actor_id": user["id"]}]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    for l in logs:
        u = await db.users.find_one({"id": l["actor_id"]}, {"_id": 0, "name": 1, "avatar_url": 1, "id": 1})
        l["actor"] = u or {}
    return logs

@api.get("/notifications")
async def all_notifications(user: dict = Depends(get_current_user)):
    notifs = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for n in notifs:
        actor = await db.users.find_one({"id": n["actor_id"]}, {"_id": 0, "name": 1, "avatar_url": 1, "id": 1})
        org = await db.organizations.find_one({"id": n["org_id"]}, {"_id": 0, "name": 1})
        n["actor"] = actor or {}
        n["org_name"] = (org or {}).get("name", "")
    return notifs

@api.get("/notifications/unread-count")
async def unread_count(user: dict = Depends(get_current_user)):
    c = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"count": c}

class MarkReadReq(BaseModel):
    ids: Optional[List[str]] = None

@api.post("/notifications/mark-read")
async def mark_read(req: MarkReadReq, user: dict = Depends(get_current_user)):
    q = {"user_id": user["id"]}
    if req.ids:
        q["id"] = {"$in": req.ids}
    await db.notifications.update_many(q, {"$set": {"read": True}})
    return {"ok": True}

@api.post("/notifications/clear-read")
async def clear_read(user: dict = Depends(get_current_user)):
    await db.notifications.delete_many({"user_id": user["id"], "read": True})
    return {"ok": True}

# ============ SEARCH ============
@api.get("/orgs/{org_id}/search")
async def search(org_id: str, q: str, user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    import re as _re
    rx = {"$regex": _re.escape(q), "$options": "i"}
    can_view = await has_permission(org_id, user["id"], "can_view_shared_content")
    vis_filter = [{"owner_id": user["id"]}]
    if can_view:
        vis_filter.append({"visibility": "shared"})
    notes = await db.notes.find({"org_id": org_id, "$and": [{"$or": vis_filter}, {"$or": [{"title": rx}, {"content": rx}]}]}, {"_id": 0}).to_list(50)
    files = await db.files.find({"org_id": org_id, "is_deleted": False, "$and": [{"$or": vis_filter}, {"$or": [{"filename": rx}, {"caption": rx}]}]}, {"_id": 0}).to_list(50)
    chats = await db.chat_messages.find({"org_id": org_id, "content": rx}, {"_id": 0}).sort("created_at", -1).to_list(50)
    # only channels user is part of
    chats = [c for c in chats if (not c["channel"].startswith("dm:")) or (user["id"] in c["channel"])]
    for c in chats:
        u = await db.users.find_one({"id": c["sender_id"]}, {"_id": 0, "name": 1, "id": 1})
        c["sender"] = u or {}
    return {"notes": notes, "files": files, "chats": chats}

# ============ PROFILE ============
@api.put("/profile")
async def update_profile(req: ProfileReq, user: dict = Depends(get_current_user)):
    upd = {}
    if req.username is not None:
        uname = req.username.lower().strip() or None
        if uname:
            existing = await db.users.find_one({"username": uname})
            if existing and existing["id"] != user["id"]:
                raise HTTPException(status_code=400, detail="Username already taken")
        upd["username"] = uname
    for f in ["name", "phone_number", "avatar_url", "email_visibility", "phone_visibility"]:
        v = getattr(req, f)
        if v is not None:
            upd[f] = v
    if upd:
        await db.users.update_one({"id": user["id"]}, {"$set": upd})
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return u

@api.put("/profile/password")
async def change_password(req: PasswordReq, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_password(req.current_password, full["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(req.new_password)}})
    return {"ok": True}

@api.post("/profile/avatar")
async def upload_avatar(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "png"
    path = f"{APP_NAME}/avatars/{user['id']}/{new_id()}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type or "image/png")
    rec = {"id": new_id(), "owner_id": user["id"], "org_id": "avatar", "filename": file.filename,
           "type": file.content_type or "image/png", "size": result.get("size", len(data)), "storage_path": result["path"],
           "visibility": "shared", "public_image": True, "is_deleted": False, "created_at": now_iso()}
    await db.files.insert_one(dict(rec))
    url = f"/api/public-image/{rec['id']}"
    await db.users.update_one({"id": user["id"]}, {"$set": {"avatar_url": url}})
    return {"avatar_url": url}

# ============ PUBLIC IMAGES (avatars, org logos, note images) ============
@api.get("/public-image/{file_id}")
async def public_image(file_id: str):
    rec = await db.files.find_one({"id": file_id, "public_image": True, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Image not found")
    data, ctype = get_object(rec["storage_path"])
    return FastResponse(content=data, media_type=rec.get("type", ctype),
                        headers={"Cache-Control": "public, max-age=86400"})

async def _store_public_image(user_id: str, file: UploadFile, kind: str) -> str:
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "png"
    path = f"{APP_NAME}/{kind}/{user_id}/{new_id()}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type or "image/png")
    rec = {"id": new_id(), "owner_id": user_id, "org_id": kind, "filename": file.filename,
           "type": file.content_type or "image/png", "size": result.get("size", len(data)),
           "storage_path": result["path"], "visibility": "shared", "public_image": True,
           "is_deleted": False, "created_at": now_iso()}
    await db.files.insert_one(dict(rec))
    return f"/api/public-image/{rec['id']}"

@api.post("/orgs/{org_id}/logo")
async def upload_org_logo(org_id: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if not await is_admin(org_id, user["id"]):
        raise HTTPException(status_code=403, detail="Only the team owner can set a logo")
    url = await _store_public_image(user["id"], file, "logos")
    await db.organizations.update_one({"id": org_id}, {"$set": {"logo_url": url}})
    return {"logo_url": url}

@api.post("/orgs/{org_id}/note-image")
async def upload_note_image(org_id: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    url = await _store_public_image(user["id"], file, "note-images")
    return {"url": url}

# ============ FILE RENAME ============
class RenameReq(BaseModel):
    filename: str

@api.patch("/orgs/{org_id}/files/{file_id}/rename")
async def rename_file(org_id: str, file_id: str, req: RenameReq, user: dict = Depends(get_current_user)):
    rec = await db.files.find_one({"id": file_id, "org_id": org_id}, {"_id": 0})
    if not rec or rec["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your file")
    name = req.filename.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name required")
    await db.files.update_one({"id": file_id}, {"$set": {"filename": name, "updated_at": now_iso()}})
    return {"ok": True, "filename": name}

# ============ CHANNELS ============
class ChannelReq(BaseModel):
    name: str

@api.get("/orgs/{org_id}/channels")
async def list_channels(org_id: str, user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    return await db.channels.find({"org_id": org_id}, {"_id": 0}).sort("created_at", 1).to_list(200)

@api.post("/orgs/{org_id}/channels")
async def create_channel(org_id: str, req: ChannelReq, user: dict = Depends(get_current_user)):
    await require_membership(org_id, user["id"])
    name = req.name.strip().lstrip("#")
    if not name:
        raise HTTPException(status_code=400, detail="Channel name required")
    ch = {"id": new_id(), "org_id": org_id, "name": name, "created_by": user["id"], "created_at": now_iso()}
    await db.channels.insert_one(dict(ch))
    ch.pop("_id", None)
    return ch

# ============ WEBSOCKET ============
@app.websocket("/api/ws")
async def websocket_endpoint(ws: WebSocket, token: str = Query(...)):
    u = await user_from_token(token)
    if not u:
        await ws.close(code=1008)
        return
    await manager.connect(u["id"], ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(u["id"], ws)
    except Exception:
        manager.disconnect(u["id"], ws)

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", sparse=True)
    from seed import run_seed
    try:
        await run_seed(db)
    except Exception as e:
        logger.error(f"Seed failed: {e}")

@app.on_event("shutdown")
async def shutdown():
    from core import client
    client.close()
