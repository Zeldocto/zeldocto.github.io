/* =============================================================================
 * changelog.js — the "What's new" prompt and panel.
 * -----------------------------------------------------------------------------
 * After an update lands, a bar appears at the top offering to show what
 * changed. It is dismissed by reading it (or closing it), and the version the
 * player last read is stored in the save so they are not nagged twice.
 *
 * Content lives in js/content/changelog.js and is meant to be edited before
 * every push.
 * ========================================================================== */
(function (DC) {
  'use strict';

  function entries() { return DC.CONFIG.changelog || []; }
  function latest() { return entries()[0] || null; }

  /** True when there is an entry the player has not read yet. */
  function hasUnread() {
    var top = latest();
    if (!top) return false;
    return DC.Game.state.changelogSeen !== top.version;
  }

  function markRead() {
    var top = latest();
    if (!top) return;
    DC.Game.state.changelogSeen = top.version;
    DC.Save.save(true);
    DC.Events.emit('changelogRead', top.version);
  }

  /** Show the prompt if there is something new. Called once at boot. */
  function check() {
    if (!hasUnread()) return false;
    DC.Events.emit('changelogAvailable', latest());
    return true;
  }

  DC.Changelog = {
    entries: entries,
    latest: latest,
    hasUnread: hasUnread,
    markRead: markRead,
    check: check
  };
})(window.DC = window.DC || {});
