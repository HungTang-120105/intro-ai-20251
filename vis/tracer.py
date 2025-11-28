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
    "emit_path_state",
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


def _to_list(seq: Any) -> List[Any]:
  if seq is None:
    return []
  if isinstance(seq, list):
    return list(seq)
  if isinstance(seq, (set, tuple)):
    return list(seq)
  try:
    return list(seq)
  except Exception:
    return [seq]


def emit_path_state(
    tracer: Tracer,
    algo: str,
    stage: str,
    current: Any = None,
    frontier: Any = None,
    explored: Any = None,
    parent_map: Optional[Dict[Any, Any]] = None,
    cost: Any = None,
    path: Optional[Iterable[Any]] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> None:

  payload: Dict[str, Any] = {}
  if current is not None:
    payload["current"] = current
  if frontier is not None:
    payload["frontier"] = _to_list(frontier)
  if explored is not None:
    payload["explored"] = _to_list(explored)
  if parent_map is not None:
    payload["parent_map"] = dict(parent_map)
  if cost is not None:
    payload["cost"] = cost
  if path is not None:
    payload["path"] = list(path)
  if extra:
    payload.update(extra)
  tracer.emit(algo, stage, payload)


NullTracer = Tracer(enabled=False)
