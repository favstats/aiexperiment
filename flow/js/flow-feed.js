/**
 * Flow Feed - short video participant interface
 * Depends on circl-core.js (shared utilities) and feed-loader.js (shared data loading)
 */

// ============================================
// STATE
// ============================================
let sfViewTimes = {};
let sfCurrentIndex = 0;
let sfLastTap = 0;
let sfCards = [];

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', initSwipeFlowFeed);

async function initSwipeFlowFeed() {
  const params = sfGetParams();
  const loader = document.getElementById('survey-loader');
  const messageEl = document.getElementById('loading-message');

  let loadingMessages = ['Loading...'];
  let messageInterval = null;
  let messageIndex = 0;

  try {
    const useJsonFeed = params.source === 'json' && typeof FeedLoader !== 'undefined';

    if (!useJsonFeed) {
      showSfError('Flow requires source=json. Add ?source=json to the URL.');
      return;
    }

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

    const feedData = await FeedLoader.loadFeed('../circl/data/feed-config.json', feedOptions);

    const locale = feedData.config.locale || {};
    loadingMessages = locale.loading_messages || ['Loading your feed...'];
    if (messageEl && loadingMessages.length > 0) {
      messageEl.textContent = loadingMessages[0];
      messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        messageEl.textContent = loadingMessages[messageIndex];
      }, 600);
    }

    debugMode = params.debug;

    await new Promise(r => setTimeout(r, 2500));
    if (messageInterval) clearInterval(messageInterval);

    renderSwipeFlowFeed(feedData.posts, feedData.config);

    if (params.debug) {
      document.getElementById('sf-results-btn').style.display = 'flex';
      startSfViewTracking();
    }

    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    loader.classList.add('fade-out');
    setTimeout(() => {
      loader.style.display = 'none';
      loader.remove();
    }, 500);

    setupSfTooltips();
    setupFeedTabs();
    setupSfSearchAndLogin();

  } catch (error) {
    console.error('SwipeFlow: Error loading feed:', error);
    showSfError('Could not load the feed. Please try again later.');
  }
}

// ============================================
// FEED TABS (For You / Following)
// ============================================
function setupFeedTabs() {
  const tabs = document.querySelectorAll('.sf-feed-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // If "Following" tab clicked, show coming-soon
      if (tab.dataset.tab === 'following') {
        sfComingSoon(e);
      }
    });
  });
}

// ============================================
// SEARCH BAR & LOGIN BUTTON (coming-soon)
// ============================================
function setupSfSearchAndLogin() {
  const searchInput = document.getElementById('sf-search-input');
  if (searchInput) {
    searchInput.addEventListener('click', (e) => {
      e.preventDefault();
      sfComingSoon(e);
    });
    searchInput.addEventListener('focus', (e) => {
      e.preventDefault();
      searchInput.blur();
    });
  }

  const loginBtn = document.getElementById('sf-login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sfComingSoon(e);
    });
  }
}

// ============================================
// FEED RENDERING
// ============================================
function renderSwipeFlowFeed(posts, config) {
  const feed = document.getElementById('sf-feed');
  if (!feed) return;
  feed.innerHTML = '';
  sfCards = [];

  posts.forEach((post, index) => {
    const card = createSfCard(post, index, posts.length);
    feed.appendChild(card);
    sfCards.push(card);
  });

  setupSfIntersectionObserver();
  setupSfTapHandlers();

  setTimeout(() => {
    const firstCard = sfCards[0];
    if (firstCard) autoPlayCard(firstCard);
  }, 300);
}

// ============================================
// CARD CREATION
// ============================================
const sfGradients = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
  'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)'
];

function createSfCard(postData, index, totalPosts) {
  const card = document.createElement('div');
  card.className = 'sf-card sf-paused';

  const isStimulus = postData.type === 'stimulus';
  const isVideo = postData.subtype === 'video';
  const isArticle = postData.subtype === 'article';
  const isOrg = postData.subtype === 'organization' || (postData.author?.fallback_icon && !postData.author?.gender);
  const isTailored = postData._isTailored || false;
  const hasImage = postData.image && postData.image.show !== false;

  const postId = `sf-${postData.type}-${postData.id || index}-${Date.now()}`;
  card.dataset.postId = postId;
  card.dataset.postType = postData.type;
  card.dataset.index = index;
  if (isStimulus) {
    card.dataset.isTailored = isTailored ? 'true' : 'false';
    card.dataset.conditionId = postData.condition_id || '';
  }

  const author = postData.author || {};
  const authorName = author.name || 'Unknown';
  const engagement = postData.engagement || { likes: 0, comments: 0, shares: 0 };
  const postText = postData.text || '';

  // --- Background ---
  let bgHtml = '';
  if (isVideo && postData.video) {
    const videoSrc = postData.video.src || '';
    const poster = postData.video.thumbnail || '';
    bgHtml = `
      <div class="sf-card-bg">
        <video preload="metadata" loop playsinline muted
               ${poster ? `poster="${poster}"` : ''}
               data-src="${videoSrc}">
          <source src="${videoSrc}" type="video/mp4">
        </video>
      </div>`;
  } else if (hasImage || (isStimulus && postData.image)) {
    const imgSrc = postData.image?.src || '';
    bgHtml = `
      <div class="sf-card-bg">
        <img src="${imgSrc}" alt="" loading="lazy"
             onerror="this.parentElement.style.background='#222';">
      </div>`;
  } else if (isArticle && postData.article?.thumbnail) {
    bgHtml = `
      <div class="sf-card-bg">
        <img src="${postData.article.thumbnail}" alt="" loading="lazy"
             onerror="this.parentElement.style.background='#222';">
      </div>`;
  } else {
    const grad = sfGradients[index % sfGradients.length];
    bgHtml = `
      <div class="sf-card-bg sf-gradient" style="background: ${grad};">
        <div class="sf-gradient-text">${postText}</div>
      </div>`;
  }

  // --- Overlay ---
  const overlayHtml = `<div class="sf-card-overlay"></div>`;

  // --- Play/Pause indicator ---
  const playIndicatorHtml = `<div class="sf-play-indicator"><i class="fas fa-play"></i></div>`;

  // --- Progress bar (for video cards) ---
  const progressHtml = isVideo ? `<div class="sf-progress"><div class="sf-progress-bar"></div></div>` : '';

  // --- Avatar HTML for bottom ---
  let avatarInner;
  if (isOrg) {
    if (author.logo_url) {
      avatarInner = `<img src="${author.logo_url}" alt="${authorName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="sf-avatar-icon" style="display:none;"><i class="fas fa-${author.fallback_icon || 'building'}"></i></div>`;
    } else {
      avatarInner = `<div class="sf-avatar-icon"><i class="fas fa-${author.fallback_icon || 'building'}"></i></div>`;
    }
  } else if (author.avatar_url) {
    const initials = author.initials || authorName.split(' ').map(n => n[0]).join('').toUpperCase();
    avatarInner = `<img src="${author.avatar_url}" alt="${authorName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
      <div class="sf-avatar-icon" style="display:none; background: ${postData._fallbackColor || '#FE2C55'}; font-size:12px; font-weight:700;">${initials}</div>`;
  } else {
    const initials = author.initials || authorName.split(' ').map(n => n[0]).join('').toUpperCase();
    avatarInner = `<div class="sf-avatar-icon" style="background: ${postData._fallbackColor || '#FE2C55'}; font-size:12px; font-weight:700;">${initials}</div>`;
  }

  // --- Profile avatar for right-side actions ---
  let profileAvatarHtml;
  if (isOrg && author.logo_url) {
    profileAvatarHtml = `<img src="${author.logo_url}" alt="" onerror="this.style.display='none';">`;
  } else if (author.avatar_url) {
    profileAvatarHtml = `<img src="${author.avatar_url}" alt="" onerror="this.style.display='none';">`;
  } else if (isOrg) {
    profileAvatarHtml = `<div class="sf-avatar-icon"><i class="fas fa-${author.fallback_icon || 'building'}"></i></div>`;
  } else {
    const initials = author.initials || authorName.split(' ').map(n => n[0]).join('').toUpperCase();
    profileAvatarHtml = `<div class="sf-avatar-icon" style="background: ${postData._fallbackColor || '#FE2C55'}; font-size:12px; font-weight:700;">${initials}</div>`;
  }

  // --- Caption ---
  const isTextOnly = !isVideo && !hasImage && !(isStimulus && postData.image) && !(isArticle && postData.article?.thumbnail);
  const captionHtml = isTextOnly ? '' : (postText ? `
    <div class="sf-caption">${postText}</div>
    ${postText.length > 80 ? '<button class="sf-caption-more" onclick="sfToggleCaption(this)">more</button>' : ''}
  ` : '');

  // --- See translation ---
  const translationHtml = postText ? '<div class="sf-see-translation">See translation</div>' : '';

  // --- Music ticker ---
  const musicLabel = isVideo ? `Original sound — ${authorName}` : authorName;
  const musicHtml = `
    <div class="sf-music-row">
      <i class="fas fa-music"></i>
      <div class="sf-music-ticker">
        <span>${musicLabel} &nbsp;&nbsp;&nbsp; ${musicLabel} &nbsp;&nbsp;&nbsp;</span>
      </div>
    </div>`;

  // --- Article badge ---
  const articleBadgeHtml = isArticle && postData.article ? `
    <div class="sf-article-badge">
      <div class="sf-article-source">
        <i class="fas fa-link"></i>
        ${postData.article.source || 'Article'} — ${postData.article.title || ''}
      </div>
    </div>` : '';

  // --- Bottom info ---
  const handle = '@' + authorName.replace(/\s+/g, '_').toLowerCase();
  const bottomHtml = `
    <div class="sf-card-bottom">
      <div class="sf-author-row">
        <span class="sf-author-name">${handle}</span>
        <i class="fas fa-check-circle sf-verified"></i>
        <button class="sf-follow-btn">Follow</button>
      </div>
      ${captionHtml}
      ${translationHtml}
      ${musicHtml}
    </div>`;

  // --- Right-side actions (circular dark buttons) ---
  const actionsHtml = `
    <div class="sf-actions">
      <div class="sf-action sf-action-profile" onclick="sfComingSoon(event)">
        <div class="sf-action-profile-img">${profileAvatarHtml}</div>
        <div class="sf-action-plus">+</div>
      </div>
      <div class="sf-action sf-like-action" data-post-id="${postId}" onclick="sfToggleLike(this)">
        <div class="sf-action-icon-wrap"><i class="fas fa-heart"></i></div>
        <span class="sf-action-count">${formatSfCount(engagement.likes)}</span>
      </div>
      <div class="sf-action" onclick="sfComingSoon(event)">
        <div class="sf-action-icon-wrap"><i class="fas fa-comment-dots"></i></div>
        <span class="sf-action-count">${formatSfCount(engagement.comments)}</span>
      </div>
      <div class="sf-action" onclick="sfComingSoon(event)">
        <div class="sf-action-icon-wrap"><i class="fas fa-bookmark"></i></div>
        <span class="sf-action-count">${formatSfCount(Math.floor(engagement.likes * 0.15))}</span>
      </div>
      <div class="sf-action" onclick="sfComingSoon(event)">
        <div class="sf-action-icon-wrap"><i class="fas fa-share"></i></div>
        <span class="sf-action-count">${formatSfCount(engagement.shares)}</span>
      </div>
      <div class="sf-disc">
        ${isOrg && author.logo_url
          ? `<img src="${author.logo_url}" alt="" onerror="this.style.display='none';">`
          : (author.avatar_url ? `<img src="${author.avatar_url}" alt="" onerror="this.style.display='none';">` : '')}
      </div>
    </div>`;

  // --- Debug info ---
  let debugHtml = '';
  if (debugMode) {
    let tagClass = 'filler';
    let tagLabel = `FILLER (${postData.subtype || 'text'})`;
    if (isStimulus) {
      tagClass = isTailored ? 'tailored' : 'random';
      tagLabel = isTailored ? 'TAILORED' : 'RANDOM';
    }
    debugHtml = `
      <div class="sf-debug-badge">
        <span class="sf-debug-tag ${tagClass}">${tagLabel}</span>
        ${isStimulus && postData.condition_id ? `<span class="sf-debug-detail">${postData.condition_id}</span>` : ''}
      </div>
      <div class="sf-view-timer" style="display:block;">0s</div>`;
  }

  // --- Assemble card ---
  card.innerHTML = `
    ${bgHtml}
    ${overlayHtml}
    ${playIndicatorHtml}
    ${progressHtml}
    ${articleBadgeHtml}
    ${debugHtml}
    ${bottomHtml}
    ${actionsHtml}
  `;

  card._postData = {
    postId,
    postType: postData.type,
    type: isStimulus ? (isTailored ? 'ai-tailored' : 'ai-random') : 'placeholder',
    conditionId: postData.condition_id,
    isTailored,
    authorName,
    likes: engagement.likes,
    comments: engagement.comments,
    shares: engagement.shares,
    isVideo,
    text: postText
  };

  return card;
}

// ============================================
// INTERSECTION OBSERVER (auto-play/pause)
// ============================================
function setupSfIntersectionObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const card = entry.target;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
        autoPlayCard(card);
        card.classList.remove('sf-paused');
        sfCurrentIndex = parseInt(card.dataset.index) || 0;
      } else {
        autoPauseCard(card);
        card.classList.add('sf-paused');
      }
    });
  }, { threshold: 0.7 });

  sfCards.forEach(card => observer.observe(card));
}

function autoPlayCard(card) {
  const video = card.querySelector('.sf-card-bg video');
  if (video) {
    video.play().catch(() => {});
    startVideoProgress(card, video);
  }
}

function autoPauseCard(card) {
  const video = card.querySelector('.sf-card-bg video');
  if (video) {
    video.pause();
    stopVideoProgress(card);
  }
}

// ============================================
// VIDEO PROGRESS BAR
// ============================================
const sfProgressIntervals = new Map();

function startVideoProgress(card, video) {
  stopVideoProgress(card);
  const bar = card.querySelector('.sf-progress-bar');
  if (!bar) return;

  const interval = setInterval(() => {
    if (video.duration) {
      const pct = (video.currentTime / video.duration) * 100;
      bar.style.width = pct + '%';
    }
  }, 100);
  sfProgressIntervals.set(card, interval);
}

function stopVideoProgress(card) {
  const interval = sfProgressIntervals.get(card);
  if (interval) {
    clearInterval(interval);
    sfProgressIntervals.delete(card);
  }
}

// ============================================
// TAP HANDLERS (play/pause + double-tap heart)
// ============================================
function setupSfTapHandlers() {
  sfCards.forEach(card => {
    const bg = card.querySelector('.sf-card-bg');
    if (!bg) return;

    bg.addEventListener('click', (e) => {
      if (e.target.closest('.sf-actions, .sf-card-bottom button, .sf-caption-more, .sf-follow-btn')) return;

      const now = Date.now();
      if (now - sfLastTap < 300) {
        sfDoubleTapHeart(card, e);
        sfLastTap = 0;
      } else {
        sfLastTap = now;
        setTimeout(() => {
          if (sfLastTap === now) {
            sfTogglePlayPause(card);
          }
        }, 300);
      }
    });
  });
}

function sfTogglePlayPause(card) {
  const video = card.querySelector('.sf-card-bg video');
  const indicator = card.querySelector('.sf-play-indicator');

  if (video) {
    if (video.paused) {
      video.play().catch(() => {});
      card.classList.remove('sf-paused');
      if (indicator) {
        indicator.innerHTML = '<i class="fas fa-play"></i>';
        indicator.classList.remove('sf-show');
        void indicator.offsetWidth;
        indicator.classList.add('sf-show');
      }
      startVideoProgress(card, video);
    } else {
      video.pause();
      card.classList.add('sf-paused');
      if (indicator) {
        indicator.innerHTML = '<i class="fas fa-pause"></i>';
        indicator.classList.remove('sf-show');
        void indicator.offsetWidth;
        indicator.classList.add('sf-show');
      }
      stopVideoProgress(card);
    }
  }
}

function sfDoubleTapHeart(card, e) {
  const rect = card.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const heart = document.createElement('div');
  heart.className = 'sf-heart-burst';
  heart.innerHTML = '<i class="fas fa-heart"></i>';
  heart.style.left = x + 'px';
  heart.style.top = y + 'px';
  card.appendChild(heart);
  setTimeout(() => heart.remove(), 800);

  const likeAction = card.querySelector('.sf-like-action');
  if (likeAction && !likeAction.classList.contains('sf-liked')) {
    sfToggleLike(likeAction);
  }
}

// ============================================
// ARROW NAVIGATION
// ============================================
function sfScrollPrev() {
  if (sfCurrentIndex > 0) {
    sfCards[sfCurrentIndex - 1].scrollIntoView({ behavior: 'smooth' });
  }
}

function sfScrollNext() {
  if (sfCurrentIndex < sfCards.length - 1) {
    sfCards[sfCurrentIndex + 1].scrollIntoView({ behavior: 'smooth' });
  }
}

// ============================================
// LIKE TOGGLE
// ============================================
function sfToggleLike(actionEl) {
  const countEl = actionEl.querySelector('.sf-action-count');
  let count = parseSfCount(countEl.textContent);

  if (actionEl.classList.contains('sf-liked')) {
    actionEl.classList.remove('sf-liked');
    count--;
  } else {
    actionEl.classList.add('sf-liked');
    count++;
    // The CSS animation on .sf-action-icon-wrap handles the pop effect
  }

  countEl.textContent = formatSfCount(count);
}

// ============================================
// CAPTION TOGGLE
// ============================================
function sfToggleCaption(btn) {
  const caption = btn.previousElementSibling;
  if (caption.classList.contains('sf-expanded')) {
    caption.classList.remove('sf-expanded');
    btn.textContent = 'more';
  } else {
    caption.classList.add('sf-expanded');
    btn.textContent = 'less';
  }
}

// ============================================
// VIEW TRACKING
// ============================================
function startSfViewTracking() {
  const observer = new IntersectionObserver((entries) => {
    if (document.hidden) return;

    entries.forEach(entry => {
      const card = entry.target;
      const postId = card.dataset.postId;
      if (!postId) return;

      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        if (!sfViewTimes[postId]) {
          sfViewTimes[postId] = {
            totalTime: 0,
            lastEnterTime: Date.now(),
            author: card._postData?.authorName || 'Unknown',
            type: card._postData?.type || 'placeholder',
            isCurrentlyVisible: true
          };
        } else if (!sfViewTimes[postId].lastEnterTime) {
          sfViewTimes[postId].lastEnterTime = Date.now();
          sfViewTimes[postId].isCurrentlyVisible = true;
        }
      } else {
        if (sfViewTimes[postId] && sfViewTimes[postId].lastEnterTime) {
          sfViewTimes[postId].totalTime += Date.now() - sfViewTimes[postId].lastEnterTime;
          sfViewTimes[postId].lastEnterTime = null;
          sfViewTimes[postId].isCurrentlyVisible = false;
        }
      }
    });

    updateSfTimers();
  }, { threshold: 0.5 });

  sfCards.forEach(card => observer.observe(card));
  setInterval(updateSfTimers, 1000);

  document.addEventListener('visibilitychange', () => {
    const now = Date.now();
    if (document.hidden) {
      Object.values(sfViewTimes).forEach(d => {
        if (d.lastEnterTime) {
          d.totalTime += now - d.lastEnterTime;
          d.lastEnterTime = null;
        }
      });
    } else {
      Object.values(sfViewTimes).forEach(d => {
        if (d.isCurrentlyVisible && !d.lastEnterTime) {
          d.lastEnterTime = now;
        }
      });
    }
  });
}

function updateSfTimers() {
  const now = Date.now();
  Object.entries(sfViewTimes).forEach(([postId, data]) => {
    let totalMs = data.totalTime;
    if (data.lastEnterTime && !document.hidden) {
      totalMs += now - data.lastEnterTime;
    }
    const timerEl = document.querySelector(`[data-post-id="${postId}"] .sf-view-timer`);
    if (timerEl) {
      timerEl.textContent = `${Math.round(totalMs / 1000)}s`;
    }
  });
}

// ============================================
// RESULTS
// ============================================
function showSwipeFlowResults() {
  const sorted = Object.entries(sfViewTimes)
    .map(([postId, data]) => ({
      postId,
      ...data,
      totalMs: data.totalTime + (data.lastEnterTime && !document.hidden ? Date.now() - data.lastEnterTime : 0)
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 10);

  const body = document.getElementById('sf-results-body');
  body.innerHTML = sorted.map((item, idx) => {
    const typeLabel = item.type === 'ai-tailored' ? 'Tailored Stimulus'
                    : item.type === 'ai-random'   ? 'Random Stimulus'
                    : 'Filler';
    const seconds = Math.round(item.totalMs / 1000);
    return `
      <div class="sf-result-item">
        <div class="sf-result-rank">#${idx + 1}</div>
        <div class="sf-result-info">
          <div class="sf-result-author">${item.author}</div>
          <div class="sf-result-type">${typeLabel}</div>
        </div>
        <div class="sf-result-time">${seconds}s<small>viewed</small></div>
      </div>`;
  }).join('');

  document.getElementById('sf-results-modal').classList.add('active');
}

function closeSwipeFlowResults() {
  document.getElementById('sf-results-modal').classList.remove('active');
}

// ============================================
// URL PARAMS
// ============================================
function sfGetParams() {
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
// UTILITIES
// ============================================
function formatSfCount(num) {
  if (typeof num === 'string') num = parseInt(num) || 0;
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
}

function parseSfCount(str) {
  str = str.trim();
  if (str.endsWith('M')) return parseFloat(str) * 1000000;
  if (str.endsWith('K')) return parseFloat(str) * 1000;
  return parseInt(str) || 0;
}

function sfComingSoon(event) {
  event.stopPropagation();
  const tooltip = document.getElementById('coming-soon-tooltip');
  tooltip.style.left = (event.clientX + 10) + 'px';
  tooltip.style.top = (event.clientY - 40) + 'px';
  tooltip.classList.add('show');
  setTimeout(() => tooltip.classList.remove('show'), 1500);
}

function setupSfTooltips() {
  document.querySelectorAll('.sf-nav-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      sfComingSoon(e);
    });
  });
}

function showSfError(message) {
  const loader = document.getElementById('survey-loader');
  if (loader) {
    loader.innerHTML = `
      <div class="sf-loader-content">
        <div style="font-size: 64px; margin-bottom: 24px;">&#9888;&#65039;</div>
        <h2 style="color: var(--sf-accent); margin-bottom: 12px;">Error</h2>
        <p class="sf-loader-message">${message}</p>
      </div>`;
  }
}
