"""
Dependency Analyzer Engine
Analyzes dependencies for security risks, licenses, and maintenance status
"""

import json
import os
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Any

import structlog

logger = structlog.get_logger()

@dataclass
class Dependency:
    """A project dependency"""
    name: str
    version: str
    language: str
    file_path: str
    license: Optional[str] = None
    vulnerabilities: List[Dict[str, Any]] = field(default_factory=list)
    risk_score: float = 0.0  # 0 to 100
    risk_factors: List[str] = field(default_factory=list)
    is_abandoned: bool = False
    description: Optional[str] = None

class DependencyAnalyzer:
    """Analyzes manifest files for supply chain risks"""

    def __init__(self):
        pass

    def scan_project(self, directory: str) -> List[Dependency]:
        """Scan a directory for all dependency manifests"""
        all_deps = []
        path = Path(directory)
        
        # Scan for Python requirements
        for req_file in path.rglob("requirements.txt"):
            if "node_modules" in req_file.parts: continue
            all_deps.extend(self._parse_requirements(req_file))
            
        # Scan for Node.js package.json
        for pkg_file in path.rglob("package.json"):
            if "node_modules" in pkg_file.parts: continue
            all_deps.extend(self._parse_package_json(pkg_file))
            
        # Run vulnerability checks
        self._check_vulnerabilities(all_deps, directory)
        
        # Calculate risk scores
        for dep in all_deps:
            dep.risk_score = self._calculate_risk(dep)
            
        return all_deps

    def _parse_requirements(self, file_path: Path) -> List[Dependency]:
        deps = []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"): continue
                    
                    # Basic parser for 'name==version' or 'name>=version'
                    import re
                    match = re.split(r'[=<>~!]', line)
                    if match:
                        name = match[0].strip()
                        version = line[len(name):].strip() or "unknown"
                        deps.append(Dependency(
                            name=name,
                            version=version,
                            language="python",
                            file_path=str(file_path)
                        ))
        except Exception as e:
            logger.error(f"Error parsing {file_path}: {e}")
        return deps

    def _parse_package_json(self, file_path: Path) -> List[Dependency]:
        deps = []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                combined = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
                for name, version in combined.items():
                    deps.append(Dependency(
                        name=name,
                        version=version,
                        language="javascript",
                        file_path=str(file_path),
                        license=data.get("license") # Note: this is the app's license, not the dep
                    ))
        except Exception as e:
            logger.error(f"Error parsing {file_path}: {e}")
        return deps

    def _check_vulnerabilities(self, deps: List[Dependency], root_dir: str):
        """Use 'safety' and other tools to find known vulnerabilities"""
        
        # 1. Run Safety for Python
        python_reqs = [d.file_path for d in deps if d.language == "python"]
        if python_reqs:
            for req in set(python_reqs):
                try:
                    # Run safety check --json -r <req_file>
                    result = subprocess.run(
                        ["safety", "check", "--json", "-r", req],
                        capture_output=True, text=True
                    )
                    if result.stdout:
                        vulns = json.loads(result.stdout)
                        # Map vulns to deps
                        for vuln in vulns.get("vulnerabilities", []):
                            pkg_name = vuln.get("package_name")
                            for d in deps:
                                if d.name.lower() == pkg_name.lower():
                                    d.vulnerabilities.append({
                                        "id": vuln.get("vulnerability_id"),
                                        "severity": "high", # safety doesn't always provide cvss in json?
                                        "message": vuln.get("advisory"),
                                        "fixed_version": vuln.get("fixed_versions")
                                    })
                                    d.risk_factors.append("Known Vulnerability")
                except Exception as e:
                    logger.warning(f"Safety check failed: {e}")

    def _calculate_risk(self, dep: Dependency) -> float:
        """Calculate a risk score from 0-100"""
        score = 0.0
        if dep.vulnerabilities:
            score += 50 + (len(dep.vulnerabilities) * 5)
            
        # Heuristics for typosquatting (simple)
        if len(dep.name) < 4: score += 10
        if "-" in dep.name and "_" in dep.name: score += 5
        
        # License risk (Placeholders for now)
        if dep.license in ["GPL", "AGPL"]:
            score += 20
            dep.risk_factors.append("License Conflict (GPL)")
            
        return min(100.0, score)

# Global instance
_analyzer: Optional[DependencyAnalyzer] = None

def get_dependency_analyzer() -> DependencyAnalyzer:
    """Get or create global instance"""
    global _analyzer
    if _analyzer is None:
        _analyzer = DependencyAnalyzer()
    return _analyzer
