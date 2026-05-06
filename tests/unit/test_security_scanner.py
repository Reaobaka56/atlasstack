"""Unit tests for the security scanner (regex/rule-based, no tree-sitter required)."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services" / "analysis"))

# Skip if heavy tree-sitter deps unavailable (e.g. CI minimal install)
tree_sitter = pytest.importorskip("engine.security_scanner", reason="security_scanner not importable")

from engine.security_scanner import SecurityScanner, get_scanner, ScanResult


@pytest.fixture(scope="module")
def scanner():
    return SecurityScanner()


class TestSecurityRules:
    """Test rule-based regex scanning directly via _scan_with_rules."""

    def test_sql_injection_f_string(self, scanner):
        code = 'cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")'
        findings = scanner._scan_with_rules("test.py", code, "python")
        sql = [f for f in findings if "SQL" in f.message or "sql" in f.message.lower()]
        assert len(sql) > 0, "Should detect SQL injection in f-string"

    def test_sql_injection_percent_format(self, scanner):
        code = 'cursor.execute("SELECT * FROM users WHERE id = %s" % user_id)'
        findings = scanner._scan_with_rules("test.py", code, "python")
        sql = [f for f in findings if "SQL" in f.message or "injection" in f.message.lower()]
        assert len(sql) > 0

    def test_hardcoded_password(self, scanner):
        code = 'password = "super_secret_pass_123"'
        findings = scanner._scan_with_rules("test.py", code, "python")
        secrets = [f for f in findings if "secret" in f.message.lower() or "hardcoded" in f.message.lower()]
        assert len(secrets) > 0, "Should detect hardcoded password"

    def test_hardcoded_api_key(self, scanner):
        code = 'API_KEY = "sk-abcdef1234567890"'
        findings = scanner._scan_with_rules("test.py", code, "python")
        secrets = [f for f in findings if "secret" in f.message.lower() or "hardcoded" in f.message.lower()]
        assert len(secrets) > 0

    def test_insecure_pickle(self, scanner):
        code = "data = pickle.loads(raw_bytes)"
        findings = scanner._scan_with_rules("test.py", code, "python")
        deser = [f for f in findings if "deserialization" in f.message.lower() or "pickle" in f.message.lower()]
        assert len(deser) > 0

    def test_insecure_eval(self, scanner):
        code = "result = eval(user_input)"
        findings = scanner._scan_with_rules("test.py", code, "python")
        assert len(findings) > 0

    def test_weak_md5(self, scanner):
        code = "digest = md5(data)"
        findings = scanner._scan_with_rules("test.py", code, "python")
        weak = [f for f in findings if "weak" in f.message.lower() or "cryptograph" in f.message.lower()]
        assert len(weak) > 0

    def test_xss_inner_html(self, scanner):
        code = "element.innerHTML = userInput;"
        findings = scanner._scan_with_rules("test.js", code, "javascript")
        xss = [f for f in findings if "XSS" in f.message or "xss" in f.message.lower()]
        assert len(xss) > 0

    def test_debug_mode_enabled(self, scanner):
        code = "DEBUG = True"
        findings = scanner._scan_with_rules("settings.py", code, "python")
        debug = [f for f in findings if "debug" in f.message.lower()]
        assert len(debug) > 0

    def test_clean_code_no_findings(self, scanner):
        code = """
def add(a: int, b: int) -> int:
    return a + b

class Calculator:
    def multiply(self, x, y):
        return x * y
"""
        findings = scanner._scan_with_rules("clean.py", code, "python")
        assert len(findings) == 0, f"Clean code should have no findings, got: {findings}"

    def test_language_filtering(self, scanner):
        # Python-only rule should not fire on JS files
        code = "pickle.loads(data)"
        js_findings = scanner._scan_with_rules("test.js", code, "javascript")
        py_findings = scanner._scan_with_rules("test.py", code, "python")
        # JS should have no pickle finding (python-only rule)
        pickle_in_js = [f for f in js_findings if "pickle" in f.message.lower() or "deserialization" in f.message.lower()]
        pickle_in_py = [f for f in py_findings if "deserialization" in f.message.lower()]
        assert len(pickle_in_py) > 0
        assert len(pickle_in_js) == 0


class TestCWEOWASPMappings:
    def test_sql_injection_mapping(self, scanner):
        assert scanner.CWE_TO_OWASP["CWE-89"] == "A03"

    def test_xss_mapping(self, scanner):
        assert scanner.CWE_TO_OWASP["CWE-79"] == "A03"

    def test_command_injection_mapping(self, scanner):
        assert scanner.CWE_TO_OWASP["CWE-78"] == "A03"

    def test_path_traversal_mapping(self, scanner):
        assert scanner.CWE_TO_OWASP["CWE-22"] == "A01"

    def test_hardcoded_creds_mapping(self, scanner):
        assert scanner.CWE_TO_OWASP["CWE-798"] == "A07"

    def test_ssrf_mapping(self, scanner):
        assert scanner.CWE_TO_OWASP["CWE-918"] == "A10"


class TestScanResult:
    def test_scan_result_defaults(self):
        result = ScanResult()
        assert result.findings == []
        assert result.errors == []
        assert result.scan_time_ms == 0
        assert result.files_scanned == 0

    def test_finding_has_required_fields(self, scanner):
        code = 'password = "my_secret_pass"'
        findings = scanner._scan_with_rules("test.py", code, "python")
        assert len(findings) > 0
        f = findings[0]
        assert f.rule_id
        assert f.rule_name
        assert f.severity in ("critical", "high", "medium", "low", "info")
        assert f.file_path == "test.py"
        assert f.line_start > 0
        assert f.cwe_id is not None


class TestSemgrepBanditAvailability:
    """These tools may not be installed — verify graceful degradation."""

    def test_semgrep_check_doesnt_crash(self, scanner):
        available = scanner._is_semgrep_available()
        assert isinstance(available, bool)

    def test_bandit_check_doesnt_crash(self, scanner):
        available = scanner._is_bandit_available()
        assert isinstance(available, bool)
