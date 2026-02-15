/**
 * Pixl Feed - photo feed-style participant interface
 * Depends on circl-core.js (globals: debugMode, postViewTimes, etc.)
 * and feed-loader.js (FeedLoader module)
 */

// ============================================
// STATE
// ============================================
const igArticleClicks = {};
const igVideoPlays = {};
let igLastTap = 0;

// Fake usernames for "Liked by X and Y others" display
const igFakeLikerUsernames = [
  'emma.j', 'lars_nl', 'sophie.v', 'tim_bkr', 'fleur_dj',
  'daan_vd', 'julia.sm', 'nick_de', 'lotte.bg', 'anna.dejong',
  'mark.bakker', 'sophie.vries', 'tim.visser', 'fleur.mulder',
  'max.devries', 'lisa.hendriks', 'thomas.smit', 'eva.jansen',
  'bram.dekker', 'sanne.mulder', 'jesse.vdberg', 'iris.bakker'
];

// ============================================
// STORIES DATA (fake placeholders)
// ============================================
const storyAccounts = [
  { name: 'your_story', label: 'Your story', addNew: true },
  { name: 'emma.j', label: 'emma.j' },
  { name: 'lars_nl', label: 'lars_nl' },
  { name: 'nos_nieuws', label: 'nos_nieuws' },
  { name: 'sophie.v', label: 'sophie.v' },
  { name: 'tim_bkr', label: 'tim_bkr' },
  { name: 'fleur_dj', label: 'fleur_dj' },
  { name: 'rtl_news', label: 'rtl_news' },
  { name: 'daan_vd', label: 'daan_vd' },
  { name: 'julia.sm', label: 'julia.sm' },
  { name: 'nick_de', label: 'nick_de' },
  { name: 'lotte.bg', label: 'lotte.bg' }
];

// Gradient backgrounds for text-only posts
const textGradients = [
  'linear-gradient(45deg, #F58529, #DD2A7B)',
  'linear-gradient(45deg, #DD2A7B, #8134AF)',
  'linear-gradient(45deg, #8134AF, #515BD4)',
  'linear-gradient(45deg, #515BD4, #F58529)',
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #f093fb, #f5576c)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #43e97b, #38f9d7)',
  'linear-gradient(135deg, #fa709a, #fee140)',
  'linear-gradient(135deg, #a18cd1, #fbc2eb)'
];

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', initInstaLookFeed);

async function initInstaLookFeed() {
  const params = getIGParams();

  // Show loader
  const loader = document.getElementById('ig-loader');
  if (loader) loader.style.display = 'flex';

  const messageEl = document.getElementById('ig-loading-message');
  let loadingMessages = ['Loading your feed...'];
  let messageInterval = null;
  let messageIndex = 0;

  try {
    const useJsonFeed = params.source === 'json' && typeof FeedLoader !== 'undefined';

    if (useJsonFeed) {
      // Build personalization from URL params
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

      // Load feed using shared FeedLoader, pointing to shared config
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

      debugMode = params.debug;

      // Wait for loading animation
      await new Promise(resolve => setTimeout(resolve, 3500));

      if (messageInterval) clearInterval(messageInterval);

      // Render stories bar
      renderStories();

      // Render the feed
      renderIGFeed(feedData.posts, feedData.config);

    } else {
      // Legacy / non-json mode: still load from shared config
      loadingMessages = [
        'Loading your feed...',
        'Finding the best content...',
        'Almost there...',
        'Curating your feed...'
      ];

      if (messageEl && loadingMessages.length > 0) {
        messageEl.textContent = loadingMessages[0];
        messageInterval = setInterval(() => {
          messageIndex = (messageIndex + 1) % loadingMessages.length;
          messageEl.textContent = loadingMessages[messageIndex];
        }, 600);
      }

      // Attempt FeedLoader even without source=json
      if (typeof FeedLoader !== 'undefined') {
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
        debugMode = params.debug;

        await new Promise(resolve => setTimeout(resolve, 3500));
        if (messageInterval) clearInterval(messageInterval);

        renderStories();
        renderIGFeed(feedData.posts, feedData.config);
      } else {
        debugMode = params.debug;
        await new Promise(resolve => setTimeout(resolve, 3500));
        if (messageInterval) clearInterval(messageInterval);
        renderStories();
      }
    }

    // Start view tracking if debug
    if (params.debug) {
      const resultsBtn = document.getElementById('ig-results-btn');
      if (resultsBtn) resultsBtn.style.display = 'flex';
      startIGViewTracking();
    }

    // Scroll to top
    window.scrollTo(0, 0);

    // Clear URL params
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Fade out loader
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => {
        loader.style.display = 'none';
        loader.remove();
      }, 500);
    }

    // Coming soon tooltips
    setupIGComingSoonTooltips();

  } catch (error) {
    console.error('InstaLook: Error loading feed:', error);
    showIGError('Could not load the feed. Please try again later.');
  }
}

// ============================================
// URL PARAMETER PARSING
// ============================================
function getIGParams() {
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
    if (
      validAges.includes(age) &&
      validGenders.includes(gender) &&
      validIssues.includes(issue) &&
      !isNaN(politicsNum) &&
      politicsNum >= 0 &&
      politicsNum <= 10
    ) {
      let postsCount = 40;
      if (totalPosts) {
        const parsed = parseInt(totalPosts);
        if (!isNaN(parsed) && parsed >= 10 && parsed <= 100) {
          postsCount = parsed;
        }
      }

      return {
        age,
        gender,
        issue,
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
// STORIES BAR
// ============================================
function renderStories() {
  const container = document.getElementById('ig-stories-list');
  if (!container) return;

  container.innerHTML = '';

  storyAccounts.forEach((account, index) => {
    const isSeen = Math.random() < 0.3;
    const avatarGender = Math.random() > 0.5 ? 'women' : 'men';
    const avatarId = Math.floor(Math.random() * 80) + 1;
    const avatarUrl = `https://randomuser.me/api/portraits/${avatarGender}/${avatarId}.jpg`;

    const li = document.createElement('li');
    li.className = 'ig-story-item';
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');

    if (account.addNew) {
      li.innerHTML = `
        <div class="ig-story-ring no-story" style="position: relative;">
          <img class="ig-story-avatar" src="${avatarUrl}" alt="Your story"
               onerror="this.style.background='#dbdbdb';">
          <div style="position: absolute; bottom: -2px; right: -2px; width: 20px; height: 20px; background: #0095F6; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center;">
            <i class="fas fa-plus" style="color: white; font-size: 10px;"></i>
          </div>
        </div>
        <span class="ig-story-name">${account.label}</span>
      `;
    } else {
      li.innerHTML = `
        <div class="ig-story-ring ${isSeen ? 'seen' : ''}">
          <img class="ig-story-avatar" src="${avatarUrl}" alt="${account.name}"
               onerror="this.style.background='#dbdbdb';">
        </div>
        <span class="ig-story-name">${account.name}</span>
      `;
    }

    li.addEventListener('click', () => showIGComingSoon(li));
    container.appendChild(li);
  });
}

// ============================================
// FEED RENDERING
// ============================================
function renderIGFeed(posts, config) {
  const container = document.getElementById('ig-feed');
  if (!container) return;

  container.innerHTML = '';

  posts.forEach((post, index) => {
    const postEl = createIGPost(post, index);
    container.appendChild(postEl);
  });

  // Setup video ended handlers
  container.querySelectorAll('.ig-post-video').forEach(video => {
    video.muted = true;
    video.addEventListener('ended', () => {
      const overlay = video.parentElement.querySelector('.ig-video-overlay');
      if (overlay) overlay.classList.remove('hidden');
      const muteBtn = video.parentElement.querySelector('.ig-video-mute');
      if (muteBtn) muteBtn.classList.remove('visible');
    });
  });
}

function createIGPost(postData, index) {
  const post = document.createElement('article');

  const isStimulus = postData.type === 'stimulus';
  const isArticle = postData.subtype === 'article';
  const isVideo = postData.subtype === 'video';
  const isOrg = postData.subtype === 'organization' ||
    (isArticle && postData.author?.fallback_icon) ||
    (isVideo && postData.author?.fallback_icon && !postData.author?.gender);

  post.className = 'ig-post';
  if (isStimulus) post.className += ' ig-stimulus-post';

  const postId = `${postData.type}-${postData.id || index}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  post.dataset.postId = postId;
  post.dataset.postType = postData.type;

  if (isStimulus && postData.metadata) {
    post.dataset.conditionId = postData.condition_id;
    post.dataset.ideology = postData.metadata.ideology;
    post.dataset.policy = postData.metadata.policy_issue;
    post.dataset.isTailored = postData._isTailored ? 'true' : 'false';
  }

  // Author
  const author = postData.author || {};
  const authorName = author.name || 'Unknown';
  const username = authorNameToUsername(authorName);
  const time = postData.time || '1h';
  const engagement = postData.engagement || { likes: 0, comments: 0, shares: 0 };
  const isTailored = postData._isTailored || false;

  // Has story ring (random chance)
  const hasStoryRing = Math.random() > 0.5;
  const isVerified = isOrg || (isStimulus && Math.random() > 0.6);

  // Determine if this is a "sponsored" post (~8% chance for non-stimulus)
  const isSponsored = !isStimulus && Math.random() < 0.08;

  // Determine if this is a "suggested for you" post (~5% chance for non-stimulus, non-sponsored)
  const isSuggested = !isStimulus && !isSponsored && Math.random() < 0.05;

  // Mark suggested posts with a class
  if (isSuggested) {
    post.className += ' ig-suggested-post';
  }

  // Avatar HTML
  let avatarHtml;
  const ringClass = hasStoryRing ? '' : 'no-story';

  if (isOrg && author.logo_url) {
    avatarHtml = `
      <div class="ig-post-avatar-ring ${ringClass}">
        <img class="ig-post-avatar" src="${author.logo_url}" alt="${authorName}"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="ig-post-avatar-fallback" style="display:none; background: linear-gradient(135deg, #DD2A7B, #8134AF);">
          <i class="fas fa-${author.fallback_icon || 'building'}" style="font-size: 14px;"></i>
        </div>
      </div>`;
  } else if (isOrg) {
    avatarHtml = `
      <div class="ig-post-avatar-ring ${ringClass}">
        <div class="ig-post-avatar-fallback" style="background: linear-gradient(135deg, #DD2A7B, #8134AF);">
          <i class="fas fa-${author.fallback_icon || 'building'}" style="font-size: 14px;"></i>
        </div>
      </div>`;
  } else if (author.avatar_url) {
    const initials = author.initials || authorName.split(' ').map(n => n[0]).join('').toUpperCase();
    const fallbackColor = postData._fallbackColor || '#DD2A7B';
    avatarHtml = `
      <div class="ig-post-avatar-ring ${ringClass}">
        <img class="ig-post-avatar" src="${author.avatar_url}" alt="${authorName}"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="ig-post-avatar-fallback" style="display:none; background: ${fallbackColor};">${initials}</div>
      </div>`;
  } else {
    const initials = author.initials || authorName.split(' ').map(n => n[0]).join('').toUpperCase();
    const fallbackColor = postData._fallbackColor || '#DD2A7B';
    avatarHtml = `
      <div class="ig-post-avatar-ring ${ringClass}">
        <div class="ig-post-avatar-fallback" style="background: ${fallbackColor};">${initials}</div>
      </div>`;
  }

  // Verified badge
  const verifiedHtml = isVerified ? '<span class="ig-post-verified"><i class="fas fa-circle-check"></i></span>' : '';

  // Sponsored label
  const sponsoredHtml = isSponsored ? '<span class="ig-sponsored-label">Sponsored</span>' : '';

  // Suggested label
  const suggestedHtml = isSuggested ? '<span class="ig-suggested-label">Suggested for you</span>' : '';

  // Follow button for suggested posts
  const followBtnHtml = isSuggested ? '<button class="ig-post-follow-btn">Follow</button>' : '';

  // Media HTML
  let mediaHtml = '';
  const hasImage = postData.image && postData.image.show !== false && postData.image.src;
  const hasArticle = isArticle && postData.article;
  const hasVideo = isVideo && postData.video;
  const hasText = postData.text && postData.text.trim();

  if (hasVideo) {
    const video = postData.video;
    const posterSrc = video.thumbnail || '';
    mediaHtml = `
      <div class="ig-post-media" data-video-id="${postData.id || index}">
        <video class="ig-post-video" preload="metadata" playsinline muted loop
               ${posterSrc ? `poster="${posterSrc}"` : ''}>
          <source src="${video.src}" type="video/mp4">
        </video>
        <div class="ig-video-overlay">
          <div class="ig-video-play-icon"><i class="fas fa-play"></i></div>
        </div>
        <button class="ig-video-mute" aria-label="Toggle mute">
          <i class="fas fa-volume-xmark"></i>
        </button>
        <i class="fas fa-heart ig-heart-overlay"></i>
      </div>`;
  } else if (hasImage) {
    mediaHtml = `
      <div class="ig-post-media">
        <img src="${postData.image.src}" alt="${postData.image.alt || 'Post image'}" loading="lazy"
             onerror="this.parentElement.style.display='none';">
        <i class="fas fa-heart ig-heart-overlay"></i>
      </div>`;
  } else if (hasArticle) {
    // Article posts render thumbnail as image
    const thumbnail = postData.article.thumbnail || 'https://picsum.photos/seed/' + index + '/600/600';
    mediaHtml = `
      <div class="ig-post-media" data-article-id="${postData.id || index}" data-url="${postData.article.url || '#'}">
        <img src="${thumbnail}" alt="${postData.article.title || 'Article'}" loading="lazy"
             onerror="this.src='https://picsum.photos/seed/${index}/600/600';">
        <i class="fas fa-heart ig-heart-overlay"></i>
      </div>`;
  } else if (hasText) {
    // Text-only post: show on gradient background
    const gradient = textGradients[index % textGradients.length];
    mediaHtml = `
      <div class="ig-post-media">
        <div class="ig-post-gradient-bg" style="background: ${gradient};">
          <div class="ig-post-gradient-text">${postData.text}</div>
        </div>
        <i class="fas fa-heart ig-heart-overlay"></i>
      </div>`;
  }

  // Caption text
  let captionHtml = '';
  // For text-only posts rendered on gradient, skip the text caption
  const isTextOnlyOnGradient = !hasImage && !hasVideo && !hasArticle && hasText;

  if (hasText && !isTextOnlyOnGradient) {
    captionHtml = `
      <div class="ig-post-caption">
        <span class="ig-post-caption-username">${username}</span>
        <span class="ig-post-caption-text">${postData.text}</span>
      </div>`;
  } else if (hasArticle && postData.article.title) {
    // For article posts, show article info as caption
    const sourceLabel = postData.article.source ? `<span class="ig-hashtag">${postData.article.source}</span> ` : '';
    captionHtml = `
      <div class="ig-post-caption">
        <span class="ig-post-caption-username">${username}</span>
        <span class="ig-post-caption-text">${sourceLabel}${postData.article.title}</span>
      </div>`;
  }

  // View comments
  const commentsText = engagement.comments > 0
    ? `<div class="ig-post-view-comments">View all ${engagement.comments} comments</div>`
    : '';

  // Debug info
  let debugHtml = '';
  if (debugMode && isStimulus && postData.metadata) {
    const badgeClass = isTailored ? 'tailored' : 'random';
    const badgeIcon = isTailored ? 'fa-bullseye' : 'fa-dice';
    const badgeLabel = isTailored ? 'TAILORED' : 'RANDOM';
    debugHtml = `
      <div class="ig-debug-info">
        <span class="ig-debug-badge ${badgeClass}"><i class="fas ${badgeIcon}"></i> ${badgeLabel}</span>
        <span class="ig-debug-details">${postData.condition_id || 'Unknown'}</span>
      </div>`;
  }

  const viewTimerHtml = debugMode ? '<div class="ig-view-timer">0s</div>' : '';

  // Format time for display
  const timeDisplay = formatIGTime(time);

  // Format likes - use "Liked by <user> and X others" format for some posts
  const likesHtml = formatLikesHtml(engagement.likes, author.avatar_url);

  // Comment input placeholder
  const commentInputHtml = `
    <div class="ig-post-comment-input">
      <i class="far fa-face-smile ig-comment-emoji"></i>
      <span class="ig-comment-placeholder">Add a comment...</span>
      <button class="ig-comment-post-btn">Post</button>
    </div>`;

  // Build complete post HTML
  post.innerHTML = `
    <div class="ig-post-header">
      ${avatarHtml}
      <div class="ig-post-header-info">
        <span class="ig-post-username">${username}</span>${verifiedHtml}
        ${sponsoredHtml}
        ${suggestedHtml}
      </div>
      ${followBtnHtml}
      <button class="ig-post-more" aria-label="More options"><i class="fas fa-ellipsis"></i></button>
    </div>

    ${mediaHtml}
    ${debugHtml}

    <div class="ig-post-actions">
      <div class="ig-post-actions-left">
        <button class="ig-action-btn ig-like-btn" aria-label="Like" data-post-id="${postId}">
          <i class="far fa-heart"></i>
        </button>
        <button class="ig-action-btn ig-comment-btn" aria-label="Comment" data-post-id="${postId}">
          <i class="far fa-comment"></i>
        </button>
        <button class="ig-action-btn ig-share-btn" aria-label="Share" data-post-id="${postId}">
          <i class="far fa-paper-plane"></i>
        </button>
      </div>
      <div class="ig-post-actions-right">
        <button class="ig-action-btn ig-save-btn" aria-label="Save" data-post-id="${postId}">
          <i class="far fa-bookmark"></i>
        </button>
      </div>
    </div>

    <div class="ig-post-likes" data-likes="${engagement.likes}">
      ${likesHtml}
    </div>

    ${captionHtml}
    ${commentsText}

    <div class="ig-post-time">${timeDisplay}</div>
    ${commentInputHtml}
    ${viewTimerHtml}
  `;

  // Attach interactions
  attachIGPostInteractions(post, postId, engagement.likes, author.avatar_url);

  // Store post data for tracking
  post._postData = {
    postId,
    postType: postData.type,
    type: isStimulus ? (isTailored ? 'ai-tailored' : 'ai-random') : 'placeholder',
    conditionId: postData.condition_id,
    isTailored,
    authorName,
    likes: engagement.likes,
    comments: engagement.comments,
    shares: engagement.shares,
    text: postData.text || '',
    isSponsored,
    isSuggested
  };

  return post;
}

// ============================================
// POST INTERACTIONS
// ============================================
function attachIGPostInteractions(post, postId, originalLikes, authorAvatarUrl) {
  // Like button
  const likeBtn = post.querySelector('.ig-like-btn');
  const likesEl = post.querySelector('.ig-post-likes');
  let currentLikes = originalLikes;
  let isLiked = false;

  if (likeBtn) {
    likeBtn.addEventListener('click', () => {
      isLiked = !isLiked;
      if (isLiked) {
        currentLikes++;
        likeBtn.classList.add('liked');
        likeBtn.querySelector('i').className = 'fas fa-heart';
      } else {
        currentLikes--;
        likeBtn.classList.remove('liked');
        likeBtn.querySelector('i').className = 'far fa-heart';
      }
      likesEl.innerHTML = formatLikesHtml(currentLikes, authorAvatarUrl);
      likesEl.dataset.likes = currentLikes;
    });
  }

  // Double-tap to like on media
  const mediaEl = post.querySelector('.ig-post-media');
  if (mediaEl) {
    let lastTapTime = 0;
    mediaEl.addEventListener('click', (e) => {
      // Skip if clicking on video controls or overlay play button
      if (e.target.closest('.ig-video-mute') || e.target.closest('.ig-video-play-icon')) return;

      const now = Date.now();
      if (now - lastTapTime < 300) {
        // Double tap
        if (!isLiked) {
          isLiked = true;
          currentLikes++;
          likeBtn.classList.add('liked');
          likeBtn.querySelector('i').className = 'fas fa-heart';
          likesEl.innerHTML = formatLikesHtml(currentLikes, authorAvatarUrl);
          likesEl.dataset.likes = currentLikes;
        }

        // Show heart animation
        const heartOverlay = mediaEl.querySelector('.ig-heart-overlay');
        if (heartOverlay) {
          heartOverlay.classList.remove('animate');
          // Force reflow
          void heartOverlay.offsetWidth;
          heartOverlay.classList.add('animate');
          setTimeout(() => heartOverlay.classList.remove('animate'), 1000);
        }
      } else {
        // Single tap on video: play/pause
        const videoEl = mediaEl.querySelector('.ig-post-video');
        if (videoEl) {
          toggleIGVideo(mediaEl, videoEl);
        }
      }
      lastTapTime = now;
    });
  }

  // Video mute button
  const muteBtn = post.querySelector('.ig-video-mute');
  if (muteBtn) {
    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const videoEl = post.querySelector('.ig-post-video');
      if (videoEl) {
        videoEl.muted = !videoEl.muted;
        muteBtn.querySelector('i').className = videoEl.muted ? 'fas fa-volume-xmark' : 'fas fa-volume-high';
      }
    });
  }

  // Comment button - focus the comment placeholder area
  const commentBtn = post.querySelector('.ig-comment-btn');
  if (commentBtn) {
    commentBtn.addEventListener('click', () => showIGComingSoon(commentBtn));
  }

  // Comment input area - coming soon
  const commentInput = post.querySelector('.ig-post-comment-input');
  if (commentInput) {
    commentInput.addEventListener('click', () => showIGComingSoon(commentInput));
  }

  // Share button
  const shareBtn = post.querySelector('.ig-share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => showIGComingSoon(shareBtn));
  }

  // Save/bookmark button
  const saveBtn = post.querySelector('.ig-save-btn');
  if (saveBtn) {
    let isSaved = false;
    saveBtn.addEventListener('click', () => {
      isSaved = !isSaved;
      saveBtn.classList.toggle('saved', isSaved);
      saveBtn.querySelector('i').className = isSaved ? 'fas fa-bookmark' : 'far fa-bookmark';
    });
  }

  // More button
  const moreBtn = post.querySelector('.ig-post-more');
  if (moreBtn) {
    moreBtn.addEventListener('click', () => showIGComingSoon(moreBtn));
  }

  // Follow button (for suggested posts)
  const followBtn = post.querySelector('.ig-post-follow-btn');
  if (followBtn) {
    followBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (followBtn.textContent === 'Follow') {
        followBtn.textContent = 'Following';
        followBtn.style.color = 'var(--ig-text-primary)';
        followBtn.style.fontWeight = '400';
      } else {
        followBtn.textContent = 'Follow';
        followBtn.style.color = '';
        followBtn.style.fontWeight = '';
      }
    });
  }

  // Article click tracking
  const articleMedia = post.querySelector('.ig-post-media[data-article-id]');
  if (articleMedia) {
    articleMedia.addEventListener('click', () => {
      const articleId = articleMedia.dataset.articleId;
      const url = articleMedia.dataset.url;
      if (!igArticleClicks[articleId]) {
        igArticleClicks[articleId] = { clicks: 0, first_click: null, url };
      }
      igArticleClicks[articleId].clicks++;
      if (!igArticleClicks[articleId].first_click) {
        igArticleClicks[articleId].first_click = new Date().toISOString();
      }
      igArticleClicks[articleId].last_click = new Date().toISOString();
      console.log('[InstaLook Article Click]', articleId, igArticleClicks[articleId]);
    });
  }
}

// ============================================
// VIDEO PLAYBACK
// ============================================
function toggleIGVideo(container, videoEl) {
  const overlay = container.querySelector('.ig-video-overlay');
  const muteBtn = container.querySelector('.ig-video-mute');

  if (videoEl.paused) {
    // Pause all other videos
    document.querySelectorAll('.ig-post-video').forEach(v => {
      if (v !== videoEl && !v.paused) {
        v.pause();
        const otherContainer = v.closest('.ig-post-media');
        const otherOverlay = otherContainer?.querySelector('.ig-video-overlay');
        const otherMute = otherContainer?.querySelector('.ig-video-mute');
        if (otherOverlay) otherOverlay.classList.remove('hidden');
        if (otherMute) otherMute.classList.remove('visible');
      }
    });

    videoEl.play();
    if (overlay) overlay.classList.add('hidden');
    if (muteBtn) muteBtn.classList.add('visible');

    // Track play
    const videoId = container.dataset.videoId;
    if (videoId) {
      if (!igVideoPlays[videoId]) {
        igVideoPlays[videoId] = { plays: 0, first_play: null };
      }
      igVideoPlays[videoId].plays++;
      if (!igVideoPlays[videoId].first_play) {
        igVideoPlays[videoId].first_play = new Date().toISOString();
      }
      igVideoPlays[videoId].last_play = new Date().toISOString();
    }
  } else {
    videoEl.pause();
    if (overlay) overlay.classList.remove('hidden');
    if (muteBtn) muteBtn.classList.remove('visible');
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function authorNameToUsername(name) {
  if (!name) return 'user';
  // Convert "Jan de Jong" to "jan.dejong" or "jan_dejong"
  const parts = name.toLowerCase().split(' ');
  if (parts.length === 1) return parts[0];

  // Filter out common Dutch prefixes from merging
  const connectors = ['de', 'van', 'den', 'der', 'het', 'ten', 'ter'];
  let result = parts[0];

  for (let i = 1; i < parts.length; i++) {
    if (connectors.includes(parts[i]) && i < parts.length - 1) {
      result += '.' + parts[i] + parts[i + 1];
      i++; // skip next
    } else {
      result += '.' + parts[i];
    }
  }

  // Add random suffix sometimes
  if (Math.random() > 0.6) {
    const suffixes = ['_nl', '.official', '_', '' + Math.floor(Math.random() * 99)];
    result += suffixes[Math.floor(Math.random() * suffixes.length)];
  }

  return result.replace(/\s/g, '');
}

/**
 * Format likes as plain text (for simple count updates)
 */
function formatLikes(count) {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'm likes';
  }
  if (count >= 10000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k likes';
  }
  if (count >= 1000) {
    return count.toLocaleString() + ' likes';
  }
  return count + ' likes';
}

/**
 * Format likes as HTML with "Liked by <username> and X others" style
 * Used for richer display matching platform style
 */
function formatLikesHtml(count, authorAvatarUrl) {
  // For posts with very few likes or very high counts, use simple format
  if (count < 5 || count >= 100000) {
    return formatLikes(count);
  }

  // ~40% chance of showing the "Liked by X and Y others" format
  // Use a deterministic-ish approach based on count to keep it stable
  const useRichFormat = (count % 5 < 2) && count >= 10;

  if (useRichFormat) {
    const likerName = igFakeLikerUsernames[count % igFakeLikerUsernames.length];
    const othersCount = count - 1;

    if (othersCount <= 0) {
      return `Liked by <span class="ig-likes-username">${likerName}</span>`;
    }

    const othersFormatted = othersCount >= 1000
      ? (othersCount / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
      : othersCount.toLocaleString();

    return `Liked by <span class="ig-likes-username">${likerName}</span> and <span style="font-weight: 600;">${othersFormatted} others</span>`;
  }

  return formatLikes(count);
}

function formatIGTime(time) {
  if (!time) return '1 HOUR AGO';
  // time is like "5h", "12h", "1h"
  const match = time.match(/^(\d+)(h|m|d|w)$/);
  if (match) {
    const num = parseInt(match[1]);
    const unit = match[2];
    const unitMap = { h: 'HOUR', m: 'MINUTE', d: 'DAY', w: 'WEEK' };
    const label = unitMap[unit] || 'HOUR';
    return `${num} ${label}${num !== 1 ? 'S' : ''} AGO`;
  }
  return time.toUpperCase();
}

// ============================================
// VIEW TRACKING
// ============================================
function startIGViewTracking() {
  const posts = document.querySelectorAll('#ig-feed .ig-post');

  viewTrackingObserver = new IntersectionObserver((entries) => {
    if (!isPageVisible) return;

    entries.forEach(entry => {
      const postId = entry.target.dataset.postId;
      if (!postId) return;

      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        if (!postViewTimes[postId]) {
          const author = entry.target.querySelector('.ig-post-username')?.textContent || 'Unknown';
          const isStimulus = entry.target.classList.contains('ig-stimulus-post');
          const isTailored = entry.target.dataset.isTailored === 'true';
          postViewTimes[postId] = {
            totalTime: 0,
            lastEnterTime: Date.now(),
            author,
            type: isStimulus ? (isTailored ? 'ai-tailored' : 'ai-random') : 'regular',
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

    updateIGViewTimers();
  }, { threshold: 0.5 });

  posts.forEach(post => viewTrackingObserver.observe(post));

  viewTimerInterval = setInterval(updateIGViewTimers, 1000);

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('blur', handleWindowBlur);
  window.addEventListener('focus', handleWindowFocus);
}

function updateIGViewTimers() {
  const now = Date.now();

  Object.keys(postViewTimes).forEach(postId => {
    const data = postViewTimes[postId];
    let totalMs = data.totalTime;
    if (data.lastEnterTime && isPageVisible) {
      totalMs += now - data.lastEnterTime;
    }

    const timerEl = document.querySelector(`[data-post-id="${postId}"] .ig-view-timer`);
    if (timerEl) {
      timerEl.textContent = `${Math.round(totalMs / 1000)}s`;
      if (debugMode) {
        timerEl.style.display = 'block';
      }
    }
  });
}

// ============================================
// RESULTS MODAL
// ============================================
function showIGResults() {
  const sorted = Object.entries(postViewTimes)
    .map(([postId, data]) => ({
      postId,
      ...data,
      totalMs: data.totalTime + (data.lastEnterTime && isPageVisible ? Date.now() - data.lastEnterTime : 0)
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 5);

  const resultsContent = document.getElementById('ig-results-content');
  if (!resultsContent) return;

  resultsContent.innerHTML = sorted.map((item, idx) => {
    const typeLabel = item.type === 'ai-tailored' ? 'Tailored Stimulus' :
                      item.type === 'ai-random' ? 'Random Stimulus' : 'Regular Post';
    const seconds = Math.round(item.totalMs / 1000);

    return `
      <div class="ig-results-item">
        <div class="ig-results-rank">#${idx + 1}</div>
        <div class="ig-results-info">
          <div class="ig-results-author">${item.author}</div>
          <div class="ig-results-type">${typeLabel}</div>
        </div>
        <div class="ig-results-time">${seconds}s <small>viewed</small></div>
      </div>
    `;
  }).join('');

  document.getElementById('ig-results-modal').classList.add('active');
}

function closeIGResults() {
  document.getElementById('ig-results-modal').classList.remove('active');
}

// ============================================
// COMING SOON TOOLTIP
// ============================================
function setupIGComingSoonTooltips() {
  const selectors = [
    '.ig-desktop-nav .ig-nav-item:not(.active)',
    '.ig-bottom-nav-item:not(.active)',
    '.ig-header-camera',
    '.ig-header-icon',
    '.ig-desktop-sidebar .ig-suggestion-follow',
    '.ig-desktop-sidebar .ig-sidebar-switch',
    '.ig-desktop-sidebar .ig-sidebar-see-all',
    '.ig-desktop-sidebar .ig-suggestion-dismiss',
    '.ig-post-view-comments'
  ];

  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showIGComingSoon(el);
      });
    });
  });

  // Sidebar dismiss buttons - also remove the suggestion row on click
  document.querySelectorAll('.ig-suggestion-dismiss').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const suggestion = btn.closest('.ig-suggestion');
      if (suggestion) {
        suggestion.style.transition = 'opacity 0.2s, height 0.2s, margin 0.2s, padding 0.2s';
        suggestion.style.opacity = '0';
        suggestion.style.height = '0';
        suggestion.style.marginBottom = '0';
        suggestion.style.overflow = 'hidden';
        setTimeout(() => suggestion.remove(), 250);
      }
    });
  });
}

function showIGComingSoon(element) {
  const tooltip = document.getElementById('ig-coming-soon-tooltip');
  if (!tooltip) return;

  const rect = element.getBoundingClientRect();
  tooltip.style.left = `${rect.left + rect.width / 2}px`;
  tooltip.style.top = `${rect.top - 40}px`;
  tooltip.style.transform = 'translateX(-50%)';
  tooltip.classList.add('show');

  clearTimeout(tooltip._hideTimeout);
  tooltip._hideTimeout = setTimeout(() => {
    tooltip.classList.remove('show');
  }, 1500);
}

// ============================================
// DESKTOP SIDEBAR RENDERING
// ============================================
function renderDesktopSidebar() {
  // Sidebar is static HTML; suggestions are placeholders
  // Already rendered in feed.html
}

// ============================================
// ERROR HANDLING
// ============================================
function showIGError(message) {
  const loader = document.getElementById('ig-loader');
  if (loader) {
    loader.innerHTML = `
      <div class="ig-loader-content">
        <div style="font-size: 48px; margin-bottom: 20px;">
          <i class="fas fa-exclamation-circle" style="color: #ED4956;"></i>
        </div>
        <div class="ig-loader-title" style="-webkit-text-fill-color: #ED4956;">Error</div>
        <div class="ig-loader-text">${message}</div>
      </div>
    `;
  }
}
