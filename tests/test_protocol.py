# tests/test_protocol.py
import pytest
from src.protocol.messages import (
    ProposeMessage, CounterMessage, AcceptMessage,
    ConfirmMessage, RejectMessage, MessageType,
)


def test_propose_message_serializes():
    msg = ProposeMessage(date="2026-05-02", party_size=4, deposit_amount="20.00")
    data = msg.to_dict()
    assert data["type"] == "PROPOSE"
    assert data["date"] == "2026-05-02"
    assert data["party_size"] == 4
    assert data["deposit_amount"] == "20.00"


def test_counter_message_serializes():
    msg = CounterMessage(
        date="2026-05-02", party_size=4, deposit_amount="20.00",
        alt_slots=["8pm", "9pm"]
    )
    data = msg.to_dict()
    assert data["type"] == "COUNTER"
    assert data["alt_slots"] == ["8pm", "9pm"]


def test_accept_message_round_trips():
    msg = AcceptMessage(slot_id="slot-abc", deposit_amount="20.00", terms_hash="0xdeadbeef")
    data = msg.to_dict()
    rebuilt = AcceptMessage(
        slot_id=data["slot_id"],
        deposit_amount=data["deposit_amount"],
        terms_hash=data["terms_hash"],
    )
    assert rebuilt.slot_id == msg.slot_id
    assert rebuilt.terms_hash == "0xdeadbeef"


def test_reject_message_has_reason():
    msg = RejectMessage(reason="slot unavailable")
    assert msg.to_dict()["type"] == "REJECT"
    assert msg.to_dict()["reason"] == "slot unavailable"


def test_confirm_message_has_signature():
    msg = ConfirmMessage(slot_id="BELLA-FRI-8PM", signature="agent-sig-xyz")
    data = msg.to_dict()
    assert data["type"] == "CONFIRM"
    assert data["signature"] == "agent-sig-xyz"


def test_message_type_enum_values():
    assert MessageType.PROPOSE.value == "PROPOSE"
    assert MessageType.COUNTER.value == "COUNTER"
    assert MessageType.ACCEPT.value == "ACCEPT"
    assert MessageType.REJECT.value == "REJECT"
    assert MessageType.CONFIRM.value == "CONFIRM"


def test_all_messages_have_type_field():
    messages = [
        ProposeMessage(date="x", party_size=1, deposit_amount="0"),
        CounterMessage(date="x", party_size=1, deposit_amount="0", alt_slots=[]),
        AcceptMessage(slot_id="s", deposit_amount="0", terms_hash="h"),
        RejectMessage(reason="r"),
        ConfirmMessage(slot_id="s", signature="sig"),
    ]
    expected_types = ["PROPOSE", "COUNTER", "ACCEPT", "REJECT", "CONFIRM"]
    for msg, expected in zip(messages, expected_types):
        assert msg.to_dict()["type"] == expected
