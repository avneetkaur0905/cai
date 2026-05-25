# Convera AI — System Flow Diagram

```mermaid
flowchart LR
    %% Input
    A(["🎙️ Voice Input\nMediaRecorder API"]):::red
    B(["📝 Text Input\nFallback Mode"]):::red

    %% Speech Processing
    C(["🔊 Whisper STT\nfaster-whisper"]):::blue
    D(["🧬 NLP Analysis\nspaCy"]):::blue

    %% AI Brain
    E(["🤖 Interview Agent\nOllama / Claude"]):::purple
    F(["🔈 AI Voice\nEdge-TTS Jenny"]):::purple

    %% Knowledge Store
    G(["🔢 Embeddings\nsentence-transformers"]):::green
    H(["🗄️ Qdrant DB\nVector Storage"]):::green

    %% Output
    I(["📋 Summary\nAI Generated"]):::teal
    J(["💬 AI Chatbot\nRAG Powered"]):::teal

    %% Export
    K(["📄 PDF\nReportLab"]):::gray
    L(["📊 CSV\nPandas"]):::gray
    M(["🗂️ JSON\nStructured"]):::gray

    %% Connections
    A --> C
    B --> D
    C --> D
    D --> E
    E --> F
    E --> G
    G --> H
    H --> I
    H --> J
    I --> K
    I --> L
    I --> M

    %% Styles
    classDef red    fill:#3d1a22,stroke:#e94560,color:#fff
    classDef blue   fill:#0f2035,stroke:#63a0ff,color:#fff
    classDef purple fill:#1e1535,stroke:#b39dff,color:#fff
    classDef green  fill:#0f2e1e,stroke:#4ade80,color:#fff
    classDef teal   fill:#0f2828,stroke:#2dd4bf,color:#fff
    classDef gray   fill:#1a1a2e,stroke:#555,color:#aaa
```

---

## Pipeline Summary

| Stage | Module | Technology |
|---|---|---|
| 🎙️ Voice Input | Browser recording | MediaRecorder API |
| 📝 Text Input | Fallback typing | Textarea |
| 🔊 Speech to Text | Audio → transcript | faster-whisper |
| 🧬 NLP Analysis | Skills, entities, topics | spaCy |
| 🤖 Interview Agent | Generates questions | Ollama / Claude |
| 🔈 AI Voice | Speaks questions aloud | Edge-TTS (Jenny Neural) |
| 🔢 Embeddings | Text → vectors | sentence-transformers |
| 🗄️ Vector Storage | Store & search knowledge | Qdrant |
| 📋 Summary | AI-generated profile | Ollama / Claude |
| 💬 AI Chatbot | Personalized assistant | RAG pipeline |
| 📄 Export PDF | Interview report | ReportLab |
| 📊 Export CSV | Spreadsheet data | Pandas |
| 🗂️ Export JSON | Structured knowledge | Python JSON |
