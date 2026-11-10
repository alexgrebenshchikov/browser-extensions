const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = require('node:path').join(__dirname, '../api-test-extension');
async function check(scenario, os = 'android') {
    const calls = [];
    const listeners = new Set();
    const runtime = { getPlatformInfo(cb) { cb({ os }); } };
    const fail = (cb, message) => {
        runtime.lastError = { message };
        cb();
        delete runtime.lastError;
    };
    const tabs = {
        onUpdated: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) },
        create(options, cb) {
            assert.equal(options.active, false);
            assert.equal(options.url, 'https://ya.ru/?api_test=discard');
            calls.push('create');
            cb({ id: 42 });
        },
        get(id, cb) {
            assert.equal(id, 42);
            calls.push('load');
            if (scenario === 'load-error') fail(cb, 'Load failed');
            else cb({ id, status: 'complete' });
        },
        discard(id, cb) {
            if (os !== 'android') {
                assert.equal(arguments.length, 1, 'Desktop discard must not receive a tab ID');
                assert.equal(typeof id, 'function');
                assert.deepEqual(calls, []);
                calls.push('discard');
                if (scenario === 'api-error') fail(id, 'Cannot discard');
                else id();
                return;
            }
            assert.equal(id, 42, 'Discard must explicitly target the temporary tab');
            assert.deepEqual(calls, ['create', 'load']);
            calls.push('discard');
            if (scenario === 'api-error') fail(cb, 'Cannot discard');
            else if (scenario === 'no-result') cb();
            else cb({ id: scenario === 'wrong-id' ? 7 : id, discarded: scenario !== 'not-discarded' });
        },
        remove(id, cb) {
            assert.equal(id, 42, 'Cleanup must target only the temporary tab');
            calls.push('remove');
            cb();
        }
    };
    const context = vm.createContext({ chrome: { tabs, runtime, scripting: {} }, console, setTimeout, clearTimeout });
    for (const file of ['src/APITest/test.js', 'src/tests/common.js', 'src/tests/tabs.js']) {
        vm.runInContext(fs.readFileSync(root + '/' + file, 'utf8'), context, { filename: file });
    }
    const result = await vm.runInContext('tabs_test.tests["[Method Call] discard"].run()', context);
    assert.equal(result.status, scenario === 'success' ? 0 : 1);
    assert.deepEqual(calls, os !== 'android' ? ['discard'] : scenario === 'load-error' ? ['create', 'load', 'remove'] : ['create', 'load', 'discard', 'remove']);
    assert.equal(listeners.size, 0);
    if (scenario === 'api-error') assert.match(result.msg, /Cannot discard/);
    if (scenario === 'load-error') assert.match(result.msg, /Load failed/);
    console.log('PASS ' + os + ' ' + scenario);
}
(async () => {
    for (const scenario of ['success', 'api-error', 'no-result', 'wrong-id', 'not-discarded', 'load-error']) await check(scenario);
    for (const os of ['linux', 'win', 'mac']) {
        await check('success', os);
        await check('api-error', os);
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
