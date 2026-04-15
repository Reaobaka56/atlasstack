import os
import requests
from dotenv import load_dotenv

load_dotenv()
token = os.environ.get("HF_TOKEN")
model = "Qwen/Qwen2.5-Coder-32B-Instruct"
url = f"https://api-inference.huggingface.co/models/{model}"
headers = {"Authorization": f"Bearer {token}"}
payload = {"inputs": "Analyze this: print('hello')", "parameters": {"max_new_tokens": 10}}

print(f"URL: {url}")
response = requests.post(url, headers=headers, json=payload)
print(f"Status Code: {response.status_code}")
print(f"Response: {response.text}")
