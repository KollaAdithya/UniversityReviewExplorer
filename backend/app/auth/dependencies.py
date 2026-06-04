from __future__ import annotations

from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.firebase_admin import verify_id_token
from app.config import settings
from app.db.models import AppUser
from app.db.session import get_db

bearer_scheme = HTTPBearer(auto_error=False)


def _upsert_user(db: Session, firebase_uid: str, email: Optional[str], display_name: Optional[str]) -> AppUser:
    user = db.query(AppUser).filter(AppUser.firebase_uid == firebase_uid).first()
    if user:
        if email and user.email != email:
            user.email = email
        if display_name and user.display_name != display_name:
            user.display_name = display_name
        db.commit()
        db.refresh(user)
        return user

    user = AppUser(
        firebase_uid=firebase_uid,
        email=email or f"{firebase_uid}@users.local",
        display_name=display_name or (email.split("@")[0] if email else "Student"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_current_user_optional(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)],
    db: Session = Depends(get_db),
) -> Optional[AppUser]:
    if not credentials or credentials.scheme.lower() != "bearer":
        return None

    token = credentials.credentials

    if settings.auth_dev_token and token == settings.auth_dev_token:
        return _upsert_user(
            db,
            firebase_uid="dev-verifier",
            email="verifier@local.test",
            display_name="Verifier",
        )

    try:
        claims = verify_id_token(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid auth token: {exc}",
        ) from exc

    return _upsert_user(
        db,
        firebase_uid=claims["uid"],
        email=claims.get("email"),
        display_name=claims.get("name"),
    )


def require_auth(
    user: Annotated[Optional[AppUser], Depends(get_current_user_optional)],
) -> AppUser:
    if not settings.auth_required:
        raise HTTPException(status_code=500, detail="Auth misconfigured: auth_required is false")
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Sign in to submit a review.",
        )
    return user
