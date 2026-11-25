export const CHANNEL_FORMAT = "paseo-channel/v1";

const META_KEY_PATTERN = /^[A-Za-z0-9_]+$/;
const REQUIRED_META_KEYS = ["source", "kind", "urn"];
const LEADING_ATTRIBUTES = ["source", "kind", "urn"];

function normalizeMetaValue(key, value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") throw new Error(`meta.${key} must be a string`);
  return value.trim() === "" ? null : value;
}

function normalizeMeta(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    throw new Error("meta must be an object");
  }
  const normalized = {};
  for (const [key, rawValue] of Object.entries(meta)) {
    if (!META_KEY_PATTERN.test(key)) {
      throw new Error(`meta key "${key}" must match ${META_KEY_PATTERN}`);
    }
    const value = normalizeMetaValue(key, rawValue);
    if (value !== null) normalized[key] = value;
  }
  for (const key of REQUIRED_META_KEYS) {
    if (!normalized[key]) throw new Error(`meta.${key} is required`);
  }
  return normalized;
}

export function requireChannelValue(value, name) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${name} is required to build a channel event`);
  }
  return value;
}

export function createChannelEvent(event) {
  if (!event || typeof event !== "object") throw new Error("channel event must be an object");
  if (typeof event.content !== "string") throw new Error("content must be a string");
  return { content: event.content, meta: normalizeMeta(event.meta) };
}

export function validateChannelEvent(event) {
  try {
    createChannelEvent(event);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

function escapeAttribute(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderChannelEvent(event) {
  const { content, meta } = createChannelEvent(event);
  const otherKeys = Object.keys(meta)
    .filter((key) => !LEADING_ATTRIBUTES.includes(key))
    .sort();
  const attributes = [...LEADING_ATTRIBUTES, ...otherKeys]
    .map((key) => `${key}="${escapeAttribute(meta[key])}"`)
    .join(" ");
  return `<channel ${attributes}>\n${content}\n</channel>`;
}

export function mergeChannelEventsByUrn(events) {
  const eventsByUrn = new Map();
  for (const event of events) {
    const { content, meta } = createChannelEvent(event);
    const existing = eventsByUrn.get(meta.urn);
    if (!existing) {
      eventsByUrn.set(meta.urn, { content, meta });
      continue;
    }
    const existingLines = existing.content.split("\n");
    const newLines = content.split("\n").filter((line) => !existingLines.includes(line));
    existing.content = [...existingLines, ...newLines].join("\n");
    existing.meta = { ...meta, ...existing.meta };
  }
  return Array.from(eventsByUrn.values());
}

export function validateSnapshotDocument(document) {
  if (!document || typeof document !== "object") {
    return { valid: false, error: "Snapshot must be an object" };
  }
  if (document.format !== CHANNEL_FORMAT) {
    return { valid: false, error: `Invalid format: expected ${CHANNEL_FORMAT}` };
  }
  if (!document.source || typeof document.source !== "string") {
    return { valid: false, error: "Missing or invalid source" };
  }
  if (!document.generated_at || Number.isNaN(Date.parse(document.generated_at))) {
    return { valid: false, error: "Missing or invalid generated_at" };
  }
  if (!Array.isArray(document.items)) {
    return { valid: false, error: "items must be an array" };
  }
  if (!Array.isArray(document.errors)) {
    return { valid: false, error: "errors must be an array" };
  }
  for (const [index, item] of document.items.entries()) {
    const result = validateChannelEvent(item);
    if (!result.valid) {
      return { valid: false, error: `items[${index}]: ${result.error}` };
    }
    if (item.meta.source !== document.source) {
      return { valid: false, error: `items[${index}]: meta.source must equal the document source` };
    }
  }
  return { valid: true };
}
