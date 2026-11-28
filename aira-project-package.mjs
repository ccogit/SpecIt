import { sha256 } from './aira-export.mjs';
import { readV2Predecessor, validateV2Restore, verifyAiraV2 } from './aira-v2-export.mjs';
import { zip } from './zip.mjs';

export function makeProjectRecord(files, mapping, migration, previous) {
  const {manifest, requirements, identities} = readV2Predecessor({manifest_bytes:files['manifest.json'], requirements_bytes:files['requirements.json']});
  const evidence = migration ?? previous?.snapshot?.migration;
  return {repo:manifest.repo, manifest_bytes:files['manifest.json'].toString('utf8'), requirements_bytes:files['requirements.json'].toString('utf8'),
    manifest_sha256:sha256(files['manifest.json']), mapping,
    snapshot:{plan:manifest.plan,requirements,highWater:identities.counters,...(evidence?{migration:evidence}:{})}};
}
export function verifyProjectPackage(files, previous, record) {
  if (record) validateV2Restore(record, JSON.parse(files['manifest.json']));
  const history = previous ? [previous] : [];
  const migration = !previous && record?.snapshot?.migration;
  return verifyAiraV2(files, migration ? {history,migration} : history);
}
export function zipProjectFiles(files) {
  return zip(Object.keys(files).sort().map(name=>({name,data:files[name],mtime:new Date(1980,0,1)})));
}
