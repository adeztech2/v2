import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const _jsonDefaults = () => ({
    settings: {},
    group_settings: {},
    conversation_history: [],
    sudo_users: [],
    banned_users: [],
    allowed_users: [],
    warn_data: {},
    msg_store: {},
    lid_phone: {}
});

let _jsonData = null;
let _jsonSaveTimer = null;
const _jsonPath = path.resolve('./whatsasena.json');

function _jsonFlush() {
    try { fs.writeFileSync(_jsonPath, JSON.stringify(_jsonData, null, 2)); } catch {}
}

function _jsonSave() {
    if (_jsonSaveTimer) clearTimeout(_jsonSaveTimer);
    _jsonSaveTimer = setTimeout(_jsonFlush, 400);
}

function initJson() {
    try {
        if (fs.existsSync(_jsonPath)) {
            const raw = fs.readFileSync(_jsonPath, 'utf-8');
            _jsonData = Object.assign(_jsonDefaults(), JSON.parse(raw));
        } else {
            _jsonData = _jsonDefaults();
        }
        console.log('✅ [DB] Using JSON file database (whatsasena.json)');
    } catch (e) {
        console.log('⚠️ [DB] JSON init failed:', e.message);
        throw e;
    }
}

const _GS_DEFAULTS = {
    jid: '', antidelete: 1, gcpresence: 0, events: 0, antidemote: 0, antipromote: 0,
    antilink: 'off', antistatusmention: 'off', antitag: 0, welcome: 0, goodbye: 0,
    warn_limit: 3, antiforeign: 0, custom_welcome: '', custom_goodbye: '', trusted_links: '[]',
    antisticker: 'off', antispam: 'off', antibot: 'off'
};

function _jsonOp(type, sql, params) {
    const s = (sql || '').toLowerCase().trim();
    if (s.includes('allowed_users')) {
        const arr = _jsonData.allowed_users;
        if (type === 'all') return arr.map(num => ({ num }));
        if (type === 'run' && s.includes('delete')) { const i = arr.indexOf(params[0]); if (i > -1) arr.splice(i, 1); _jsonSave(); return; }
        if (type === 'run') { if (!arr.includes(params[0])) arr.push(params[0]); _jsonSave(); return; }
    }
    if (s.includes('sudo_users')) {
        const arr = _jsonData.sudo_users;
        if (type === 'all') return arr.map(num => ({ num }));
        if (type === 'run' && s.includes('delete')) { const i = arr.indexOf(params[0]); if (i > -1) arr.splice(i, 1); _jsonSave(); return; }
        if (type === 'run') { if (!arr.includes(params[0])) arr.push(params[0]); _jsonSave(); return; }
    }
    if (s.includes('banned_users')) {
        const arr = _jsonData.banned_users;
        if (type === 'all') return arr.map(num => ({ num }));
        if (type === 'run' && s.includes('delete')) { const i = arr.indexOf(params[0]); if (i > -1) arr.splice(i, 1); _jsonSave(); return; }
        if (type === 'run') { if (!arr.includes(params[0])) arr.push(params[0]); _jsonSave(); return; }
    }
    if (s.includes('settings') && !s.includes('group_settings')) {
        if (type === 'all') { const r = []; for (const [k, v] of Object.entries(_jsonData.settings)) r.push({ key: k, value: v }); return r; }
        if (type === 'run') { _jsonData.settings[params[0]] = params[1]; _jsonSave(); return; }
    }
    if (s.includes('group_settings')) {
        if (type === 'get') {
            const gs = _jsonData.group_settings[params[0]];
            return gs ? { ..._GS_DEFAULTS, ...gs } : null;
        }
        if (type === 'run' && s.includes('insert') && params[0] && !_jsonData.group_settings[params[0]]) {
            _jsonData.group_settings[params[0]] = { ..._GS_DEFAULTS, jid: params[0] };
            _jsonSave();
        }
        return;
    }
    if (s.includes('conversation_history')) {
        if (type === 'all') {
            const num = params[0]; const lim = params[1] || 20;
            return _jsonData.conversation_history.filter(r => r.num === num).slice(-lim);
        }
        if (type === 'run' && s.includes('insert')) {
            _jsonData.conversation_history.push({ num: params[0], role: params[1], message: params[2], timestamp: Math.floor(Date.now() / 1000) });
            if (_jsonData.conversation_history.length > 2000) _jsonData.conversation_history = _jsonData.conversation_history.slice(-1000);
            _jsonSave(); return;
        }
        if (type === 'run' && s.includes('delete') && params.length === 1) {
            _jsonData.conversation_history = _jsonData.conversation_history.filter(r => r.num !== params[0]);
            _jsonSave(); return;
        }
        if (type === 'run') {
            const cutoff = params[0];
            _jsonData.conversation_history = _jsonData.conversation_history.filter(r => (r.timestamp || 0) > cutoff);
            _jsonSave(); return;
        }
    }
    if (s.includes('warn_data')) {
        const key = (params[0] || '') + '|' + (params[1] || '');
        if (type === 'get') return _jsonData.warn_data[key] !== undefined ? { warns: _jsonData.warn_data[key] } : null;
        if (type === 'run' && s.includes('delete')) { delete _jsonData.warn_data[key]; _jsonSave(); return; }
        if (type === 'run' && s.includes('insert')) { _jsonData.warn_data[key] = 1; _jsonSave(); return; }
        if (type === 'run' && s.includes('update')) { _jsonData.warn_data[key] = (_jsonData.warn_data[key] || 0) + 1; _jsonSave(); return; }
    }
    if (s.includes('msg_store')) {
        if (type === 'get') return _jsonData.msg_store[params[0]] || null;
        if (type === 'run' && s.includes('insert')) {
            _jsonData.msg_store[params[0]] = { id: params[0], jid: params[1], sender: params[2], message: params[3], timestamp: params[4] };
            const keys = Object.keys(_jsonData.msg_store);
            if (keys.length > 1000) { delete _jsonData.msg_store[keys[0]]; }
            _jsonSave(); return;
        }
        if (type === 'run' && s.includes('delete') && params.length >= 2) { delete _jsonData.msg_store[params[0]]; _jsonSave(); return; }
        if (type === 'run' && s.includes('delete')) {
            const cutoff = params[0];
            for (const [k, v] of Object.entries(_jsonData.msg_store)) { if ((v.timestamp || 0) < cutoff) delete _jsonData.msg_store[k]; }
            _jsonSave(); return;
        }
    }
    if (s.includes('lid_phone')) {
        if (type === 'get') return _jsonData.lid_phone[params[0]] ? { phone: _jsonData.lid_phone[params[0]] } : null;
        if (type === 'run' && s.includes('insert')) {
            _jsonData.lid_phone[params[0]] = params[1];
            const keys = Object.keys(_jsonData.lid_phone);
            if (keys.length > 500) { delete _jsonData.lid_phone[keys[0]]; }
            _jsonSave(); return;
        }
    }
    return type === 'all' ? [] : null;
}

let _backend = null;
let _pg = null;
let _ready = null;

const cache = {
    settings: { data: null, time: 0, ttl: 30000 },
    sudoUsers: { data: null, time: 0, ttl: 60000 },
    bannedUsers: { data: null, time: 0, ttl: 60000 },
    bannedGroups: { data: null, time: 0, ttl: 30000 },
    knownBots: { data: null, time: 0 },
    groupSettings: new Map()
};

const GS_TTL = 60000;
function isCacheValid(e) { return e.data !== null && (Date.now() - e.time) < e.ttl; }

const _settingsListeners = [];
const _sudoListeners = [];
const _bannedListeners = [];
function registerSettingsListener(fn) { _settingsListeners.push(fn); }
function registerSudoListener(fn) { _sudoListeners.push(fn); }
function registerBannedListener(fn) { _bannedListeners.push(fn); }
function _notify(list) { list.forEach(fn => { try { fn(); } catch {} }); }
function getBackend() { return _backend; }

async function tryInitPg() {
    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000,
            idleTimeoutMillis: 300000,
            max: 5,
            min: 1,
            allowExitOnIdle: false,
            keepAlive: true,
            keepAliveInitialDelayMillis: 10000
        });
        await pool.query('SELECT 1');
        _pg = pool;
        _backend = 'pg';
        return true;
    } catch (e) {
        return false;
    }
}

_ready = (async () => {
    if (process.env.DATABASE_URL) {
        const ok = await tryInitPg();
        if (!ok) {
            try { initJson(); } catch (e) { console.log('⚠️ [DB] JSON fallback failed:', e.message); }
        }
    } else {
        try { initJson(); } catch (e) { console.log('⚠️ [DB] JSON init failed:', e.message); }
    }
})();

async function ensureReady() { await _ready; }

async function qAll(sqlPg, params = []) {
    await ensureReady();
    if (_backend === 'pg') return (await _pg.query(sqlPg, params)).rows;
    return _jsonOp('all', sqlPg, params) || [];
}

async function qGet(sqlPg, params = []) {
    await ensureReady();
    if (_backend === 'pg') return (await _pg.query(sqlPg, params)).rows[0] || null;
    return _jsonOp('get', sqlPg, params) || null;
}

async function qRun(sqlPg, params = []) {
    await ensureReady();
    if (_backend === 'pg') { await _pg.query(sqlPg, params); return; }
    _jsonOp('run', sqlPg, params);
}

async function initializeDatabase() { await ensureReady(); }

async function getSettings() {
    if (isCacheValid(cache.settings)) return cache.settings.data;
    const rows = await qAll('SELECT key, value FROM settings');
    const defaults = {
        prefix: '.', mode: 'public', botname: 'ADEZ XMD', startmessage: true,
        chatbotpm: false, autoview: true, autoread: false, antidelete: false, stealth: false,
        autoai: false, toxicagent: false, anticall: false, antiviewonce: false, autolike: true
    };
    const s = { ...defaults };
    for (const r of rows) {
        try { s[r.key] = JSON.parse(r.value); } catch { s[r.key] = r.value; }
    }
    cache.settings.data = s;
    cache.settings.time = Date.now();
    return s;
}

async function updateSetting(key, value) {
    const v = JSON.stringify(value);
    await qRun(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        [key, v]
    );
    cache.settings.data = null;
    _notify(_settingsListeners);
}

async function getGroupSettingsFresh(jid) {
    cache.groupSettings.delete(jid);
    return getGroupSettings(jid);
}

async function getGroupSettings(jid) {
    const cached = cache.groupSettings.get(jid);
    if (cached && (Date.now() - cached.time) < GS_TTL) return cached.data;
    const row = await qGet('SELECT * FROM group_settings WHERE jid = $1', [jid]);
    const data = row ? {
        antidelete: !!row.antidelete, gcpresence: !!row.gcpresence, events: !!row.events,
        antidemote: !!row.antidemote, antipromote: !!row.antipromote, antilink: row.antilink || 'off',
        antistatusmention: row.antistatusmention || 'off', antitag: !!row.antitag,
        welcome: !!row.welcome, goodbye: !!row.goodbye, warn_limit: row.warn_limit || 3,
        antiforeign: !!row.antiforeign,
        custom_welcome: row.custom_welcome || '',
        custom_goodbye: row.custom_goodbye || '',
        trusted_links: row.trusted_links || '[]',
        antisticker: row.antisticker || 'off',
        antispam: row.antispam || 'off',
        antibot: (row.antibot === 'warn' || row.antibot === 'remove') ? row.antibot : (row.antibot === 1 || row.antibot === true || row.antibot === '1') ? 'warn' : 'off'
    } : {
        antidelete: true, gcpresence: false, events: false, antidemote: false, antipromote: false,
        antilink: 'off', antistatusmention: 'off', antitag: false, welcome: false, goodbye: false,
        warn_limit: 3, antiforeign: false, custom_welcome: '', custom_goodbye: '', trusted_links: '[]',
        antisticker: 'off', antispam: 'off', antibot: 'off'
    };
    cache.groupSettings.set(jid, { data, time: Date.now() });
    return data;
}

async function updateGroupSetting(jid, key, value) {
    await ensureReady();
    const _sv = (value === true || value === 'true') ? 1 : (value === false || value === 'false') ? 0 : value;
    if (_backend === 'pg') {
        await _pg.query('INSERT INTO group_settings (jid) VALUES ($1) ON CONFLICT (jid) DO NOTHING', [jid]);
        await _pg.query(`UPDATE group_settings SET ${key} = $1 WHERE jid = $2`, [_sv, jid]);
    } else {
        if (!_jsonData.group_settings[jid]) {
            _jsonData.group_settings[jid] = { ..._GS_DEFAULTS, jid };
        }
        _jsonData.group_settings[jid][key] = _sv;
        _jsonSave();
    }
    cache.groupSettings.delete(jid);
}

async function getTrustedLinks(jid) {
    const gs = await getGroupSettings(jid);
    try { return JSON.parse(gs.trusted_links || '[]'); } catch { return []; }
}

async function addTrustedLink(jid, domain) {
    const current = await getTrustedLinks(jid);
    if (!current.includes(domain)) {
        current.push(domain);
        await updateGroupSetting(jid, 'trusted_links', JSON.stringify(current));
    }
}

async function removeTrustedLink(jid, domain) {
    const current = await getTrustedLinks(jid);
    const updated = current.filter(d => d !== domain);
    await updateGroupSetting(jid, 'trusted_links', JSON.stringify(updated));
}

async function getBannedGroups() {
    if (isCacheValid(cache.bannedGroups)) return cache.bannedGroups.data;
    const row = await qGet("SELECT value FROM settings WHERE key = 'banned_groups'", []);
    let data = [];
    if (row?.value) {
        try { data = JSON.parse(row.value); } catch { data = []; }
    } else if (_backend === 'json' && _jsonData?.settings?.banned_groups) {
        try { data = JSON.parse(_jsonData.settings.banned_groups); } catch { data = []; }
    }
    if (!Array.isArray(data)) data = [];
    cache.bannedGroups.data = data;
    cache.bannedGroups.time = Date.now();
    return data;
}

async function addBannedGroup(jid) {
    const current = await getBannedGroups();
    if (!current.includes(jid)) {
        current.push(jid);
        await updateSetting('banned_groups', JSON.stringify(current));
        cache.bannedGroups.data = null;
    }
}

async function removeBannedGroup(jid) {
    const current = await getBannedGroups();
    const updated = current.filter(g => g !== jid);
    await updateSetting('banned_groups', JSON.stringify(updated));
    cache.bannedGroups.data = null;
}

async function getKnownBots() {
    if (isCacheValid(cache.knownBots)) return cache.knownBots.data;
    const row = await qGet("SELECT value FROM settings WHERE key = 'known_bots'", []);
    let data = [];
    if (row?.value) {
        try { data = JSON.parse(row.value); } catch { data = []; }
    } else if (_backend === 'json' && _jsonData?.settings?.known_bots) {
        try { data = JSON.parse(_jsonData.settings.known_bots); } catch { data = []; }
    }
    if (!Array.isArray(data)) data = [];
    cache.knownBots.data = data;
    cache.knownBots.time = Date.now();
    return data;
}

async function addKnownBot(num) {
    const current = await getKnownBots();
    if (!current.includes(num)) {
        current.push(num);
        await updateSetting('known_bots', JSON.stringify(current));
        cache.knownBots.data = null;
    }
}

async function removeKnownBot(num) {
    const current = await getKnownBots();
    const updated = current.filter(n => n !== num);
    await updateSetting('known_bots', JSON.stringify(updated));
    cache.knownBots.data = null;
}

async function banUser(num) {
    await qRun('INSERT INTO banned_users (num) VALUES ($1) ON CONFLICT DO NOTHING', [num]);
    cache.bannedUsers.data = null;
    _notify(_bannedListeners);
}

async function unbanUser(num) {
    await qRun('DELETE FROM banned_users WHERE num = $1', [num]);
    cache.bannedUsers.data = null;
    _notify(_bannedListeners);
}

async function getBannedUsers() {
    if (isCacheValid(cache.bannedUsers)) return cache.bannedUsers.data;
    const rows = await qAll('SELECT num FROM banned_users');
    const data = rows.map(r => r.num);
    cache.bannedUsers.data = data;
    cache.bannedUsers.time = Date.now();
    return data;
}

async function addSudoUser(num) {
    await qRun('INSERT INTO sudo_users (num) VALUES ($1) ON CONFLICT DO NOTHING', [num]);
    cache.sudoUsers.data = null;
    _notify(_sudoListeners);
}

async function removeSudoUser(num) {
    await qRun('DELETE FROM sudo_users WHERE num = $1', [num]);
    cache.sudoUsers.data = null;
    _notify(_sudoListeners);
}

async function getSudoUsers() {
    if (isCacheValid(cache.sudoUsers)) return cache.sudoUsers.data;
    const rows = await qAll('SELECT num FROM sudo_users');
    const data = rows.map(r => r.num);
    cache.sudoUsers.data = data;
    cache.sudoUsers.time = Date.now();
    return data;
}

async function getAllowedUsers() {
    const rows = await qAll('SELECT num FROM allowed_users');
    return rows.map(r => r.num);
}

async function addAllowedUser(num) {
    await qRun('INSERT INTO allowed_users (num) VALUES ($1) ON CONFLICT DO NOTHING', [num]);
}

async function removeAllowedUser(num) {
    await qRun('DELETE FROM allowed_users WHERE num = $1', [num]);
}

export {
    initializeDatabase, getSettings, updateSetting,
    getGroupSettings, getGroupSettingsFresh, updateGroupSetting,
    getKnownBots, addKnownBot, removeKnownBot,
    banUser, unbanUser, getBannedUsers,
    addSudoUser, removeSudoUser, getSudoUsers,
    getAllowedUsers, addAllowedUser, removeAllowedUser,
    getBackend,
    registerSettingsListener, registerSudoListener, registerBannedListener,
    getBannedGroups, addBannedGroup, removeBannedGroup
};
