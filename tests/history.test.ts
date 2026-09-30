import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { observedDate, updateHistory, validHistory } from '../shared/history';
import { parseStanding, parseRoster } from '../server/parser';
import { PoolCache, validateSnapshot } from '../server/cache';
import type { Cached, Standing, Snapshot } from '../shared/types';
const standing = parseStanding(await readFile(new URL('./fixtures/standing.html', import.meta.url),'utf8'));
const sample = (stamp:string, extra=0):Cached<Standing> => ({fetchedAt:stamp,data:{...standing,participants:standing.participants.map(p=>({...p,points:p.points+extra}))}});
test('historique : Montréal détermine la journée et conserve le dernier relevé de cette journée', () => {
  const first = sample('2026-09-30T18:00:00Z');
  const late = sample('2026-10-01T02:00:00Z',2);
  const next = sample('2026-10-01T05:00:00Z',4);
  assert.equal(observedDate(late.fetchedAt),'2026-09-30');
  const original = updateHistory(undefined,first);
  const corrected = updateHistory(original,late);
  assert.equal(original.records[0].participants[0].points,10);
  assert.equal(corrected.records.length,1);
  assert.equal(corrected.records[0].participants[0].points,12);
  const history = updateHistory(corrected,next);
  assert.equal(history.records.length,2);
  assert.equal(history.records[1].date,'2026-10-01');
  assert.ok(validHistory(history,next));
});
test('historique : migre un relevé existant, conserve les journées et repart avec une nouvelle saison', () => {
  const old=sample('2026-09-29T20:00:00Z'), current=sample('2026-09-30T20:00:00Z');
  const history=updateHistory(undefined,current,old);
  assert.deepEqual(history.records.map(r=>r.date),['2026-09-29','2026-09-30']);
  const next={...current,data:{...current.data,season:'2027-2028'}};
  assert.equal(updateHistory(history,next).records.length,1);
});
test('historique : rejette les identités, dates et scores incohérents', () => {
  const current=sample('2026-09-30T20:00:00Z'), valid=updateHistory(undefined,current);
  for(const mutate of [
    (h:typeof valid)=>{h.records[0].participants[0].id='autre';},
    (h:typeof valid)=>{h.records[0].participants[0].points=NaN;},
    (h:typeof valid)=>{h.records[0].date='2026-09-29';},
    (h:typeof valid)=>{h.records.push(structuredClone(h.records[0]));},
    (h:typeof valid)=>{h.records[0].participants[0].rank=7;},
  ]) {const broken=structuredClone(valid);mutate(broken);assert.equal(validHistory(broken,current),false);}
});
test('historique : un ancien cache sans historique est réutilisé et enrichi sans nouvelle requête', async () => {
  const rosters:Snapshot['rosters']={}; const stamp=new Date().toISOString();
  for(const p of standing.participants) rosters[p.id]={fetchedAt:stamp,data:parseRoster(await readFile(new URL(`./fixtures/roster-${p.id}.html`,import.meta.url),'utf8'),p,standing.season)};
  const snapshot:Snapshot={standing:{data:standing,fetchedAt:stamp},rosters,daily:null};
  assert.ok(validateSnapshot(snapshot));
  const dir=await mkdtemp(join(tmpdir(),'pool-history-'));const file=join(dir,'cache.json');await writeFile(file,JSON.stringify(snapshot));
  let calls=0;const cache=new PoolCache({cacheFile:file,intervalMs:60_000,staleMs:60_000,timeoutMs:1000},async()=>{calls++;throw new Error('offline');});
  await cache.load();await cache.refresh();assert.equal(calls,0);assert.equal(cache.snapshot!.history!.records.length,1);assert.ok(validateSnapshot(cache.snapshot));
  const correct=structuredClone(cache.snapshot!);
  for(const history of [null,false,{...correct.history!,records:[]}]) assert.equal(validateSnapshot({...correct,history}),false);
  const wrongScore=structuredClone(correct);wrongScore.history!.records[0].participants[0].points+=1;assert.equal(validateSnapshot(wrongScore),false);
  cache.snapshot!.history!.records[0].participants[0].points=NaN;
  assert.equal(validateSnapshot(cache.snapshot),false);
});