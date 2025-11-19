from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Iterable, List, Optional
import time

import numpy as np

__all__ = [
    "Event",
    "Tracer",
    "Recorder",
    "DistinctRecorder",
    "set_tracer",
    "get_tracer",
    "use_tracer",
    "NullTracer",
]


@dataclass
class Event:
  algo: str
  stage: str
  step: int
  data: Dict[str, Any] = field(default_factory=dict)
  ts: float = field(default_factory=time.time)


class Tracer:
  def __init__(
      self,
      enabled: bool = True,
      sink: Optional[Callable[[Event], None]] = None,
      sample_every: int = 1,
  ) -> None:
    self.enabled = enabled
    self.sink = sink if sink is not None else (lambda e: None)
    self.sample_every = max(1, sample_every)
    self._step = 0

  def emit(self, algo: str, stage: str, data: Optional[Dict[str, Any]] = None) -> None:
    if not self.enabled:
      return

    self._step += 1
    if (self._step - 1) % self.sample_every != 0:
      return

    payload = data or {}
    self.sink(Event(algo=algo, stage=stage, step=self._step, data=payload))


def _positions_equal(lhs: Any, rhs: Any) -> bool:
  if lhs is rhs:
    return True
  if lhs is None or rhs is None:
    return False
  try:
    a = np.asarray(lhs)
    b = np.asarray(rhs)
    if a.shape == b.shape:
      return np.array_equal(a, b)
  except (TypeError, ValueError):
    # Fallback to Python equality (covers lists/tuples)
    pass
  return lhs == rhs


class Recorder:
  def __init__(self, drop_duplicate_positions: bool = False) -> None:
    self.events: List[Event] = []
    self._drop_duplicate_positions = drop_duplicate_positions

  def __call__(self, event: Event) -> None:
    if not self._drop_duplicate_positions or not self.events:
      self.events.append(event)
      return

    last = self.events[-1]
    new_positions = event.data.get("positions")
    prev_positions = last.data.get("positions")
    if (
        event.stage == last.stage
        and new_positions is not None
        and prev_positions is not None
        and _positions_equal(new_positions, prev_positions)
    ):
      return
    self.events.append(event)

  def clear(self) -> None:
    self.events.clear()

  def extend(self, events: Iterable[Event]) -> None:
    for event in events:
      self(event)

  def __len__(self) -> int:
    return len(self.events)

  def last(self) -> Optional[Event]:
    return self.events[-1] if self.events else None


class DistinctRecorder(Recorder):
  def __init__(self) -> None:
    super().__init__(drop_duplicate_positions=True)


_current_tracer = Tracer(enabled=False)


def set_tracer(tracer: Tracer) -> None:
  global _current_tracer
  _current_tracer = tracer


def get_tracer() -> Tracer:
  return _current_tracer


@contextmanager
def use_tracer(tracer: Tracer):
  prev = get_tracer()
  set_tracer(tracer)
  try:
    yield tracer
  finally:
    set_tracer(prev)


NullTracer = Tracer(enabled=False)
