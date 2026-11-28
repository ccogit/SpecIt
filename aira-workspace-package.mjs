import { createHash, timingSafeEqual } from 'node:crypto';

export const workspaceAdapterVersion = 1;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const id = /^[A-Za-z0-9_-]{1,64}$/;
const hash = /^[0-9a-f]{64}$/;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw Object.assign(new Error(code), { code }); };
const need = (condition, code) => { if (!condition) fail(code); };

// Private SpecIt service boundary, not a browser endpoint. Aira owns the
// session/CSRF/registry and request replay checks before calling this service.
// resolveContext must revalidate the full authorized tuple on EVERY call;
// stage receives a private copy of the archived bytes, never a browser path.
export function createWorkspacePackageService({ store, resolveContext, stage, capability, expiresAt, now = Date.now }) {
  need(Buffer.isBuffer(capability) && capability.length === 32 && Number.isFinite(expiresAt), 'INVALID_SCHEMA');
  const secret = Buffer.from(capability);
  return async function preparePackage(request, serviceCapability) {
    need(Buffer.isBuffer(serviceCapability) && serviceCapability.length === 32 &&
      timingSafeEqual(secret, serviceCapability) && now() < expiresAt, 'POLICY_DENIED');
    need(request && typeof request === 'object' && !Array.isArray(request), 'INVALID_SCHEMA');
    need(request.schema_version === workspaceAdapterVersion, 'VERSION_MISMATCH');
    need(Object.keys(request).sort().join(',') === 'draft_id,manifest_sha256,request_id,revision,schema_version,workspace_id' &&
      typeof request.request_id === 'string' && uuid.test(request.request_id) &&
      typeof request.workspace_id === 'string' && uuid.test(request.workspace_id) &&
      typeof request.draft_id === 'string' && id.test(request.draft_id) &&
      Number.isSafeInteger(request.revision) && request.revision > 0 &&
      typeof request.manifest_sha256 === 'string' && hash.test(request.manifest_sha256), 'INVALID_SCHEMA');
    const context = await resolveContext(request.workspace_id);
    need(context && context.workspace_id === request.workspace_id, 'CONTEXT_UNAVAILABLE');
    need(context.draft_id === request.draft_id && context.project_id && context.repo && context.plan_id, 'WRONG_TARGET');
    const project = store.get(context.project_id);
    need(project?.mode === 'aira' && project.binding?.repo === context.repo && project.binding?.plan_id === context.plan_id, 'WRONG_TARGET');
    // Only the currently archived, fachlich freigegebene head is eligible.
    need(project.revision === request.revision && project.manifest_sha256 === request.manifest_sha256, 'HISTORY_CONFLICT');
    const entry = store.history(context.project_id).at(-1);
    need(entry && entry.manifest_sha256 === request.manifest_sha256 &&
      Buffer.isBuffer(entry.files['manifest.json']) && digest(entry.files['manifest.json']) === request.manifest_sha256, 'INVALID_HASH');
    const manifest = JSON.parse(entry.files['manifest.json'].toString('utf8'));
    need(manifest.schema_version === 2 && manifest.mode === 'aira' && manifest.revision === request.revision &&
      manifest.repo === context.repo && manifest.plan_id === context.plan_id, 'WRONG_TARGET');
    const files = Object.fromEntries(Object.entries(entry.files).map(([path, bytes]) => {
      need(Buffer.isBuffer(bytes), 'INVALID_SCHEMA');
      return [path, Buffer.from(bytes)];
    }));
    const current = store.get(context.project_id);
    need(current.mode === 'aira' && current.generation === project.generation && current.manifest_sha256 === project.manifest_sha256, 'HISTORY_CONFLICT');
    const staging_id = await stage({ context: structuredClone(context), files, revision: request.revision, manifest_sha256: request.manifest_sha256 });
    need(typeof staging_id === 'string' && uuid.test(staging_id), 'SOURCE_UNAVAILABLE');
    return {ok:true, schema_version:workspaceAdapterVersion, request_id:request.request_id,
      data:{staging_id, revision:request.revision, manifest_sha256:request.manifest_sha256}};
  };
}
