from flask import Flask, request, jsonify, render_template
import os
from werkzeug.utils import secure_filename

# Import RAG functions
import rag_engine

app = Flask(__name__)
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

@app.route("/", methods=["GET"])
def home():
    return render_template("index.html")

@app.route("/ingest", methods=["POST"])
def ingest():
    if "file" not in request.files:
        return jsonify({"ok": False, "error": "No file field named 'file'."}), 400

    f = request.files["file"]

    if f.filename == "":
        return jsonify({"ok": False, "error": "No file selected."}), 400

    filename = secure_filename(f.filename)
    path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    f.save(path)

    # Call your RAG ingestion (you write this in rag_engine.py)
    status = rag_engine.ingest_file_path(path)

    return jsonify({"ok": True, "status": status})

@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"ok": False, "error": "Request must be JSON."}), 400

    question = data.get("question", "").strip()
    top_k = int(data.get("top_k", 5))
    model = data.get("model", "llama3.1:latest").strip()

    if not question:
        return jsonify({"ok": False, "error": "Question is empty."}), 400

    answer, citations = rag_engine.answer_question(
        question,
        top_k=top_k,
        llm_model=model
    )

    return jsonify({"ok": True, "answer": answer, "citations": citations})

if __name__ == "__main__":
    app.run(debug=True)