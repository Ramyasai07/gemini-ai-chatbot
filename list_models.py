#!/usr/bin/env python
"""List available Gemini models"""
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

key = os.getenv('GEMINI_API_KEY')
if not key:
    print("ERROR: GEMINI_API_KEY not found!")
    exit(1)

genai.configure(api_key=key)

print("\n" + "="*60)
print("Available Gemini Models")
print("="*60 + "\n")

try:
    for model in genai.list_models():
        print(f"[OK] {model.name}")
        if 'gemini' in model.name.lower():
            print(f"  - Display Name: {model.display_name}")
            if hasattr(model, 'supported_generation_methods'):
                print(f"  - Methods: {model.supported_generation_methods}")
        print()
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
