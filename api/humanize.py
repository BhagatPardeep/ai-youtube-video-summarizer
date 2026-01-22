from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import requests
import os

# We use the "Flan-T5" model. It is free and great at following instructions.
HF_API_URL = "https://api-inference.huggingface.co/models/google/flan-t5-base"

def query_ai(payload, token):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(HF_API_URL, headers=headers, json=payload)
    return response.json()

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # 1. Setup CORS (So your Blogger can talk to this)
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        # 2. Get Text from URL
        query = parse_qs(urlparse(self.path).query)
        text = query.get('text', [None])[0]
        
        if not text:
            self.wfile.write(json.dumps({"error": "No text provided"}).encode('utf-8'))
            return

        # 3. Call AI
        try:
            hf_token = os.environ.get("HF_TOKEN")
            if not hf_token:
                self.wfile.write(json.dumps({"error": "Missing HF_TOKEN"}).encode('utf-8'))
                return

            # Instruction for the AI
            prompt = f"Rewrite this to be more natural and human-like: {text}"
            
            output = query_ai({"inputs": prompt}, hf_token)
            
            # 4. Return Result
            if isinstance(output, list) and "generated_text" in output[0]:
                self.wfile.write(json.dumps({"result": output[0]['generated_text']}).encode('utf-8'))
            else:
                self.wfile.write(json.dumps({"error": "AI is busy. Try again."}).encode('utf-8'))

        except Exception as e:
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
