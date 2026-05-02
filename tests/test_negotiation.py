# tests/test_negotiation.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from src.agents.negotiation import run_negotiation, NegotiationResult
from src.payments.receipt import Receipt
from src.ens.resolver import AgentRecord


def _mock_agent_record():
    return AgentRecord(
        axl_node="http://127.0.0.1:9012",
        toll_price="0.25",
        currency="USDC",
        workflow_id="bella/inbound-toll",
        capabilities=["booking"],
    )


def _confirmed_receipt(tx_hash="0xabc"):
    return Receipt(tx_hash=tx_hash, signed_receipt="sig", status="confirmed")


@pytest.mark.asyncio
async def test_successful_negotiation():
    with (
        patch("src.agents.negotiation.resolve_agent_records", new_callable=AsyncMock, return_value=_mock_agent_record()),
        patch("src.agents.negotiation.KeeperHubClient") as mock_kh_cls,
        patch("src.agents.negotiation.AXLSession") as mock_axl_cls,
    ):
        mock_kh = AsyncMock()
        mock_kh.pay_workflow = AsyncMock(return_value=_confirmed_receipt("0xtoll"))
        mock_kh.execute_workflow = AsyncMock(return_value=_confirmed_receipt("0xsettle"))
        mock_kh.aclose = AsyncMock()
        mock_kh_cls.return_value = mock_kh

        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)
        mock_session.send = AsyncMock()
        mock_session.receive = AsyncMock(return_value={
            "type": "ACCEPT", "slot_id": "BELLA-FRI-8PM",
            "deposit_amount": "20.00", "terms_hash": "0xterms"
        })
        mock_axl_cls.return_value = mock_session

        result = await run_negotiation(
            callee_ens="bella-tollgate.eth",
            booking_date="2026-05-02",
            party_size=4,
            max_deposit="25.00",
            caller_wallet="0xAlex",
            caller_ens="alex-tollgate.eth",
        )

    assert result.success is True
    assert result.slot_id == "BELLA-FRI-8PM"
    assert result.toll_receipt.tx_hash == "0xtoll"
    assert result.settlement_receipt.tx_hash == "0xsettle"


@pytest.mark.asyncio
async def test_ens_failure_returns_error():
    with patch("src.agents.negotiation.resolve_agent_records", new_callable=AsyncMock, side_effect=Exception("DNS fail")):
        result = await run_negotiation(
            callee_ens="bad.eth",
            booking_date="2026-05-02",
            party_size=4,
            max_deposit="25.00",
            caller_wallet="0xAlex",
            caller_ens="alex.eth",
        )
    assert result.success is False
    assert "ENS resolution error" in result.error


@pytest.mark.asyncio
async def test_toll_failure_returns_error():
    with (
        patch("src.agents.negotiation.resolve_agent_records", new_callable=AsyncMock, return_value=_mock_agent_record()),
        patch("src.agents.negotiation.KeeperHubClient") as mock_kh_cls,
    ):
        mock_kh = AsyncMock()
        mock_kh.pay_workflow = AsyncMock(side_effect=Exception("KeeperHub down"))
        mock_kh_cls.return_value = mock_kh

        result = await run_negotiation(
            callee_ens="bella.eth",
            booking_date="2026-05-02",
            party_size=4,
            max_deposit="25.00",
            caller_wallet="0xAlex",
            caller_ens="alex.eth",
        )
    assert result.success is False
    assert "Toll payment failed" in result.error


@pytest.mark.asyncio
async def test_axl_reject_returns_error():
    with (
        patch("src.agents.negotiation.resolve_agent_records", new_callable=AsyncMock, return_value=_mock_agent_record()),
        patch("src.agents.negotiation.KeeperHubClient") as mock_kh_cls,
        patch("src.agents.negotiation.AXLSession") as mock_axl_cls,
    ):
        mock_kh = AsyncMock()
        mock_kh.pay_workflow = AsyncMock(return_value=_confirmed_receipt())
        mock_kh_cls.return_value = mock_kh

        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)
        mock_session.send = AsyncMock()
        mock_session.receive = AsyncMock(return_value={"type": "REJECT", "reason": "fully booked"})
        mock_axl_cls.return_value = mock_session

        result = await run_negotiation(
            callee_ens="bella.eth",
            booking_date="2026-05-02",
            party_size=4,
            max_deposit="25.00",
            caller_wallet="0xAlex",
            caller_ens="alex.eth",
        )
    assert result.success is False
    assert "fully booked" in result.error
