import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
# Set LLM_BACKEND to "ollama" to run fully locally without any API key
LLM_BACKEND = os.getenv("LLM_BACKEND", "anthropic")
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
COLLECTION_NAME = "convera_knowledge"
EXPORT_DIR = "exports"
