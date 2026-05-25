import httpx
import anthropic
from app.config import ANTHROPIC_API_KEY, CLAUDE_MODEL, OLLAMA_MODEL, OLLAMA_BASE_URL, LLM_BACKEND
from app.knowledge_store import search_knowledge


def chat_with_knowledge(
    session_id: str,
    user_message: str,
    conversation_history: list[dict],
    person_name: str = "the person",
) -> str:
    relevant_chunks = search_knowledge(session_id, user_message, top_k=5)
    context = "\n\n".join(chunk["text"] for chunk in relevant_chunks)

    system_prompt = f"""You are a personalized AI assistant that deeply knows {person_name} based on their interview.
You have access to their background, skills, experience, projects, and goals from the interview.

Here is the relevant knowledge from the interview:
---
{context}
---

Answer questions about {person_name} accurately and helpfully. If asked something not covered in the interview,
say so honestly. Be conversational and insightful."""

    messages = conversation_history[-10:] + [{"role": "user", "content": user_message}]

    if LLM_BACKEND == "ollama":
        return _call_ollama(system_prompt, messages)
    return _call_anthropic(system_prompt, messages)


def _call_anthropic(system: str, messages: list[dict]) -> str:
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1024,
        system=system,
        messages=messages,
    )
    return response.content[0].text.strip()


def _call_ollama(system: str, messages: list[dict]) -> str:
    ollama_messages = [{"role": "system", "content": system}] + messages
    payload = {
        "model": OLLAMA_MODEL,
        "messages": ollama_messages,
        "stream": False,
        "options": {"num_predict": 1024},
    }
    resp = httpx.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload, timeout=60)
    resp.raise_for_status()
    return resp.json()["message"]["content"].strip()
