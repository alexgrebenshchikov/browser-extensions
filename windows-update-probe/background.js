// Copyright 2026 Yandex LLC. All rights reserved.
'use strict';

const ALARM = 'windows-update-probe';
const DELAY_MS = 30000;
let queue = Promise.resolve();

function enqueue(work) {
  const result = queue.then(work);
  queue = result.catch(error => console.error('Windows Update Probe:', error));
  return result;
}

async function readState() {
  const {probe} = await chrome.storage.local.get('probe');
  return probe || {runs: [], pending: null};
}

async function writeState(state) {
  await chrome.storage.local.set({probe: state});
}

async function start(label) {
  if (!['normal', 'empty'].includes(label)) throw new Error('Unknown scenario');
  const state = await readState();
  if (state.pending) throw new Error('Сначала отмените предыдущий запуск');
  const run = {
    id: crypto.randomUUID(), label, phase: 'armed',
    scheduledTime: Date.now() + DELAY_MS,
    startedAt: new Date().toISOString()
  };
  state.runs = [...state.runs.slice(-19), run];
  state.pending = run.id;
  await writeState(state);
  try {
    await chrome.alarms.create(ALARM, {when: run.scheduledTime});
  } catch (error) {
    run.phase = 'error';
    run.error = error.message;
    state.pending = null;
    await writeState(state);
    throw error;
  }
  return run;
}

async function probe() {
  const state = await readState();
  const run = state.runs.find(item => item.id === state.pending);
  if (!run || run.phase !== 'armed') return;
  try {
    const windows = await chrome.windows.getAll({populate: true});
    const win = windows.find(item => item.focused) || windows[0];
    run.before = {
      time: new Date().toISOString(),
      windowId: win?.id ?? null,
      windows: windows.map(item => ({
        id: item.id, focused: item.focused, type: item.type,
        tabs: Array.isArray(item.tabs)
          ? item.tabs.map(tab => ({id: tab.id, active: tab.active})) : null
      }))
    };
    if (!win) {
      run.phase = 'no-window';
    } else if (!windows.every(item => Array.isArray(item.tabs)) ||
        (run.label === 'empty' && windows.some(item => item.tabs.length > 0)) ||
        (run.label === 'normal' && win.tabs.length === 0)) {
      run.phase = 'invalid';
      run.error = 'Число вкладок не соответствует выбранному сценарию';
    } else {
      run.phase = 'before';
      // Persist the empty-window evidence before the potentially crashing API call.
      await writeState(state);
      run.after = await new Promise(resolve => {
        chrome.windows.update(win.id, {focused: true}, result => {
          const error = chrome.runtime.lastError?.message || null;
          resolve({time: new Date().toISOString(), id: result?.id ?? null, error});
        });
      });
      run.phase = 'after';
    }
  } catch (error) {
    run.phase = 'error';
    run.error = error.message;
  }
  state.pending = null;
  await writeState(state);
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM) enqueue(probe);
});

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  enqueue(async () => {
    if (message.type === 'start') return start(message.label);
    if (message.type === 'cancel') {
      await chrome.alarms.clear(ALARM);
      const state = await readState();
      const run = state.runs.find(item => item.id === state.pending);
      if (run) {
        run.interruptedPhase = run.phase;
        run.phase = 'cancelled';
      }
      state.pending = null;
      await writeState(state);
      return;
    }
    if (message.type === 'clear') {
      const state = await readState();
      if (state.pending) throw new Error('Сначала отмените запуск');
      await writeState({runs: [], pending: null});
      return;
    }
    throw new Error('Unknown message');
  }).then(value => reply({ok: true, value}), error => reply({ok: false, error: error.message}));
  return true;
});
