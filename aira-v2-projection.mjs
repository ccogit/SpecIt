import {codepointCompare} from './aira-identities.mjs';

function quote(value) {
  if (!value.isWellFormed()) throw new TypeError('V2 text contains an invalid Unicode scalar value');
  return JSON.stringify(value);
}

function decimal(value) {
  if (!Number.isFinite(value) || Object.is(value, -0)) throw new TypeError('Invalid V2 JSON number');
  const repr = String(value);
  const exponent = /^(-?)(\d)(?:\.(\d+))?e([+-]?\d+)$/.exec(repr);
  if (!exponent) return repr;
  const [, sign, first, fraction = '', power] = exponent;
  const digits = first + fraction;
  const offset = Number(power) + 1;
  if (offset <= 0) return sign + '0.' + '0'.repeat(-offset) + digits;
  if (offset >= digits.length) return sign + digits.padEnd(offset, '0');
  return sign + digits.slice(0, offset) + '.' + digits.slice(offset);
}

function encode(value, indent) {
  if (value === null || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'number') return decimal(value);
  const inner = indent + '  ';
  if (Array.isArray(value)) {
    const lines = Array.from(value, item => inner + encode(item, inner));
    return lines.length === 0 ? '[]' : '[\n' + lines.join(',\n') + '\n' + indent + ']';
  }
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError('V2 projection requires plain JSON data');
  }
  const lines = Object.keys(value).sort(codepointCompare).map(
    key => inner + quote(key) + ': ' + encode(value[key], inner),
  );
  return lines.length === 0 ? '{}' : '{\n' + lines.join(',\n') + '\n' + indent + '}';
}

// Byte projection only. Caller supplies validated package values.
export function canonicalV2Json(value) {
  return encode(value, '') + '\n';
}

// The same projection is used for acceptance text and test descriptions.
export function projectV2EvidenceLine(id, text) {
  return '- [' + id + '] ' + text.replaceAll('\n', '\n  ') + '\n';
}
