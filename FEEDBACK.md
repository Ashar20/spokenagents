# KeeperHub Integration Feedback

> Submitted for the KeeperHub builder feedback bounty. All feedback is specific and actionable, based on building Tollgate — a paid-inbound channel primitive for AI agents.

## Summary

We built Tollgate: every agent-to-agent call requires the caller to pay a toll via KeeperHub x402 before the callee will open a negotiation channel. KeeperHub was the load-bearing payment rail — not decorative. Here is what we found.

## MCP Ergonomics

**What worked well:**
- The MCP server abstraction maps naturally onto agent tool-use patterns. Having `pay_workflow` as a named tool call felt idiomatic for LLM-driven agents.
- The `workflow_id` concept (namespaced as `owner/name`) is clean and enables reusable payment primitives that other builders can adopt.

**Friction:**
- **No dry-run / simulation mode.** When integrating, we had to either make real on-chain calls or mock everything. A `simulate: true` flag on `pay_workflow` that validates inputs and returns a mock receipt without touching the chain would have saved significant dev time.
- **No sandbox environment documented.** The docs don't mention a test API URL or faucet-compatible workflow. We had to discover this through trial and error.
- **MCP tool parameter shapes aren't in the main docs.** The `/ai-tools` page describes the concept but not the exact JSON schema of each tool's input. We had to infer parameter names from the API docs and adapt.

## x402 Latency

We observed the following during rehearsal (Base Sepolia):
- Cold toll payment (first call, no pre-funded channel): ~4-6s
- Warm toll payment (subsequent calls): ~2-3s
- Settlement execution: ~3-5s
- Total toll + settlement: ~7-11s

This puts the "paid channel open" step at the edge of our 8s target. For production use, a pre-funded channel-credit balance would let the per-call toll be a local debit rather than an on-chain tx, dropping latency to <100ms.

**Suggestion:** Document the channel-credit / off-chain balance pattern as a recommended integration pattern for latency-sensitive use cases.

## Reproducible Issues

**Issue 1: Unclear error on missing workflow**
When a `workflow_id` that doesn't exist is passed to `pay_workflow`, the API returns a 400 with a generic `"workflow not found"` message that doesn't indicate whether the issue is the namespace, the name, or the caller's permissions. A 404 with `{"error": "workflow_not_found", "workflow_id": "..."}` would be more useful.

**Steps to reproduce:**
```python
client = KeeperHubClient()
await client.pay_workflow(TollPaymentRequest(
    workflow_id="nonexistent/workflow",
    amount="0.01",
    currency="USDC",
    from_wallet="0x...",
    caller_ens="test.eth",
))
# Expected: 404 with structured error
# Actual: 400 with {"message": "workflow not found"}
```

**Issue 2: Receipt `status` field undocumented**
The `status` field in the receipt response can be `"pending"`, `"confirmed"`, `"failed"`, or potentially others. The docs don't enumerate the possible values. We had to write `verify_receipt` defensively by only trusting `"confirmed"`.

## Documentation Gaps

1. **No end-to-end code example for agent-to-agent payment.** The docs cover wallet-to-wallet and app-to-app flows but not the pattern where one AI agent pays another agent's inbound toll. A minimal example showing the PROPOSE/PAY/OPEN pattern would help builders.

2. **KeeperHub workflow publishing process is unclear.** The spec says we can publish a `bella/inbound-toll` workflow for other builders to reuse, but the docs don't explain how to make a workflow public, set permissions, or version it.

3. **x402 receipt verification.** The docs say KeeperHub provides a signed receipt, but don't explain the signature format or how to verify it on-chain without trusting the KeeperHub API response. For security-critical use cases, this gap matters.

## Feature Requests

1. **`simulate: true` parameter on `pay_workflow`** — returns a mock confirmed receipt without executing a tx. Essential for test suites and CI.

2. **Channel-credit balance API** — pre-fund a credit that KeeperHub debits per call without on-chain tx. Document this pattern prominently for low-latency use cases.

3. **Workflow discovery / registry endpoint** — `GET /v1/workflows?tag=inbound-toll` to find published workflows from the community. The "toll booth" pattern we built only works at scale if callee agents can publish discoverable workflows.

4. **Webhook / push notification on settlement** — instead of polling for receipt status, a webhook would let agents react instantly when settlement confirms.

5. **ENS integration guide** — a short guide on how to store a KeeperHub workflow ID in an ENS text record (`contact.workflow`) so callers can discover it without out-of-band coordination.
