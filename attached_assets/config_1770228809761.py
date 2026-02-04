import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
NODE_API_URL = os.getenv("NODE_API_URL", "http://localhost:5000")
AI_SERVICE_TOKEN = os.getenv("AI_SERVICE_TOKEN", "zib-ai-service-secret-token")

GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile")

if not GROQ_API_KEY:
    print("Warning: GROQ_API_KEY not set. AI service will not work properly.")
