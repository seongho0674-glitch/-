const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const runtimeModules = 'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { chromium } = require(path.join(runtimeModules, 'playwright'));
const { PDFDocument, StandardFonts } = require(path.join(runtimeModules, 'pdf-lib'));

const stage = path.resolve(__dirname, '..');
const qa = path.join(stage, 'qa');
fs.mkdirSync(qa, { recursive: true });
const expectedNames = ['김도형', '김민준', '김소윤', '박은우', '박주이', '백채윤', '서하진', '서현아', '신윤호', '안수빈', '엄초원', '원예랑', '윤지은', '이건우', '이서우', '이서윤', '이정우', '이청한', '임진우', '조아란', '최건호'];
const modes = process.argv.includes('--mock-only') ? ['mock'] : process.argv.includes('--server-only') ? ['server'] : ['mock', 'server'];
const report = { startedAt: new Date().toISOString(), modes: [], pageErrors: [] };
let browser;

async function fixturePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  page.drawText('Teacher worksheet - UI integration test', { x: 50, y: 775, size: 18, font });
  page.drawText('Question 1: 2 + 3 = _____', { x: 50, y: 730, size: 15, font });
  const file = path.join(qa, 'worksheet-ui.pdf');
  fs.writeFileSync(file, await doc.save());
  return file;
}

async function api(page, endpoint, options) {
  return page.evaluate(async ({ endpoint, options }) => {
    const core = await import('/js/core.js');
    return core.api(endpoint, options);
  }, { endpoint, options });
}

async function poll(read, matches, description, timeout = 10000) {
  const until = Date.now() + timeout;
  let actual;
  while (Date.now() < until) {
    actual = await read();
    if (matches(actual)) return actual;
    await new Promise(resolve => setTimeout(resolve, 75));
  }
  throw new Error(`${description}; last value: ${JSON.stringify(actual).slice(0, 1000)}`);
}

async function route(page, hash, marker) {
  await page.evaluate(hash => { location.hash = hash; }, hash);
  await page.locator(marker).waitFor({ state: 'visible' });
}

async function signIn(page, base, role, studentId) {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const current = await page.evaluate(() => JSON.parse(localStorage.getItem('cm_session') || 'null'));
  if (current?.role === role && (role === 'teacher' || current.studentId === studentId)) {
    await page.locator('#btn-logout').waitFor();
    return;
  }
  if (current) {
    await page.locator('#btn-logout').waitFor();
    await page.locator('#btn-logout').click();
  }
  await page.locator(role === 'teacher' ? '#choose-teacher' : '#choose-student').waitFor();
  await page.locator(role === 'teacher' ? '#choose-teacher' : '#choose-student').click();
  if (role === 'student') {
    await page.locator(`#pick-${studentId}`).waitFor();
    assert.deepEqual(await page.locator('.pick-name').allTextContents(), expectedNames, 'student name selector matches all 21 names');
    await page.locator(`#pick-${studentId}`).click();
  }
  await page.locator('#pin-key-0').waitFor();
  for (const digit of role === 'teacher' ? '0000' : '1234') await page.locator(`#pin-key-${digit}`).click();
  await page.locator('#btn-logout').waitFor();
}

async function noOverflow(page, label, result, mode) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  const sizes = await page.evaluate(() => ({ viewport: innerWidth, html: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  if (sizes.html > sizes.viewport + 1 || sizes.body > sizes.viewport + 1) {
    result.overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].map(element => {
      const rect = element.getBoundingClientRect();
      return { element: element.tagName.toLowerCase(), id: element.id, class: element.className?.baseVal ?? element.className, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), text: (element.innerText || '').slice(0, 100) };
    }).filter(element => element.right > innerWidth + 1).slice(-30));
    console.error(`${mode} ${label} overflow elements: ${JSON.stringify(result.overflow)}`);
  }
  assert.ok(sizes.html <= sizes.viewport + 1 && sizes.body <= sizes.viewport + 1, `${label} page overflow: ${JSON.stringify(sizes)}`);
  await page.screenshot({ path: path.join(qa, `${mode}-${label}.png`), fullPage: true });
  result.checks.push(`${label}: no horizontal overflow`);
}

async function confirmedClick(page, selector) {
  await page.locator(selector).click();
  await page.locator('#confirm-yes').waitFor();
  await page.locator('#confirm-yes').click();
  await page.locator('.modal-backdrop').waitFor({ state: 'hidden' });
}

async function runMode(mode, pdfFile) {
  const base = mode === 'mock' ? 'http://127.0.0.1:8766/' : 'http://127.0.0.1:8765/';
  const result = { mode, base, checks: [], passed: false };
  report.modes.push(result);
  const teacherContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Seoul' });
  const studentContext = mode === 'server' ? await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Seoul' }) : teacherContext;
  const teacher = await teacherContext.newPage();
  const student = mode === 'server' ? await studentContext.newPage() : teacher;
  let activePage = teacher;
  for (const page of new Set([teacher, student])) page.on('pageerror', error => report.pageErrors.push({ mode, message: error.message }));
  try {
    await teacher.goto(base, { waitUntil: 'domcontentloaded' });
    await teacher.locator('#choose-teacher').waitFor();
    assert.match(await teacher.locator('.hero-title').innerText(), /서초롱\s*민주시민 경제교육/);
    assert.match(await teacher.title(), /서초롱 민주시민 경제교육/);
    const detectedMode = await teacher.evaluate(async () => (await import('/js/core.js')).getAppMode());
    assert.equal(detectedMode, mode, 'intended real/mock transport detected');
    result.checks.push('renamed brand and intended transport');

    await signIn(teacher, base, 'teacher');
    const state = await api(teacher, '/teacher/state');
    assert.deepEqual(state.students.map(s => s.name), expectedNames);
    assert.equal(state.roles.filter(role => role.id.startsWith('r_class_')).length, 21);
    assert.equal(state.students.filter(s => /^r_class_/.test(s.roleId || '')).length, 21);
    for (const student of state.students) assert.ok(state.roles.some(role => role.id === student.roleId && role.tasks.length), `${student.name} has an assigned role with tasks`);
    const today = await teacher.evaluate(async () => (await import('/js/core.js')).todayKey());
    const taxedIds = new Set((await api(teacher, '/teacher/transactions')).transactions.filter(t => t.type === 'tax' && t.createdAt.startsWith(today)).map(t => t.studentId));
    const pupil = state.students.find(s => Number(s.characterLevel || 1) === 1 && Number(s.territoryPurchases || 0) === 0 && !taxedIds.has(s.id));
    assert.ok(pupil, 'fresh student for growth and daily tax UI test');
    result.student = { id: pupil.id, name: pupil.name };
    assert.equal(await teacher.locator('#student-table tbody tr').count(), 21);
    await route(teacher, '#/teacher/roles', '.role-grid');
    assert.equal(await teacher.locator('.role-card').count(), 21);
    assert.equal(await teacher.locator('.role-assign').evaluateAll(selects => selects.filter(select => !!select.value).length), 21);
    result.checks.push('21 roster names and 21 role assignments/tasks');

    await route(teacher, '#/teacher/shop', '#item-add');
    for (const [name, price] of [['학용품', 200], ['간식 뽑기', 50], ['알림장 면제', 100]]) {
      const row = teacher.locator('tbody tr').filter({ has: teacher.getByText(name, { exact: true }) });
      assert.equal(await row.count(), 1);
      assert.equal((await row.locator('.bal-cell').innerText()).trim(), String(price));
    }
    assert.equal(state.items.filter(item => ['캐릭터 연필', '미니 노트', '미니노트'].includes(item.name)).length, 0);
    result.checks.push('shop names and prices: 학용품 200 / 간식 뽑기 50 / 알림장 면제 100');

    await route(teacher, '#/teacher/assignments', '#assignment-form');
    assert.match(await teacher.locator('#nav-assignments').innerText(), /교사 관리자/);
    const title = `UI PDF 과제 ${mode} ${Date.now()}`;
    await teacher.locator('#assignment-title').fill(title);
    await teacher.locator('#assignment-instructions').fill('첨부한 학습지의 1번 문제를 풀고 풀이를 적어 주세요.');
    await teacher.locator('#assignment-pdf').setInputFiles(pdfFile);
    await teacher.locator('#assignment-pdf-remove').waitFor();
    assert.equal(await teacher.locator('#assignment-target').inputValue(), 'all');
    await teacher.locator('#assignment-publish').click();
    await teacher.locator('.assignment-card').filter({ has: teacher.getByText(title, { exact: false }) }).waitFor();
    const published = (await api(teacher, '/teacher/assignments')).assignments.find(a => a.title === title);
    assert.ok(published?.pdfName && published.active !== false);
    assert.deepEqual(published.studentIds, []);
    assert.equal(published.reward, 10);
    await teacher.locator(`[data-assignment-pdf="${published.id}"]`).click();
    await teacher.locator('.modal iframe.pdf-frame').waitFor();
    assert.match(await teacher.locator('.modal iframe.pdf-frame').getAttribute('src'), /^blob:/);
    await teacher.locator('#modal-close').click();
    result.checks.push('teacher creates real PDF assignment via UI, whole class and default reward 10');
    await noOverflow(teacher, 'teacher-desktop', result, mode);
    await teacher.setViewportSize({ width: 390, height: 844 });
    await noOverflow(teacher, 'teacher-mobile', result, mode);
    await teacher.setViewportSize({ width: 1440, height: 1000 });

    activePage = student;
    await signIn(student, base, 'student', pupil.id);
    await route(student, '#/student/missions', '#teacher-assignments');
    const prior = await api(student, '/student/me');
    const balanceBeforeReward = prior.student.balance;
    assert.ok(prior.assignments.some(a => a.id === published.id));
    assert.ok(prior.missions.some(m => m.id === 'm_teacher' && m.name === '선생님 과제'));
    await student.locator(`[data-assignment="${published.id}"]`).click();
    await student.locator('#assignment-answer').waitFor();
    const pdf = student.locator('iframe.pdf-frame');
    assert.match(await pdf.getAttribute('src'), /^blob:/);
    const blobSize = await student.evaluate(async () => {
      const url = document.querySelector('iframe.pdf-frame').src;
      return (await fetch(url)).arrayBuffer().then(data => data.byteLength);
    });
    assert.ok(blobSize > 100, 'inline PDF URL returns real PDF bytes');
    assert.equal(await student.locator('#assignment-submit').isDisabled(), true);
    const answer = '1번 답은 5입니다. 2에 3을 더해 5가 됩니다.\n'.repeat(90) + '마지막 풀이 문장까지 모두 보입니다.';
    await student.locator('#assignment-answer').fill(answer);
    assert.equal(await student.locator('#assignment-submit').isDisabled(), true, 'answer alone requires self certification');
    await student.locator('#assignment-certify').check();
    await student.locator('#assignment-submit').click();
    await student.locator('#assignment-answer').waitFor({ state: 'hidden' });
    const afterSubmit = await api(student, '/student/me');
    const submission = afterSubmit.myAssignmentSubmissions.find(x => x.assignmentId === published.id);
    assert.equal(submission?.status, 'pending');
    assert.equal(submission.note, answer);
    assert.equal(afterSubmit.student.balance, balanceBeforeReward);
    result.checks.push('student reads inline PDF, writes full answer, and certifies pending submission');

    activePage = teacher;
    await signIn(teacher, base, 'teacher');
    await route(teacher, '#/teacher/missions', '.review-list');
    const row = teacher.locator(`.review-row[data-id="${submission.id}"]`);
    assert.ok((await row.innerText()).length < 700, 'review row does not render long answer');
    await row.locator('[data-answer]').click();
    await teacher.locator('#answer-approve').waitFor();
    assert.equal(await teacher.locator('.modal .assignment-answer').innerText(), answer);
    assert.equal(await teacher.locator('#answer-pdf').count(), 1, 'PDF submission exposes worksheet action');
    await teacher.locator('#answer-approve').click();
    await row.waitFor({ state: 'hidden' });
    const reviewed = await api(teacher, '/teacher/missions');
    assert.equal(reviewed.recent.find(x => x.id === submission.id).status, 'approved');
    const fundedState = await api(teacher, '/teacher/state');
    assert.equal(fundedState.students.find(s => s.id === pupil.id).balance, balanceBeforeReward + 10);
    await api(teacher, '/teacher/pay', { method: 'POST', body: { studentIds: [pupil.id], type: 'give', amount: 1000, reason: 'UI 검사 테스트 지원금' } });
    result.checks.push('teacher sees full answer and approves exactly one 10-coin reward');

    activePage = student;
    await signIn(student, base, 'student', pupil.id);
    await route(student, '#/student/missions', '#teacher-assignments');
    await student.locator(`[data-assignment="${published.id}"]`).click();
    await student.locator('#assignment-answer').waitFor();
    assert.equal(await student.locator('#assignment-answer').inputValue(), answer);
    assert.equal(await student.locator('#assignment-answer').getAttribute('readonly'), '');
    assert.equal(await student.locator('#assignment-submit').count(), 0, 'approved assignment cannot be submitted again');
    await student.locator('#assignment-close').click();
    let me = await api(student, '/student/me');
    assert.equal(me.transactions.filter(t => t.type === 'give' && t.reason.includes(title)).length, 1);
    result.checks.push('approved student answer remains readable and reward cannot repeat');

    await route(student, '#/student', '[data-tax="income"]');
    const beforeTax = me.student.balance;
    await confirmedClick(student, '[data-tax="income"]');
    me = await poll(() => api(student, '/student/me'), data => data.taxInfo.incomePaid, 'income tax paid');
    assert.equal(me.student.balance, beforeTax - 10);
    await poll(() => student.locator('[data-tax="income"]').isDisabled(), value => value, 'income tax button disabled');
    await confirmedClick(student, '[data-tax="property"]');
    me = await poll(() => api(student, '/student/me'), data => data.taxInfo.propertyPaid, 'property tax paid');
    assert.equal(me.student.balance, beforeTax - 20);
    await poll(() => student.locator('[data-tax="property"]').isDisabled(), value => value, 'property tax button disabled');
    assert.equal(me.transactions.filter(t => t.type === 'tax' && /소득세/.test(t.reason)).length, 1);
    assert.equal(me.transactions.filter(t => t.type === 'tax' && /재산세/.test(t.reason)).length, 1);
    result.checks.push('daily 10-coin income/property taxes are paid once and disabled afterward');

    const beforeUpgrade = me.student.balance;
    const experienceBefore = me.student.exp;
    assert.equal(me.student.nextUpgradeCost, 10);
    await confirmedClick(student, '[data-economy="upgrade"]');
    me = await poll(() => api(student, '/student/me'), data => data.student.characterLevel === 2, 'character level 2');
    assert.equal(me.student.balance, beforeUpgrade - 10);
    assert.equal(me.student.nextUpgradeCost, 20);
    await poll(() => student.locator('[data-economy="upgrade"]').innerText(), text => /20/.test(text), 'next upgrade button costs 20');
    await confirmedClick(student, '[data-economy="upgrade"]');
    me = await poll(() => api(student, '/student/me'), data => data.student.characterLevel === 3, 'character level 3');
    assert.equal(me.student.balance, beforeUpgrade - 30);
    assert.equal(me.student.nextUpgradeCost, 30);
    await poll(() => student.locator('[data-economy="upgrade"]').innerText(), text => /30/.test(text), 'next upgrade button costs 30');
    assert.equal(me.student.exp, experienceBefore, 'coin growth keeps experience separate');
    result.checks.push('character upgrades cost 10 then 20, next 30, while XP remains separate');

    const beforeTerritory = me.student.balance;
    const beforeTiles = me.student.claimedTiles;
    assert.equal(me.student.nextTerritoryCost, 200);
    await confirmedClick(student, '[data-economy="territory"]');
    me = await poll(() => api(student, '/student/me'), data => data.student.territoryPurchases === 1, 'first territory purchase');
    assert.equal(me.student.balance, beforeTerritory - 200);
    assert.equal(me.student.claimedTiles, beforeTiles + 1);
    assert.equal(me.student.nextTerritoryCost, 400);
    await poll(() => student.locator('[data-economy="territory"]').innerText(), text => /400/.test(text), 'next territory button costs 400');
    await route(student, '#/student/world', '.ws-cities');
    const cities = (await api(student, '/world/cities')).cities;
    const unowned = cities.find(c => !me.student.claimedCities.includes(c.id));
    assert.ok(unowned);
    await student.locator(`[data-city="${unowned.id}"]`).click();
    assert.match(await student.locator('[data-act="claim"]').innerText(), /400/);
    await confirmedClick(student, '[data-act="claim"]');
    me = await poll(() => api(student, '/student/me'), data => data.student.claimedCities.includes(unowned.id), 'new city claimed');
    assert.equal(me.student.balance, beforeTerritory - 600);
    assert.equal(me.student.claimedTiles, beforeTiles + 2);
    assert.equal(me.student.territoryPurchases, 2);
    assert.equal(me.student.nextTerritoryCost, 600);
    result.checks.push('territory expansion costs 200; city claim shares next cost 400 and adds exactly 1 tile');

    const persisted = { balance: me.student.balance, characterLevel: me.student.characterLevel, tiles: me.student.claimedTiles, purchases: me.student.territoryPurchases };
    await student.reload({ waitUntil: 'domcontentloaded' });
    await student.locator('#btn-logout').waitFor();
    me = await api(student, '/student/me');
    assert.deepEqual({ balance: me.student.balance, characterLevel: me.student.characterLevel, tiles: me.student.claimedTiles, purchases: me.student.territoryPurchases }, persisted);
    assert.equal(me.myAssignmentSubmissions.find(x => x.id === submission.id).status, 'approved');
    assert.ok(me.taxInfo.incomePaid && me.taxInfo.propertyPaid);
    result.checks.push('reload preserves balance, levels, territory, tax and approved assignment');
    await route(student, '#/student', '[data-tax="income"]');
    await noOverflow(student, 'student-desktop', result, mode);
    await student.setViewportSize({ width: 390, height: 844 });
    await noOverflow(student, 'student-mobile', result, mode);
    await route(student, '#/student/missions', '#teacher-assignments');
    await noOverflow(student, 'student-mobile-missions', result, mode);
    result.passed = true;
    console.log(`${mode}: PASS (${result.checks.length} checks)`);
  } catch (error) {
    result.error = error.stack;
    await activePage.screenshot({ path: path.join(qa, `${mode}-failure.png`), fullPage: true }).catch(() => {});
    console.error(`${mode}: FAIL ${error.stack}`);
  } finally {
    await teacherContext.close();
    if (studentContext !== teacherContext) await studentContext.close();
  }
}

(async () => {
  try {
    const pdf = await fixturePdf();
    const browserPath = [chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => fs.existsSync(file));
    assert.ok(browserPath, 'an existing Chromium, Chrome, or Edge browser is required; no browser is downloaded');
    report.browserExecutable = browserPath;
    browser = await chromium.launch({ headless: true, executablePath: browserPath });
    if (process.argv.includes('--screenshots-only')) {
      report.screenshotsOnly = true;
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Seoul' });
      const page = await context.newPage();
      page.on('pageerror', error => report.pageErrors.push({ mode: 'server', message: error.message }));
      await signIn(page, 'http://127.0.0.1:8765/', 'teacher');
      await route(page, '#/teacher/assignments', '#assignment-form');
      const result = { checks: [] };
      await noOverflow(page, 'teacher-desktop', result, 'server');
      await page.setViewportSize({ width: 390, height: 844 });
      await noOverflow(page, 'teacher-mobile', result, 'server');
      await context.close();
      return;
    }
    if (process.argv.includes('--diagnose-overflow')) {
      report.diagnostic = true;
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' });
      const page = await context.newPage();
      await signIn(page, 'http://127.0.0.1:8766/', 'student', 's_1');
      await noOverflow(page, 'student-mobile-initial', { checks: [] }, 'mock');
      await context.close();
      return;
    }
    for (const mode of modes) await runMode(mode, pdf);
    if (report.pageErrors.length) throw new Error(`Browser page errors: ${JSON.stringify(report.pageErrors)}`);
  } catch (error) {
    report.fatalError = error.stack;
    console.error(error.stack);
  } finally {
    if (browser) await browser.close();
    report.finishedAt = new Date().toISOString();
    report.passed = (report.diagnostic || report.screenshotsOnly || (report.modes.length === modes.length && report.modes.every(mode => mode.passed))) && !report.fatalError && !report.pageErrors.length;
    fs.writeFileSync(path.join(qa, report.diagnostic ? 'ui-overflow-results.json' : report.screenshotsOnly ? 'ui-screenshots-results.json' : 'ui-results.json'), JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
  }
})();
