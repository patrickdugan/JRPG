import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const read=(path)=>JSON.parse(readFileSync(root+path,'utf8'));
const roster=read('assets/art/roster-keystone/roster.json');
const canonical=read('assets/art/late-snes-roster-suite-v1/late-snes-roster-suite.source.json');
const npc=read('assets/art/npc-field-suite/npc-field-suite.source.json');

test('roster keystone retains exactly 62 canonical IDs',()=>{
  assert.equal(roster.schemaVersion,1);
  const ids=roster.identities.map(a=>a.id);
  assert.equal(ids.length,62);
  assert.equal(new Set(ids).size,62);
  const counts=Object.fromEntries([...new Set(roster.identities.map(a=>a.kind))].map(kind=>[kind,roster.identities.filter(a=>a.kind===kind).length]));
  assert.deepEqual(counts,{'party':7,'regular-enemy':28,'kurozane-form':4,'named-boss':7,'npc':16});
  const exact=new Set([
    ...canonical.boards.flatMap(board=>board.rows.map(a=>a.id)),
    ...['captain-kaji','widow-of-fog','furnace-abbot','ujiro','bell-warden-chiyo','lady-enma','yearless-bell'],
    ...npc.roleTaxonomy.map(a=>'npc-'+a.id),
  ]);
  assert.deepEqual(new Set(ids),exact);
});

test('sixteen missing premium enemies point to original six-pose animation sources',()=>{
  const missing=roster.identities.filter(a=>a.kind==='regular-enemy' && a.paintedKeyArt==='pending');
  assert.equal(missing.length,16);
  for(const row of missing){
    assert.ok(row.sourceAnimationPath);
    assert.ok(existsSync(root+row.sourceAnimationPath),row.sourceAnimationPath);
    assert.equal(row.framesPerClip,24);
    assert.equal(row.targetClips,10);
    assert.equal(row.sourceDerivedOverlay,'game/assets/art/hd-painted-v1/overlay-missing-v1/sheets/'+row.id+'.png');
  }
});

test('source-derived renderer runs only after the premium painted first choice',()=>{
  const source=readFileSync(root+'game/action-campaign-battle.js','utf8');
  assert.match(source,/const hdMissingArt = createHdPaintedArtRuntime/);
  assert.match(source,/overlay-missing-v1\//);
  const first=source.indexOf('if (hdPaintedArt.draw(context');
  const second=source.indexOf('if (hdMissingArt.draw(context');
  assert.ok(first>=0&&second>first);
  assert.match(source,/if \(actor\.faction === 'player'\) drawParty/);
});
