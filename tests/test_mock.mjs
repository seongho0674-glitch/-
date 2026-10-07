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
  stored = new Map(); failWrites = false; simulatedTime = '2026-10-06T08:30:00';   // 하루 시작(8시) 뒤, 소득세(9시) 전
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
  assert.equal(seeded.version, 4);
  assert.deepEqual(seeded.items.filter(i => ['학용품', '알림장 면제', '간식 뽑기', '자리 바꾸기 교환권', '숙제 하루 면제 쿠폰'].includes(i.name)).map(i => [i.name, i.price]).sort(),
    [['간식 뽑기', 200], ['숙제 하루 면제 쿠폰', 200], ['알림장 면제', 100], ['자리 바꾸기 교환권', 500], ['학용품', 400]]);
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
  assert.equal(migrated.version, 4);
  assert.deepEqual(['학용품', '알림장 면제', '간식 뽑기'].map(n => migrated.items.find(i => i.name === n).price), [400, 100, 200]);
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
  assert.equal(getLocalDB().students[0].balance, 110);   // 100 − 소득세 2일(6·7일 접속) + 보상 30
  assert.equal(getLocalDB().students[0].exp, 180);
  await assert.rejects(teacherRequest('/teacher/missions/review', 'POST', { ids: [second.submission.id], action: 'approve' }), /이미 처리/);
  simulatedTime = '2026-10-08T12:00:00';
  await assert.rejects(request(`/student/assignments/${assignment.id}/submit`, 'POST', { answer: '중복 인증' }), /이미 승인/);
  assert.equal((await request('/student/me')).myAssignmentSubmissions.length, 2);
  const db = getLocalDB();
  db.submissions.push({ ...second.submission, id: 'duplicate_pending', status: 'pending' });
  saveLocalDB(db);
  await teacherRequest('/teacher/missions/review', 'POST', { ids: ['duplicate_pending'], action: 'approve' });
  assert.equal(getLocalDB().students[0].balance, 100);   // 8일 접속 소득세 10만 빠지고 중복 보상은 없음
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

await check('income tax is automatic at 9 on days the student opened the app and may go below zero', async () => {
  updateStudent({ balance: 5 });
  let me = await request('/student/me');                    // 8:30 접속 → 아직 9시 전
  assert.equal(me.taxInfo.incomeStatus, 'scheduled');
  assert.equal(me.student.balance, 5);
  await assert.rejects(request('/student/taxes', 'POST', { type: 'income' }), /자동/);
  simulatedTime = '2026-10-06T09:05:00';
  me = await request('/student/me');
  assert.equal(me.taxInfo.incomeStatus, 'paid');
  assert.equal(me.student.balance, -5);                      // 모자라도 걷고 마이너스(대출)
  const taxes = () => getLocalDB().transactions.filter(t => t.type === 'tax' && t.taxType === 'income');
  assert.deepEqual(taxes().map(t => [t.studentId, t.createdAt, t.amount]), [['s_1', '2026-10-06T09:00:00', 10]]);
  await request('/student/me');                              // 같은 날 다시 와도 한 번만
  simulatedTime = '2026-10-07T07:50:00';                     // 아침 8시 전은 아직 6일
  assert.equal((await request('/student/me')).taxInfo.date, '2026-10-06');
  simulatedTime = '2026-10-09T10:00:00';                     // 7·8일은 접속 기록이 없으니 걷지 않음
  await teacherRequest('/teacher/state');
  assert.equal(taxes().length, 1);
  me = await request('/student/me');                         // 9일 10시 첫 접속 → 그때 걷는다
  assert.equal(me.student.balance, -15);
  assert.equal(taxes().at(-1).createdAt, '2026-10-09T10:00:00');
  simulatedTime = '2026-10-10T08:10:00';
  await request('/student/me', 'GET', null, student2);       // 2번은 8시 10분에만 접속
  simulatedTime = '2026-10-10T09:30:00';
  await teacherRequest('/teacher/state');                    // 다른 요청이 와도 9시 몫이 걷힌다
  assert.deepEqual(taxes().filter(t => t.studentId === 's_2').map(t => t.createdAt), ['2026-10-10T09:00:00']);
  assert.equal(taxes().filter(t => t.studentId === 's_3').length, 0);
});

await check('daily missions and the luck game count reset at 8 in the morning', async () => {
  simulatedTime = '2026-10-06T21:00:00';
  await request('/student/missions', 'POST', { missionId: 'm_notice' });
  simulatedTime = '2026-10-07T07:59:00';
  await assert.rejects(request('/student/missions', 'POST', { missionId: 'm_notice' }), /이미 신청/);
  simulatedTime = '2026-10-07T08:00:00';
  assert.equal((await request('/student/missions', 'POST', { missionId: 'm_notice' })).ok, true);
});

await check('teacher sends a property tax notice and students choose whether to pay 10', async () => {
  updateStudent({ balance: 150 });
  await assert.rejects(request('/student/taxes', 'POST', { type: 'property' }), /통보가 없어요/);
  const sent = await teacherRequest('/teacher/property-tax/notify', 'POST');
  assert.equal(sent.count, 1);                               // 잔액이 100을 넘는 학생만
  let me = await request('/student/me');
  assert.deepEqual([me.taxInfo.property.amount, me.taxInfo.property.paid], [10, false]);
  assert.equal(me.student.balance, 150);                     // 통보만으로는 걷지 않음
  const paid = await request('/student/taxes', 'POST', { type: 'property' });
  assert.equal(paid.student.balance, 140);
  assert.equal(paid.taxInfo.property.paid, true);
  await assert.rejects(request('/student/taxes', 'POST', { type: 'property' }), /이미 냈어요/);
  assert.equal((await request('/student/me', 'GET', null, student2)).taxInfo.property, null);
  const st = await teacherRequest('/teacher/state');
  assert.deepEqual([st.propertyTax.latest.targets, st.propertyTax.latest.paid], [1, 1]);
  updateStudent({ balance: 60 });
  await assert.rejects(teacherRequest('/teacher/property-tax/notify', 'POST'), /대상자가 없어요/);
});

await check('the fifth luck game of the day adds a 5-coin gambling prevention fee', async () => {
  updateStudent({ balance: 100 });
  for (let i = 1; i <= 4; i++) assert.equal((await request('/student/luck', 'POST', { pick: 'odd' })).fine, null);
  const before = getLocalDB().students[0].balance;
  const fifth = await request('/student/luck', 'POST', { pick: 'even' });
  assert.equal(fifth.fine.amount, 5);
  assert.equal(fifth.student.balance, before + fifth.result.net - 5);
  assert.equal(fifth.luck.finedToday, true);
  await assert.rejects(request('/student/luck', 'POST', { pick: 'odd' }), /5번까지/);
  assert.equal(getLocalDB().transactions.filter(t => t.type === 'fine').length, 1);
});

await check('invading bought land costs more than twice what the owner paid', async () => {
  const db = getLocalDB();
  db.students[1].balance = 2000;
  saveLocalDB(db);
  await request('/student/expand-territory', 'POST', null, student2);      // 2번: 시작 도시에 200코인으로 1칸
  const city = getLocalDB().students[1].homeCity;
  updateStudent({ balance: 1000 });
  const owner = (await request('/world/cities')).cities.find(c => c.id === city).residents.find(r => r.id === 's_2');
  assert.deepEqual([owner.bought, owner.paid, owner.invadeCost], [1, 200, 401]);
  await assert.rejects(request('/student/invade', 'POST', { cityId: city, targetId: 's_1' }), /내 영토/);
  const won = await request('/student/invade', 'POST', { cityId: city, targetId: 's_2' });
  assert.deepEqual([won.transaction.amount, won.tiles], [401, 1]);
  let now = getLocalDB();
  assert.deepEqual([now.students[1].claimedCityTiles[city], now.students[1].claimedTiles], [6, 6]);   // 시작 6칸은 그대로
  assert.deepEqual([now.students[0].claimedCityTiles[city], now.students[0].landBought[city]], [1, { tiles: 1, paid: 401 }]);
  assert.ok(now.students[0].claimedCities.includes(city));
  assert.ok(now.transactions.some(t => t.type === 'invaded' && t.studentId === 's_2' && t.tiles === 1));
  await assert.rejects(request('/student/invade', 'POST', { cityId: city, targetId: 's_2' }), /침공할 수 있는 영토가 없어요/);
  const back = await request('/student/invade', 'POST', { cityId: city, targetId: 's_1' }, student2);   // 되찾으려면 2×401+1
  assert.equal(back.transaction.amount, 803);
  now = getLocalDB();
  assert.equal(now.students[0].claimedCityTiles[city], undefined);
  assert.ok(!now.students[0].claimedCities.includes(city));
  const st = await teacherRequest('/teacher/state');
  const row = (id) => st.dailyBoard.rows.find(r => r.id === id);
  assert.deepEqual([row('s_1').territoryCoins, row('s_1').levelupCoins, row('s_1').totalXp], [401, 0, 401]);
  assert.deepEqual([row('s_2').territoryCoins, row('s_2').totalXp], [1003, 1003]);
});

await check('teacher dashboard shows today daily missions, access and income tax', async () => {
  await request('/student/missions', 'POST', { missionId: 'm_notice' });
  const st = await teacherRequest('/teacher/state');
  assert.deepEqual(st.dailyBoard.missions.map(m => m.id), ['m_role', 'm_notice', 'm_supplies']);
  const row = st.dailyBoard.rows.find(r => r.id === 's_1');
  assert.deepEqual([row.missions.m_notice, row.missions.m_supplies, row.seen, row.incomeTax], ['pending', 'none', true, 'scheduled']);
  assert.equal(st.dailyBoard.rows.find(r => r.id === 's_2').seen, false);
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
