import json
import os
import sys
import urllib.request
from google.oauth2 import service_account
from google.auth.transport.requests import Request

# --- CONFIGURATION ---
# 1. Force the correct Region and API Version
REGION = "global"  # use global location per provisioning suggestion
API_VERSION = "v1beta1"  # Gemini requires beta for now

# 2. Force the correct Key Path (Relative to this script)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
KEY_PATH = os.path.join(BASE_DIR, 'code-visualizer-keys.json')
# ---------------------

def print_key_info():
    """Print sanitized credential info from the service-account JSON."""
    try:
        with open(KEY_PATH, 'r') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"❌ ERROR: Key file not found at {KEY_PATH}")
        return
    except json.JSONDecodeError as e:
        print(f"❌ ERROR: Key file JSON invalid: {e}")
        return

    # Sanitize sensitive fields
    private_key_id = data.get('private_key_id')
    private_key = data.get('private_key')
    client_email = data.get('client_email')
    project_id = data.get('project_id')

    masked_key_id = (private_key_id[:6] + '...' + private_key_id[-6:]) if private_key_id else None
    masked_private_key = None
    if private_key:
        # Show only header + tail marker
        masked_private_key = '-----BEGIN PRIVATE KEY-----...<redacted>...-----END PRIVATE KEY-----'

    print("--- Service Account JSON (sanitized) ---")
    print(f"project_id: {project_id}")
    print(f"client_email: {client_email}")
    print(f"private_key_id: {masked_key_id}")
    print(f"private_key: {masked_private_key}")
    print(f"token_uri: {data.get('token_uri')}")
    print(f"auth_uri: {data.get('auth_uri')}")
    print(f"auth_provider_x509_cert_url: {data.get('auth_provider_x509_cert_url')}")
    print(f"client_id: {data.get('client_id')}")
    print("----------------------------------------")

def get_credentials():
    print(f"DEBUG: Reading key file from: {KEY_PATH}")
    if not os.path.exists(KEY_PATH):
        print("❌ ERROR: Key file not found. Check the file name!")
        sys.exit(1)
        
    creds = service_account.Credentials.from_service_account_file(
        KEY_PATH, 
        scopes=['https://www.googleapis.com/auth/cloud-platform']
    )
    if not creds.valid:
        creds.refresh(Request())
    
    # Verify Project ID inside the file
    with open(KEY_PATH, 'r') as f:
        pid = json.load(f).get('project_id')
        print(f"DEBUG: Key file belongs to Project ID: '{pid}'")
        
    return creds.token, pid

def list_models(project_id, token):
    # This URL structure is CRITICAL for Vertex AI
    # It MUST start with {region}-aiplatform.googleapis.com
    # Use us-central1 host with global location
    host = f"us-central1-aiplatform.googleapis.com"
    url = f"https://{host}/{API_VERSION}/projects/{project_id}/locations/{REGION}/publishers/google/models"
    
    print(f"DEBUG: Connecting to: {url}")
    
    req = urllib.request.Request(url)
    req.add_header('Authorization', f'Bearer {token}')
    req.add_header('Content-Type', 'application/json')
    
    try:
        with urllib.request.urlopen(req) as response:
            return json.load(response)
    except urllib.error.HTTPError as e:
        print(f"\n❌ HTTP Error {e.code}: {e.reason}")
        print(f"   Server response: {e.read().decode('utf-8')[:200]}...")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Connection Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("--- Starting Vertex AI Connection Check ---")
    print_key_info()
    token, project_id = get_credentials()
    
    print("--- Sending Request ---")
    data = list_models(project_id, token)
    
    print("\n✅ SUCCESS! Connection Established.")
    print("Available Gemini Models:")
    
    found_flash = False
    for model in data.get('models', []):
        name = model.get('name', '').split('/')[-1]
        if 'gemini' in name:
            print(f"  • {name}")
        if 'gemini-2.0-flash' in name:
            found_flash = True
            
    if not found_flash:
        print("\n⚠️ NOTE: 'gemini-2.0-flash-exp' might not be in the list yet.")
        print("   (It's an experimental model, sometimes hidden from standard lists, but still usable via API).")
    
