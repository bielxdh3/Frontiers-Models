import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = p => readFileSync(resolve(root,p),'utf8');
const registry = JSON.parse(read('benchmarks/solar-system/RUNS.json'));
const run = id => {
  const found = registry.runs.find(x => x.id === id);
  assert.ok(found,id);
  return found;
};
const active = ['gpt-6.1-sol-source','gpt-6-astra-max-frontier-v2','grok-4.7-solar-source','fable-5.1-frontier-v2','gemini-4-argon-source'];
const historical = [
  ['gpt-5.6-sun-max-original','GPT-5.6 Sol V1','Historical','Histórico'],
  ['gpt-5.6-sun-max-frontier-v2','GPT-5.6 Sol V2','Outdated','Desatualizado'],
  ['gpt-5.6-luna-max-orbitario','GPT-5.6 Luna','Non-frontier','Não frontier'],
  ['grok-4.6-frontier-v2','Grok 4.6','Archived','Arquivado'],
  ['gemini-3.8-flash-high-frontier-v2','Gemini 3.8 Flash','Archived','Arquivado'],
];
function table(content,title){
  const part=content.split(title)[1];
  assert.ok(part,'Missing section '+title);
  const text=part.split('\n## ')[0];
  return text.split('\n').filter(x=>x.startsWith('| ')&&x.includes('**'))
    .map(line=>line.split('|').slice(1,-1).map(x=>x.trim()));
}
function tracked(path){
  return /^040000 tree |^100644 blob /m.test(execFileSync(
    'git',['-C',root,'ls-tree','HEAD',path],{encoding:'utf8'}));
}
for (const [file,pt,isBench] of [
 ['README.md',false,false],['README-PT-BR.md',true,false],
 ['benchmarks/solar-system/README.md',false,true],
 ['benchmarks/solar-system/README-PT-BR.md',true,true],
]){
  test(file+': historical table consistent, links to local source or record',()=>{
    const content=read(file);
    const heading=isBench
      ?(pt?'## 🗂️ Outros projetos':'## 🗂️ Other projects')
      :(pt?'## 🗂️ Outros projetos do Orbitarium':'## 🗂️ Other Orbitarium projects');
    const rows=table(content,heading);
    assert.equal(rows.length,5);
    for(let i=0;i<rows.length;i++){
      const [id,name,en,br]=historical[i],r=run(id),row=rows[i];
      assert.equal(row.length,4,name);
      assert.ok(row[0].includes('**'+name+'**'));
      assert.equal(row[1],pt?br:en);
      assert.equal(row[2],r.live_url?'['+(pt?'Abrir':'Open')+']('+r.live_url+')':'—');
      const sourcePath=r.archive_status==='self-contained'
        ?(isBench?'./':'./benchmarks/solar-system/')+r.target_path+'/'
        :(isBench?'./':'./benchmarks/solar-system/')+(id.includes('gemini-3.8')?'GEMINI-3.8-FLASH-PROVENANCE.md':'RUN-PROVENANCE.md');
      assert.equal(row[3],'['+(r.archive_status==='self-contained'?(pt?'Código':'Code'):(pt?'Registro':'Record'))+']('+sourcePath+')');
      assert.ok(tracked('benchmarks/solar-system/'+(r.archive_status==='self-contained'
        ?r.target_path:id.includes('gemini-3.8')?'GEMINI-3.8-FLASH-PROVENANCE.md':'RUN-PROVENANCE.md')),sourcePath);
    }
    assert.doesNotMatch(content,/https:\/\/github\.com\/|source commit|SHA-256\s+[a-f0-9]{64}|33\/34|unverified exact prompt|não está verificada/);
  });
  if(isBench) test(file+': all five current projects use uniform local source and site links',()=>{
    const rows=table(read(file),pt?'## 🌟 Projetos atuais':'## 🌟 Current projects');
    assert.equal(rows.length,5);
    for(let i=0;i<5;i++){
      const r=run(active[i]),row=rows[i];
      assert.equal(row.length,3);
      assert.ok(row[0].includes('**'+r.model+'**'));
      assert.equal(row[1],'['+(pt?'Abrir':'Open')+']('+r.live_url+')');
      assert.equal(row[2],'['+(pt?'Código':'Code')+'](./'+r.target_path+'/)');
      assert.ok(tracked('benchmarks/solar-system/'+r.target_path));
    }
  });
}
