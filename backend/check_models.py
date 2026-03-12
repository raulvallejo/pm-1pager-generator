"""
check_models.py — lists all Gemini models available for your API key.

Usage (from the backend folder, with .venv active):
    python check_models.py
"""

import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise SystemExit("GOOGLE_API_KEY not found — make sure backend/.env exists and has the key.")

genai.configure(api_key=api_key)

print(f"{'Model name':<45} {'Supported methods'}")
print("-" * 75)
for model in genai.list_models():
    methods = ", ".join(model.supported_generation_methods)
    print(f"{model.name:<45} {methods}")
