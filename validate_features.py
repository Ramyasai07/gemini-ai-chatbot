#!/usr/bin/env python
"""
Comprehensive Feature Validation and Test Report
Tests all implemented features
"""

import requests
import json
from datetime import datetime

BASE_URL = 'http://localhost:5000'

class FeatureValidator:
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
    
    def test_feature(self, name, test_func):
        """Test a feature and record result"""
        try:
            result = test_func()
            if result:
                self.results.append((name, "PASS", ""))
                self.passed += 1
                print(f"[OK] {name}")
            else:
                self.results.append((name, "FAIL", "Test returned False"))
                self.failed += 1
                print(f"[FAIL] {name}")
        except Exception as e:
            self.results.append((name, "FAIL", str(e)))
            self.failed += 1
            print(f"[FAIL] {name}: {str(e)}")
    
    def print_report(self):
        """Print final report"""
        print("\n" + "=" * 70)
        print("FEATURE VALIDATION REPORT".center(70))
        print("=" * 70)
        
        for name, status, detail in self.results:
            print(f"{name:40} {status:12}", end="")
            if detail:
                print(f"  ({detail[:20]}...)")
            else:
                print()
        
        print("=" * 70)
        print(f"Results: {self.passed} PASSED | {self.failed} FAILED | Total: {self.passed + self.failed}")
        print("=" * 70)

def main():
    print("=" * 70)
    print("TESTING GEMINI CHATBOT FEATURES".center(70))
    print("=" * 70)
    
    validator = FeatureValidator()
    
    # Test 1: Server Connectivity
    def test_server_connection():
        try:
            response = requests.get(f'{BASE_URL}/', timeout=5)
            return response.status_code == 200
        except:
            return False
    
    validator.test_feature("Server Connectivity", test_server_connection)
    
    # Test 2: HTML Page Loads
    def test_html_loads():
        response = requests.get(f'{BASE_URL}/', timeout=5)
        html = response.text
        required = ['id="message-input"', 'id="send-btn"', 'id="voice-btn"',
                   'id="theme-toggle-btn"', 'id="settings-btn"', 'id="chats-list"']
        return all(item in html for item in required)
    
    validator.test_feature("HTML Page & Required Elements", test_html_loads)
    
    # Test 3: CSS File Loads
    def test_css_loads():
        response = requests.get(f'{BASE_URL}/static/css/style-pro.css', timeout=5)
        return response.status_code == 200 and len(response.text) > 1000
    
    validator.test_feature("CSS Styling File", test_css_loads)
    
    # Test 4: JavaScript File Loads
    def test_js_loads():
        response = requests.get(f'{BASE_URL}/static/js/app-pro.js', timeout=5)
        return response.status_code == 200 and len(response.text) > 5000
    
    validator.test_feature("JavaScript App File", test_js_loads)
    
    # Test 5: Chat API Endpoint (Feature: Send Message)
    def test_chat_api():
        payload = {
            "message": "Hello, how are you?",
            "conversation": [{"role": "user", "content": "Hello, how are you?"}]
        }
        response = requests.post(f'{BASE_URL}/api/chat/send', json=payload, timeout=30)
        if response.status_code != 200:
            return False
        data = response.json()
        return data.get('success') and data.get('response')
    
    validator.test_feature("Chat API Endpoint (Send Message)", test_chat_api)
    
    # Test 6: CSS Has Voice Button Styles
    def test_voice_button_styles():
        response = requests.get(f'{BASE_URL}/static/css/style-pro.css', timeout=5)
        css = response.text
        return '#voice-btn' in css or '.voice-btn' in css
    
    validator.test_feature("Voice Button CSS Styles", test_voice_button_styles)
    
    # Test 7: CSS Has Copy Button Styles
    def test_copy_button_styles():
        response = requests.get(f'{BASE_URL}/static/css/style-pro.css', timeout=5)
        css = response.text
        return '.copy-btn' in css
    
    validator.test_feature("Copy Button CSS Styles", test_copy_button_styles)
    
    # Test 8: CSS Has Theme/Dark Mode Styles
    def test_theme_styles():
        response = requests.get(f'{BASE_URL}/static/css/style-pro.css', timeout=5)
        css = response.text
        return '.dark-mode' in css or 'dark-mode' in css
    
    validator.test_feature("Dark/Light Mode CSS Styles", test_theme_styles)
    
    # Test 9: CSS Has Settings Modal Styles
    def test_settings_modal_styles():
        response = requests.get(f'{BASE_URL}/static/css/style-pro.css', timeout=5)
        css = response.text
        return '.settings-modal' in css or '.settings-panel' in css
    
    validator.test_feature("Settings Modal CSS Styles", test_settings_modal_styles)
    
    # Test 10: JavaScript Has Required Methods
    def test_js_methods():
        response = requests.get(f'{BASE_URL}/static/js/app-pro.js', timeout=5)
        js = response.text
        required_methods = [
            'saveCurrentChat',
            'loadChats',
            'loadChat',
            'copyToClipboard',
            'handleVoiceMessage',
            'openSettings',
            'toggleTheme',
            'loadTheme'
        ]
        return all(method in js for method in required_methods)
    
    validator.test_feature("JavaScript Key Methods", test_js_methods)
    
    # Test 11: JavaScript Has localStorage Integration
    def test_js_localstorage():
        response = requests.get(f'{BASE_URL}/static/js/app-pro.js', timeout=5)
        js = response.text
        return "localStorage" in js and "JSON.parse" in js
    
    validator.test_feature("localStorage Integration", test_js_localstorage)
    
    # Test 12: Chat History Feature Code Present
    def test_chat_history_code():
        response = requests.get(f'{BASE_URL}/static/js/app-pro.js', timeout=5)
        js = response.text
        return 'chats-list' in js and 'chat-history-btn' in js
    
    validator.test_feature("Chat History Feature", test_chat_history_code)
    
    # Print report
    validator.print_report()
    
    # Return exit code based on results
    return 0 if validator.failed == 0 else 1

if __name__ == '__main__':
    import sys
    sys.exit(main())
