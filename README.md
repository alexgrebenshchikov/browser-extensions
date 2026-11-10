# Browser API Test — Manifest V3

Diagnostic extension for testing browser extension APIs in Yandex Browser on Android and desktop. Extension version: **0.2.2**.

## Original project and attribution

This repository is a Manifest V3 migration of **[yandex/browser-extensions](https://github.com/yandex/browser-extensions)**, including its **[Browser API Test extension](https://github.com/yandex/browser-extensions/tree/master/api-test-extension)**. The migration was prepared against upstream revision **[117c68024e86da840454940adbd147ab42e8b0bd](https://github.com/yandex/browser-extensions/commit/117c68024e86da840454940adbd147ab42e8b0bd)**. Original authorship, history, images and third-party notices are preserved; this fork does not imply an upstream endorsement.

The bundled jQuery 2.0.0 retains its original [MIT license notice](api-test-extension/js/jquery/jquery.js#L9). No new license is assigned to the upstream code by this migration.

## Download and install

1. Download **[browser-api-test-mv3.zip](https://github.com/ymbrocore/browser-extensions/raw/refs/heads/master/browser-api-test-mv3.zip)** and extract it on the test device. The archive contains the extension itself; `manifest.json` is at its root.
2. Alternatively, download this repository using **Code → Download ZIP**, extract it and use the **`api-test-extension`** subfolder. Do not select the repository root as the extension directory.
3. Open **`browser://extensions`** in Yandex Browser and enable **Developer mode**.
4. Choose **Load unpacked extension**. On Android, select **`manifest.json`** inside the extension folder using the file picker. On desktop, select the folder containing that file.
5. Open **Browser API Test** from the browser's extensions menu or toolbar. The diagnostic report opens in a separate extension tab.
6. Wait for automatic checks, expand the result sets you want to read, perform relevant manual checks and use **Save report** to download a self-contained HTML report. The exported HTML preserves which result sets are expanded.

Use a dedicated test profile: the suite creates and removes tabs, bookmarks, cookies, downloads and browsing history, and its manual checks can change browser data. The broad API and HTTP/HTTPS host permissions are intentional for diagnostics. An Internet connection is needed for checks against `ya.ru`.

## Migration

- Manifest version 3, `background.service_worker`, `action`, `host_permissions` and `scripting` permissions.
- DOM-free background worker; message and context-menu listeners register at startup. Report, popup and worker communicate through `chrome.runtime` messages.
- Script and stylesheet injection use `chrome.scripting`. Legacy tab queries use `tabs.query`.
- Updated navigation waits, network checks, notifications, download checks and report export. Added a manual worker stop/restart check.
- Removed MV2/legacy mechanisms are explicitly marked **SKIP**. A skipped or disabled check does not demonstrate that the corresponding API works.

The **[migration patch](manifest-v3.patch)** records changes against the upstream revision above. Source code is available in **[api-test-extension](api-test-extension)**. No build step is required.

## Discard test isolation in 0.2.2

On Android, the discard check creates a dedicated background tab, waits for it to load, and calls `tabs.discard(tab.id)`. It validates the returned tab ID and discarded state and removes the temporary tab in `finally`, including on API errors. This prevents automatic candidate selection from unloading the test runner itself. Desktop platforms retain the original `tabs.discard()` call without an ID. The Android check covers explicit-ID discard; it does not cover automatic selection without an ID or establish the cause of the Chromium 152/154 difference.

Run `node tests/discard.test.cjs` to check Android explicit targeting, result validation and cleanup, plus the original desktop call and API error handling with mocked browser APIs.

## Android compatibility in 0.2.1

On Android, ten known unsupported checks produce **SKIP** with the exact reason **`android not supported`**, before their API callbacks run:

- Tabs: `detectLanguage`, `Set-Get Zoom`, `setZoomSettings`, `getZoomSettings`.
- Sessions: `getRecentlyClosed`, `getDevices`, invalid-session-ID `restore`, and `Create-Close-GetRecent-Restore`.
- Privacy: existence and reading of `services.translationServiceEnabled`.

The platform is obtained once through `chrome.runtime.getPlatformInfo()`. On other operating systems, these checks execute their original callbacks. Other checks retain their own results and reasons; CSS, tab-count races and domain-specific content-script restrictions are not converted to Android unsupported results.

SKIP describes a known compatibility limitation; it does not demonstrate a working API. A set heading can still show Success when method-existence checks pass. Expand Tabs, Sessions and Privacy before saving to make all ten skipped rows visible in the exported HTML. Review this explicit list when browser support changes.

## Validation and known limitations

Version **0.2.1** was checked on Pixel_7, Android 14, Yandex Browser **26.10.1.68**. The automatic report contains **164 rendered HTML rows: 133 PASS, 2 FAIL, 10 WARN, 19 SKIP**. Exactly ten rows have the reason `android not supported`; the nine earlier skips retain their original reasons. The remaining failures are CSS injection and the static content-script probe on `ya.ru`. The tab create/remove check passed in this launch; no fix for its existing timing race is claimed.

Sixteen local JavaScript contract tests passed, including Android skip behavior, desktop callback execution, preservation of genuine failures, worker messages and webRequest. These checks use mocked browser APIs; they are not a new desktop browser run.

The native extension popup displayed `Messages OK`. The initial service worker response, dynamic scripting, messages/ports and the webRequest lifecycle check passed. The final HTML was saved with Tabs, Sessions and Privacy expanded, then opened in Android HTML Viewer with the results and styles preserved. All 164 result rows matched the initial export. The 39 installed source files matched the package byte for byte. Video recording was unavailable in this emulator run; the checks were verified with native UI assertions, screenshots and the original HTML exports.

### Historical validation of 0.2.0

The migrated extension was exercised in Yandex Browser on macOS and an Android 14 phone emulator. MV3 installation, worker messaging, dynamic script injection and HTML report export worked on both. Worker stop/restart was verified on both; repeated native popup openings were verified on Android.

A desktop run produced **324 automatic checks: 304 PASS, 10 WARN, 0 FAIL, 10 SKIP**. This includes API-existence checks and does not mean every user scenario passed. Exported HTML hides some successful checks, so its visible row count is not comparable to the full in-memory count.

Known issues in the current diagnostic suite:

- The manual history Delete button has a mismatched element ID/handler selector and does not execute its action.
- Some older callback checks omit `runtime.lastError` handling and can report PASS despite an asynchronous API error. For example, `downloads.setShelfEnabled` lacks the required `downloads.shelf` permission.
- Android lacks language detection, tab zoom controls and sessions; the translation privacy property is absent. Version 0.2.1 marks the ten checks listed above as SKIP. Other unsupported privacy warnings retain their existing behavior.
- Tab-count checks use short fixed waits. Android also failed the CSS and static content-script checks; the root causes of those failures have not been established. Do not treat them as confirmed platform restrictions.
- The native desktop popup was not confirmed: `action.openPopup()` returned an error, while loading `popup.html` as an extension tab succeeded. An extension tab is not a native popup check.
- Notification clicks, OS idle/lock transitions and context-menu selection need dedicated manual execution. Screen capture needs an appropriate `activeTab` grant; download pause/resume needs a sufficiently slow download.

Use the report as a diagnostic aid and inspect individual errors. The **[original published report](https://yandex.github.io/browser-extensions/)** is a historical format example, not the current MV3 result or download.

## References

- [Chrome: Migrate to Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate)
- [Update the manifest](https://developer.chrome.com/docs/extensions/develop/migrate/manifest)
- [Migrate to a service worker](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers)
- [Update extension API calls](https://developer.chrome.com/docs/extensions/develop/migrate/api-calls)
- [Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [Content scripts and match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- [Action API](https://developer.chrome.com/docs/extensions/reference/api/action)
- [Runtime API and lastError](https://developer.chrome.com/docs/extensions/reference/api/runtime#property-lastError)
- [Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms)
- [Downloads API](https://developer.chrome.com/docs/extensions/reference/api/downloads)

The Chrome documentation describes the upstream API contract. Availability and behavior must also be checked in the target Yandex Browser build and platform.

## Standalone windows.update probe

[Windows Update Probe](windows-update-probe/) is a separate offline extension for the Android empty-window regression.
[Download windows-update-probe.zip](https://github.com/ymbrocore/browser-extensions/raw/refs/heads/master/windows-update-probe.zip), extract it, and follow the [Russian installation and scenario instructions](windows-update-probe/README.md).
It schedules normal and empty-window calls with `chrome.alarms` and stores before/after JSON evidence locally.
No Node.js, server, npm dependencies or network permission is needed.
