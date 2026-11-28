// SpecIt's internal identity state, independent of the exported V2 package.
const namespaces = new Map([
  ['FR', {limit: 999, width: 3}],
  ['NFR', {limit: 999, width: 3}],
  ['T', {limit: 999, width: 2}],
  ['B', {limit: 99, width: 2}],
  ['AC', {limit: 999, width: 3, owned: true}],
  ['TC', {limit: 999, width: 3, owned: true}],
]);

const ownerPattern = /^(?:T(?:0[1-9]|[1-9][0-9]{1,2})|B(?:0[1-9]|[1-9][0-9]))$/;
const identityPattern = /^(?:(FR|NFR)-([0-9]{3})|(T|B)([0-9]{2,3})|((?:AC|TC)-[TB][0-9]{2,3})-([0-9]{3}))$/;

function identityCounter(id) {
  const match = typeof id === 'string' && identityPattern.exec(id);
  if (!match) throw new Error('Invalid historical identity');
  const [, requirement, requirementNumber, owner, ownerNumber, child, childNumber] = match;
  if (owner && !ownerPattern.test(id) || child && !ownerPattern.test(child.slice(3))) {
    throw new Error('Invalid historical identity: ' + id);
  }
  const number = Number(requirementNumber ?? ownerNumber ?? childNumber);
  if (number === 0) throw new Error('Invalid historical identity: ' + id);
  return [requirement ?? owner ?? child, number];
}

// Rebuild counters from an explicitly mapped predecessor, including retired IDs.
// Preserve any higher persisted value even if the corresponding ID is absent.
export function restoreRequirementHighWater(highWater, activeIds, retiredIds) {
  const restored = {...highWater};
  const seen = new Set();
  for (const ids of [activeIds, retiredIds]) {
    for (const id of ids) {
      const [key, value] = identityCounter(id);
      if (seen.has(id)) throw new Error('Duplicate historical identity: ' + id);
      seen.add(id);
      const current = Object.hasOwn(restored, key) ? restored[key] : 0;
      const limit = key === 'B' ? 99 : 999;
      if (!Number.isInteger(current) || current < 0 || current > limit) {
        throw new Error('Invalid persisted identity counter: ' + key);
      }
      restored[key] = Math.max(current, value);
    }
  }
  return restored;
}

export function allocateRequirementIdentity(highWater, namespace, owner) {
  const format = namespaces.get(namespace);
  if (!format || (format.owned ? typeof owner !== 'string' || !ownerPattern.test(owner) : owner !== undefined)) {
    throw new Error('Invalid identity namespace or owner');
  }
  const key = format.owned ? namespace + '-' + owner : namespace;
  const current = Object.hasOwn(highWater, key) ? highWater[key] : 0;
  if (!Number.isInteger(current) || current < 0 || current >= format.limit) {
    throw new Error('Identity counter invalid or exhausted: ' + key);
  }

  const next = current + 1;
  const number = String(next).padStart(format.width, '0');
  const separator = namespace === 'T' || namespace === 'B' ? '' : '-';
  return {id: key + separator + number, highWater: {...highWater, [key]: next}};
}

// Reference groups come from active criteria. Exception IDs come from approved exceptions.
export function checkRequirementCoverage(requirements, referenceGroups, approvedExceptionIds = []) {
  const byId = new Map();
  for (const requirement of requirements) {
    const {id, mandatory, state} = requirement;
    if (typeof id !== 'string' || !/^(?:FR|NFR)-(?!000)[0-9]{3}$/.test(id) || byId.has(id)) {
      throw new Error('Invalid or duplicate requirement identity');
    }
    if (typeof mandatory !== 'boolean' || !['approved', 'deferred'].includes(state)) {
      throw new Error('Invalid requirement state: ' + id);
    }
    byId.set(id, requirement);
  }

  const covered = new Set();
  for (const group of referenceGroups) {
    const seen = new Set();
    for (const id of group) {
      if (!byId.has(id) || seen.has(id)) {
        throw new Error('Unknown or duplicate criterion reference: ' + id);
      }
      seen.add(id);
      covered.add(id);
    }
  }

  const exceptions = new Set();
  for (const id of approvedExceptionIds) {
    if (!byId.has(id) || byId.get(id).mandatory || exceptions.has(id)) {
      throw new Error('Invalid or duplicate coverage exception: ' + id);
    }
    exceptions.add(id);
  }

  for (const {id, mandatory, state} of byId.values()) {
    if (mandatory && (state !== 'approved' || !covered.has(id))) {
      throw new Error('Mandatory requirement requires approval and an active criterion: ' + id);
    }
    if (!mandatory && !covered.has(id) && !exceptions.has(id)) {
      throw new Error('Uncovered requirement needs an approved exception: ' + id);
    }
  }
}
