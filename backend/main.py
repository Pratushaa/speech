import os
import base64
import time
import logging
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import sys

# Ensure backend and root paths are in sys.path
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
for p in [BACKEND_DIR, PROJECT_ROOT]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from config import settings
    from bhashini_service import bhashini_service, SUPPORTED_LANGUAGES
    from gemini_service import gemini_service
except ImportError:
    from .config import settings
    from .bhashini_service import bhashini_service, SUPPORTED_LANGUAGES
    from .gemini_service import gemini_service

logger = logging.getLogger("speech_app")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Speech Transcription & Translation API",
    description="Multi-Provider Regional Audio Speech-to-Text & Translation (Bhashini AI + Google Gemini)",
    version="1.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json"
)

# Robust CORS Configuration: explicitly lists local frontend dev servers while also permitting wildcards
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*"
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TranscriptionResponse(BaseModel):
    transcription: str
    translation: str
    source_language: Optional[str] = "hi"
    target_language: Optional[str] = "en"
    provider: Optional[str] = "bhashini"
    is_mock: Optional[bool] = False
    model_info: Optional[str] = None
    duration_seconds: Optional[float] = None
    audio_size_bytes: Optional[int] = None


# Mount frontend production build if available
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
if os.path.exists(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/", summary="Application Root / Frontend UI")
@app.get("/api", include_in_schema=False)
@app.get("/api/", include_in_schema=False)
async def root():
    index_html = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.exists(index_html):
        return FileResponse(index_html)
    return {
        "message": "Speech Transcription & Translation API is running",
        "docs_url": "/api/docs",
        "endpoints": ["/api/health", "/api/providers", "/api/languages", "/api/transcribe"]
    }


@app.get("/health", summary="Health Check")
@app.get("/health/", include_in_schema=False)
@app.get("/api/health", include_in_schema=False)
@app.get("/api/health/", include_in_schema=False)
async def health_check():
    """Verify backend status and provider configurations"""
    bhashini_ready = bhashini_service.is_configured()
    gemini_ready = gemini_service.is_configured()

    return {
        "status": "healthy",
        "service": "speech-transcription-api",
        "bhashini_configured": bhashini_ready,
        "gemini_configured": gemini_ready,
        "default_provider": settings.DEFAULT_PROVIDER,
        "mock_mode": settings.MOCK_MODE or (not bhashini_ready and not gemini_ready),
        "timestamp": time.time()
    }


@app.get("/providers", summary="Available AI Providers")
@app.get("/providers/", include_in_schema=False)
@app.get("/api/providers", include_in_schema=False)
@app.get("/api/providers/", include_in_schema=False)
async def get_providers():
    """Returns available speech-to-text and translation engines"""
    return {
        "providers": [
            {
                "id": "auto",
                "name": "Auto / Best Available",
                "description": "Automatically routes to active configured engine",
                "ready": True
            },
            {
                "id": "bhashini",
                "name": "Bhashini AI",
                "description": "Government of India ULCA ASR & NMT Pipeline",
                "ready": bhashini_service.is_configured()
            },
            {
                "id": "gemini",
                "name": "Google Gemini API",
                "description": f"Google Multimodal Audio ({settings.GEMINI_MODEL})",
                "ready": gemini_service.is_configured()
            }
        ]
    }


@app.get("/languages", summary="Supported Languages")
@app.get("/languages/", include_in_schema=False)
@app.get("/api/languages", include_in_schema=False)
@app.get("/api/languages/", include_in_schema=False)
async def get_languages():
    """Return list of supported Indian regional languages"""
    return {
        "languages": SUPPORTED_LANGUAGES,
        "default_source": "auto",
        "default_target": "en"
    }


@app.post("/transcribe", response_model=TranscriptionResponse, summary="Transcribe and Translate Audio")
@app.post("/transcribe/", response_model=TranscriptionResponse, include_in_schema=False)
@app.post("/api/transcribe", response_model=TranscriptionResponse, include_in_schema=False)
@app.post("/api/transcribe/", response_model=TranscriptionResponse, include_in_schema=False)
async def transcribe_audio(
    audio: UploadFile = File(..., description="Audio file (wav, webm, mp3, ogg, m4a, mp4, flac, aac)"),
    source_language: str = Form(default="hi", description="Source regional language code (e.g. hi, bn, ta, te)"),
    target_language: str = Form(default="en", description="Target translation language (defaults to en)"),
    provider: str = Form(default="auto", description="AI Provider: auto | bhashini | gemini")
):
    """
    Accepts an audio file and transcribes regional speech then translates to English
    using either Bhashini AI or Google Gemini API.
    """
    start_time = time.time()
    filename = audio.filename.lower() if audio.filename else "audio.wav"
    content_type = (audio.content_type or "").lower()

    logger.info(
        f"Transcribe request. Filename: {filename}, Content-Type: {content_type}, "
        f"Lang: {source_language}, Requested Provider: {provider}"
    )

    try:
        audio_bytes = await audio.read()
    except Exception as e:
        logger.error(f"Failed to read audio file: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read audio file: {str(e)}"
        )

    if not audio_bytes or len(audio_bytes) < 64:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded audio file is empty or too short."
        )

    # Detect audio format
    audio_format = "wav"
    if "webm" in filename or "webm" in content_type:
        audio_format = "webm"
    elif "mp3" in filename or "mp3" in content_type or "mpeg" in content_type:
        audio_format = "mp3"
    elif "ogg" in filename or "ogg" in content_type or "opus" in content_type:
        audio_format = "ogg"
    elif "mp4" in filename or "mp4" in content_type or "m4a" in filename or "m4a" in content_type:
        audio_format = "mp4"
    elif "flac" in filename or "flac" in content_type:
        audio_format = "flac"
    elif "aac" in filename or "aac" in content_type:
        audio_format = "aac"

    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

    # Resolve active provider
    chosen_provider = provider.lower().strip()
    if chosen_provider == "auto":
        if gemini_service.is_configured():
            chosen_provider = "gemini"
        elif bhashini_service.is_configured():
            chosen_provider = "bhashini"
        else:
            chosen_provider = settings.DEFAULT_PROVIDER if settings.DEFAULT_PROVIDER != "auto" else "gemini"

    try:
        if chosen_provider == "gemini":
            result = await gemini_service.run_audio_pipeline(
                audio_base64=audio_base64,
                source_lang=source_language,
                target_lang=target_language,
                audio_format=audio_format
            )
            used_provider = "gemini"
        else:
            result = await bhashini_service.run_pipeline_inference(
                audio_base64=audio_base64,
                source_lang=source_language,
                target_lang=target_language,
                audio_format=audio_format
            )
            used_provider = "bhashini"

        elapsed_time = round(time.time() - start_time, 2)
        logger.info(
            f"Transcription result: trans='{result.get('transcription')}', "
            f"transl='{result.get('translation')}', mock={result.get('is_mock')}, "
            f"provider={used_provider}, elapsed={elapsed_time}s"
        )

        return TranscriptionResponse(
            transcription=result.get("transcription", ""),
            translation=result.get("translation", ""),
            source_language=result.get("source_language", source_language),
            target_language=result.get("target_language", target_language),
            provider=used_provider,
            is_mock=result.get("is_mock", False),
            model_info=result.get("model_info"),
            duration_seconds=elapsed_time,
            audio_size_bytes=len(audio_bytes)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing transcription pipeline: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing audio with provider '{chosen_provider}': {str(e)}"
        )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Server processing error: {str(exc)}"}
    )
