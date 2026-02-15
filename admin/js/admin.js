/* ============================================
   SAIL Admin Panel — Application Logic
   ============================================ */
(function () {
  'use strict';

  // ---- Platform Registry ----
  const PLATFORMS = {
    circl:  { name: 'Circl',  icon: 'fa-brands fa-facebook',  accent: '#1877F2', subtitle: 'Facebook-style feed',    path: '../circl/feed.html',  configPath: '../circl/data/feed-config.json' },
    wave:   { name: 'Wave',   icon: 'fa-brands fa-twitter',   accent: '#B91C1C', subtitle: 'X / Twitter-style feed',  path: '../wave/feed.html',   configPath: '../circl/data/feed-config.json' },
    flow:   { name: 'Flow',   icon: 'fa-brands fa-tiktok',    accent: '#FE2C55', subtitle: 'TikTok-style feed',       path: '../flow/feed.html',   configPath: '../circl/data/feed-config.json' },
    pixl:   { name: 'Pixl',   icon: 'fa-brands fa-instagram', accent: '#E1306C', subtitle: 'Instagram-style feed',    path: '../pixl/feed.html',   configPath: '../circl/data/feed-config.json' },
    buzz:   { name: 'Buzz',   icon: 'fa-brands fa-whatsapp',  accent: '#25D366', subtitle: 'WhatsApp-style chat',     path: '../buzz/feed.html',   configPath: '../circl/data/feed-config.json' },
    swift:  { name: 'Swift',  icon: 'fa-brands fa-telegram',  accent: '#0088CC', subtitle: 'Telegram-style channel',  path: '../swift/feed.html',  configPath: '../circl/data/feed-config.json' }
  };

  // ---- State ----
  let currentPlatform = null;
  let feedConfig = null;

  // ---- DOM Cache ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    landingView:       $('#landing-view'),
    configView:        $('#config-view'),
    sidebarIcon:       $('#sidebar-icon'),
    sidebarName:       $('#sidebar-name'),
    mobileName:        $('#mobile-platform-name'),
    urlDisplay:        $('#url-display'),
    previewIframe:     $('#preview-iframe'),
    previewUrlLabel:   $('#preview-url-label'),
    toast:             $('#toast'),
    mobileDrawer:      $('#mobile-nav-drawer')
  };

  // ---- Initialization ----
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    bindEvents();
    handleRoute();
    window.addEventListener('hashchange', handleRoute);
  }

  // ---- Routing ----
  function handleRoute() {
    const hash = window.location.hash || '';
    const match = hash.match(/^#platform\/(\w+)$/);

    if (match && PLATFORMS[match[1]]) {
      showPlatformConfig(match[1]);
    } else {
      showLandingPage();
    }
  }

  function showLandingPage() {
    currentPlatform = null;
    dom.landingView.style.display = '';
    dom.configView.style.display = 'none';
    document.title = 'SAIL Admin Panel';
  }

  function showPlatformConfig(platformKey) {
    const platform = PLATFORMS[platformKey];
    if (!platform) return;

    currentPlatform = platformKey;

    // Update sidebar branding
    dom.sidebarIcon.innerHTML = '<i class="' + platform.icon + '"></i>';
    dom.sidebarIcon.style.color = platform.accent;
    dom.sidebarName.textContent = platform.name;
    dom.mobileName.textContent = platform.name;

    // Apply accent color as CSS custom property on config view
    dom.configView.style.setProperty('--platform-accent', platform.accent);

    // Switch views
    dom.landingView.style.display = 'none';
    dom.configView.style.display = 'flex';

    document.title = 'SAIL \u2014 ' + platform.name + ' Configuration';

    // Reset sidebar active state
    $$('.sidebar-link').forEach(function (link) {
      link.classList.remove('active');
    });
    $$('.sidebar-link[data-section="section-feed"]').forEach(function (link) {
      link.classList.add('active');
    });

    // Close mobile drawer
    dom.mobileDrawer.classList.remove('open');

    // Load config
    loadConfig(platformKey);

    // Scroll to top
    window.scrollTo(0, 0);

    // Build initial URL and preview
    updateUrlPreview();
    updateEditorPreview();

    // Load designer iframe with the selected platform's feed
    loadDesignerPreview();
  }

  // ---- Config Loading ----
  async function loadConfig(platformKey) {
    const platform = PLATFORMS[platformKey];
    try {
      const resp = await fetch(platform.configPath);
      if (!resp.ok) throw new Error('Config not found');
      feedConfig = await resp.json();
      applyConfigToForm(feedConfig);
    } catch (err) {
      // Fallback: use defaults already set in HTML
      console.warn('Could not load config for ' + platformKey + ':', err.message);
      feedConfig = null;
    }
    updateUrlPreview();
  }

  function applyConfigToForm(config) {
    if (!config) return;

    var fs = config.feed_settings || {};

    var totalPosts = $('#cfg-total-posts');
    var stimuliCount = $('#cfg-stimuli-count');
    var fillerRatio = $('#cfg-filler-ratio');
    var firstNFillers = $('#cfg-first-n-fillers');
    var randomize = $('#cfg-randomize');

    if (fs.total_posts != null) totalPosts.value = fs.total_posts;
    if (fs.stimuli_count != null) stimuliCount.value = fs.stimuli_count;
    if (fs.filler_ratio != null) fillerRatio.value = fs.filler_ratio;
    if (fs.first_n_fillers != null) firstNFillers.value = fs.first_n_fillers;
    if (fs.randomize_order != null) randomize.checked = fs.randomize_order;

    // Populate issues from config if available
    var matching = (config.personalization && config.personalization.matching) || [];
    var issueRule = matching.find(function (r) { return r.url_param === 'issue'; });
    // The valid issues come from the feed JS; we keep the HTML select as-is for now
    // since the config doesn't list available issue values directly.

    updateUrlPreview();
  }

  // ---- URL Generation ----
  // buildUrl is defined later in the Character Creator section
  // (reads from CC controls for maximum granularity)
  var buildUrl = function () { return ''; };

  function updateUrlPreview() {
    var url = buildUrl();
    dom.urlDisplay.textContent = url || '(select a platform)';
    dom.previewUrlLabel.textContent = url;
  }

  function copyUrl() {
    var url = buildUrl();
    if (!url) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        showToast('URL copied to clipboard');
      }).catch(function () {
        fallbackCopy(url);
      });
    } else {
      fallbackCopy(url);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast('URL copied to clipboard');
    } catch (e) {
      showToast('Failed to copy');
    }
    document.body.removeChild(ta);
  }

  function openPreview() {
    var url = buildUrl();
    if (url) window.open(url, '_blank');
  }

  function openInIframe() {
    var url = buildUrl();
    if (!url) return;
    dom.previewIframe.src = url;
    dom.previewUrlLabel.textContent = url;

    // Scroll to preview section
    var previewSection = $('#section-preview');
    if (previewSection) {
      previewSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function refreshPreview() {
    var url = buildUrl();
    if (url) {
      dom.previewIframe.src = '';
      requestAnimationFrame(function () {
        dom.previewIframe.src = url;
      });
    }
  }

  // ---- Toast ----
  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add('visible');
    clearTimeout(dom.toast._timer);
    dom.toast._timer = setTimeout(function () {
      dom.toast.classList.remove('visible');
    }, 2500);
  }

  // ---- Suppress sync loops ----
  var syncLock = false;

  // ---- Event Binding ----
  function bindEvents() {

    // Platform card clicks
    $$('.platform-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var key = card.getAttribute('data-platform');
        if (key) {
          window.location.hash = '#platform/' + key;
        }
      });
    });

    // Back buttons
    $('#btn-back').addEventListener('click', function () {
      window.location.hash = '';
    });
    $('#btn-back-mobile').addEventListener('click', function () {
      window.location.hash = '';
    });

    // Mobile menu toggle
    $('#btn-mobile-menu').addEventListener('click', function () {
      dom.mobileDrawer.classList.toggle('open');
    });

    // Sidebar navigation (smooth scroll to sections)
    $$('.sidebar-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var sectionId = link.getAttribute('data-section');
        var section = document.getElementById(sectionId);
        if (section) {
          section.scrollIntoView({ behavior: 'smooth' });
        }
        $$('.sidebar-link').forEach(function (l) { l.classList.remove('active'); });
        $$('.sidebar-link[data-section="' + sectionId + '"]').forEach(function (l) { l.classList.add('active'); });
        dom.mobileDrawer.classList.remove('open');
      });
    });

    // Intervention toggles — expand/collapse settings & sync to cc
    var togglePairs = [
      { toggle: '#int-badge-toggle',        settings: '#int-badge-settings',        cc: '#cc-badge-toggle' },
      { toggle: '#int-interstitial-toggle',  settings: '#int-interstitial-settings', cc: '#cc-interstitial-toggle' },
      { toggle: '#int-provenance-toggle',    settings: '#int-provenance-settings',   cc: '#cc-provenance-toggle' },
      { toggle: '#int-nudge-toggle',         settings: '#int-nudge-settings',        cc: '#cc-nudge-toggle' },
      { toggle: '#int-notes-toggle',         settings: '#int-notes-settings',        cc: '#cc-notes-toggle' },
      { toggle: '#int-aiicon-toggle',        settings: '#int-aiicon-settings',       cc: '#cc-aiicon-toggle' }
    ];

    togglePairs.forEach(function (pair) {
      var toggleEl = $(pair.toggle);
      var settingsEl = $(pair.settings);
      var ccToggle = $(pair.cc);
      if (toggleEl && settingsEl) {
        toggleEl.addEventListener('change', function () {
          settingsEl.classList.toggle('open', toggleEl.checked);
          if (!syncLock && ccToggle) {
            syncLock = true;
            ccToggle.checked = toggleEl.checked;
            syncLock = false;
          }
          updateUrlPreview();
          updateEditorPreview();
          updateCcDots();
        });
      }
    });

    // Politics range value display
    var politicsRange = $('#cfg-politics');
    var politicsValue = $('#politics-value');
    if (politicsRange && politicsValue) {
      politicsRange.addEventListener('input', function () {
        politicsValue.textContent = politicsRange.value;
        updateUrlPreview();
      });
    }

    // Auto-update URL on any form change in feed/interventions sections
    var formInputs = $$(
      '#section-feed input, #section-feed select, #section-feed textarea, ' +
      '#section-interventions input, #section-interventions select, #section-interventions textarea'
    );

    formInputs.forEach(function (input) {
      var handler = function () {
        if (!syncLock) {
          syncLock = true;
          syncIntToCC();
          syncLock = false;
        }
        updateUrlPreview();
        updateEditorPreview();
        updateCcDots();
      };
      input.addEventListener('input', handler);
      input.addEventListener('change', handler);
    });

    // URL action buttons
    $('#btn-copy-url').addEventListener('click', copyUrl);
    $('#btn-open-preview').addEventListener('click', openPreview);
    $('#btn-open-iframe').addEventListener('click', openInIframe);
    $('#btn-refresh-preview').addEventListener('click', refreshPreview);

    // Preset buttons
    $('#btn-save-preset').addEventListener('click', savePreset);
    $('#btn-reset-preview').addEventListener('click', resetPreview);
    $('#file-load-preset').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (file) {
        loadPreset(file);
        e.target.value = '';
      }
    });

    // ---- Character Creator Events ----
    initCharacterCreator();

    // ---- Canvas Designer ----
    initCanvasDesigner();

    // Scroll spy
    setupScrollSpy();
  }

  // ============================================================
  // CHARACTER CREATOR
  // ============================================================

  function initCharacterCreator() {
    // Tab switching
    $$('.cc-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        switchCcTab(tab.dataset.ccTab);
      });
    });

    // Platform preview switching
    $$('.cc-platform-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.cc-platform-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        switchPreviewPlatform(btn.dataset.ccPlatform);
      });
    });

    // Segmented controls
    $$('.cc-segmented').forEach(function (seg) {
      seg.querySelectorAll('.cc-seg').forEach(function (btn) {
        btn.addEventListener('click', function () {
          seg.querySelectorAll('.cc-seg').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          onCcChange();
        });
      });
    });

    // Icon pickers
    $$('.cc-icon-picker').forEach(function (picker) {
      picker.querySelectorAll('.cc-icon-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          picker.querySelectorAll('.cc-icon-btn').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          onCcChange();
        });
      });
    });

    // Color picker ↔ hex input sync
    $$('.cc-color-wrap').forEach(function (wrap) {
      var colorIn = wrap.querySelector('.cc-color-input');
      var hexIn = wrap.querySelector('.cc-hex-input');
      if (colorIn && hexIn) {
        colorIn.addEventListener('input', function () {
          hexIn.value = colorIn.value;
          onCcChange();
        });
        hexIn.addEventListener('input', function () {
          if (/^#[0-9a-fA-F]{6}$/.test(hexIn.value)) {
            colorIn.value = hexIn.value;
            onCcChange();
          }
        });
      }
    });

    // Slider value displays
    var sliders = [
      { id: 'cc-badge-font-size', valId: 'cc-badge-fs-val', suffix: 'px' },
      { id: 'cc-badge-radius', valId: 'cc-badge-radius-val', suffix: 'px' },
      { id: 'cc-badge-opacity', valId: 'cc-badge-opacity-val', suffix: '', transform: function (v) { return (v / 100).toFixed(2); } },
      { id: 'cc-interstitial-opacity', valId: 'cc-interstitial-opacity-val', suffix: '', transform: function (v) { return (v / 100).toFixed(2); } },
      { id: 'cc-interstitial-blur', valId: 'cc-interstitial-blur-val', suffix: 'px' }
    ];
    sliders.forEach(function (s) {
      var slider = $('#' + s.id);
      var valEl = $('#' + s.valId);
      if (slider && valEl) {
        slider.addEventListener('input', function () {
          var v = s.transform ? s.transform(parseInt(slider.value, 10)) : slider.value;
          valEl.textContent = v + s.suffix;
          onCcChange();
        });
      }
    });

    // CC toggle checkboxes → sync to intervention section
    var ccToggles = [
      { cc: '#cc-badge-toggle',        int: '#int-badge-toggle',        settings: '#int-badge-settings' },
      { cc: '#cc-interstitial-toggle',  int: '#int-interstitial-toggle', settings: '#int-interstitial-settings' },
      { cc: '#cc-provenance-toggle',    int: '#int-provenance-toggle',   settings: '#int-provenance-settings' },
      { cc: '#cc-nudge-toggle',         int: '#int-nudge-toggle',        settings: '#int-nudge-settings' },
      { cc: '#cc-notes-toggle',         int: '#int-notes-toggle',        settings: '#int-notes-settings' },
      { cc: '#cc-aiicon-toggle',        int: '#int-aiicon-toggle',       settings: '#int-aiicon-settings' }
    ];
    ccToggles.forEach(function (pair) {
      var ccEl = $(pair.cc);
      var intEl = $(pair.int);
      var settEl = $(pair.settings);
      if (ccEl) {
        ccEl.addEventListener('change', function () {
          if (!syncLock) {
            syncLock = true;
            if (intEl) {
              intEl.checked = ccEl.checked;
              if (settEl) settEl.classList.toggle('open', ccEl.checked);
            }
            syncLock = false;
          }
          onCcChange();
        });
      }
    });

    // All cc text/textarea/color inputs
    $$('#section-editor .cc-input, #section-editor .cc-hex-input').forEach(function (input) {
      input.addEventListener('input', function () { onCcChange(); });
    });

    // CC checkbox (notes rate show)
    var rateShow = $('#cc-notes-rate-show');
    if (rateShow) rateShow.addEventListener('change', function () { onCcChange(); });

    // Built-in presets
    $$('.cc-preset-chip[data-preset]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        applyCcPreset(chip.dataset.preset);
        // Highlight active preset
        $$('.cc-preset-chip[data-preset]').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
      });
    });
  }

  function switchCcTab(tabName) {
    $$('.cc-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.ccTab === tabName);
      t.setAttribute('aria-selected', t.dataset.ccTab === tabName ? 'true' : 'false');
    });
    $$('.cc-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'cc-panel-' + tabName);
    });
  }

  function switchPreviewPlatform(platform) {
    // Reload the designer iframe with the selected platform
    if (typeof SailCanvasManager !== 'undefined' && PLATFORMS[platform]) {
      var params = new URLSearchParams();
      params.set('source', 'json');
      params.set('total_posts', '5');
      params.set('gender', $('#cfg-gender').value);
      params.set('age', $('#cfg-age').value);
      params.set('politics', $('#cfg-politics').value);
      params.set('issue', $('#cfg-issue').value);
      SailCanvasManager.loadIframe(PLATFORMS[platform].path, params.toString());
      // Re-send current intervention config after a delay
      setTimeout(sendDesignerUpdate, 1500);
    }
  }

  /** Called when any CC control changes. Syncs to intervention section and updates preview. */
  function onCcChange() {
    if (!syncLock) {
      syncLock = true;
      syncCCToInt();
      syncLock = false;
    }
    updateUrlPreview();
    updateEditorPreview();
    updateCcDots();
    // Clear active preset highlight since settings changed manually
    $$('.cc-preset-chip[data-preset]').forEach(function (c) { c.classList.remove('active'); });
  }

  /** Update green dots on tabs to reflect which interventions are enabled. */
  function updateCcDots() {
    var map = {
      badge: '#cc-badge-toggle',
      interstitial: '#cc-interstitial-toggle',
      provenance: '#cc-provenance-toggle',
      nudge: '#cc-nudge-toggle',
      notes: '#cc-notes-toggle',
      aiicon: '#cc-aiicon-toggle'
    };
    Object.keys(map).forEach(function (key) {
      var dot = $('#cc-dot-' + key);
      var toggle = $(map[key]);
      if (dot && toggle) {
        dot.classList.toggle('on', toggle.checked);
      }
    });
  }

  // ---- Helpers for reading CC segmented / icon picker values ----

  function getSegValue(segId) {
    var seg = $('#' + segId);
    if (!seg) return null;
    var active = seg.querySelector('.cc-seg.active');
    return active ? active.dataset.value : null;
  }

  function setSegValue(segId, value) {
    var seg = $('#' + segId);
    if (!seg) return;
    seg.querySelectorAll('.cc-seg').forEach(function (b) {
      b.classList.toggle('active', b.dataset.value === value);
    });
  }

  function getIconValue(pickerId) {
    var picker = $('#' + pickerId);
    if (!picker) return null;
    var active = picker.querySelector('.cc-icon-btn.active');
    return active ? active.dataset.icon : null;
  }

  function setIconValue(pickerId, icon) {
    var picker = $('#' + pickerId);
    if (!picker) return;
    picker.querySelectorAll('.cc-icon-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.icon === icon);
    });
  }

  // ---- Sync CC → Intervention section ----
  function syncCCToInt() {
    // Badge
    var intBadge = $('#int-badge-toggle');
    if (intBadge) intBadge.checked = $('#cc-badge-toggle').checked;
    var intBadgeSettings = $('#int-badge-settings');
    if (intBadgeSettings) intBadgeSettings.classList.toggle('open', $('#cc-badge-toggle').checked);
    var intBadgeText = $('#int-badge-text');
    if (intBadgeText) intBadgeText.value = $('#cc-badge-text').value;
    // Map CC color to int select (best effort: find closest named color)
    var ccBgHex = $('#cc-badge-bg-hex').value.toLowerCase();
    var colorMap = { '#1d9bf0': 'blue', '#e0245e': 'red', '#f59e0b': 'orange', '#71767b': 'gray' };
    var intBadgeColor = $('#int-badge-color');
    if (intBadgeColor) intBadgeColor.value = colorMap[ccBgHex] || 'blue';
    var intBadgePos = $('#int-badge-pos');
    if (intBadgePos) intBadgePos.value = getSegValue('cc-badge-pos') || 'header';

    // Interstitial
    var intInt = $('#int-interstitial-toggle');
    if (intInt) intInt.checked = $('#cc-interstitial-toggle').checked;
    var intIntSettings = $('#int-interstitial-settings');
    if (intIntSettings) intIntSettings.classList.toggle('open', $('#cc-interstitial-toggle').checked);
    var intIntMsg = $('#int-interstitial-msg');
    if (intIntMsg) intIntMsg.value = $('#cc-interstitial-msg').value;

    // Provenance
    var intProv = $('#int-provenance-toggle');
    if (intProv) intProv.checked = $('#cc-provenance-toggle').checked;
    var intProvSettings = $('#int-provenance-settings');
    if (intProvSettings) intProvSettings.classList.toggle('open', $('#cc-provenance-toggle').checked);
    var intProvModel = $('#int-provenance-model');
    if (intProvModel) intProvModel.value = $('#cc-provenance-model').value;
    var intProvDate = $('#int-provenance-date');
    if (intProvDate) intProvDate.value = $('#cc-provenance-date').value;

    // Nudge
    var intNudge = $('#int-nudge-toggle');
    if (intNudge) intNudge.checked = $('#cc-nudge-toggle').checked;
    var intNudgeSettings = $('#int-nudge-settings');
    if (intNudgeSettings) intNudgeSettings.classList.toggle('open', $('#cc-nudge-toggle').checked);
    var intNudgeTrigger = $('#int-nudge-trigger');
    if (intNudgeTrigger) intNudgeTrigger.value = getSegValue('cc-nudge-trigger') || 'share';
    var intNudgeMsg = $('#int-nudge-msg');
    if (intNudgeMsg) intNudgeMsg.value = $('#cc-nudge-msg').value;

    // Community Notes
    var intNotes = $('#int-notes-toggle');
    if (intNotes) intNotes.checked = $('#cc-notes-toggle').checked;
    var intNotesSettings = $('#int-notes-settings');
    if (intNotesSettings) intNotesSettings.classList.toggle('open', $('#cc-notes-toggle').checked);
    var intNotesText = $('#int-notes-text');
    if (intNotesText) intNotesText.value = $('#cc-notes-text').value;

    // AI Icon
    var intAi = $('#int-aiicon-toggle');
    if (intAi) intAi.checked = $('#cc-aiicon-toggle').checked;
    var intAiSettings = $('#int-aiicon-settings');
    if (intAiSettings) intAiSettings.classList.toggle('open', $('#cc-aiicon-toggle').checked);
    var aiType = getSegValue('cc-aiicon-type') || 'full';
    var radio = document.querySelector('input[name="int-aiicon-type"][value="' + aiType + '"]');
    if (radio) radio.checked = true;
  }

  // ---- Sync Intervention section → CC ----
  function syncIntToCC() {
    // Badge
    $('#cc-badge-toggle').checked = $('#int-badge-toggle').checked;
    $('#cc-badge-text').value = $('#int-badge-text').value;
    var intColor = $('#int-badge-color').value;
    var colorToHex = { blue: '#1D9BF0', red: '#E0245E', orange: '#F59E0B', gray: '#71767B' };
    var hex = colorToHex[intColor] || '#1D9BF0';
    $('#cc-badge-bg-color').value = hex;
    $('#cc-badge-bg-hex').value = hex;
    setSegValue('cc-badge-pos', $('#int-badge-pos').value);

    // Interstitial
    $('#cc-interstitial-toggle').checked = $('#int-interstitial-toggle').checked;
    $('#cc-interstitial-msg').value = $('#int-interstitial-msg').value;

    // Provenance
    $('#cc-provenance-toggle').checked = $('#int-provenance-toggle').checked;
    $('#cc-provenance-model').value = $('#int-provenance-model').value;
    $('#cc-provenance-date').value = $('#int-provenance-date').value;

    // Nudge
    $('#cc-nudge-toggle').checked = $('#int-nudge-toggle').checked;
    setSegValue('cc-nudge-trigger', $('#int-nudge-trigger').value);
    $('#cc-nudge-msg').value = $('#int-nudge-msg').value;

    // Community Notes
    $('#cc-notes-toggle').checked = $('#int-notes-toggle').checked;
    $('#cc-notes-text').value = $('#int-notes-text').value;

    // AI Icon
    $('#cc-aiicon-toggle').checked = $('#int-aiicon-toggle').checked;
    var aiRadio = document.querySelector('input[name="int-aiicon-type"]:checked');
    setSegValue('cc-aiicon-type', aiRadio ? aiRadio.value : 'full');

    updateCcDots();
  }

  // ============================================================
  // CANVAS DESIGNER INTEGRATION
  // ============================================================

  function initCanvasDesigner() {
    // Initialize canvas overlay
    if (typeof SailCanvasManager !== 'undefined') {
      SailCanvasManager.init('cc-designer-container', 'cc-fabric-canvas');

      // Canvas toolbar buttons
      $$('.cc-toolbar-btn[data-action]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var action = btn.dataset.action;
          switch (action) {
            case 'add-text':
              SailCanvasManager.addCustomText();
              break;
            case 'add-rect':
              SailCanvasManager.addCustomShape();
              break;
            case 'delete':
              SailCanvasManager.removeSelected();
              break;
            case 'snap-grid':
              var isSnap = SailCanvasManager.toggleSnap();
              btn.classList.toggle('active', isSnap);
              showToast(isSnap ? 'Snap to grid enabled' : 'Snap to grid disabled');
              break;
            case 'export-png':
              SailCanvasManager.exportPNG();
              showToast('PNG exported');
              break;
            case 'clear-canvas':
              SailCanvasManager.clearAll();
              showToast('Canvas cleared');
              break;
          }
        });
      });

      // When canvas object is moved, update position display
      SailCanvasManager.onObjectMoved = function (type, pos) {
        // Position will be read during buildUrl()
      };

      // When canvas object is selected, switch to its CC tab
      SailCanvasManager.onObjectSelected = function (obj) {
        var type = obj.get ? obj.get('interventionType') : null;
        if (type === 'badge') switchCcTab('badge');
        else if (type === 'ai_icon') switchCcTab('aiicon');
        else if (type === 'community_notes') switchCcTab('notes');
      };
    }
  }

  /**
   * Build the intervention config object (same structure as sail-interventions.js expects).
   * Used for postMessage to iframe.
   */
  function gatherInterventionConfig() {
    var cfg = {};

    // Badge
    if ($('#cc-badge-toggle').checked) {
      cfg.label_badge = $('#cc-badge-text').value || 'AI-generated content';
      cfg.label_badge_pos = getSegValue('cc-badge-pos') || 'header';
      cfg.label_badge_color = $('#cc-badge-bg-hex').value || '#1D9BF0';
      cfg.label_badge_text_color = $('#cc-badge-text-hex').value || null;
      cfg.label_badge_icon = getIconValue('cc-badge-icon-picker') || null;
      var bFs = $('#cc-badge-font-size').value;
      cfg.label_badge_font_size = (bFs && bFs !== '12') ? bFs : null;
      var bRad = $('#cc-badge-radius').value;
      cfg.label_badge_radius = (bRad && bRad !== '20') ? bRad : null;
      var bOp = $('#cc-badge-opacity').value;
      cfg.label_badge_opacity = (bOp && bOp !== '100') ? (parseInt(bOp, 10) / 100).toFixed(2) : null;
    } else {
      cfg.label_badge = null;
    }

    // Interstitial
    cfg.interstitial = $('#cc-interstitial-toggle').checked;
    if (cfg.interstitial) {
      cfg.interstitial_text = $('#cc-interstitial-msg').value;
      cfg.interstitial_btn_text = $('#cc-interstitial-btn-text').value || 'Continue';
      cfg.interstitial_icon = getIconValue('cc-interstitial-icon-picker') || null;
      var intOp = $('#cc-interstitial-opacity').value;
      cfg.interstitial_overlay_opacity = (intOp && intOp !== '70') ? (parseInt(intOp, 10) / 100).toFixed(2) : null;
      var intBlur = $('#cc-interstitial-blur').value;
      cfg.interstitial_blur = (intBlur && intBlur !== '8') ? intBlur : null;
    }

    // Provenance
    cfg.provenance = $('#cc-provenance-toggle').checked;
    if (cfg.provenance) {
      cfg.provenance_model = $('#cc-provenance-model').value || 'AI Language Model';
      cfg.provenance_date = $('#cc-provenance-date').value || '2025';
      cfg.provenance_bg = $('#cc-provenance-bg-hex').value || null;
      cfg.provenance_trigger_style = getSegValue('cc-provenance-trigger-style') || 'circle';
    }

    // Nudge
    cfg.nudge = $('#cc-nudge-toggle').checked ? (getSegValue('cc-nudge-trigger') || 'share') : null;
    if (cfg.nudge) {
      cfg.nudge_text = $('#cc-nudge-msg').value || null;
      cfg.nudge_proceed_text = $('#cc-nudge-proceed-text').value || null;
      cfg.nudge_cancel_text = $('#cc-nudge-cancel-text').value || 'Cancel';
      cfg.nudge_icon = getIconValue('cc-nudge-icon-picker') || null;
    }

    // Community Notes
    cfg.community_notes = $('#cc-notes-toggle').checked;
    if (cfg.community_notes) {
      cfg.community_notes_text = $('#cc-notes-text').value;
      cfg.community_notes_title = $('#cc-notes-title').value || 'Readers added context';
      cfg.community_notes_bg = $('#cc-notes-bg-hex').value || null;
      cfg.community_notes_border = $('#cc-notes-border-hex').value || null;
      cfg.community_notes_rate_show = $('#cc-notes-rate-show').checked;
    }

    // AI Icon
    cfg.ai_icon = $('#cc-aiicon-toggle').checked ? (getSegValue('cc-aiicon-type') || 'full') : null;
    if (cfg.ai_icon) {
      cfg.ai_icon_label = $('#cc-aiicon-label').value || null;
      cfg.ai_icon_icon = getIconValue('cc-aiicon-icon-picker') || null;
      cfg.ai_icon_pos = getSegValue('cc-aiicon-pos') || null;
      cfg.ai_icon_bg = $('#cc-aiicon-bg-hex').value || null;
      cfg.ai_icon_text_color = $('#cc-aiicon-text-hex').value || null;
    }

    // Include canvas drag positions (if available)
    if (typeof SailCanvasManager !== 'undefined') {
      var positions = SailCanvasManager.getPositions();
      if (positions.badge && cfg.label_badge) {
        cfg.label_badge_x_pct = positions.badge.xPct;
        cfg.label_badge_y_pct = positions.badge.yPct;
        if (positions.badge.widthPct) cfg.label_badge_w_pct = positions.badge.widthPct;
        if (positions.badge.heightPct) cfg.label_badge_h_pct = positions.badge.heightPct;
      }
      if (positions.ai_icon && cfg.ai_icon) {
        cfg.ai_icon_x_pct = positions.ai_icon.xPct;
        cfg.ai_icon_y_pct = positions.ai_icon.yPct;
        if (positions.ai_icon.widthPct) cfg.ai_icon_w_pct = positions.ai_icon.widthPct;
        if (positions.ai_icon.heightPct) cfg.ai_icon_h_pct = positions.ai_icon.heightPct;
      }
    }

    return cfg;
  }

  /**
   * Send current config to the designer iframe via postMessage.
   * This triggers a live update in the feed preview.
   */
  function sendDesignerUpdate() {
    if (typeof SailCanvasManager !== 'undefined') {
      var cfg = gatherInterventionConfig();
      SailCanvasManager.sendConfig(cfg);
    }
  }

  /**
   * Load the designer iframe for the current platform.
   */
  function loadDesignerPreview() {
    if (!currentPlatform || typeof SailCanvasManager === 'undefined') return;
    var platform = PLATFORMS[currentPlatform];
    var params = new URLSearchParams();
    params.set('source', 'json');
    params.set('total_posts', '5');
    params.set('gender', $('#cfg-gender').value);
    params.set('age', $('#cfg-age').value);
    params.set('politics', $('#cfg-politics').value);
    params.set('issue', $('#cfg-issue').value);

    // Include intervention params so they render on first load
    var cfg = gatherInterventionConfig();
    if (cfg.label_badge) {
      params.set('label_badge', cfg.label_badge);
      params.set('label_badge_pos', cfg.label_badge_pos || 'header');
      params.set('label_badge_color', cfg.label_badge_color || '#1D9BF0');
      if (cfg.label_badge_text_color) params.set('label_badge_text_color', cfg.label_badge_text_color);
      if (cfg.label_badge_icon) params.set('label_badge_icon', cfg.label_badge_icon);
      if (cfg.label_badge_font_size) params.set('label_badge_font_size', cfg.label_badge_font_size);
      if (cfg.label_badge_radius) params.set('label_badge_radius', cfg.label_badge_radius);
      if (cfg.label_badge_opacity) params.set('label_badge_opacity', cfg.label_badge_opacity);
    }
    if (cfg.interstitial) params.set('interstitial', 'on');
    if (cfg.provenance) params.set('provenance', 'on');
    if (cfg.nudge) params.set('nudge', cfg.nudge);
    if (cfg.community_notes) params.set('community_notes', 'on');
    if (cfg.ai_icon) params.set('ai_icon', cfg.ai_icon);

    SailCanvasManager.loadIframe(platform.path, params.toString());
  }

  // ============================================================
  // EDITOR PREVIEW — now sends postMessage to live iframe
  // ============================================================

  function updateEditorPreview() {
    // Send config to iframe for live update
    sendDesignerUpdate();
    // Sync canvas overlay objects
    updateCanvasObjects();
  }

  /**
   * Sync Fabric.js canvas overlay objects with current CC control state.
   * These are visual indicators on the canvas that can be dragged; the real
   * rendering happens in the iframe via postMessage.
   */
  function updateCanvasObjects() {
    if (typeof SailCanvasManager === 'undefined') return;

    // Capture current positions+scale BEFORE recreating objects
    // This ensures dragged/resized positions are preserved across control changes
    var pos = SailCanvasManager.getPositions();

    // Badge
    if ($('#cc-badge-toggle').checked) {
      var badgeProps = {
        enabled: true,
        text: $('#cc-badge-text').value || 'AI-generated content',
        bgColor: $('#cc-badge-bg-hex').value || '#1D9BF0',
        textColor: $('#cc-badge-text-hex').value || '#ffffff',
        icon: getIconValue('cc-badge-icon-picker') || 'fas fa-info-circle',
        fontSize: parseInt($('#cc-badge-font-size').value, 10) || 12,
        radius: parseInt($('#cc-badge-radius').value, 10) || 20,
        opacity: (parseInt($('#cc-badge-opacity').value, 10) || 100) / 100
      };
      if (pos.badge) {
        badgeProps.left = pos.badge.left;
        badgeProps.top = pos.badge.top;
        badgeProps.scaleX = pos.badge.scaleX;
        badgeProps.scaleY = pos.badge.scaleY;
      }
      SailCanvasManager.setBadge(badgeProps);
    } else {
      SailCanvasManager.setBadge(null);
    }

    // AI Icon
    if ($('#cc-aiicon-toggle').checked) {
      var aiProps = {
        enabled: true,
        type: getSegValue('cc-aiicon-type') || 'full',
        label: $('#cc-aiicon-label').value || null,
        icon: getIconValue('cc-aiicon-icon-picker') || 'fas fa-wand-magic-sparkles',
        bgColor: $('#cc-aiicon-bg-hex').value || 'rgba(0,0,0,0.55)',
        textColor: $('#cc-aiicon-text-hex').value || '#ffffff'
      };
      if (pos.ai_icon) {
        aiProps.left = pos.ai_icon.left;
        aiProps.top = pos.ai_icon.top;
        aiProps.scaleX = pos.ai_icon.scaleX;
        aiProps.scaleY = pos.ai_icon.scaleY;
      }
      SailCanvasManager.setAiIcon(aiProps);
    } else {
      SailCanvasManager.setAiIcon(null);
    }

    // Community Notes
    if ($('#cc-notes-toggle').checked) {
      var notesProps = {
        enabled: true,
        title: $('#cc-notes-title').value || 'Readers added context',
        body: $('#cc-notes-text').value || '',
        bgColor: $('#cc-notes-bg-hex').value || '#FEF9EF',
        borderColor: $('#cc-notes-border-hex').value || '#F5DEB3'
      };
      if (pos.community_notes) {
        notesProps.left = pos.community_notes.left;
        notesProps.top = pos.community_notes.top;
        notesProps.scaleX = pos.community_notes.scaleX;
        notesProps.scaleY = pos.community_notes.scaleY;
      }
      SailCanvasManager.setCommunityNotes(notesProps);
    } else {
      SailCanvasManager.setCommunityNotes(null);
    }
  }

  // ============================================================
  // URL BUILDER (extended with CC params)
  // ============================================================

  // Full buildUrl implementation (reads from CC controls)
  buildUrl = function () {
    if (!currentPlatform) return '';
    var platform = PLATFORMS[currentPlatform];
    var params = new URLSearchParams();

    params.set('source', 'json');
    params.set('total_posts', $('#cfg-total-posts').value);
    params.set('gender', $('#cfg-gender').value);
    params.set('age', $('#cfg-age').value);
    params.set('politics', $('#cfg-politics').value);
    params.set('issue', $('#cfg-issue').value);

    // Badge
    if ($('#cc-badge-toggle').checked) {
      params.set('label_badge', $('#cc-badge-text').value);
      params.set('label_badge_pos', getSegValue('cc-badge-pos') || 'header');
      params.set('label_badge_color', $('#cc-badge-bg-hex').value);
      var txtColor = $('#cc-badge-text-hex').value;
      if (txtColor && txtColor !== '#ffffff') params.set('label_badge_text_color', txtColor);
      var bIcon = getIconValue('cc-badge-icon-picker');
      if (bIcon && bIcon !== 'fas fa-info-circle') params.set('label_badge_icon', bIcon);
      var bFs = $('#cc-badge-font-size').value;
      if (bFs && bFs !== '12') params.set('label_badge_font_size', bFs);
      var bRad = $('#cc-badge-radius').value;
      if (bRad && bRad !== '20') params.set('label_badge_radius', bRad);
      var bOp = $('#cc-badge-opacity').value;
      if (bOp && bOp !== '100') params.set('label_badge_opacity', (parseInt(bOp, 10) / 100).toFixed(2));
      // Canvas drag position and size (if dragged/resized)
      if (typeof SailCanvasManager !== 'undefined') {
        var positions = SailCanvasManager.getPositions();
        if (positions.badge) {
          params.set('label_badge_x_pct', positions.badge.xPct);
          params.set('label_badge_y_pct', positions.badge.yPct);
          if (positions.badge.widthPct) params.set('label_badge_w_pct', positions.badge.widthPct);
          if (positions.badge.heightPct) params.set('label_badge_h_pct', positions.badge.heightPct);
        }
      }
    }

    // Interstitial
    if ($('#cc-interstitial-toggle').checked) {
      params.set('interstitial', 'on');
      params.set('interstitial_text', $('#cc-interstitial-msg').value);
      var intBtn = $('#cc-interstitial-btn-text').value;
      if (intBtn && intBtn !== 'Continue') params.set('interstitial_btn_text', intBtn);
      var intIcon = getIconValue('cc-interstitial-icon-picker');
      if (intIcon && intIcon !== 'fas fa-exclamation-triangle') params.set('interstitial_icon', intIcon);
      var intOp = $('#cc-interstitial-opacity').value;
      if (intOp && intOp !== '70') params.set('interstitial_overlay_opacity', (parseInt(intOp, 10) / 100).toFixed(2));
      var intBlur = $('#cc-interstitial-blur').value;
      if (intBlur && intBlur !== '8') params.set('interstitial_blur', intBlur);
    }

    // Provenance
    if ($('#cc-provenance-toggle').checked) {
      params.set('provenance', 'on');
      params.set('provenance_model', $('#cc-provenance-model').value);
      params.set('provenance_date', $('#cc-provenance-date').value);
      var provBg = $('#cc-provenance-bg-hex').value;
      if (provBg && provBg !== '#f7f8fa') params.set('provenance_bg', provBg);
      var provStyle = getSegValue('cc-provenance-trigger-style');
      if (provStyle && provStyle !== 'circle') params.set('provenance_trigger_style', provStyle);
    }

    // Nudge
    if ($('#cc-nudge-toggle').checked) {
      params.set('nudge', getSegValue('cc-nudge-trigger') || 'share');
      params.set('nudge_text', $('#cc-nudge-msg').value);
      var nProceed = $('#cc-nudge-proceed-text').value;
      if (nProceed) params.set('nudge_proceed_text', nProceed);
      var nCancel = $('#cc-nudge-cancel-text').value;
      if (nCancel && nCancel !== 'Cancel') params.set('nudge_cancel_text', nCancel);
      var nIcon = getIconValue('cc-nudge-icon-picker');
      if (nIcon && nIcon !== 'fas fa-exclamation-triangle') params.set('nudge_icon', nIcon);
    }

    // Community Notes
    if ($('#cc-notes-toggle').checked) {
      params.set('community_notes', 'on');
      params.set('community_notes_text', $('#cc-notes-text').value);
      var cnTitle = $('#cc-notes-title').value;
      if (cnTitle && cnTitle !== 'Readers added context') params.set('community_notes_title', cnTitle);
      var cnBg = $('#cc-notes-bg-hex').value;
      if (cnBg && cnBg !== '#FEF9EF') params.set('community_notes_bg', cnBg);
      var cnBorder = $('#cc-notes-border-hex').value;
      if (cnBorder && cnBorder !== '#F5DEB3') params.set('community_notes_border', cnBorder);
      if (!$('#cc-notes-rate-show').checked) params.set('community_notes_rate_show', 'off');
    }

    // AI Icon
    if ($('#cc-aiicon-toggle').checked) {
      params.set('ai_icon', getSegValue('cc-aiicon-type') || 'full');
      var aiLabel = $('#cc-aiicon-label').value;
      if (aiLabel) params.set('ai_icon_label', aiLabel);
      var aiIcon = getIconValue('cc-aiicon-icon-picker');
      if (aiIcon && aiIcon !== 'fas fa-wand-magic-sparkles') params.set('ai_icon_icon', aiIcon);
      var aiPos = getSegValue('cc-aiicon-pos');
      if (aiPos && aiPos !== 'media') params.set('ai_icon_pos', aiPos);
      var aiBg = $('#cc-aiicon-bg-hex').value;
      if (aiBg) params.set('ai_icon_bg', aiBg);
      var aiTx = $('#cc-aiicon-text-hex').value;
      if (aiTx && aiTx !== '#ffffff') params.set('ai_icon_text_color', aiTx);
      // Canvas drag position and size (if dragged/resized)
      if (typeof SailCanvasManager !== 'undefined') {
        var positions = SailCanvasManager.getPositions();
        if (positions.ai_icon) {
          params.set('ai_icon_x_pct', positions.ai_icon.xPct);
          params.set('ai_icon_y_pct', positions.ai_icon.yPct);
          if (positions.ai_icon.widthPct) params.set('ai_icon_w_pct', positions.ai_icon.widthPct);
          if (positions.ai_icon.heightPct) params.set('ai_icon_h_pct', positions.ai_icon.heightPct);
        }
      }
    }

    return platform.path + '?' + params.toString();
  };

  // ============================================================
  // PRESETS
  // ============================================================

  var BUILT_IN_PRESETS = {
    subtle: {
      badge: { enabled: true, text: 'AI content', pos: 'footer', bgColor: '#71767B', textColor: '#ffffff', icon: 'fas fa-info-circle', fontSize: 10, radius: 20, opacity: 70 },
      interstitial: { enabled: false },
      provenance: { enabled: false },
      nudge: { enabled: false },
      notes: { enabled: false },
      aiicon: { enabled: false }
    },
    standard: {
      badge: { enabled: true, text: 'AI-generated content', pos: 'header', bgColor: '#1D9BF0', textColor: '#ffffff', icon: 'fas fa-info-circle', fontSize: 12, radius: 20, opacity: 100 },
      interstitial: { enabled: false },
      provenance: { enabled: false },
      nudge: { enabled: false },
      notes: { enabled: true, title: 'Readers added context', text: 'Readers added context they thought people might want to know.', bg: '#FEF9EF', border: '#F5DEB3', rateShow: true },
      aiicon: { enabled: false }
    },
    bold: {
      badge: { enabled: true, text: 'AI-generated image', pos: 'media', bgColor: '#E0245E', textColor: '#ffffff', icon: 'fas fa-exclamation-triangle', fontSize: 14, radius: 8, opacity: 100 },
      interstitial: { enabled: true, msg: 'Warning: This content was generated by artificial intelligence.', btnText: 'I understand', icon: 'fas fa-hand', opacity: 80, blur: 12 },
      provenance: { enabled: false },
      nudge: { enabled: false },
      notes: { enabled: false },
      aiicon: { enabled: true, type: 'full', label: 'AI', icon: 'fas fa-robot', pos: 'media', bg: '#000000', textColor: '#ffffff' }
    },
    eu_compliant: {
      badge: { enabled: true, text: 'AI-generated', pos: 'header', bgColor: '#71767B', textColor: '#ffffff', icon: 'fas fa-shield-halved', fontSize: 12, radius: 20, opacity: 100 },
      interstitial: { enabled: false },
      provenance: { enabled: true, model: 'GPT-4', date: '2025-01-15', bg: '#f7f8fa', triggerStyle: 'circle' },
      nudge: { enabled: false },
      notes: { enabled: false },
      aiicon: { enabled: true, type: 'full', label: 'AI Generated', icon: 'fas fa-microchip', pos: 'header', bg: '#000000', textColor: '#ffffff' }
    },
    research_max: {
      badge: { enabled: true, text: 'AI-generated content', pos: 'header', bgColor: '#1D9BF0', textColor: '#ffffff', icon: 'fas fa-info-circle', fontSize: 12, radius: 20, opacity: 100 },
      interstitial: { enabled: true, msg: 'This content may contain AI-generated material. Please review with care.', btnText: 'Continue', icon: 'fas fa-exclamation-triangle', opacity: 70, blur: 8 },
      provenance: { enabled: true, model: 'AI Language Model', date: '2025', bg: '#f7f8fa', triggerStyle: 'circle' },
      nudge: { enabled: true, trigger: 'share', msg: 'Is this information accurate? Consider checking before sharing.', proceedText: 'Share Anyway', cancelText: 'Cancel', icon: 'fas fa-exclamation-triangle' },
      notes: { enabled: true, title: 'Readers added context', text: 'Readers added context they thought people might want to know.', bg: '#FEF9EF', border: '#F5DEB3', rateShow: true },
      aiicon: { enabled: true, type: 'full', label: 'AI', icon: 'fas fa-wand-magic-sparkles', pos: 'media', bg: '#000000', textColor: '#ffffff' }
    }
  };

  function applyCcPreset(presetName) {
    var preset = BUILT_IN_PRESETS[presetName];
    if (!preset) return;

    // Badge
    var b = preset.badge || {};
    $('#cc-badge-toggle').checked = !!b.enabled;
    if (b.text) $('#cc-badge-text').value = b.text;
    if (b.pos) setSegValue('cc-badge-pos', b.pos);
    if (b.bgColor) { $('#cc-badge-bg-color').value = b.bgColor; $('#cc-badge-bg-hex').value = b.bgColor; }
    if (b.textColor) { $('#cc-badge-text-color').value = b.textColor; $('#cc-badge-text-hex').value = b.textColor; }
    if (b.icon) setIconValue('cc-badge-icon-picker', b.icon);
    if (b.fontSize != null) { $('#cc-badge-font-size').value = b.fontSize; $('#cc-badge-fs-val').textContent = b.fontSize + 'px'; }
    if (b.radius != null) { $('#cc-badge-radius').value = b.radius; $('#cc-badge-radius-val').textContent = b.radius + 'px'; }
    if (b.opacity != null) { $('#cc-badge-opacity').value = b.opacity; $('#cc-badge-opacity-val').textContent = (b.opacity / 100).toFixed(2); }

    // Interstitial
    var it = preset.interstitial || {};
    $('#cc-interstitial-toggle').checked = !!it.enabled;
    if (it.msg) $('#cc-interstitial-msg').value = it.msg;
    if (it.btnText) $('#cc-interstitial-btn-text').value = it.btnText;
    if (it.icon) setIconValue('cc-interstitial-icon-picker', it.icon);
    if (it.opacity != null) { $('#cc-interstitial-opacity').value = it.opacity; $('#cc-interstitial-opacity-val').textContent = (it.opacity / 100).toFixed(2); }
    if (it.blur != null) { $('#cc-interstitial-blur').value = it.blur; $('#cc-interstitial-blur-val').textContent = it.blur + 'px'; }

    // Provenance
    var pv = preset.provenance || {};
    $('#cc-provenance-toggle').checked = !!pv.enabled;
    if (pv.model) $('#cc-provenance-model').value = pv.model;
    if (pv.date) $('#cc-provenance-date').value = pv.date;
    if (pv.bg) { $('#cc-provenance-bg-color').value = pv.bg; $('#cc-provenance-bg-hex').value = pv.bg; }
    if (pv.triggerStyle) setSegValue('cc-provenance-trigger-style', pv.triggerStyle);

    // Nudge
    var n = preset.nudge || {};
    $('#cc-nudge-toggle').checked = !!n.enabled;
    if (n.trigger) setSegValue('cc-nudge-trigger', n.trigger);
    if (n.msg) $('#cc-nudge-msg').value = n.msg;
    if (n.proceedText) $('#cc-nudge-proceed-text').value = n.proceedText;
    if (n.cancelText) $('#cc-nudge-cancel-text').value = n.cancelText;
    if (n.icon) setIconValue('cc-nudge-icon-picker', n.icon);

    // Community Notes
    var cn = preset.notes || {};
    $('#cc-notes-toggle').checked = !!cn.enabled;
    if (cn.title) $('#cc-notes-title').value = cn.title;
    if (cn.text) $('#cc-notes-text').value = cn.text;
    if (cn.bg) { $('#cc-notes-bg-color').value = cn.bg; $('#cc-notes-bg-hex').value = cn.bg; }
    if (cn.border) { $('#cc-notes-border-color').value = cn.border; $('#cc-notes-border-hex').value = cn.border; }
    if (cn.rateShow != null) $('#cc-notes-rate-show').checked = cn.rateShow;

    // AI Icon
    var ai = preset.aiicon || {};
    $('#cc-aiicon-toggle').checked = !!ai.enabled;
    if (ai.type) setSegValue('cc-aiicon-type', ai.type);
    if (ai.label) $('#cc-aiicon-label').value = ai.label;
    if (ai.icon) setIconValue('cc-aiicon-icon-picker', ai.icon);
    if (ai.pos) setSegValue('cc-aiicon-pos', ai.pos);
    if (ai.bg) { $('#cc-aiicon-bg-color').value = ai.bg; $('#cc-aiicon-bg-hex').value = ai.bg; }
    if (ai.textColor) { $('#cc-aiicon-text-color').value = ai.textColor; $('#cc-aiicon-text-hex').value = ai.textColor; }

    // Sync to intervention section and update preview
    syncCCToInt();
    updateUrlPreview();
    updateEditorPreview();
    updateCcDots();
    showToast('Preset applied: ' + presetName.replace(/_/g, ' '));
  }

  // ---- Save/Load/Reset ----

  function gatherPreset() {
    return {
      version: 2,
      platform: currentPlatform,
      feed_settings: {
        total_posts: parseInt($('#cfg-total-posts').value, 10),
        stimuli_count: parseInt($('#cfg-stimuli-count').value, 10),
        filler_ratio: parseInt($('#cfg-filler-ratio').value, 10),
        first_n_fillers: parseInt($('#cfg-first-n-fillers').value, 10),
        randomize_order: $('#cfg-randomize').checked
      },
      participant: {
        gender: $('#cfg-gender').value,
        age: $('#cfg-age').value,
        politics: parseInt($('#cfg-politics').value, 10),
        issue: $('#cfg-issue').value
      },
      interventions: {
        badge: {
          enabled: $('#cc-badge-toggle').checked,
          text: $('#cc-badge-text').value,
          position: getSegValue('cc-badge-pos'),
          bgColor: $('#cc-badge-bg-hex').value,
          textColor: $('#cc-badge-text-hex').value,
          icon: getIconValue('cc-badge-icon-picker'),
          fontSize: parseInt($('#cc-badge-font-size').value, 10),
          radius: parseInt($('#cc-badge-radius').value, 10),
          opacity: parseInt($('#cc-badge-opacity').value, 10)
        },
        interstitial: {
          enabled: $('#cc-interstitial-toggle').checked,
          text: $('#cc-interstitial-msg').value,
          btnText: $('#cc-interstitial-btn-text').value,
          icon: getIconValue('cc-interstitial-icon-picker'),
          opacity: parseInt($('#cc-interstitial-opacity').value, 10),
          blur: parseInt($('#cc-interstitial-blur').value, 10)
        },
        provenance: {
          enabled: $('#cc-provenance-toggle').checked,
          model: $('#cc-provenance-model').value,
          date: $('#cc-provenance-date').value,
          bg: $('#cc-provenance-bg-hex').value,
          triggerStyle: getSegValue('cc-provenance-trigger-style')
        },
        nudge: {
          enabled: $('#cc-nudge-toggle').checked,
          trigger: getSegValue('cc-nudge-trigger'),
          text: $('#cc-nudge-msg').value,
          proceedText: $('#cc-nudge-proceed-text').value,
          cancelText: $('#cc-nudge-cancel-text').value,
          icon: getIconValue('cc-nudge-icon-picker')
        },
        community_notes: {
          enabled: $('#cc-notes-toggle').checked,
          title: $('#cc-notes-title').value,
          text: $('#cc-notes-text').value,
          bg: $('#cc-notes-bg-hex').value,
          border: $('#cc-notes-border-hex').value,
          rateShow: $('#cc-notes-rate-show').checked
        },
        ai_icon: {
          enabled: $('#cc-aiicon-toggle').checked,
          type: getSegValue('cc-aiicon-type'),
          label: $('#cc-aiicon-label').value,
          icon: getIconValue('cc-aiicon-icon-picker'),
          pos: getSegValue('cc-aiicon-pos'),
          bg: $('#cc-aiicon-bg-hex').value,
          textColor: $('#cc-aiicon-text-hex').value
        }
      },
      canvas_positions: typeof SailCanvasManager !== 'undefined' ? SailCanvasManager.getPositions() : {}
    };
  }

  function applyPreset(preset) {
    if (!preset) return;

    var fs = preset.feed_settings || {};
    if (fs.total_posts != null) $('#cfg-total-posts').value = fs.total_posts;
    if (fs.stimuli_count != null) $('#cfg-stimuli-count').value = fs.stimuli_count;
    if (fs.filler_ratio != null) $('#cfg-filler-ratio').value = fs.filler_ratio;
    if (fs.first_n_fillers != null) $('#cfg-first-n-fillers').value = fs.first_n_fillers;
    if (fs.randomize_order != null) $('#cfg-randomize').checked = fs.randomize_order;

    var pa = preset.participant || {};
    if (pa.gender) $('#cfg-gender').value = pa.gender;
    if (pa.age) $('#cfg-age').value = pa.age;
    if (pa.politics != null) {
      $('#cfg-politics').value = pa.politics;
      $('#politics-value').textContent = pa.politics;
    }
    if (pa.issue) $('#cfg-issue').value = pa.issue;

    var intv = preset.interventions || {};

    // Version 2 preset (from CC) — apply directly
    if (preset.version === 2) {
      var b = intv.badge || {};
      $('#cc-badge-toggle').checked = !!b.enabled;
      if (b.text) $('#cc-badge-text').value = b.text;
      if (b.position) setSegValue('cc-badge-pos', b.position);
      if (b.bgColor) { $('#cc-badge-bg-color').value = b.bgColor; $('#cc-badge-bg-hex').value = b.bgColor; }
      if (b.textColor) { $('#cc-badge-text-color').value = b.textColor; $('#cc-badge-text-hex').value = b.textColor; }
      if (b.icon) setIconValue('cc-badge-icon-picker', b.icon);
      if (b.fontSize != null) { $('#cc-badge-font-size').value = b.fontSize; $('#cc-badge-fs-val').textContent = b.fontSize + 'px'; }
      if (b.radius != null) { $('#cc-badge-radius').value = b.radius; $('#cc-badge-radius-val').textContent = b.radius + 'px'; }
      if (b.opacity != null) { $('#cc-badge-opacity').value = b.opacity; $('#cc-badge-opacity-val').textContent = (b.opacity / 100).toFixed(2); }

      var it = intv.interstitial || {};
      $('#cc-interstitial-toggle').checked = !!it.enabled;
      if (it.text) $('#cc-interstitial-msg').value = it.text;
      if (it.btnText) $('#cc-interstitial-btn-text').value = it.btnText;
      if (it.icon) setIconValue('cc-interstitial-icon-picker', it.icon);
      if (it.opacity != null) { $('#cc-interstitial-opacity').value = it.opacity; $('#cc-interstitial-opacity-val').textContent = (it.opacity / 100).toFixed(2); }
      if (it.blur != null) { $('#cc-interstitial-blur').value = it.blur; $('#cc-interstitial-blur-val').textContent = it.blur + 'px'; }

      var pv = intv.provenance || {};
      $('#cc-provenance-toggle').checked = !!pv.enabled;
      if (pv.model) $('#cc-provenance-model').value = pv.model;
      if (pv.date) $('#cc-provenance-date').value = pv.date;
      if (pv.bg) { $('#cc-provenance-bg-color').value = pv.bg; $('#cc-provenance-bg-hex').value = pv.bg; }
      if (pv.triggerStyle) setSegValue('cc-provenance-trigger-style', pv.triggerStyle);

      var n = intv.nudge || {};
      $('#cc-nudge-toggle').checked = !!n.enabled;
      if (n.trigger) setSegValue('cc-nudge-trigger', n.trigger);
      if (n.text) $('#cc-nudge-msg').value = n.text;
      if (n.proceedText) $('#cc-nudge-proceed-text').value = n.proceedText;
      if (n.cancelText) $('#cc-nudge-cancel-text').value = n.cancelText;
      if (n.icon) setIconValue('cc-nudge-icon-picker', n.icon);

      var cn = intv.community_notes || {};
      $('#cc-notes-toggle').checked = !!cn.enabled;
      if (cn.title) $('#cc-notes-title').value = cn.title;
      if (cn.text) $('#cc-notes-text').value = cn.text;
      if (cn.bg) { $('#cc-notes-bg-color').value = cn.bg; $('#cc-notes-bg-hex').value = cn.bg; }
      if (cn.border) { $('#cc-notes-border-color').value = cn.border; $('#cc-notes-border-hex').value = cn.border; }
      if (cn.rateShow != null) $('#cc-notes-rate-show').checked = cn.rateShow;

      var ai = intv.ai_icon || {};
      $('#cc-aiicon-toggle').checked = !!ai.enabled;
      if (ai.type) setSegValue('cc-aiicon-type', ai.type);
      if (ai.label) $('#cc-aiicon-label').value = ai.label;
      if (ai.icon) setIconValue('cc-aiicon-icon-picker', ai.icon);
      if (ai.pos) setSegValue('cc-aiicon-pos', ai.pos);
      if (ai.bg) { $('#cc-aiicon-bg-color').value = ai.bg; $('#cc-aiicon-bg-hex').value = ai.bg; }
      if (ai.textColor) { $('#cc-aiicon-text-color').value = ai.textColor; $('#cc-aiicon-text-hex').value = ai.textColor; }
    } else {
      // Version 1 backward compat: simpler fields
      var ob = intv.badge || {};
      $('#cc-badge-toggle').checked = !!ob.enabled;
      if (ob.text) $('#cc-badge-text').value = ob.text;
      if (ob.position) setSegValue('cc-badge-pos', ob.position);
      var colorToHex = { blue: '#1D9BF0', red: '#E0245E', orange: '#F59E0B', gray: '#71767B' };
      if (ob.color && colorToHex[ob.color]) {
        $('#cc-badge-bg-color').value = colorToHex[ob.color];
        $('#cc-badge-bg-hex').value = colorToHex[ob.color];
      }

      var oit = intv.interstitial || {};
      $('#cc-interstitial-toggle').checked = !!oit.enabled;
      if (oit.text) $('#cc-interstitial-msg').value = oit.text;

      var opv = intv.provenance || {};
      $('#cc-provenance-toggle').checked = !!opv.enabled;
      if (opv.model) $('#cc-provenance-model').value = opv.model;
      if (opv.date) $('#cc-provenance-date').value = opv.date;

      var on = intv.nudge || {};
      $('#cc-nudge-toggle').checked = !!on.enabled;
      if (on.trigger) setSegValue('cc-nudge-trigger', on.trigger);
      if (on.text) $('#cc-nudge-msg').value = on.text;

      var ocn = intv.community_notes || {};
      $('#cc-notes-toggle').checked = !!ocn.enabled;
      if (ocn.text) $('#cc-notes-text').value = ocn.text;

      var oai = intv.ai_icon || {};
      $('#cc-aiicon-toggle').checked = !!oai.enabled;
      if (oai.type) setSegValue('cc-aiicon-type', oai.type);
    }

    syncCCToInt();
    updateUrlPreview();
    updateEditorPreview();
    updateCcDots();

    // Restore canvas positions if available
    if (preset.canvas_positions && typeof SailCanvasManager !== 'undefined') {
      SailCanvasManager.setPositions(preset.canvas_positions);
    }
  }

  function savePreset() {
    var preset = gatherPreset();
    var blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var name = currentPlatform || 'sail';
    a.download = name + '-preset-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Preset saved as JSON');
  }

  function loadPreset(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var preset = JSON.parse(e.target.result);
        applyPreset(preset);
        showToast('Preset loaded successfully');
      } catch (err) {
        showToast('Invalid preset file');
        console.error('Preset load error:', err);
      }
    };
    reader.readAsText(file);
  }

  function resetPreview() {
    // Turn off all CC toggles
    ['#cc-badge-toggle', '#cc-interstitial-toggle', '#cc-provenance-toggle',
     '#cc-nudge-toggle', '#cc-notes-toggle', '#cc-aiicon-toggle'].forEach(function (sel) {
      $(sel).checked = false;
    });
    // Turn off all int toggles & collapse
    ['#int-badge-toggle', '#int-interstitial-toggle', '#int-provenance-toggle',
     '#int-nudge-toggle', '#int-notes-toggle', '#int-aiicon-toggle'].forEach(function (sel) {
      $(sel).checked = false;
    });
    ['#int-badge-settings', '#int-interstitial-settings', '#int-provenance-settings',
     '#int-nudge-settings', '#int-notes-settings', '#int-aiicon-settings'].forEach(function (sel) {
      $(sel).classList.remove('open');
    });
    $$('.cc-preset-chip[data-preset]').forEach(function (c) { c.classList.remove('active'); });
    // Clear canvas objects
    if (typeof SailCanvasManager !== 'undefined') {
      SailCanvasManager.clearAll();
    }
    updateUrlPreview();
    updateEditorPreview();
    updateCcDots();
    showToast('All interventions reset');
  }

  // ---- Scroll Spy ----
  function setupScrollSpy() {
    var sections = $$('.config-section');
    if (!sections.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.id;
          $$('.sidebar-link').forEach(function (link) {
            link.classList.toggle('active', link.getAttribute('data-section') === id);
          });
        }
      });
    }, {
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0
    });

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

})();
