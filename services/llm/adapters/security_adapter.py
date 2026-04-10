"""
Security analysis adapter
Specialized adapter for security vulnerability analysis
"""

import json
import re
from typing import List, Optional

import structlog

from adapters.base_adapter import BaseAdapter

logger = structlog.get_logger()


class SecurityAdapter(BaseAdapter):
    """Adapter for security analysis tasks"""

    SYSTEM_PROMPT = """You are a senior security researcher and exploit developer.
Your task is to identify deep, non-obvious security vulnerabilities in the provided code.
You must distinguish between generic linting warnings and real, exploitable bugs.
Every finding must include a CWE ID, an OWASP Top 10 (2021) category, and a Proof-of-Concept (PoC) exploit scenario where applicable."""

    async def analyze(self, code: str, language: str) -> dict:
        """Analyze code for security vulnerabilities with high-confidence AI verification"""
        prompt = f"""Perform a deep security audit of the following {language} code.
Focus on actual exploitable vulnerabilities rather than style issues.

```{language}
{code}
```

For every vulnerability found, provide:
1. Vulnerability type and CWE ID (e.g., SQL Injection - CWE-89)
2. OWASP Top 10 (2021) Category
3. Severity (Critical, High, Medium, Low)
4. Exploit Scenario / PoC: Describe exactly how an attacker could exploit this.
5. Mitigation: Provide the secure code implementation.

Format your response as JSON:
{{
    "vulnerabilities": [
        {{
            "type": "vulnerability type",
            "cwe_id": "CWE-XXX",
            "owasp_category": "AXX:2021",
            "severity": "severity level",
            "description": "detailed technical explanation",
            "exploit_poc": "step-by-step exploit scenario",
            "render_poc": true/false (if it's a visual vuln like XSS),
            "fix": "complete secure code replacement"
        }}
    ],
    "summary": "executive summary of the security posture"
}}"""

        try:
            response_text = await self.generate_prompt(
                system_prompt=self.SYSTEM_PROMPT,
                user_prompt=prompt,
                max_tokens=2048,
                temperature=0.1,
            )

            # Parse JSON response
            try:
                result = json.loads(response_text)
            except json.JSONDecodeError:
                # Try to extract JSON from markdown
                json_match = re.search(r"```json\n(.*?)\n```", response_text, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group(1))
                else:
                    result = {"raw_response": response_text}

            return {
                "text": response_text,
                "structured": result,
                "vulnerabilities_found": len(result.get("vulnerabilities", [])),
                "confidence": 0.85,
                "model_used": "security-analyzer",
            }

        except Exception as e:
            logger.error(f"Security analysis failed: {e}")
            return {
                "text": f"Analysis failed: {e}",
                "structured": {},
                "vulnerabilities_found": 0,
                "confidence": 0,
            }

    async def generate_fix(
        self,
        code: str,
        vulnerability_type: str,
        language: str,
    ) -> dict:
        """Generate a fix for a vulnerability"""
        prompt = f"""Fix the following {vulnerability_type} vulnerability in this {language} code:

```{language}
{code}
```

Provide:
1. The fixed code
2. Explanation of what was changed
3. Why the fix works

Format as JSON:
{{
    "fixed_code": "the complete fixed code",
    "explanation": "explanation of changes",
    "best_practices": "additional recommendations"
}}"""

        try:
            response_text = await self.generate_prompt(
                system_prompt=self.SYSTEM_PROMPT,
                user_prompt=prompt,
                max_tokens=2048,
                temperature=0.1,
            )

            # Parse JSON response
            try:
                result = json.loads(response_text)
            except json.JSONDecodeError:
                json_match = re.search(r"```json\n(.*?)\n```", response_text, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group(1))
                else:
                    result = {"fixed_code": response_text}

            return {
                "fixed_code": result.get("fixed_code", ""),
                "explanation": result.get("explanation", ""),
                "confidence": 0.9,
            }

        except Exception as e:
            logger.error(f"Fix generation failed: {e}")
            return {
                "fixed_code": "",
                "explanation": f"Failed to generate fix: {e}",
                "confidence": 0,
            }

    async def explain_vulnerability(
        self,
        vulnerability_type: str,
        cwe_id: Optional[str] = None,
    ) -> dict:
        """Explain a vulnerability type"""
        prompt = f"""Explain the {vulnerability_type} vulnerability"""

        if cwe_id:
            prompt += f" (CWE-{cwe_id})"

        prompt += """ in detail:

Provide:
1. What the vulnerability is
2. Common attack scenarios
3. How to prevent it
4. Code examples of vulnerable and secure code
"""

        response_text = await self.generate_prompt(
            system_prompt=self.SYSTEM_PROMPT,
            user_prompt=prompt,
            max_tokens=2048,
            temperature=0.3,
        )

        return {
            "explanation": response_text,
            "vulnerability_type": vulnerability_type,
            "cwe_id": cwe_id,
        }
