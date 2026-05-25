# Convera AI — Voice-Powered Knowledge System

## Pipeline
Voice Input → Whisper STT → NLP Analysis → AI Interview Agent → Qdrant Vector DB → Export (PDF/CSV/JSON) → Personalized Chatbot

## Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Qdrant (Optional — runs in-memory by default)
```bash
docker run -p 6333:6333 qdrant/qdrant
```

## Architecture
- **Voice Processor** (faster-whisper): STT, runs locally
- **NLP Analyzer** (spaCy): Entity/skill/topic extraction
- **Interview Agent** (Claude claude-sonnet-4-6): Dynamic question generation
- **Knowledge Store** (Qdrant + sentence-transformers): Vector embeddings
- **Chat Agent** (Claude): RAG-based personalized chatbot
- **Exporter**: PDF (ReportLab), CSV (Pandas), JSON

## API Docs
http://localhost:8000/docs
