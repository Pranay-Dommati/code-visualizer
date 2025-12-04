"""
Gemini 2.0 Flash LIVE Client
=============================
Async WebSocket client for Gemini Realtime API using service account OAuth.

Connects to: wss://us-central1-aiplatform.googleapis.com/v1beta1/projects/{PROJECT}/locations/us-central1/publishers/google/models/gemini-2.0-flash-live:streamGenerateContent
"""

import os
import json
import base64
import asyncio
import websockets
from google.oauth2 import service_account
from google.auth.transport.requests import Request

class GeminiLiveClient:
    def __init__(self, service_account_file="code-visualizer-keys.json"):
        self.service_account_file = service_account_file
        self.credentials = None
        self.project_id = None
        self.ws = None
        self.is_connected = False
        
        # Load project ID from service account
        with open(service_account_file, "r") as f:
            data = json.load(f)
            self.project_id = data.get("project_id")
        
    def _get_auth_token(self):
        """Generate OAuth2 Bearer token from service account."""
        scopes = ["https://www.googleapis.com/auth/cloud-platform"]
        
        self.credentials = service_account.Credentials.from_service_account_file(
            self.service_account_file,
            scopes=scopes
        )
        
        # Refresh if expired
        if not self.credentials.valid:
            self.credentials.refresh(Request())
            
        return self.credentials.token
    
    async def connect(self):
        """Connect to Gemini 2.0 Flash LIVE WebSocket."""
        token = self._get_auth_token()
        
        # Gemini Live WebSocket URL
        host = "us-central1-aiplatform.googleapis.com"
        uri = f"wss://{host}/v1beta1/projects/{self.project_id}/locations/us-central1/publishers/google/models/gemini-2.0-flash-exp:streamGenerateContent"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        try:
            # Try with extra_headers (standard for newer websockets)
            print(f"Connecting to Gemini Live with websockets version: {websockets.__version__}")
            try:
                self.ws = await websockets.connect(uri, extra_headers=headers)
            except TypeError as e:
                if "unexpected keyword argument 'extra_headers'" in str(e):
                    print("⚠ Older websockets detected, trying 'additional_headers'...")
                    # Fallback for older versions or specific loop issues
                    self.ws = await websockets.connect(uri, additional_headers=headers)
                else:
                    raise e
                    
            self.is_connected = True
            print(f"✓ Connected to Gemini 2.0 Flash LIVE")
            
            # Send initial setup message
            await self._send_setup()
            
            return True
        except Exception as e:
            print(f"✗ Failed to connect to Gemini Live: {e}")
            self.is_connected = False
            return False
    
    async def _send_setup(self):
        """Send initial session configuration."""
        setup_msg = {
            "setup": {
                "model": "models/gemini-2.0-flash-exp",
                "generation_config": {
                    "response_modalities": ["AUDIO", "TEXT"],
                    "speech_config": {
                        "voice_config": {
                            "prebuilt_voice_config": {
                                "voice_name": "Puck"
                            }
                        }
                    }
                },
                "system_instruction": {
                    "parts": [{
                        "text": """You are an AI Teacher that explains Data Structures and Algorithms visually.

When explaining concepts:
1. Speak naturally and clearly
2. Send JSON drawing commands to visualize on a canvas
3. Step through algorithms visually

Drawing commands (send as JSON on separate lines):
{"action": "draw_node", "id": "n1", "x": 100, "y": 200, "value": "5"}
{"action": "connect_nodes", "from": "n1", "to": "n2"}
{"action": "update_node", "id": "n1", "highlight": true}
{"action": "clear_canvas"}

Always visualize your explanations step by step."""
                    }]
                }
            }
        }
        
        await self.ws.send(json.dumps(setup_msg))
        print("✓ Sent setup configuration")
    
    async def send_audio(self, pcm_data: bytes):
        """Send PCM16 audio to Gemini Live."""
        if not self.ws or not self.is_connected:
            return
            
        msg = {
            "realtime_input": {
                "media_chunks": [{
                    "mime_type": "audio/pcm;rate=16000",
                    "data": base64.b64encode(pcm_data).decode("utf-8")
                }]
            }
        }
        
        await self.ws.send(json.dumps(msg))
    
    async def send_text(self, text: str):
        """Send text input to Gemini Live."""
        if not self.ws or not self.is_connected:
            return
            
        msg = {
            "client_content": {
                "turns": [{
                    "role": "user",
                    "parts": [{"text": text}]
                }],
                "turn_complete": True
            }
        }
        
        await self.ws.send(json.dumps(msg))
        print(f"→ Sent text: {text}")
    
    async def receive(self):
        """Receive message from Gemini Live."""
        if not self.ws or not self.is_connected:
            return None
            
        try:
            response = await self.ws.recv()
            return json.loads(response)
        except websockets.exceptions.ConnectionClosed:
            self.is_connected = False
            return None
        except Exception as e:
            print(f"Receive error: {e}")
            return None
    
    async def close(self):
        """Close the WebSocket connection."""
        if self.ws:
            await self.ws.close()
        self.is_connected = False
        print("Gemini Live connection closed")
