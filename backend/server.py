from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, io, csv, uuid, logging, requests, hmac, subprocess, asyncio
from pathlib import Path
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

ADMIN_EMAILS = [e.strip().lower() for e in os.environ.get('ADMIN_EMAILS', '').split(',') if e.strip()]

app = FastAPI()
api = APIRouter(prefix="/api")

# ---- Registers that admin can manage generically ----
REGISTERS = [
    "admission", "fee", "course", "coursewise", "attendance", "certificate",
    "placement", "scholarship", "staff", "faculty_attendance", "salary",
    "cashbook", "bankbook", "income", "expense", "purchase", "receipt",
    "correspondence", "visitor", "asset", "maintenance", "firesafety",
    "complaint", "stock", "library", "lostfound", "vehicle",
]

# Registers whose ID field is auto-generated: register -> (field, prefix)
AUTO_ID = {
    "admission": ("student_id", "BIFD"),
    "staff": ("staff_id", "STF"),
    "asset": ("asset_id", "AST"),
    "certificate": ("certificate_no", "CERT"),
    "receipt": ("receipt_no", "RCP"),
    "complaint": ("complaint_no", "CMP"),
}

def now_utc():
    return datetime.now(timezone.utc)

def clean(doc):
    doc.pop("_id", None)
    return doc

# ---------------- AUTH ----------------
async def get_current_user(request: Request):
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(401, "Invalid session")
    exp = session["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now_utc():
        raise HTTPException(401, "Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user

async def audit(user, action, register, record_id):
    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()), "user_email": user.get("email"),
        "action": action, "register": register, "record_id": record_id,
        "at": now_utc().isoformat(),
    })

@api.post("/auth/session")
async def create_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(400, "session_id required")
    r = requests.get(
        "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
        headers={"X-Session-ID": session_id}, timeout=15,
    )
    if r.status_code != 200:
        raise HTTPException(401, "Auth failed")
    data = r.json()
    email = data["email"].lower()

    # determine role
    role = "denied"
    courses = []
    if email in ADMIN_EMAILS:
        role = "admin"
    else:
        teacher = await db.teachers.find_one({"email": email, "active": True})
        if teacher:
            role = "teacher"
            courses = teacher.get("courses", [])

    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {
            "name": data.get("name"), "picture": data.get("picture"),
            "role": role, "courses": courses,
        }})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": data.get("name"),
            "picture": data.get("picture"), "role": role, "courses": courses,
            "created_at": now_utc().isoformat(),
        })

    token = data["session_token"]
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": token,
        "expires_at": (now_utc() + timedelta(days=7)).isoformat(),
        "created_at": now_utc().isoformat(),
    })
    response.set_cookie("session_token", token, httponly=True, secure=True,
                        samesite="none", path="/", max_age=7 * 24 * 3600)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_many({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

# ---------------- TEACHER MANAGEMENT ----------------
class TeacherIn(BaseModel):
    name: str
    email: str
    courses: List[str] = []
    active: bool = True

@api.get("/teachers")
async def list_teachers(user=Depends(require_admin)):
    rows = await db.teachers.find({}, {"_id": 0}).to_list(1000)
    return rows

@api.post("/teachers")
async def add_teacher(data: TeacherIn, user=Depends(require_admin)):
    email = data.email.lower()
    if await db.teachers.find_one({"email": email}):
        raise HTTPException(400, "Teacher already exists")
    doc = {"id": str(uuid.uuid4()), "name": data.name, "email": email,
           "courses": data.courses, "active": data.active,
           "created_at": now_utc().isoformat()}
    await db.teachers.insert_one(dict(doc))
    await audit(user, "create", "teachers", doc["id"])
    return clean(doc)

@api.put("/teachers/{tid}")
async def update_teacher(tid: str, data: TeacherIn, user=Depends(require_admin)):
    upd = {"name": data.name, "email": data.email.lower(),
           "courses": data.courses, "active": data.active}
    res = await db.teachers.update_one({"id": tid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    # sync role/access on existing user
    await db.users.update_one({"email": data.email.lower()},
                              {"$set": {"courses": data.courses,
                                        "role": "teacher" if data.active else "denied"}})
    await audit(user, "update", "teachers", tid)
    return {"ok": True}

@api.delete("/teachers/{tid}")
async def delete_teacher(tid: str, user=Depends(require_admin)):
    await db.teachers.delete_one({"id": tid})
    await audit(user, "delete", "teachers", tid)
    return {"ok": True}

# ---------------- GENERIC REGISTERS (admin) ----------------
def check_register(name):
    if name not in REGISTERS:
        raise HTTPException(404, "Unknown register")

@api.get("/registers/{name}")
async def list_register(name: str, q: Optional[str] = None, user=Depends(get_current_user)):
    check_register(name)
    # teachers may read admission roster (for options) but nothing else
    if user.get("role") != "admin":
        if name == "course":
            return await db.reg_course.find({}, {"_id": 0}).to_list(2000)
        if name == "admission":
            courses = user.get("courses", [])
            return await db.reg_admission.find(
                {"course": {"$in": courses}}, {"_id": 0}).to_list(2000)
        raise HTTPException(403, "Admin access required")
    rows = await db[f"reg_{name}"].find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    if q:
        ql = q.lower()
        rows = [r for r in rows if any(ql in str(v).lower() for v in r.values())]
    return rows

async def next_student_id():
    count = await db.reg_admission.count_documents({})
    return f"BIFD-{count + 1:04d}"

@api.post("/registers/{name}")
async def create_register(name: str, request: Request, user=Depends(require_admin)):
    check_register(name)
    data = await request.json()
    data = {k: v for k, v in data.items() if k not in ("_id", "id", "created_at")}
    data["id"] = str(uuid.uuid4())
    data["created_at"] = now_utc().isoformat()
    data["created_by"] = user.get("email")
    aid = AUTO_ID.get(name)
    if aid and not data.get(aid[0]):
        cnt = await db[f"reg_{name}"].count_documents({})
        data[aid[0]] = f"{aid[1]}-{cnt + 1:04d}"
    await db[f"reg_{name}"].insert_one(dict(data))
    await audit(user, "create", name, data["id"])
    return clean(data)

@api.put("/registers/{name}/{rid}")
async def update_register(name: str, rid: str, request: Request, user=Depends(require_admin)):
    check_register(name)
    data = await request.json()
    data = {k: v for k, v in data.items() if k not in ("_id", "id", "created_at", "created_by")}
    data["updated_at"] = now_utc().isoformat()
    data["updated_by"] = user.get("email")
    res = await db[f"reg_{name}"].update_one({"id": rid}, {"$set": data})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    await audit(user, "update", name, rid)
    return {"ok": True}

@api.delete("/registers/{name}/{rid}")
async def delete_register(name: str, rid: str, user=Depends(require_admin)):
    check_register(name)
    await db[f"reg_{name}"].delete_one({"id": rid})
    await audit(user, "delete", name, rid)
    return {"ok": True}

@api.get("/registers/{name}/export")
async def export_register(name: str, user=Depends(require_admin)):
    check_register(name)
    rows = await db[f"reg_{name}"].find({}, {"_id": 0}).to_list(10000)
    keys = []
    for r in rows:
        for k in r.keys():
            if k not in keys:
                keys.append(k)
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=keys or ["id"])
    w.writeheader()
    for r in rows:
        w.writerow(r)
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={name}.csv"})

@api.get("/registers/{name}/export.xlsx")
async def export_xlsx(name: str, user=Depends(require_admin)):
    check_register(name)
    import pandas as pd
    rows = await db[f"reg_{name}"].find({}, {"_id": 0}).to_list(10000)
    df = pd.DataFrame(rows) if rows else pd.DataFrame()
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name=name[:31] or "sheet")
    buf.seek(0)
    return StreamingResponse(buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={name}.xlsx"})

@api.get("/registers/{name}/audit")
async def register_audit(name: str, user=Depends(require_admin)):
    check_register(name)
    rows = await db.audit_log.find({"register": name}, {"_id": 0}).sort("at", -1).to_list(200)
    return rows

# ---------------- TEACHER ATTENDANCE ----------------
@api.get("/teacher/roster")
async def teacher_roster(course: str, user=Depends(get_current_user)):
    if user.get("role") not in ("teacher", "admin"):
        raise HTTPException(403, "Denied")
    if user.get("role") == "teacher" and course not in user.get("courses", []):
        raise HTTPException(403, "Not assigned to this course")
    students = await db.reg_admission.find(
        {"course": course, "status": "active"}, {"_id": 0}).to_list(1000)
    return students

@api.post("/teacher/attendance")
async def submit_attendance(request: Request, user=Depends(get_current_user)):
    if user.get("role") not in ("teacher", "admin"):
        raise HTTPException(403, "Denied")
    body = await request.json()
    date = body["date"]; course = body["course"]; entries = body["entries"]
    if user.get("role") == "teacher" and course not in user.get("courses", []):
        raise HTTPException(403, "Not assigned")
    saved = 0
    for e in entries:
        rec = {
            "id": str(uuid.uuid4()), "date": date, "course": course,
            "student_id": e.get("student_id"), "student_name": e.get("student_name"),
            "status": e.get("status"), "remark": e.get("remark", ""),
            "marked_by": user.get("email"), "locked": True,
            "created_at": now_utc().isoformat(),
        }
        # avoid duplicate for same student/date/course
        exists = await db.reg_attendance.find_one(
            {"date": date, "course": course, "student_id": e.get("student_id")})
        if exists:
            continue
        await db.reg_attendance.insert_one(dict(rec))
        saved += 1
    return {"saved": saved}

@api.get("/teacher/attendance")
async def teacher_history(user=Depends(get_current_user)):
    if user.get("role") not in ("teacher", "admin"):
        raise HTTPException(403, "Denied")
    rows = await db.reg_attendance.find(
        {"marked_by": user.get("email")}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return rows

# ---------------- DASHBOARD ----------------
@api.get("/dashboard")
async def dashboard(user=Depends(require_admin)):
    today = now_utc().strftime("%Y-%m-%d")
    month = now_utc().strftime("%Y-%m")
    active_students = await db.reg_admission.count_documents({"status": "active"})
    total_students = await db.reg_admission.count_documents({})

    att_today = await db.reg_attendance.find({"date": today}, {"_id": 0}).to_list(5000)
    present = len([a for a in att_today if a.get("status") in ("present", "late")])
    att_pct = round((present / len(att_today)) * 100) if att_today else 0

    fees = await db.reg_fee.find({}, {"_id": 0}).to_list(5000)
    def num(v):
        try:
            return float(str(v).replace(",", "") or 0)
        except Exception:
            return 0.0
    collected_month = sum(num(f.get("amount_paid")) for f in fees if str(f.get("payment_date", "")).startswith(month))
    total_due = sum(num(f.get("balance")) for f in fees)
    overdue = [f for f in fees if num(f.get("balance")) > 0]

    faculty = await db.reg_staff.count_documents({})
    visitors = await db.reg_visitor.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
    fire = await db.reg_firesafety.find({}, {"_id": 0}).to_list(1000)
    fire_due = [f for f in fire if f.get("next_due_date") and f.get("next_due_date") <= (now_utc() + timedelta(days=30)).strftime("%Y-%m-%d")]
    certs = await db.reg_certificate.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
    assets_total = await db.reg_asset.count_documents({})

    return {
        "active_students": active_students, "total_students": total_students,
        "attendance_pct": att_pct, "attendance_marked": len(att_today),
        "collected_month": collected_month, "total_due": total_due,
        "overdue_count": len(overdue), "faculty_count": faculty,
        "assets_total": assets_total, "recent_visitors": visitors,
        "fire_due_count": len(fire_due), "recent_certificates": certs,
        "overdue_fees": overdue[:5],
    }

@api.get("/search")
async def global_search(q: str, user=Depends(require_admin)):
    ql = q.lower()
    students = await db.reg_admission.find({}, {"_id": 0}).to_list(2000)
    faculty = await db.reg_faculty.find({}, {"_id": 0}).to_list(2000)
    sr = [s for s in students if any(ql in str(v).lower() for v in s.values())][:10]
    fr = [f for f in faculty if any(ql in str(v).lower() for v in f.values())][:10]
    return {"students": sr, "faculty": fr}

@api.get("/")
async def root():
    return {"message": "BIFD ERP API"}

# ---------------- DAILY BACKUP CRON ----------------
def run_backup():
    stamp = now_utc().strftime("%Y%m%d_%H%M%S")
    out = f"/app/backups/backup_{stamp}"
    try:
        subprocess.run(["mongodump", "--uri", mongo_url, "--db",
                        os.environ['DB_NAME'], "--out", out],
                       check=True, capture_output=True, timeout=120)
        logging.info(f"Backup completed: {out}")
    except Exception as e:
        logging.error(f"Backup failed: {e}")

@api.post("/cron/backup")
async def cron_backup(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else ""
    if not secret or not hmac.compare_digest(token, secret):
        raise HTTPException(401, "Unauthorized")
    os.makedirs("/app/backups", exist_ok=True)
    asyncio.get_event_loop().run_in_executor(None, run_backup)
    return {"status": "accepted"}

app.include_router(api)
app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"], allow_headers=["*"],
)
logging.basicConfig(level=logging.INFO)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
