(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CampusRoutePlanner = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const EPSILON = 1e-9;
  const DEFAULT_TURN_THRESHOLD_DEGREES = 35;
  const DEFAULT_TURN_PENALTY_METERS = 6;

  function nodeIds(adapter) {
    const values = typeof adapter.nodeIds === 'function'
      ? adapter.nodeIds()
      : adapter.nodeIds;
    return Array.from(values || []);
  }

  function neighbors(adapter, nodeId) {
    const values = adapter.neighbors(nodeId);
    return Array.isArray(values) ? values : Array.from(values || []);
  }

  function edgeTarget(adapter, edge) {
    return adapter.edgeTarget ? adapter.edgeTarget(edge) : edge.id;
  }

  function edgeWeight(adapter, edge) {
    const value = adapter.edgeWeight ? adapter.edgeWeight(edge) : edge.w;
    return Number(value);
  }

  function edgeAllowed(adapter, edge, fromId) {
    return !adapter.edgeAllowed || adapter.edgeAllowed(edge, fromId) !== false;
  }

  function point(adapter, nodeId) {
    return adapter.point ? adapter.point(nodeId) : null;
  }

  function turnMagnitudeDegrees(adapter, previousId, currentId, nextId) {
    if (previousId === null || previousId === undefined) return 0;

    const previous = point(adapter, previousId);
    const current = point(adapter, currentId);
    const next = point(adapter, nextId);

    if (!previous || !current || !next) return 0;
    if (
      previous.floor !== undefined &&
      current.floor !== undefined &&
      next.floor !== undefined &&
      (previous.floor !== current.floor || current.floor !== next.floor)
    ) return 0;

    const incoming = {
      x: current.x - previous.x,
      y: current.y - previous.y
    };
    const outgoing = {
      x: next.x - current.x,
      y: next.y - current.y
    };
    const incomingLength = Math.hypot(incoming.x, incoming.y);
    const outgoingLength = Math.hypot(outgoing.x, outgoing.y);

    if (incomingLength <= EPSILON || outgoingLength <= EPSILON) return 0;

    const cross = incoming.x * outgoing.y - incoming.y * outgoing.x;
    const dot = incoming.x * outgoing.x + incoming.y * outgoing.y;
    return Math.atan2(Math.abs(cross), dot) * 180 / Math.PI;
  }

  function routingOptions(options = {}) {
    return {
      preferFewerTurns: options.preferFewerTurns === true,
      turnThresholdDegrees: Number.isFinite(options.turnThresholdDegrees)
        ? options.turnThresholdDegrees
        : DEFAULT_TURN_THRESHOLD_DEGREES,
      turnPenaltyMeters: Number.isFinite(options.turnPenaltyMeters)
        ? options.turnPenaltyMeters
        : DEFAULT_TURN_PENALTY_METERS
    };
  }

  function turnDetails(adapter, previousId, currentId, nextId, options) {
    const magnitude = turnMagnitudeDegrees(
      adapter,
      previousId,
      currentId,
      nextId
    );
    const isTurn = magnitude >= options.turnThresholdDegrees;
    return {
      magnitude,
      isTurn,
      penalty: options.preferFewerTurns && isTurn
        ? options.turnPenaltyMeters
        : 0
    };
  }

  function pathMetrics(adapter, path, rawOptions = {}) {
    if (!Array.isArray(path) || !path.length) return null;
    const options = routingOptions(rawOptions);
    let distance = 0;
    let turns = 0;

    for (let index = 0; index < path.length - 1; index++) {
      const fromId = path[index];
      const toId = path[index + 1];
      const edge = neighbors(adapter, fromId).find(candidate =>
        edgeAllowed(adapter, candidate, fromId) &&
        edgeTarget(adapter, candidate) === toId
      );
      if (!edge) return null;
      const weight = edgeWeight(adapter, edge);
      if (!Number.isFinite(weight) || weight < 0) return null;
      distance += weight;

      if (index > 0) {
        const details = turnDetails(
          adapter,
          path[index - 1],
          fromId,
          toId,
          options
        );
        if (details.isTurn) turns++;
      }
    }

    return {
      distance,
      turns,
      score: distance + (
        options.preferFewerTurns
          ? turns * options.turnPenaltyMeters
          : 0
      )
    };
  }

  function reconstructNodePath(startId, endId, previous, previousEdge) {
    if (startId === endId) {
      return { nodes: [startId], edges: [] };
    }
    if (!previous.has(endId)) return null;

    const nodes = [endId];
    const edges = [];
    let current = endId;
    while (current !== startId) {
      const prior = previous.get(current);
      const edge = previousEdge.get(current);
      if (prior === undefined || !edge) return null;
      edges.unshift(edge);
      nodes.unshift(prior);
      current = prior;
    }
    return { nodes, edges };
  }

  function shortestDistancePath(adapter, startId, endId, options) {
    const ids = nodeIds(adapter);
    const idSet = new Set(ids);
    if (!idSet.has(startId) || !idSet.has(endId)) return null;

    const distances = new Map(ids.map(id => [id, Infinity]));
    const previous = new Map();
    const previousEdge = new Map();
    const unvisited = new Set(ids);
    distances.set(startId, 0);

    while (unvisited.size) {
      let current = null;
      let bestDistance = Infinity;
      for (const id of unvisited) {
        const distance = distances.get(id);
        if (distance < bestDistance) {
          current = id;
          bestDistance = distance;
        }
      }
      if (current === null || bestDistance === Infinity) break;
      if (current === endId) break;
      unvisited.delete(current);

      for (const edge of neighbors(adapter, current)) {
        if (!edgeAllowed(adapter, edge, current)) continue;
        const nextId = edgeTarget(adapter, edge);
        const weight = edgeWeight(adapter, edge);
        if (!unvisited.has(nextId) || !Number.isFinite(weight) || weight < 0) continue;
        const candidate = bestDistance + weight;
        if (candidate < distances.get(nextId)) {
          distances.set(nextId, candidate);
          previous.set(nextId, current);
          previousEdge.set(nextId, edge);
        }
      }
    }

    if (distances.get(endId) === Infinity) return null;
    const path = reconstructNodePath(startId, endId, previous, previousEdge);
    if (!path) return null;
    const metrics = pathMetrics(adapter, path.nodes, options);
    return metrics ? { ...path, ...metrics } : null;
  }

  function stateKey(previousId, currentId) {
    return JSON.stringify([previousId, currentId]);
  }

  function better(candidate, existing) {
    if (!existing) return true;
    if (candidate.score < existing.score - EPSILON) return true;
    if (Math.abs(candidate.score - existing.score) > EPSILON) return false;
    if (candidate.turns < existing.turns) return true;
    if (candidate.turns > existing.turns) return false;
    return candidate.distance < existing.distance - EPSILON;
  }

  function simplerPath(adapter, startId, endId, options) {
    const ids = nodeIds(adapter);
    const idSet = new Set(ids);
    if (!idSet.has(startId) || !idSet.has(endId)) return null;
    if (startId === endId) {
      return { nodes: [startId], edges: [], distance: 0, turns: 0, score: 0 };
    }

    const startKey = stateKey(null, startId);
    const records = new Map([[startKey, {
      previousId: null,
      currentId: startId,
      distance: 0,
      turns: 0,
      score: 0
    }]]);
    const pending = new Set([startKey]);
    const visited = new Set();
    const previousState = new Map();
    const previousEdge = new Map();
    let endKey = null;

    while (pending.size) {
      let currentKey = null;
      let currentRecord = null;
      for (const key of pending) {
        const record = records.get(key);
        if (better(record, currentRecord)) {
          currentKey = key;
          currentRecord = record;
        }
      }
      if (!currentRecord) break;
      pending.delete(currentKey);
      if (visited.has(currentKey)) continue;
      visited.add(currentKey);

      if (currentRecord.currentId === endId) {
        endKey = currentKey;
        break;
      }

      for (const edge of neighbors(adapter, currentRecord.currentId)) {
        if (!edgeAllowed(adapter, edge, currentRecord.currentId)) continue;
        const nextId = edgeTarget(adapter, edge);
        const weight = edgeWeight(adapter, edge);
        if (!idSet.has(nextId) || !Number.isFinite(weight) || weight < 0) continue;

        const details = turnDetails(
          adapter,
          currentRecord.previousId,
          currentRecord.currentId,
          nextId,
          options
        );
        const nextRecord = {
          previousId: currentRecord.currentId,
          currentId: nextId,
          distance: currentRecord.distance + weight,
          turns: currentRecord.turns + (details.isTurn ? 1 : 0),
          score: currentRecord.score + weight + details.penalty
        };
        const nextKey = stateKey(currentRecord.currentId, nextId);
        if (visited.has(nextKey) || !better(nextRecord, records.get(nextKey))) continue;
        records.set(nextKey, nextRecord);
        previousState.set(nextKey, currentKey);
        previousEdge.set(nextKey, edge);
        pending.add(nextKey);
      }
    }

    if (!endKey) return null;
    const nodes = [];
    const edges = [];
    let currentKey = endKey;
    while (currentKey) {
      const record = records.get(currentKey);
      if (!record) return null;
      nodes.unshift(record.currentId);
      const edge = previousEdge.get(currentKey);
      if (edge) edges.unshift(edge);
      currentKey = previousState.get(currentKey);
    }
    const result = records.get(endKey);
    return {
      nodes,
      edges,
      distance: result.distance,
      turns: result.turns,
      score: result.score
    };
  }

  function findPath(adapter, startId, endId, rawOptions = {}) {
    const options = routingOptions(rawOptions);
    if (!options.preferFewerTurns) {
      return shortestDistancePath(adapter, startId, endId, options);
    }

    const result = simplerPath(adapter, startId, endId, options);
    if (!result) return null;

    // A direction-aware cost can theoretically prefer a tiny loop to avoid a
    // turn penalty when a map contains duplicate or nearly identical nodes.
    // Never show that kind of route to a user; fall back to the shortest path.
    if (new Set(result.nodes).size !== result.nodes.length) {
      return shortestDistancePath(adapter, startId, endId, options);
    }

    return result;
  }

  return {
    findPath,
    pathMetrics,
    turnMagnitudeDegrees,
    DEFAULT_TURN_THRESHOLD_DEGREES,
    DEFAULT_TURN_PENALTY_METERS
  };
});
