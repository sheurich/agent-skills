# Session Transcript

**User:**
I'm getting a `401 Unauthorized` error when hitting the legacy `v1/payments` endpoint, even though my API key works for `v2`.

**Agent:**
Let's check the legacy API documentation.
*(reads docs)*
Ah, the `v1` API requires the key to be sent as a basic auth username with an empty password, instead of as a Bearer token in the `Authorization` header like `v2` does.

Let's modify the client to handle this when calling `v1`.

*(writes code)*
```python
if version == 'v1':
    headers['Authorization'] = 'Basic ' + base64.b64encode(f"{api_key}:".encode()).decode()
else:
    headers['Authorization'] = f"Bearer {api_key}"
```

*(runs tests)*
The tests pass! The `v1` endpoint is now returning `200 OK`.

**User:**
Great, that fixed it. Can you extract a skill from this session so we don't forget this weird basic auth requirement for the legacy API?
