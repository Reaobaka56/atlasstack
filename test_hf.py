import os
from huggingface_hub import InferenceClient
from dotenv import load_dotenv

load_dotenv()
token = os.environ.get("HF_TOKEN")
print(f"Token present: {bool(token)}")

client = InferenceClient(api_key=token)
try:
    response = client.text_generation(
        "Analyze this code: print('hello')",
        model="Qwen/Qwen2.5-Coder-32B-Instruct",
        max_new_tokens=10
    )
    print("Success!")
    print(response)
except Exception as e:
    print(f"Failed: {e}")
