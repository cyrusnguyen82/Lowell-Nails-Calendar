# Workflows

Markdown SOPs that define how to accomplish recurring tasks. Each workflow is a set of instructions for the agent.

## Structure of a workflow file

```
# Workflow: <Name>

## Objective
What this workflow accomplishes.

## Inputs Required
- Input 1: description
- Input 2: description

## Tools Used
- `tools/<script>.py` — what it does

## Steps
1. Step one
2. Step two
...

## Expected Output
What a successful run produces.

## Edge Cases & Notes
- Known rate limits, quirks, or failure modes
```

## Updating workflows
Workflows evolve as you learn. When you discover a better approach or hit a constraint, update the relevant workflow so it doesn't happen again.
