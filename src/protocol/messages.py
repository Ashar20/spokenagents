# src/protocol/messages.py
from dataclasses import asdict, dataclass, field
from enum import Enum


class MessageType(str, Enum):
    PROPOSE = "PROPOSE"
    COUNTER = "COUNTER"
    ACCEPT  = "ACCEPT"
    REJECT  = "REJECT"
    CONFIRM = "CONFIRM"


@dataclass
class ProposeMessage:
    date: str
    party_size: int
    deposit_amount: str
    type: str = MessageType.PROPOSE.value

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class CounterMessage:
    date: str
    party_size: int
    deposit_amount: str
    alt_slots: list[str]
    type: str = MessageType.COUNTER.value

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class AcceptMessage:
    slot_id: str
    deposit_amount: str
    terms_hash: str
    type: str = MessageType.ACCEPT.value

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class RejectMessage:
    reason: str
    type: str = MessageType.REJECT.value

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ConfirmMessage:
    slot_id: str
    signature: str
    type: str = MessageType.CONFIRM.value

    def to_dict(self) -> dict:
        return asdict(self)
