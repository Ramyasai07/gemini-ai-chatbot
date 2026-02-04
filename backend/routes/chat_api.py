# THIS FILE IS DISABLED.
# All chat API logic is now handled in backend/routes/chat.py using GeminiService.
# This prevents endpoint confusion and import errors.
#
# Please use /api/v1/chat endpoint as defined in chat.py for all chat operations.

# (Original code commented out for reference)
# from flask import Blueprint, request, Response
# import os
# from google import genai
# from google.genai import types
#
# chat_api = Blueprint('chat_api', __name__, url_prefix='/api/chat')
#
# # Use the NEW Client syntax
# client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))
#
# @chat_api.route('/send', methods=['POST', 'OPTIONS'])
# def send_message():
#     if request.method == 'OPTIONS':
#         return '', 204
#     try:
#         data = request.get_json()
#         message = data.get('message', '')
#         history = data.get('conversation', [])
#         
#         # 1. Prepare history and fix Role Mismatch
#         # Gemini expects: user -> model -> user -> model
#         formatted_history = []
#         for turn in history[:-1]: # Exclude the current message to avoid duplicates
#             role = "model" if turn.get("role") == "assistant" else "user"
#             content = turn.get("content", "").strip()
#             if content:
#                 formatted_history.append(types.Content(role=role, parts=[types.Part(text=content)]))
#
#         def generate():
#             try:
#                 # 2. Use the new generate_content_stream method
#                 # This is specifically optimized for Gemini 2.0
#                 chunks = client.models.generate_content_stream(
#                     model='gemini-2.0-flash-exp',
#                     contents=message,
#                     config=types.GenerateContentConfig(
#                         tools=[types.Tool(google_search=types.GoogleSearchRetrieval())],
#                         history=formatted_history
#                     )
#                 )
#                 
#                 for chunk in chunks:
#                     if chunk.text:
#                         yield chunk.text
#             except Exception as e:
#                 yield f"\n[Stream Error]: {str(e)}"
#
#         return Response(generate(), mimetype='text/plain')
#     
#     except Exception as e:
#         import traceback
#         traceback.print_exc()
#         return Response(f"Backend Error: {str(e)}", status=500, mimetype='text/plain')
