from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from orchestrator.config import Settings
from orchestrator.main import create_app
from orchestrator.security import SecretManager, mask_secret


def test_mask_secret_protects_credentials():
    assert mask_secret("sk_live_1234567890abcdef1234") == "sk_l...234"
    assert mask_secret("short") == "****"
    assert mask_secret(None) == "<unset>"


def test_secret_manager_environment_resolution(monkeypatch):
    monkeypatch.setenv("TEST_KEY_PIXELATE", "super_secret_val_999")
    mgr = SecretManager(provider="env")
    assert mgr.get_secret("TEST_KEY_PIXELATE") == "super_secret_val_999"

    report = mgr.get_status_report()
    assert report["provider"] == "env"
    assert "configured_secrets" in report
    assert "masked_audit" in report


def test_security_audit_api_endpoint(tmp_path):
    settings = Settings(
        app_name="Agent Pixelate Test",
        campaign_data_dir=str(tmp_path),
        band_api_key=None,
    )
    app = create_app(settings)
    with TestClient(app) as client:
        resp = client.get("/api/security/audit")
        assert resp.status_code == 200
        data = resp.json()
        assert "provider" in data
        assert "configured_secrets" in data
        assert "masked_audit" in data
        # Ensure no plaintext secret leaked
        assert "super_secret_val_999" not in resp.text
