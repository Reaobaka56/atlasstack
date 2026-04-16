import os
import subprocess
import json
import uuid
from pathlib import Path
from typing import Dict, Any, Optional
import structlog

logger = structlog.get_logger()

class DockerAnalysisEngine:
    """Isolated analysis engine using Docker containers."""
    
    def __init__(self, image_name: str = "atlasstack-worker"):
        self.image_name = image_name

    def run_isolated_scan(self, target_path: str, is_local: bool = True) -> Dict[str, Any]:
        """Runs the analysis in a temporary Docker container."""
        scan_id = str(uuid.uuid4())
        
        # Determine mount point
        abs_target = os.path.abspath(target_path)
        
        # On Windows, docker volumes need forward slashes or specific formatting
        # We'll use the current directory mapping logic
        mount_src = abs_target
        mount_dst = "/scan_target"
        
        logger.info("Starting isolated Docker scan", scan_id=scan_id, target=abs_target)
        
        # Build the docker command
        # We need to run the AnalysisOrchestrator inside the container
        # Since the orchestrator is internal, we'll run a python snippet
        python_cmd = f"""
import asyncio
import json
from services.analysis.core.orchestrator import AnalysisOrchestrator

async def run():
    orchestrator = AnalysisOrchestrator()
    result = await orchestrator.analyze_repository("{mount_dst}", is_local=True)
    print("---RESULT_START---")
    print(json.dumps(result))
    print("---RESULT_END---")

asyncio.run(run())
"""
        # Escape for shell
        python_cmd_escaped = python_cmd.replace('"', '\\"')
        
        try:
            cmd = [
                "docker", "run", "--rm",
                "-v", f"{mount_src}:{mount_dst}:ro",
                self.image_name,
                "python", "-c", python_cmd
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            output = result.stdout
            
            # Extract JSON from output
            if "---RESULT_START---" in output and "---RESULT_END---" in output:
                json_str = output.split("---RESULT_START---")[1].split("---RESULT_END---")[0].strip()
                return json.loads(json_str)
            else:
                logger.error("Failed to parse Docker output", output=output)
                raise Exception("Invalid output from Docker container")
                
        except subprocess.CalledProcessError as e:
            logger.error("Docker command failed", stderr=e.stderr, stdout=e.stdout)
            raise Exception(f"Docker analysis failed: {e.stderr}")
        except Exception as e:
            logger.error("Isolated scan failed", error=str(e))
            raise e
