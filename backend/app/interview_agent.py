import httpx
import anthropic
from app.config import ANTHROPIC_API_KEY, CLAUDE_MODEL, OLLAMA_MODEL, OLLAMA_BASE_URL, LLM_BACKEND

SYSTEM_PROMPT = """You are Convera, an expert AI interviewer. Your goal is to conduct a professional,
conversational interview to deeply understand the person's background, expertise, experience,
goals, and knowledge.

Guidelines:
- Ask ONE focused question at a time
- Build on what the person has already said
- Dig deeper into interesting areas they mention
- Cover: professional background, skills, projects, achievements, goals, personality
- Be warm, encouraging, and professional
- Keep questions concise and clear
- After enough information is gathered (8-12 exchanges), suggest wrapping up

You will receive the conversation history and extracted knowledge so far."""


def _call_llm(system: str, user: str, max_tokens: int = 256) -> str:
    if LLM_BACKEND == "ollama":
        return _call_ollama(system, user, max_tokens)
    return _call_anthropic(system, user, max_tokens)


def _call_anthropic(system: str, user: str, max_tokens: int) -> str:
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return response.content[0].text.strip()


def _call_ollama(system: str, user: str, max_tokens: int) -> str:
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "stream": False,
        "options": {"num_predict": max_tokens},
    }
    resp = httpx.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload, timeout=60)
    resp.raise_for_status()
    return resp.json()["message"]["content"].strip()


def get_next_question(
    conversation_history: list[dict],
    extracted_knowledge: dict,
    session_topic: str = "general background",
) -> str:
    knowledge_summary = _format_knowledge(extracted_knowledge)
    user_prompt = f"""Interview topic: {session_topic}

Extracted knowledge so far:
{knowledge_summary}

Conversation history:
{_format_history(conversation_history)}

Based on this conversation and what you know so far, what is the single most valuable follow-up question to ask?
Return ONLY the question, nothing else."""
    return _call_llm(SYSTEM_PROMPT, user_prompt, max_tokens=256)


_OPENING_QUESTIONS = {
    "professional": "Hi! I'm Convera, your AI interviewer. Could you start by giving me a quick overview of your professional background and what you currently do?",
    "technical":    "Welcome! Let's explore your technical side. What are the main technologies, tools, or languages you work with day-to-day?",
    "career":       "Great to meet you! Tell me where you are in your career right now and where you'd like to be in the next few years.",
    "research":     "Hello! Let's talk about your research journey. Could you give me an overview of your academic background and the areas you focus on?",
    "startup":      "Hi there! Tell me about your entrepreneurial journey — what have you built, and what problem were you trying to solve?",
    "creative":     "Welcome! I'd love to hear about your creative work. Could you walk me through your background and the kind of projects you're most proud of?",
    "default":      "Hi! I'm Convera, your AI interviewer. To kick things off — could you tell me a little about yourself and what you're currently working on?",
}

def get_opening_question(session_topic: str = "general background") -> str:
    # Use a hardcoded question instantly — no LLM call needed
    topic_lower = session_topic.lower()
    for key in _OPENING_QUESTIONS:
        if key in topic_lower:
            return _OPENING_QUESTIONS[key]
    return _OPENING_QUESTIONS["default"]


def generate_summary(conversation_history: list[dict], extracted_knowledge: dict) -> str:
    knowledge_summary = _format_knowledge(extracted_knowledge)
    history_text = _format_history(conversation_history)
    user_prompt = f"""Based on this interview, create a comprehensive structured summary.

Extracted knowledge:
{knowledge_summary}

Conversation:
{history_text}

Format the summary with these sections:
## Professional Profile
## Key Skills & Expertise
## Experience & Background
## Notable Projects & Achievements
## Goals & Aspirations
## Personality & Working Style"""
    return _call_llm(
        "You are an expert at synthesizing interview information into clear, structured summaries.",
        user_prompt,
        max_tokens=1024,
    )


def _format_history(history: list[dict]) -> str:
    if not history:
        return "No conversation yet."
    lines = []
    for msg in history:
        role = "Interviewer" if msg["role"] == "assistant" else "Interviewee"
        lines.append(f"{role}: {msg['content']}")
    return "\n".join(lines)


def _format_knowledge(knowledge: dict) -> str:
    if not knowledge:
        return "Nothing extracted yet."
    parts = []
    if knowledge.get("skills"):
        parts.append(f"Skills: {', '.join(knowledge['skills'])}")
    if knowledge.get("experience"):
        parts.append(f"Experience: {knowledge['experience']}")
    entities = knowledge.get("entities", {})
    if entities.get("ORG"):
        parts.append(f"Organizations: {', '.join(entities['ORG'][:5])}")
    if entities.get("GPE"):
        parts.append(f"Locations: {', '.join(entities['GPE'][:5])}")
    if knowledge.get("topics"):
        parts.append(f"Topics: {', '.join(knowledge['topics'][:8])}")
    return "\n".join(parts) if parts else "Nothing extracted yet."
