"""Unit tests for shared Pydantic models."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shared"))

from models.analysis import (
    AnalysisJob, AnalysisResult, AnalysisStatus, AnalysisType,
    Finding, Severity, AnalysisMetrics,
)
from models.repository import Repository, RepositoryStatus, RepositoryCreate


class TestFinding:
    def test_finding_defaults(self):
        f = Finding(
            rule_id="TEST-001",
            rule_name="Test Rule",
            severity=Severity.HIGH,
            confidence=0.9,
            message="Test finding",
            file_path="test.py",
            line_start=1,
            line_end=1,
        )
        assert f.id is not None
        assert f.created_at is not None
        assert f.references == []

    def test_confidence_out_of_range(self):
        with pytest.raises(Exception):
            Finding(
                rule_id="X", rule_name="X", severity=Severity.LOW,
                confidence=1.5,  # > 1, should fail
                message="X", file_path="x.py", line_start=1, line_end=1,
            )

    def test_severity_enum_values(self):
        assert Severity.CRITICAL == "critical"
        assert Severity.HIGH == "high"
        assert Severity.MEDIUM == "medium"
        assert Severity.LOW == "low"
        assert Severity.INFO == "info"


class TestAnalysisResult:
    def test_result_defaults(self):
        result = AnalysisResult(
            repo_id="repo-123",
            analysis_type=AnalysisType.SECURITY,
            status=AnalysisStatus.PENDING,
        )
        assert result.id is not None
        assert result.findings == []
        assert result.created_at is not None
        assert result.completed_at is None

    def test_analysis_status_enum(self):
        assert AnalysisStatus.PENDING == "pending"
        assert AnalysisStatus.COMPLETED == "completed"
        assert AnalysisStatus.FAILED == "failed"


class TestAnalysisJob:
    def test_job_defaults(self):
        job = AnalysisJob(
            repo_id="repo-123",
            repo_url="https://github.com/example/repo",
            analysis_types=[AnalysisType.SECURITY],
        )
        assert job.status == AnalysisStatus.PENDING
        assert job.priority == 5
        assert job.branch == "main"

    def test_job_id_unique(self):
        j1 = AnalysisJob(repo_id="r", repo_url="https://example.com", analysis_types=[])
        j2 = AnalysisJob(repo_id="r", repo_url="https://example.com", analysis_types=[])
        assert j1.id != j2.id


class TestAnalysisMetrics:
    def test_metrics_defaults(self):
        m = AnalysisMetrics()
        assert m.files_analyzed == 0
        assert m.findings_total == 0
        assert m.findings_by_severity == {}


class TestRepository:
    def test_repository_defaults(self):
        repo = Repository(
            url="https://github.com/example/repo",
            name="repo",
        )
        assert repo.id is not None
        assert repo.status == RepositoryStatus.PENDING
        assert repo.branch == "main"
        assert repo.is_private is False

    def test_repository_status_enum(self):
        assert RepositoryStatus.PENDING == "pending"
        assert RepositoryStatus.ANALYZING == "analyzing"
        assert RepositoryStatus.ERROR == "error"
