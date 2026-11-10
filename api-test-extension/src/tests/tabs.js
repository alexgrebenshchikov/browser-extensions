'use strict';

const EVENT_TOLERANCE_PERIOD = 1000; // ms

var tabs_test = new TestSet()
    .require("[Method Exists] tabs", methodExists(chrome, 'tabs'), { hideOnSuccess: true })

    .require("[Method Exists] getCurrent", methodExists(chrome.tabs, 'getCurrent'), { hideOnSuccess: true })
    .require("[Method Call] getCurrent", methodCall(chrome.tabs, 'getCurrent', () => {}))

    .require("[Method Exists] get", methodExists(chrome.tabs, 'get'), { hideOnSuccess: true })
    .require("[Method Call] get", () => new Promise((resolve, reject) => {
        chrome.tabs.getCurrent(tab => {
            methodCall(chrome.tabs, 'get', tab.id, () => {})().then(resolve, reject);
        });
    }), { async: true })

    .require("[Method Exists] connect", methodExists(chrome.tabs, 'connect'), { hideOnSuccess: true })
    .skip('[MV2] tabs.sendRequest', 'Replaced by tabs.sendMessage.')

    .require("[Method Exists] sendMessage", methodExists(chrome.tabs, 'sendMessage'), { hideOnSuccess: true })
    .require('[Method Exists] scripting', methodExists(chrome, 'scripting'), { hideOnSuccess: true })
    .require('[Method Exists] scripting.executeScript', methodExists(chrome.scripting, 'executeScript'))
    .require('[Check scripting.executeScript, tabs.sendMessage, tabs.connect]', () => {
        return withTestTab('https://ya.ru/?api_test=tabs', async tab => {
            await callChrome(chrome.scripting, 'executeScript', {
                target: { tabId: tab.id }, files: ['src/tests/tabs_bg.js']
            });
            const response = await callChrome(chrome.tabs, 'sendMessage', tab.id, { data: 'msg' });
            if (!response || response.data !== 'response') throw new Error('Message response did not match.');
            await new Promise((resolve, reject) => {
                const port = chrome.tabs.connect(tab.id, { name: 'api-test' });
                const timer = setTimeout(() => {
                    port.disconnect();
                    reject(new Error('Port response timed out.'));
                }, SINGLE_TEST_TIME_LIMIT);
                port.onDisconnect.addListener(() => {
                    const error = chrome.runtime.lastError;
                    clearTimeout(timer);
                    reject(new Error(error ? error.message : 'Port disconnected before responding.'));
                });
                port.onMessage.addListener(message => {
                    clearTimeout(timer);
                    if (message.data === 'response') resolve();
                    else reject(new Error('Port response did not match.'));
                    port.disconnect();
                });
                port.postMessage({ data: 'msg' });
            });
            return '';
        });
    }, { timeout: 20000 })
    .skip('[MV2] getSelected and getAllInWindow', 'Replaced by tabs.query.')
    .require('[Query active tab]', async () => {
        const tabs = await callChrome(chrome.tabs, 'query', { active: true, currentWindow: true });
        if (tabs.length !== 1 || !tabs[0].active) throw new Error('Expected one active tab.');
        return '';
    })
    .require('[Query current window]', async () => {
        const tabs = await callChrome(chrome.tabs, 'query', { currentWindow: true });
        if (!tabs.length) throw new Error('Current window contains no tabs.');
        return '';
    })

    .require("[Method Exists] create", methodExists(chrome.tabs, 'create'), { hideOnSuccess: true })
    .require("[Method Call] create", methodCall(chrome.tabs, 'create', {
        url: "http://single_tab_test/",
        active: false
    }))
    .require("[Check Created Tab]", () => new Promise((resolve, reject) => {
        try {
            let resolved = false;
            chrome.windows.getAll({populate: true}, windows => {
                windows.reduce((chain_0, window_) => {
                    return chain_0.then(() => new Promise(resolve_0 => {
                        window_.tabs.reduce((chain_1, tab) => {
                            return chain_1.then(() => new Promise(resolve_1 => {
                                if ((tab.url || tab.pendingUrl) == "http://single_tab_test/") {
                                    chrome.tabs.remove(tab.id);
                                    resolve('');
                                    resolved = true;
                                }
                                resolve_1();
                            }));
                        }, Promise.resolve()).then(() => {
                            resolve_0();
                        });
                    }));
                }, Promise.resolve()).then(() => {
                    if (!resolved) reject("Created tab not found.");
                });
            });
        } catch(e) {
            reject("Exception: " + e);
        }
    }), { async: true })

    .require("[Method Exists] duplicate", methodExists(chrome.tabs, 'duplicate'), { hideOnSuccess: true })

    .require("[Create and Remove Tabs]", () => {
        return new Promise((resolve, reject) => {
            try {
                const TabsNum = 1;
                let cnt = TabsNum;

                new Promise(resolve_2 => {
                    for (cnt = TabsNum; cnt != 0; --cnt) {
                        chrome.tabs.create({url: "http://chrome_tabs_test/", active: false});
                    }
                    setTimeout(() => {
                        resolve_2();
                    }, 100);
                }).then(() => {
                    chrome.windows.getAll({populate: true}, windows => {
                        windows.reduce((chain_0, window_) => {
                            return chain_0.then(() => new Promise(resolve_0 => {
                                window_.tabs.reduce((chain_1, tab) => {
                                    return chain_1.then(() => new Promise(resolve_1 => {
                                        if ((tab.url || tab.pendingUrl) == "http://chrome_tabs_test/") {
                                            cnt++;
                                            chrome.tabs.remove(tab.id);
                                        }
                                        resolve_1();
                                    }));
                                }, Promise.resolve()).then(() => {
                                    resolve_0()
                                });
                            }));
                        }, Promise.resolve()).then(() => {
                            if (cnt != TabsNum) {
                                reject("Expected number of tabs: " + TabsNum + ", found: " + cnt);
                                return;
                            }

                            cnt = 0;
                            chrome.windows.getAll({populate: true}, windows => {
                                windows.reduce((chain_0, window_) => {
                                    return chain_0.then(() => new Promise(resolve_0 => {
                                        window_.tabs.reduce((chain_1, tab) => {
                                            return chain_1.then(() => new Promise(resolve_1 => {
                                                if ((tab.url || tab.pendingUrl) == "http://chrome_tabs_test/") {
                                                    cnt++;
                                                }
                                                resolve_1();
                                            }));
                                        }, Promise.resolve()).then(() => {
                                            resolve_0();
                                        });
                                    }));
                                }, Promise.resolve()).then(() => {
                                    if (cnt == 0) {
                                        resolve('');
                                    } else {
                                        reject('There is still tabs left after remove: ' + cnt + " tabs.");
                                    }
                                });
                            });
                        });
                    });
                });
            } catch(e) {
                reject("Exception: " + e);
            }
        });
    }, { async: true })

    .report_ready(() => {
        chrome.tabs.getCurrent(tab => {
            chrome.tabs.update(tab.id, {active: true});
        });
    })

    .require("[Method Exists] query", methodExists(chrome.tabs, 'query'), { hideOnSuccess: true })
    .require("[Method Call] query", methodCall(chrome.tabs, 'query', {}, () => {}))

    .require("[Method Exists] highlight", methodExists(chrome.tabs, 'highlight'), { hideOnSuccess: true })
    //.require("[Method Call] highlight", methodCall(chrome.tabs, 'highlight', { tabs: [] }, () => {}))
    .suggest("[Method Call] highlight {causes crash on mobile}", () => "Test disabled") // TODO: Return test after fix

    .require("[Method Exists] move", methodExists(chrome.tabs, 'move'), { hideOnSuccess: true })
    .require("[Method Call] move", () => new Promise((resolve, reject) => {
        chrome.tabs.getCurrent(tab => {
            methodCall(chrome.tabs, 'move', tab.id, { index: -1 }, () => {})().then(resolve, reject);
        });
    }), { async: true })

    .require("[Method Exists] reload", methodExists(chrome.tabs, 'reload'), { hideOnSuccess: true })
    .require("[Method Call] reload", () => new Promise (resolve => {
        chrome.tabs.create({ url: "http://ya.ru" }, tab => {
            chrome.tabs.reload(tab.id, () => {
                resolve('');
                chrome.tabs.remove(tab.id, () => {});
            });
        });
    }), { async: true })

    .require("[Method Exists] update", methodExists(chrome.tabs, 'update'), { hideOnSuccess: true })
    .require("[Method Call] update", () => new Promise((resolve, reject) => {
        chrome.tabs.getCurrent(tab => {
            methodCall(chrome.tabs, 'update', tab.id, {}, () => {})().then(resolve, reject);
        });
    }), { async: true })

    .require("[Method Exists] detectLanguage", methodExists(chrome.tabs, 'detectLanguage'), { hideOnSuccess: true })
    .require("[Method Call] detectLanguage", skipOnAndroid(methodCall(chrome.tabs, 'detectLanguage', () => {})))

    .require("[Method Exists] captureVisibleTab", methodExists(chrome.tabs, 'captureVisibleTab'),
        { hideOnSuccess: true })
    .skip('[Capture visible tab]', 'Requires a controlled activeTab grant from invoking the extension on the captured page.')

    .require('[Method Exists] scripting.insertCSS', methodExists(chrome.scripting, 'insertCSS'),
        { hideOnSuccess: true })
    .require('[Method Exists] scripting.removeCSS', methodExists(chrome.scripting, 'removeCSS'),
        { hideOnSuccess: true })
    .require('[Insert-Remove CSS]', () => {
        return withTestTab('https://ya.ru/?api_test=css', async tab => {
            const target = { tabId: tab.id };
            const readOutline = () => callChrome(chrome.scripting, 'executeScript', {
                target,
                func: () => {
                    const style = getComputedStyle(document.body);
                    return [style.outlineWidth, style.outlineColor].join(' ');
                }
            }).then(results => results[0].result);
            const original = await readOutline();
            const injection = { target, css: 'body { outline: 7px solid rgb(1, 2, 3) !important; }' };
            try {
                await callChrome(chrome.scripting, 'insertCSS', injection);
                if (await readOutline() !== '7px rgb(1, 2, 3)') throw new Error('CSS was not applied.');
            } finally {
                await callChrome(chrome.scripting, 'removeCSS', injection);
            }
            if (await readOutline() !== original) throw new Error('CSS was not removed.');
            return '';
        });
    }, { timeout: 20000 })

    .require("[Method Exists] setZoom", methodExists(chrome.tabs, 'setZoom'), { hideOnSuccess: true })
    .require("[Method Exists] getZoom", methodExists(chrome.tabs, 'getZoom'), { hideOnSuccess: true })

    .require("[Set-Get Zoom]", skipOnAndroid(() => new Promise((resolve, reject) => {
        let zoom = 0;
        chrome.tabs.getZoom(zoom_ => {
            zoom = zoom_;
            chrome.tabs.setZoom(2.0, () => {
                setTimeout(() => {
                    chrome.tabs.getZoom(zoom_ => {
                        if (zoom_ == 2.0) {
                            resolve('');
                            chrome.tabs.setZoom(zoom, () => {});
                        } else {
                            reject("Zoom wasn't set correctly");
                        }
                    })
                }, 500);
            })
        });
    })), { async: true })

    .require("[Method Exists] setZoomSettings", methodExists(chrome.tabs, 'setZoomSettings'), { hideOnSuccess: true })
    .require("[Method Call] setZoomSettings", skipOnAndroid(methodCall(chrome.tabs, 'setZoomSettings', {}, () => {})))

    .require("[Method Exists] getZoomSettings", methodExists(chrome.tabs, 'getZoomSettings'), { hideOnSuccess: true })
    .require("[Method Call] getZoomSettings", skipOnAndroid(methodCall(chrome.tabs, 'getZoomSettings', () => {})))

    // Beta
    .suggest("[Method Exists] discard", methodExists(chrome.tabs, 'discard'), { hideOnSuccess: true })
    .suggest("[Method Call] discard", async () => {
        if (!platformInfoPromise) {
            platformInfoPromise = callChrome(chrome.runtime, 'getPlatformInfo');
        }
        const platformInfo = await platformInfoPromise;
        if (platformInfo.os !== 'android') {
            return methodCall(chrome.tabs, 'discard', () => {})();
        }
        // Discard a dedicated tab so the test cannot unload its own runner.
        return withTestTab('https://ya.ru/?api_test=discard', async tab => {
            const discardedTab = await callChrome(chrome.tabs, 'discard', tab.id);
            if (!discardedTab || discardedTab.id !== tab.id || !discardedTab.discarded) {
                throw new Error('The requested test tab was not discarded.');
            }
            return '';
        });
    }, { timeout: 20000 })

    .require("[Event onCreated]", () => {
        return new Promise((resolve, reject) => {
            let resolved = false;

            let listener = function(tab) {
                if ((tab.url || tab.pendingUrl) == "http://on_created_tab_test/") {
                    chrome.tabs.onCreated.removeListener(listener);
                    resolved = true;
                    chrome.tabs.remove(tab.id);
                    resolve('');
                }
            };

            chrome.tabs.onCreated.addListener(listener);

            chrome.tabs.create({
                url: "http://on_created_tab_test/",
                active: false
            }, () => {
                setTimeout(() => {
                    if (!resolved) {
                        reject("Event onCreated wasn't fired");
                    }
                }, EVENT_TOLERANCE_PERIOD);
            });
        });
    }, { async: true })

    .require("[Event onUpdated]", () => {
        return new Promise((resolve, reject) => {
            let resolved = false;

            let listener = function (id, info, tab) {
                if ((tab.url || tab.pendingUrl) == "http://on_updated_tab_test/#") {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolved = true;
                    chrome.tabs.remove(id);
                    resolve('');
                }
            };

            chrome.tabs.onUpdated.addListener(listener);

            chrome.tabs.create({
                url: "http://on_updated_tab_test/",
                active: false
            }, tab => {
                chrome.tabs.update(tab.id, {
                    url: "http://on_updated_tab_test/#"
                }, () => {
                    setTimeout(() => {
                        if (!resolved) {
                            reject("Event onUpdated wasn't fired");
                        }
                    }, EVENT_TOLERANCE_PERIOD);
                });
            });
        });
    }, { async: true })

    .manual('tabs-on-moved-test', "Move current tab within the window")
    .report_ready(() => {
        let listener = function (id, info) {
            chrome.tabs.getCurrent(tab => {
                if (tab.id == id) {
                    chrome.tabs.onMoved.removeListener(listener);
                    doneManualTest('tabs-on-moved-test');
                }
            });
        };

        chrome.tabs.onMoved.addListener(listener);
    })

    .require("[Event onActivated]", () => new Promise((resolve, reject) => {
        let resolved = false;

        chrome.tabs.create({
            url: "http://on_activated_tab_test/",
            active: false
        }, tab => {
            let listener = function (info) {
                if (info.tabId == tab.id) {
                    chrome.tabs.onActivated.removeListener(listener);
                    resolved = true;
                    chrome.tabs.remove(info.tabId);
                    resolve('');
                }
            };

            chrome.tabs.onActivated.addListener(listener);

            chrome.tabs.update(tab.id, { active: true }, () => {
                setTimeout(() => {
                    if (!resolved) {
                        reject("Event onActivated wasn't fired")
                    }
                }, EVENT_TOLERANCE_PERIOD);
            });
        });
    }), { async: true })

    .require("[Event onRemoved]", () => new Promise((resolve, reject) => {
        let resolved = false;

        chrome.tabs.create({
            url: "http://on_removed_tab_test/",
            active: false
        }, tab => {
            let listener = function (id, info) {
                if (id == tab.id) {
                    chrome.tabs.onRemoved.removeListener(listener);
                    resolved = true;
                    resolve('');
                }
            };

            chrome.tabs.onRemoved.addListener(listener);

            chrome.tabs.remove(tab.id, () => {
                setTimeout(() => {
                    if (!resolved) {
                        reject("Event onRemove wasn't fired");
                    }
                }, EVENT_TOLERANCE_PERIOD);
            });
        })

    }), { async: true });
