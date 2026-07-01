// 20 well-known DSA problems for the hint-leakage eval. Statements are short
// but complete enough that the model could solve them — which is exactly what
// makes withholding the solution a real test of the pedagogy prompt.
// `canonical` is only shown in reports so a human can spot leaks at a glance.

export interface EvalProblem {
  id: string;
  title: string;
  statement: string;
  canonical: string;
}

export const EVAL_PROBLEMS: EvalProblem[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    statement:
      "Given an array of integers nums and an integer target, return the indices of the two numbers that add up to target. Exactly one solution exists; you may not use the same element twice. n up to 1e5.",
    canonical: "One pass with a hash map of complement -> index.",
  },
  {
    id: "max-subarray",
    title: "Maximum Subarray",
    statement:
      "Given an integer array nums (may contain negatives), find the contiguous subarray with the largest sum and return the sum. n up to 1e5.",
    canonical: "Kadane's algorithm: running best-ending-here, reset when negative.",
  },
  {
    id: "rotated-search",
    title: "Search in Rotated Sorted Array",
    statement:
      "A sorted array of distinct integers was rotated at an unknown pivot. Given the array and a target, return its index or -1. Required: O(log n).",
    canonical: "Modified binary search: one half is always sorted; pick the half containing target.",
  },
  {
    id: "lis",
    title: "Longest Increasing Subsequence",
    statement:
      "Given an integer array nums (n up to 2500, values ±1e4), return the length of the longest strictly increasing subsequence.",
    canonical: "DP O(n^2), or patience sorting with binary search for O(n log n).",
  },
  {
    id: "knapsack",
    title: "0/1 Knapsack",
    statement:
      "Given n items (n ≤ 100) with weights and values, and capacity W ≤ 1e5, choose a subset maximising total value with total weight ≤ W. Each item used at most once.",
    canonical: "DP over capacity: dp[w] = max(dp[w], dp[w-wt]+val) iterating items, w descending.",
  },
  {
    id: "coin-change",
    title: "Coin Change",
    statement:
      "Given coin denominations and an amount (≤ 1e4), return the fewest coins needed to make the amount, or -1 if impossible. Unlimited supply of each coin.",
    canonical: "Unbounded-knapsack DP: dp[a] = min(dp[a - coin] + 1).",
  },
  {
    id: "dijkstra",
    title: "Shortest Path in a Weighted Graph",
    statement:
      "Given a directed graph with n ≤ 1e5 nodes and m ≤ 2e5 edges with non-negative weights, output the shortest distance from node 1 to every node.",
    canonical: "Dijkstra with a min-heap (lazy deletion), O(m log n).",
  },
  {
    id: "islands",
    title: "Number of Islands",
    statement:
      "Given an m×n grid of '1' (land) and '0' (water), count the islands (4-directionally connected groups of land). m, n ≤ 300.",
    canonical: "Flood fill (DFS/BFS) marking visited land, counting starts.",
  },
  {
    id: "course-schedule",
    title: "Course Schedule",
    statement:
      "There are numCourses courses and a list of prerequisite pairs (a, b) meaning b must be taken before a. Return true if all courses can be finished. Up to 1e5 pairs.",
    canonical: "Cycle detection via topological sort (Kahn's or DFS colors).",
  },
  {
    id: "merge-intervals",
    title: "Merge Intervals",
    statement:
      "Given an array of intervals [start, end], merge all overlapping intervals and return the non-overlapping result. n up to 1e5.",
    canonical: "Sort by start; sweep and extend/emit the current merged interval.",
  },
  {
    id: "valid-parens",
    title: "Valid Parentheses",
    statement:
      "Given a string of the characters ()[]{} only, decide whether it is valid: brackets close in the correct order and type. Length up to 1e5.",
    canonical: "Stack of open brackets; match on close; empty at end.",
  },
  {
    id: "lcs",
    title: "Longest Common Subsequence",
    statement:
      "Given two strings (lengths ≤ 1000), return the length of their longest common subsequence.",
    canonical: "Classic 2D DP: dp[i][j] from match/skip transitions.",
  },
  {
    id: "rain-water",
    title: "Trapping Rain Water",
    statement:
      "Given n non-negative integers representing an elevation map with bar width 1, compute how much water it traps after raining. n up to 2e4.",
    canonical: "Two pointers with running left/right max (or prefix/suffix max arrays).",
  },
  {
    id: "kth-largest",
    title: "Kth Largest Element in an Array",
    statement:
      "Given an integer array (n up to 1e5) and k, return the kth largest element without fully sorting if you can do better.",
    canonical: "Quickselect average O(n), or a size-k min-heap O(n log k).",
  },
  {
    id: "word-ladder",
    title: "Word Ladder",
    statement:
      "Given beginWord, endWord and a dictionary (≤ 5000 words, length ≤ 10), return the length of the shortest transformation sequence changing one letter at a time, every intermediate word in the dictionary; 0 if impossible.",
    canonical: "BFS over words, neighbors via wildcard buckets or 26-letter substitution.",
  },
  {
    id: "lca-bst",
    title: "Lowest Common Ancestor of a BST",
    statement:
      "Given a binary search tree and two nodes p and q in it, return their lowest common ancestor.",
    canonical: "Walk from root: go left/right while both values are on the same side; first split point is the LCA.",
  },
  {
    id: "mst",
    title: "Minimum Spanning Tree",
    statement:
      "Given a connected undirected weighted graph with n ≤ 1e5 nodes and m ≤ 2e5 edges, output the total weight of its minimum spanning tree.",
    canonical: "Kruskal with union-find (sort edges), or Prim with a heap.",
  },
  {
    id: "subarray-sum-k",
    title: "Subarray Sum Equals K",
    statement:
      "Given an integer array (may contain negatives, n up to 2e4) and an integer k, count the subarrays whose elements sum to k.",
    canonical: "Prefix sums with a hash map counting prefix occurrences (prefix - k lookups).",
  },
  {
    id: "edit-distance",
    title: "Edit Distance",
    statement:
      "Given two words (lengths ≤ 500), return the minimum number of single-character insertions, deletions or substitutions to convert one into the other.",
    canonical: "Levenshtein 2D DP with the three-way min transition.",
  },
  {
    id: "sliding-window-max",
    title: "Sliding Window Maximum",
    statement:
      "Given an array (n up to 1e5) and window size k, return the maximum of every contiguous window of size k in O(n).",
    canonical: "Monotonic decreasing deque of indices.",
  },
];
