/**
 * Wave - microblog-style participant interface
 * Depends on circl-core.js (shared utilities) and feed-loader.js (shared data loading)
 */

// ============================================
// STATE
// ============================================
let xfViewTimes = {};
let xfViewTrackingObserver = null;
let xfViewTimerInterval = null;
let xfIsPageVisible = true;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', initXFeed);

async function initXFeed() {
  const params = xfGetParams();
  const loader = document.getElementById('survey-loader');
  const messageEl = document.getElementById('loading-message');

  let loadingMessages = ['Loading...'];
  let messageInterval = null;
  let messageIndex = 0;

  try {
    const useJsonFeed = params.source === 'json' && typeof FeedLoader !== 'undefined';

    if (!useJsonFeed) {
      xfShowError('Wave requires source=json. Add ?source=json to the URL.');
      return;
    }

    // Build feed options from URL params
    const feedOptions = {};
    if (params.gender || params.age || params.politics || params.issue) {
      feedOptions.personalization = {
        gender: params.gender,
        age: params.age,
        politics: params.politics,
        issue: params.issue
      };
    }
    if (params.totalPosts) {
      feedOptions.totalPosts = params.totalPosts;
    }

    // Load feed via shared FeedLoader
    const feedData = await FeedLoader.loadFeed('../circl/data/feed-config.json', feedOptions);

    // Get loading messages from locale
    const locale = feedData.config.locale || {};
    loadingMessages = locale.loading_messages || ['Loading your feed...'];

    if (messageEl && loadingMessages.length > 0) {
      messageEl.textContent = loadingMessages[0];
      messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        messageEl.textContent = loadingMessages[messageIndex];
      }, 600);
    }

    // Set debug mode (global from circl-core.js)
    debugMode = params.debug;

    // Wait for loading animation
    await new Promise(r => setTimeout(r, 2500));
    if (messageInterval) clearInterval(messageInterval);

    // Render the feed
    xfRenderFeed(feedData.posts, feedData.config);

    // Start view tracking in debug mode
    if (params.debug) {
      document.getElementById('xf-results-btn').style.display = 'flex';
      xfStartViewTracking();
    }

    // Clean up URL params
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Fade out loader
    loader.classList.add('fade-out');
    setTimeout(() => {
      loader.style.display = 'none';
      loader.remove();
    }, 500);

    // Setup coming soon tooltips for non-functional UI
    xfSetupTooltips();

    // Setup tab switching
    xfSetupTabs();

  } catch (error) {
    console.error('XFeed: Error loading feed:', error);
    xfShowError('Could not load the feed. Please try again later.');
  }
}

// ============================================
// FEED RENDERING
// ============================================
function xfRenderFeed(posts, config) {
  const container = document.getElementById('xf-feed-container');
  if (!container) return;
  container.innerHTML = '';

  posts.forEach((post, index) => {
    const tweetEl = xfCreateTweet(post, index);
    container.appendChild(tweetEl);
  });

  // Setup video handlers
  xfSetupVideos();
}

// ============================================
// TWEET CREATION
// ============================================
function xfCreateTweet(postData, index) {
  const tweet = document.createElement('article');
  tweet.className = 'xf-tweet';

  const isStimulus = postData.type === 'stimulus';
  const isVideo = postData.subtype === 'video';
  const isArticle = postData.subtype === 'article';
  const isOrg = postData.subtype === 'organization' ||
    ((isArticle || isVideo) && postData.author?.fallback_icon && !postData.author?.gender);
  const isTailored = postData._isTailored || false;
  const hasImage = postData.image && postData.image.show !== false;

  const postId = `xf-${postData.type}-${postData.id || index}-${Date.now()}`;
  tweet.dataset.postId = postId;
  tweet.dataset.postType = postData.type;

  if (isStimulus) {
    tweet.dataset.isTailored = isTailored ? 'true' : 'false';
    tweet.dataset.conditionId = postData.condition_id || '';
  }

  const author = postData.author || {};
  const authorName = author.name || 'Unknown';
  const engagement = postData.engagement || { likes: 0, comments: 0, shares: 0 };
  const postText = postData.text || '';
  const time = postData.time || '1h';

  // Generate handle from author name
  const handle = '@' + authorName.replace(/\s+/g, '_').toLowerCase();

  // Determine if this author gets a verified badge
  // Organizations and stimulus posts get verified badges
  const showVerified = isOrg || isStimulus;

  // ---- AVATAR HTML ----
  let avatarHtml;
  if (isOrg) {
    if (author.logo_url) {
      avatarHtml = `
        <div class="xf-tweet-avatar xf-tweet-avatar-org">
          <img src="${author.logo_url}" alt="${authorName}"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div class="xf-tweet-avatar-fallback xf-tweet-avatar-org" style="display:none;">
            <i class="fas fa-${author.fallback_icon || 'building'}"></i>
          </div>
        </div>`;
    } else {
      avatarHtml = `
        <div class="xf-tweet-avatar xf-tweet-avatar-org">
          <div class="xf-tweet-avatar-fallback xf-tweet-avatar-org">
            <i class="fas fa-${author.fallback_icon || 'building'}"></i>
          </div>
        </div>`;
    }
  } else {
    if (author.avatar_url) {
      const initials = author.initials || authorName.split(' ').map(n => n[0]).join('').toUpperCase();
      const fallbackColor = postData._fallbackColor || '#1D9BF0';
      avatarHtml = `
        <div class="xf-tweet-avatar">
          <img src="${author.avatar_url}" alt="${authorName}"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div class="xf-tweet-avatar-fallback" style="display:none; background: ${fallbackColor};">${initials}</div>
        </div>`;
    } else {
      const initials = author.initials || authorName.split(' ').map(n => n[0]).join('').toUpperCase();
      const fallbackColor = postData._fallbackColor || '#1D9BF0';
      avatarHtml = `
        <div class="xf-tweet-avatar">
          <div class="xf-tweet-avatar-fallback" style="background: ${fallbackColor};">${initials}</div>
        </div>`;
    }
  }

  // ---- VERIFIED BADGE HTML ----
  let verifiedHtml = '';
  if (showVerified) {
    if (isOrg) {
      // Gold badge for organization accounts
      verifiedHtml = '<i class="fas fa-circle-check xf-verified-badge-gold"></i>';
    } else {
      // Blue badge for individual verified accounts
      verifiedHtml = '<i class="fas fa-circle-check xf-verified-badge"></i>';
    }
  }

  // ---- MEDIA HTML ----
  let mediaHtml = '';

  if (isVideo && postData.video) {
    const video = postData.video;
    const videoSrc = video.src || '';
    const posterSrc = video.thumbnail || '';
    const duration = video.duration || '';
    const durationBadge = duration ? `<span class="xf-video-duration">${duration}</span>` : '';

    mediaHtml = `
      <div class="xf-tweet-video" data-video-id="${postData.id || index}">
        <video class="xf-post-video" preload="metadata" playsinline
               ${posterSrc ? `poster="${posterSrc}"` : ''}>
          <source src="${videoSrc}" type="video/mp4">
        </video>
        <div class="xf-video-overlay">
          <div class="xf-video-play-btn"><i class="fas fa-play"></i></div>
        </div>
        ${durationBadge}
        <button class="xf-video-mute-btn">
          <i class="fas fa-volume-xmark"></i>
        </button>
      </div>`;
  } else if (isArticle && postData.article) {
    const article = postData.article;
    const thumbUrl = article.thumbnail || '';
    const articleUrl = article.url || '#';
    const domain = article.source || 'Unknown';

    mediaHtml = `
      <div class="xf-tweet-article" data-article-id="${postData.id || index}" data-url="${articleUrl}">
        ${thumbUrl ? `<div class="xf-article-thumb"><img src="${thumbUrl}" alt="${article.title || ''}" onerror="this.parentElement.style.display='none';"></div>` : ''}
        <div class="xf-article-body">
          <div class="xf-article-domain"><i class="fas fa-link"></i> ${domain}</div>
          <div class="xf-article-title">${article.title || 'Untitled'}</div>
        </div>
      </div>`;
  } else if (hasImage) {
    mediaHtml = `
      <div class="xf-tweet-media">
        <img src="${postData.image.src}" alt="${postData.image.alt || 'Post image'}"
             loading="lazy" onerror="this.parentElement.style.display='none';">
      </div>`;
  }

  // ---- TEXT HTML ----
  const textHtml = postText
    ? `<div class="xf-tweet-text">${xfFormatText(postText)}</div>`
    : '';

  // ---- ENGAGEMENT COUNTS ----
  const replyCount = Math.floor(engagement.comments * 0.6);
  const retweetCount = engagement.shares;
  const likeCount = engagement.likes;
  const viewCount = likeCount * Math.floor(Math.random() * 40 + 20);
  const bookmarkCount = Math.floor(likeCount * 0.12);

  // ---- DEBUG HTML ----
  let debugHtml = '';
  if (debugMode && isStimulus && postData.metadata) {
    const tagClass = isTailored ? 'tailored' : 'random';
    const tagIcon = isTailored ? 'fa-bullseye' : 'fa-dice';
    const tagLabel = isTailored ? 'TAILORED' : 'RANDOM';
    debugHtml = `
      <div class="xf-debug-badge">
        <span class="xf-debug-tag ${tagClass}"><i class="fas ${tagIcon}"></i> ${tagLabel}</span>
        <span class="xf-debug-detail">${postData.condition_id || ''}</span>
      </div>`;
  }

  // ---- VIEW TIMER (debug) ----
  const viewTimerHtml = debugMode ? '<div class="xf-view-timer" style="display:none;">0s</div>' : '';

  // ---- PROMOTED LABEL (random 5% chance for non-stimulus filler posts) ----
  let promotedHtml = '';
  if (!isStimulus && Math.random() < 0.05) {
    promotedHtml = `
      <div class="xf-promoted-label">
        <i class="fas fa-arrow-up-right-from-square"></i>
        <span>Promoted</span>
      </div>`;
  }

  // ---- ASSEMBLE TWEET ----
  tweet.innerHTML = `
    <div class="xf-tweet-avatar-col">
      ${avatarHtml}
    </div>
    <div class="xf-tweet-content">
      <div class="xf-tweet-header">
        <span class="xf-tweet-name">${authorName}</span>
        ${verifiedHtml}
        <span class="xf-tweet-handle">${handle}</span>
        <span class="xf-tweet-dot">&middot;</span>
        <span class="xf-tweet-time">${time}</span>
        <button class="xf-tweet-more"><i class="fas fa-ellipsis"></i></button>
      </div>
      ${textHtml}
      ${mediaHtml}
      ${debugHtml}
      ${viewTimerHtml}
      <div class="xf-tweet-engagement">
        <button class="xf-engage-btn xf-reply" onclick="xfComingSoon(event)">
          <span class="xf-engage-icon"><i class="far fa-comment"></i></span>
          <span class="xf-engage-count">${xfFormatCount(replyCount)}</span>
        </button>
        <button class="xf-engage-btn xf-retweet" data-count="${retweetCount}">
          <span class="xf-engage-icon"><i class="fas fa-retweet"></i></span>
          <span class="xf-engage-count">${xfFormatCount(retweetCount)}</span>
        </button>
        <button class="xf-engage-btn xf-like" data-count="${likeCount}">
          <span class="xf-engage-icon"><i class="far fa-heart"></i></span>
          <span class="xf-engage-count">${xfFormatCount(likeCount)}</span>
        </button>
        <button class="xf-engage-btn xf-views" onclick="xfComingSoon(event)">
          <span class="xf-engage-icon"><i class="fas fa-chart-simple"></i></span>
          <span class="xf-engage-count">${xfFormatCount(viewCount)}</span>
        </button>
        <div style="display: flex; gap: 0;">
          <button class="xf-engage-btn xf-bookmark" onclick="xfComingSoon(event)">
            <span class="xf-engage-icon"><i class="far fa-bookmark"></i></span>
          </button>
          <button class="xf-engage-btn xf-share" onclick="xfComingSoon(event)">
            <span class="xf-engage-icon"><i class="fas fa-arrow-up-from-bracket"></i></span>
          </button>
        </div>
      </div>
      ${promotedHtml}
    </div>
  `;

  // Attach like/retweet handlers
  const likeBtn = tweet.querySelector('.xf-like');
  if (likeBtn) {
    likeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      xfToggleLike(this);
    });
  }

  const retweetBtn = tweet.querySelector('.xf-retweet');
  if (retweetBtn) {
    retweetBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      xfToggleRetweet(this);
    });
  }

  // Article click tracking
  const articleEl = tweet.querySelector('.xf-tweet-article');
  if (articleEl) {
    articleEl.addEventListener('click', function(e) {
      e.stopPropagation();
      xfTrackArticleClick(this);
    });
  }

  // Store post data for tracking
  tweet._postData = {
    postId: postId,
    postType: postData.type,
    type: isStimulus ? (isTailored ? 'ai-tailored' : 'ai-random') : 'placeholder',
    conditionId: postData.condition_id,
    isTailored: isTailored,
    authorName: authorName,
    likes: likeCount,
    comments: engagement.comments,
    shares: retweetCount,
    text: postText
  };

  return tweet;
}

// ============================================
// INTERACTIONS
// ============================================
function xfToggleLike(btn) {
  const countEl = btn.querySelector('.xf-engage-count');
  let count = xfParseCount(countEl.textContent);

  if (btn.classList.contains('active')) {
    btn.classList.remove('active');
    count--;
    btn.querySelector('i').className = 'far fa-heart';
  } else {
    btn.classList.add('active');
    count++;
    btn.querySelector('i').className = 'fas fa-heart';
    // Quick pop animation
    const icon = btn.querySelector('.xf-engage-icon');
    if (icon) {
      icon.style.transform = 'scale(1.2)';
      setTimeout(() => { icon.style.transform = ''; }, 200);
    }
  }

  countEl.textContent = xfFormatCount(count);
}

function xfToggleRetweet(btn) {
  const countEl = btn.querySelector('.xf-engage-count');
  let count = xfParseCount(countEl.textContent);

  if (btn.classList.contains('active')) {
    btn.classList.remove('active');
    count--;
  } else {
    btn.classList.add('active');
    count++;
  }

  countEl.textContent = xfFormatCount(count);
}

function xfTrackArticleClick(el) {
  const articleId = el.dataset.articleId;
  const url = el.dataset.url;

  console.log('[XFeed Article Click]', articleId, url);

  if (url && url !== '#') {
    window.open(url, '_blank');
  }
}

// ============================================
// VIDEO HANDLING
// ============================================
function xfSetupVideos() {
  document.querySelectorAll('.xf-tweet-video').forEach(container => {
    const video = container.querySelector('video');
    const overlay = container.querySelector('.xf-video-overlay');
    const muteBtn = container.querySelector('.xf-video-mute-btn');

    if (!video) return;

    video.muted = true;

    // Play/pause on click
    const togglePlay = () => {
      if (video.paused) {
        // Pause all other videos
        document.querySelectorAll('.xf-post-video').forEach(v => {
          if (v !== video && !v.paused) {
            v.pause();
            const otherContainer = v.closest('.xf-tweet-video');
            if (otherContainer) {
              const otherOverlay = otherContainer.querySelector('.xf-video-overlay');
              if (otherOverlay) otherOverlay.style.display = 'flex';
              otherContainer.classList.remove('playing');
            }
          }
        });

        video.play();
        if (overlay) overlay.style.display = 'none';
        container.classList.add('playing');
      } else {
        video.pause();
        if (overlay) overlay.style.display = 'flex';
        container.classList.remove('playing');
      }
    };

    container.addEventListener('click', (e) => {
      if (e.target.closest('.xf-video-mute-btn')) return;
      togglePlay();
    });

    // Mute toggle
    if (muteBtn) {
      muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        video.muted = !video.muted;
        const icon = muteBtn.querySelector('i');
        icon.className = video.muted ? 'fas fa-volume-xmark' : 'fas fa-volume-high';
      });
    }

    // Show overlay when video ends
    video.addEventListener('ended', () => {
      if (overlay) overlay.style.display = 'flex';
      container.classList.remove('playing');
    });
  });
}

// ============================================
// VIEW TRACKING
// ============================================
function xfStartViewTracking() {
  const tweets = document.querySelectorAll('.xf-tweet');

  xfViewTrackingObserver = new IntersectionObserver((entries) => {
    if (!xfIsPageVisible) return;

    entries.forEach(entry => {
      const postId = entry.target.dataset.postId;
      if (!postId) return;

      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        if (!xfViewTimes[postId]) {
          xfViewTimes[postId] = {
            totalTime: 0,
            lastEnterTime: Date.now(),
            author: entry.target._postData?.authorName || 'Unknown',
            type: entry.target._postData?.type || 'placeholder',
            isCurrentlyVisible: true
          };
        } else if (!xfViewTimes[postId].lastEnterTime) {
          xfViewTimes[postId].lastEnterTime = Date.now();
          xfViewTimes[postId].isCurrentlyVisible = true;
        }
      } else {
        if (xfViewTimes[postId] && xfViewTimes[postId].lastEnterTime) {
          xfViewTimes[postId].totalTime += Date.now() - xfViewTimes[postId].lastEnterTime;
          xfViewTimes[postId].lastEnterTime = null;
          xfViewTimes[postId].isCurrentlyVisible = false;
        }
      }
    });

    xfUpdateTimers();
  }, { threshold: 0.5 });

  tweets.forEach(tweet => xfViewTrackingObserver.observe(tweet));

  xfViewTimerInterval = setInterval(xfUpdateTimers, 1000);

  // Visibility handling
  document.addEventListener('visibilitychange', xfHandleVisibility);
  window.addEventListener('blur', xfHandleBlur);
  window.addEventListener('focus', xfHandleFocus);
}

function xfHandleVisibility() {
  if (document.hidden) {
    xfPauseTimers();
  } else {
    xfResumeTimers();
  }
}

function xfHandleBlur() {
  xfPauseTimers();
}

function xfHandleFocus() {
  if (!document.hidden) {
    xfResumeTimers();
  }
}

function xfPauseTimers() {
  if (!xfIsPageVisible) return;
  xfIsPageVisible = false;
  const now = Date.now();

  Object.values(xfViewTimes).forEach(d => {
    if (d.lastEnterTime) {
      d.totalTime += now - d.lastEnterTime;
      d.lastEnterTime = null;
    }
  });

  xfUpdateTimers();
}

function xfResumeTimers() {
  if (xfIsPageVisible) return;
  xfIsPageVisible = true;
  const now = Date.now();

  Object.values(xfViewTimes).forEach(d => {
    if (d.isCurrentlyVisible && !d.lastEnterTime) {
      d.lastEnterTime = now;
    }
  });

  xfUpdateTimers();
}

function xfUpdateTimers() {
  const now = Date.now();

  Object.entries(xfViewTimes).forEach(([postId, data]) => {
    let totalMs = data.totalTime;
    if (data.lastEnterTime && xfIsPageVisible) {
      totalMs += now - data.lastEnterTime;
    }

    const timerEl = document.querySelector(`[data-post-id="${postId}"] .xf-view-timer`);
    if (timerEl) {
      timerEl.textContent = `${Math.round(totalMs / 1000)}s`;
      if (debugMode) {
        timerEl.style.display = 'inline-block';
      }
    }
  });
}

// ============================================
// RESULTS
// ============================================
function xfShowResults() {
  const sorted = Object.entries(xfViewTimes)
    .map(([postId, data]) => ({
      postId,
      ...data,
      totalMs: data.totalTime + (data.lastEnterTime && xfIsPageVisible ? Date.now() - data.lastEnterTime : 0)
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 10);

  const body = document.getElementById('xf-results-body');
  body.innerHTML = sorted.map((item, idx) => {
    const typeLabel = item.type === 'ai-tailored' ? 'Tailored Stimulus'
                    : item.type === 'ai-random'   ? 'Random Stimulus'
                    : 'Filler';
    const seconds = Math.round(item.totalMs / 1000);

    return `
      <div class="xf-result-item">
        <div class="xf-result-rank">#${idx + 1}</div>
        <div class="xf-result-info">
          <div class="xf-result-author">${item.author}</div>
          <div class="xf-result-type">${typeLabel}</div>
        </div>
        <div class="xf-result-time">${seconds}s <small>viewed</small></div>
      </div>`;
  }).join('');

  document.getElementById('xf-results-modal').classList.add('active');
}

function xfCloseResults() {
  document.getElementById('xf-results-modal').classList.remove('active');
}

// ============================================
// URL PARAMS
// ============================================
function xfGetParams() {
  const params = new URLSearchParams(window.location.search);
  const age = params.get('age');
  const gender = params.get('gender');
  const issue = params.get('issue');
  const politics = params.get('politics');
  const debug = params.get('debug');
  const totalPosts = params.get('total_posts');
  const source = params.get('source');

  const validAges = ['18-29', '30-44', '45-59', '60+'];
  const validGenders = ['male', 'female'];
  const validIssues = [
    'Affordable_childcare_access',
    'Build_more_homes_accelerate_construction',
    'CO2_levy_for_industry_climate',
    'purchasing_power',
    'stop_weapon_ship_to_israel'
  ];
  const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  if (age && gender && issue && politics !== null) {
    const politicsNum = parseInt(politics);
    if (validAges.includes(age) && validGenders.includes(gender) && validIssues.includes(issue)
        && !isNaN(politicsNum) && politicsNum >= 0 && politicsNum <= 10) {
      let postsCount = 40;
      if (totalPosts) {
        const p = parseInt(totalPosts);
        if (!isNaN(p) && p >= 10 && p <= 100) postsCount = p;
      }
      return {
        age, gender, issue,
        politics: politicsNum,
        debug: debug === 'T' || debug === 'true' || debug === '1',
        totalPosts: postsCount,
        source: source || 'json',
        isRandom: false
      };
    }
  }

  return {
    age: randomPick(validAges),
    gender: randomPick(validGenders),
    issue: randomPick(validIssues),
    politics: Math.floor(Math.random() * 11),
    debug: debug === 'T' || debug === 'true' || debug === '1',
    totalPosts: 40,
    source: source || 'json',
    isRandom: true
  };
}

// ============================================
// FORMATTING UTILITIES
// ============================================
function xfFormatCount(num) {
  if (typeof num === 'string') num = parseInt(num) || 0;
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
}

function xfParseCount(str) {
  str = str.trim();
  if (str.endsWith('M')) return parseFloat(str) * 1000000;
  if (str.endsWith('K')) return parseFloat(str) * 1000;
  return parseInt(str) || 0;
}

/**
 * Format tweet text: linkify hashtags and @mentions
 */
function xfFormatText(text) {
  if (!text) return '';
  // Escape HTML first
  let safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Linkify hashtags
  safe = safe.replace(/(#\w+)/g, '<span class="xf-hashtag">$1</span>');
  // Linkify @mentions
  safe = safe.replace(/(@\w+)/g, '<span class="xf-hashtag">$1</span>');
  return safe;
}

// ============================================
// COMING SOON TOOLTIP
// ============================================
function xfComingSoon(event) {
  event.stopPropagation();
  const tooltip = document.getElementById('coming-soon-tooltip');
  tooltip.style.left = (event.clientX + 10) + 'px';
  tooltip.style.top = (event.clientY - 40) + 'px';
  tooltip.classList.add('show');
  setTimeout(() => tooltip.classList.remove('show'), 1500);
}

function xfSetupTooltips() {
  // Sidebar navigation items
  document.querySelectorAll('.xf-nav-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      xfComingSoon(e);
    });
  });

  // Right sidebar interactive elements (including premium card)
  document.querySelectorAll('.xf-trending-item, .xf-trending-more, .xf-follow-item, .xf-follow-more, .xf-follow-btn, .xf-search-input-wrap, .xf-premium-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      xfComingSoon(e);
    });
  });

  // Sidebar post button, profile
  document.querySelectorAll('.xf-post-btn, .xf-sidebar-profile').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      xfComingSoon(e);
    });
  });

  // Tweet more button
  document.querySelectorAll('.xf-tweet-more').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      xfComingSoon(e);
    });
  });
}

// ============================================
// TAB SWITCHING
// ============================================
function xfSetupTabs() {
  document.querySelectorAll('.xf-feed-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.xf-feed-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });
}

// ============================================
// ERROR HANDLING
// ============================================
function xfShowError(message) {
  const loader = document.getElementById('survey-loader');
  if (loader) {
    loader.innerHTML = `
      <div class="xf-loader-content">
        <div style="font-size: 48px; margin-bottom: 24px; color: var(--xf-text-secondary);">
          <i class="fas fa-circle-exclamation"></i>
        </div>
        <p class="xf-loader-message" style="color: var(--xf-text-primary); font-size: 16px; height: auto; overflow: visible;">${message}</p>
      </div>`;
  }
}
