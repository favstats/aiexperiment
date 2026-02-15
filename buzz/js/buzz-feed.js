/**
 * Buzz Feed - group chat simulator
 * Converts feed posts into chat-style group messages
 * Depends on circl-core.js (globals: debugMode, postViewTimes, etc.)
 * Depends on feed-loader.js (FeedLoader)
 */

// ============================================
// CONSTANTS
// ============================================

// Color palette for sender names in group chat
const SENDER_COLORS = [
  '#00A884', // teal
  '#53BDEB', // blue
  '#8B5CF6', // purple
  '#E67E22', // orange
  '#06CF9C', // green
  '#FF6B6B', // red
  '#D946EF', // pink
  '#0EA5E9', // sky blue
  '#F59E0B', // amber
  '#667781', // gray
  '#E11D48', // rose
  '#7C3AED', // violet
];

// Fake sidebar chats data
const FAKE_CHATS = [
  {
    name: 'Familie & Vrienden',
    avatar: 'group',
    preview: '',
    time: '',
    unread: 0,
    isActive: true,
    icon: 'fa-users'
  },
  {
    name: 'Mama',
    avatar: 'person',
    preview: 'Heb je al gegeten?',
    time: '14:32',
    unread: 1,
    isActive: false,
    initials: 'M',
    color: '#E67E22'
  },
  {
    name: 'Werk Team',
    avatar: 'group',
    preview: 'Jan: De vergadering is verplaatst naar 15:00',
    time: '12:05',
    unread: 4,
    isActive: false,
    icon: 'fa-briefcase'
  },
  {
    name: 'Buurgroep Oost',
    avatar: 'group',
    preview: 'Petra: Weet iemand van wie die auto is?',
    time: 'Gisteren',
    unread: 0,
    isActive: false,
    icon: 'fa-house-chimney'
  },
  {
    name: 'Sportclub',
    avatar: 'group',
    preview: 'Training is morgen om 19:00!',
    time: 'Gisteren',
    unread: 0,
    isActive: false,
    icon: 'fa-futbol'
  },
  {
    name: 'Lisa de Vries',
    avatar: 'person',
    preview: 'Haha ja dat was grappig',
    time: 'Dinsdag',
    unread: 0,
    isActive: false,
    initials: 'LV',
    color: '#8B5CF6'
  }
];

// ============================================
// STATE
// ============================================
const senderColorMap = {};
let colorIndex = 0;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', initBuzzChat);

async function initBuzzChat() {
  const params = parseBuzzChatParams();

  // Show loader
  const loader = document.getElementById('buzzchat-loader');
  loader.style.display = 'flex';

  const messageEl = document.getElementById('loading-message');
  const loadingMessages = [
    'Connecting...',
    'Loading messages...',
    'Syncing chats...',
    'Almost ready...'
  ];
  let msgIdx = 0;
  const msgInterval = setInterval(() => {
    msgIdx = (msgIdx + 1) % loadingMessages.length;
    if (messageEl) messageEl.textContent = loadingMessages[msgIdx];
  }, 700);

  try {
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

    // Load feed via shared FeedLoader
    const feedData = await FeedLoader.loadFeed('../circl/data/feed-config.json', feedOptions);

    // Set global debug mode
    debugMode = params.debug;

    // Wait for loading animation
    await new Promise(resolve => setTimeout(resolve, 3000));
    clearInterval(msgInterval);

    // Render the group chat
    renderBuzzChat(feedData.posts, feedData.config);

    // Populate sidebar
    populateSidebar(feedData.posts);

    // Start view tracking if debug
    if (debugMode) {
      const resultsBtn = document.getElementById('experience-results-btn');
      if (resultsBtn) resultsBtn.style.display = 'flex';
      startBuzzChatViewTracking();
    }

    // Show app, hide loader
    const app = document.getElementById('buzzchat-app');
    app.classList.add('loaded');

    loader.classList.add('fade-out');
    setTimeout(() => {
      loader.style.display = 'none';
      loader.remove();
    }, 500);

    // Auto-scroll to bottom
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Setup interactions
    setupComingSoon();
    setupResultsModal();

    // Clear URL params
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

  } catch (error) {
    console.error('BuzzChat: Error loading feed:', error);
    clearInterval(msgInterval);
    if (messageEl) {
      messageEl.textContent = 'Could not load messages. Please try again.';
      messageEl.style.color = '#E11D48';
    }
  }
}

// ============================================
// URL PARAMETER PARSING
// ============================================
function parseBuzzChatParams() {
  const params = new URLSearchParams(window.location.search);

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

  const age = params.get('age');
  const gender = params.get('gender');
  const issue = params.get('issue');
  const politics = params.get('politics');
  const debug = params.get('debug');
  const totalPosts = params.get('total_posts');

  if (age && gender && issue && politics !== null) {
    const politicsNum = parseInt(politics);
    if (
      validAges.includes(age) &&
      validGenders.includes(gender) &&
      validIssues.includes(issue) &&
      !isNaN(politicsNum) && politicsNum >= 0 && politicsNum <= 10
    ) {
      let postsCount = 40;
      if (totalPosts) {
        const parsed = parseInt(totalPosts);
        if (!isNaN(parsed) && parsed >= 10 && parsed <= 100) postsCount = parsed;
      }
      return {
        age, gender, issue,
        politics: politicsNum,
        debug: debug === 'T' || debug === 'true' || debug === '1',
        totalPosts: postsCount,
        source: 'json'
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
    source: 'json'
  };
}

// ============================================
// SENDER COLOR ASSIGNMENT
// ============================================
function getSenderColor(name) {
  if (!senderColorMap[name]) {
    senderColorMap[name] = SENDER_COLORS[colorIndex % SENDER_COLORS.length];
    colorIndex++;
  }
  return senderColorMap[name];
}

// ============================================
// TIME FORMATTING
// ============================================
function generateMessageTime(index, total) {
  // Generate realistic times throughout the day
  const baseHour = 8; // Start at 8 AM
  const spreadHours = 12; // Spread across 12 hours
  const fraction = index / Math.max(total - 1, 1);
  const hour = Math.floor(baseHour + fraction * spreadHours);
  const minute = Math.floor(Math.random() * 60);
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

// ============================================
// MAIN RENDER FUNCTION
// ============================================
function renderBuzzChat(posts, config) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  container.innerHTML = '';

  // Encryption notice
  const encNotice = document.createElement('div');
  encNotice.className = 'chat-encryption-notice';
  encNotice.innerHTML = '<span><i class="fas fa-lock"></i> Messages and calls are end-to-end encrypted. No one outside of this chat, not even Buzz, can read or listen to them. Tap to learn more.</span>';
  container.appendChild(encNotice);

  // Date divider - TODAY
  const dateDivider = document.createElement('div');
  dateDivider.className = 'chat-date-divider';
  dateDivider.innerHTML = '<span>TODAY</span>';
  container.appendChild(dateDivider);

  let lastSenderName = null;
  let messageCount = 0;
  const totalPosts = posts.length;

  // Determine how many date dividers to insert
  const yesterdayBreak = Math.floor(totalPosts * 0.3);

  posts.forEach((post, index) => {
    // Insert YESTERDAY divider partway through
    if (index === yesterdayBreak && yesterdayBreak > 0) {
      const yesterdayDiv = document.createElement('div');
      yesterdayDiv.className = 'chat-date-divider';
      yesterdayDiv.innerHTML = '<span>YESTERDAY</span>';
      container.appendChild(yesterdayDiv);
      lastSenderName = null; // Reset sender tracking after divider
    }

    const authorName = post.author?.name || 'Unknown';
    const isNewSender = authorName !== lastSenderName;
    const isStimulus = post.type === 'stimulus';
    const isTailored = post._isTailored || false;

    // Create message wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper incoming';
    if (isNewSender) wrapper.classList.add('new-sender');

    const postId = `msg-${post.type}-${post.id || index}-${Date.now()}-${index}`;
    wrapper.dataset.postId = postId;
    wrapper.dataset.postType = post.type;
    if (isStimulus) {
      wrapper.dataset.isTailored = isTailored ? 'true' : 'false';
      wrapper.dataset.conditionId = post.condition_id || '';
    }

    // Build bubble content
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    let bubbleHtml = '';

    // Sender name (only for new sender)
    if (isNewSender) {
      const senderColor = getSenderColor(authorName);
      bubbleHtml += `<div class="message-sender" style="color: ${senderColor};">${escapeHtml(authorName)}</div>`;
    }

    // Debug badge for stimulus messages
    if (debugMode && isStimulus) {
      const badgeClass = isTailored ? 'tailored' : 'random';
      const badgeIcon = isTailored ? 'fa-bullseye' : 'fa-dice';
      const badgeLabel = isTailored ? 'TAILORED' : 'RANDOM';
      bubbleHtml += `<div class="message-debug-badge ${badgeClass}"><i class="fas ${badgeIcon}"></i> ${badgeLabel}</div>`;
    }

    // Forwarded tag for stimulus posts (political content is often forwarded)
    if (isStimulus) {
      bubbleHtml += `<div class="message-forwarded"><i class="fas fa-share"></i> Forwarded</div>`;
    }

    // Determine content type and render accordingly
    const subtype = post.subtype || 'person';
    const hasImage = post.image && post.image.show !== false && post.image.src;
    const hasArticle = subtype === 'article' && post.article;
    const hasVideo = subtype === 'video' && post.video;
    const postText = post.text || '';

    if (hasArticle) {
      // Article: link preview card
      const article = post.article;
      const thumbUrl = article.thumbnail || '';
      const domain = extractDomain(article.url || '');

      bubbleHtml += `<div class="message-link-preview" data-url="${escapeHtml(article.url || '#')}">`;
      if (thumbUrl) {
        bubbleHtml += `<div class="message-link-thumb"><img src="${escapeHtml(thumbUrl)}" alt="" onerror="this.parentElement.style.display='none';"></div>`;
      }
      bubbleHtml += `<div class="message-link-info">`;
      bubbleHtml += `<div class="message-link-title">${escapeHtml(article.title || 'Article')}</div>`;
      bubbleHtml += `<div class="message-link-domain"><i class="fas fa-link"></i> ${escapeHtml(domain || article.source || 'link')}</div>`;
      bubbleHtml += `</div></div>`;

      // Caption text below link preview
      if (postText) {
        bubbleHtml += `<div class="message-text">${escapeHtml(postText)}</div>`;
      }
    } else if (hasVideo) {
      // Video: thumbnail with play button
      const video = post.video;
      const posterSrc = video.thumbnail || '';
      const duration = video.duration || '';

      bubbleHtml += `<div class="message-video-thumb">`;
      if (posterSrc) {
        bubbleHtml += `<img src="${escapeHtml(posterSrc)}" alt="Video" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22180%22><rect fill=%22%23334155%22 width=%22320%22 height=%22180%22/></svg>';">`;
      } else {
        bubbleHtml += `<div style="width:100%;height:180px;background:#334155;"></div>`;
      }
      bubbleHtml += `<div class="message-video-overlay"><div class="message-video-play"><i class="fas fa-play"></i></div></div>`;
      if (duration) {
        bubbleHtml += `<span class="message-video-duration">${escapeHtml(duration)}</span>`;
      }
      bubbleHtml += `</div>`;

      // Caption text
      if (postText) {
        bubbleHtml += `<div class="message-media-caption">${escapeHtml(postText)}</div>`;
      }
    } else if (hasImage) {
      // Image with optional caption
      bubbleHtml += `<div class="message-media"><img src="${escapeHtml(post.image.src)}" alt="Photo" loading="lazy" onerror="this.parentElement.style.display='none';"></div>`;
      if (postText) {
        bubbleHtml += `<div class="message-media-caption">${escapeHtml(postText)}</div>`;
      }
    } else {
      // Plain text message
      if (postText) {
        bubbleHtml += `<div class="message-text">${escapeHtml(postText)}</div>`;
      }
    }

    // Message footer with time and check marks
    const msgTime = generateMessageTime(index, totalPosts);
    bubbleHtml += `<div class="message-footer">`;
    bubbleHtml += `<span class="message-time">${msgTime}</span>`;
    bubbleHtml += `</div>`;

    bubble.innerHTML = bubbleHtml;
    wrapper.appendChild(bubble);
    container.appendChild(wrapper);

    // Store post data for tracking
    wrapper._postData = {
      postId: postId,
      postType: post.type,
      type: isStimulus ? (isTailored ? 'ai-tailored' : 'ai-random') : 'placeholder',
      conditionId: post.condition_id || null,
      isTailored: isTailored,
      authorName: authorName
    };

    lastSenderName = authorName;
    messageCount++;
  });

  // Update group status with member count
  const uniqueSenders = Object.keys(senderColorMap);
  const statusEl = document.getElementById('chat-group-status');
  if (statusEl) {
    // Add +1 for "you"
    statusEl.textContent = `you, ${uniqueSenders.join(', ').substring(0, 80)}${uniqueSenders.length > 3 ? '...' : ''}`;
  }
}

// ============================================
// SIDEBAR POPULATION
// ============================================
function populateSidebar(posts) {
  const chatListEl = document.getElementById('chat-list');
  if (!chatListEl) return;
  chatListEl.innerHTML = '';

  // Update the active chat preview with last message info
  const lastPost = posts[posts.length - 1];
  if (lastPost) {
    FAKE_CHATS[0].preview = lastPost.author?.name + ': ' + (lastPost.text || 'Shared media').substring(0, 45) + '...';
    FAKE_CHATS[0].time = generateMessageTime(posts.length - 1, posts.length);
    FAKE_CHATS[0].unread = 0;
  }

  FAKE_CHATS.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'chat-list-item' + (chat.isActive ? ' active' : '');

    let avatarHtml = '';
    if (chat.avatar === 'group') {
      avatarHtml = `<div class="chat-list-avatar group-avatar"><i class="fas ${chat.icon || 'fa-users'}"></i></div>`;
    } else if (chat.initials) {
      avatarHtml = `<div class="chat-list-avatar" style="background: ${chat.color || '#667781'}; color: white; font-weight: 600; font-size: 18px;">${chat.initials}</div>`;
    } else {
      avatarHtml = `<div class="chat-list-avatar"><i class="fas fa-user"></i></div>`;
    }

    const unreadBadge = chat.unread > 0
      ? `<div class="chat-list-badge">${chat.unread}</div>`
      : '';

    const timeClass = chat.unread > 0 ? 'chat-list-time unread' : 'chat-list-time';

    item.innerHTML = `
      ${avatarHtml}
      <div class="chat-list-info">
        <div class="chat-list-top">
          <span class="chat-list-name">${escapeHtml(chat.name)}</span>
          <span class="${timeClass}">${escapeHtml(chat.time)}</span>
        </div>
        <div class="chat-list-bottom">
          <span class="chat-list-preview">${escapeHtml(chat.preview)}</span>
          ${unreadBadge}
        </div>
      </div>
    `;

    // Clicking non-active chats shows "coming soon"
    if (!chat.isActive) {
      item.addEventListener('click', (e) => {
        showComingSoonAt(e.clientX, e.clientY);
      });
    }

    chatListEl.appendChild(item);
  });
}

// ============================================
// VIEW TRACKING (IntersectionObserver)
// ============================================
function startBuzzChatViewTracking() {
  const messages = document.querySelectorAll('#chat-messages .message-wrapper');

  viewTrackingObserver = new IntersectionObserver((entries) => {
    if (!isPageVisible) return;

    entries.forEach(entry => {
      const postId = entry.target.dataset.postId;
      if (!postId) return;

      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        if (!postViewTimes[postId]) {
          const data = entry.target._postData || {};
          postViewTimes[postId] = {
            totalTime: 0,
            lastEnterTime: Date.now(),
            author: data.authorName || 'Unknown',
            type: data.type || 'placeholder',
            isCurrentlyVisible: true
          };
        } else if (!postViewTimes[postId].lastEnterTime) {
          postViewTimes[postId].lastEnterTime = Date.now();
          postViewTimes[postId].isCurrentlyVisible = true;
        }
      } else {
        if (postViewTimes[postId] && postViewTimes[postId].lastEnterTime) {
          postViewTimes[postId].totalTime += Date.now() - postViewTimes[postId].lastEnterTime;
          postViewTimes[postId].lastEnterTime = null;
          postViewTimes[postId].isCurrentlyVisible = false;
        }
      }
    });
  }, { threshold: 0.5 });

  messages.forEach(msg => viewTrackingObserver.observe(msg));

  // Reuse global timer and visibility handlers from circl-core.js
  viewTimerInterval = setInterval(() => {
    // Update view times for debug display (optional future use)
  }, 1000);

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('blur', handleWindowBlur);
  window.addEventListener('focus', handleWindowFocus);
}

// ============================================
// RESULTS MODAL
// ============================================
function setupResultsModal() {
  const resultsBtn = document.getElementById('experience-results-btn');
  const resultsModal = document.getElementById('results-modal');
  const closeBtn = document.getElementById('results-close-btn');

  if (resultsBtn) {
    resultsBtn.addEventListener('click', () => {
      showBuzzChatResults();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      resultsModal.classList.remove('active');
    });
  }

  if (resultsModal) {
    resultsModal.addEventListener('click', (e) => {
      if (e.target === resultsModal) {
        resultsModal.classList.remove('active');
      }
    });
  }
}

function showBuzzChatResults() {
  const sorted = Object.entries(postViewTimes)
    .map(([postId, data]) => ({
      postId,
      ...data,
      totalMs: data.totalTime + (data.lastEnterTime && isPageVisible ? Date.now() - data.lastEnterTime : 0)
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 5);

  const resultsContent = document.getElementById('results-content');
  if (!resultsContent) return;

  resultsContent.innerHTML = sorted.map((item, idx) => {
    const typeLabel = item.type === 'ai-tailored' ? 'Stimulus (Tailored)' :
                      item.type === 'ai-random' ? 'Stimulus (Random)' : 'Filler';
    const seconds = Math.round(item.totalMs / 1000);

    return `
      <div class="results-item">
        <div class="results-rank">#${idx + 1}</div>
        <div class="results-info">
          <div class="results-author">${escapeHtml(item.author)}</div>
          <div class="results-type">${typeLabel}</div>
        </div>
        <div class="results-time">${seconds}s <small>viewed</small></div>
      </div>
    `;
  }).join('');

  document.getElementById('results-modal').classList.add('active');
}

// ============================================
// COMING SOON TOOLTIP
// ============================================
function setupComingSoon() {
  const tooltip = document.getElementById('coming-soon-tooltip');
  if (!tooltip) return;

  // Attach to interactive elements that are non-functional
  const selectors = [
    '.sidebar-header-actions button',
    '.sidebar-search-input',
    '.chat-header-actions button',
    '#chat-input-field',
    '#chat-input-bar button:not(#chat-back-btn)',
    '.chat-input-send',
    '.sidebar-filter:not(.active)'
  ];

  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showComingSoonAt(e.clientX, e.clientY);
      });
    });
  });
}

let comingSoonTimeout = null;

function showComingSoonAt(x, y) {
  const tooltip = document.getElementById('coming-soon-tooltip');
  if (!tooltip) return;

  clearTimeout(comingSoonTimeout);
  tooltip.style.left = `${x + 10}px`;
  tooltip.style.top = `${y - 40}px`;
  tooltip.classList.add('show');

  comingSoonTimeout = setTimeout(() => {
    tooltip.classList.remove('show');
  }, 1500);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch {
    return url;
  }
}
