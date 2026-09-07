from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime
from backend.models import UserCreate, UserLogin, UserOut, TokenResponse
from backend.auth import hash_password, verify_password, create_access_token, get_current_user
from backend.database import get_db

router = APIRouter(prefix="/api/auth", tags=["Auth"])

@router.post("/signup", response_model=TokenResponse)
async def signup(user_in: UserCreate):
    db = await get_db()
    
    # Check if email exists
    existing_email = await db.users.find_one({"email": user_in.email.lower()})
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists."
        )

    # Check if username exists
    existing_user = await db.users.find_one({"username": user_in.username.lower()})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken."
        )

    new_user = {
        "email": user_in.email.lower(),
        "username": user_in.username.lower(),
        "password_hash": hash_password(user_in.password),
        "created_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(new_user)
    user_id = str(result.inserted_id)

    token = create_access_token(user_id=user_id, username=user_in.username)

    user_out = UserOut(
        id=user_id,
        email=new_user["email"],
        username=new_user["username"],
        avatar_url=new_user.get("avatar_url"),
        created_at=new_user["created_at"]
    )

    return TokenResponse(access_token=token, user=user_out)

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    db = await get_db()
    query = credentials.username_or_email.lower()
    
    user = await db.users.find_one({
        "$or": [{"email": query}, {"username": query}]
    })

    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password."
        )

    user_id = str(user["_id"])
    token = create_access_token(user_id=user_id, username=user["username"])

    user_out = UserOut(
        id=user_id,
        email=user["email"],
        username=user["username"],
        avatar_url=user.get("avatar_url"),
        created_at=user.get("created_at", datetime.utcnow())
    )

    return TokenResponse(access_token=token, user=user_out)

@router.get("/me", response_model=UserOut)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserOut(**current_user)
