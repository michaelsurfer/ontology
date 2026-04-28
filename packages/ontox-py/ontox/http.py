import json
import requests

from .utils.errors import create_ontox_api_error


class HttpClient:
    def __init__(self, base_url, api_key=None, timeout_seconds=30):
        self.base_url = (base_url or "http://localhost:5174").rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    # Perform an HTTP request and parse JSON response.
    def request_json(self, method, path, body=None):
        response = self._request_raw(method, path, body)
        if not response.text:
            return None
        try:
            return response.json()
        except Exception:
            raise create_ontox_api_error(
                message="Expected JSON but got invalid JSON",
                status=response.status_code,
                details=response.text[:500],
            )

    # Perform an HTTP request and return text response.
    def request_text(self, method, path, body=None):
        response = self._request_raw(method, path, body)
        return response.text

    # Perform an HTTP request and return the raw response.
    def _request_raw(self, method, path, body=None):
        url = f"{self.base_url}{path}"
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body)
        else:
            data = None

        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            data=data,
            timeout=self.timeout_seconds,
        )

        if response.status_code >= 400:
            raise create_ontox_api_error(
                message=f"HTTP {response.status_code} for {method} {path}",
                status=response.status_code,
                details=response.text,
            )

        return response

