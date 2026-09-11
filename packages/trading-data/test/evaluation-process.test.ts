import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it, expect } from 'vitest';
it('independent processes/databases/insertion order preserve exact result bytes and reopen persisted runs', () => {
	const directory = mkdtempSync(join(tmpdir(), 'tos-t3-process-'));
	const script = `import {createSqliteEvaluationRepository,EVALUATION_MIGRATIONS,sha256} from ${JSON.stringify(new URL('../src/evaluation-store.ts', import.meta.url).href)};
 import {createSqliteMethodRepository,METHOD_MIGRATIONS} from ${JSON.stringify(new URL('../src/method-store.ts', import.meta.url).href)};
 import {migrationsFromResources} from '@victframework/appdata-sqlite';
 import {spec,seriesInput,request,version} from ${JSON.stringify(new URL('../../trading-capabilities/test/evaluation-helpers.ts', import.meta.url).href)};
 import {createCalculationRegistry,evaluateMethod,evaluationIdentity} from ${JSON.stringify(new URL('../../trading-capabilities/src/evaluator.ts', import.meta.url).href)};
 import {createAuthoringCatalog} from '@trading-os/trading-capabilities';import {originalProvenance,canonicalEvaluation} from '@trading-os/trading-domain';
 const path=process.argv[1],reverse=process.argv[2]==='reverse',migrations=[migrationsFromResources([],1),...METHOD_MIGRATIONS,...EVALUATION_MIGRATIONS],methods=createSqliteMethodRepository(path,migrations),r=createSqliteEvaluationRepository(path,migrations),now=new Date().toISOString(),v=version();
 if(!methods.transaction(tx=>tx.getVersion(v.id))){methods.transaction(tx=>{tx.insertMethod({schema:'trading.method@1',id:v.methodId,name:v.content.name,description:'',createdAt:now,updatedAt:now,versionCount:1,draftRevision:1,hasDraft:false,origin:originalProvenance()});tx.insertVersion(v);});}
 const specs=[spec(),spec([1,2,3],'1D','EXAMPLE-B')];r.ingest('fixture','1',reverse?specs.reverse():specs,now);
 const input=seriesInput(),req=request(input,v),series=r.getSeries(input.series.id),bars=r.readBars({seriesId:series.id,start:series.coverage.start,end:series.coverage.end,limit:512}),content=evaluateMethod(v,req,[{series,bars}],createAuthoringCatalog(),createCalculationRegistry()),canonical=canonicalEvaluation(content),result={canonical,content,fingerprint:sha256(canonical),inputFingerprint:sha256(canonicalEvaluation(content.identity))};
 if(process.argv[3]==='recover'){r.recover(now);console.log(JSON.stringify(r.getRun('run')));r.close();methods.close();process.exit(0);}const old=r.getRun('run');if(!old){r.createRun({schema:'trading.evaluation-run@1',id:'run',request:req,identity:content.identity,inputFingerprint:result.inputFingerprint,methodName:v.content.name,versionNumber:1,status:'queued',revision:1,createdAt:now,startedAt:null,finishedAt:null,resultFingerprint:null,failureCode:null});r.transition('run',1,'running',now);if(process.argv[3]==='crash')process.exit(23);r.complete('run',2,result,now);}console.log(JSON.stringify(r.getResult(result.fingerprint)));r.close();methods.close();`;
	try {
		const run = (file: string, order: string) => {
			const child = spawnSync(
				process.execPath,
				[
					'--experimental-transform-types',
					'--input-type=module',
					'-e',
					script,
					join(directory, file),
					order
				],
				{ encoding: 'utf8' }
			);
			expect({ status: child.status, stderr: child.status === 0 ? '' : child.stderr }).toEqual({
				status: 0,
				stderr: ''
			});
			return child.stdout.trim();
		};
		const a = run('a.sqlite', 'forward'),
			b = run('b.sqlite', 'reverse'),
			reopened = run('a.sqlite', 'forward');
		expect(b).toBe(a);
		expect(reopened).toBe(a);
		const child = (mode: string) =>
			spawnSync(
				process.execPath,
				[
					'--experimental-transform-types',
					'--input-type=module',
					'-e',
					script,
					join(directory, 'crash.sqlite'),
					'forward',
					mode
				],
				{ encoding: 'utf8' }
			);
		expect(child('crash').status).toBe(23);
		const recovered = child('recover');
		expect(recovered.status).toBe(0);
		expect(JSON.parse(recovered.stdout)).toMatchObject({
			status: 'interrupted',
			resultFingerprint: null,
			failureCode: 'INTERRUPTED'
		});
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
