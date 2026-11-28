import { exportAira } from './aira-export.mjs';
import { zip } from './zip.mjs';

/** No disk writes or execution: fixed ZIP timestamp, package-relative paths. */
export function airaZip(input) {
  const files=exportAira(input);
  return zip(Object.keys(files).sort().map(name=>({name,data:files[name],mtime:new Date(1980,0,1)})));
}
