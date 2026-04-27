# tests/test_ens.py
import pytest
from src.ens.resolver import resolve_agent_records, AgentRecord

@pytest.mark.asyncio
async def test_resolve_returns_agent_record():
    record = AgentRecord(
        axl_node="ax1q9abc",
        toll_price="0.25",
        currency="USDC",
        workflow_id="bella/inbound-toll",
        capabilities=["booking"],
        agent_version="tollgate/0.1",
    )
    assert record.axl_node == "ax1q9abc"
    assert float(record.toll_price) == 0.25

@pytest.mark.asyncio
async def test_parse_text_records():
    from src.ens.resolver import _parse_text_records
    raw = {
        "axl.node": "ax1q9abc",
        "contact.price": "0.25",
        "contact.currency": "USDC",
        "contact.workflow": "bella/inbound-toll",
        "capabilities": '["booking","quotes"]',
        "agent.version": "tollgate/0.1",
    }
    record = _parse_text_records(raw)
    assert record.capabilities == ["booking", "quotes"]

def test_parse_missing_capabilities_defaults_to_empty():
    from src.ens.resolver import _parse_text_records
    record = _parse_text_records({"axl.node": "x", "contact.price": "0"})
    assert record.capabilities == []

def test_parse_comma_separated_capabilities():
    from src.ens.resolver import _parse_text_records
    record = _parse_text_records({"capabilities": "booking,quotes"})
    assert record.capabilities == ["booking", "quotes"]
