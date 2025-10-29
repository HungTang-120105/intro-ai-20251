import heapq

class PQ:
  def __init__(self):
    self.heap = []
    self.finder = {}
    self.REMOVED = '<removed>'
  
  def is_empty(self) -> bool:
    return not self.finder or len(self.heap) == 0
  
  def __len__(self) -> int:
    return len(self.finder)

  def push(self, item, priority):
    if item in self.finder:
      old_entry = self.finder.pop(item)
      old_entry[-1] = self.REMOVED

    entry = [priority, item]
    self.finder[item] = entry
    heapq.heappush(self.heap, entry)
    return entry
  
  def peek(self):
    while self.heap:
      priority, item = self.heap[0]
      if item != self.REMOVED:
        return (priority, item)
      heapq.heappop(self.heap)
    raise KeyError('peek from an empty priority queue')

  def contains(self, item) -> bool:
    return item in self.finder

  def pop(self):
    while self.heap:
      priority, item = heapq.heappop(self.heap)
      if item != self.REMOVED:
        del self.finder[item]
        return (priority, item)

    raise KeyError('pop from an empty priority queue')

