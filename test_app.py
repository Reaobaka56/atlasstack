import sys
import traceback
from fastapi.testclient import TestClient

# Add api folder to path
sys.path.append(r"C:\Users\reaob\Downloads\PythonProject33\atlasstack\services\api")
sys.path.append(r"C:\Users\reaob\Downloads\PythonProject33\atlasstack")

from services.api.main import app

client = TestClient(app, raise_server_exceptions=True)

try:
    response = client.get("/health")
    print("Response status:", response.status_code)
    print("Response json:", response.json())
except Exception as e:
    print("Caught Exception!")
    traceback.print_exc()
