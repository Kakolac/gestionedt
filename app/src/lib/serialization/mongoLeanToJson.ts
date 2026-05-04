import mongoose from "mongoose";

/** Sérialisation récursive pour export JSON : ObjectId → hex, Date → ISO, omission des `undefined`. */
export function mongoLeanToPlainJson(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return value.toHexString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((x) => mongoLeanToPlainJson(x));
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("base64");
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (v === undefined) continue;
      out[k] = mongoLeanToPlainJson(v);
    }
    return out;
  }
  return value;
}
