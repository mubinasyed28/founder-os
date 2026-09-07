import jwt
import hashlib
import os
from typing import Optional
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from backend.config import settings
from backend.database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def hash_password(password: str) -> str:
    """Hashes a password using SHA-256 with salt."""
    salt = "cofoundr_salt_2026"
    return hashlib.sha256((password + salt).encode("utf-8")).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password

def create_access_token(user_id: str, username: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRATION_MINUTES)
    payload = {
        "sub": user_id,
        "username": username,
        "exp": expire
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token

async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    db = await get_db()
    from bson import ObjectId
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise credentials_exception

    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "username": user["username"],
        "avatar_url": user.get("avatar_url"),
        "created_at": user.get("created_at", datetime.utcnow())
    }

async def get_optional_current_user(token: Optional[str] = Depends(optional_oauth2_scheme)) -> dict:
    if not token:
        return {
            "id": "guest_session_user",
            "email": "guest@cofoundr.os",
            "username": "guest_founder",
            "avatar_url": None,
            "created_at": datetime.utcnow()
        }
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id:
            db = await get_db()
            from bson import ObjectId
            if ObjectId.is_valid(user_id):
                user = await db.users.find_one({"_id": ObjectId(user_id)})
                if user:
                    return {
                        "id": str(user["_id"]),
                        "email": user["email"],
                        "username": user["username"],
                        "avatar_url": user.get("avatar_url"),
                        "created_at": user.get("created_at", datetime.utcnow())
                    }
    except Exception:
        pass

    return {
        "id": "guest_session_user",
        "email": "guest@cofoundr.os",
        "username": "guest_founder",
        "avatar_url": None,
        "created_at": datetime.utcnow()
    }

