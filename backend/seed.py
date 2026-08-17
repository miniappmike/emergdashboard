"""Idempotent seed: two demo orgs with overlapping membership, varied permissions,
notes, files, chat with @mentions/@team, calendar events (incl. private)."""
from datetime import datetime, timezone, timedelta

def now_iso():
    return datetime.now(timezone.utc).isoformat()

async def _user(db, name, email, username, password_hash, avatar=None, phone=None):
    u = await db.users.find_one({"email": email}, {"_id": 0})
    if u:
        return u
    from core import new_id
    doc = {
        "id": new_id(), "name": name, "email": email, "username": username,
        "phone_number": phone, "password_hash": password_hash, "avatar_url": avatar,
        "last_active_org_id": None, "email_visibility": "private", "phone_visibility": "private",
        "created_at": now_iso(),
    }
    await db.users.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc

async def _org(db, name, admin_id):
    o = await db.organizations.find_one({"name": name}, {"_id": 0})
    if o:
        return o
    from core import new_id
    doc = {"id": new_id(), "name": name, "admin_id": admin_id, "default_visibility": "private", "created_at": now_iso()}
    await db.organizations.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc

async def _member(db, org_id, user_id, perms):
    from core import new_id, DEFAULT_PERMISSIONS
    m = await db.members.find_one({"org_id": org_id, "user_id": user_id})
    p = dict(DEFAULT_PERMISSIONS)
    p.update(perms)
    if m:
        return
    await db.members.insert_one({
        "id": new_id(), "org_id": org_id, "user_id": user_id, "default_visibility": "private",
        "status": "active", "permissions": p, "created_at": now_iso(),
    })

async def _note(db, org_id, owner_id, title, content, visibility):
    from core import new_id
    if await db.notes.find_one({"org_id": org_id, "owner_id": owner_id, "title": title}):
        return
    await db.notes.insert_one({
        "id": new_id(), "owner_id": owner_id, "org_id": org_id, "title": title, "content": content,
        "drawing_data": None, "visibility": visibility, "folder_id": None, "caption": "",
        "created_at": now_iso(), "updated_at": now_iso(), "last_autosaved_at": now_iso(),
    })

async def _msg(db, org_id, channel, sender_id, content, mentions=None, is_team=False):
    from core import new_id
    if await db.chat_messages.find_one({"org_id": org_id, "channel": channel, "content": content}):
        return
    await db.chat_messages.insert_one({
        "id": new_id(), "org_id": org_id, "channel": channel, "sender_id": sender_id,
        "content": content, "mentions": mentions or [], "is_team_mention": is_team, "created_at": now_iso(),
    })

async def _event(db, org_id, creator_id, title, start, end, visibility):
    from core import new_id
    if await db.events.find_one({"org_id": org_id, "creator_id": creator_id, "title": title}):
        return
    await db.events.insert_one({
        "id": new_id(), "org_id": org_id, "creator_id": creator_id, "title": title,
        "description": "", "start_time": start, "end_time": end, "all_day": False,
        "visibility": visibility, "created_at": now_iso(), "updated_at": now_iso(),
    })

async def run_seed(db):
    import os
    from core import hash_password
    if await db.users.find_one({"email": "olivia@example.com"}):
        return  # already seeded
    pw = hash_password("admin123")
    demo_pw = hash_password("demo123")

    admin = await _user(db, os.environ.get("ADMIN_EMAIL", "admin@example.com"), os.environ.get("ADMIN_EMAIL", "admin@example.com"), "admin", pw)
    # ensure admin has proper name
    await db.users.update_one({"id": admin["id"]}, {"$set": {"name": "Marcus Chen", "username": "admin"}})
    olivia = await _user(db, "Olivia Brooks", "olivia@example.com", "olivia", demo_pw, phone="+1 555 0101")
    dan = await _user(db, "Daniel Reeves", "daniel@example.com", "daniel", demo_pw)
    priya = await _user(db, "Priya Nair", "priya@example.com", "priya", demo_pw)

    await db.users.update_one({"id": olivia["id"]}, {"$set": {"email_visibility": "shared_with_team", "phone_visibility": "shared_with_team"}})

    orgA = await _org(db, "Northwind Studio", admin["id"])
    orgB = await _org(db, "Blue Harbor Collective", olivia["id"])

    # Org A membership (admin=Marcus). Varied perms.
    await _member(db, orgA["id"], admin["id"], {})  # admin, full anyway
    await _member(db, orgA["id"], olivia["id"], {"can_manage_permissions": True, "can_invite_members": True, "can_delete_shared_content": True})  # co-admin trust
    await _member(db, orgA["id"], dan["id"], {"can_upload_shared_content": False})  # view-only sharer
    await _member(db, orgA["id"], priya["id"], {"can_manage_join_requests": True})

    # Org B membership (admin=Olivia). Overlap: admin(Marcus) also here -> cross-team switcher.
    await _member(db, orgB["id"], olivia["id"], {})
    await _member(db, orgB["id"], admin["id"], {"can_invite_members": True})  # Marcus belongs to both
    await _member(db, orgB["id"], priya["id"], {})

    await db.users.update_one({"id": admin["id"]}, {"$set": {"last_active_org_id": orgA["id"]}})
    await db.users.update_one({"id": olivia["id"]}, {"$set": {"last_active_org_id": orgA["id"]}})

    # Notes
    await _note(db, orgA["id"], admin["id"], "Q3 Roadmap", "<h2>Q3 Roadmap</h2><p>Ship the dashboard canvas and shared library.</p>", "shared")
    await _note(db, orgA["id"], olivia["id"], "Design tokens", "<p>Navy #1D3557, Red #E63946, Grey #8D99AE.</p>", "shared")
    await _note(db, orgA["id"], olivia["id"], "Personal scratchpad", "<p>My private thoughts — not shared.</p>", "private")
    await _note(db, orgA["id"], dan["id"], "Meeting notes", "<p>Standup summary.</p>", "shared")
    await _note(db, orgB["id"], olivia["id"], "Harbor kickoff", "<p>Welcome to Blue Harbor.</p>", "shared")

    # Events (incl private)
    start = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(days=1, hours=1)).isoformat()
    await _event(db, orgA["id"], admin["id"], "Team Sync", start, end, "shared")
    await _event(db, orgA["id"], olivia["id"], "Dentist (private)", start, end, "private")

    # Chat with @mention and @team
    ch = "team"
    await _msg(db, orgA["id"], ch, admin["id"], "Welcome everyone to Northwind Studio! @team let's build.", mentions=[olivia["id"], dan["id"], priya["id"]], is_team=True)
    await _msg(db, orgA["id"], ch, olivia["id"], "Hey @admin the roadmap looks great.", mentions=[admin["id"]])
    await _msg(db, orgA["id"], ch, dan["id"], "Ready to help with meeting notes.")

    # A notification for olivia (mention)
    from core import new_id
    await db.notifications.insert_one({
        "id": new_id(), "org_id": orgA["id"], "user_id": olivia["id"], "type": "team_mention",
        "source_type": "chat_message", "source_id": "seed", "actor_id": admin["id"],
        "read": False, "created_at": now_iso(),
    })

    # test_credentials.md
    try:
        with open("/app/memory/test_credentials.md", "w") as f:
            f.write(
                "# Test Credentials\n\n"
                "## Admin (org creator of 'Northwind Studio', member of both orgs)\n"
                "- Email: admin@example.com  |  Username: admin  |  Password: admin123\n"
                "- Name: Marcus Chen\n\n"
                "## Demo users (password: demo123)\n"
                "- Olivia Brooks — olivia@example.com / username: olivia (co-admin in Northwind, admin of Blue Harbor, in BOTH orgs)\n"
                "- Daniel Reeves — daniel@example.com / username: daniel (upload-shared OFF)\n"
                "- Priya Nair — priya@example.com / username: priya (can manage join requests; in both orgs)\n\n"
                "## Notes\n"
                "- Login accepts EITHER email OR username.\n"
                "- Two orgs with overlapping membership: 'Northwind Studio' & 'Blue Harbor Collective'.\n"
                "- Auth endpoints: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me\n"
            )
    except Exception:
        pass
