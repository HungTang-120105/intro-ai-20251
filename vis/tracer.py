from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional
import time

@dataclass
class Event:
    algo: str
    stage: str
    step: int
    data: Dict[str, Any] = field(default_factory=dict)
    ts: float = field(default_factory = time.time)

class Tracer:
    def __init__(self, enabled: bool = True, sink: Optional[Callable[[Event], None]] = None, sample_every: int = 1):
        self.enabled = enabled
        self.sink = sink or (lambda e: None)
        self.sample_every = max(1, sample_every)
        self._step = 0

    def emit(self, algo: str, stage: str, data: Dict[str, Any]):
        if not self.enabled:
            return
        self._step += 1
        if (self._step - 1) % self.sample_every != 0:
            return
        self.sink(Event(algo = algo, stage = stage, step = self._step, data = data))

class Recorder:
    def __init__(self):
        self.events: List[Event] = []
    def __call__(self, e: Event):
        self.events.append(e)

_current_tracer = Tracer(enabled = False)
def set_tracer(t: Tracer):
    global _current_tracer
    _current_tracer = t
def get_tracer() -> Tracer:
    return _current_tracer

NullTracer = Tracer(enabled = False)
