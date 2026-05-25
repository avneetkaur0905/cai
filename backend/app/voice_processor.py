import os
import subprocess
import tempfile
from faster_whisper import WhisperModel
from app.config import WHISPER_MODEL

_model = None

def get_whisper_model():
    global _model
    if _model is None:
        print("Loading Whisper model (first time takes ~30s, downloading if needed)...")
        _model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
        print("Whisper model ready.")
    return _model

def convert_to_wav(input_path: str) -> str:
    """Convert any audio format to 16kHz mono wav using ffmpeg."""
    output_path = input_path + "_converted.wav"
    try:
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", input_path, "-ar", "16000", "-ac", "1", output_path],
            capture_output=True,
            timeout=30,
        )
        if result.returncode == 0 and os.path.exists(output_path):
            return output_path
        else:
            print(f"ffmpeg error: {result.stderr.decode()}")
    except FileNotFoundError:
        print("ffmpeg not found — install it with: brew install ffmpeg")
    except subprocess.TimeoutExpired:
        print("ffmpeg conversion timed out")
    return input_path  # fallback to original

def transcribe_audio(audio_bytes: bytes, file_extension: str = "wav") -> dict:
    if not audio_bytes or len(audio_bytes) < 100:
        raise ValueError("Audio is empty or too short. Please record a longer answer.")

    model = get_whisper_model()
    suffix = f".{file_extension}" if not file_extension.startswith(".") else file_extension

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    converted_path = None
    try:
        # Convert to wav for better whisper compatibility
        if file_extension.lower() not in ("wav",):
            converted_path = convert_to_wav(tmp_path)
            process_path = converted_path
        else:
            process_path = tmp_path

        segments, info = model.transcribe(process_path, beam_size=5, language="en")
        transcript = " ".join(seg.text.strip() for seg in segments)
        return {
            "transcript": transcript.strip(),
            "language": info.language,
            "language_probability": round(info.language_probability, 3),
        }
    finally:
        for path in [tmp_path, converted_path]:
            if path and os.path.exists(path):
                try:
                    os.unlink(path)
                except Exception:
                    pass
