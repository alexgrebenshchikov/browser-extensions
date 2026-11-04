// Copyright 2026 Yandex LLC. All rights reserved.
'use strict';

let currentState = {runs: [], pending: null};

function summary(run) {
  if (!run) return 'Запусков нет';
  const prefix = run.label + ': ';
  if (run.phase === 'armed') {
    const seconds = Math.max(0, Math.ceil((run.scheduledTime - Date.now()) / 1000));
    return prefix + (seconds ? 'запуск через ' + seconds + ' с' :
      'ожидание фонового обработчика; не открывайте вкладки');
  }
  if (run.phase === 'before') return prefix + 'before сохранён, after отсутствует. Успех не подтверждён';
  if (run.phase === 'after') {
    if (run.after.error) return prefix + 'callback: ' + run.after.error +
      (run.label === 'empty' ? ' (штатная ошибка API)' : ' (normal не пройден)');
    return prefix + (run.after.id === run.before.windowId ?
      'callback получен, error: null' : 'ID окна не совпал. Успех не подтверждён');
  }
  if (run.phase === 'no-window') return prefix + 'окно отсутствует. Сценарий не выполнен';
  if (run.phase === 'invalid') return prefix + 'неверное число вкладок. Вызов не выполнен';
  if (run.phase === 'cancelled') return prefix + 'запуск отменён';
  return prefix + 'ошибка: ' + run.error;
}

async function render() {
  const {probe} = await chrome.storage.local.get('probe');
  currentState = probe || {runs: [], pending: null};
  document.querySelector('#status').textContent = summary(currentState.runs.at(-1));
  document.querySelector('#log').textContent = JSON.stringify(currentState, null, 2);
  document.querySelector('#normal').disabled = Boolean(currentState.pending);
  document.querySelector('#empty').disabled = Boolean(currentState.pending);
  document.querySelector('#cancel').disabled = !currentState.pending;
  document.querySelector('#clear').disabled = Boolean(currentState.pending);
}

async function send(message) {
  try {
    const response = await chrome.runtime.sendMessage(message);
    if (!response?.ok) throw new Error(response?.error || 'Нет ответа фонового обработчика');
    await render();
  } catch (error) {
    document.querySelector('#status').textContent = error.message;
  }
}

for (const label of ['normal', 'empty']) {
  document.querySelector('#' + label).onclick = () => send({type: 'start', label});
}
for (const type of ['cancel', 'clear']) {
  document.querySelector('#' + type).onclick = () => send({type});
}
document.querySelector('#export').onclick = () => {
  const status = document.querySelector('#export-status');
  status.textContent = 'Сохранение JSON…';
  chrome.downloads.download({
    url: 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentState, null, 2)),
    filename: 'windows-update-probe.json'
  }, id => {
    const error = chrome.runtime.lastError?.message;
    status.textContent = error ? 'Не удалось сохранить JSON: ' + error :
      'JSON передан в загрузки, ID: ' + id;
  });
};
chrome.storage.onChanged.addListener(() => render().catch(console.error));
setInterval(() => render().catch(console.error), 1000);
render().catch(error => { document.querySelector('#status').textContent = error.message; });
