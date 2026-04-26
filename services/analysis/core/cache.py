"""
Redis cache manager for AtlasStack
"""

import json
from typing import Any, Optional

import redis
from services.analysis.core.config import settings


class CacheManager:
    """Manages Redis caching for analysis results and metadata"""

    def __init__(self):
        self.redis_client = redis.from_url(settings.REDIS_URL)
        self.default_ttl = 3600  # 1 hour

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        data = self.redis_client.get(key)
        if data:
            return json.loads(data)
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache with optional TTL"""
        ttl = ttl or self.default_ttl
        try:
            self.redis_client.setex(
                key,
                ttl,
                json.dumps(value)
            )
            return True
        except Exception:
            return False

    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        return self.redis_client.delete(key) > 0

    def get_analysis_key(self, repo_id: str, analysis_type: str) -> str:
        """Generate a consistent cache key for analysis results"""
        return f"analysis:{repo_id}:{analysis_type}"

# Global instance
cache = CacheManager()
