# Convera AI — Complete Documentation

## What is Convera AI?

Convera AI is a voice-powered interview system that:
1. Conducts AI-driven voice interviews
2. Extracts knowledge from conversations in real-time
3. Stores knowledge in a vector database (Qdrant)
4. Exports the knowledge as PDF, CSV, or JSON
5. Creates a personalized AI chatbot from the interview

---

## Pipeline Architecture

```
Voice Input
    ↓
faster-whisper (Speech → Text)
    ↓
spaCy (Extract skills, entities, topics, experience)
    ↓
Ollama / Claude (AI generates next interview question)
    ↓
edge-tts (Question spoken aloud with Jenny neural voice)
    ↓
Qdrant + sentence-transformers (Store knowledge as embeddings)
    ↓
Export → PDF / CSV / JSON
    ↓
Personalized AI Chatbot (RAG-based, answers using stored knowledge)
```

---

## Modules Explained

### Server & API

| Package | Version | Purpose |
|---|---|---|
| **fastapi** | 0.115.0 | The main web framework — handles all API endpoints like `/api/sessions/create`, `/api/voice/transcribe`, `/api/chat` |
| **uvicorn** | 0.30.6 | Runs the FastAPI server. When you type `uvicorn app.main:app`, this starts it and listens on port 8000 |
| **python-multipart** | 0.0.9 | Allows FastAPI to accept file uploads — needed when the frontend sends audio recordings to `/api/voice/transcribe` |

---

### Voice & Speech

| Package | Version | Purpose |
|---|---|---|
| **faster-whisper** | 1.0.3 | Converts voice recordings to text (Speech-to-Text). Transcribes locally on your machine using OpenAI's Whisper model |
| **edge-tts** | 6.1.12 | Microsoft's neural Text-to-Speech — converts AI questions to Jenny's human-like voice and sends audio back to the browser |

---

### AI & Language

| Package | Version | Purpose |
|---|---|---|
| **anthropic** | 0.34.2 | SDK for Claude API — used when `LLM_BACKEND=anthropic` to generate interview questions and chat responses |
| **httpx** | 0.27.2 | Makes HTTP requests to Ollama (`http://localhost:11434`) — used when `LLM_BACKEND=ollama` to call Gemma/Llama locally |
| **spacy** | 3.7.6 | NLP library — extracts entities (organisations, locations), skills, experience years and key topics from the interviewee's answers |

---

### Knowledge Storage

| Package | Version | Purpose |
|---|---|---|
| **qdrant-client** | 1.11.1 | Connects to the Qdrant vector database — stores and searches all knowledge extracted from the interview as vector embeddings |
| **sentence-transformers** | 3.1.1 | Converts text into vector embeddings so it can be stored and searched in Qdrant. Uses the `all-MiniLM-L6-v2` model |

---

### Export & Data

| Package | Version | Purpose |
|---|---|---|
| **reportlab** | 4.2.2 | Generates PDF reports — when you click "Export as PDF" it builds the formatted interview report |
| **pandas** | 2.2.2 | Handles CSV export — when you click "Export as CSV" it structures the data into a spreadsheet |

---

### Utilities

| Package | Version | Purpose |
|---|---|---|
| **python-dotenv** | 1.0.1 | Reads your `.env` file and loads variables like `ANTHROPIC_API_KEY`, `LLM_BACKEND`, `OLLAMA_MODEL` into the app |
| **aiofiles** | 24.1.0 | Allows reading/writing files asynchronously — used when saving and serving exported files without blocking the server |
| **pydantic** | 2.9.2 | Validates API request data — ensures the JSON your frontend sends has the right fields and types before processing |

---

## Project Structure

```
Convera AI/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app — all API endpoints
│   │   ├── config.py            # Environment variables and settings
│   │   ├── voice_processor.py   # Whisper STT — converts audio to text
│   │   ├── nlp_analyzer.py      # spaCy — extracts knowledge from text
│   │   ├── interview_agent.py   # AI interviewer — generates questions
│   │   ├── knowledge_store.py   # Qdrant — stores and searches knowledge
│   │   ├── chat_agent.py        # Personalized chatbot using RAG
│   │   ├── exporter.py          # PDF, CSV, JSON export
│   │   └── tts.py               # Edge TTS — AI voice (Jenny neural)
│   ├── requirements.txt         # All Python dependencies
│   └── .env.example             # Environment variables template
├── frontend/
│   ├── app/
│   │   ├── page.js              # Landing page — name + topic selection
│   │   ├── interview/page.js    # Live interview — voice recording + AI questions
│   │   ├── review/[sessionId]/  # Knowledge review + export
│   │   └── chat/[sessionId]/    # Personalized AI chatbot
│   ├── components/
│   │   ├── VoiceRecorder.js     # Audio recording component
│   │   ├── TranscriptPanel.js   # Live transcript display
│   │   └── QuestionCard.js      # AI question display
│   └── package.json
├── DOCS.md                      # This file
└── README.md                    # Setup instructions
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/sessions/create` | Create a new interview session |
| GET | `/api/sessions/{session_id}` | Get session info and conversation |
| POST | `/api/voice/transcribe` | Upload audio, get transcript + next question |
| POST | `/api/text/submit` | Submit text answer, get next question |
| POST | `/api/sessions/{session_id}/finalize` | End interview, generate summary |
| POST | `/api/sessions/{session_id}/export` | Export as pdf, csv, or json |
| GET | `/api/knowledge/{session_id}` | Get all extracted knowledge |
| POST | `/api/knowledge/search` | Semantic search through knowledge |
| POST | `/api/chat` | Chat with personalized AI |
| POST | `/api/tts` | Convert text to Jenny neural voice |

---

## Environment Variables

```env
# AI Backend — choose one
LLM_BACKEND=ollama              # Use Ollama (free, local)
LLM_BACKEND=anthropic           # Use Claude API (requires key)

# Ollama settings (if LLM_BACKEND=ollama)
OLLAMA_MODEL=gemma3:4b
OLLAMA_BASE_URL=http://localhost:11434

# Anthropic settings (if LLM_BACKEND=anthropic)
ANTHROPIC_API_KEY=sk-ant-...

# Whisper model size (tiny/base/small/medium)
WHISPER_MODEL=base

# Qdrant (optional — falls back to in-memory if not running)
QDRANT_HOST=localhost
QDRANT_PORT=6333
```

---

## How to Run

### Backend
```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
cp .env.example .env        # Edit .env with your settings
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Open in browser
```
http://localhost:3001
```

---

## Two Ways to Run AI (No API Key Needed)

### Option 1 — Ollama (Free, Local, Recommended)
```bash
ollama pull gemma3:4b    # Already installed
```
Set in `.env`:
```
LLM_BACKEND=ollama
OLLAMA_MODEL=gemma3:4b
```

### Option 2 — Claude API
Get key from console.anthropic.com
Set in `.env`:
```
LLM_BACKEND=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

---

## User Flow

### Expert (Interviewee)
1. Enter name + topic on home page
2. Click **Start Voice Interview**
3. Click mic → speak answer → click to stop
4. AI transcribes, extracts knowledge, asks next question
5. Repeat 5–10 times
6. Click **Finish Interview**
7. Review knowledge cards + summary
8. Export as **PDF / CSV / JSON**

### Learner (Knowledge Consumer)
1. Open the interview session link
2. Click **Chat with AI**
3. Ask questions about the expert's background, skills, projects
4. AI answers using only what was said in the interview

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Backend | FastAPI, Python 3.11 |
| Speech-to-Text | OpenAI Whisper (via faster-whisper) |
| Text-to-Speech | Microsoft Edge TTS (Jenny Neural) |
| NLP | spaCy (en_core_web_sm) |
| AI / LLM | Ollama (local) or Claude API |
| Vector DB | Qdrant (in-memory or Docker) |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) |
| PDF Export | ReportLab |
| CSV Export | Pandas |
