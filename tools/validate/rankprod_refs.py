"""Exact reference values for Thistle Plot's Rank Product p-values (tests/audit.test.js, re-review case 01).

Run:  python3 -I tools/validate/rankprod_refs.py      (standard library only)

Null hypothesis used by TP (v0.18.0): in each replicate a row's rank is a random draw from that replicate's own ranks
(average ranks for ties, so tie groups keep their size), independently across replicates. The p-value of a row is
P(product of rank fractions <= observed). Here it is counted exactly with integers or full enumeration.
"""
import itertools
import math
from bisect import bisect_right
from fractions import Fraction


def midranks(values):
    order = sorted(range(len(values)), key=lambda i: values[i])
    r = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j < len(order) and values[order[j]] == values[order[i]]:
            j += 1
        for t in range(i, j):
            r[order[t]] = (i + j + 1) / 2
        i = j
    return r


def exact_tail(rank_sets, observed):
    """P(prod of r_i/n_i <= observed product) by full enumeration over the replicates' rank multisets (exact fractions)."""
    fr = [[Fraction(x).limit_denominator(10**6) / len(rs) for x in rs] for rs in rank_sets]
    obs = math.prod(Fraction(x).limit_denominator(10**6) / len(rs) for x, rs in zip(observed, rank_sets))
    total = math.prod(len(f) for f in fr)
    hits = sum(1 for c in itertools.product(*fr) if math.prod(c) <= obs)
    return Fraction(hits, total)


def untied_tail(n, k, rho):
    """P(r1*...*rk <= rho) for k independent uniform ranks 1..n (integers), counted exactly via sorted half products."""
    if k == 1:
        return min(n, int(rho)) / n
    a = k // 2
    left = sorted(math.prod(c) for c in itertools.product(range(1, n + 1), repeat=a))
    right = sorted(math.prod(c) for c in itertools.product(range(1, n + 1), repeat=k - a))
    hits = 0
    for x in left:
        if x > rho:
            break
        hits += bisect_right(right, rho // x)
    return hits / n**k


print('Reviewer fixture: 36 rows, 2 replicates, A all 0, B = [1,1] for 2 rows and [0,0] for 34')
up = midranks([-1, -1] + [0] * 34)   # up direction: largest increase first
print('   p(top row) =', float(exact_tail([up, up], [up[0], up[0]])), '= (2/36)^2 =', (2 / 36) ** 2)
print('Untied n = 3, k = 3, product of ranks <= 2:', untied_tail(3, 3, 2), '= 4/27')
for n, k, rho in [(20, 3, 8), (50, 3, 100), (200, 4, 5000), (200, 4, 1), (1000, 2, 37)]:
    print(f'Untied n = {n}, k = {k}, rho = {rho}:', repr(untied_tail(n, k, rho)))
print('Tied, unequal replicate sizes: replicate 1 = midranks of [5,5,5,2,1,1,0], replicate 2 = midranks of [3,3,1,0,0]')
r1, r2 = midranks([-5, -5, -5, -2, -1, -1, 0]), midranks([-3, -3, -1, 0, 0])
for obs in [(r1[0], r2[0]), (r1[3], r2[3]), (r1[4], r2[4])]:
    print('   observed ranks', obs, '-> p =', repr(float(exact_tail([r1, r2], list(obs)))))
