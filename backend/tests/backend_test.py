"""
WORKBENCH backend regression tests.
Covers: auth (email+username), orgs, members/permissions, notes CRUD, files upload/download/visibility/delete,
shared library, layout persistence, appearance, messages, notifications, activity, search, profile.
Bearer JWT via Authorization header. All routes prefixed with /api.
"""
import os
import io
import uuid
import time
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE:
    # fallback read from frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE}/api"

ADMIN = {"identifier": "admin@example.com", "password": "admin123"}
ADMIN_USERNAME = {"identifier": "admin", "password": "admin123"}
OLIVIA = {"identifier": "olivia@example.com", "password": "demo123"}
DANIEL = {"identifier": "daniel@example.com", "password": "demo123"}


def _login(payload):
    r = requests.post(f"{API}/auth/login", json=payload, timeout=15)
    return r


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_token():
    r = _login(ADMIN)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_user(admin_token):
    r = requests.get(f"{API}/auth/me", headers=_auth(admin_token), timeout=10)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def admin_org_id(admin_token, admin_user):
    r = requests.get(f"{API}/orgs", headers=_auth(admin_token), timeout=10)
    assert r.status_code == 200
    orgs = r.json()
    # Use last_active_org_id
    oid = admin_user.get("last_active_org_id") or orgs[0]["id"]
    return oid


@pytest.fixture(scope="module")
def daniel_token():
    r = _login(DANIEL)
    if r.status_code != 200:
        pytest.skip("daniel not seeded")
    return r.json()["token"]


# ---------------- AUTH ----------------
class TestAuth:
    def test_login_email(self):
        r = _login(ADMIN)
        assert r.status_code == 200
        j = r.json()
        assert "token" in j and j["user"]["email"] == "admin@example.com"

    def test_login_username(self):
        r = _login(ADMIN_USERNAME)
        assert r.status_code == 200
        assert r.json()["user"]["username"] == "admin"

    def test_login_invalid(self):
        r = _login({"identifier": "admin", "password": "wrongpw"})
        assert r.status_code in (400, 401, 403)

    def test_me(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == "admin@example.com"

    def test_register_new_user(self):
        u = f"TEST_u_{uuid.uuid4().hex[:8]}"
        payload = {"name": "Test User", "email": f"{u}@ex.com", "username": u, "password": "pw12345"}
        r = requests.post(f"{API}/auth/register", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        assert "token" in r.json()

    def test_logout(self, admin_token):
        r = requests.post(f"{API}/auth/logout", headers=_auth(admin_token), timeout=10)
        assert r.status_code in (200, 204)


# ---------------- ORGS ----------------
class TestOrgs:
    def test_list_orgs_admin_has_two(self, admin_token):
        r = requests.get(f"{API}/orgs", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        orgs = r.json()
        assert isinstance(orgs, list) and len(orgs) >= 2, f"Admin should be in 2 orgs, got {len(orgs)}"
        names = [o["name"] for o in orgs]
        assert any("Northwind" in n for n in names)
        assert any("Blue Harbor" in n for n in names)

    def test_switch_org(self, admin_token):
        r = requests.get(f"{API}/orgs", headers=_auth(admin_token), timeout=10)
        orgs = r.json()
        target = orgs[-1]["id"]
        r2 = requests.post(f"{API}/orgs/{target}/switch", headers=_auth(admin_token), timeout=10)
        assert r2.status_code in (200, 204)


# ---------------- MEMBERS & PERMISSIONS ----------------
class TestMembers:
    def test_list_members(self, admin_token, admin_org_id):
        r = requests.get(f"{API}/orgs/{admin_org_id}/members", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        members = r.json()
        assert isinstance(members, list) and len(members) >= 1
        # ensure no raw _id leaked
        for m in members:
            assert "_id" not in m


# ---------------- NOTES CRUD ----------------
class TestNotes:
    def test_create_get_update_delete_note(self, admin_token, admin_org_id):
        title = f"TEST_note_{uuid.uuid4().hex[:6]}"
        # CREATE
        r = requests.post(f"{API}/orgs/{admin_org_id}/notes",
                          headers=_auth(admin_token),
                          json={"title": title, "content": "hello", "visibility": "private"}, timeout=10)
        assert r.status_code in (200, 201), r.text
        note = r.json()
        assert note["title"] == title
        nid = note["id"]

        # GET one
        r = requests.get(f"{API}/orgs/{admin_org_id}/notes/{nid}", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["title"] == title

        # UPDATE
        r = requests.put(f"{API}/orgs/{admin_org_id}/notes/{nid}",
                         headers=_auth(admin_token),
                         json={"title": title + "_upd", "content": "world", "visibility": "shared"}, timeout=10)
        assert r.status_code == 200

        # GET verify persisted
        r = requests.get(f"{API}/orgs/{admin_org_id}/notes/{nid}", headers=_auth(admin_token), timeout=10)
        assert r.json()["title"].endswith("_upd")
        assert r.json()["visibility"] == "shared"

        # DELETE
        r = requests.delete(f"{API}/orgs/{admin_org_id}/notes/{nid}", headers=_auth(admin_token), timeout=10)
        assert r.status_code in (200, 204)

        # GET should 404
        r = requests.get(f"{API}/orgs/{admin_org_id}/notes/{nid}", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 404


# ---------------- FILES ----------------
class TestFiles:
    def test_upload_list_toggle_delete(self, admin_token, admin_org_id):
        fname = f"TEST_{uuid.uuid4().hex[:6]}.txt"
        content = b"hello world"
        files = {"file": (fname, io.BytesIO(content), "text/plain")}
        data = {"visibility": "private", "caption": "test file"}
        r = requests.post(f"{API}/orgs/{admin_org_id}/files/upload",
                          headers=_auth(admin_token), files=files, data=data, timeout=20)
        assert r.status_code in (200, 201), r.text
        f = r.json()
        fid = f["id"]

        # LIST
        r = requests.get(f"{API}/orgs/{admin_org_id}/files", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        assert any(x["id"] == fid for x in r.json())

        # Toggle visibility
        r = requests.patch(f"{API}/orgs/{admin_org_id}/files/{fid}/visibility",
                           headers=_auth(admin_token), json={"visibility": "shared"}, timeout=10)
        assert r.status_code == 200

        # Download
        r = requests.get(f"{API}/files/{fid}/download", headers=_auth(admin_token), timeout=10)
        assert r.status_code in (200, 302, 307)

        # Delete
        r = requests.delete(f"{API}/orgs/{admin_org_id}/files/{fid}", headers=_auth(admin_token), timeout=10)
        assert r.status_code in (200, 204)

    def test_daniel_cannot_upload_shared(self, daniel_token):
        # find daniel's org
        r = requests.get(f"{API}/orgs", headers=_auth(daniel_token), timeout=10)
        assert r.status_code == 200
        orgs = r.json()
        assert orgs
        oid = orgs[0]["id"]
        files = {"file": ("TEST_denied.txt", io.BytesIO(b"x"), "text/plain")}
        data = {"visibility": "shared", "caption": "should fail"}
        r = requests.post(f"{API}/orgs/{oid}/files/upload", headers=_auth(daniel_token),
                          files=files, data=data, timeout=15)
        assert r.status_code in (401, 403), f"expected forbidden got {r.status_code}: {r.text[:200]}"


# ---------------- SHARED LIBRARY ----------------
class TestShared:
    def test_shared_lists(self, admin_token, admin_org_id):
        r = requests.get(f"{API}/orgs/{admin_org_id}/shared", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, (list, dict))


# ---------------- LAYOUT ----------------
class TestLayout:
    def test_layout_persist(self, admin_token, admin_org_id):
        layout = {"items": [{"content_type": "team_chat", "content_id": None,
                              "x": 10, "y": 20, "width": 300, "height": 200, "z_index": 1}]}
        r = requests.put(f"{API}/orgs/{admin_org_id}/layout",
                         headers=_auth(admin_token), json=layout, timeout=10)
        assert r.status_code in (200, 204), r.text
        r = requests.get(f"{API}/orgs/{admin_org_id}/layout", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        got = r.json()
        assert isinstance(got, list) and len(got) >= 1


# ---------------- APPEARANCE ----------------
class TestAppearance:
    def test_appearance_persist(self, admin_token, admin_org_id):
        payload = {"background_type": "color", "background_value": "#123456",
                   "window_outline_color": "#abcdef",
                   "window_outline_width": 2, "text_size": "large", "auto_adapt_text": True}
        r = requests.put(f"{API}/orgs/{admin_org_id}/appearance",
                         headers=_auth(admin_token), json=payload, timeout=10)
        assert r.status_code in (200, 204), r.text
        r = requests.get(f"{API}/orgs/{admin_org_id}/appearance", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        j = r.json()
        assert j.get("background_value") == "#123456"


# ---------------- MESSAGES ----------------
class TestMessages:
    def test_send_and_list(self, admin_token, admin_org_id):
        body = {"channel": "team", "content": f"TEST msg {uuid.uuid4().hex[:6]} hello @team"}
        r = requests.post(f"{API}/orgs/{admin_org_id}/messages",
                          headers=_auth(admin_token), json=body, timeout=10)
        assert r.status_code in (200, 201), r.text
        r = requests.get(f"{API}/orgs/{admin_org_id}/messages?channel=team",
                         headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        msgs = r.json()
        assert isinstance(msgs, list) and len(msgs) >= 1


# ---------------- ACTIVITY / NOTIFICATIONS ----------------
class TestActivityNotifications:
    def test_activity(self, admin_token, admin_org_id):
        r = requests.get(f"{API}/orgs/{admin_org_id}/activity", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_notifications(self, admin_token):
        r = requests.get(f"{API}/notifications", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/notifications/unread-count", headers=_auth(admin_token), timeout=10)
        assert r2.status_code == 200


# ---------------- SEARCH ----------------
class TestSearch:
    def test_search(self, admin_token, admin_org_id):
        r = requests.get(f"{API}/orgs/{admin_org_id}/search?q=note", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200


# ---------------- NEW FEATURES: LOGO / CHANNELS / RENAME / NOTE-IMAGE / PUBLIC-IMAGE ----------------
def _northwind_org_id(token):
    r = requests.get(f"{API}/orgs", headers=_auth(token), timeout=10)
    assert r.status_code == 200
    for o in r.json():
        if "Northwind" in o.get("name", ""):
            return o["id"]
    return None


class TestNewFeatures:
    def test_org_logo_upload_admin(self, admin_token):
        oid = _northwind_org_id(admin_token)
        assert oid, "Northwind not found"
        img = b"\x89PNG\r\n\x1a\n" + b"\x00" * 40  # tiny fake png bytes
        files = {"file": ("logo.png", io.BytesIO(img), "image/png")}
        r = requests.post(f"{API}/orgs/{oid}/logo", headers=_auth(admin_token), files=files, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "logo_url" in j and j["logo_url"].startswith("/api/public-image/")
        # Verify org_summary contains logo_url
        r2 = requests.get(f"{API}/orgs", headers=_auth(admin_token), timeout=10)
        northwind = [o for o in r2.json() if o["id"] == oid][0]
        assert northwind.get("logo_url") == j["logo_url"]
        # Public image endpoint (no auth)
        img_id = j["logo_url"].split("/")[-1]
        r3 = requests.get(f"{BASE}/api/public-image/{img_id}", timeout=10)
        assert r3.status_code == 200
        assert r3.headers.get("content-type", "").startswith("image/")

    def test_org_logo_forbidden_for_non_admin(self, daniel_token):
        # daniel is not admin of any org
        r = requests.get(f"{API}/orgs", headers=_auth(daniel_token), timeout=10)
        orgs = r.json()
        assert orgs
        oid = orgs[0]["id"]
        img = b"\x89PNG\r\n\x1a\n"
        files = {"file": ("logo.png", io.BytesIO(img), "image/png")}
        r = requests.post(f"{API}/orgs/{oid}/logo", headers=_auth(daniel_token), files=files, timeout=15)
        assert r.status_code in (401, 403)

    def test_channels_list_and_create(self, admin_token):
        oid = _northwind_org_id(admin_token)
        cname = f"TEST_ch_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/orgs/{oid}/channels", headers=_auth(admin_token),
                          json={"name": cname}, timeout=10)
        assert r.status_code in (200, 201), r.text
        ch = r.json()
        assert ch["name"] == cname
        assert "id" in ch
        # List
        r = requests.get(f"{API}/orgs/{oid}/channels", headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        assert any(c["name"] == cname for c in r.json())
        # Send a message to this channel
        chan_key = f"channel:{ch['id']}"
        r = requests.post(f"{API}/orgs/{oid}/messages", headers=_auth(admin_token),
                          json={"channel": chan_key, "content": "TEST hello channel"}, timeout=10)
        assert r.status_code in (200, 201), r.text
        # List messages for that channel
        r = requests.get(f"{API}/orgs/{oid}/messages?channel={chan_key}",
                         headers=_auth(admin_token), timeout=10)
        assert r.status_code == 200
        msgs = r.json()
        assert isinstance(msgs, list) and any("hello channel" in m.get("content", "") for m in msgs)

    def test_channel_empty_name_rejected(self, admin_token):
        oid = _northwind_org_id(admin_token)
        r = requests.post(f"{API}/orgs/{oid}/channels", headers=_auth(admin_token),
                         json={"name": "  "}, timeout=10)
        assert r.status_code == 400

    def test_file_rename(self, admin_token, admin_org_id):
        # upload
        fname = f"TEST_orig_{uuid.uuid4().hex[:6]}.txt"
        files = {"file": (fname, io.BytesIO(b"data"), "text/plain")}
        data = {"visibility": "private", "caption": ""}
        r = requests.post(f"{API}/orgs/{admin_org_id}/files/upload",
                          headers=_auth(admin_token), files=files, data=data, timeout=15)
        assert r.status_code in (200, 201)
        fid = r.json()["id"]
        new_name = f"TEST_renamed_{uuid.uuid4().hex[:6]}.txt"
        r = requests.patch(f"{API}/orgs/{admin_org_id}/files/{fid}/rename",
                           headers=_auth(admin_token), json={"filename": new_name}, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["filename"] == new_name
        # Verify by listing
        r = requests.get(f"{API}/orgs/{admin_org_id}/files", headers=_auth(admin_token), timeout=10)
        found = [x for x in r.json() if x["id"] == fid]
        assert found and found[0]["filename"] == new_name
        # cleanup
        requests.delete(f"{API}/orgs/{admin_org_id}/files/{fid}", headers=_auth(admin_token), timeout=10)

    def test_rename_forbidden_other_owner(self, admin_token, daniel_token, admin_org_id):
        # admin uploads
        fname = f"TEST_own_{uuid.uuid4().hex[:6]}.txt"
        files = {"file": (fname, io.BytesIO(b"x"), "text/plain")}
        data = {"visibility": "shared", "caption": ""}
        r = requests.post(f"{API}/orgs/{admin_org_id}/files/upload",
                          headers=_auth(admin_token), files=files, data=data, timeout=15)
        if r.status_code not in (200, 201):
            pytest.skip("upload failed")
        fid = r.json()["id"]
        # daniel tries to rename (must be member of same org - skip if not)
        rd = requests.get(f"{API}/orgs", headers=_auth(daniel_token), timeout=10)
        if not any(o["id"] == admin_org_id for o in rd.json()):
            requests.delete(f"{API}/orgs/{admin_org_id}/files/{fid}", headers=_auth(admin_token), timeout=10)
            pytest.skip("daniel not in same org")
        r = requests.patch(f"{API}/orgs/{admin_org_id}/files/{fid}/rename",
                           headers=_auth(daniel_token), json={"filename": "hacked.txt"}, timeout=10)
        assert r.status_code in (401, 403)
        requests.delete(f"{API}/orgs/{admin_org_id}/files/{fid}", headers=_auth(admin_token), timeout=10)

    def test_note_image_upload(self, admin_token, admin_org_id):
        img = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
        files = {"file": ("note.png", io.BytesIO(img), "image/png")}
        r = requests.post(f"{API}/orgs/{admin_org_id}/note-image",
                          headers=_auth(admin_token), files=files, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["url"].startswith("/api/public-image/")


# ---------------- PROFILE ----------------
class TestProfile:
    def test_profile_update(self, admin_token):
        r = requests.put(f"{API}/profile", headers=_auth(admin_token),
                         json={"phone_number": "+15550000000"}, timeout=10)
        assert r.status_code == 200, r.text
