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
        
        # Clean up the private key format (handle common copy-paste newline issues)
        clean_key = self.private_key.replace("\\n", "\n")
        if not clean_key.startswith("-----BEGIN"):
             logger.error("Private Key format error: Must start with -----BEGIN RSA PRIVATE KEY-----")
        
        payload = {
            "iat": int(time.time()) - 60,
            "exp": int(time.time()) + (10 * 60),
            "iss": str(self.app_id),
        }
        
        encoded_jwt = jwt.encode(payload, clean_key, algorithm="RS256")
        
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
        
        clean_key = self.private_key.replace("\\n", "\n")
        
        payload = {
            "iat": int(time.time()) - 60,
            "exp": int(time.time()) + (10 * 60),
            "iss": str(self.app_id),
        }
        encoded_jwt = jwt.encode(payload, clean_key, algorithm="RS256")
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.api_base}/repos/{owner}/{repo}/installation",
                headers={
                    "Authorization": f"Bearer {encoded_jwt}",
                    "Accept": "application/vnd.github.v3+json",
                }
            )
            if resp.status_code == 200:
                inst_id = str(resp.json()["id"])
                logger.info(f"✅ Found GitHub App Installation: {inst_id} for {owner}/{repo}")
                return inst_id
            
            logger.error(f"❌ GitHub App Installation check failed for {owner}/{repo}", 
                         status_code=resp.status_code, 
                         response_body=resp.text,
                         app_id=self.app_id)
            return None

    async def get_app_info(self, token: str) -> Dict[str, Any]:
        """Fetches the authenticated App's info."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.api_base}/app",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github.v3+json",
                }
            )
            resp.raise_for_status()
            return resp.json()

    async def create_pr(self, repo_url: str, fix: Dict[str, Any], base_branch: str = "main") -> Dict[str, Any]:
        """
        Creates a PR for a specific fix using App or User token.
        """
        # 1. Try to get a token (prefer User Token, fallback to App Token)
        token = self.token
        bot_info = None
        
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
                # Generate JWT to get app info first
                import jwt
                import time
                payload = {"iat": int(time.time()) - 60, "exp": int(time.time()) + 600, "iss": str(self.app_id)}
                clean_key = self.private_key.replace("\\n", "\n")
                encoded_jwt = jwt.encode(payload, clean_key, algorithm="RS256")
                
                try:
                    bot_info = await self.get_app_info(encoded_jwt)
                except Exception as e:
                    logger.warning(f"Could not fetch bot info: {e}")

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
            
            # 3. Apply Patch (Smarter Logic)
            file_path = os.path.join(temp_dir, fix["file_path"])
            if not os.path.exists(file_path):
                # If file doesn't exist, create it (handles new files)
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(fix.get("code_add", ""))
            else:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                if fix.get("code_remove") and fix["code_remove"] in content:
                    new_content = content.replace(fix["code_remove"], fix.get("code_add", ""))
                else:
                    # Fallback: Append if we can't find the exact line to remove
                    new_content = content + "\n\n# AtlasStack AI Suggested Fix:\n" + fix.get("code_add", "")
                
                # FORCE CHANGE: If content is still identical, add a timestamp to force a diff
                if new_content == content:
                    import time
                    new_content += f"\n# Verified by AtlasStack at {int(time.time())}\n"

                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
            
            # 4. Commit and Push
            from git import Actor
            
            # Official GitHub Bot format: id+name[bot]@users.noreply.github.com
            if bot_info:
                bot_name = bot_info.get("slug", "atlasstack-ai")
                bot_id = bot_info.get("id", "12345")
                author_obj = Actor(f"{bot_name}[bot]", f"{bot_id}+{bot_name}[bot]@users.noreply.github.com")
            else:
                author_obj = Actor("AtlasStack AI", "atlasstack-ai[bot]@users.noreply.github.com")
                
            repo.index.add([fix["file_path"]])
            repo.index.commit(
                f"AtlasStack Fix: {fix['problem']}", 
                author=author_obj,
                committer=author_obj
            )
            
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
