import { getSettings, getSudoUsers, getBannedUsers, getAllowedUsers, registerSettingsListener, registerSudoListener, registerBannedListener } from '../database/config.js';

const TTL = 300000;
const _DEFAULTS = {
    device: 'default', prefix: '.', mode: 'public', gcpresence: false, antitag: false,
    antidelete: true, antilink: 'off', chatbotpm: false, packname: 'ADEZ XMD', author: 'adeztech2',
    multiprefix: false, stealth: false, startmessage: true, autoview: false, autoai: false,
    toxicagent: false, warn_limit: 3, autobio: false, presence: 'off', autoread: false,
    autolike: true, anticall: false, antiviewonce: false
};

let _s = null, _sTime = 0, _sP = null;
let _su = null, _suTime = 0, _suP = null;
let _b = null, _bTime = 0, _bP = null;

const _TIMEOUT_MS = 300;

function _withTimeout(p, fallback) {
    return Promise.race([p, new Promise(r => setTimeout(() => r(fallback), _TIMEOUT_MS))]);
}

async function getCachedSettings() {
    const now = Date.now();
    if (_s && (now - _sTime) < TTL) return _s;
    if (_sP) return _withTimeout(_sP, _DEFAULTS);
    _sP = (async () => {
        try { _s = await _withTimeout(getSettings(), null); _sTime = Date.now(); } catch {}
        _sP = null;
        return _s || _DEFAULTS;
    })();
    return _withTimeout(_sP, _DEFAULTS);
}

async function getCachedSudo() {
    const now = Date.now();
    if (_su && (now - _suTime) < TTL) return _su;
    if (_suP) return _withTimeout(_suP, []);
    _suP = (async () => {
        try { _su = await _withTimeout(getSudoUsers(), null); _suTime = Date.now(); } catch {}
        _suP = null;
        return _su || [];
    })();
    return _withTimeout(_suP, []);
}

async function getCachedBanned() {
    const now = Date.now();
    if (_b && (now - _bTime) < TTL) return _b;
    if (_bP) return _withTimeout(_bP, []);
    _bP = (async () => {
        try { _b = await _withTimeout(getBannedUsers(), null); _bTime = Date.now(); } catch {}
        _bP = null;
        return _b || [];
    })();
    return _withTimeout(_bP, []);
}

async function getCachedAllowed() {
    return _withTimeout(getAllowedUsers(), []);
}

export { getCachedSettings, getCachedSudo, getCachedBanned, getCachedAllowed };
