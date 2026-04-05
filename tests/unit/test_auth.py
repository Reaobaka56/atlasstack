"""Unit tests for authentication utilities."""

import time
from types import SimpleNamespace

import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services" / "api"))

from middleware.auth import (
    PermissionChecker,
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
    verify_token,
)


class TestJWT:
    def test_access_token_roundtrip(self):
        token = create_access_token("user-123", "user@example.com", roles=["user"])
        payload = verify_token(token)
        assert payload is not None
        assert payload["sub"] == "user-123"
        assert payload["email"] == "user@example.com"
        assert "user" in payload["roles"]
        assert payload["type"] == "access"

    def test_refresh_token_type(self):
        token = create_refresh_token("user-123")
        payload = verify_token(token)
        assert payload is not None
        assert payload["sub"] == "user-123"
        assert payload["type"] == "refresh"

    def test_invalid_token_returns_none(self):
        assert verify_token("not.a.token") is None
        assert verify_token("") is None

    def test_tampered_token_returns_none(self):
        token = create_access_token("user-123", "user@example.com")
        # Tamper with the payload section
        parts = token.split(".")
        tampered = parts[0] + ".AAAA" + parts[2]
        assert verify_token(tampered) is None

    def test_token_contains_expiry(self):
        token = create_access_token("user-123", "test@test.com")
        payload = verify_token(token)
        assert "exp" in payload
        assert payload["exp"] > time.time()

    def test_multiple_roles(self):
        token = create_access_token("admin-1", "admin@test.com", roles=["user", "admin"])
        payload = verify_token(token)
        assert "admin" in payload["roles"]
        assert "user" in payload["roles"]


class TestPasswordHashing:
    def test_hash_is_not_plaintext(self):
        pw = "mypassword123"
        hashed = hash_password(pw)
        assert hashed != pw
        assert len(hashed) > 20

    def test_correct_password_verifies(self):
        pw = "mypassword123"
        hashed = hash_password(pw)
        assert verify_password(pw, hashed) is True

    def test_wrong_password_fails(self):
        hashed = hash_password("correct")
        assert verify_password("wrong", hashed) is False

    def test_empty_password_hashes(self):
        # Even empty strings should hash without error
        hashed = hash_password("")
        assert verify_password("", hashed) is True
        assert verify_password("notempty", hashed) is False

    def test_different_hashes_for_same_password(self):
        # bcrypt uses random salt — same input → different hash each time
        pw = "samepassword"
        h1 = hash_password(pw)
        h2 = hash_password(pw)
        assert h1 != h2
        assert verify_password(pw, h1)
        assert verify_password(pw, h2)


class TestPermissionChecker:
    """
    PermissionChecker now uses Depends(get_current_user) internally.
    We test it by passing pre-built user dicts directly (simulating what
    get_current_user returns after decoding a JWT).
    """

    def _make_user(self, roles):
        token = create_access_token("uid", "u@u.com", roles=roles)
        payload = verify_token(token)
        return {"id": payload["sub"], "email": payload["email"], "roles": payload["roles"]}

    def test_allows_matching_role(self):
        checker = PermissionChecker(["user"])
        user = self._make_user(["user"])
        result = checker(user=user)
        assert result["id"] == "uid"

    def test_allows_one_of_multiple_required(self):
        checker = PermissionChecker(["user", "admin"])
        user = self._make_user(["admin"])
        result = checker(user=user)
        assert result is not None

    def test_denies_missing_role(self):
        checker = PermissionChecker(["user"])
        user = self._make_user(["guest"])
        with pytest.raises(Exception) as exc:
            checker(user=user)
        assert exc.value.status_code == 403

    def test_denies_empty_roles(self):
        checker = PermissionChecker(["user"])
        user = {"id": "uid", "email": "u@u.com", "roles": []}
        with pytest.raises(Exception) as exc:
            checker(user=user)
        assert exc.value.status_code == 403

    def test_allows_admin_for_user_route(self):
        """Admin should pass a user-level check."""
        checker = PermissionChecker(["user", "admin"])
        user = self._make_user(["admin"])
        result = checker(user=user)
        assert result["roles"] == ["admin"]
