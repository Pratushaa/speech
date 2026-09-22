import os
import sys

API_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(API_DIR)
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")

for path in [BACKEND_DIR, PROJECT_ROOT]:
    if path not in sys.path:
        sys.path.insert(0, path)

from backend.main import (
    app,
    transcribe_audio,
    health_check,
    get_languages,
    get_providers,
    TranscriptionResponse
)

# Bind all endpoints to index as well
for p in ["/transcribe", "/transcribe/", "/api/transcribe", "/api/transcribe/"]:
    if p not in [r.path for r in app.routes if hasattr(r, "path") and "POST" in getattr(r, "methods", [])]:
        app.add_api_route(p, transcribe_audio, methods=["POST"], response_model=TranscriptionResponse, include_in_schema=False)

try:
    from mangum import Mangum
    handler = Mangum(app)
except ImportError:
    handler = app

__all__ = ["app", "handler"]
