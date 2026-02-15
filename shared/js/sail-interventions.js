/**
 * SAIL (Sandbox for AI Intervention & Labeling) Interventions Module
 * -------------------------
 * Shared AI-content Labeling interventions for social media platform simulators.
 * Loaded AFTER platform-specific JS on: Circl, Wave, Flow, Pixl, Buzz, Swift.
 *
 * Reads URL parameters and injects labeling interventions into stimulus posts
 * (posts with data-post-type="stimulus") only.
 *
 * Completely inert when no intervention parameters are present.
 */
(function SailInterventions() {
  'use strict';

  // ============================================================
  // 1. CONFIGURATION & URL PARAMETER PARSING
  // ============================================================

  var params = new URLSearchParams(window.location.search);

  /** Read a single URL param, returning null if absent. */
  function p(key) {
    return params.get(key);
  }

  var config = {
    // Badge
    label_badge:            p('label_badge'),
    label_badge_pos:        p('label_badge_pos') || 'header',
    label_badge_color:      p('label_badge_color') || 'blue',
    label_badge_text_color: p('label_badge_text_color') || null,
    label_badge_icon:       p('label_badge_icon') || null,
    label_badge_font_size:  p('label_badge_font_size') || null,
    label_badge_radius:     p('label_badge_radius') || null,
    label_badge_opacity:    p('label_badge_opacity') || null,
    label_badge_x_pct:     p('label_badge_x_pct') != null ? parseFloat(p('label_badge_x_pct')) : null,
    label_badge_y_pct:     p('label_badge_y_pct') != null ? parseFloat(p('label_badge_y_pct')) : null,
    label_badge_w_pct:     p('label_badge_w_pct') != null ? parseFloat(p('label_badge_w_pct')) : null,
    label_badge_h_pct:     p('label_badge_h_pct') != null ? parseFloat(p('label_badge_h_pct')) : null,
    // Interstitial
    interstitial:               p('interstitial') === 'on',
    interstitial_text:          p('interstitial_text') || 'This content may contain AI-generated material. Please review with care.',
    interstitial_icon:          p('interstitial_icon') || null,
    interstitial_btn_text:      p('interstitial_btn_text') || 'Continue',
    interstitial_overlay_opacity: p('interstitial_overlay_opacity') || null,
    interstitial_blur:          p('interstitial_blur') || null,
    // Provenance
    provenance:              p('provenance') === 'on',
    provenance_model:        p('provenance_model') || 'AI Language Model',
    provenance_date:         p('provenance_date') || '2025',
    provenance_bg:           p('provenance_bg') || null,
    provenance_trigger_style: p('provenance_trigger_style') || 'circle',
    // Nudge
    nudge:              p('nudge'),  // "share", "like", "both", or null
    nudge_text:         p('nudge_text') || null,
    nudge_proceed_text: p('nudge_proceed_text') || null,
    nudge_cancel_text:  p('nudge_cancel_text') || 'Cancel',
    nudge_icon:         p('nudge_icon') || null,
    // Community Notes
    community_notes:        p('community_notes') === 'on',
    community_notes_text:   p('community_notes_text') || 'Readers added context they thought people might want to know. This content may contain AI-generated or misleading information.',
    community_notes_title:  p('community_notes_title') || 'Readers added context',
    community_notes_bg:     p('community_notes_bg') || null,
    community_notes_border: p('community_notes_border') || null,
    community_notes_rate_show: p('community_notes_rate_show') !== 'off',
    // AI Icon
    ai_icon:            p('ai_icon'),  // "full", "assisted", or null
    ai_icon_label:      p('ai_icon_label') || null,
    ai_icon_icon:       p('ai_icon_icon') || null,
    ai_icon_pos:        p('ai_icon_pos') || null,
    ai_icon_bg:         p('ai_icon_bg') || null,
    ai_icon_text_color: p('ai_icon_text_color') || null,
    ai_icon_x_pct:     p('ai_icon_x_pct') != null ? parseFloat(p('ai_icon_x_pct')) : null,
    ai_icon_y_pct:     p('ai_icon_y_pct') != null ? parseFloat(p('ai_icon_y_pct')) : null,
    ai_icon_w_pct:     p('ai_icon_w_pct') != null ? parseFloat(p('ai_icon_w_pct')) : null,
    ai_icon_h_pct:     p('ai_icon_h_pct') != null ? parseFloat(p('ai_icon_h_pct')) : null,
    // Experiment
    condition:         p('condition') || '',
    // Debug
    debug:             p('debug') === 'T' || p('debug') === 'true' || p('debug') === '1'
  };

  // Determine which interventions are active
  var activeInterventions = [];
  function rebuildActiveList() {
    activeInterventions.length = 0;
    if (config.label_badge)      activeInterventions.push('label_badge');
    if (config.interstitial)     activeInterventions.push('interstitial');
    if (config.provenance)       activeInterventions.push('provenance');
    if (config.nudge)            activeInterventions.push('nudge');
    if (config.community_notes)  activeInterventions.push('community_notes');
    if (config.ai_icon)          activeInterventions.push('ai_icon');
  }
  rebuildActiveList();

  // Designer mode flag — keep module alive for postMessage even if nothing active
  var isDesignerMode = params.get('mode') === 'designer';

  // Early exit: if nothing is active AND not in designer mode, do nothing at all
  if (activeInterventions.length === 0 && !isDesignerMode) {
    return;
  }

  // ============================================================
  // 2. INTERACTION LOG
  // ============================================================

  window.sailInteractionLog = {
    condition: config.condition,
    interventions_active: activeInterventions.slice(),
    events: []
  };

  function logEvent(type, data) {
    var entry = Object.assign({ type: type, timestamp: new Date().toISOString() }, data || {});
    window.sailInteractionLog.events.push(entry);
    if (config.debug) {
      console.log('[SAIL]', type, data || '');
    }
  }

  // ============================================================
  // 3. PLATFORM DETECTION & SELECTORS
  // ============================================================

  /**
   * Detect which platform we are on by checking for a known root element.
   * Returns a platform key or null.
   */
  function detectPlatform() {
    if (document.querySelector('#participant-feed'))             return 'circl';
    if (document.querySelector('#xf-feed-container'))            return 'chirp';
    if (document.querySelector('#sf-feed'))                      return 'flow';
    if (document.querySelector('#ig-feed'))                      return 'pixl';
    if (document.querySelector('#chat-messages'))                return 'buzz';
    if (document.querySelector('#sm-messages-inner'))            return 'swift';
    return null;
  }

  /** Selector maps per platform. */
  var SELECTORS = {
    circl: {
      post:        'article.post[data-post-type]',
      feedContainer: '#experience-posts',
      header:      '.post-header',
      media:       '.post-media, .post-content',
      footer:      '.post-actions',
      likeBtn:     '.like-btn',
      shareBtn:    '.share-btn',
      commentBtn:  '.comment-btn'
    },
    chirp: {
      post:        'article.xf-tweet[data-post-type]',
      feedContainer: '#xf-feed-container',
      header:      '.xf-tweet-header',
      media:       '.xf-tweet-media',
      footer:      '.xf-tweet-engagement',
      likeBtn:     '.xf-like',
      shareBtn:    '.xf-share',
      retweetBtn:  '.xf-retweet'
    },
    flow: {
      post:        'div.sf-card[data-post-type]',
      feedContainer: '#sf-feed',
      header:      '.sf-card-bottom',
      media:       '.sf-card-bg',
      footer:      '.sf-actions',
      likeBtn:     '.sf-like-action'
    },
    pixl: {
      post:        'article.ig-post[data-post-type]',
      feedContainer: '#ig-feed',
      header:      '.ig-post-header',
      media:       '.ig-post-media',
      footer:      '.ig-post-actions',
      likeBtn:     '.ig-like-btn',
      shareBtn:    '.ig-share-btn',
      commentBtn:  '.ig-comment-btn'
    },
    buzz: {
      post:        'div.message-wrapper[data-post-type]',
      feedContainer: '#chat-messages',
      header:      '.message-sender',
      media:       '.message-link-preview',
      footer:      '.message-bubble'
    },
    swift: {
      post:        'div.sm-message[data-post-type]',
      feedContainer: '#sm-messages-inner',
      header:      '.sm-forward-header',
      media:       '.sm-message-media',
      footer:      '.sm-message-footer'
    }
  };

  // Styles are loaded externally via shared/css/sail-interventions.css

  // ============================================================
  // 5. HELPER UTILITIES
  // ============================================================

  /** Map named colors to hex values for badge. */
  function resolveColor(colorParam) {
    var colorMap = {
      blue:   '#1D9BF0',
      red:    '#E0245E',
      orange: '#F59E0B',
      gray:   '#71767B',
      grey:   '#71767B'
    };
    if (colorMap[colorParam]) return colorMap[colorParam];
    // Allow custom hex (URL-encoded #)
    if (colorParam && colorParam.charAt(0) === '#') return colorParam;
    return colorMap.blue;
  }

  /** Find a zone element inside a post, using platform selectors and fallbacks. */
  function findZone(postEl, zone, platformKey) {
    var sel = SELECTORS[platformKey];
    if (!sel) return null;

    var selectorStr = sel[zone];
    if (!selectorStr) return null;

    // Some selectors are comma-separated; try each
    var parts = selectorStr.split(',');
    for (var i = 0; i < parts.length; i++) {
      var el = postEl.querySelector(parts[i].trim());
      if (el) return el;
    }
    return null;
  }

  /**
   * Get post ID from a post element's data attribute.
   */
  function getPostId(postEl) {
    return postEl.dataset.postId || 'unknown';
  }

  // ============================================================
  // 6. INTERVENTION IMPLEMENTATIONS
  // ============================================================

  // ------ (a) Inline Disclosure Badge ------

  function applyBadge(postEl, platformKey) {
    if (!config.label_badge) return;
    if (postEl.querySelector('.sail-badge')) return; // already applied

    var badge = document.createElement('span');
    badge.className = 'sail-badge';
    badge.style.background = resolveColor(config.label_badge_color);
    if (config.label_badge_text_color) badge.style.color = config.label_badge_text_color;
    if (config.label_badge_font_size) badge.style.fontSize = config.label_badge_font_size + 'px';
    if (config.label_badge_radius) badge.style.borderRadius = config.label_badge_radius + 'px';
    if (config.label_badge_opacity) badge.style.opacity = config.label_badge_opacity;

    var iconClass = config.label_badge_icon || 'fas fa-info-circle';
    badge.innerHTML = '<i class="' + iconClass + '"></i> ' + config.label_badge.replace(/\+/g, ' ');

    var position = config.label_badge_pos;

    // Absolute positioning mode (from designer canvas drag-and-drop)
    if (config.label_badge_x_pct != null && config.label_badge_y_pct != null) {
      badge.classList.add('sail-badge-absolute');
      badge.style.position = 'absolute';
      badge.style.left = config.label_badge_x_pct + '%';
      badge.style.top = config.label_badge_y_pct + '%';
      badge.style.zIndex = '15';
      // Apply designer-specified size via CSS transform scale
      if (config.label_badge_w_pct && config.label_badge_h_pct) {
        // Scale the badge proportionally based on width ratio to default
        badge.style.transformOrigin = 'top left';
        // We store the effective size as a percentage of the container;
        // compute a scale factor by comparing to the badge's natural width later
        badge.style.width = config.label_badge_w_pct + '%';
        badge.style.whiteSpace = 'nowrap';
      }
      // Ensure parent post is positioned
      var compPos = window.getComputedStyle(postEl).position;
      if (compPos === 'static') postEl.style.position = 'relative';
      postEl.appendChild(badge);
      return;
    }

    if (position === 'media') {
      badge.classList.add('sail-badge-media');
      var mediaZone = findZone(postEl, 'media', platformKey);
      if (mediaZone) {
        // Ensure the media container is position:relative for absolute positioning
        var computedPos = window.getComputedStyle(mediaZone).position;
        if (computedPos === 'static') {
          mediaZone.style.position = 'relative';
        }
        mediaZone.appendChild(badge);
      } else {
        // Fallback: prepend to post
        badge.classList.remove('sail-badge-media');
        badge.classList.add('sail-badge-header');
        postEl.insertBefore(badge, postEl.firstChild);
      }
    } else if (position === 'footer') {
      badge.classList.add('sail-badge-footer');
      var footerZone = findZone(postEl, 'footer', platformKey);
      if (footerZone) {
        footerZone.parentNode.insertBefore(badge, footerZone.nextSibling);
      } else {
        postEl.appendChild(badge);
      }
    } else {
      // Default: header
      badge.classList.add('sail-badge-header');
      var headerZone = findZone(postEl, 'header', platformKey);
      if (headerZone) {
        headerZone.parentNode.insertBefore(badge, headerZone.nextSibling);
      } else {
        postEl.insertBefore(badge, postEl.firstChild);
      }
    }
  }

  // ------ (b) Interstitial Screen ------

  var interstitialDismissed = new Set();

  function applyInterstitial(postEl, platformKey) {
    if (!config.interstitial) return;

    var postId = getPostId(postEl);
    if (interstitialDismissed.has(postId)) return;
    if (postEl.dataset.sailInterstitialBound) return;
    postEl.dataset.sailInterstitialBound = 'true';

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting && !interstitialDismissed.has(postId)) {
          observer.disconnect();
          showInterstitial(postEl, postId, platformKey);
        }
      });
    }, { threshold: 0.3 });

    observer.observe(postEl);
  }

  function showInterstitial(postEl, postId, platformKey) {
    if (interstitialDismissed.has(postId)) return;

    var shownTime = Date.now();
    logEvent('interstitial_shown', { postId: postId });

    // Wrap existing children in a blurred container
    // We clone into a wrapper to avoid breaking platform event listeners
    var children = Array.prototype.slice.call(postEl.children);

    // Create content wrapper
    var contentWrap = document.createElement('div');
    contentWrap.className = 'sail-interstitial-blur';
    if (config.interstitial_blur) contentWrap.style.filter = 'blur(' + config.interstitial_blur + 'px)';
    children.forEach(function(child) {
      contentWrap.appendChild(child);
    });
    postEl.appendChild(contentWrap);

    // Ensure post is positioned
    var postPos = window.getComputedStyle(postEl).position;
    if (postPos === 'static') {
      postEl.style.position = 'relative';
    }

    // Create overlay
    var overlay = document.createElement('div');
    overlay.className = 'sail-interstitial-overlay';
    if (config.interstitial_overlay_opacity) overlay.style.background = 'rgba(0,0,0,' + config.interstitial_overlay_opacity + ')';

    var intIconClass = config.interstitial_icon || 'fas fa-exclamation-triangle';
    overlay.innerHTML =
      '<div class="sail-interstitial-icon"><i class="' + intIconClass + '"></i></div>' +
      '<div class="sail-interstitial-text">' + config.interstitial_text + '</div>' +
      '<button class="sail-interstitial-btn">' + config.interstitial_btn_text + '</button>';

    postEl.appendChild(overlay);

    var continueBtn = overlay.querySelector('.sail-interstitial-btn');
    continueBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();

      interstitialDismissed.add(postId);

      var dismissTime = Date.now();
      logEvent('interstitial_dismissed', {
        postId: postId,
        timeToAction: dismissTime - shownTime
      });

      // Animate out
      contentWrap.classList.add('sail-interstitial-blur-cleared');
      overlay.classList.add('sail-fade-out');

      setTimeout(function() {
        // Move children back to post root and remove wrapper
        var wrappedChildren = Array.prototype.slice.call(contentWrap.children);
        wrappedChildren.forEach(function(child) {
          postEl.insertBefore(child, contentWrap);
        });
        contentWrap.remove();
        overlay.remove();
      }, 450);
    });
  }

  // ------ (c) Provenance Panel ------

  function applyProvenance(postEl, platformKey) {
    if (!config.provenance) return;
    if (postEl.querySelector('.sail-provenance-trigger')) return;

    var postId = getPostId(postEl);

    // Create trigger button
    var trigger = document.createElement('button');
    trigger.className = 'sail-provenance-trigger';
    trigger.innerHTML = 'i';
    trigger.setAttribute('aria-label', 'View provenance information');
    trigger.title = 'Content provenance';

    // Create panel
    var panel = document.createElement('div');
    panel.className = 'sail-provenance-panel';
    if (config.provenance_bg) panel.style.background = config.provenance_bg;

    var conditionId = postEl.dataset.conditionId || '';
    var gridRows =
      '<span class="sail-provenance-label">AI Model</span><span>' + config.provenance_model + '</span>' +
      '<span class="sail-provenance-label">Created</span><span>' + config.provenance_date + '</span>' +
      '<span class="sail-provenance-label">Type</span><span>AI-Generated Content</span>' +
      (conditionId ? '<span class="sail-provenance-label">Category</span><span>' + conditionId + '</span>' : '');

    panel.innerHTML =
      '<div class="sail-provenance-title">' +
        '<span><i class="fas fa-shield-halved"></i> Content Provenance</span>' +
        '<button class="sail-provenance-close" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="sail-provenance-grid">' + gridRows + '</div>';

    // Insert trigger into header zone
    var headerZone = findZone(postEl, 'header', platformKey);
    if (headerZone) {
      headerZone.appendChild(trigger);
      headerZone.parentNode.insertBefore(panel, headerZone.nextSibling);
    } else {
      postEl.insertBefore(panel, postEl.firstChild);
      postEl.insertBefore(trigger, panel);
    }

    // Toggle behavior
    var isOpen = false;
    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      isOpen = !isOpen;
      if (isOpen) {
        panel.classList.add('sail-panel-open');
        logEvent('provenance_opened', { postId: postId });
      } else {
        panel.classList.remove('sail-panel-open');
        logEvent('provenance_closed', { postId: postId });
      }
    });

    var closeBtn = panel.querySelector('.sail-provenance-close');
    closeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      isOpen = false;
      panel.classList.remove('sail-panel-open');
      logEvent('provenance_closed', { postId: postId });
    });
  }

  // ------ (d) Accuracy Nudge ------

  /**
   * Set of postId+action keys that are currently showing a nudge,
   * to prevent stacking.
   */
  var nudgeActive = new Set();

  function applyNudge(postEl, platformKey) {
    if (!config.nudge) return;
    if (postEl.dataset.sailNudgeBound) return;
    postEl.dataset.sailNudgeBound = 'true';

    var sel = SELECTORS[platformKey];
    if (!sel) return;

    var postId = getPostId(postEl);

    // Determine which buttons to intercept
    var interceptLike  = (config.nudge === 'like' || config.nudge === 'both');
    var interceptShare = (config.nudge === 'share' || config.nudge === 'both');

    if (interceptLike && sel.likeBtn) {
      var likeBtn = postEl.querySelector(sel.likeBtn);
      if (likeBtn) {
        interceptButton(likeBtn, 'like', postId);
      }
    }

    if (interceptShare) {
      // Try share button, then retweet button as fallback
      var shareSelector = sel.shareBtn || sel.retweetBtn;
      if (shareSelector) {
        var shareBtn = postEl.querySelector(shareSelector);
        if (shareBtn) {
          interceptButton(shareBtn, 'share', postId);
        }
      }
    }
  }

  function interceptButton(btn, actionType, postId) {
    // Use capturing phase to intercept before platform handlers
    btn.addEventListener('click', function nudgeHandler(e) {
      var nudgeKey = postId + ':' + actionType;
      if (nudgeActive.has(nudgeKey)) return; // already showing

      e.stopImmediatePropagation();
      e.preventDefault();

      nudgeActive.add(nudgeKey);
      showNudgeModal(btn, actionType, postId, nudgeKey);
    }, true); // capturing phase
  }

  function showNudgeModal(originalBtn, actionType, postId, nudgeKey) {
    var shownTime = Date.now();
    logEvent('nudge_shown', { postId: postId, action: actionType });

    var actionLabel = actionType === 'like' ? 'Like' : 'Share';

    var nudgeText = config.nudge_text ||
      ('Before you ' + actionLabel.toLowerCase() + ', consider: Is this information accurate?');

    var nudgeIconClass = config.nudge_icon || 'fas fa-exclamation-triangle';
    var proceedText = config.nudge_proceed_text || (actionLabel + ' Anyway');
    var cancelText = config.nudge_cancel_text || 'Cancel';

    var backdrop = document.createElement('div');
    backdrop.className = 'sail-nudge-backdrop';
    backdrop.innerHTML =
      '<div class="sail-nudge-card">' +
        '<div class="sail-nudge-icon"><i class="' + nudgeIconClass + '"></i></div>' +
        '<div class="sail-nudge-text">' + nudgeText + '</div>' +
        '<div class="sail-nudge-actions">' +
          '<button class="sail-nudge-cancel">' + cancelText + '</button>' +
          '<button class="sail-nudge-proceed">' + proceedText + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(backdrop);

    var cancelBtn = backdrop.querySelector('.sail-nudge-cancel');
    var proceedBtn = backdrop.querySelector('.sail-nudge-proceed');

    function closeModal() {
      nudgeActive.delete(nudgeKey);
      backdrop.remove();
    }

    cancelBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      logEvent('nudge_cancelled', {
        postId: postId,
        action: actionType,
        timeToAction: Date.now() - shownTime
      });
      closeModal();
    });

    proceedBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      logEvent('nudge_proceeded', {
        postId: postId,
        action: actionType,
        timeToAction: Date.now() - shownTime
      });
      closeModal();

      // Execute the original action by dispatching a new click.
      // Temporarily remove our capturing listener to avoid re-triggering.
      // The simplest approach: call click() and let the nudge guard
      // see that nudgeActive no longer contains the key, so it will not
      // re-intercept. But since we removed from the set, the capturing
      // handler will fire again and see it is not in nudgeActive, so it
      // passes through.
      originalBtn.click();
    });

    // Close on backdrop click
    backdrop.addEventListener('click', function(e) {
      if (e.target === backdrop) {
        logEvent('nudge_cancelled', {
          postId: postId,
          action: actionType,
          timeToAction: Date.now() - shownTime
        });
        closeModal();
      }
    });
  }

  // ------ (e) Community Notes ------

  function applyCommunityNotes(postEl, platformKey) {
    if (!config.community_notes) return;
    if (postEl.querySelector('.sail-community-note')) return;

    var postId = getPostId(postEl);

    var note = document.createElement('div');
    note.className = 'sail-community-note';
    if (config.community_notes_bg) note.style.background = config.community_notes_bg;
    if (config.community_notes_border) note.style.borderColor = config.community_notes_border;

    var cnTitle = config.community_notes_title || 'Readers added context';
    var rateHtml = config.community_notes_rate_show
      ? '<a class="sail-cn-rate" href="javascript:void(0)">Rate this note</a>'
      : '';

    note.innerHTML =
      '<div class="sail-cn-header">' +
        '<i class="fas fa-users sail-cn-icon"></i>' +
        '<span class="sail-cn-title">' + cnTitle + '</span>' +
      '</div>' +
      '<div class="sail-cn-body">' + config.community_notes_text + '</div>' +
      rateHtml;

    // Insert after the post's footer zone, or append to post
    var footerZone = findZone(postEl, 'footer', platformKey);
    if (footerZone) {
      footerZone.parentNode.insertBefore(note, footerZone.nextSibling);
    } else {
      postEl.appendChild(note);
    }

    // Rate link tracking
    var rateLink = note.querySelector('.sail-cn-rate');
    if (!rateLink) return; // rate link may be hidden
    rateLink.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      logEvent('community_note_rated', { postId: postId });
      rateLink.textContent = 'Thanks for rating!';
      rateLink.style.color = '#71767B';
      rateLink.style.cursor = 'default';
    });
  }

  // ------ (f) AI-Origin Icon ------

  function applyAiIcon(postEl, platformKey) {
    if (!config.ai_icon) return;
    if (postEl.querySelector('.sail-ai-icon')) return;

    var isFull = config.ai_icon === 'full';
    var iconClass = config.ai_icon_icon || (isFull ? 'fas fa-wand-magic-sparkles' : 'fas fa-wand-magic');
    var labelText = config.ai_icon_label || (isFull ? 'AI' : 'AI+');
    var tooltipText = isFull ? 'AI Generated Content' : 'AI Assisted Content';

    var iconEl = document.createElement('span');
    iconEl.className = 'sail-ai-icon';
    if (config.ai_icon_bg) iconEl.style.background = config.ai_icon_bg;
    if (config.ai_icon_text_color) iconEl.style.color = config.ai_icon_text_color;
    iconEl.innerHTML =
      '<i class="' + iconClass + '"></i> ' + labelText +
      '<span class="sail-ai-tooltip">' + tooltipText + '</span>';

    // Absolute positioning mode (from designer canvas drag-and-drop)
    if (config.ai_icon_x_pct != null && config.ai_icon_y_pct != null) {
      iconEl.classList.add('sail-ai-icon-absolute');
      iconEl.style.position = 'absolute';
      iconEl.style.left = config.ai_icon_x_pct + '%';
      iconEl.style.top = config.ai_icon_y_pct + '%';
      iconEl.style.zIndex = '15';
      // Apply designer-specified size via width percentage
      if (config.ai_icon_w_pct) {
        iconEl.style.transformOrigin = 'top left';
        iconEl.style.width = config.ai_icon_w_pct + '%';
        iconEl.style.whiteSpace = 'nowrap';
      }
      var compPos = window.getComputedStyle(postEl).position;
      if (compPos === 'static') postEl.style.position = 'relative';
      postEl.appendChild(iconEl);
      return;
    }

    // Determine placement: use ai_icon_pos if set, else try media then header
    var forcePos = config.ai_icon_pos;

    if (forcePos === 'header') {
      iconEl.classList.add('sail-ai-icon-header');
      var hdrZone = findZone(postEl, 'header', platformKey);
      if (hdrZone) {
        hdrZone.appendChild(iconEl);
      } else {
        postEl.insertBefore(iconEl, postEl.firstChild);
      }
      return;
    }

    // Default: try media first
    var mediaZone = findZone(postEl, 'media', platformKey);
    if (mediaZone) {
      iconEl.classList.add('sail-ai-icon-media');
      var computedPos = window.getComputedStyle(mediaZone).position;
      if (computedPos === 'static') {
        mediaZone.style.position = 'relative';
      }
      mediaZone.appendChild(iconEl);
    } else {
      iconEl.classList.add('sail-ai-icon-header');
      var headerZone = findZone(postEl, 'header', platformKey);
      if (headerZone) {
        headerZone.appendChild(iconEl);
      } else {
        postEl.insertBefore(iconEl, postEl.firstChild);
      }
    }
  }

  // ============================================================
  // 7. MAIN PROCESSING PIPELINE
  // ============================================================

  /**
   * Apply all active interventions to a single stimulus post element.
   */
  function processPost(postEl, platformKey) {
    // Guard: only stimulus posts
    if (postEl.dataset.postType !== 'stimulus') return;
    // Guard: avoid double-processing
    if (postEl.dataset.sailProcessed === 'true') return;
    postEl.dataset.sailProcessed = 'true';

    if (config.debug) {
      console.log('[SAIL] Processing stimulus post:', getPostId(postEl));
    }

    // Apply each enabled intervention
    applyBadge(postEl, platformKey);
    applyInterstitial(postEl, platformKey);
    applyProvenance(postEl, platformKey);
    applyNudge(postEl, platformKey);
    applyCommunityNotes(postEl, platformKey);
    applyAiIcon(postEl, platformKey);
  }

  /**
   * Scan the DOM for all stimulus posts and apply interventions.
   */
  function processAllPosts(platformKey) {
    var sel = SELECTORS[platformKey];
    if (!sel) return;

    var posts = document.querySelectorAll('[data-post-type="stimulus"]');
    posts.forEach(function(postEl) {
      processPost(postEl, platformKey);
    });

    if (config.debug) {
      console.log('[SAIL] Processed', posts.length, 'stimulus posts on platform:', platformKey);
    }
  }

  // ============================================================
  // 8. MUTATION OBSERVER (dynamic post loading)
  // ============================================================

  function setupMutationObserver(platformKey) {
    var sel = SELECTORS[platformKey];
    if (!sel || !sel.feedContainer) return;

    var feedContainer = document.querySelector(sel.feedContainer);
    if (!feedContainer) return;

    var observer = new MutationObserver(function(mutations) {
      var shouldScan = false;
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length > 0) {
          shouldScan = true;
        }
      });
      if (shouldScan) {
        // Small delay to let platform JS finish setting data attributes
        setTimeout(function() {
          processAllPosts(platformKey);
        }, 100);
      }
    });

    observer.observe(feedContainer, { childList: true, subtree: true });

    if (config.debug) {
      console.log('[SAIL] MutationObserver watching:', sel.feedContainer);
    }
  }

  // ============================================================
  // 9. DESIGNER LIVE-UPDATE API (postMessage)
  // ============================================================

  // Module-scoped platform key, set during bootstrap
  var currentPlatformKey = null;

  /**
   * Strip all SAIL-injected intervention elements from the DOM.
   * Used before re-applying with a new config.
   */
  function stripInterventions() {
    // Remove all sail- prefixed elements
    var selectors = [
      '.sail-badge',
      '.sail-interstitial-overlay',
      '.sail-interstitial-blur',
      '.sail-provenance-trigger',
      '.sail-provenance-panel',
      '.sail-nudge-backdrop',
      '.sail-community-note',
      '.sail-ai-icon'
    ];
    selectors.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) {
        // For interstitial blur wrapper: move children back to parent first
        if (el.classList.contains('sail-interstitial-blur')) {
          var parent = el.parentNode;
          var children = Array.prototype.slice.call(el.children);
          children.forEach(function(child) {
            parent.insertBefore(child, el);
          });
        }
        el.remove();
      });
    });

    // Reset processed flags on all posts
    document.querySelectorAll('[data-sail-processed]').forEach(function(el) {
      delete el.dataset.sailProcessed;
    });
    document.querySelectorAll('[data-sail-interstitial-bound]').forEach(function(el) {
      delete el.dataset.sailInterstitialBound;
    });
    document.querySelectorAll('[data-sail-nudge-bound]').forEach(function(el) {
      delete el.dataset.sailNudgeBound;
    });

    // Clear interstitial dismissed set
    interstitialDismissed.clear();
    nudgeActive.clear();
  }

  /**
   * Re-apply interventions with a new config object.
   * Called via postMessage from the admin panel designer.
   */
  function reapplyInterventions(newConfig) {
    // Strip existing interventions
    stripInterventions();

    // Update config with new values
    var keys = Object.keys(newConfig);
    for (var i = 0; i < keys.length; i++) {
      config[keys[i]] = newConfig[keys[i]];
    }

    // Rebuild active interventions list
    rebuildActiveList();

    // Re-process all posts with new config
    if (currentPlatformKey) {
      processAllPosts(currentPlatformKey);
    }
  }

  // Listen for config updates from parent frame (admin panel designer)
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'sail-update' && e.data.config) {
      reapplyInterventions(e.data.config);
    }
    // Respond to ping from admin to confirm iframe is ready
    if (e.data && e.data.type === 'sail-ping') {
      window.parent.postMessage({ type: 'sail-pong' }, '*');
    }
  });

  // ============================================================
  // 10. INITIALIZATION
  // ============================================================

  function init() {
    var platformKey = detectPlatform();
    if (!platformKey) {
      if (config.debug) {
        console.warn('[SAIL] Could not detect platform. Retrying in 500ms...');
      }
      // Retry once after an additional delay
      setTimeout(function() {
        var retry = detectPlatform();
        if (retry) {
          bootstrap(retry);
        } else if (config.debug) {
          console.warn('[SAIL] Platform detection failed on retry. Aborting.');
        }
      }, 500);
      return;
    }
    bootstrap(platformKey);
  }

  function bootstrap(platformKey) {
    currentPlatformKey = platformKey;

    if (config.debug) {
      console.log('[SAIL] Initializing on platform:', platformKey);
      console.log('[SAIL] Active interventions:', activeInterventions);
      console.log('[SAIL] Config:', config);
    }

    if (activeInterventions.length > 0) {
      processAllPosts(platformKey);
    }
    setupMutationObserver(platformKey);

    // Notify parent frame that SAIL is ready (for admin designer)
    if (isDesignerMode && window.parent !== window) {
      window.parent.postMessage({ type: 'sail-ready', platform: platformKey }, '*');
    }
  }

  // Run after DOMContentLoaded + delay to ensure platform JS has rendered
  // In designer mode, use shorter delay for faster preview
  var initDelay = isDesignerMode ? 200 : 500;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(init, initDelay);
    });
  } else {
    // DOM already loaded (script loaded with defer or late)
    setTimeout(init, initDelay);
  }

})();
