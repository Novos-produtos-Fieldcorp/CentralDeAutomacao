import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
root_dir = Path(__file__).parent.parent
env_path = root_dir / ".env"
load_dotenv(dotenv_path=env_path)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

# Supabase - usa VITE_ prefix ou sem prefix
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")

WISEAPP_API_URL = os.getenv("WISEAPP_API_URL", "https://chat.wiseapp360.com/api")

AI_SERVICE_PORT = int(os.getenv("AI_SERVICE_PORT", "8000"))

if not GROQ_API_KEY:
    print("Warning: GROQ_API_KEY not set. AI service will not work properly.")
