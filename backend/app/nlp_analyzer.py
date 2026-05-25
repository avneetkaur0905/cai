import re
import spacy
from typing import Optional

_nlp: Optional[spacy.Language] = None

def get_nlp():
    global _nlp
    if _nlp is None:
        try:
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            from spacy.cli import download
            download("en_core_web_sm")
            _nlp = spacy.load("en_core_web_sm")
    return _nlp

SKILL_KEYWORDS = {
    "python", "javascript", "java", "c++", "react", "node", "sql", "ml",
    "machine learning", "deep learning", "aws", "docker", "kubernetes",
    "tensorflow", "pytorch", "fastapi", "django", "flask", "typescript",
    "rust", "go", "scala", "spark", "kafka", "redis", "mongodb", "postgres",
}

def extract_knowledge(text: str) -> dict:
    nlp = get_nlp()
    doc = nlp(text)

    entities = {}
    for ent in doc.ents:
        label = ent.label_
        if label not in entities:
            entities[label] = []
        if ent.text not in entities[label]:
            entities[label].append(ent.text)

    text_lower = text.lower()
    found_skills = [s for s in SKILL_KEYWORDS if s in text_lower]

    experience_patterns = [
        r"(\d+)\s*(?:\+)?\s*years?\s*(?:of\s+)?(?:experience|exp)",
        r"worked\s+(?:for\s+)?(\d+)\s*years?",
        r"(\d+)\s*years?\s+(?:in|at|with)",
    ]
    experience = None
    for pat in experience_patterns:
        m = re.search(pat, text_lower)
        if m:
            experience = f"{m.group(1)} years"
            break

    topics = list({chunk.text.lower() for chunk in doc.noun_chunks if len(chunk.text) > 3})[:15]

    sentences = [sent.text.strip() for sent in doc.sents if len(sent.text.strip()) > 20]

    return {
        "entities": entities,
        "skills": found_skills,
        "experience": experience,
        "topics": topics,
        "key_sentences": sentences[:10],
        "word_count": len(doc),
    }

def merge_knowledge(existing: dict, new_data: dict) -> dict:
    merged = existing.copy()

    for label, values in new_data.get("entities", {}).items():
        if label not in merged.get("entities", {}):
            merged.setdefault("entities", {})[label] = []
        for v in values:
            if v not in merged["entities"][label]:
                merged["entities"][label].append(v)

    existing_skills = set(merged.get("skills", []))
    existing_skills.update(new_data.get("skills", []))
    merged["skills"] = list(existing_skills)

    if new_data.get("experience") and not merged.get("experience"):
        merged["experience"] = new_data["experience"]

    existing_topics = set(merged.get("topics", []))
    existing_topics.update(new_data.get("topics", []))
    merged["topics"] = list(existing_topics)[:20]

    merged["key_sentences"] = (merged.get("key_sentences", []) + new_data.get("key_sentences", []))[:30]

    return merged
