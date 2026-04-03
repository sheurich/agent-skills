# Swival Setup

Install Swival, configure the litellm proxy, and verify connectivity.

## Prerequisites

Swival and litellm are installed via `uv tool`. If `uv` is not
available, substitute `pipx` in the commands below.

```bash
command -v uv >/dev/null 2>&1 || command -v pipx >/dev/null 2>&1 || {
  echo "Neither uv nor pipx found. Install uv: https://docs.astral.sh/uv/"
  exit 1
}
```

## Install Swival

```bash
uv tool install swival
# or: pipx install swival
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
# yolo = true                      # opt-in: disable filesystem and command restrictions
```

Swival has no native Bedrock or Vertex provider. The `generic`
provider points at the litellm proxy, which translates to the
real provider.

By default, Swival restricts file access to the working directory
and limits commands to a whitelist. Add `yolo = true` only for
trusted local work where restrictions get in the way.

## Install proxy manager

The script is at `../scripts/swival-proxy` relative to this file.
Copy it into your PATH:

```bash
mkdir -p ~/.local/bin
cd "$(dirname "$0")" 2>/dev/null  # if sourced from the skill directory
cp ../scripts/swival-proxy ~/.local/bin/swival-proxy
chmod +x ~/.local/bin/swival-proxy
```

If running interactively, `cd` into `skills/swival/references/` first,
or substitute the full path to `scripts/swival-proxy`.

The script checks that `litellm` is installed and that the config
file exists before starting the proxy.

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
| `litellm: command not found` | litellm not installed | `uv tool install 'litellm[proxy,bedrock]'` |
| `uv: command not found` | uv not installed | See https://docs.astral.sh/uv/ or use `pipx` |
