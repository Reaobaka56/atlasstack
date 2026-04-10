#!/usr/bin/env python3
"""
AtlasStack Quality Gate CLI
Used in CI/CD pipelines to fail builds if security or architectural risks are too high.
"""

import sys
import argparse
import requests
import time
import json

def main():
    parser = argparse.ArgumentParser(description="AtlasStack Quality Gate")
    parser.add_argument("--api-url", default="http://localhost:8000", help="AtlasStack API URL")
    parser.add_argument("--repo-path", required=True, help="Path to the repository to scan")
    parser.add_argument("--threshold", type=int, default=70, help="Minimum health score to pass (0-100)")
    parser.add_argument("--fail-on-vulns", action="store_true", help="Fail if any critical/high vulns are found")
    parser.add_argument("--token", help="AtlasStack API Token (optional)")

    args = parser.parse_args()

    print(f"🚀 Initializing AtlasStack scan for {args.repo_path}...")
    
    # In a real CI environment, we'd zip the repo or provide the URL.
    # For this CLI, we assume the API can access the path (local) or we send the repo_url.
    # We'll simulate by sending a local-path request if supported, or a mock URL.
    
    payload = {
        "repo_url": args.repo_path,
        "save_result": False
    }
    
    headers = {}
    if args.token:
        headers["Authorization"] = f"Bearer {args.token}"

    try:
        response = requests.post(f"{args.api_url}/api/v1/analysis/mvp", json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"❌ Error reaching AtlasStack API: {e}")
        sys.exit(1)

    health_score = data.get("health_score", 0)
    security_report = data.get("security_report", {})
    overall_risk = security_report.get("overall_risk", 0)
    
    print("-" * 40)
    print(f"✅ Scan Complete.")
    print(f"📊 Health Score: {health_score}/100")
    print(f"🛡 Security Risk: {overall_risk}/100")
    print("-" * 40)

    failed = False
    
    if health_score < args.threshold:
        print(f"🔴 FAILED: Health score {health_score} is below threshold {args.threshold}.")
        failed = True
    
    if args.fail_on_vulns and overall_risk > 50:
        print(f"🔴 FAILED: Critical/High vulnerabilities detected (Risk score: {overall_risk}).")
        failed = True

    if failed:
        print("❌ Quality Gate REJECTED.")
        sys.exit(1)
    else:
        print("✨ Quality Gate PASSED. All systems optimal.")
        sys.exit(0)

if __name__ == "__main__":
    main()
