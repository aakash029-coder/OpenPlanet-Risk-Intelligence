"""
tests/test_privacy_security.py — Privacy, caching, security headers, and redaction tests.
"""
import json
import os
import tempfile
import time
import pytest
from unittest.mock import patch, MagicMock, PropertyMock
from fastapi import Request
from fastapi.testclient import TestClient

from climate_engine.services.disk_cache import disk_get, disk_set, _path_for
from climate_engine.services.historical_service import _BoundedCache
from climate_engine.services.socioeconomic.worldbank import BoundedTTLCache
from climate_engine.api.main import create_app


def test_disk_cache_roundtrip_and_ttl():
    """Verify disk cache stores data, returns it, and honors TTL expiration."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        with patch("climate_engine.services.disk_cache.CACHE_DIR", tmp_dir):
            key = "test_city_coords_51.5_-0.1"
            data = {"temperature": 22.5, "series": [1, 2, 3]}

            # 1. Miss on empty cache
            assert disk_get(key) is None

            # 2. Set and get
            disk_set(key, data)
            retrieved = disk_get(key, ttl=3600)
            assert retrieved == data

            # 3. Simulate expired entry by writing past timestamp
            path = _path_for(key)
            assert os.path.exists(path)
            with open(path, "w", encoding="utf-8") as fh:
                json.dump({"_ts": time.time() - 7200, "key": key, "data": data}, fh)

            # Fetch with 3600 second TTL -> should be expired
            assert disk_get(key, ttl=3600) is None


def test_disk_cache_eviction_under_cap():
    """Verify disk cache enforces max files limit via LRU modification time."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        with patch("climate_engine.services.disk_cache.CACHE_DIR", tmp_dir), \
             patch("climate_engine.services.disk_cache.MAX_FILES", 3):

            for i in range(5):
                disk_set(f"key_{i}", {"val": i})
                time.sleep(0.01)

            # Check that total JSON files on disk does not exceed 3
            files = [f for f in os.listdir(tmp_dir) if f.endswith(".json")]
            assert len(files) <= 3


def test_bounded_cache_in_memory_lru():
    """Verify in-memory _BoundedCache bounds max size and respects TTL."""
    cache = _BoundedCache(maxsize=3, ttl=10)
    cache.set("a", 1)
    cache.set("b", 2)
    cache.set("c", 3)
    assert cache.get("a") == 1
    assert cache.get("b") == 2
    assert cache.get("c") == 3

    # Add 4th item, oldest will be evicted
    cache.set("d", 4)
    # Total size should stay at 3
    active_keys = [k for k in ["a", "b", "c", "d"] if cache.get(k) is not None]
    assert len(active_keys) == 3


def test_bounded_ttl_cache_expiration():
    """Verify BoundedTTLCache expires old entries."""
    import asyncio
    cache = BoundedTTLCache(max_size=5, ttl_seconds=0.01)

    async def _run():
        await cache.set("k1", "val1")
        assert await cache.get("k1") == "val1"
        await asyncio.sleep(0.05)
        # Should now be expired
        assert await cache.get("k1") is None

    asyncio.run(_run())


def test_security_headers_and_request_id():
    """Verify defensive security headers and X-Request-ID middleware."""
    app = create_app()
    client = TestClient(app)

    response = client.get("/health")
    assert response.status_code == 200

    headers = response.headers
    assert "x-request-id" in headers
    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert headers.get("x-xss-protection") == "1; mode=block"
    assert headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    assert "permissions-policy" in headers


def test_security_headers_hsts_in_production():
    """Verify Strict-Transport-Security (HSTS) is set when ENV_MODE is production."""
    with patch("climate_engine.settings.settings.ENV_MODE", "production"):
        app = create_app()
        client = TestClient(app)
        response = client.get("/health")
        assert "strict-transport-security" in response.headers


def test_api_key_redaction_in_logs():
    """Verify invalid API key logging does NOT leak key characters in log output."""
    from climate_engine.api.security import verify_api_key
    from climate_engine.settings import Settings

    fake_request = MagicMock(spec=Request)
    fake_request.url.path = "/api/test"
    fake_request.client.host = "127.0.0.1"

    with patch.object(Settings, "allowed_api_keys", new_callable=PropertyMock) as mock_allowed:
        mock_allowed.return_value = {"valid_secret_key_123"}
        with patch("climate_engine.api.security.logger") as mock_logger:
            with pytest.raises(Exception):
                import asyncio
                asyncio.run(verify_api_key(fake_request, api_key="secret_customer_token_9999"))

            # Check that logger.warning was called
            mock_logger.warning.assert_called_once()
            args = mock_logger.warning.call_args[0]
            log_message = args[0] % args[1:]
            # Ensure the raw token characters are NOT in the formatted log message
            assert "secret_customer_token" not in log_message
            assert "9999" not in log_message
            # Ensure key_len is logged instead
            assert "key_len" in log_message
