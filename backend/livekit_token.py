import os
from fastapi import APIRouter, HTTPException
from livekit.api import AccessToken, VideoGrants
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
    print("⚠ Warning: LIVEKIT_API_KEY or LIVEKIT_API_SECRET not set in environment variables.")

@router.get("/livekit-token")
def get_token(identity: str = "student", room: str = "ai-teacher-room"):
    """
    Generate a LiveKit access token for a participant.
    """
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise HTTPException(status_code=500, detail="LiveKit credentials not configured on server.")

    grant = VideoGrants(
        room_join=True,
        room=room,
        can_publish=True,
        can_subscribe=True
    )

    token = AccessToken(
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET
    ).with_identity(identity).with_grants(grant)
    
    return {"token": token.to_jwt(), "url": os.getenv("LIVEKIT_URL")}
