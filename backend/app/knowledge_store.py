import uuid
from datetime import datetime
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
)
from app.config import QDRANT_HOST, QDRANT_PORT, EMBEDDING_MODEL, COLLECTION_NAME

_embedder = None
_qdrant = None

def get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(EMBEDDING_MODEL)
    return _embedder

def get_qdrant():
    global _qdrant
    if _qdrant is None:
        try:
            client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
            client.get_collections()  # Actually test the connection
            _qdrant = client
            print(f"Connected to Qdrant at {QDRANT_HOST}:{QDRANT_PORT}")
        except Exception:
            print("Qdrant server not reachable — using in-memory storage instead.")
            _qdrant = QdrantClient(":memory:")
        _ensure_collection(_qdrant)
    return _qdrant

def _ensure_collection(client: QdrantClient):
    collections = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME not in collections:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE),
        )

def store_knowledge(session_id: str, text: str, metadata: dict) -> str:
    embedder = get_embedder()
    client = get_qdrant()

    vector = embedder.encode(text).tolist()
    point_id = str(uuid.uuid4())

    payload = {
        "session_id": session_id,
        "text": text,
        "timestamp": datetime.utcnow().isoformat(),
        **{k: v for k, v in metadata.items() if isinstance(v, (str, int, float, bool))},
    }

    client.upsert(
        collection_name=COLLECTION_NAME,
        points=[PointStruct(id=point_id, vector=vector, payload=payload)],
    )
    return point_id

def store_conversation_chunk(session_id: str, speaker: str, text: str, knowledge: dict):
    metadata = {
        "speaker": speaker,
        "skills": ", ".join(knowledge.get("skills", [])),
        "experience": knowledge.get("experience", ""),
        "type": "conversation_chunk",
    }
    return store_knowledge(session_id, text, metadata)

def store_session_summary(session_id: str, summary: str, knowledge: dict):
    metadata = {
        "type": "session_summary",
        "skills": ", ".join(knowledge.get("skills", [])),
        "experience": knowledge.get("experience", ""),
        "topics": ", ".join(knowledge.get("topics", [])[:10]),
    }
    return store_knowledge(session_id, summary, metadata)

def search_knowledge(session_id: str, query: str, top_k: int = 5) -> list[dict]:
    embedder = get_embedder()
    client = get_qdrant()

    query_vector = embedder.encode(query).tolist()

    results = client.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        query_filter=Filter(
            must=[FieldCondition(key="session_id", match=MatchValue(value=session_id))]
        ),
        limit=top_k,
        with_payload=True,
    )

    return [
        {"text": r.payload.get("text", ""), "score": r.score, "metadata": r.payload}
        for r in results
    ]

def get_all_session_knowledge(session_id: str) -> list[dict]:
    client = get_qdrant()
    results, _ = client.scroll(
        collection_name=COLLECTION_NAME,
        scroll_filter=Filter(
            must=[FieldCondition(key="session_id", match=MatchValue(value=session_id))]
        ),
        limit=100,
        with_payload=True,
    )
    return [{"text": r.payload.get("text", ""), "metadata": r.payload} for r in results]
