/**
 * Preserve live/standings API payloads without assuming undocumented fields.
 * This keeps the complete source response available for later schema-specific work.
 */
function normalizeSnapshot(source, response) {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new TypeError(`${source} response must be a JSON object.`);
  }

  return {
    source,
    collectedAt: new Date().toISOString(),
    data: response,
  };
}

module.exports = { normalizeSnapshot };
