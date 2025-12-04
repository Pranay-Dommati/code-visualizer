"""
Gemini 2.0 Flash LIVE Client
=============================
Async WebSocket client for Gemini Realtime API using service account OAuth.

Connects to:
wss://us-central1-aiplatform.googleapis.com/v1beta1/projects/{PROJECT}/locations/us-central1/publishers/google/models/gemini-2.0-flash-live:streamGenerateContent
"""

import os
import json
import base64
import asyncio
import websockets
from google.oauth2 import service_account
from google.auth.transport.requests import Request

class GeminiLiveClient:
    def __init__(self, service_account_file=None):
        if service_account_file is None:
            service_account_file = os.path.join(os.path.dirname(__file__), "code-visualizer-keys.json")
            
        self.service_account_file = service_account_file
        self.credentials = None
        self.project_id = None
        self.ws = None
        self.is_connected = False
        
        # Load project ID from service account
        try:
            with open(service_account_file, "r") as f:
                data = json.load(f)
                self.project_id = data.get("project_id")
        except FileNotFoundError:
            print(f"Error: Service account file not found at {service_account_file}")
            self.project_id = None
        
    def _get_auth_token(self):
        """Generate OAuth2 Bearer token from service account."""
        scopes = ["https://www.googleapis.com/auth/cloud-platform"]
        
        self.credentials = service_account.Credentials.from_service_account_file(
            self.service_account_file,
            scopes=scopes
        )
        
        if not self.credentials.valid:
            self.credentials.refresh(Request())
            
        return self.credentials.token
    
    async def connect(self):
        """Connect to Gemini 2.0 Flash LIVE WebSocket."""
        token = self._get_auth_token()
        
        # Correct Gemini Live WebSocket URL
        host = "us-central1-aiplatform.googleapis.com"
        uri = (
            f"wss://{host}/v1beta1/projects/{self.project_id}/locations/us-central1/"
            f"publishers/google/models/gemini-2.0-flash-live:streamGenerateContent"
        )
        
        print("Connecting to URI:", uri)

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        try:
            print(f"Connecting to Gemini Live with websockets version: {websockets.__version__}")
            
            # websockets 14.x supports extra_headers natively
            self.ws = await websockets.connect(uri, extra_headers=headers)
                    
            self.is_connected = True
            print("✓ Connected to Gemini 2.0 Flash LIVE")
            
            # Send initial setup message
            await self._send_setup()
            return True

        except Exception as e:
            print(f"✗ Failed to connect to Gemini Live: {e}")
            self.is_connected = False
            return False
    
    async def _send_setup(self):
        """Send initial session configuration for Gemini Live."""
        setup_msg = {
            "setup": {
                "model": "models/gemini-2.0-flash-live",
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

Explain concepts step-by-step and send JSON drawing commands such as:
{"action": "draw_node", "id": "n1", "x": 100, "y": 200, "value": "5"}
{"action": "connect_nodes", "from": "n1", "to": "n2"}
{"action": "update_node", "id": "n1", "highlight": true}
{"action": "clear_canvas"}

Always speak clearly while drawing."""
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
        print("→ Sent text:", text)
    
    async def receive(self):
        """Receive messages from Gemini Live."""
        if not self.ws or not self.is_connected:
            return None
            
        try:
            response = await self.ws.recv()
            return json.loads(response)
        except websockets.exceptions.ConnectionClosed:
            self.is_connected = False
            print("⚠ Gemini WebSocket closed")
            return None
        except Exception as e:
            print("Receive error:", e)
            return None
    
    async def close(self):
        """Close the WebSocket connection."""
        if self.ws:
            await self.ws.close()
        self.is_connected = False
        print("Gemini Live connection closed")
