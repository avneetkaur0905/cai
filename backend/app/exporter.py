import os
import csv
import json
import pandas as pd
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from app.config import EXPORT_DIR

os.makedirs(EXPORT_DIR, exist_ok=True)

def export_pdf(session_id: str, summary: str, knowledge: dict, conversation: list[dict]) -> str:
    filepath = os.path.join(EXPORT_DIR, f"{session_id}_report.pdf")
    doc = SimpleDocTemplate(filepath, pagesize=letter, topMargin=0.75*inch, bottomMargin=0.75*inch)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Title"], textColor=HexColor("#1a1a2e"), fontSize=24)
    heading_style = ParagraphStyle("Heading", parent=styles["Heading2"], textColor=HexColor("#16213e"), fontSize=14)
    body_style = ParagraphStyle("Body", parent=styles["Normal"], fontSize=11, leading=16)

    story = []

    story.append(Paragraph("Convera AI — Interview Report", title_style))
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph(f"Session: {session_id} | Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", body_style))
    story.append(Spacer(1, 0.3*inch))

    story.append(Paragraph("Summary", heading_style))
    story.append(Spacer(1, 0.1*inch))
    for line in summary.split("\n"):
        line = line.strip()
        if line.startswith("##"):
            story.append(Paragraph(line.replace("##", "").strip(), heading_style))
        elif line:
            story.append(Paragraph(line, body_style))
        story.append(Spacer(1, 0.05*inch))

    if knowledge.get("skills"):
        story.append(Spacer(1, 0.2*inch))
        story.append(Paragraph("Skills & Technologies", heading_style))
        skills_data = [knowledge["skills"][i:i+4] for i in range(0, len(knowledge["skills"]), 4)]
        t = Table([[Paragraph(s, body_style) for s in row] for row in skills_data], colWidths=[1.5*inch]*4)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), HexColor("#f0f4ff")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(t)

    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("Interview Transcript", heading_style))
    story.append(Spacer(1, 0.1*inch))
    for msg in conversation:
        role = "Interviewer" if msg["role"] == "assistant" else "Interviewee"
        story.append(Paragraph(f"<b>{role}:</b> {msg['content']}", body_style))
        story.append(Spacer(1, 0.08*inch))

    doc.build(story)
    return filepath

def export_csv(session_id: str, knowledge: dict, conversation: list[dict]) -> str:
    filepath = os.path.join(EXPORT_DIR, f"{session_id}_data.csv")
    rows = []
    for msg in conversation:
        rows.append({
            "session_id": session_id,
            "role": msg["role"],
            "content": msg["content"],
            "skills": ", ".join(knowledge.get("skills", [])),
            "experience": knowledge.get("experience", ""),
            "topics": ", ".join(knowledge.get("topics", [])[:5]),
        })
    pd.DataFrame(rows).to_csv(filepath, index=False)
    return filepath

def export_json(session_id: str, knowledge: dict, conversation: list[dict], summary: str) -> str:
    filepath = os.path.join(EXPORT_DIR, f"{session_id}_knowledge.json")
    data = {
        "session_id": session_id,
        "generated_at": datetime.now().isoformat(),
        "summary": summary,
        "knowledge": knowledge,
        "conversation": conversation,
    }
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)
    return filepath
