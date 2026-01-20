/**
 * Circl Feed - Participant interface functionality
 * Depends on circl-core.js and optionally feed-loader.js
 */

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', initParticipantFeed);

async function initParticipantFeed() {
  // Parse URL parameters (will use random if none provided)
  const params = getSurveyParams();
  
  // Show loading screen
  const loader = document.getElementById('survey-loader');
  loader.style.display = 'flex';
  
  // Start rotating loading messages
  const loadingMessages = [
    "Preparing something amazing...",
    "Gathering the latest posts...",
    "Almost there, just a moment...",
    "Curating your perfect feed...",
    "Finding the best content for you...",
    "Putting it all together...",
    "Just a few more seconds...",
    "Almost ready to go!"
  ];
  
  let messageIndex = 0;
  const messageEl = document.getElementById('loading-message');
  const messageInterval = setInterval(() => {
    messageIndex = (messageIndex + 1) % loadingMessages.length;
    if (messageEl) {
      messageEl.textContent = loadingMessages[messageIndex];
    }
  }, 600);
  
  try {
    // Check if we should use JSON-based feed (source=json in URL)
    const useJsonFeed = params.source === 'json' && typeof FeedLoader !== 'undefined';
    
    if (useJsonFeed) {
      // Build personalization options from URL params
      const feedOptions = {};
      
      // Add personalization if any params are present
      if (params.gender || params.age || params.politics || params.issue) {
        feedOptions.personalization = {
          gender: params.gender,
          age: params.age,
          politics: params.politics, // Will be converted to ideology by FeedLoader
          issue: params.issue
        };
      }
      
      // Override total posts if specified
      if (params.totalPosts) {
        feedOptions.totalPosts = params.totalPosts;
      }
      
      // Use new JSON-based feed loader with personalization
      const feedData = await FeedLoader.loadFeed('data/feed-config.json', feedOptions);
      
      // Set debug mode from params
      debugMode = params.debug;
      
      // Wait for loading animation
      await new Promise(resolve => setTimeout(resolve, 3500));
      
      // Stop rotating messages
      clearInterval(messageInterval);
      
      // Render posts from JSON
      renderJsonFeed(feedData.posts, feedData.config);
      
    } else {
      // Use original conditions.json based feed
      await loadConditionsData();
      
      // Set debug mode from params
      debugMode = params.debug;
      
      // Convert political score to ideology
      const ideology = getIdeologyFromPolitical(params.politics);
      
      // Wait for loading animation
      await new Promise(resolve => setTimeout(resolve, 3500));
      
      // Stop rotating messages
      clearInterval(messageInterval);
      
      // Generate feed using original method
      generateExperienceFeed(params.gender, params.age, ideology, params.issue, params.totalPosts);
    }
    
    // Start view tracking if debug mode
    if (params.debug) {
      document.getElementById('experience-results-btn').style.display = 'flex';
      startViewTracking();
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
    
    // Clear URL parameters
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Fade out loader
    loader.classList.add('fade-out');
    setTimeout(() => {
      loader.style.display = 'none';
      loader.remove();
    }, 600);
    
    // Setup coming soon tooltips
    setupComingSoonTooltips();
    
  } catch (error) {
    console.error('Error loading feed:', error);
    showError('Could not load the feed. Please try again later.');
  }
}

// ============================================
// JSON-BASED FEED RENDERING
// ============================================
function renderJsonFeed(posts, config) {
  const container = document.getElementById('experience-posts');
  if (!container) return;
  
  container.innerHTML = '';
  
  posts.forEach((post, index) => {
    const postElement = createPostFromJson(post, index);
    container.appendChild(postElement);
  });
  
  // Attach interactions
  attachExperienceInteractions();
}

function createPostFromJson(postData, index) {
  const post = document.createElement('article');
  
  // Determine post class based on type
  const isStimulus = postData.type === 'stimulus';
  const isOrg = postData.subtype === 'organization';
  
  post.className = isStimulus ? 'post ai-post stimulus-post' : 'post placeholder-post';
  
  const postId = `${postData.type}-${postData.id || index}-${Date.now()}`;
  post.dataset.postId = postId;
  post.dataset.postType = postData.type;
  
  if (isStimulus && postData.metadata) {
    post.dataset.conditionId = postData.condition_id;
    post.dataset.ideology = postData.metadata.ideology;
    post.dataset.policy = postData.metadata.policy_issue;
    // Mark if tailored for view tracking
    post.dataset.isTailored = postData._isTailored ? 'true' : 'false';
  }
  
  // Author info
  const author = postData.author || {};
  const authorName = author.name || 'Unknown';
  const time = postData.time || '1h';
  const engagement = postData.engagement || { likes: 0, comments: 0, shares: 0 };
  
  // Avatar HTML
  let avatarHtml;
  if (isOrg) {
    if (author.logo_url) {
      avatarHtml = `
        <div class="avatar-wrapper">
          <img class="post-avatar-img org-logo" src="${author.logo_url}" alt="${authorName}" 
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div class="post-avatar org-avatar" style="display:none;">
            <i class="fas fa-${author.fallback_icon || 'building'}"></i>
          </div>
        </div>`;
    } else {
      avatarHtml = `
        <div class="avatar-wrapper">
          <div class="post-avatar org-avatar">
            <i class="fas fa-${author.fallback_icon || 'building'}"></i>
          </div>
        </div>`;
    }
  } else {
    // Person avatar
    if (author.avatar_url) {
      const initials = author.initials || authorName.split(' ').map(n => n[0]).join('').toUpperCase();
      const fallbackColor = postData._fallbackColor || '#1877F2';
      avatarHtml = `
        <div class="avatar-wrapper">
          <img class="post-avatar-img" src="${author.avatar_url}" alt="${authorName}"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div class="post-avatar" style="display:none; background: ${fallbackColor};">${initials}</div>
        </div>`;
    } else {
      const initials = author.initials || authorName.split(' ').map(n => n[0]).join('').toUpperCase();
      const fallbackColor = postData._fallbackColor || '#1877F2';
      avatarHtml = `
        <div class="avatar-wrapper">
          <div class="post-avatar" style="background: ${fallbackColor};">${initials}</div>
        </div>`;
    }
  }
  
  // Image HTML
  let imageHtml = '';
  if (postData.image && (postData.image.show !== false)) {
    imageHtml = `
      <div class="post-media" style="border-radius: 0;">
        <img src="${postData.image.src}" alt="${postData.image.alt || 'Post image'}" 
             loading="lazy" style="width: 100%; display: block;"
             onerror="this.parentElement.style.display='none';">
      </div>`;
  }
  
  // Post text
  const postText = postData.text || '';
  
  // Post content HTML (only show if there's text)
  const postContentHtml = postText ? `
    <div class="post-content">
      <p class="post-text">${postText}</p>
    </div>` : '';
  
  // Determine if this is a tailored or random stimulus
  const isTailored = postData._isTailored || false;
  const stimulusType = isTailored ? 'ai-tailored' : 'ai-random';
  
  // Debug info for stimulus posts (includes tailored/random distinction)
  let debugHtml = '';
  if (debugMode && isStimulus && postData.metadata) {
    const badgeClass = isTailored ? 'tailored' : 'random';
    const badgeIcon = isTailored ? 'fa-bullseye' : 'fa-dice';
    const badgeLabel = isTailored ? 'TAILORED' : 'RANDOM';
    debugHtml = `
      <div class="ai-debug-info">
        <span class="debug-badge ${badgeClass}"><i class="fas ${badgeIcon}"></i> ${badgeLabel}</span>
        <span class="debug-details">${postData.condition_id || 'Unknown condition'}</span>
      </div>`;
  }
  
  // View timer for debug mode (shows seconds viewed)
  const viewTimerHtml = debugMode ? '<div class="view-timer" style="display:none;">0s</div>' : '';
  
  // Build HTML
  post.innerHTML = `
    <div class="post-header-section">
      <div class="post-header">
        ${avatarHtml}
        <div class="post-header-info">
          <div class="post-name-row">
            <span class="post-author">${authorName}</span>
          </div>
          <div class="post-meta">
            <span>${time}</span>
            <span>·</span>
            <i class="fas fa-globe-americas"></i>
          </div>
        </div>
        <div class="post-more"><i class="fas fa-ellipsis"></i></div>
      </div>
    </div>
    
    ${postContentHtml}
    
    ${imageHtml}
    ${debugHtml}
    ${viewTimerHtml}
    
    <div class="post-engagement">
      <div class="engagement-counts">
        <div class="like-count">
          <span style="background: linear-gradient(135deg, #1877F2, #00A3A3); width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">
            <i class="fas fa-thumbs-up" style="color: white; font-size: 10px;"></i>
          </span>
          <span class="like-number">${engagement.likes}</span>
        </div>
        <div class="comment-share-count">
          <span class="comment-count">${engagement.comments} comments</span> · 
          <span class="share-count">${engagement.shares} shares</span>
        </div>
      </div>
    </div>
    
    <div class="post-actions">
      <button class="post-action-btn like-btn"><i class="far fa-thumbs-up"></i><span>Like</span></button>
      <button class="post-action-btn comment-btn"><i class="far fa-comment"></i><span>Comment</span></button>
      <button class="post-action-btn share-btn"><i class="far fa-share-square"></i><span>Share</span></button>
    </div>
    
    <div class="post-comment-section" style="display: none;">
      <input type="text" class="post-comment-input" placeholder="Write a comment...">
    </div>
  `;
  
  // Store post data for tracking (including type for view tracking results)
  post._postData = {
    postId: postId,
    postType: postData.type,
    type: isStimulus ? stimulusType : 'placeholder', // For view tracking results
    conditionId: postData.condition_id,
    isTailored: isTailored,
    authorName: authorName,
    likes: engagement.likes,
    comments: engagement.comments,
    shares: engagement.shares,
    text: postText
  };
  
  return post;
}

// ============================================
// URL PARAMETER PARSING
// ============================================
function getSurveyParams() {
  const params = new URLSearchParams(window.location.search);
  const age = params.get('age');
  const gender = params.get('gender');
  const issue = params.get('issue');
  const politics = params.get('politics');
  const debug = params.get('debug');
  const totalPosts = params.get('total_posts');
  const source = params.get('source'); // 'json' to use JSON-based feed

  // Valid options
  const validAges = ['18-29', '30-44', '45-59', '60+'];
  const validGenders = ['male', 'female'];
  const validIssues = [
    'Affordable_childcare_access',
    'Build_more_homes_accelerate_construction',
    'CO2_levy_for_industry_climate',
    'purchasing_power',
    'stop_weapon_ship_to_israel'
  ];

  // Helper to pick random from array
  const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Check if we have valid explicit parameters
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
      // Parse total_posts, default to 40, min 10, max 100
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
        source: source || null,
        isRandom: false
      };
    }
  }
  
  // No valid params - generate random ones
  return {
    age: randomPick(validAges),
    gender: randomPick(validGenders),
    issue: randomPick(validIssues),
    politics: Math.floor(Math.random() * 11), // 0-10
    debug: debug === 'T' || debug === 'true' || debug === '1',
    totalPosts: 40,
    source: source || null,
    isRandom: true
  };
}

// ============================================
// COMING SOON TOOLTIPS
// ============================================
function setupComingSoonTooltips() {
  const tooltip = document.getElementById('coming-soon-tooltip');
  let hideTimeout;

  // Elements that should show "coming soon" tooltip
  const selectors = [
    '.sidebar-left .sidebar-nav-item',
    '.sidebar-right',
    '.header-right .header-icon-btn',
    '.header-search',
    '.create-post-box',
    '.header-nav-item',
    '.header-profile'
  ];

  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showComingSoonTooltip(e.clientX, e.clientY);
      });
    });
  });

  function showComingSoonTooltip(x, y) {
    clearTimeout(hideTimeout);
    tooltip.style.left = `${x + 10}px`;
    tooltip.style.top = `${y - 40}px`;
    tooltip.classList.add('show');

    hideTimeout = setTimeout(() => {
      tooltip.classList.remove('show');
    }, 1500);
  }
}

// ============================================
// ERROR HANDLING
// ============================================
function showError(message) {
  const loader = document.getElementById('survey-loader');
  if (loader) {
    loader.innerHTML = `
      <div class="survey-loader-content">
        <div style="font-size: 64px; margin-bottom: 24px;">⚠️</div>
        <h1 class="survey-loader-title" style="color: var(--circl-red);">Error</h1>
        <div class="survey-loader-text">${message}</div>
      </div>
    `;
  }
}
