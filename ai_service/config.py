import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
root_dir = Path(__file__).parent.parent
env_path = root_dir / ".env"
load_dotenv(dotenv_path=env_path)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

WISEAPP_API_URL = os.getenv("WISEAPP_API_URL", "https://api.wiseapp360.com")

AI_SERVICE_PORT = int(os.getenv("AI_SERVICE_PORT", "8000"))

if not GROQ_API_KEY:
    print("Warning: GROQ_API_KEY not set. AI service will not work properly.")
