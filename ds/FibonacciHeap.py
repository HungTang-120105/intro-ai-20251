import math


class FibonacciTree:
  def __init__(self, value):
    self.value = value
    self.child = []
    self.order = 0

  def add_at_end(self, t):
    self.child.append(t)
    self.order = self.order + 1


class FibonacciHeap:
  def __init__(self):
    self.trees = []
    self.least = None
    self.count = 0

  def is_empty(self) -> bool:
    return self.count == 0
    

  def push(self, value):
    new_tree = FibonacciTree(value)
    self.trees.append(new_tree)
    if (self.least is None or value < self.least.value):
      self.least = new_tree
    self.count = self.count + 1
  
  def put(self, value):
    self.push(value)

  def peek(self):
    if self.least is None:
      return None
    return self.least.value

  def pop(self):
    smallest = self.least
    if smallest is not None:
      for child in smallest.child:
        self.trees.append(child)
      self.trees.remove(smallest)
      if self.trees == []:
        self.least = None
      else:
        self.least = self.trees[0]
        self.consolidate()
      self.count = self.count - 1
      return smallest.value
    return None

  def consolidate(self):
    aux = (floor_log(self.count) + 1) * [None]

    while self.trees != []:
      x = self.trees[0]
      order = x.order
      self.trees.remove(x)
      while aux[order] is not None:
        y = aux[order]
        if x.value > y.value:
          x, y = y, x
        x.add_at_end(y)
        aux[order] = None
        order = order + 1
      aux[order] = x

    self.least = None
    for k in aux:
      if k is not None:
        self.trees.append(k)
        if (self.least is None
                or k.value < self.least.value):
          self.least = k


def floor_log(x):
  return math.frexp(x)[1] - 1
