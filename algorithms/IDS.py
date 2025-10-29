# Iterative Deepening Search.
import networkx as nx
from typing import Any, Optional, Tuple, List

from DLS import dls

def ids(G: nx.Graph, source: Any, target: Any, max_depth: int = 50) -> Optional[Tuple[List[Any], float, List[Any]]]:
    for depth in range(max_depth + 1):
        result = dls(G, source, target, d=depth)
        
        if result is not None:
            return result
            
    return None
