import random
import math
from typing import Any, Dict, List, Optional, Tuple
import networkx as nx
import math

Route = List[Any]

class GAForGraph:
    def __init__(
        self,
        G: nx.Graph,
        nodes: Optional[List[Any]] = None,
        population_size: int = 100,
        crossover_rate: float = 0.9,
        mutation_rate: float = 0.2,
        tournament_k: int = 3,
        elitism: int = 1,
        rng_seed: Optional[int] = None,
        weight: str = "weight",
        closed_tour: bool = True,  # True nếu route đóng vòng (trở về start)
    ):
        """
        Args:
            G: NetworkX graph (có trọng số trên cạnh với key = weight).
            nodes: danh sách node sử dụng trong route (mặc định: list(G.nodes())).
            population_size, crossover_rate, mutation_rate, tournament_k, elitism, rng_seed: tham số GA.
            weight: tên thuộc tính trọng số trên cạnh.
            closed_tour: nếu True, tính chi phí có cả cạnh từ cuối quay về đầu.
        """
        if rng_seed is not None:
            random.seed(rng_seed)

        self.G = G
        self.nodes = list(nodes) if nodes is not None else list(G.nodes())
        assert len(self.nodes) >= 2, "Cần ít nhất 2 node để tối ưu route"
        self.n = len(self.nodes)

        self.pop_size = population_size
        self.crossover_rate = crossover_rate
        self.mutation_rate = mutation_rate
        self.tournament_k = max(2, tournament_k)
        self.elitism = max(0, elitism)
        self.weight = weight
        self.closed_tour = closed_tour

        # Tiền xử lý: khoảng cách ngắn nhất giữa mọi cặp node (dijkstra)
        # distances[u][v] = cost
        self._distances: Dict[Any, Dict[Any, float]] = {}
        # dùng all_pairs_dijkstra_path_length để hỗ trợ đồ thị có cạnh trọng số dương
        lengths = dict(nx.all_pairs_dijkstra_path_length(G, weight=self.weight))
        # ensure all nodes in self.nodes exist in lengths (dòng dưới sẽ trả inf nếu không)
        for u in self.nodes:
            self._distances[u] = {}
            vals = lengths.get(u, {})
            for v in self.nodes:
                self._distances[u][v] = float(vals[v]) if v in vals else math.inf

    # ----- cost & fitness -----
    def route_cost(self, route: Route) -> float:
        """
        Tính tổng chi phí đi theo route (list các node). Nếu có cặp không nối -> trả inf.
        Nếu closed_tour True: cộng thêm chi phí từ last -> first.
        """
        total = 0.0
        for i in range(len(route) - 1):
            u, v = route[i], route[i + 1]
            d = self._distances[u].get(v, math.inf)
            if not math.isfinite(d):
                return math.inf
            total += d
        if self.closed_tour:
            u, v = route[-1], route[0]
            d = self._distances[u].get(v, math.inf)
            if not math.isfinite(d):
                return math.inf
            total += d
        return total

    def fitness(self, route: Route, eps: float = 1e-12) -> float:
        """
        Fitness để GA maximize: nghịch đảo của cost.
        Nếu cost == inf -> fitness = 0.
        """
        cost = self.route_cost(route)
        if not math.isfinite(cost):
            return 0.0
        return 1.0 / (cost + eps)

    # ----- initial population (ngẫu nhiên permutation) -----
    def _init_population(self) -> List[Route]:
        pop = []
        base = list(self.nodes)
        for _ in range(self.pop_size):
            r = base[:]
            random.shuffle(r)
            pop.append(r)
        return pop

    # ----- selection: tournament -----
    def _tournament_select(self, population: List[Route], fitnesses: List[float]) -> Route:
        best_idx = None
        best_fit = -math.inf
        for _ in range(self.tournament_k):
            idx = random.randrange(len(population))
            if fitnesses[idx] > best_fit:
                best_idx = idx
                best_fit = fitnesses[idx]
        return list(population[best_idx])  # trả về copy

    # ----- Ordered Crossover (OX) -----
    def _ordered_crossover(self, parent1: Route, parent2: Route) -> Tuple[Route, Route]:
        n = self.n
        if n < 2:
            return list(parent1), list(parent2)
        a, b = sorted(random.sample(range(n), 2))
        def ox(p1, p2):
            child = [None] * n
            # copy middle slice from p1
            child[a:b+1] = p1[a:b+1]
            # fill remaining positions by order from p2
            fill_idx = (b + 1) % n
            p2_idx = (b + 1) % n
            while None in child:
                v = p2[p2_idx]
                if v not in child:
                    child[fill_idx] = v
                    fill_idx = (fill_idx + 1) % n
                p2_idx = (p2_idx + 1) % n
            return child
        return ox(parent1, parent2), ox(parent2, parent1)

    # ----- mutation: swap (và optional inversion) -----
    def _swap_mutation(self, route: Route) -> Route:
        r = route
        i, j = random.sample(range(self.n), 2)
        r[i], r[j] = r[j], r[i]
        return r

    def _inversion_mutation(self, route: Route) -> Route:
        a, b = sorted(random.sample(range(self.n), 2))
        route[a:b+1] = reversed(route[a:b+1])
        return route

    # ----- evaluate fitnesses -----
    def _evaluate_population(self, population: List[Route]) -> List[float]:
        return [self.fitness(ind) for ind in population]

    # ----- run GA -----
    def run(
        self,
        generations: int = 500,
        crossover_method: str = "ox",  # chỉ hỗ trợ "ox" hiện tại
        mutation_method: str = "swap",  # "swap" hoặc "inversion"
        verbose: bool = False
    ) -> Dict[str, Any]:
        """
        Chạy GA và trả về dict:
            - best_route, best_cost, best_fitness, history (best_cost mỗi gen), generations_ran
        """
        population = self._init_population()
        fitnesses = self._evaluate_population(population)

        # lấy best ban đầu
        best_idx = max(range(len(population)), key=lambda i: fitnesses[i])
        best_route = list(population[best_idx])
        best_fitness = fitnesses[best_idx]
        best_cost = self.route_cost(best_route) if best_fitness > 0 else math.inf

        history: List[float] = []

        for gen in range(1, generations + 1):
            # elitism: chọn top-k theo fitness
            sorted_idx = sorted(range(len(population)), key=lambda i: fitnesses[i], reverse=True)
            new_pop: List[Route] = []
            for k in range(self.elitism):
                new_pop.append(list(population[sorted_idx[k]]))

            # tạo rest population
            while len(new_pop) < self.pop_size:
                parent1 = self._tournament_select(population, fitnesses)
                parent2 = self._tournament_select(population, fitnesses)
                # crossover?
                if random.random() < self.crossover_rate:
                    if crossover_method == "ox":
                        child1, child2 = self._ordered_crossover(parent1, parent2)
                    else:
                        child1, child2 = list(parent1), list(parent2)
                else:
                    child1, child2 = list(parent1), list(parent2)

                # mutation
                if random.random() < self.mutation_rate:
                    if mutation_method == "swap":
                        child1 = self._swap_mutation(child1)
                    else:
                        child1 = self._inversion_mutation(child1)
                if random.random() < self.mutation_rate:
                    if mutation_method == "swap":
                        child2 = self._swap_mutation(child2)
                    else:
                        child2 = self._inversion_mutation(child2)

                new_pop.append(child1)
                if len(new_pop) < self.pop_size:
                    new_pop.append(child2)

            population = new_pop
            fitnesses = self._evaluate_population(population)

            # cập nhật best
            gen_best_idx = max(range(len(population)), key=lambda i: fitnesses[i])
            gen_best_fit = fitnesses[gen_best_idx]
            gen_best_route = list(population[gen_best_idx])
            gen_best_cost = self.route_cost(gen_best_route) if gen_best_fit > 0 else math.inf

            if gen_best_fit > best_fitness:
                best_fitness = gen_best_fit
                best_route = gen_best_route
                best_cost = gen_best_cost

            history.append(best_cost)

            if verbose and gen % max(1, generations // 10) == 0:
                print(f"[GA] gen {gen}/{generations} best_cost={best_cost:.6f}")

        return {
            "best_route": best_route,
            "best_cost": best_cost,
            "best_fitness": best_fitness,
            "history": history,
            "generations_ran": len(history),
        }

# ----------------- Ví dụ sử dụng -----------------
if __name__ == "__main__":
    # Ví dụ 1: đồ thị hoàn chỉnh (complete graph) trọng số Euclid trên điểm 2D
    import math
    G = nx.complete_graph(8)
    coords = {i: (math.cos(2*math.pi*i/8), math.sin(2*math.pi*i/8)) for i in range(8)}
    nx.set_node_attributes(G, coords, "pos")
    for u, v in G.edges():
        xu, yu = coords[u]; xv, yv = coords[v]
        G[u][v]["weight"] = math.hypot(xu - xv, yu - yv)

    ga = GAForGraph(
        G=G,
        population_size=200,
        crossover_rate=0.9,
        mutation_rate=0.2,
        tournament_k=5,
        elitism=2,
        rng_seed=42,
        weight="weight",
        closed_tour=True,
    )

    res = ga.run(generations=300, verbose=True)
    print("Best cost:", res["best_cost"])
    print("Best route:", res["best_route"])

    # Ví dụ 2: đồ thị không hoàn chỉnh
    H = nx.Graph()
    H.add_weighted_edges_from([
        (0,1,2.0), (1,2,3.0), (2,3,1.0), (0,3,4.0), (1,4,2.5), (4,2,1.2)
    ])
    ga2 = GAForGraph(H, population_size=80, rng_seed=1, closed_tour=False)
    res2 = ga2.run(generations=200, verbose=True)
    print("Best cost on H:", res2["best_cost"])
    print("Best route on H:", res2["best_route"])
