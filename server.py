import os
import uuid
from datetime import datetime

from flask import (
    Flask,
    jsonify,
    request,
    send_from_directory,
)
from pymongo import MongoClient

# ---------- Config ----------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

os.makedirs(UPLOAD_DIR, exist_ok=True)

app = Flask(
    __name__,
    static_folder="static",
    static_url_path="/static",
)
app.config["UPLOAD_FOLDER"] = UPLOAD_DIR
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key")

# ----- Mongo connection -----
# On Render / production:
#   set MONGODB_URI in the dashboard with your Atlas connection string.
# Locally:
#   you can still use mongodb://localhost:27017 if you have Mongo running.

MONGO_URI = (
    os.environ.get("MONGODB_URI")  # preferred (Render / Atlas)
    or os.environ.get("MONGO_URL")  # fallback name if you already set this
)

if not MONGO_URI:
    # Local fallback only – avoids trying Atlas when you just run Mongo locally.
    MONGO_URI = "mongodb://localhost:27017"

MONGO_DB_NAME = os.environ.get("MONGO_DB_NAME", "azhrareon")

mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = mongo_client[MONGO_DB_NAME]
collections_coll = db["collections"]
contacts_coll = db["contacts"]


# ---------- Helper ----------


def collection_to_dict(doc):
    """Convert Mongo doc -> plain dict without _id."""
    if not doc:
        return None
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


# ---------- Static HTML pages ----------


@app.route("/")
def index():
    # Serve the main museum page
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/admin")
def admin_page():
    # Admin console
    return send_from_directory(BASE_DIR, "admin.html")


# ---------- Static uploads (images) ----------


@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename)


# ---------- Public API ----------


@app.route("/api/collections", methods=["GET"])
def api_get_collections():
    docs = [collection_to_dict(d) for d in collections_coll.find({})]
    return jsonify(docs)


@app.route("/api/contact", methods=["POST"])
def api_contact():
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    message = (data.get("message") or "").strip()

    if not (name and email and message):
        return (
            jsonify({"detail": "name, email and message are required"}),
            400,
        )

    doc = {
        "name": name,
        "email": email,
        "message": message,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    contacts_coll.insert_one(doc)
    return jsonify({"ok": True})


# ---------- Admin API: collections ----------


@app.route("/api/admin/collections", methods=["GET"])
def admin_list_collections():
    docs = [collection_to_dict(d) for d in collections_coll.find({})]
    return jsonify(docs)


@app.route("/api/admin/collections", methods=["POST"])
def admin_create_collection():
    data = request.get_json(silent=True) or {}
    if not data.get("id") or not data.get("title"):
        return jsonify({"detail": "id and title are required"}), 400

    existing = collections_coll.find_one({"id": data["id"]})
    if existing:
        return jsonify({"detail": "id already exists"}), 400

    collections_coll.insert_one(data)
    return jsonify({"ok": True}), 201


@app.route("/api/admin/collections/<id>", methods=["PUT"])
def admin_update_collection(id):
    data = request.get_json(silent=True) or {}
    result = collections_coll.update_one({"id": id}, {"$set": data}, upsert=True)
    return jsonify(
        {
            "ok": True,
            "matched": result.matched_count,
            "modified": result.modified_count,
            "upserted": bool(result.upserted_id),
        }
    )


@app.route("/api/admin/collections/<id>", methods=["DELETE"])
def admin_delete_collection(id):
    result = collections_coll.delete_one({"id": id})
    return jsonify({"ok": True, "deleted": result.deleted_count})


# ---------- Admin API: contacts ----------


@app.route("/api/admin/contacts", methods=["GET"])
def admin_list_contacts():
    docs = [collection_to_dict(d) for d in contacts_coll.find({}).sort("timestamp", -1)]
    return jsonify(docs)


# ---------- Admin API: image upload ----------


@app.route("/api/admin/upload-image", methods=["POST"])
def admin_upload_image():
    if "file" not in request.files:
        return jsonify({"detail": "file field is required"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"detail": "no file selected"}), 400

    # Use a random filename to avoid clashes
    ext = os.path.splitext(file.filename)[1].lower()
    filename = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(UPLOAD_DIR, filename)
    file.save(save_path)

    url = f"/uploads/{filename}"
    return jsonify({"ok": True, "url": url}), 201


# ---------- Main entry for local dev ----------

if __name__ == "__main__":
    # For local testing only (Render uses gunicorn, not this block)
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=True)
