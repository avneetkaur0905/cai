import edge_tts

VOICE = "en-US-JennyNeural"

async def synthesize(text: str) -> bytes:
    """Convert text to speech using Microsoft Edge TTS (Jenny neural voice)."""
    communicate = edge_tts.Communicate(text, VOICE)
    audio_data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data += chunk["data"]
    return audio_data
