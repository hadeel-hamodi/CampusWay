(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CampusWheelchairNavigation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const X_METRES = 132.6;
  const Y_METRES = 101.2;
  const EPSILON = 1e-9;
  const CONNECTOR_TYPES = new Set(['elevator', 'stairs', 'ramp']);

  function validateNodes(nodes) {
    if (!Array.isArray(nodes) || !nodes.length) throw new TypeError('Route must contain nodes');
    for (const node of nodes) {
      if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y) || node.floor == null) {
        throw new TypeError('Route nodes need finite coordinates and a floor');
      }
    }
  }

  function validateCursor(nodes, cursor) {
    if (!cursor || !Number.isInteger(cursor.index) || cursor.index < 0 || cursor.index >= nodes.length ||
        !Number.isFinite(cursor.t) || cursor.t < 0 || cursor.t > 1 ||
        (cursor.index === nodes.length - 1 && cursor.t !== 0)) {
      throw new RangeError('Invalid route cursor');
    }
  }

  function vector(from, to) {
    return {
      x: (to.x - from.x) * X_METRES,
      y: (to.y - from.y) * Y_METRES
    };
  }

  function point(node) {
    return { x: node.x * X_METRES, y: node.y * Y_METRES };
  }

  function segmentLength(from, to) {
    const delta = vector(from, to);
    return Math.hypot(delta.x, delta.y);
  }

  function connectorKey(node) {
    const id = String(node.connectorId || '').trim().toLowerCase();
    if (id && !['null', 'none', 'no', 'n/a'].includes(id)) return `id:${id}`;
    const type = String(node.type || '').trim().toLowerCase();
    return CONNECTOR_TYPES.has(type) ? `type:${type}` : '';
  }

  function verticalConnectorEdge(from, to) {
    if (from.floor === to.floor) return false;
    const fromKey = connectorKey(from), toKey = connectorKey(to);
    return Boolean(fromKey && toKey && fromKey === toKey);
  }

  function distanceToLine(node, start, end) {
    const value = point(node), a = point(start), b = point(end);
    const dx = b.x - a.x, dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= EPSILON) return Math.hypot(value.x - a.x, value.y - a.y);
    const t = Math.max(0, Math.min(1,
      ((value.x - a.x) * dx + (value.y - a.y) * dy) / lengthSquared
    ));
    return Math.hypot(value.x - (a.x + t * dx), value.y - (a.y + t * dy));
  }

  function rdpIndices(nodes, startIndex, endIndex, tolerance, result) {
    if (endIndex <= startIndex + 1) return;
    let furthestIndex = -1, furthestDistance = -1;
    for (let index = startIndex + 1; index < endIndex; index++) {
      const distance = distanceToLine(nodes[index], nodes[startIndex], nodes[endIndex]);
      if (distance > furthestDistance) {
        furthestDistance = distance;
        furthestIndex = index;
      }
    }
    if (furthestDistance <= tolerance) return;
    rdpIndices(nodes, startIndex, furthestIndex, tolerance, result);
    result.add(furthestIndex);
    rdpIndices(nodes, furthestIndex, endIndex, tolerance, result);
  }

  function angleBetween(nodes, previousIndex, currentIndex, nextIndex) {
    const incoming = vector(nodes[previousIndex], nodes[currentIndex]);
    const outgoing = vector(nodes[currentIndex], nodes[nextIndex]);
    const incomingLength = Math.hypot(incoming.x, incoming.y);
    const outgoingLength = Math.hypot(outgoing.x, outgoing.y);
    if (incomingLength <= EPSILON || outgoingLength <= EPSILON) return 0;
    const cosine = Math.max(-1, Math.min(1,
      (incoming.x * outgoing.x + incoming.y * outgoing.y) /
      (incomingLength * outgoingLength)
    ));
    return Math.acos(cosine) * 180 / Math.PI;
  }

  function turnAngle(nodes, index) {
    validateNodes(nodes);
    if (!Number.isInteger(index) || index <= 0 || index >= nodes.length - 1) return 0;
    const previous = nodes[index - 1], current = nodes[index], next = nodes[index + 1];
    if (previous.floor !== current.floor || current.floor !== next.floor) return 0;
    return angleBetween(nodes, index - 1, index, index + 1);
  }

  function checkpointIndices(nodes, toleranceMetres = 0.35, minimumTurnDegrees = 35) {
    validateNodes(nodes);
    if (!Number.isFinite(toleranceMetres) || toleranceMetres < 0) {
      throw new RangeError('Simplification tolerance must be nonnegative');
    }
    if (!Number.isFinite(minimumTurnDegrees) || minimumTurnDegrees < 0 || minimumTurnDegrees > 180) {
      throw new RangeError('Turn threshold must be between 0 and 180 degrees');
    }
    if (nodes.length === 1) return [0];

    const mandatory = new Set([0, nodes.length - 1]);
    const passThroughConnector = new Set();

    // A lift may pass through mapped intermediate floors. Keep only the entry
    // and exit in one uninterrupted vertical run so it needs one confirmation.
    for (let index = 0; index < nodes.length - 1;) {
      if (!verticalConnectorEdge(nodes[index], nodes[index + 1])) {
        if (nodes[index].floor !== nodes[index + 1].floor) {
          mandatory.add(index);
          mandatory.add(index + 1);
        }
        index++;
        continue;
      }
      const start = index;
      let end = index + 1;
      while (end < nodes.length - 1 && verticalConnectorEdge(nodes[end], nodes[end + 1])) end++;
      mandatory.add(start);
      mandatory.add(end);
      for (let middle = start + 1; middle < end; middle++) passThroughConnector.add(middle);
      index = end;
    }

    for (let index = 1; index < nodes.length - 1; index++) {
      if (!passThroughConnector.has(index) && CONNECTOR_TYPES.has(String(nodes[index].type || '').toLowerCase())) {
        mandatory.add(index);
      }
    }

    const candidates = new Set(mandatory);
    const boundaries = [...mandatory].sort((a, b) => a - b);
    for (let position = 0; position < boundaries.length - 1; position++) {
      const start = boundaries[position], end = boundaries[position + 1];
      if (nodes[start].floor === nodes[end].floor) {
        rdpIndices(nodes, start, end, toleranceMetres, candidates);
      }
    }

    // RDP removes centimetre-scale graph noise. This second pass keeps only
    // turns that are obvious enough for a person to recognize in a corridor.
    let result = [...candidates].sort((a, b) => a - b);
    let changed = true;
    while (changed) {
      changed = false;
      const filtered = [result[0]];
      for (let position = 1; position < result.length - 1; position++) {
        const index = result[position];
        const previous = result[position - 1], next = result[position + 1];
        if (mandatory.has(index) || nodes[previous].floor !== nodes[index].floor ||
            nodes[index].floor !== nodes[next].floor ||
            angleBetween(nodes, previous, index, next) >= minimumTurnDegrees) {
          filtered.push(index);
        } else {
          changed = true;
        }
      }
      filtered.push(result[result.length - 1]);
      result = filtered;
    }
    return result;
  }

  function targetCheckpoint(nodes, cursor, direction, toleranceMetres = 0.35, minimumTurnDegrees = 35) {
    validateNodes(nodes);
    validateCursor(nodes, cursor);
    if (direction !== 1 && direction !== -1) throw new RangeError('Direction must be 1 or -1');
    const checkpoints = checkpointIndices(nodes, toleranceMetres, minimumTurnDegrees);
    if (direction > 0) return checkpoints.find(index => index > cursor.index) ?? null;
    const limit = cursor.t > EPSILON ? cursor.index : cursor.index - 1;
    for (let index = checkpoints.length - 1; index >= 0; index--) {
      if (checkpoints[index] <= limit) return checkpoints[index];
    }
    return null;
  }

  function distanceToCheckpoint(nodes, cursor, targetIndex) {
    validateNodes(nodes);
    validateCursor(nodes, cursor);
    if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= nodes.length) {
      throw new RangeError('Invalid checkpoint index');
    }
    if (targetIndex < cursor.index || (targetIndex === cursor.index && cursor.t > 0)) return 0;
    let distance = 0;
    for (let index = cursor.index; index < targetIndex; index++) {
      const from = nodes[index], to = nodes[index + 1];
      if (from.floor !== to.floor) continue;
      const length = segmentLength(from, to);
      distance += index === cursor.index ? length * (1 - cursor.t) : length;
    }
    return distance;
  }

  function progressFraction(nodes, cursor) {
    validateNodes(nodes);
    validateCursor(nodes, cursor);
    let total = 0, travelled = 0;
    for (let index = 0; index < nodes.length - 1; index++) {
      if (nodes[index].floor !== nodes[index + 1].floor) continue;
      const length = segmentLength(nodes[index], nodes[index + 1]);
      total += length;
      if (index < cursor.index) travelled += length;
      else if (index === cursor.index) travelled += length * cursor.t;
    }
    if (total <= EPSILON) return nodes.length === 1 ? 1 : (cursor.index + cursor.t) / (nodes.length - 1);
    return Math.max(0, Math.min(1, travelled / total));
  }

  return Object.freeze({ checkpointIndices, targetCheckpoint, distanceToCheckpoint, progressFraction, turnAngle });
});
