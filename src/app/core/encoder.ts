import { Field } from "@provablehq/sdk";

const FIELD_MODULUS = 8444461749428370424248824938781546531375899335154063827935233455917409239040n;

/**
 * Encode a short string (<= 31 bytes) as a single field element.
 */
export function encodeStringAsField(input: string): string {
  const encoder = new TextEncoder();
  const utf8Bytes = encoder.encode(input);

  if (utf8Bytes.length > 31) {
    throw new Error("String too long for single field (max 31 bytes)");
  }

  const paddedBytes = new Uint8Array(32);
  paddedBytes.set(utf8Bytes);

  return Field.fromBytesLe(paddedBytes).toString();
}

/**
 * Encode a longer string as an array of 4 field elements.
 */
export function stringToFieldArray(input: string, numFields = 4): string[] {
  const encoder = new TextEncoder();
  const encodedBytes = encoder.encode(input);
  
  // Convert bytes to BigInt
  let bigIntValue = BigInt(0);
  for (let i = 0; i < encodedBytes.length; i++) {
    bigIntValue = (bigIntValue << 8n) + BigInt(encodedBytes[i]);
  }

  const fields: string[] = [];
  let remaining = bigIntValue;
  for (let i = 0; i < numFields; i++) {
    fields.push((remaining % FIELD_MODULUS).toString() + "field");
    remaining = remaining / FIELD_MODULUS;
  }

  if (remaining !== 0n) {
    throw new Error("String too large for field array");
  }

  return fields;
}

/**
 * Decode field element back to string
 */
export function fieldToString(fieldStr: string): string {
  if (!fieldStr || !fieldStr.endsWith("field")) return fieldStr;
  try {
    const field = Field.fromString(fieldStr);
    const bytes = field.toBytesLe();
    return new TextDecoder().decode(bytes).replace(/\0/g, '');
  } catch (e) {
    return fieldStr;
  }
}
