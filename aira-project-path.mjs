import { realpathSync } from 'node:fs';
import path from 'node:path';

// Resolve the nearest existing parent without creating directories. A symlink
// alias to the archive must not become a standalone run or download target.
function canonical(value) {
  let dir=path.resolve(value), suffix=[];
  while(true) {
    try { return path.join(realpathSync(dir),...suffix); }
    catch(error) {
      if(error.code!=='ENOENT'||dir===path.dirname(dir))throw error;
      suffix.unshift(path.basename(dir));dir=path.dirname(dir);
    }
  }
}
const inside=(value,root)=>{const rel=path.relative(root,value);return !rel||(!path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep));};
export function assertOutsideProjectArchive(dir,root) {
  if(typeof dir!=='string'||!path.isAbsolute(dir))throw Object.assign(Error('INVALID_PATH'),{code:'INVALID_PATH'});
  const target=canonical(dir),archive=canonical(root);
  if(inside(target,archive)||inside(archive,target)||inside(path.resolve(dir),path.resolve(root))||inside(path.resolve(root),path.resolve(dir)))
    throw Object.assign(Error('POLICY_DENIED'),{code:'POLICY_DENIED'});
}
