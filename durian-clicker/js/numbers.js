/* =============================================================================
 * numbers.js — Big number type + display formatting
 * -----------------------------------------------------------------------------
 * Currency is NOT stored in a plain JS Number. Every value is a `Big`, stored as
 * a normalised mantissa/exponent pair:
 *
 *      value = m * 10^e        with 1 <= |m| < 10   (or m === 0)
 *
 * That gives ~15 significant digits at any magnitude, up to 10^(2^53). Plenty
 * for an incremental game that wants to run to "quinquagintillion" and beyond.
 *
 * Everything here is pure — no game state, no DOM.
 * ========================================================================== */
(function (DC) {
  'use strict';

  /* ---------------------------------------------------------------- Big type */

  function Big(m, e) {
    this.m = m;
    this.e = e;
  }

  function make(m, e) {
    if (!isFinite(m) || m === 0) return new Big(0, 0);
    var shift = Math.floor(Math.log10(Math.abs(m)));
    m /= Math.pow(10, shift);
    e += shift;
    // Guard against log10 rounding landing just outside [1, 10).
    if (Math.abs(m) >= 10) { m /= 10; e += 1; }
    else if (Math.abs(m) < 1) { m *= 10; e -= 1; }
    if (!isFinite(m)) return new Big(0, 0);
    return new Big(m, e);
  }

  /** Accepts a Big, a Number, a numeric string, or a serialised {m,e}. */
  function big(v) {
    if (v instanceof Big) return v;
    if (typeof v === 'number') return make(v, 0);
    if (typeof v === 'string') return make(parseFloat(v), 0);
    if (v && typeof v.m === 'number' && typeof v.e === 'number') return make(v.m, v.e);
    return new Big(0, 0);
  }

  var ZERO = new Big(0, 0);
  var ONE = new Big(1, 0);

  /* ------------------------------------------------------------- arithmetic */

  function add(a, b) {
    a = big(a); b = big(b);
    if (a.m === 0) return b;
    if (b.m === 0) return a;
    var hi = a, lo = b;
    if (b.e > a.e) { hi = b; lo = a; }
    var diff = hi.e - lo.e;
    if (diff > 17) return hi;                 // lo is below hi's precision
    return make(hi.m + lo.m / Math.pow(10, diff), hi.e);
  }

  function neg(a) { a = big(a); return new Big(-a.m, a.e); }
  function sub(a, b) { return add(a, neg(b)); }
  function mul(a, b) { a = big(a); b = big(b); if (a.m === 0 || b.m === 0) return ZERO; return make(a.m * b.m, a.e + b.e); }
  function div(a, b) { a = big(a); b = big(b); if (b.m === 0 || a.m === 0) return ZERO; return make(a.m / b.m, a.e - b.e); }

  /** 10^x for any real x — the workhorse behind exponential cost scaling. */
  function pow10(x) {
    var e = Math.floor(x);
    return make(Math.pow(10, x - e), e);
  }

  /** a ^ n, where n is a plain number. */
  function pow(a, n) {
    a = big(a);
    if (a.m === 0) return n === 0 ? ONE : ZERO;
    return pow10(log10(a) * n);
  }

  function log10(a) {
    a = big(a);
    if (a.m <= 0) return -Infinity;
    return a.e + Math.log10(a.m);
  }

  function cmp(a, b) {
    a = big(a); b = big(b);
    var sa = a.m === 0 ? 0 : (a.m > 0 ? 1 : -1);
    var sb = b.m === 0 ? 0 : (b.m > 0 ? 1 : -1);
    if (sa !== sb) return sa < sb ? -1 : 1;
    if (sa === 0) return 0;
    if (a.e !== b.e) return (a.e < b.e ? -1 : 1) * sa;
    if (a.m === b.m) return 0;
    return a.m < b.m ? -1 : 1;
  }

  function gte(a, b) { return cmp(a, b) >= 0; }
  function lt(a, b) { return cmp(a, b) < 0; }
  function max(a, b) { return cmp(a, b) >= 0 ? big(a) : big(b); }
  function clampMin(a, minVal) { return cmp(a, minVal) < 0 ? big(minVal) : big(a); }

  /**
   * Rounds up to a whole number while the value is small enough for that to be
   * exact. Prices use this so the displayed cost is the cost actually charged.
   */
  function ceil(a) {
    a = big(a);
    if (a.e >= 15 || a.m === 0) return a;
    return make(Math.ceil(toNumber(a)), 0);
  }

  /** Lossy — only for UI maths, progress bars, etc. Never for the balance. */
  function toNumber(a) {
    a = big(a);
    if (a.e > 308) return a.m > 0 ? Infinity : -Infinity;
    if (a.e < -308) return 0;
    return a.m * Math.pow(10, a.e);
  }

  /* ------------------------------------------------------- serialisation */

  function serialize(a) { a = big(a); return { m: a.m, e: a.e }; }
  function deserialize(v) { return big(v); }

  /* ------------------------------------------------------------ formatting */

  // Short-scale suffixes. Beyond the list we fall back to scientific notation.
  // Long-scale words for the 'shortened' display mode.
  var WORDS = [
    '', 'thousand', 'million', 'billion', 'trillion',
    'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion',
    'decillion', 'undecillion', 'duodecillion', 'tredecillion', 'quattuordecillion',
    'quindecillion', 'sexdecillion', 'septendecillion', 'octodecillion', 'novemdecillion',
    'vigintillion', 'unvigintillion', 'duovigintillion', 'trevigintillion',
    'quattuorvigintillion', 'quinvigintillion', 'sexvigintillion', 'septenvigintillion',
    'octovigintillion', 'novemvigintillion', 'trigintillion'
  ];

  var SUFFIXES = [
    '', 'K', 'M', 'B', 'T',
    'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No',
    'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc',
    'Vg', 'UVg', 'DVg', 'TVg', 'QaVg', 'QiVg', 'SxVg', 'SpVg', 'OcVg', 'NoVg', 'Tg'
  ];

  function withCommas(n, decimals) {
    var s = n.toFixed(decimals || 0);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  /**
   * format(value, opts)
   *   opts.decimals   — decimals to use for values below 1 (default 1)
   *   opts.threshold  — below this, print with commas instead of a suffix.
   *                     Defaults to CONFIG.formatting.suffixThreshold.
   */
  /**
   * Which display style to use. The player picks this in Settings; it is stored
   * on the save so it survives a reload.
   *   'abbreviated' — 1.25M      (default)
   *   'shortened'   — 1.25 million
   *   'full'        — 1,250,000
   */
  function mode() {
    var s = DC.Game && DC.Game.state;
    var m = s && s.settings && s.settings.numberFormat;
    if (m === 'full' || m === 'shortened' || m === 'abbreviated') return m;
    var cfg = (DC.CONFIG && DC.CONFIG.formatting) || {};
    return cfg.defaultMode || 'abbreviated';
  }

  /** Writes every digit out with thousands separators. */
  function formatFull(v) {
    if (v.e > 60) return format(v, { mode: 'abbreviated' });   // beyond readable
    // 13 decimals, not 15: a value reconstructed from log10 (as the leaderboard
    // does) carries float noise in the last digits, and 2.4999999999999996
    // would otherwise print as 2,499,999,999 instead of 2,500,000,000.
    var digits = v.m.toFixed(13).replace('.', '');
    var out;
    if (v.e >= 0) {
      out = digits.slice(0, v.e + 1);
      while (out.length < v.e + 1) out += '0';
    } else {
      return toNumber(v).toFixed(Math.min(20, -v.e + 2));
    }
    return out.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function format(value, opts) {
    opts = opts || {};
    var v = big(value);
    var cfg = (DC.CONFIG && DC.CONFIG.formatting) || {};
    var style = opts.mode || mode();
    var threshold = opts.threshold !== undefined ? opts.threshold
      : (cfg.suffixThreshold !== undefined ? cfg.suffixThreshold : 1000);

    if (v.m === 0) return '0';
    if (v.m < 0) return '-' + format(neg(v), opts);

    if (style === 'full') return formatFull(v);

    var n = toNumber(v);
    if (n < threshold) {
      if (n < 1) return n.toFixed(opts.decimals !== undefined ? opts.decimals : 2);
      if (n < 10 && !Number.isInteger(n) && opts.decimals !== 0) return n.toFixed(1);
      return withCommas(Math.floor(n));
    }

    var tier = Math.floor(v.e / 3);
    var mantissa = v.m * Math.pow(10, v.e - tier * 3);   // 1 <= mantissa < 1000
    // Rounding can push 999.97 to 1000 — bump the tier if it does.
    if (mantissa >= 999.995) { mantissa /= 1000; tier += 1; }

    // Always two decimals: 1.23 / 12.34 / 123.45. The old sliding 2/1/0 threw
    // away precision exactly as the numbers got interesting.
    var dec = 2;

    if (style === 'shortened') {
      if (tier < WORDS.length) return mantissa.toFixed(dec) + ' ' + WORDS[tier];
      return v.m.toFixed(3) + ' \u00D7 10^' + v.e;
    }
    if (tier < SUFFIXES.length) return mantissa.toFixed(dec) + SUFFIXES[tier];
    return v.m.toFixed(3) + 'e' + v.e;
  }

  /**
   * Formatting for panels, lists and modals. Full-number mode suits the big
   * counter but is unusable in a table — a 30-digit price squeezes the name
   * column down to one letter a line — so menus fall back to abbreviated.
   * 'shortened' is kept as-is, since word forms stay readable at any width.
   */
  function formatMenu(value, opts) {
    var style = mode();
    return format(value, Object.assign({}, opts || {}, {
      mode: style === 'full' ? 'abbreviated' : style
    }));
  }

  /** Rate display: "12.4/sec" style values keep a decimal while small. */
  function formatRate(value) {
    var v = big(value);
    var n = toNumber(v);
    if (n > 0 && n < 1000) return (n < 10 ? n.toFixed(2) : n.toFixed(1)).replace(/\.00$/, '');
    return format(v);
  }

  /** Seconds -> "3h 12m 04s". Used by stats and the offline popup. */
  function formatDuration(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    var d = Math.floor(seconds / 86400);
    var h = Math.floor((seconds % 86400) / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    var out = [];
    if (d) out.push(d + 'd');
    if (d || h) out.push(h + 'h');
    if (d || h || m) out.push(m + 'm');
    out.push(s + 's');
    return out.join(' ');
  }

  DC.N = {
    Big: Big, big: big, make: make,
    ZERO: ZERO, ONE: ONE,
    add: add, sub: sub, mul: mul, div: div, neg: neg,
    pow: pow, pow10: pow10, log10: log10,
    cmp: cmp, gte: gte, lt: lt, max: max, clampMin: clampMin, ceil: ceil,
    toNumber: toNumber,
    serialize: serialize, deserialize: deserialize,
    format: format, formatMenu: formatMenu, formatRate: formatRate, formatDuration: formatDuration,
    mode: mode, WORDS: WORDS, SUFFIXES: SUFFIXES,
    withCommas: withCommas
  };
})(window.DC = window.DC || {});
