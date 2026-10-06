import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const rosterSource = readFileSync(new URL('../js/class-roster.js', import.meta.url), 'utf8');
const rosterDataURL = `data:text/javascript;base64,${Buffer.from(rosterSource).toString('base64')}`;
const source = readFileSync(new URL('../js/mock-storage.js', import.meta.url), 'utf8').replace("'./class-roster.js'", JSON.stringify(rosterDataURL));
let stored = new Map();
let failWrites = false;
globalThis.localStorage = {
  getItem(key) { return stored.get(key) ?? null; },
  setItem(key, value) { if (failWrites) throw new Error('QuotaExceededError'); stored.set(key, value); },
};
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const RealDate = Date;
let simulatedTime = '2026-10-06T12:00:00';
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [simulatedTime])); }
  static now() { return new RealDate(simulatedTime).getTime(); }
};
const { handleMockAPI: api, getLocalDB, saveLocalDB, resetLocalDB, createDefaultDB } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const teacher = 't_token_teacher_master';
const student = 's_token_s_1';
const student2 = 's_token_s_2';
const request = (path, method = 'GET', body = null, token = student) => api(path, { method, body, token });
const teacherRequest = (path, method = 'GET', body = null) => request(path, method, body, teacher);
const updateStudent = (changes) => {
  const db = getLocalDB();
  Object.assign(db.students[0], changes);
  saveLocalDB(db);
};
const pdf = `data:application/pdf;base64,${Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF').toString('base64')}`;
let checks = 0;
async function check(name, run) {
  stored = new Map(); failWrites = false; simulatedTime = '2026-10-06T12:00:00';
  resetLocalDB();
  await run();
  checks++;
  console.log(`PASS ${name}`);
}

await check('class name updates once while all classroom records remain intact', async () => {
  assert.equal(createDefaultDB().settings.className, '6학년 4반');
  const legacy = createDefaultDB();
  legacy.settings.className = '6학년 1반';
  delete legacy.settings.classNameVersion;
  legacy.students[0].balance = 789;
  legacy.students[0].pin = '9876';
  legacy.assignments.push({ id: 'saved_assignment', title: '기존 학습지', pdfData: pdf, studentIds: ['s_1'] });
  legacy.submissions.push({ id: 'saved_submission', studentId: 's_1', answer: '기존 답안', status: 'pending' });
  const expected = structuredClone(legacy);
  expected.settings.className = '6학년 4반';
  expected.settings.classNameVersion = 1;
  saveLocalDB(legacy);
  assert.deepEqual(getLocalDB(), expected);
  expected.settings.className = '경제 교실';
  saveLocalDB(expected);
  assert.deepEqual(getLocalDB(), expected, 'later teacher edits are preserved on reload');
});

await check('new shop seeds and legacy migration preserve class records', async () => {
  const seeded = getLocalDB();
  assert.equal(seeded.version, 3);
  assert.deepEqual(seeded.items.filter(i => ['학용품', '알림장 면제', '간식 뽑기'].includes(i.name)).map(i => [i.name, i.type, i.price]).sort(), [['간식 뽑기', 'goods', 50], ['알림장 면제', 'coupon', 100], ['학용품', 'goods', 200]]);
  const old = createDefaultDB();
  old.version = 2;
  old.items.find(i => i.name === '학용품').name = '캐릭터 연필';
  old.items.find(i => i.name === '알림장 면제').name = '미니 노트';
  old.items.find(i => i.name === '간식 뽑기').price = 20;
  old.items.push({ id: 'custom', name: '직접 만든 상품', price: 17, active: true });
  old.students[0].balance = 789;
  old.students[0].exp = 345;
  delete old.students[0].characterLevel;
  delete old.students[0].territoryPurchases;
  delete old.assignments;
  old.missions = old.missions.filter(m => m.id !== 'm_teacher');
  saveLocalDB(old);
  const migrated = getLocalDB();
  assert.equal(migrated.version, 3);
  assert.equal(migrated.students[0].balance, 789);
  assert.equal(migrated.students[0].exp, 345);
  assert.equal(migrated.students[0].characterLevel, 1);
  assert.equal(migrated.students[0].territoryPurchases, 0);
  assert.equal(migrated.items.find(i => i.id === 'custom').price, 17);
  assert.equal(migrated.missions.find(m => m.id === 'm_teacher').kind, 'assignment');
  assert.deepEqual(migrated.assignments, []);
});

await check('roster has 21 students and roles, migration preserves balances and later edits', async () => {
  const seeded = getLocalDB();
  assert.equal(seeded.students.length, 21);
  assert.equal(seeded.roles.length, 21);
  assert.equal(seeded.students[0].name, '1번 학생');   // 체험 모드는 예시 이름 (실제 명단은 서버 전용)
  assert.equal(seeded.students[20].name, '21번 학생');
  assert.equal(seeded.roles.find(r => r.id === seeded.students[0].roleId).name, '안전부 차관');
  const legacy = createDefaultDB();
  delete legacy.settings.rosterVersion;
  legacy.students.forEach(s => { s.name = `${s.number}번 학생`; s.roleId = 'old_role'; });
  legacy.students.push({ id: 's_22', number: 22, name: '22번 학생', balance: 100, exp: 150, claimedTiles: 6 });
  legacy.students.push({ id: 's_23', number: 23, name: '23번 학생', balance: 101, exp: 150, claimedTiles: 6 });
  legacy.students.push({ id: 's_24', number: 24, name: '24번 학생', balance: 100, exp: 150, claimedTiles: 6 });
  legacy.students.push({ id: 'custom', number: 99, name: '기존 전학생', balance: 300, exp: 250, roleId: 'custom_role' });
  legacy.roles = [{ id: 'old_role', name: '칠판 지킴이', tasks: [] }, { id: 'unused', name: '전등 관리자', tasks: [] }, { id: 'custom_role', name: '우리 역할', tasks: ['검사'] }];
  legacy.students[0].balance = 567;
  legacy.transactions.push({ id: 'record', studentId: 's_24', studentName: '24번 학생', type: 'give', amount: 1 });
  saveLocalDB(legacy);
  const migrated = getLocalDB();
  assert.equal(migrated.students.find(s => s.id === 's_1').name, '1번 학생');
  assert.equal(migrated.students.find(s => s.id === 's_1').balance, 567);
  assert.equal(migrated.students.some(s => s.id === 's_22'), false);
  assert.equal(migrated.students.some(s => s.id === 's_23'), true);
  assert.equal(migrated.students.some(s => s.id === 's_24'), true);
  assert.equal(migrated.students.find(s => s.id === 'custom').balance, 300);
  assert.equal(migrated.roles.some(r => r.id === 'unused'), false);
  assert.equal(migrated.roles.some(r => r.id === 'custom_role'), true);
  const named = migrated.students.find(s => s.id === 's_1');
  named.name = '선생님 수정 이름'; named.roleId = 'custom_role';
  saveLocalDB(migrated);
  assert.equal(getLocalDB().students.find(s => s.id === 's_1').name, '선생님 수정 이름');
  assert.equal(getLocalDB().students.find(s => s.id === 's_1').roleId, 'custom_role');
});

await check('assignment creation, safe PDF validation and role visibility', async () => {
  await assert.rejects(request('/teacher/assignments'), /선생님/);
  await assert.rejects(request('/student/me', 'GET', null, null), /로그인/);
  const { assignment } = await teacherRequest('/teacher/assignments', 'POST', { title: '경제 학습지', instructions: '답을 적어요.', reward: 25, studentIds: ['s_1'], pdfName: '경제.pdf', pdfData: pdf });
  assert.equal(assignment.hasPdf, true);
  assert.equal('pdfData' in assignment, false);
  assert.deepEqual(await request(`/student/assignments/${assignment.id}/pdf`), { pdfName: '경제.pdf', pdfData: pdf });
  await assert.rejects(request(`/student/assignments/${assignment.id}/pdf`, 'GET', null, student2), /과제/);
  const mine = await request('/student/me');
  const theirs = await request('/student/me', 'GET', null, student2);
  assert.equal(mine.assignments.length, 1);
  assert.equal('pdfData' in mine.assignments[0], false);
  assert.equal(theirs.assignments.length, 0);
  const badPdf = `data:application/pdf;base64,${Buffer.from('<html>wrong</html>').toString('base64')}`;
  for (const fields of [{ pdfData: badPdf }, { pdfData: 'data:application/pdf;base64,!!!!' }, { pdfData: `data:application/pdf;base64,${'A'.repeat(6990508)}` }, { studentIds: ['missing'] }, { reward: 1.5 }]) {
    await assert.rejects(teacherRequest('/teacher/assignments', 'POST', { title: '잘못된 과제', pdfName: 'wrong.pdf', ...fields }));
  }
  assert.equal(getLocalDB().assignments.length, 1);
  const text = await teacherRequest('/teacher/assignments', 'POST', { title: '글 과제' });
  assert.equal(text.assignment.hasPdf, false);
  assert.equal((await request('/student/me', 'GET', null, student2)).assignments.length, 1);
});

await check('assignment answers require content, can retry rejection and earn rewards once', async () => {
  const { assignment } = await teacherRequest('/teacher/assignments', 'POST', { title: '과제 인증', reward: 30 });
  await assert.rejects(request('/student/missions', 'POST', { missionId: 'm_teacher', note: '완료' }), /과제/);
  await assert.rejects(teacherRequest('/teacher/pay', 'POST', { studentIds: ['s_1'], type: 'give', amount: 10, missionId: 'm_teacher' }), /답안/);
  await assert.rejects(request(`/student/assignments/${assignment.id}/submit`, 'POST', { answer: ' ' }), /답안/);
  await assert.rejects(request(`/student/assignments/${assignment.id}/submit`, 'POST', { answer: 'a'.repeat(10001) }), /답안/);
  const first = await request(`/student/assignments/${assignment.id}/submit`, 'POST', { answer: '1번 답: 경제' });
  await assert.rejects(request(`/student/assignments/${assignment.id}/submit`, 'POST', { answer: '다시' }), /이미 인증/);
  assert.equal((await request('/student/me')).mySubmissions.length, 0);
  await teacherRequest('/teacher/missions/review', 'POST', { ids: [first.submission.id], action: 'reject' });
  simulatedTime = '2026-10-07T12:00:00';
  const second = await request(`/student/assignments/${assignment.id}/submit`, 'POST', { answer: '수정 답안' });
  await teacherRequest('/teacher/missions/review', 'POST', { ids: [second.submission.id], action: 'approve' });
  assert.equal(getLocalDB().students[0].balance, 130);
  assert.equal(getLocalDB().students[0].exp, 180);
  await assert.rejects(teacherRequest('/teacher/missions/review', 'POST', { ids: [second.submission.id], action: 'approve' }), /이미 처리/);
  simulatedTime = '2026-10-08T12:00:00';
  await assert.rejects(request(`/student/assignments/${assignment.id}/submit`, 'POST', { answer: '중복 인증' }), /이미 승인/);
  assert.equal((await request('/student/me')).myAssignmentSubmissions.length, 2);
  const db = getLocalDB();
  db.submissions.push({ ...second.submission, id: 'duplicate_pending', status: 'pending' });
  saveLocalDB(db);
  await teacherRequest('/teacher/missions/review', 'POST', { ids: ['duplicate_pending'], action: 'approve' });
  assert.equal(getLocalDB().students[0].balance, 130);
  assert.equal(getLocalDB().submissions.find(s => s.id === 'duplicate_pending').status, 'rejected');
});

await check('PDF accepts the 3 MiB boundary and rejects one byte over it', async () => {
  const bytes = Buffer.alloc(3 * 1024 * 1024, ' ');
  bytes.write('%PDF-1.4\n');
  const atLimit = `data:application/pdf;base64,${bytes.toString('base64')}`;
  const created = await teacherRequest('/teacher/assignments', 'POST', { title: '최대 크기 PDF', pdfName: 'large.pdf', pdfData: atLimit });
  assert.equal(created.assignment.hasPdf, true);
  const tooLarge = `data:application/pdf;base64,${Buffer.concat([bytes, Buffer.from(' ')]).toString('base64')}`;
  await assert.rejects(teacherRequest('/teacher/assignments', 'POST', { title: '용량 초과', pdfName: 'over.pdf', pdfData: tooLarge }), /3MB/);
  assert.equal(getLocalDB().assignments.length, 1);
});

await check('archiving keeps history and PDF for teacher while ending new student access', async () => {
  const { assignment } = await teacherRequest('/teacher/assignments', 'POST', { title: '보관 학습지', reward: 12, pdfName: 'file.pdf', pdfData: pdf });
  const { submission } = await request(`/student/assignments/${assignment.id}/submit`, 'POST', { answer: '답안' });
  await teacherRequest(`/teacher/assignments/${assignment.id}`, 'DELETE');
  assert.equal((await request('/student/me')).assignments.length, 0);
  assert.equal((await request('/student/me')).myAssignmentSubmissions.length, 1);
  await assert.rejects(request(`/student/assignments/${assignment.id}/pdf`), /과제/);
  await assert.rejects(request(`/student/assignments/${assignment.id}/submit`, 'POST', { answer: '답' }), /과제/);
  assert.equal((await teacherRequest(`/teacher/assignments/${assignment.id}/pdf`)).pdfData, pdf);
  await teacherRequest('/teacher/missions/review', 'POST', { ids: [submission.id], action: 'approve' });
  assert.equal(getLocalDB().students[0].balance, 112);
});

await check('taxes enforce daily payment, property threshold and sufficient funds', async () => {
  await assert.rejects(request('/student/taxes', 'POST', { type: 'property' }), /100코인/);
  assert.equal((await request('/student/me')).taxInfo.incomePaid, false);
  const income = await request('/student/taxes', 'POST', { type: 'income' });
  assert.equal(income.student.balance, 90);
  assert.equal(income.taxInfo.incomePaid, true);
  await assert.rejects(request('/student/taxes', 'POST', { type: 'income' }), /이미 납부/);
  simulatedTime = '2026-10-07T12:00:00';
  assert.equal((await request('/student/me')).taxInfo.incomePaid, false);
  updateStudent({ balance: 101 });
  const property = await request('/student/taxes', 'POST', { type: 'property' });
  assert.equal(property.student.balance, 91);
  assert.equal(property.taxInfo.propertyPaid, true);
  assert.equal(property.taxInfo.propertyDue, false);
  updateStudent({ balance: 500 });
  await assert.rejects(request('/student/taxes', 'POST', { type: 'property' }), /이미 납부/);
  updateStudent({ balance: 9 });
  await assert.rejects(request('/student/taxes', 'POST', { type: 'income' }), /부족/);
  assert.equal(getLocalDB().students[0].balance, 9);
  assert.equal(getLocalDB().transactions.filter(t => t.type === 'tax').length, 2);
});

await check('character costs form 10 to 1000 progression without changing XP', async () => {
  updateStudent({ balance: 50500 });
  for (let level = 1; level <= 100; level++) {
    const before = (await request('/student/me')).student;
    assert.equal(before.characterLevel, level);
    assert.equal(before.nextUpgradeCost, level * 10);
    const result = await request('/student/upgrade-character', 'POST');
    assert.equal(result.student.characterLevel, level + 1);
    assert.equal(result.transaction.amount, level * 10);
    assert.equal(result.student.exp, 150);
  }
  const top = (await request('/student/me')).student;
  assert.equal(top.characterLevel, 101);
  assert.equal(top.nextUpgradeCost, null);
  assert.equal(top.balance, 0);
  await assert.rejects(request('/student/upgrade-character', 'POST'), /최고 레벨/);
});

await check('territory grows exactly one tile with 200 then 400 costs', async () => {
  updateStudent({ balance: 1000 });
  let result = await request('/student/expand-territory', 'POST');
  assert.equal(result.student.claimedTiles, 7);
  assert.equal(result.student.balance, 800);
  assert.equal(result.student.territoryPurchases, 1);
  assert.equal(result.student.nextTerritoryCost, 400);
  result = await request('/student/expand-territory', 'POST');
  assert.equal(result.student.claimedTiles, 8);
  assert.equal(result.student.balance, 400);
  assert.equal(result.student.nextTerritoryCost, 600);
  await assert.rejects(request('/student/expand-territory', 'POST'), /부족/);
  assert.equal(getLocalDB().students[0].claimedTiles, 8);
  assert.equal(getLocalDB().students[0].exp, 150);
});

await check('city claiming shares territory price progression and buys one tile', async () => {
  updateStudent({ balance: 1000 });
  const first = await request('/student/claim-city', 'POST', { cityId: 'vancouver' });
  assert.equal(first.student.balance, 800);
  assert.equal(first.student.claimedTiles, 7);
  assert.equal(first.student.territoryPurchases, 1);
  assert.equal(first.student.nextTerritoryCost, 400);
  let cities = (await request('/world/cities')).cities;
  assert.equal(cities.find(c => c.id === 'seoul').residents.find(s => s.id === 's_1').tiles, 6);
  assert.equal(cities.find(c => c.id === 'vancouver').residents.find(s => s.id === 's_1').tiles, 1);
  const next = await request('/student/expand-territory', 'POST');
  assert.equal(next.student.balance, 400);
  assert.equal(next.student.claimedTiles, 8);
  assert.equal(next.student.nextTerritoryCost, 600);
  cities = (await request('/world/cities')).cities;
  assert.equal(cities.find(c => c.id === 'seoul').residents.find(s => s.id === 's_1').tiles, 7);
  assert.equal(cities.flatMap(c => c.residents).filter(s => s.id === 's_1').reduce((sum, s) => sum + s.tiles, 0), 8);
  await assert.rejects(request('/student/claim-city', 'POST', { cityId: 'vancouver' }), /이미 개척/);
  assert.equal(getLocalDB().transactions.filter(t => t.type === 'territory').length, 2);
});

await check('legacy city allocation preserves old territory totals', async () => {
  const db = getLocalDB();
  const s = db.students[0];
  s.claimedCities = ['seoul', 'vancouver'];
  s.claimedTiles = 10;
  delete s.claimedCityTiles;
  saveLocalDB(db);
  const migrated = getLocalDB().students[0];
  assert.deepEqual(migrated.claimedCityTiles, { seoul: 7, vancouver: 3 });
  const cities = (await request('/world/cities')).cities;
  assert.equal(cities.flatMap(c => c.residents).filter(s => s.id === 's_1').reduce((sum, s) => sum + s.tiles, 0), 10);
});

await check('failed storage writes never persist partial spending or assignment data', async () => {
  const before = [...stored.entries()];
  failWrites = true;
  await assert.rejects(request('/student/upgrade-character', 'POST'), /저장하지 못했어요/);
  await assert.rejects(request('/student/taxes', 'POST', { type: 'income' }), /저장하지 못했어요/);
  await assert.rejects(teacherRequest('/teacher/assignments', 'POST', { title: '저장 실패', pdfName: 'test.pdf', pdfData: pdf }), /저장하지 못했어요/);
  assert.deepEqual([...stored.entries()], before);
  failWrites = false;
  const result = await request('/student/upgrade-character', 'POST');
  assert.equal(result.student.balance, 90);
  assert.equal(result.student.characterLevel, 2);
  assert.equal(getLocalDB().assignments.length, 0);
});

await check('student first PIN is 0000 and old 1234 defaults move to 0000 once', async () => {
  assert.ok(getLocalDB().students.every(s => s.pin === '0000'));
  const legacy = createDefaultDB();
  delete legacy.settings.pinDefaultVersion;
  legacy.students[0].pin = '1234';
  legacy.students[1].pin = '5678';
  saveLocalDB(legacy);
  const migrated = getLocalDB();
  assert.equal(migrated.students[0].pin, '0000');
  assert.equal(migrated.students[1].pin, '5678');
  const login = await api('/login/student', { method: 'POST', body: { studentId: migrated.students[0].id, pin: '0000' } });
  assert.equal(login.role, 'student');
  await assert.rejects(api('/login/student', { method: 'POST', body: { studentId: migrated.students[1].id, pin: '1234' } }), /처음 PIN: 0000/);
});

console.log(`\n${checks} mock API integration checks passed.`);
