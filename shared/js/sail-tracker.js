/**
 * SAIL (Sandbox for AI Intervention & Labeling) Tracker — Central Data Collection Module
 * Loaded by all 6 SAIL platforms (Circl, Wave, Flow, Pixl, Buzz, Swift).
 *
 * Wrapped in try/catch so that if anything fails the feed works exactly as before.
 * Zero dependencies on platform-specific code; uses only event delegation.
 */
(function () {
  'use strict';
  try {

    // ========================================================
    // 1. SESSION MANAGEMENT — parse URL params BEFORE any
    //    platform JS calls replaceState (which strips them)
    // ========================================================
    var rawParams = new URLSearchParams(window.location.search);

    var SESSION = {
      pid:       rawParams.get('pid')       || '',
      sid:       rawParams.get('sid')       || '',
      cond:      rawParams.get('cond')      || rawParams.get('condition') || '',
      study_id:  rawParams.get('study_id')  || '',
      callback:  rawParams.get('callback')  || '',
      // Demographics
      gender:    rawParams.get('gender')    || '',
      age:       rawParams.get('age')       || '',
      politics:  rawParams.get('politics')  || '',
      issue:     rawParams.get('issue')     || '',
      // Debug
      debug:     rawParams.get('debug') === 'T' || rawParams.get('debug') === 'true',
      // Platform detected from <body data-platform="..."> or URL path
      platform:  '',
      // Timing
      start_ts:  Date.now(),
      start_iso: new Date().toISOString(),
      user_agent: navigator.userAgent,
      screen_w:  screen.width,
      screen_h:  screen.height,
      vp_w:      window.innerWidth,
      vp_h:      window.innerHeight
    };

    // Detect platform
    var body = document.body || document.documentElement;
    SESSION.platform = (body && body.getAttribute('data-platform')) || '';
    if (!SESSION.platform) {
      var path = window.location.pathname;
      var match = path.match(/\/(circl|wave|flow|pixl|buzz|swift)\//i);
      if (match) SESSION.platform = match[1].toLowerCase();
    }

    // ========================================================
    // 2. EVENT LOG — flat array, tidy data format
    // ========================================================
    var events = [];
    var FLUSH_INTERVAL_MS = 30000;  // 30 seconds
    var flushTimer = null;
    var sheetsUrl = '';
    var configLoaded = false;

    // Session-storage key for backup
    var SS_KEY = 'sail_tracker_' + (SESSION.sid || 'default') + '_' + (SESSION.pid || 'anon');

    // Restore any events from sessionStorage (survives page refresh)
    try {
      var stored = sessionStorage.getItem(SS_KEY);
      if (stored) {
        var parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) events = parsed;
      }
    } catch (_e) { /* ignore */ }

    function logEvent(eventType, data) {
      var evt = {
        pid:        SESSION.pid,
        sid:        SESSION.sid,
        cond:       SESSION.cond,
        study_id:   SESSION.study_id,
        platform:   SESSION.platform,
        timestamp:  new Date().toISOString(),
        elapsed_ms: Date.now() - SESSION.start_ts,
        event_type: eventType,
        event_data: data || {}
      };
      events.push(evt);

      // Buffer to sessionStorage
      try { sessionStorage.setItem(SS_KEY, JSON.stringify(events)); } catch (_e) { /* quota */ }

      if (SESSION.debug) {
        console.log('[SAIL Tracker]', eventType, data || '');
      }
    }

    // ========================================================
    // 3. CONFIG LOADING — sail-config.json
    // ========================================================
    function loadConfig() {
      // Try multiple possible paths depending on where we are served from
      var paths = ['../shared/sail-config.json', '/shared/sail-config.json', 'shared/sail-config.json'];
      var tried = 0;

      function tryNext() {
        if (tried >= paths.length) {
          configLoaded = true;
          if (SESSION.debug) console.log('[SAIL Tracker] No sail-config.json found — local-only mode');
          return;
        }
        var p = paths[tried++];
        fetch(p).then(function (r) {
          if (!r.ok) throw new Error(r.status);
          return r.json();
        }).then(function (cfg) {
          sheetsUrl = (cfg && cfg.google_sheets_url) || '';
          if (cfg && cfg.study_id && !SESSION.study_id) SESSION.study_id = cfg.study_id;
          configLoaded = true;
          if (SESSION.debug) console.log('[SAIL Tracker] Config loaded, Sheets URL:', sheetsUrl ? 'configured' : 'empty');
        }).catch(function () {
          tryNext();
        });
      }
      tryNext();
    }
    loadConfig();

    // ========================================================
    // 4. DATA PERSISTENCE — Google Sheets + server.py fallback
    // ========================================================
    var lastFlushedIndex = 0;

    function flush() {
      if (lastFlushedIndex >= events.length) return Promise.resolve();
      var batch = events.slice(lastFlushedIndex);
      var payload = JSON.stringify({ events: batch, session: SESSION });
      var sentIndex = events.length;

      var promises = [];

      // (a) Google Sheets
      if (sheetsUrl) {
        promises.push(
          fetch(sheetsUrl, {
            method: 'POST',
            mode: 'no-cors',  // Apps Script doesn't support CORS preflight
            headers: { 'Content-Type': 'text/plain' },  // avoid preflight
            body: payload
          }).then(function () {
            lastFlushedIndex = sentIndex;
          }).catch(function (err) {
            if (SESSION.debug) console.warn('[SAIL Tracker] Sheets flush failed:', err);
          })
        );
      }

      // (b) Local server (dev only) — silently skipped if not running
      promises.push(
        fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        }).then(function (r) {
          if (r.ok) lastFlushedIndex = sentIndex;
        }).catch(function () { /* server not running — fine */ })
      );

      return Promise.all(promises);
    }

    function beaconFlush() {
      if (lastFlushedIndex >= events.length) return;
      // Generate post_view_summary events before final flush
      generateViewSummaries();
      // Log session_end
      logEvent('session_end', {
        total_duration_ms: Date.now() - SESSION.start_ts,
        total_events: events.length,
        max_scroll_depth_pct: maxScrollDepthPct
      });

      var batch = events.slice(lastFlushedIndex);
      var payload = JSON.stringify({ events: batch, session: SESSION });

      // sendBeacon for reliability on page close
      if (sheetsUrl) {
        try { navigator.sendBeacon(sheetsUrl, payload); } catch (_e) { /* */ }
      }
      try { navigator.sendBeacon('/api/track', payload); } catch (_e) { /* */ }

      // Update sessionStorage one last time
      try { sessionStorage.setItem(SS_KEY, JSON.stringify(events)); } catch (_e) { /* */ }
    }

    // Periodic flush
    flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);

    // Emergency flush on page close / hide
    window.addEventListener('beforeunload', beaconFlush);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') beaconFlush();
    });

    // ========================================================
    // 5. VIEW TRACKING — IntersectionObserver (dual output)
    // ========================================================
    // Per-post tracking state: { post_id: { views: [{start, end, duration}], current_start, ... } }
    var viewState = {};

    function getPostId(el) {
      return el.getAttribute('data-post-id') || el.getAttribute('data-id') || el.id || '';
    }
    function getPostMeta(el) {
      return {
        post_id:      getPostId(el),
        post_type:    el.getAttribute('data-post-type') || '',
        condition_id: el.getAttribute('data-condition-id') || '',
        is_tailored:  el.getAttribute('data-is-tailored') || ''
      };
    }

    var observer = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var el = entry.target;
          var pid = getPostId(el);
          if (!pid) return;

          if (!viewState[pid]) {
            viewState[pid] = { views: [], current_start: null, first_seen: null, last_seen: null };
          }
          var st = viewState[pid];

          if (entry.isIntersecting) {
            // Post entered viewport
            var now = Date.now();
            st.current_start = now;
            if (!st.first_seen) st.first_seen = now;
            st.last_seen = now;
            logEvent('post_view_start', getPostMeta(el));
          } else if (st.current_start) {
            // Post left viewport
            var duration = Date.now() - st.current_start;
            st.views.push({ start: st.current_start, end: Date.now(), duration: duration });
            st.last_seen = Date.now();
            st.current_start = null;
            var meta = getPostMeta(el);
            meta.duration_ms = duration;
            logEvent('post_view_end', meta);
          }
        });
      }, { threshold: 0.5 }); // 50% visible counts as "in view"
    }

    function observePosts() {
      if (!observer) return;
      // Find all post elements across platforms
      var selectors = [
        '#participant-feed .post',           // Circl
        '#xf-feed-container .xf-post',       // Wave
        '#sf-feed .sf-video-card',           // Flow
        '#ig-feed .ig-post',                 // Pixl
        '#chat-messages .message',           // Buzz
        '#sm-messages-inner .sm-message',    // Swift
        '[data-post-id]'                     // Generic fallback
      ];
      var posts = document.querySelectorAll(selectors.join(','));
      posts.forEach(function (post) {
        if (!post._sailObserved) {
          post._sailObserved = true;
          observer.observe(post);
        }
      });
    }

    // Generate post_view_summary events (called at session end)
    function generateViewSummaries() {
      Object.keys(viewState).forEach(function (pid) {
        var st = viewState[pid];
        // Close any open view
        if (st.current_start) {
          var duration = Date.now() - st.current_start;
          st.views.push({ start: st.current_start, end: Date.now(), duration: duration });
          st.current_start = null;
        }
        if (st.views.length === 0) return;
        var totalDwell = st.views.reduce(function (sum, v) { return sum + v.duration; }, 0);
        logEvent('post_view_summary', {
          post_id:       pid,
          total_dwell_ms: totalDwell,
          view_count:    st.views.length,
          first_seen_at: st.first_seen ? new Date(st.first_seen).toISOString() : '',
          last_seen_at:  st.last_seen ? new Date(st.last_seen).toISOString() : ''
        });
      });
    }

    // ========================================================
    // 6. SCROLL DIRECTION TRACKING
    // ========================================================
    var lastScrollY = window.scrollY || window.pageYOffset || 0;
    var lastDirection = null;
    var maxScrollDepthPct = 0;
    var scrollThrottle = null;

    window.addEventListener('scroll', function () {
      if (scrollThrottle) return;
      scrollThrottle = setTimeout(function () {
        scrollThrottle = null;

        var y = window.scrollY || window.pageYOffset || 0;
        var dir = y > lastScrollY ? 'down' : (y < lastScrollY ? 'up' : null);

        // Track max scroll depth
        var docHeight = Math.max(
          document.body.scrollHeight || 0,
          document.documentElement.scrollHeight || 0
        );
        var vpHeight = window.innerHeight;
        if (docHeight > vpHeight) {
          var pct = Math.round(((y + vpHeight) / docHeight) * 100);
          if (pct > maxScrollDepthPct) maxScrollDepthPct = pct;
        }

        // Log only direction changes
        if (dir && dir !== lastDirection) {
          logEvent('scroll_direction_change', {
            direction: dir,
            scroll_y: Math.round(y),
            scroll_depth_pct: maxScrollDepthPct
          });
          lastDirection = dir;
        }
        lastScrollY = y;
      }, 150);  // throttle to max ~7 events/sec
    }, { passive: true });

    // ========================================================
    // 7. INTERACTION CAPTURE — event delegation on document
    // ========================================================
    function findParentPost(el) {
      // Walk up to find the post container
      var node = el;
      while (node && node !== document.body) {
        if (node.getAttribute && (node.getAttribute('data-post-id') || node.getAttribute('data-id'))) {
          return node;
        }
        // Common post container classes
        if (node.classList && (
          node.classList.contains('post') ||
          node.classList.contains('xf-post') ||
          node.classList.contains('sf-video-card') ||
          node.classList.contains('ig-post') ||
          node.classList.contains('message') ||
          node.classList.contains('sm-message')
        )) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    }

    document.addEventListener('click', function (e) {
      var target = e.target;
      var btn = target.closest ? target.closest('button, [role="button"], a') : null;
      if (!btn) return;

      var post = findParentPost(btn);
      if (!post) return;
      var meta = getPostMeta(post);

      // Detect interaction type from class names, aria-labels, or text
      var classes = (btn.className || '').toLowerCase();
      var text = (btn.textContent || '').trim().toLowerCase();
      var ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();

      // Like/Unlike
      if (classes.indexOf('like') !== -1 || ariaLabel.indexOf('like') !== -1 || text === 'like') {
        var isLiked = btn.classList.contains('liked') || btn.classList.contains('active');
        logEvent(isLiked ? 'unlike' : 'like', meta);
      }
      // Share
      else if (classes.indexOf('share') !== -1 || ariaLabel.indexOf('share') !== -1 || text === 'share') {
        logEvent('share', meta);
      }
      // Bookmark / Save
      else if (classes.indexOf('bookmark') !== -1 || classes.indexOf('save') !== -1 || ariaLabel.indexOf('bookmark') !== -1 || ariaLabel.indexOf('save') !== -1) {
        logEvent('bookmark', meta);
      }
      // Comment
      else if (classes.indexOf('comment') !== -1 || ariaLabel.indexOf('comment') !== -1 || text === 'comment') {
        logEvent('comment_click', meta);
      }
      // Article link click
      else if (btn.closest('.article-preview') || btn.classList.contains('article-preview')) {
        meta.url = btn.href || btn.getAttribute('data-url') || '';
        logEvent('article_click', meta);
      }
      // Video play
      else if (classes.indexOf('video') !== -1 || btn.closest('.video-container')) {
        var container = btn.closest('.video-container');
        if (container) {
          var isPlaying = container.classList.contains('playing');
          logEvent(isPlaying ? 'video_pause' : 'video_play', meta);
        }
      }
    }, true);  // capture phase to see all clicks

    // ========================================================
    // 8. FEED COMPLETION DETECTION — sentinel at bottom
    // ========================================================
    var feedComplete = false;
    var sentinel = document.createElement('div');
    sentinel.id = 'sail-feed-sentinel';
    sentinel.style.cssText = 'height:1px;width:100%;pointer-events:none;';

    function insertSentinel() {
      // Find the feed container
      var containers = [
        document.getElementById('experience-posts'),       // Circl
        document.getElementById('xf-feed-container'),       // Wave
        document.getElementById('sf-feed'),                 // Flow
        document.getElementById('ig-feed'),                 // Pixl
        document.getElementById('chat-messages'),           // Buzz
        document.getElementById('sm-messages-inner')        // Swift
      ];
      for (var i = 0; i < containers.length; i++) {
        if (containers[i]) {
          containers[i].appendChild(sentinel);
          return true;
        }
      }
      return false;
    }

    var sentinelObserver = null;
    var sentinelObserved = false;

    function ensureSentinelObserved() {
      if (sentinelObserver && sentinel.parentNode && !sentinelObserved) {
        sentinelObserved = true;
        sentinelObserver.observe(sentinel);
      }
    }

    if (typeof IntersectionObserver !== 'undefined') {
      sentinelObserver = new IntersectionObserver(function (entries) {
        if (entries[0] && entries[0].isIntersecting && !feedComplete) {
          feedComplete = true;
          var totalDuration = Date.now() - SESSION.start_ts;
          logEvent('feed_complete', { total_duration_ms: totalDuration });

          if (SESSION.debug) console.log('[SAIL Tracker] Feed complete! Duration:', totalDuration, 'ms');

          // Flush data then redirect if callback URL is set
          flush().then(function () {
            if (SESSION.callback) {
              var cbUrl = SESSION.callback;
              var sep = cbUrl.indexOf('?') !== -1 ? '&' : '?';
              cbUrl += sep + 'pid=' + encodeURIComponent(SESSION.pid)
                + '&duration_s=' + Math.round(totalDuration / 1000)
                + '&complete=1';
              if (SESSION.debug) {
                console.log('[SAIL Tracker] Redirecting to callback:', cbUrl);
              }
              window.location.href = cbUrl;
            }
          });
        }
      }, { threshold: 0.1 });

      // Don't insert sentinel eagerly — let the MutationObserver handle it
      // after the feed is actually populated (avoids it being wiped by innerHTML='')
      setTimeout(function () {
        if (!sentinel.parentNode) insertSentinel();
        ensureSentinelObserved();
      }, 5000);
    }

    // ========================================================
    // 9. INTERVENTION BRIDGE — pipe sailInteractionLog
    // ========================================================
    function bridgeInterventionLog() {
      var log = window.sailInteractionLog;
      if (!Array.isArray(log)) return;

      // Track how many we've already bridged
      if (!bridgeInterventionLog._idx) bridgeInterventionLog._idx = 0;
      while (bridgeInterventionLog._idx < log.length) {
        var entry = log[bridgeInterventionLog._idx++];
        logEvent('intervention_' + (entry.type || 'unknown'), {
          intervention_type: entry.type || '',
          post_id: entry.postId || '',
          duration_ms: entry.duration_ms || 0,
          details: entry
        });
      }
    }

    // Poll for new intervention events
    setInterval(bridgeInterventionLog, 2000);

    // ========================================================
    // 10. MUTATION OBSERVER — watch for dynamically added posts
    // ========================================================
    if (typeof MutationObserver !== 'undefined') {
      var mutationGuard = false;
      var feedObserver = new MutationObserver(function () {
        if (mutationGuard) return;
        mutationGuard = true;

        observePosts();
        // Move sentinel to end of feed (only if it's not already last)
        if (sentinel.parentNode) {
          if (sentinel.parentNode.lastElementChild !== sentinel) {
            sentinel.parentNode.appendChild(sentinel);
          }
        } else {
          if (insertSentinel()) {
            // Sentinel was re-inserted (e.g. after innerHTML=''), re-observe it
            sentinelObserved = false;
            ensureSentinelObserved();
          }
        }

        setTimeout(function () { mutationGuard = false; }, 0);
      });

      function startObserving() {
        var target = document.getElementById('experience-posts')
          || document.getElementById('xf-feed-container')
          || document.getElementById('sf-feed')
          || document.getElementById('ig-feed')
          || document.getElementById('chat-messages')
          || document.getElementById('sm-messages-inner')
          || document.body;

        feedObserver.observe(target, { childList: true, subtree: true });
        observePosts();
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserving);
      } else {
        startObserving();
      }
    }

    // ========================================================
    // 11. INITIAL EVENTS
    // ========================================================
    logEvent('session_start', {
      gender:     SESSION.gender,
      age:        SESSION.age,
      politics:   SESSION.politics,
      issue:      SESSION.issue,
      screen_w:   SESSION.screen_w,
      screen_h:   SESSION.screen_h,
      vp_w:       SESSION.vp_w,
      vp_h:       SESSION.vp_h,
      user_agent: SESSION.user_agent
    });

    // Log feed_loaded once DOM is ready and we can count posts
    function logFeedLoaded() {
      setTimeout(function () {
        var allPosts = document.querySelectorAll(
          '#participant-feed .post, #xf-feed-container .xf-post, #sf-feed .sf-video-card, #ig-feed .ig-post, #chat-messages .message, #sm-messages-inner .sm-message, [data-post-id]'
        );
        var stimuli = document.querySelectorAll('[data-post-type="stimulus"]');
        logEvent('feed_loaded', {
          total_posts: allPosts.length,
          stimulus_count: stimuli.length,
          filler_count: allPosts.length - stimuli.length
        });
      }, 2000); // Wait for dynamic feed loading
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', logFeedLoaded);
    } else {
      logFeedLoaded();
    }

    // ========================================================
    // 12. PUBLIC API
    // ========================================================
    window.SailTracker = {
      logEvent: logEvent,
      getSession: function () { return Object.assign({}, SESSION); },
      getEvents: function () { return events.slice(); },
      flush: flush,
      getViewState: function () { return JSON.parse(JSON.stringify(viewState)); }
    };

    if (SESSION.debug) {
      console.log('[SAIL Tracker] Initialized', SESSION);
      console.log('[SAIL Tracker] Platform:', SESSION.platform);
      console.log('[SAIL Tracker] PID:', SESSION.pid || '(none)');
      console.log('[SAIL Tracker] Condition:', SESSION.cond || '(none)');
    }

  } catch (err) {
    // If ANYTHING goes wrong, the feed must work exactly as before
    console.warn('[SAIL Tracker] Init failed (feed unaffected):', err);
  }
})();
