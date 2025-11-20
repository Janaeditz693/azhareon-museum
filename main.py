from datetime import datetime
from pathlib import Path
from typing import List
from uuid import uuid4

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import motor.motor_asyncio
from PIL import Image

# add these imports at top of main.py
from fastapi import FastAPI, Request
from fastapi.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.middleware.cors import CORSMiddleware

# -------------------------------------------------
# 1️⃣ Create the FastAPI app FIRST
# -------------------------------------------------
app = FastAPI(title="Azhareon Museum API")

# -------------------------------------------------
# 2️⃣ Temporary CSP for debugging
# -------------------------------------------------
ENABLE_RELAXED_CSP = True

class CSPMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        if ENABLE_RELAXED_CSP:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: blob:; "
                "connect-src 'self' http://localhost:8000 ws:; "
                "font-src 'self' data:;"
            )
        else:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: blob:; "
                "connect-src 'self' http://localhost:8000 ws:; "
                "font-src 'self' data:;"
            )
        return response

# -------------------------------------------------
# 3️⃣ Add middleware AFTER creating app
# -------------------------------------------------
app.add_middleware(CSPMiddleware)

# If you're using CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app = FastAPI(title="Azhareon Museum API")

# ---------- Pydantic models ----------


class Collection(BaseModel):
    id: str
    title: str
    category: str
    era: str
    origin: str
    description: str
    tags: List[str]
    banner: str
    badge: str
    image_url: str | None = None  # NEW


class ContactMessage(BaseModel):
    name: str
    email: str
    message: str


class ContactOut(BaseModel):
    id: str
    name: str
    email: str
    message: str
    timestamp: str


# ---------- MongoDB setup ----------

mongo_client: motor.motor_asyncio.AsyncIOMotorClient | None = None
db = None
UPLOAD_DIR = Path("uploads")


@app.on_event("startup")
async def startup_db():
    global mongo_client, db
    mongo_client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017")
    db = mongo_client["azhareon"]

    # ensure uploads directory exists
    UPLOAD_DIR.mkdir(exist_ok=True)

    collections_coll = db["collections"]
    count = await collections_coll.count_documents({})
    if count == 0:
        seed_collections = [
            {
                "id": "retro-cars",
                "title": "Retro Grand Tourers",
                "category": "machines",
                "era": "1960s–1980s",
                "origin": "European & American ateliers",
                "description": (
                    "Curated grand tourers and coupes, restored and preserved "
                    "with a jeweller’s attention to detail."
                ),
                "tags": ["Cars", "Chrome", "Leather"],
                "banner": "linear-gradient(135deg, #1b1b1b, #4e4028)",
                "badge": "Featured",
                "image_url": None,
            },
            {
                "id": "vintage-bikes",
                "title": "Vintage Motorcycles",
                "category": "machines",
                "era": "1940s–1970s",
                "origin": "Twin & single-cylinder icons",
                "description": (
                    "Machines that carried entire generations — from narrow streets "
                    "to open mountain passes."
                ),
                "tags": ["Motorcycles", "Retro", "Engines"],
                "banner": "linear-gradient(135deg, #151515, #403043)",
                "badge": "Rare",
                "image_url": None,
            },
            {
                "id": "fine-art",
                "title": "Fine Art & Paintings",
                "category": "art",
                "era": "18th–21st Century",
                "origin": "Global salons & studios",
                "description": (
                    "Oil portraits, abstract canvases, and quiet landscapes carefully "
                    "collected from global galleries."
                ),
                "tags": ["Canvas", "Oil", "Abstract"],
                "banner": "linear-gradient(135deg, #141414, #2f3b4f)",
                "badge": "Curated",
                "image_url": None,
            },
            {
                "id": "egyptian",
                "title": "Egyptian Relics",
                "category": "ancient",
                "era": "Ancient Kingdoms",
                "origin": "Nile Valley",
                "description": (
                    "Fragments of dynasties and myth — carved stone, gold leaf, and "
                    "silent hieroglyphs."
                ),
                "tags": ["Hieroglyphs", "Sarcophagus", "Relics"],
                "banner": "linear-gradient(135deg, #15120f, #403323)",
                "badge": "Vault",
                "image_url": None,
            },
            {
                "id": "modern-art",
                "title": "Modern & Contemporary Art",
                "category": "art",
                "era": "20th–21st Century",
                "origin": "Urban galleries",
                "description": (
                    "Pieces that interpret speed, glass, and light — visual echoes of "
                    "modern city life."
                ),
                "tags": ["Modern", "Minimal", "Conceptual"],
                "banner": "linear-gradient(135deg, #101010, #253342)",
                "badge": "New",
                "image_url": None,
            },
            {
                "id": "rare-books",
                "title": "Rare Books & Manuscripts",
                "category": "books",
                "era": "Medieval–Modern",
                "origin": "Library vaults",
                "description": (
                    "First editions, handwritten folios, and manuscripts that survived "
                    "empires and oceans."
                ),
                "tags": ["Manuscripts", "Leatherbound", "Script"],
                "banner": "linear-gradient(135deg, #17130f, #403025)",
                "badge": "Archive",
                "image_url": None,
            },
            {
                "id": "stones",
                "title": "Stones, Crystals & Fossils",
                "category": "stones",
                "era": "Geological Eras",
                "origin": "Earth’s deep layers",
                "description": (
                    "Minerals, crystals, and fossils that compress geological eras into "
                    "the palm of your hand."
                ),
                "tags": ["Geology", "Crystals", "Fossils"],
                "banner": "linear-gradient(135deg, #0e1518, #273239)",
                "badge": "Origin",
                "image_url": None,
            },
        ]
        await collections_coll.insert_many(seed_collections)


@app.on_event("shutdown")
async def shutdown_db():
    if mongo_client:
        mongo_client.close()


def normalize_collection(doc) -> Collection:
    if not doc:
        raise HTTPException(status_code=404, detail="Collection not found")
    doc.pop("_id", None)
    # ensure image_url field exists
    doc.setdefault("image_url", None)
    return Collection(**doc)


def normalize_contact(doc) -> ContactOut:
    if not doc:
        raise HTTPException(status_code=404, detail="Contact not found")
    _id = str(doc.get("_id"))
    doc.pop("_id", None)
    return ContactOut(id=_id, **doc)


# ---------- Public API ----------


@app.get("/api/collections", response_model=List[Collection])
async def list_collections() -> List[Collection]:
    docs = await db["collections"].find({}).to_list(length=1000)
    return [normalize_collection(d) for d in docs]


@app.get("/api/collections/{collection_id}", response_model=Collection)
async def get_collection(collection_id: str) -> Collection:
    doc = await db["collections"].find_one({"id": collection_id})
    return normalize_collection(doc)


@app.post("/api/contact")
async def submit_contact(msg: ContactMessage):
    record = {
        "name": msg.name,
        "email": msg.email,
        "message": msg.message,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    await db["contacts"].insert_one(record)
    return {"ok": True, "message": "Contact received"}


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "Azhareon API"}


# ---------- Admin API ----------


@app.get("/api/admin/collections", response_model=List[Collection])
async def admin_list_collections() -> List[Collection]:
    docs = (
        await db["collections"]
        .find({})
        .sort("title", 1)
        .to_list(length=1000)
    )
    return [normalize_collection(d) for d in docs]


@app.post("/api/admin/collections", response_model=Collection)
async def admin_create_collection(item: Collection) -> Collection:
    existing = await db["collections"].find_one({"id": item.id})
    if existing:
        raise HTTPException(status_code=400, detail="Collection with this id already exists")
    await db["collections"].insert_one(item.model_dump())
    return item


@app.put("/api/admin/collections/{collection_id}", response_model=Collection)
async def admin_update_collection(collection_id: str, item: Collection) -> Collection:
    data = item.model_dump()
    data["id"] = collection_id
    await db["collections"].update_one({"id": collection_id}, {"$set": data})
    doc = await db["collections"].find_one({"id": collection_id})
    return normalize_collection(doc)


@app.delete("/api/admin/collections/{collection_id}")
async def admin_delete_collection(collection_id: str):
    result = await db["collections"].delete_one({"id": collection_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Collection not found")
    return {"ok": True}


@app.get("/api/admin/contacts", response_model=List[ContactOut])
async def admin_list_contacts(limit: int = 50) -> List[ContactOut]:
    docs = (
        await db["contacts"]
        .find({})
        .sort("timestamp", -1)
        .to_list(length=limit)
    )
    return [normalize_contact(d) for d in docs]


# ---------- Image upload API (premium local processing) ----------


@app.post("/api/admin/upload-image")
async def admin_upload_image(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are allowed")

    # safe unique name
    ext = ".webp"
    filename = f"{uuid4().hex}{ext}"
    target_path = UPLOAD_DIR / filename

    # read into Pillow
    try:
        contents = await file.read()
        from io import BytesIO

        img = Image.open(BytesIO(contents))

        # convert to RGB to avoid alpha issues in WebP
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        # resize if huge (keep aspect)
        max_width = 1600
        if img.width > max_width:
            ratio = max_width / float(img.width)
            new_height = int(img.height * ratio)
            img = img.resize((max_width, new_height), Image.LANCZOS)

        # save optimized WebP
        img.save(target_path, format="WEBP", quality=80, method=6)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process image: {e}")

    url_path = f"/uploads/{filename}"
    return {"url": url_path}


# ---------- Static files ----------

# this will also serve /uploads/* because uploads folder is inside project root
app.mount("/", StaticFiles(directory=".", html=True), name="static-root")
