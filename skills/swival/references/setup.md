# Swival Setup

Install Swival, configure the litellm proxy, and verify connectivity.

## Install Swival

```bash
uv tool install swival
```

## Install litellm proxy with provider extras

```bash
# Bedrock + Vertex
uv tool install 'litellm[proxy,bedrock,google]'

# Bedrock only
uv tool install 'litellm[proxy,bedrock]'
```

## Create litellm proxy config

Write `~/.config/litellm/config.yaml`. Each entry maps a short model
name to a provider-specific model string.

### Bedrock (AWS)

Bedrock requires cross-region inference profile IDs (`us.` prefix),
not raw model IDs. Raw model IDs return "on-demand throughput isn't
supported."

```yaml
model_list:
  - model_name: claude-opus-4-6
    litellm_params:
      model: bedrock/us.anthropic.claude-opus-4-6-v1
      aws_region_name: us-east-2

  - model_name: claude-sonnet-4-6
    litellm_params:
      model: bedrock/us.anthropic.claude-sonnet-4-6
      aws_region_name: us-east-2

  - model_name: claude-haiku-4-5
    litellm_params:
      model: bedrock/us.anthropic.claude-haiku-4-5-20251001-v1:0
      aws_region_name: us-east-2
```

Authentication uses the standard AWS credential chain
(`AWS_PROFILE`, `~/.aws/credentials`, instance roles).

### Vertex AI (Google Cloud)

```yaml
  - model_name: gemini-3.1-pro
    litellm_params:
      model: vertex_ai/gemini-3.1-pro-preview
      vertex_project: your-project-id
      vertex_location: us-east1
```

Authentication uses `gcloud auth application-default login`.

### Recommended settings

```yaml
litellm_settings:
  drop_params: true
  num_retries: 3
```

## Create Swival config

Write `~/.config/swival/config.toml`:

```toml
provider = "generic"
model = "claude-opus-4-6"          # default model name from proxy
base_url = "http://127.0.0.1:4000"
api_key = "sk-unused"              # proxy requires a key but ignores it
yolo = true                        # unrestricted filesystem access
```

Swival has no native Bedrock or Vertex provider. The `generic`
provider points at the litellm proxy, which translates to the
real provider.

## Install proxy manager

Write `~/.local/bin/swival-proxy`:

```bash
#!/bin/bash
set -euo pipefail
CONFIG="${HOME}/.config/litellm/config.yaml"
PORT=4000
PIDFILE="${HOME}/.config/litellm/proxy.pid"
LOGFILE="${HOME}/.config/litellm/proxy.log"

start() {
    if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
        echo "litellm proxy already running (PID $(cat "$PIDFILE"))"
        return 0
    fi
    echo "Starting litellm proxy on port ${PORT}..."
    nohup litellm --config "$CONFIG" --port "$PORT" > "$LOGFILE" 2>&1 &
    echo $! > "$PIDFILE"
    sleep 2
    if kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
        echo "litellm proxy started (PID $(cat "$PIDFILE"))"
    else
        echo "Failed to start. Check $LOGFILE" >&2
        rm -f "$PIDFILE"
        return 1
    fi
}

stop() {
    if [[ -f "$PIDFILE" ]]; then
        local pid; pid=$(cat "$PIDFILE")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"; echo "Stopped (PID $pid)"
        else
            echo "Not running (stale PID file)"
        fi
        rm -f "$PIDFILE"
    else
        echo "Not running"
    fi
}

status() {
    if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
        echo "Running (PID $(cat "$PIDFILE"), port ${PORT})"
    else
        echo "Not running"; return 1
    fi
}

case "${1:-status}" in
    start)   start ;;
    stop)    stop ;;
    restart) stop; sleep 1; start ;;
    status)  status ;;
    *)       echo "Usage: swival-proxy start|stop|status|restart" >&2; exit 1 ;;
esac
```

```bash
chmod +x ~/.local/bin/swival-proxy
```

## Verify

```bash
swival-proxy start
swival --model claude-haiku-4-5 -q "Say hello"
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "on-demand throughput isn't supported" | Raw model ID instead of inference profile | Use `us.` prefix: `bedrock/us.anthropic.claude-...` |
| "Google Cloud SDK not found" | Missing Python package in litellm venv | `uv tool install 'litellm[proxy,google]'` |
| Connection refused on :4000 | Proxy not running | `swival-proxy start` |
| "unknown provider" | Provider not in Swival's enum | Use `generic` provider with litellm proxy |
| Vertex 404 "model not found" | Wrong project or API not enabled | Check `vertex_project` and enable Vertex AI API |
