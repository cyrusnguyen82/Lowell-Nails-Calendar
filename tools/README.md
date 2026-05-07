# Tools

Python scripts for deterministic execution. Each script does one thing reliably.

## Conventions
- Scripts read credentials from `.env` (use `python-dotenv`)
- Scripts accept inputs via CLI args or stdin
- Scripts write outputs to `.tmp/` or directly to cloud services
- Each script should be independently runnable and testable

## Adding a new tool
1. Create `tools/<tool_name>.py`
2. Add a docstring at the top describing inputs, outputs, and any side effects
3. Reference it from the relevant workflow in `workflows/`
