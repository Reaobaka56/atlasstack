import os
import shutil
import tempfile
import structlog
import httpx
from git import Repo
from typing import Optional, Dict, Any
from core.config import settings

logger = structlog.get_logger()

class GitHubClient:
    """Handles GitHub interactions: cloning, patching, and PR creation."""
    
    def __init__(self, token: Optional[str] = None):
        self.token = token or settings.GITHUB_TOKEN
        self.app_id = settings.GITHUB_APP_ID
        self.private_key = settings.GITHUB_PRIVATE_KEY
        self.api_base = "https://api.github.com"
        self._headers = {
            "Accept": "application/vnd.github.v3+json",
        }

    @property
    def headers(self):
        return {
            **self._headers,
            "Authorization": f"token {self.token}" if self.token else ""
        }

    async def get_installation_token(self, installation_id: str) -> str:
        """Generates a temporary installation token for a GitHub App."""
        if not self.app_id or not self.private_key:
            raise ValueError("GitHub App credentials not configured.")
        
        import jwt
        import time
        
        payload = {
            "iat": int(time.time()),
            "exp": int(time.time()) + (10 * 60),
            "iss": self.app_id,
        }
        
        encoded_jwt = jwt.encode(payload, self.private_key, algorithm="RS256")
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.api_base}/app/installations/{installation_id}/access_tokens",
                headers={
                    "Authorization": f"Bearer {encoded_jwt}",
                    "Accept": "application/vnd.github.v3+json",
                }
            )
            resp.raise_for_status()
            token_data = resp.json()
            return token_data["token"]

    async def get_repo_installation_id(self, owner: str, repo: str) -> str:
        """Finds the installation ID for a specific repository."""
        if not self.app_id or not self.private_key:
            return None
            
        import jwt
        import time
        
        payload = {
            "iat": int(time.time()) - 60,
            "exp": int(time.time()) + (10 * 60),
            "iss": self.app_id,
        }
        encoded_jwt = jwt.encode(payload, self.private_key, algorithm="RS256")
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.api_base}/repos/{owner}/{repo}/installation",
                headers={
                    "Authorization": f"Bearer {encoded_jwt}",
                    "Accept": "application/vnd.github.v3+json",
                }
            )
            if resp.status_code == 200:
                return str(resp.json()["id"])
            
            logger.error(f"GitHub App Installation check failed for {owner}/{repo}", 
                         status=resp.status_code, 
                         error=resp.text)
            return None

    async def create_pr(self, repo_url: str, fix: Dict[str, Any], base_branch: str = "main") -> Dict[str, Any]:
        """
        Creates a PR for a specific fix using App or User token.
        """
        # 1. Try to get a token (prefer User Token, fallback to App Token)
        token = self.token
        
        # Extract owner/repo from URL
        parts = repo_url.rstrip("/").split("/")
        if len(parts) < 2:
            raise ValueError(f"Invalid repository URL: {repo_url}")
        owner = parts[-2]
        repo_name = parts[-1]
        owner_repo = f"{owner}/{repo_name}"

        if not token and self.app_id:
            logger.info("No user token found. Attempting GitHub App authentication...")
            installation_id = await self.get_repo_installation_id(owner, repo_name)
            if installation_id:
                token = await self.get_installation_token(installation_id)
                logger.info("Successfully generated GitHub App installation token.")

        if not token:
            raise ValueError("GitHub authentication failed. Please connect your GitHub account or install the AtlasStack GitHub App.")

        temp_dir = tempfile.mkdtemp()
        try:
            # Clone and PR logic continues...
            authed_url = repo_url.replace("https://", f"https://x-access-token:{token}@")
            repo = Repo.clone_from(authed_url, temp_dir)
            
            # 2. Branch
            branch_name = f"atlasstack/fix-{os.urandom(4).hex()}"
            new_branch = repo.create_head(branch_name)
            new_branch.checkout()
            
            # 3. Apply Patch
            file_path = os.path.join(temp_dir, fix["file_path"])
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"File {fix['file_path']} not found in repository")
            
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Simple replacement logic (can be replaced with git apply if we have a diff)
            if fix.get("code_remove") and fix["code_remove"] in content:
                new_content = content.replace(fix["code_remove"], fix.get("code_add", ""))
            else:
                # If exact match fails, try a line-by-line strategy or just append if it's an addition
                # For Phase 1/2, we'll favor exact match or simple addition
                new_content = content + "\n" + fix.get("code_add", "") if not fix.get("code_remove") else content

            with open(file_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            
            # 4. Commit and Push
            repo.index.add([fix["file_path"]])
            repo.index.commit(f"AtlasStack Fix: {fix['problem']}")
            
            origin = repo.remote(name="origin")
            origin.push(branch_name)
            
            # 5. Open PR via API
            pr_data = {
                "title": f"AtlasStack: Fix for {fix['problem']}",
                "body": (
                    f"### 🛡 Security fix suggested by AtlasStack\n\n"
                    f"**Problem:** {fix['problem']}\n"
                    f"**Remediation:** {fix.get('eli5_explanation', 'Automatic patch applied.')}\n\n"
                    f"This PR was automatically generated by AtlasStack AI."
                ),
                "head": branch_name,
                "base": base_branch
            }
            
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    f"{self.api_base}/repos/{owner_repo}/pulls",
                    headers={**self._headers, "Authorization": f"token {token}"},
                    json=pr_data
                )
                
                if res.status_code != 201:
                    logger.error("Failed to create PR", status=res.status_code, response=res.text)
                    raise Exception(f"GitHub API Error: {res.json().get('message', 'Unknown error')}")
                
                return res.json()
                
        finally:
            shutil.rmtree(temp_dir)

def get_github_client(token: Optional[str] = None) -> GitHubClient:
    return GitHubClient(token=token)
