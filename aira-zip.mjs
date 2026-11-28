import { exportAira } from './aira-export.mjs';
import { zip } from './zip.mjs';

/** Both V1 (default) and V2 use the versioned export API. No disk writes or execution:
 * fixed ZIP timestamp and exact package-relative byte buffers for both versions. */
export function airaZip(input) {
  const files=exportAira(input);
  return zip(Object.keys(files).sort().map(name=>({name,data:files[name],mtime:new Date(1980,0,1)})));
}
