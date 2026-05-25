import os
import uuid
import traceback
import threading
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from app.voice_processor import transcribe_audio
from app.nlp_analyzer import extract_knowledge, merge_knowledge
from app.interview_agent import get_next_question, get_opening_question, generate_summary
from app.knowledge_store import store_conversation_chunk, store_session_summary, search_knowledge, get_all_session_knowledge
from app.chat_agent import chat_with_knowledge
from app.exporter import export_pdf, export_csv, export_json
from app.tts import synthesize

app = FastAPI(title="Convera AI", version="1.0.0", description="Voice-powered AI interview system")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session storage
sessions: dict[str, dict] = {}


def _prewarm_models():
    """Load all heavy models at startup so the first request is instant."""
    try:
        print("⏳ Pre-warming Whisper model...")
        from app.voice_processor import get_whisper_model
        get_whisper_model()
        print("✅ Whisper ready")
    except Exception as e:
        print(f"⚠️  Whisper pre-warm failed: {e}")

    try:
        print("⏳ Pre-warming embeddings model...")
        from app.knowledge_store import get_embedder, get_qdrant
        get_embedder()
        get_qdrant()
        print("✅ Embeddings + Qdrant ready")
    except Exception as e:
        print(f"⚠️  Embeddings pre-warm failed: {e}")

    print("🚀 All models ready — interviews will start instantly!")


@app.on_event("startup")
async def startup_event():
    # Run in a background thread so it doesn't block the server from starting
    thread = threading.Thread(target=_prewarm_models, daemon=True)
    thread.start()


def get_session(session_id: str) -> dict:
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found. Please start a new interview.")
    return sessions[session_id]


# --- Session Management ---

class CreateSessionRequest(BaseModel):
    topic: Optional[str] = "general background"
    person_name: Optional[str] = "the interviewee"

@app.post("/api/sessions/create")
async def create_session(req: CreateSessionRequest):
    try:
        session_id = str(uuid.uuid4())
        opening_question = get_opening_question(req.topic)
        sessions[session_id] = {
            "id": session_id,
            "topic": req.topic,
            "person_name": req.person_name,
            "conversation": [{"role": "assistant", "content": opening_question}],
            "knowledge": {},
            "summary": None,
            "status": "active",
        }
        return {"session_id": session_id, "opening_question": opening_question}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")

@app.get("/api/sessions/{session_id}")
async def get_session_info(session_id: str):
    return get_session(session_id)


# --- Voice Processing ---

@app.post("/api/voice/transcribe")
async def transcribe(
    session_id: str = Form(...),
    audio: UploadFile = File(...),
):
    try:
        session = get_session(session_id)
        audio_bytes = await audio.read()

        # Get file extension from filename or content type
        filename = audio.filename or "recording.webm"
        ext = filename.rsplit(".", 1)[-1] if "." in filename else "webm"

        print(f"Received audio: {len(audio_bytes)} bytes, format: {ext}")

        result = transcribe_audio(audio_bytes, ext)
        transcript = result["transcript"]

        print(f"Transcript: '{transcript}'")

        if not transcript:
            # Return a prompt to try again rather than failing silently
            return {
                "transcript": "",
                "question": "I didn't catch that — could you please speak a bit louder or try again?",
                "knowledge_extracted": {},
            }

        knowledge_chunk = extract_knowledge(transcript)
        session["knowledge"] = merge_knowledge(session["knowledge"], knowledge_chunk)
        session["conversation"].append({"role": "user", "content": transcript})

        store_conversation_chunk(session_id, "interviewee", transcript, knowledge_chunk)

        next_question = get_next_question(
            session["conversation"],
            session["knowledge"],
            session["topic"],
        )
        session["conversation"].append({"role": "assistant", "content": next_question})

        return {
            "transcript": transcript,
            "language": result["language"],
            "knowledge_extracted": knowledge_chunk,
            "question": next_question,
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Audio processing failed: {str(e)}")


# --- Text Input ---

class TextInputRequest(BaseModel):
    session_id: str
    text: str

@app.post("/api/text/submit")
async def submit_text(req: TextInputRequest):
    try:
        session = get_session(req.session_id)

        if not req.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")

        knowledge_chunk = extract_knowledge(req.text)
        session["knowledge"] = merge_knowledge(session["knowledge"], knowledge_chunk)
        session["conversation"].append({"role": "user", "content": req.text})

        store_conversation_chunk(req.session_id, "interviewee", req.text, knowledge_chunk)

        next_question = get_next_question(
            session["conversation"],
            session["knowledge"],
            session["topic"],
        )
        session["conversation"].append({"role": "assistant", "content": next_question})

        return {
            "knowledge_extracted": knowledge_chunk,
            "question": next_question,
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to process text: {str(e)}")


# --- Interview Finalization ---

@app.post("/api/sessions/{session_id}/finalize")
async def finalize_session(session_id: str):
    try:
        session = get_session(session_id)
        summary = generate_summary(session["conversation"], session["knowledge"])
        session["summary"] = summary
        session["status"] = "completed"
        store_session_summary(session_id, summary, session["knowledge"])
        return {"summary": summary, "knowledge": session["knowledge"]}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to finalize session: {str(e)}")


# --- Export ---

class ExportRequest(BaseModel):
    format: str

@app.post("/api/sessions/{session_id}/export")
async def export_session(session_id: str, req: ExportRequest):
    try:
        session = get_session(session_id)
        if not session.get("summary"):
            raise HTTPException(status_code=400, detail="Please finalize the interview first before exporting.")

        fmt = req.format.lower()
        if fmt == "pdf":
            path = export_pdf(session_id, session["summary"], session["knowledge"], session["conversation"])
        elif fmt == "csv":
            path = export_csv(session_id, session["knowledge"], session["conversation"])
        elif fmt == "json":
            path = export_json(session_id, session["knowledge"], session["conversation"], session["summary"])
        else:
            raise HTTPException(status_code=400, detail="Unsupported format. Use pdf, csv, or json.")

        return FileResponse(path, filename=os.path.basename(path))
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


# --- Knowledge Search ---

class SearchRequest(BaseModel):
    session_id: str
    query: str
    top_k: int = 5

@app.post("/api/knowledge/search")
async def search(req: SearchRequest):
    results = search_knowledge(req.session_id, req.query, req.top_k)
    return {"results": results}

@app.get("/api/knowledge/{session_id}")
async def get_knowledge(session_id: str):
    session = get_session(session_id)
    chunks = get_all_session_knowledge(session_id)
    return {"knowledge": session["knowledge"], "chunks": chunks, "summary": session.get("summary")}


# --- Personalized Chat ---

class ChatRequest(BaseModel):
    session_id: str
    message: str
    history: list[dict] = []

@app.post("/api/chat")
async def chat(req: ChatRequest):
    try:
        session = get_session(req.session_id)
        response = chat_with_knowledge(
            req.session_id,
            req.message,
            req.history,
            session.get("person_name", "the person"),
        )
        return {"response": response}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


# --- Text to Speech ---

class TTSRequest(BaseModel):
    text: str

@app.post("/api/tts")
async def text_to_speech(req: TTSRequest):
    try:
        audio = await synthesize(req.text)
        return Response(content=audio, media_type="audio/mpeg")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"TTS failed: {str(e)}")


@app.get("/")
async def root():
    return {"message": "Convera AI API is running", "docs": "/docs"}
