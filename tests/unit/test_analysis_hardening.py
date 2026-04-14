import pytest
import sys
from pathlib import Path
from fastapi import HTTPException

# Add services/api to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services" / "api"))

from routers.analysis import validate_repo_url

class TestAnalysisHardening:
    def test_validate_valid_github_url(self):
        url = "https://github.com/fastapi/fastapi"
        assert validate_repo_url(url) == url

    def test_validate_valid_gitlab_url(self):
        url = "https://gitlab.com/gitlab-org/gitlab"
        assert validate_repo_url(url) == url

    def test_validate_invalid_domain_fails(self):
        url = "https://malicious-site.com/repo"
        with pytest.raises(HTTPException) as exc:
            validate_repo_url(url)
        assert exc.value.status_code == 400
        assert "Only GitHub, GitLab, and Bitbucket" in exc.value.detail

    def test_validate_path_traversal_fails(self):
        url = "https://github.com/../../etc/passwd"
        with pytest.raises(HTTPException) as exc:
            validate_repo_url(url)
        assert exc.value.status_code == 400

    def test_validate_empty_path_fails(self):
        url = "https://github.com/"
        with pytest.raises(HTTPException) as exc:
            validate_repo_url(url)
        assert exc.value.status_code == 400
