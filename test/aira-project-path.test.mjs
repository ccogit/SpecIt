import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assertOutsideProjectArchive} from '../aira-project-path.mjs';
test('archive directory, its ancestors and symlink aliases are not standalone targets',t=>{
  const base=mkdtempSync(join(tmpdir(),'specit-s2-path-'));t.after(()=>rmSync(base,{recursive:true,force:true}));
  const root=join(base,'archive'),other=join(base,'other');mkdirSync(root);mkdirSync(other);
  assert.throws(()=>assertOutsideProjectArchive(root,root),{code:'POLICY_DENIED'});
  assert.throws(()=>assertOutsideProjectArchive(base,root),{code:'POLICY_DENIED'});
  assert.throws(()=>assertOutsideProjectArchive(join(root,'new'),root),{code:'POLICY_DENIED'});
  assert.doesNotThrow(()=>assertOutsideProjectArchive(join(other,'new'),root));
  symlinkSync(root,join(other,'link'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>assertOutsideProjectArchive(join(other,'link','new'),root),{code:'POLICY_DENIED'});
});
