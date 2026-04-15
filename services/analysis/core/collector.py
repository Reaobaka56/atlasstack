"""
Training Data Collector
Handles persistence of scan inputs and outputs for future LLM training.
"""

import json
import os
from datetime import datetime
from pathlib import Path
import structlog

logger = structlog.get_logger()

class TrainingDataCollector:
    """Collects and stores data for fine-tuning AtlasStack's analysis engine."""
    
    def __init__(self, 
                 enabled: bool = None, 
                 storage_path: str = None):
        # Default to environment variables if not provided
        self.enabled = enabled if enabled is not None else (os.environ.get("COLLECT_TRAINING_DATA", "true").lower() == "true")
        self.storage_path = Path(storage_path or os.environ.get("TRAINING_DATA_PATH", "training/datasets/collected_scans.jsonl"))
        
        if self.enabled:
            self._ensure_storage()
            logger.info("Training data collector initialized", path=str(self.storage_path))

    def _ensure_storage(self):
        """Creates necessary directories and files."""
        try:
            self.storage_path.parent.mkdir(parents=True, exist_ok=True)
            if not self.storage_path.exists():
                self.storage_path.touch()
        except Exception as e:
            logger.error(f"Failed to initialize training data storage: {e}")
            self.enabled = False

    def collect(self, instruction: str, input_data: str, output_data: dict, metadata: dict = None):
        """
        Record a single training example.
        
        Args:
            instruction (str): The task description/system instructions.
            input_data (str): The context (repo tree, code snippets).
            output_data (dict): The structured result from the LLM.
            metadata (dict): Optional tracking info (repo_url, scan_id, model).
        """
        if not self.enabled:
            return

        try:
            entry = {
                "instruction": instruction,
                "input": input_data,
                "output": json.dumps(output_data) if isinstance(output_data, dict) else output_data,
                "metadata": metadata or {}
            }
            entry["metadata"]["timestamp"] = datetime.utcnow().isoformat()
            
            with open(self.storage_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry) + "\n")
                
            logger.debug("Training example collected", scan_id=entry["metadata"].get("scan_id"))
        except Exception as e:
            logger.error(f"Failed to collect training data: {e}")
