import os
import asyncio
from fastapi import APIRouter, HTTPException
from livekit.api import AccessToken, VideoGrants, LiveKitAPI, CreateAgentDispatchRequest
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")

if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
    print("⚠ Warning: LIVEKIT_API_KEY or LIVEKIT_API_SECRET not set in environment variables.")


async def dispatch_agent_to_room(room_name: str):
    """Dispatch an agent to join the specified room."""
    try:
        # Create LiveKit API client
        livekit_api = LiveKitAPI(
            url=LIVEKIT_URL,
            api_key=LIVEKIT_API_KEY,
            api_secret=LIVEKIT_API_SECRET
        )
        
        # Create agent dispatch request
        dispatch_request = CreateAgentDispatchRequest(
            room=room_name,
            agent_name=""  # Empty string means use default agent
        )
        
        # Dispatch the agent
        dispatch = await livekit_api.agent_dispatch.create_dispatch(dispatch_request)
        print(f"✅ Agent dispatched to room: {room_name}, dispatch_id: {dispatch.id if hasattr(dispatch, 'id') else 'unknown'}")
        await livekit_api.aclose()
        return True
    except Exception as e:
        print(f"⚠️ Failed to dispatch agent: {e}")
        return False


@router.get("/livekit-token")
async def get_token(identity: str = "student", room: str = "ai-teacher-room"):
    """
    Generate a LiveKit access token for a participant and dispatch an agent.
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
    
    # Dispatch agent to the room when user requests a token
    await dispatch_agent_to_room(room)
    
    return {"token": token.to_jwt(), "url": LIVEKIT_URL}
