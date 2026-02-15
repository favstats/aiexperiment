/**
 * Swift Feed - messaging channel participant interface
 * Depends on circl-core.js (shared utilities) and feed-loader.js (shared data loading)
 */

// ============================================
// STATE
// ============================================
let smViewTimes = {};
let smMessages = [];

// ============================================
// CONSTANTS
// ============================================

// Fake channels for the left panel chat list
const SM_CHANNELS = [
  {
    name: 'Nieuws & Politiek',
    icon: 'bullhorn',
    color: 'linear-gradient(135deg, #2AABEE, #229ED9)',
    preview: 'Laatste berichten over politiek en nieuws',
    time: 'now',
    unread: null,
    pinned: true,
    isChannel: true,
    isActive: true,
    online: false
  },
  {
    name: 'NOS Updates',
    icon: 'newspaper',
    color: 'linear-gradient(135deg, #E74C3C, #C0392B)',
    preview: 'LIVE: Kamerdebat over de begroting...',
    time: '10:42',
    unread: 24,
    pinned: true,
    isChannel: true,
    online: false
  },
  {
    name: 'Familiegroep',
    initials: 'FG',
    color: 'linear-gradient(135deg, #27AE60, #2ECC71)',
    preview: 'Oma: Wie komt er zondag eten?',
    previewSender: 'Oma',
    time: '11:15',
    unread: 3,
    pinned: false,
    isChannel: false,
    online: false
  },
  {
    name: 'Werkgroep',
    initials: 'WG',
    color: 'linear-gradient(135deg, #8E44AD, #9B59B6)',
    preview: 'Peter: Vergadering verplaatst naar 14:00',
    previewSender: 'Peter',
    time: '09:30',
    unread: null,
    pinned: false,
    isChannel: false,
    online: false
  },
  {
    name: 'Tech Nieuws NL',
    icon: 'laptop-code',
    color: 'linear-gradient(135deg, #2C3E50, #34495E)',
    preview: 'Apple kondigt nieuwe MacBook Pro aan...',
    time: 'Yesterday',
    unread: 156,
    unreadMuted: true,
    pinned: false,
    isChannel: true,
    online: false
  },
  {
    name: 'Crypto & Beurs',
    icon: 'chart-line',
    color: 'linear-gradient(135deg, #F39C12, #E67E22)',
    preview: 'AEX sluit 1.2% hoger na positief...',
    time: 'Yesterday',
    unread: 42,
    unreadMuted: true,
    pinned: false,
    isChannel: true,
    online: false
  },
  {
    name: 'Lisa van Dijk',
    initials: 'LV',
    color: 'linear-gradient(135deg, #E91E63, #C2185B)',
    preview: 'Haha ja dat was echt grappig!',
    time: 'Mon',
    unread: null,
    pinned: false,
    isChannel: false,
    online: true
  },
  {
    name: 'Sportclub 2024',
    initials: 'SC',
    color: 'linear-gradient(135deg, #00BCD4, #0097A7)',
    preview: 'Training morgen om 19:00 op veld 3',
    previewSender: 'Coach',
    time: 'Mon',
    unread: null,
    pinned: false,
    isChannel: false,
    online: false
  }
];

// Forwarded channel names for stimulus/org posts
const SM_FORWARD_CHANNELS = [
  'Politiek Nieuws NL',
  'Nederland Vandaag',
  'Dutch News Alert',
  'Actueel NL',
  'Politiek & Beleid',
  'Nieuwsflits NL',
  'Tweede Kamer Live',
  'Binnenlands Nieuws'
];

// Reaction emojis (visual only)
const SM_REACTIONS = [
  { emoji: '\uD83D\uDC4D', weight: 5 },
  { emoji: '\u2764\uFE0F', weight: 4 },
  { emoji: '\uD83D\uDD25', weight: 3 },
  { emoji: '\uD83D\uDE02', weight: 2 },
  { emoji: '\uD83D\uDE22', weight: 1 },
  { emoji: '\uD83E\uDD14', weight: 2 },
  { emoji: '\uD83D\uDC4F', weight: 2 },
  { emoji: '\uD83D\uDE31', weight: 1 }
];

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', initSwiftMsgFeed);

async function initSwiftMsgFeed() {
  const params = smGetParams();
  const loader = document.getElementById('survey-loader');
  const messageEl = document.getElementById('loading-message');

  let loadingMessages = ['Connecting...'];
  let messageInterval = null;
  let messageIndex = 0;

  try {
    const useJsonFeed = params.source === 'json' && typeof FeedLoader !== 'undefined';

    if (!useJsonFeed) {
      smShowError('Swift requires source=json. Add ?source=json to the URL.');
      return;
    }

    // Build feed options
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

    // Load feed data from shared config
    const feedData = await FeedLoader.loadFeed('../circl/data/feed-config.json', feedOptions);

    // Get loading messages from locale
    const locale = feedData.config.locale || {};
    loadingMessages = locale.loading_messages || ['Connecting...'];

    if (messageEl && loadingMessages.length > 0) {
      messageEl.textContent = loadingMessages[0];
      messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        messageEl.textContent = loadingMessages[messageIndex];
      }, 600);
    }

    // Set debug mode
    debugMode = params.debug;

    // Wait for loading animation
    await new Promise(r => setTimeout(r, 2500));
    if (messageInterval) clearInterval(messageInterval);

    // Show app, render everything
    document.getElementById('sm-app').style.display = 'flex';
    populateChatList();
    renderMessages(feedData.posts, feedData.config);

    // Debug mode setup
    if (params.debug) {
      document.getElementById('sm-results-btn').style.display = 'flex';
      startSmViewTracking();
    }

    // Clean URL
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Fade out loader
    loader.classList.add('fade-out');
    setTimeout(() => {
      loader.style.display = 'none';
      loader.remove();
    }, 500);

    // Setup tooltips for non-functional elements
    setupSmTooltips();

    // Setup mobile back button
    setupMobileBackButton();

  } catch (error) {
    console.error('SwiftMsg: Error loading feed:', error);
    smShowError('Could not load the feed. Please try again later.');
  }
}

// ============================================
// CHAT LIST POPULATION
// ============================================
function populateChatList() {
  const container = document.getElementById('sm-chatlist-items');
  if (!container) return;
  container.innerHTML = '';

  SM_CHANNELS.forEach(ch => {
    const item = document.createElement('div');
    item.className = 'sm-chat-item' + (ch.isActive ? ' active' : '');

    // Avatar
    let avatarContent;
    if (ch.icon) {
      avatarContent = `<i class="fas fa-${ch.icon}" style="color:white; font-size:22px;"></i>`;
    } else {
      avatarContent = `<span class="sm-avatar-initials">${ch.initials}</span>`;
    }

    // Online indicator (only for non-channel, non-group personal chats)
    let onlineHtml = '';
    if (ch.online && !ch.isChannel) {
      onlineHtml = '<div class="sm-online-indicator"></div>';
    }

    // Channel icon in name
    const channelIcon = ch.isChannel ? '<i class="fas fa-bullhorn sm-channel-icon"></i>' : '';

    // Preview
    let previewHtml;
    if (ch.previewSender) {
      previewHtml = `<span class="sm-chat-preview-sender">${ch.previewSender}: </span>${ch.preview.replace(ch.previewSender + ': ', '')}`;
    } else {
      previewHtml = ch.preview;
    }

    // Badges
    let badgesHtml = '';
    if (ch.unread) {
      badgesHtml += `<span class="sm-unread-count${ch.unreadMuted ? ' muted' : ''}">${ch.unread}</span>`;
    }
    if (ch.pinned && !ch.unread) {
      badgesHtml += '<i class="fas fa-thumbtack sm-chat-pin"></i>';
    }

    item.innerHTML = `
      <div class="sm-chat-avatar" style="background: ${ch.color};">
        ${avatarContent}
        ${onlineHtml}
      </div>
      <div class="sm-chat-info">
        <div class="sm-chat-top-row">
          <span class="sm-chat-name">${channelIcon} ${ch.name}</span>
          <span class="sm-chat-time">${ch.time}</span>
        </div>
        <div class="sm-chat-bottom-row">
          <span class="sm-chat-preview">${previewHtml}</span>
          <div class="sm-chat-badges">${badgesHtml}</div>
        </div>
      </div>
    `;

    container.appendChild(item);
  });
}

// ============================================
// MESSAGE RENDERING
// ============================================
function renderMessages(posts, config) {
  const container = document.getElementById('sm-messages-inner');
  if (!container) return;
  container.innerHTML = '';
  smMessages = [];

  // Add "Today" date divider at top
  const todayDivider = createDateDivider('Today');
  container.appendChild(todayDivider);

  // Track insertion for "Yesterday" divider
  let addedYesterdayDivider = false;
  const yesterdayIndex = Math.floor(posts.length * 0.6);

  posts.forEach((post, index) => {
    // Add "Yesterday" divider partway through
    if (!addedYesterdayDivider && index >= yesterdayIndex) {
      container.appendChild(createDateDivider('Yesterday'));
      addedYesterdayDivider = true;
    }

    const msgEl = createMessage(post, index);
    container.appendChild(msgEl);
    smMessages.push(msgEl);
  });

  // Auto-scroll to bottom after render
  requestAnimationFrame(() => {
    const messagesContainer = document.getElementById('sm-messages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  });
}

function createDateDivider(label) {
  const div = document.createElement('div');
  div.className = 'sm-date-divider';
  div.innerHTML = `<span class="sm-date-divider-label">${label}</span>`;
  return div;
}

// ============================================
// MESSAGE CREATION
// ============================================
function createMessage(postData, index) {
  const msg = document.createElement('div');
  msg.className = 'sm-message';

  const isStimulus = postData.type === 'stimulus';
  const isOrg = postData.subtype === 'organization' || (postData.author?.fallback_icon && !postData.author?.gender);
  const isArticle = postData.subtype === 'article';
  const isVideo = postData.subtype === 'video';
  const isTailored = postData._isTailored || false;
  const hasImage = postData.image && postData.image.show !== false;
  const author = postData.author || {};
  const authorName = author.name || 'Unknown';
  const engagement = postData.engagement || { likes: 0, comments: 0, shares: 0 };
  const postText = postData.text || '';

  const postId = `sm-${postData.type}-${postData.id || index}-${Date.now()}-${index}`;
  msg.dataset.postId = postId;
  msg.dataset.postType = postData.type;

  if (isStimulus) {
    msg.dataset.isTailored = isTailored ? 'true' : 'false';
    msg.dataset.conditionId = postData.condition_id || '';
  }

  // Determine if this message should show as "forwarded"
  const isForwarded = isStimulus || isOrg;
  if (isForwarded) {
    msg.classList.add('sm-forwarded');
  }

  // Build message HTML parts
  let html = '';

  // --- Forwarded header ---
  if (isForwarded) {
    let forwardName;
    if (isOrg && authorName !== 'Unknown') {
      forwardName = authorName;
    } else {
      forwardName = SM_FORWARD_CHANNELS[index % SM_FORWARD_CHANNELS.length];
    }
    html += `<div class="sm-forward-header"><i class="fas fa-share"></i> Forwarded from ${forwardName}</div>`;
  }

  // --- Media ---
  if (isVideo && postData.video) {
    const poster = postData.video.thumbnail || '';
    const duration = postData.video.duration || '';
    html += `
      <div class="sm-message-media">
        <img src="${poster}" alt="Video thumbnail" loading="lazy"
             onerror="this.parentElement.style.display='none';">
        <div class="sm-message-video-overlay">
          <div class="sm-message-video-play"><i class="fas fa-play"></i></div>
        </div>
        ${duration ? `<span class="sm-message-video-duration">${duration}</span>` : ''}
      </div>`;
  } else if (hasImage) {
    html += `
      <div class="sm-message-media">
        <img src="${postData.image.src}" alt="Post image" loading="lazy"
             onerror="this.parentElement.style.display='none';">
      </div>`;
  }

  // --- Link preview (for article posts) ---
  if (isArticle && postData.article) {
    const article = postData.article;
    const thumbnailUrl = article.thumbnail || '';
    const hasThumb = !!thumbnailUrl;

    if (hasThumb) {
      html += `
        <div class="sm-link-preview has-image">
          <div class="sm-link-preview-image">
            <img src="${thumbnailUrl}" alt="${article.title || ''}" loading="lazy"
                 onerror="this.parentElement.style.display='none';">
          </div>
          <div class="sm-link-preview-info">
            <div class="sm-link-preview-site">${article.source || 'Unknown'}</div>
            <div class="sm-link-preview-title">${article.title || 'Untitled'}</div>
            ${article.description ? `<div class="sm-link-preview-desc">${article.description}</div>` : ''}
          </div>
        </div>`;
    } else {
      html += `
        <div class="sm-link-preview">
          <div class="sm-link-preview-info">
            <div class="sm-link-preview-site">${article.source || 'Unknown'}</div>
            <div class="sm-link-preview-title">${article.title || 'Untitled'}</div>
            ${article.description ? `<div class="sm-link-preview-desc">${article.description}</div>` : ''}
          </div>
        </div>`;
    }
  }

  // --- Text content ---
  if (postText) {
    html += `<div class="sm-message-text">${postText}</div>`;
  }

  // --- Footer (views + time + optional "edited") ---
  const viewCount = formatViewCount(engagement.likes);
  const timeStr = postData.time || `${Math.floor(Math.random() * 23) + 1}h`;
  const timeFormatted = formatTimeForMessage(timeStr);

  // Randomly add "edited" label to ~15% of filler messages
  let timeHtml = `<span class="sm-message-time">${timeFormatted}</span>`;
  if (!isStimulus && Math.random() < 0.15) {
    timeHtml = `<span class="sm-message-edited">edited</span>` + timeHtml;
  }

  html += `
    <div class="sm-message-footer">
      <span class="sm-message-views"><i class="fas fa-eye"></i> ${viewCount}</span>
      ${timeHtml}
    </div>`;

  // --- Reactions (visual, random selection) ---
  if (Math.random() < 0.55 || isStimulus) {
    html += generateReactions(engagement);
  }

  // --- Debug info ---
  if (debugMode && isStimulus) {
    const tagClass = isTailored ? 'tailored' : 'random';
    const tagLabel = isTailored ? 'TAILORED' : 'RANDOM';
    html += `
      <div class="sm-debug-badge">
        <span class="sm-debug-tag ${tagClass}">${tagLabel}</span>
        ${postData.condition_id ? `<span class="sm-debug-detail">${postData.condition_id}</span>` : ''}
      </div>`;
  }
  if (debugMode) {
    html += '<div class="sm-view-timer" style="display:block;">0s</div>';
  }

  msg.innerHTML = html;

  // Store post data for tracking
  msg._postData = {
    postId: postId,
    postType: postData.type,
    type: isStimulus ? (isTailored ? 'ai-tailored' : 'ai-random') : 'placeholder',
    conditionId: postData.condition_id,
    isTailored: isTailored,
    authorName: authorName,
    likes: engagement.likes,
    comments: engagement.comments,
    shares: engagement.shares,
    text: postText
  };

  return msg;
}

// ============================================
// FORMATTING HELPERS
// ============================================
function formatViewCount(likes) {
  // Multiply likes to get realistic Telegram view counts
  const views = likes * (Math.floor(Math.random() * 15) + 8);
  if (views >= 1000000) {
    return (views / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (views >= 1000) {
    return (views / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return views.toString();
}

function formatTimeForMessage(timeStr) {
  // Convert "3h" style to a plausible HH:MM timestamp
  const match = timeStr.match(/^(\d+)h$/);
  if (match) {
    const hoursAgo = parseInt(match[1]);
    const now = new Date();
    now.setHours(now.getHours() - hoursAgo);
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }
  // Already formatted or just return as-is
  return timeStr;
}

function generateReactions(engagement) {
  // Pick 2-4 random reactions with counts based on engagement
  const count = 2 + Math.floor(Math.random() * 3);
  const shuffled = [...SM_REACTIONS].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  let reactionsHtml = '<div class="sm-reactions">';
  selected.forEach((r, i) => {
    const baseCount = Math.floor(engagement.likes * (0.02 + Math.random() * 0.1));
    const reactionCount = Math.max(1, baseCount);
    const isActive = i === 0 && Math.random() < 0.15;
    reactionsHtml += `
      <div class="sm-reaction${isActive ? ' active' : ''}">
        <span class="sm-reaction-emoji">${r.emoji}</span>
        <span class="sm-reaction-count">${formatSmCount(reactionCount)}</span>
      </div>`;
  });
  reactionsHtml += '</div>';
  return reactionsHtml;
}

function formatSmCount(num) {
  if (typeof num === 'string') num = parseInt(num) || 0;
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
}

// ============================================
// MOBILE BACK BUTTON
// ============================================
function setupMobileBackButton() {
  const backBtn = document.querySelector('.sm-channel-back-btn');
  const chatlist = document.getElementById('sm-chatlist');

  if (backBtn && chatlist) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // On mobile, toggle showing the chat list overlay
      if (chatlist.classList.contains('show')) {
        chatlist.classList.remove('show');
      } else {
        chatlist.classList.add('show');
      }
    });

    // Clicking an active chat item hides the chatlist overlay on mobile
    document.addEventListener('click', (e) => {
      const chatItem = e.target.closest('.sm-chat-item.active');
      if (chatItem && chatlist.classList.contains('show')) {
        chatlist.classList.remove('show');
      }
    });
  }
}

// ============================================
// VIEW TRACKING
// ============================================
function startSmViewTracking() {
  const observer = new IntersectionObserver((entries) => {
    if (document.hidden) return;

    entries.forEach(entry => {
      const msg = entry.target;
      const postId = msg.dataset.postId;
      if (!postId) return;

      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        if (!smViewTimes[postId]) {
          smViewTimes[postId] = {
            totalTime: 0,
            lastEnterTime: Date.now(),
            author: msg._postData?.authorName || 'Unknown',
            type: msg._postData?.type || 'placeholder',
            isCurrentlyVisible: true
          };
        } else if (!smViewTimes[postId].lastEnterTime) {
          smViewTimes[postId].lastEnterTime = Date.now();
          smViewTimes[postId].isCurrentlyVisible = true;
        }
      } else {
        if (smViewTimes[postId] && smViewTimes[postId].lastEnterTime) {
          smViewTimes[postId].totalTime += Date.now() - smViewTimes[postId].lastEnterTime;
          smViewTimes[postId].lastEnterTime = null;
          smViewTimes[postId].isCurrentlyVisible = false;
        }
      }
    });

    updateSmTimers();
  }, { threshold: 0.5 });

  smMessages.forEach(msg => observer.observe(msg));
  setInterval(updateSmTimers, 1000);

  document.addEventListener('visibilitychange', () => {
    const now = Date.now();
    if (document.hidden) {
      Object.values(smViewTimes).forEach(d => {
        if (d.lastEnterTime) {
          d.totalTime += now - d.lastEnterTime;
          d.lastEnterTime = null;
        }
      });
    } else {
      Object.values(smViewTimes).forEach(d => {
        if (d.isCurrentlyVisible && !d.lastEnterTime) {
          d.lastEnterTime = now;
        }
      });
    }
  });
}

function updateSmTimers() {
  const now = Date.now();
  Object.entries(smViewTimes).forEach(([postId, data]) => {
    let totalMs = data.totalTime;
    if (data.lastEnterTime && !document.hidden) {
      totalMs += now - data.lastEnterTime;
    }
    const timerEl = document.querySelector(`[data-post-id="${postId}"] .sm-view-timer`);
    if (timerEl) {
      timerEl.textContent = `${Math.round(totalMs / 1000)}s`;
    }
  });
}

// ============================================
// RESULTS
// ============================================
function smShowResults() {
  const sorted = Object.entries(smViewTimes)
    .map(([postId, data]) => ({
      postId,
      ...data,
      totalMs: data.totalTime + (data.lastEnterTime && !document.hidden ? Date.now() - data.lastEnterTime : 0)
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 10);

  const body = document.getElementById('sm-results-body');
  body.innerHTML = sorted.map((item, idx) => {
    const typeLabel = item.type === 'ai-tailored' ? 'Tailored Stimulus'
                    : item.type === 'ai-random'   ? 'Random Stimulus'
                    : 'Filler';
    const seconds = Math.round(item.totalMs / 1000);
    return `
      <div class="sm-result-item">
        <div class="sm-result-rank">#${idx + 1}</div>
        <div class="sm-result-info">
          <div class="sm-result-author">${item.author}</div>
          <div class="sm-result-type">${typeLabel}</div>
        </div>
        <div class="sm-result-time">${seconds}s<small>viewed</small></div>
      </div>`;
  }).join('');

  document.getElementById('sm-results-modal').classList.add('active');
}

function smCloseResults() {
  document.getElementById('sm-results-modal').classList.remove('active');
}

// ============================================
// URL PARAMETER PARSING
// ============================================
function smGetParams() {
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
// COMING SOON TOOLTIP
// ============================================
function smComingSoon(event) {
  event.stopPropagation();
  const tooltip = document.getElementById('coming-soon-tooltip');
  tooltip.style.left = (event.clientX + 10) + 'px';
  tooltip.style.top = (event.clientY - 40) + 'px';
  tooltip.classList.add('show');
  setTimeout(() => tooltip.classList.remove('show'), 1500);
}

function setupSmTooltips() {
  // Chat list items (except active)
  document.querySelectorAll('.sm-chat-item:not(.active)').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      smComingSoon(e);
    });
  });

  // Channel header action buttons
  document.querySelectorAll('.sm-channel-header-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      smComingSoon(e);
    });
  });

  // Hamburger menu
  const hamburger = document.querySelector('.sm-hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      smComingSoon(e);
    });
  }

  // Search bar
  const searchBar = document.querySelector('.sm-search-bar');
  if (searchBar) {
    searchBar.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      smComingSoon(e);
    });
  }

  // Channel bottom notice
  const bottomNotice = document.querySelector('.sm-channel-bottom');
  if (bottomNotice) {
    bottomNotice.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      smComingSoon(e);
    });
  }

  // Folder tabs (except active)
  document.querySelectorAll('.sm-folder-tab:not(.active)').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      smComingSoon(e);
    });
  });
}

// ============================================
// ERROR HANDLING
// ============================================
function smShowError(message) {
  const loader = document.getElementById('survey-loader');
  if (loader) {
    loader.innerHTML = `
      <div class="sm-loader-content">
        <div class="sm-loader-icon" style="background: #E74C3C; animation: none;">
          <i class="fas fa-exclamation-triangle" style="transform: none;"></i>
        </div>
        <h1 class="sm-loader-title" style="color: #E74C3C;">Error</h1>
        <div class="sm-loader-message">${message}</div>
      </div>`;
  }
}
