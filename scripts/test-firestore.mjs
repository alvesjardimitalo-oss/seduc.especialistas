import {spawnSync} from 'node:child_process';
for(const args of [['tests/firestore.integration.mjs'],['--test','tests/pages-firestore.integration.mjs']]){
  const result=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});
  if(result.status!==0)process.exit(result.status||1);
}
