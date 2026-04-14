from core.config import settings
from cryptography.fernet import Fernet
import os
import logging

logger = logging.getLogger(__name__)

# Encryption helper
def _get_cipher():
    key = getattr(settings, "ENCRYPTION_KEY", None)
    if not key:
        return None
    try:
        return Fernet(key.encode())
    except Exception as e:
        logger.error(f"Failed to initialize Fernet cipher: {e}")
        return None

def encrypt_token(token: str) -> str:
    cipher = _get_cipher()
    if not cipher or not token:
        return token
    try:
        return cipher.encrypt(token.encode()).decode()
    except Exception as e:
        logger.error(f"Encryption failed: {e}")
        return token

def decrypt_token(token: str) -> str:
    cipher = _get_cipher()
    if not cipher or not token:
        return token
    try:
        return cipher.decrypt(token.encode()).decode()
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return token
