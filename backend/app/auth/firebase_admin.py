from __future__ import annotations

import logging
import os

from app.config import settings

logger = logging.getLogger(__name__)

_firebase_initialized = False


def init_firebase() -> bool:
    """Initialize Firebase Admin SDK. Returns True when auth verification is available."""
    global _firebase_initialized
    if _firebase_initialized:
        return True

    if not settings.firebase_project_id:
        logger.info("Firebase project not configured; auth verification disabled.")
        return False

    if settings.firebase_auth_emulator_host:
        os.environ.setdefault("FIREBASE_AUTH_EMULATOR_HOST", settings.firebase_auth_emulator_host)

    try:
        import firebase_admin
        from firebase_admin import credentials

        if not firebase_admin._apps:
            if settings.firebase_credentials_path:
                cred = credentials.Certificate(settings.firebase_credentials_path)
                firebase_admin.initialize_app(cred, {"projectId": settings.firebase_project_id})
            else:
                firebase_admin.initialize_app(options={"projectId": settings.firebase_project_id})
        _firebase_initialized = True
        logger.info("Firebase Admin initialized (project=%s)", settings.firebase_project_id)
        return True
    except Exception as exc:
        logger.warning("Firebase Admin init failed: %s", exc)
        return False


def verify_id_token(id_token: str) -> dict:
    from firebase_admin import auth

    if not init_firebase():
        raise RuntimeError("Firebase is not configured")
    return auth.verify_id_token(id_token)
