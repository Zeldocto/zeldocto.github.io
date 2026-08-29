/* =============================================================================
 * leaderboard.js — online score board.
 * -----------------------------------------------------------------------------
 * A static site can't host a database, so the board talks to whichever backend
 * you point it at. Three providers ship here:
 *
 *   local     — stores entries in localStorage. Works with zero setup, but it's
 *               only ever you. This is the default so nothing is broken on a
 *               fresh clone.
 *   supabase  — free hosted Postgres with a REST API. See leaderboard-setup.sql.
 *   custom    — your own endpoints: POST submitUrl, GET fetchUrl.
 *
 * Adding a provider means adding one object to PROVIDERS with submit() and
 * fetch() methods. Nothing else in the game changes.
 *
 * SCORES ARE NOT VERIFIED. See the honesty note in README.md.
 * ========================================================================== */
(function (DC) {
  'use strict';

  var N = DC.N;
  var CONFIG = DC.CONFIG;

  var cfg = CONFIG.leaderboard;
  var state = {
    status: 'idle',        // idle | submitting | loading | ok | error | disabled
    message: '',
    entries: [],
    board: (cfg.boards[0] || {}).id,
    lastFetch: 0,
    yourRank: null
  };

  /* ------------------------------------------------------- score snapshot */

  /**
   * Big numbers don't survive a float column, so each score travels as a pair:
   * log10 for sorting (a double is precise enough to rank by) and a formatted
   * string for display.
   */
  /**
   * log10(0) is -Infinity, and JSON.stringify turns that into null — which a
   * not-null numeric column rejects outright. Values below 1 are also negative,
   * which trips the >= 0 check constraint. Floor both at 0.
   */
  function safeLog(value) {
    var l = N.log10(value);
    return (isFinite(l) && l > 0) ? l : 0;
  }

  function snapshot() {
    var s = DC.Game.state, d = DC.Game.derived;
    return {
      player_id: s.player.id,          // row key — never selected back
      public_id: s.player.publicId,    // safe to publish; identifies your row
      name: s.player.name,
      total_log: safeLog(s.totalEarned),
      // Always abbreviated: the stored string must not depend on the player's
      // own number-format setting. Clients rebuild the display from the log.
      total_display: N.format(s.totalEarned, { mode: 'abbreviated' }),
      dps_log: safeLog(d.dps),
      dps_display: N.format(d.dps, { mode: 'abbreviated' }),
      play_time: Math.round(s.playTime),
      total_clicks: s.totalClicks,
      workers: d.totalWorkers,
      achievements: d.achievementsEarned,
      updated_at: new Date().toISOString()
    };
  }

  /** Last line of defence: NaN/Infinity serialise to null and break inserts. */
  function sanitize(entry) {
    Object.keys(entry).forEach(function (k) {
      if (typeof entry[k] === 'number' && !isFinite(entry[k])) entry[k] = 0;
    });
    return entry;
  }

  /* ------------------------------------------------------------ providers */

  var PROVIDERS = {};

  /** True for Supabase's newer opaque keys, which are not JWTs. */
  function isOpaqueKey(key) {
    return /^sb_(publishable|secret)_/.test(String(key || ''));
  }

  /* -- local ------------------------------------------------------------- */

  PROVIDERS.local = {
    label: 'Local demo',
    online: false,
    key: CONFIG.saveKey + '.leaderboard',

    read: function () {
      try { return JSON.parse(localStorage.getItem(this.key)) || []; }
      catch (err) { return []; }
    },

    submit: function (entry) {
      var rows = this.read().filter(function (r) { return r.public_id !== entry.public_id; });
      rows.push(entry);
      localStorage.setItem(this.key, JSON.stringify(rows));
      return Promise.resolve({ ok: true });
    },

    fetch: function (board) {
      var rows = this.read().slice();
      rows.sort(function (a, b) { return (b[board.sortKey] || -Infinity) - (a[board.sortKey] || -Infinity); });
      return Promise.resolve(rows.slice(0, cfg.maxEntries));
    }
  };

  /* -- supabase ---------------------------------------------------------- */

  PROVIDERS.supabase = {
    label: 'Supabase',
    online: true,

    base: function () {
      var c = cfg.supabase;
      return c.url.replace(/\/+$/, '') + '/rest/v1/' + c.table;
    },

    headers: function (extra) {
      var key = cfg.supabase.anonKey;
      var h = {
        apikey: key,
        'Content-Type': 'application/json'
      };
      // Legacy anon keys are JWTs, and Supabase accepts them as a bearer token.
      // The newer sb_publishable_ / sb_secret_ keys are NOT JWTs: sending one in
      // Authorization makes the gateway try to parse it as a JWT and reject the
      // whole request with 401. Those keys go in the apikey header only.
      if (!isOpaqueKey(key)) h.Authorization = 'Bearer ' + key;
      return Object.assign(h, extra || {});
    },

    configured: function () {
      if (/^sb_secret_/.test(cfg.supabase.anonKey || '')) {
        console.error('[Durian Clicker] That is a SECRET Supabase key — it must never ship ' +
                      'in client code. Use the publishable key (sb_publishable_...) instead ' +
                      'and rotate the secret one in your Supabase dashboard.');
        return false;
      }
      return !!(cfg.supabase.url && cfg.supabase.anonKey);
    },

    submit: function (entry) {
      // Writes go through a security-definer function rather than straight at
      // the table. The function owner does the insert, so `anon` needs nothing
      // but EXECUTE — no insert/update grants, no privileges on player_id, and
      // no way to write arbitrary rows or delete anyone.
      var fn = cfg.supabase.submitFunction || 'submit_durian_score';
      var url = cfg.supabase.url.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn;
      return fetch(url, {
        method: 'POST',
        headers: this.headers({ Prefer: 'return=minimal' }),
        body: JSON.stringify({
          p_player_id: entry.player_id,
          p_public_id: entry.public_id,
          p_name: entry.name,
          p_total_log: entry.total_log,
          p_total_display: entry.total_display,
          p_dps_log: entry.dps_log,
          p_dps_display: entry.dps_display,
          p_play_time: entry.play_time,
          p_total_clicks: entry.total_clicks,
          p_workers: entry.workers,
          p_achievements: entry.achievements
        })
      }).then(function (res) {
        if (!res.ok) return res.text().then(function (t) {
          // Tag it so the caller can tell a server rejection from a dropped
          // connection — the two need different messages.
          var err = new Error(t || ('HTTP ' + res.status));
          err.serverStatus = res.status;
          throw err;
        });
        return { ok: true };
      });
    },

    // Explicit column list: player_id must never come back over the wire.
    columns: 'public_id,name,total_log,total_display,dps_log,dps_display,play_time,total_clicks,workers,achievements,updated_at',

    fetch: function (board) {
      var url = this.base() + '?select=' + this.columns +
                '&order=' + board.sortKey + '.desc&limit=' + cfg.maxEntries;
      return fetch(url, { headers: this.headers() }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      });
    },

    /** Rank when the player isn't in the visible top slice. */
    rank: function (board, value) {
      var url = this.base() + '?select=public_id&' + board.sortKey + '=gt.' + value;
      return fetch(url, { method: 'HEAD', headers: this.headers({ Prefer: 'count=exact' }) })
        .then(function (res) {
          var range = res.headers.get('content-range') || '';
          var total = parseInt(range.split('/')[1], 10);
          return isNaN(total) ? null : total + 1;
        }).catch(function () { return null; });
    }
  };

  /* -- custom ------------------------------------------------------------ */

  PROVIDERS.custom = {
    label: 'Custom endpoint',
    online: true,

    configured: function () { return !!(cfg.custom.submitUrl && cfg.custom.fetchUrl); },

    submit: function (entry) {
      return fetch(cfg.custom.submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return { ok: true };
      });
    },

    fetch: function (board) {
      var url = cfg.custom.fetchUrl + (cfg.custom.fetchUrl.indexOf('?') === -1 ? '?' : '&') +
                'board=' + encodeURIComponent(board.id) + '&limit=' + cfg.maxEntries;
      return fetch(url).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(function (data) {
        return Array.isArray(data) ? data : (data.entries || []);
      });
    }
  };

  /* --------------------------------------------------------------- helpers */

  function provider() { return PROVIDERS[cfg.provider] || PROVIDERS.local; }

  function boardDef(id) {
    id = id || state.board;
    for (var i = 0; i < cfg.boards.length; i++) if (cfg.boards[i].id === id) return cfg.boards[i];
    return cfg.boards[0];
  }

  function isEnabled() { return !!cfg.enabled; }

  function isConfigured() {
    var p = provider();
    return p.configured ? p.configured() : true;
  }

  function isOnline() { return !!provider().online; }

  function getName() { return DC.Game.state.player.name; }

  function setName(name) {
    name = String(name || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, cfg.nameMaxLength);
    DC.Game.state.player.name = name;
    DC.Events.emit('leaderboardName', name);
    return name;
  }

  /** Pulls the human-readable line out of a PostgREST error body, if there is one. */
  function serverMessage(err) {
    if (!err || !err.serverStatus) return '';   // no HTTP response = not a rejection
    var text = err.message;
    if (!text) return '';
    try {
      var body = JSON.parse(text);
      return body.message || body.hint || body.details || '';
    } catch (e) {
      return text.length > 160 ? '' : text;
    }
  }

  function setStatus(status, message) {
    state.status = status;
    state.message = message || '';
    DC.Events.emit('leaderboardStatus', state);
  }

  /* ---------------------------------------------------------------- submit */

  /**
   * Sends the current score. Resolves with { ok, reason } rather than throwing,
   * so callers never need a catch.
   */
  function submit(options) {
    options = options || {};
    if (!isEnabled()) return Promise.resolve({ ok: false, reason: 'disabled' });
    if (!isConfigured()) {
      setStatus('error', 'No leaderboard backend configured yet.');
      return Promise.resolve({ ok: false, reason: 'unconfigured' });
    }

    var s = DC.Game.state;
    if (!s.player.name) return Promise.resolve({ ok: false, reason: 'no-name' });
    if (!options.force && N.lt(s.totalEarned, cfg.minScoreToSubmit)) {
      return Promise.resolve({ ok: false, reason: 'too-low' });
    }

    var since = (Date.now() - (s.player.lastSubmit || 0)) / 1000;
    if (!options.ignoreThrottle && since < cfg.minSubmitIntervalSeconds) {
      return Promise.resolve({ ok: false, reason: 'throttled', wait: Math.ceil(cfg.minSubmitIntervalSeconds - since) });
    }

    setStatus('submitting', 'Sending your score…');
    var entry = sanitize(snapshot());

    return Promise.resolve(provider().submit(entry)).then(function () {
      DC.Game.state.player.lastSubmit = Date.now();
      setStatus('ok', 'Score submitted.');
      DC.Events.emit('leaderboardSubmitted', entry);
      return { ok: true };
    }).catch(function (err) {
      console.error('Leaderboard submit failed:', err);
      var detail = serverMessage(err);
      setStatus('error', detail
        ? 'Leaderboard rejected the score: ' + detail
        : "Couldn't reach the leaderboard. Your progress is safe — try again later.");
      return { ok: false, reason: detail ? 'rejected' : 'network', error: err, detail: detail };
    });
  }

  /* ----------------------------------------------------------------- fetch */

  function load(boardId) {
    if (!isEnabled()) return Promise.resolve([]);
    if (boardId) state.board = boardId;
    var board = boardDef(state.board);

    if (!isConfigured()) {
      setStatus('error', 'No leaderboard backend configured yet.');
      return Promise.resolve([]);
    }

    setStatus('loading', 'Loading the board…');
    return Promise.resolve(provider().fetch(board)).then(function (rows) {
      state.entries = (rows || []).map(function (r, i) {
        r.rank = i + 1;
        r.isYou = r.public_id === DC.Game.state.player.publicId;
        return r;
      });
      state.lastFetch = Date.now();
      state.yourRank = null;
      state.entries.forEach(function (r) { if (r.isYou) state.yourRank = r.rank; });

      setStatus('ok', '');
      DC.Events.emit('leaderboardLoaded', state.entries);

      // Not in the visible slice? Ask the backend where we actually sit.
      if (!state.yourRank && provider().rank && DC.Game.state.player.name) {
        var mine = snapshot()[board.sortKey];
        if (isFinite(mine)) {
          provider().rank(board, mine).then(function (rank) {
            if (rank) { state.yourRank = rank; DC.Events.emit('leaderboardLoaded', state.entries); }
          });
        }
      }
      return state.entries;
    }).catch(function (err) {
      console.error('Leaderboard fetch failed:', err);
      state.entries = [];
      setStatus('error', "Couldn't reach the leaderboard. Check back in a bit.");
      DC.Events.emit('leaderboardLoaded', []);
      return [];
    });
  }

  /* -------------------------------------------------------------- autosubmit */

  var timer = null;

  function startAutoSubmit() {
    if (!isEnabled() || !cfg.submitIntervalSeconds) return;
    stopAutoSubmit();
    timer = setInterval(function () {
      if (getName()) submit();
    }, cfg.submitIntervalSeconds * 1000);
    window.addEventListener('pagehide', function () { if (getName()) submit({ ignoreThrottle: true }); });
  }

  function stopAutoSubmit() { if (timer) { clearInterval(timer); timer = null; } }

  DC.Leaderboard = {
    state: state,
    providers: PROVIDERS,
    boards: function () { return cfg.boards; },
    boardDef: boardDef,
    snapshot: snapshot,
    isEnabled: isEnabled,
    isConfigured: isConfigured,
    isOnline: isOnline,
    providerLabel: function () { return provider().label; },
    getName: getName,
    setName: setName,
    submit: submit,
    load: load,
    startAutoSubmit: startAutoSubmit,
    stopAutoSubmit: stopAutoSubmit
  };
})(window.DC = window.DC || {});
