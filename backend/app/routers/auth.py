from typing import Optional

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user_optional
from app.db.models import AppUser
from app.schemas import UserResponse

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.get("/me", response_model=UserResponse)
def get_me(user: Optional[AppUser] = Depends(get_current_user_optional)):
    if user is None:
        return UserResponse(authenticated=False)
    return UserResponse(
        authenticated=True,
        user_id=user.user_id,
        email=user.email,
        display_name=user.display_name,
    )
