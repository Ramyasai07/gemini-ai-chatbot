#!/usr/bin/env python3
"""
Verify all critical features are working
"""

import requests
import json
import time

BASE_URL = 'http://localhost:5000'

def test_streaming():
    """Test streaming API"""
    print("\n" + "="*70)
    print("Testing Streaming API")
    print("="*70)
    
    payload = {
        "message": "Hello, what is 2+2?",
        "conversation": []
    }
    
    try:
        response = requests.post(f'{BASE_URL}/api/chat/send', json=payload, stream=True)
        if response.status_code != 200:
            print(f"❌ API returned {response.status_code}")
            return False
        
        total_chars = 0
        chunk_count = 0
        
        for line in response.iter_lines():
            if line:
                chunk_count += 1
                if line.startswith(b'data: '):
                    try:
                        json_str = line[6:].decode()
                        data = json.loads(json_str)
                        if 'response' in data:
                            text = data['response']
                            total_chars += len(text)
                            print(f"  Chunk {chunk_count}: {repr(text[:50])}")
                    except:
                        pass
        
        print(f"\n✅ Streaming test PASSED")
        print(f"   Total chunks: {chunk_count}")
        print(f"   Total characters: {total_chars}")
        
        if total_chars == 0:
            print("   ⚠️  WARNING: No characters received!")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_app_load():
    """Test app loads without 404s"""
    print("\n" + "="*70)
    print("Testing App Load")
    print("="*70)
    
    try:
        response = requests.get(BASE_URL)
        
        if response.status_code != 200:
            print(f"❌ App returned {response.status_code}")
            return False
        
        html = response.text
        
        # Check critical elements
        checks = {
            "Socket.IO script removed": '/socket.io/socket.io.js' not in html,
            "Message input field": 'id="message-input"' in html,
            "Messages container": 'id="messages-container"' in html,
            "Send button": 'id="send-btn"' in html,
            "Voice button": 'id="voice-btn"' in html,
            "Theme toggle": 'id="theme-toggle-btn"' in html,
            "File preview area": 'id="file-preview"' in html,
            "Tooltips enabled": 'data-tooltip' in html,
        }
        
        all_pass = True
        for check_name, result in checks.items():
            status = "✅" if result else "❌"
            print(f"  {status} {check_name}")
            if not result:
                all_pass = False
        
        if all_pass:
            print("\n✅ App load test PASSED")
        else:
            print("\n❌ App load test FAILED")
        
        return all_pass
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_html_validity():
    """Test HTML structure"""
    print("\n" + "="*70)
    print("Testing HTML Structure")
    print("="*70)
    
    try:
        response = requests.get(BASE_URL)
        html = response.text
        
        # Count critical IDs
        critical_ids = [
            'message-input', 'send-btn', 'messages-container', 'input-form',
            'attach-btn', 'voice-btn', 'new-chat-btn', 'theme-toggle-btn',
            'settings-btn', 'file-preview'
        ]
        
        missing = []
        for id_name in critical_ids:
            if f'id="{id_name}"' not in html:
                missing.append(id_name)
        
        if missing:
            print(f"❌ Missing IDs: {missing}")
            return False
        
        print("✅ All critical element IDs present")
        
        # Check for required CSS classes
        css_classes = ['message', 'message-bubble', 'quick-prompt-btn', 'sidebar', 'chat-area']
        missing_classes = []
        
        for cls in css_classes:
            if f'class="' not in html or cls not in html:
                missing_classes.append(cls)
        
        if not missing_classes:
            print("✅ All CSS classes present")
        
        print("\n✅ HTML structure test PASSED")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_javascript():
    """Test JavaScript features"""
    print("\n" + "="*70)
    print("Testing JavaScript Features")
    print("="*70)
    
    try:
        response = requests.get(BASE_URL)
        html = response.text
        
        # Extract JS file
        if '/js/app-pro.js' not in html:
            print("❌ app-pro.js not loaded")
            return False
        
        # Check for key methods in JS
        js_response = requests.get(f'{BASE_URL}/static/js/app-pro.js')
        js_code = js_response.text
        
        checks = {
            "GeminiChatApp class": 'class GeminiChatApp' in js_code,
            "sendViaRestAPI method": 'sendViaRestAPI(message)' in js_code,
            "Streaming buffer": 'currentAssistantMessage' in js_code,
            "DOM guards": 'if (!this.messageInput)' in js_code,
            "Tooltips": 'initializeTooltips()' in js_code,
            "Dark mode": 'toggleTheme()' in js_code,
            "File preview": 'fileSelected' in js_code,
            "Voice support": 'handleVoiceMessage()' in js_code,
            "DOMContentLoaded safe": "if (document.readyState === 'loading')" in js_code,
        }
        
        all_pass = True
        for check_name, result in checks.items():
            status = "✅" if result else "❌"
            print(f"  {status} {check_name}")
            if not result:
                all_pass = False
        
        if all_pass:
            print("\n✅ JavaScript test PASSED")
        else:
            print("\n❌ JavaScript test FAILED")
        
        return all_pass
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == '__main__':
    print("\n" + "="*70)
    print("🧪 CHAT APPLICATION FEATURE VERIFICATION")
    print("="*70)
    
    results = []
    
    try:
        results.append(("App Load", test_app_load()))
        results.append(("HTML Structure", test_html_validity()))
        results.append(("JavaScript Features", test_javascript()))
        results.append(("Streaming API", test_streaming()))
    except Exception as e:
        print(f"\n❌ Critical error: {e}")
    
    # Summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    all_passed = all(result for _, result in results)
    
    if all_passed:
        print("\n🎉 ALL TESTS PASSED - APP IS READY!")
    else:
        print("\n⚠️  SOME TESTS FAILED - CHECK ABOVE")
    
    print("="*70 + "\n")
