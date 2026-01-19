/**
 * Circl Feed - Participant interface functionality
 * Depends on circl-core.js
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
    // Load data
    await loadConditionsData();
    
    // Set debug mode from params
    debugMode = params.debug;
    
    // Convert political score to ideology
    const ideology = getIdeologyFromPolitical(params.politics);
    
    // Wait for loading animation
    await new Promise(resolve => setTimeout(resolve, 3500));
    
    // Stop rotating messages
    clearInterval(messageInterval);
    
    // Generate feed
    generateExperienceFeed(params.gender, params.age, ideology, params.issue, params.totalPosts);
    
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
