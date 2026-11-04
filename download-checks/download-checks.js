// Copyright 2026 Yandex LLC. All rights reserved.
'use strict';

const BLOB_NAME = 'Проверка Blob.txt';
const BLOB_TEXT = 'Blob download check\n1234567890\n';
const VIDEO_NAME = 'risk5-pause-resume.webm';
const VIDEO_SHA256 = '4c3d89f4130a6349bab2a6b9c57066879c95c87f966ca5ff4b8c689e4834184b';

const localServer = location.protocol === 'http:' && location.hostname === 'localhost';
document.querySelector('#http-journal').hidden = !localServer;
const videoLink = document.querySelector('#slow-download');
videoLink.href = localServer ? '/slow.webm' : VIDEO_NAME;
videoLink.addEventListener('click', () => {
  if (!localServer) {
    // A fresh URL keeps repeated downloads out of the browser cache.
    videoLink.href = VIDEO_NAME + '?run=' + Date.now();
  }
});

document.querySelector('#blob-download').onclick = () => {
  const url = URL.createObjectURL(new Blob([BLOB_TEXT], {type: 'text/plain;charset=utf-8'}));
  const link = Object.assign(document.createElement('a'), {href: url, download: BLOB_NAME});
  document.body.appendChild(link);
  link.click();
  link.remove();
  document.querySelector('#blob-state').textContent = 'Blob создан: 31 байт. Подтвердите сохранение файла.';
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

document.querySelector('#read-file').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  const state = document.querySelector('#file-state');
  const output = document.querySelector('#file-result');
  state.textContent = 'Чтение файла…';
  try {
    const result = {name: file.name, size: file.size};
    if (file.name === BLOB_NAME) {
      result.content = await file.text();
      result.matches = file.size === 31 && result.content === BLOB_TEXT;
    } else if (file.name === VIDEO_NAME) {
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      result.sha256 = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
      result.matches = file.size === 3667214 && result.sha256 === VIDEO_SHA256;
    } else {
      result.matches = false;
      result.error = 'Имя файла не соответствует ни одному эталону';
    }
    output.textContent = JSON.stringify(result, null, 2);
    state.textContent = result.matches ? 'Совпадает с эталоном' : 'Не совпадает с эталоном';
  } catch (error) {
    state.textContent = 'Ошибка чтения: ' + error.message;
    output.textContent = '';
  }
});

document.querySelector('#http-status').onclick = async () => {
  const output = document.querySelector('#http-result');
  try {
    const response = await fetch('/status', {cache: 'no-store'});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    output.textContent = JSON.stringify(await response.json(), null, 2);
  } catch (error) {
    output.textContent = error.message;
  }
};
