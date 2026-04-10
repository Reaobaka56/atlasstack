"""
Architecture Mapper Engine
Analyzes code relationships and generates visual maps
"""

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Any

import structlog
from engine.ast_parser import ASTParser, get_parser, ParsedFile

logger = structlog.get_logger()

@dataclass
class ServiceNode:
    """A service or module in the architecture map"""
    id: str
    name: str
    type: str  # service, database, gateway, library
    file_path: Optional[str] = None
    technologies: Set[str] = field(default_factory=set)
    dependencies: Set[str] = field(default_factory=set)
    description: Optional[str] = None

@dataclass
class Interaction:
    """A data flow or connection between services"""
    source_id: str
    target_id: str
    interaction_type: str  # http, grpc, pubsub, direct_call
    description: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

class ArchitectureMapper:
    """Extracts architecture and data flow from source code"""

    def __init__(self):
        self.parser = get_parser()
        
    def map_repository(self, directory: str) -> Dict[str, Any]:
        """Generate a complete architecture map for a repository"""
        path = Path(directory)
        nodes: Dict[str, ServiceNode] = {}
        interactions: List[Interaction] = []
        
        parsed_files: List[ParsedFile] = []
        
        # 1. Parse all relevant files
        for file_path in path.rglob("*"):
            if not file_path.is_file() or any(p in file_path.parts for p in [".git", "node_modules", "__pycache__", "venv"]):
                continue
            
            lang = self.parser.detect_language(str(file_path))
            if lang in ["python", "javascript", "typescript", "java", "go"]:
                parsed = self.parser.parse_file(str(file_path))
                if not parsed.errors:
                    parsed_files.append(parsed)
        
        # 2. Identify major components (Services/Gateways)
        self._identify_components(parsed_files, nodes, directory)
        
        # 3. Track interactions between components
        self._trace_interactions(parsed_files, nodes, interactions)
        
        # 4. Generate Mermaid diagram
        mermaid = self._generate_mermaid(nodes, interactions)
        
        return {
            "nodes": [ { "id": n.id, "name": n.name, "type": n.type, "technologies": list(n.technologies) } for n in nodes.values()],
            "interactions": [ { "from": i.source_id, "to": i.target_id, "type": i.interaction_type } for i in interactions ],
            "mermaid": mermaid
        }

    def _identify_components(self, parsed_files: List[ParsedFile], nodes: Dict[str, ServiceNode], root_dir: str):
        """Identify architectural components based on imports and file structure"""
        for parsed in parsed_files:
            rel_path = os.path.relpath(parsed.file_path, root_dir)
            
            # Simple heuristic for identifying services
            node_type = "module"
            if "api" in rel_path.lower() or "gateway" in rel_path.lower():
                node_type = "gateway"
            elif "service" in rel_path.lower():
                node_type = "service"
            elif "database" in rel_path.lower() or "models" in rel_path.lower():
                node_type = "database"
            
            # Use top-level directory as component ID for now
            parts = Path(rel_path).parts
            if len(parts) > 1:
                comp_id = parts[0]
            else:
                comp_id = "root"
                
            if comp_id not in nodes:
                nodes[comp_id] = ServiceNode(
                    id=comp_id,
                    name=comp_id.capitalize(),
                    type=node_type,
                    file_path=rel_path
                )
            
            # Detect technologies
            if parsed.language:
                nodes[comp_id].technologies.add(parsed.language)
            
            for imp in parsed.imports:
                if "fastapi" in imp.module.lower():
                    nodes[comp_id].technologies.add("FastAPI")
                    nodes[comp_id].type = "gateway"
                elif "sqlalchemy" in imp.module.lower() or "postgres" in imp.module.lower():
                    nodes[comp_id].technologies.add("PostgreSQL")
                elif "redis" in imp.module.lower():
                    nodes[comp_id].technologies.add("Redis")
                elif "celery" in imp.module.lower():
                    nodes[comp_id].technologies.add("Celery")

    def _trace_interactions(self, parsed_files: List[ParsedFile], nodes: Dict[str, ServiceNode], interactions: List[Interaction]):
        """Trace data flow and dependencies between identified components"""
        for parsed in parsed_files:
            # Find which node this file belongs to
            source_id = self._get_node_for_file(parsed.file_path, nodes)
            if not source_id: continue
            
            for imp in parsed.imports:
                # Check if import refers to another component
                target_id = self._get_node_from_import(imp.module, nodes)
                if target_id and target_id != source_id:
                    # Avoid duplicate interactions
                    if not any(i.source_id == source_id and i.target_id == target_id for i in interactions):
                        interactions.append(Interaction(
                            source_id=source_id,
                            target_id=target_id,
                            interaction_type="direct_call",
                            description=f"Imports {imp.module}"
                        ))

    def _get_node_for_file(self, file_path: str, nodes: Dict[str, ServiceNode]) -> Optional[str]:
        # Implementation depends on how we mapped components
        for node_id, node in nodes.items():
            if file_path.startswith(os.path.dirname(node.file_path or "")):
                return node_id
        # Fallback to first part of path
        parts = Path(file_path).parts
        for part in parts:
            if part in nodes: return part
        return None

    def _get_node_from_import(self, module_name: str, nodes: Dict[str, ServiceNode]) -> Optional[str]:
        # Check if module matches a node ID
        primary_module = module_name.split('.')[0]
        if primary_module in nodes:
            return primary_module
        return None

        return "\n".join(lines)

    def calculate_impact(self, changed_files: List[str], nodes: Dict[str, ServiceNode], interactions: List[Interaction]) -> Dict[str, Any]:
        """
        Calculate the 'blast radius' of changes to a set of files.
        Returns affected nodes and reason for impact.
        """
        affected_nodes = {}
        source_nodes = set()
        
        # 1. Identify which components are directly modified
        for file in changed_files:
            node_id = self._get_node_for_file(file, nodes)
            if node_id:
                source_nodes.add(node_id)
                if node_id not in affected_nodes:
                    affected_nodes[node_id] = {
                        "id": node_id,
                        "name": nodes[node_id].name,
                        "reason": f"Directly modified file: {file}",
                        "severity": "high"
                    }

        # 2. Identify downstream nodes (BFS)
        queue = list(source_nodes)
        visited = set(source_nodes)
        
        while queue:
            current_id = queue.pop(0)
            
            # Find interactions where current_id is the target (meaning source depends on target)
            for interaction in interactions:
                if interaction.target_id == current_id:
                    downstream_id = interaction.source_id
                    if downstream_id not in visited:
                        visited.add(downstream_id)
                        queue.append(downstream_id)
                        affected_nodes[downstream_id] = {
                            "id": downstream_id,
                            "name": nodes[downstream_id].name,
                            "reason": f"Indirectly affected. Depends on {nodes[current_id].name}.",
                            "severity": "medium"
                        }

        return {
            "source_nodes": list(source_nodes),
            "affected_nodes": list(affected_nodes.values()),
            "total_impacted_services": len(affected_nodes)
        }

# Global instance
_mapper: Optional[ArchitectureMapper] = None

def get_mapper() -> ArchitectureMapper:
    """Get or create global mapper instance"""
    global _mapper
    if _mapper is None:
        _mapper = ArchitectureMapper()
    return _mapper
