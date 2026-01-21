/**
 * Circl Admin - Researcher interface functionality
 * Depends on circl-core.js
 */

// ============================================
// ADMIN STATE
// ============================================
let choicesInstances = {};
let isMixedFeedMode = false;
let showAILabel = false;
let qcMode = false;
let qcImages = [];
let qcCurrentIndex = 0;
let qcCodedImages = JSON.parse(localStorage.getItem('qc_coded_images') || '{}');
let experienceShowLabels = false;
let currentCommentPostId = null;
let currentCommentPostData = null;

const QC_CONFIG = {
  googleScriptUrl: 'https://script.google.com/macros/s/AKfycbzEK51M3YerARm4JgOW4JvXTnOGJYXUwV7pzGWgEg5KTclQYLVZQclClZHj5TPXVkImhQ/exec'
};

const REACTIONS_CONFIG = {
  googleScriptUrl: ''
};

// Placeholder names for mixed feed (admin view)
const placeholderNames = [
  { name: 'Emma de Vries', handle: 'Friend', initials: 'EV' },
  { name: 'Thomas Bakker', handle: 'Friend', initials: 'TB' },
  { name: 'Sophie Jansen', handle: 'Friend', initials: 'SJ' },
  { name: 'Lars van Dijk', handle: 'Friend', initials: 'LD' },
  { name: 'Lisa Mulder', handle: 'Friend', initials: 'LM' },
  { name: 'Max Visser', handle: 'Suggested for you', initials: 'MV' },
  { name: 'Anna Smit', handle: 'Friend', initials: 'AS' },
  { name: 'Daan de Boer', handle: 'Suggested for you', initials: 'DB' },
  { name: 'Fleur Hendriks', handle: 'Friend', initials: 'FH' },
  { name: 'Bram Peters', handle: 'Friend', initials: 'BP' }
];

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', initAdmin);

async function initAdmin() {
  try {
    await loadConditionsData();
    initFilters();
    renderPosts();
    applyFilters();
    document.getElementById('loading').classList.add('hidden');
  } catch (error) {
    document.getElementById('loading').innerHTML = `
      <i class="fas fa-exclamation-triangle" style="animation:none; color: var(--circl-red);"></i>
      <p style="margin-top:12px; color: var(--circl-text-primary);">Could not load posts</p>
      <p style="font-size:13px; color: var(--circl-text-secondary); margin-top:8px">Run: python3 generate_conditions_json.py</p>
    `;
  }
}

// ============================================
// FILTERS
// ============================================
function initFilters() {
  const { filters } = conditionsData;
  
  populateSelect('filter-age', filters.age_groups);
  populateSelect('filter-gender', filters.genders, v => v.charAt(0).toUpperCase() + v.slice(1));
  populateSelect('filter-policy', filters.policy_issues, v => policyDisplayNames[v] || v.replace(/_/g, ' '));
  populateSelect('filter-ideology', filters.ideologies, v => v.charAt(0).toUpperCase() + v.slice(1));
  
  ['filter-age', 'filter-gender', 'filter-policy', 'filter-ideology'].forEach(id => {
    const el = document.getElementById(id);
    choicesInstances[id] = new Choices(el, {
      searchEnabled: false,
      itemSelectText: '',
      shouldSort: false
    });
    el.addEventListener('change', applyFilters);
  });
}

function populateSelect(id, values, labelFn = v => v) {
  const select = document.getElementById(id);
  values.forEach((value, i) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = labelFn(value);
    if (i === 0) opt.selected = true;
    select.appendChild(opt);
  });
}

function applyFilters() {
  if (isMixedFeedMode) return;
  
  const age = document.getElementById('filter-age').value;
  const gender = document.getElementById('filter-gender').value;
  const policy = document.getElementById('filter-policy').value;
  const ideology = document.getElementById('filter-ideology').value;
  
  let visibleCount = 0;
  document.querySelectorAll('#posts-container .post').forEach(post => {
    const matches = 
      post.dataset.age === age && 
      post.dataset.gender === gender && 
      post.dataset.policy === policy && 
      post.dataset.ideology === ideology;
    
    post.classList.toggle('hidden', !matches);
    if (matches) visibleCount++;
  });
  
  document.getElementById('visible-count').textContent = visibleCount;
  document.getElementById('no-results').classList.toggle('hidden', visibleCount > 0);
}

// ============================================
// MAIN FEED RENDERING
// ============================================
function renderPosts() {
  const container = document.getElementById('posts-container');
  container.innerHTML = '';
  
  conditionsData.conditions.forEach((cond, idx) => {
    container.appendChild(createPost(cond, idx));
  });
  
  initCarousels();
  attachReactionListeners();
}

function createPost(cond, idx) {
  const post = document.createElement('article');
  post.className = 'post ai-post';
  post.dataset.age = cond.age_group;
  post.dataset.gender = cond.gender;
  post.dataset.policy = cond.policy_issue;
  post.dataset.ideology = cond.ideology;
  
  const postId = `post-${cond.condition_id}-${idx}`;
  post.dataset.postId = postId;
  
  const name = `${cond.gender.charAt(0).toUpperCase() + cond.gender.slice(1)} ${cond.age_group}`;
  const handle = `${cond.ideology.charAt(0).toUpperCase() + cond.ideology.slice(1)} voter`;
  const time = `${Math.floor(Math.random() * 23) + 1}h`;
  const initials = cond.age_group.slice(0, 2) + cond.gender.charAt(0).toUpperCase();
  
  const policyTag = policyHashtags[cond.policy_issue] || cond.policy_issue.replace(/_/g, '');
  const hashtags = `#${cond.ideology} #${policyTag}`;
  
  // Use generated texts if available, otherwise fallback to templates
  let postTextContent;
  if (cond.texts && cond.texts.length > 0) {
    // Use first text (texts are paired with images by index)
    postTextContent = cond.texts[0];
  } else {
    postTextContent = postTemplates[Math.floor(Math.random() * postTemplates.length)]
      .replace('{hashtags}', `<span class="post-hashtag">${hashtags}</span>`);
  }
  
  const slidesHtml = cond.images.map(img => 
    `<div class="carousel-slide"><img src="../generated_images/${cond.image_dir}/${img}" loading="lazy"></div>`
  ).join('');
  
  const dotsHtml = cond.images.map((_, i) => 
    `<button class="carousel-dot${i === 0 ? ' active' : ''}" data-index="${i}"></button>`
  ).join('');
  
  const eng = {
    likes: Math.floor(Math.random() * 500) + 50,
    comments: Math.floor(Math.random() * 50) + 5,
    shares: Math.floor(Math.random() * 200) + 20
  };
  
  const badgeClass = showAILabel ? 'ai-badge' : 'ai-badge hidden';
  
  post.innerHTML = `
    <div class="post-header-section">
      <div class="post-header">
        <div class="post-avatar">${initials}</div>
        <div class="post-header-info">
          <div class="post-name-row">
            <span class="post-name">${name}</span>
            <i class="fas fa-circle-check post-verified"></i>
            <span class="${badgeClass}">AI Generated</span>
          </div>
          <div class="post-meta">
            <span>${handle}</span>
            <span>·</span>
            <span>${time}</span>
            <span>·</span>
            <i class="fas fa-earth-americas"></i>
          </div>
        </div>
        <div class="post-more"><i class="fas fa-ellipsis"></i></div>
      </div>
    </div>
    <div class="post-content">
      <div class="post-text">${postTextContent}</div>
    </div>
    <div class="post-media" data-carousel="${idx}">
      <div class="carousel-counter"><span class="current">1</span>/${cond.images.length}</div>
      <div class="carousel-track">${slidesHtml}</div>
      <button class="carousel-nav prev"><i class="fas fa-chevron-left"></i></button>
      <button class="carousel-nav next"><i class="fas fa-chevron-right"></i></button>
      <div class="carousel-dots">${dotsHtml}</div>
    </div>
    <div class="post-reactions-bar">
      <div class="post-reactions-count">
        <div class="reaction-icons">
          <div class="reaction-icon like"><i class="fas fa-thumbs-up"></i></div>
        </div>
        <span class="like-count">${eng.likes}</span>
      </div>
      <div class="post-engagement-count"><span class="comment-count">${eng.comments}</span> comments · <span class="share-count">${eng.shares}</span> shares</div>
    </div>
    <div class="post-actions">
      <div class="post-action like" data-action="like"><i class="far fa-thumbs-up"></i> <span>Like</span></div>
      <div class="post-action reply" data-action="comment"><i class="far fa-comment"></i> <span>Comment</span></div>
      <div class="post-action repost" data-action="share"><i class="fas fa-share"></i> <span>Share</span></div>
    </div>
  `;
  
  return post;
}

// ============================================
// MIXED FEED GENERATOR
// ============================================
function generateMixedFeed() {
  isMixedFeedMode = true;
  
  const age = document.getElementById('filter-age').value;
  const gender = document.getElementById('filter-gender').value;
  const policy = document.getElementById('filter-policy').value;
  const ideology = document.getElementById('filter-ideology').value;
  
  const aiCondition = conditionsData.conditions.find(c => 
    c.age_group === age && 
    c.gender === gender && 
    c.policy_issue === policy && 
    c.ideology === ideology
  );
  
  if (!aiCondition) {
    alert('No matching condition found. Please check your filter selection.');
    return;
  }
  
  const container = document.getElementById('posts-container');
  container.innerHTML = '';
  
  const indicator = document.createElement('div');
  indicator.className = 'feed-mode-indicator';
  indicator.innerHTML = `
    <span><i class="fas fa-shuffle"></i> Mixed Feed Mode</span>
    <button onclick="exitMixedFeed()"><i class="fas fa-times"></i> Exit</button>
  `;
  container.appendChild(indicator);
  
  const posts = [];
  const additionalPosts = parseInt(document.getElementById('additional-posts').value) || 4;
  
  for (let i = 0; i < additionalPosts; i++) {
    posts.push(createAdminPlaceholderPost(i));
  }
  
  posts.push(createAdminAIPost(aiCondition));
  shuffleArray(posts);
  
  posts.forEach(post => container.appendChild(post));
  initCarousels();
  attachReactionListeners();
  
  document.getElementById('no-results').classList.add('hidden');
  document.getElementById('visible-count').textContent = `${additionalPosts + 1} (mixed)`;
  updateToggleButtonState();
}

function createAdminPlaceholderPost(index) {
  const post = document.createElement('article');
  post.className = 'post placeholder-post';
  
  const postId = `placeholder-${index}-${Date.now()}`;
  post.dataset.postId = postId;
  
  const person = placeholderNames[Math.floor(Math.random() * placeholderNames.length)];
  const postText = placeholderPosts[Math.floor(Math.random() * placeholderPosts.length)];
  const time = `${Math.floor(Math.random() * 23) + 1}h`;
  
  const imageId = Math.floor(Math.random() * 1000);
  const hasImage = Math.random() > 0.4;
  
  const imageHtml = hasImage ? `
    <div class="post-media" style="border-radius: 0;">
      <img src="https://picsum.photos/seed/${imageId}/600/400" loading="lazy" style="width: 100%; display: block;">
    </div>
  ` : '';
  
  const eng = {
    likes: Math.floor(Math.random() * 300) + 20,
    comments: Math.floor(Math.random() * 30) + 2,
    shares: Math.floor(Math.random() * 100) + 5
  };
  
  post.innerHTML = `
    <div class="post-header-section">
      <div class="post-header">
        <div class="post-avatar">${person.initials}</div>
        <div class="post-header-info">
          <div class="post-name-row">
            <span class="post-name">${person.name}</span>
          </div>
          <div class="post-meta">
            <span>${person.handle}</span>
            <span>·</span>
            <span>${time}</span>
            <span>·</span>
            <i class="fas fa-earth-americas"></i>
          </div>
        </div>
        <div class="post-more"><i class="fas fa-ellipsis"></i></div>
      </div>
    </div>
    <div class="post-content">
      <div class="post-text">${postText}</div>
    </div>
    ${imageHtml}
    <div class="post-reactions-bar">
      <div class="post-reactions-count">
        <div class="reaction-icons">
          <div class="reaction-icon like"><i class="fas fa-thumbs-up"></i></div>
        </div>
        <span class="like-count">${eng.likes}</span>
      </div>
      <div class="post-engagement-count"><span class="comment-count">${eng.comments}</span> comments · <span class="share-count">${eng.shares}</span> shares</div>
    </div>
    <div class="post-actions">
      <div class="post-action like" data-action="like"><i class="far fa-thumbs-up"></i> <span>Like</span></div>
      <div class="post-action reply" data-action="comment"><i class="far fa-comment"></i> <span>Comment</span></div>
      <div class="post-action repost" data-action="share"><i class="fas fa-share"></i> <span>Share</span></div>
    </div>
  `;
  
  post._postData = {
    postId: postId,
    postType: 'placeholder',
    name: person.name,
    handle: person.handle,
    likes: eng.likes,
    comments: eng.comments,
    shares: eng.shares,
    text: postText
  };
  
  return post;
}

function createAdminAIPost(cond) {
  const post = document.createElement('article');
  post.className = 'post ai-post';
  post.dataset.age = cond.age_group;
  post.dataset.gender = cond.gender;
  post.dataset.policy = cond.policy_issue;
  post.dataset.ideology = cond.ideology;
  
  const postId = `ai-${cond.condition_id}-${Date.now()}`;
  post.dataset.postId = postId;
  
  const name = `${cond.gender.charAt(0).toUpperCase() + cond.gender.slice(1)} ${cond.age_group}`;
  const handle = `${cond.ideology.charAt(0).toUpperCase() + cond.ideology.slice(1)} voter`;
  const time = `${Math.floor(Math.random() * 23) + 1}h`;
  const initials = cond.age_group.slice(0, 2) + cond.gender.charAt(0).toUpperCase();
  
  const policyTag = policyHashtags[cond.policy_issue] || cond.policy_issue.replace(/_/g, '');
  const hashtags = `#${cond.ideology} #${policyTag}`;
  const postText = postTemplates[Math.floor(Math.random() * postTemplates.length)]
    .replace('{hashtags}', `<span class="post-hashtag">${hashtags}</span>`);
  
  const randomImage = cond.images[Math.floor(Math.random() * cond.images.length)];
  
  const eng = {
    likes: Math.floor(Math.random() * 800) + 100,
    comments: Math.floor(Math.random() * 80) + 20,
    shares: Math.floor(Math.random() * 400) + 50
  };
  
  const badgeClass = showAILabel ? 'ai-badge' : 'ai-badge hidden';
  
  post.innerHTML = `
    <div class="post-header-section">
      <div class="post-header">
        <div class="post-avatar">${initials}</div>
        <div class="post-header-info">
          <div class="post-name-row">
            <span class="post-name">${name}</span>
            <i class="fas fa-circle-check post-verified"></i>
            <span class="${badgeClass}">AI Generated</span>
          </div>
          <div class="post-meta">
            <span>${handle}</span>
            <span>·</span>
            <span>${time}</span>
            <span>·</span>
            <i class="fas fa-earth-americas"></i>
          </div>
        </div>
        <div class="post-more"><i class="fas fa-ellipsis"></i></div>
      </div>
    </div>
    <div class="post-content">
      <div class="post-text">${postText}</div>
    </div>
    <div class="post-media" style="border-radius: 0;">
      <img src="../generated_images/${cond.image_dir}/${randomImage}" loading="lazy" style="width: 100%; display: block;">
    </div>
    <div class="post-reactions-bar">
      <div class="post-reactions-count">
        <div class="reaction-icons">
          <div class="reaction-icon like"><i class="fas fa-thumbs-up"></i></div>
        </div>
        <span class="like-count">${eng.likes}</span>
      </div>
      <div class="post-engagement-count"><span class="comment-count">${eng.comments}</span> comments · <span class="share-count">${eng.shares}</span> shares</div>
    </div>
    <div class="post-actions">
      <div class="post-action like" data-action="like"><i class="far fa-thumbs-up"></i> <span>Like</span></div>
      <div class="post-action reply" data-action="comment"><i class="far fa-comment"></i> <span>Comment</span></div>
      <div class="post-action repost" data-action="share"><i class="fas fa-share"></i> <span>Share</span></div>
    </div>
  `;
  
  post._postData = {
    postId: postId,
    postType: 'ai',
    conditionId: cond.condition_id,
    ageGroup: cond.age_group,
    gender: cond.gender,
    likes: eng.likes,
    comments: eng.comments,
    shares: eng.shares,
    policyIssue: cond.policy_issue,
    ideology: cond.ideology,
    name: name,
    handle: handle,
    text: postText.replace(/<[^>]*>/g, '')
  };
  
  return post;
}

function toggleAILabel() {
  showAILabel = !showAILabel;
  updateToggleButtonState();
  
  document.querySelectorAll('.ai-badge').forEach(badge => {
    badge.classList.toggle('hidden', !showAILabel);
  });
}

function updateToggleButtonState() {
  const btn = document.getElementById('toggle-ai-label');
  if (btn) {
    btn.classList.toggle('active', showAILabel);
  }
}

function exitMixedFeed() {
  isMixedFeedMode = false;
  renderPosts();
  applyFilters();
}

// ============================================
// MODE SWITCHING
// ============================================
function switchMode(mode) {
  const mainFeed = document.querySelector('.main-feed');
  const qcContainer = document.getElementById('qc-container');
  const expContainer = document.getElementById('experience-container');
  const sidebarRight = document.querySelector('.sidebar-right');
  const sidebarLeft = document.querySelector('.sidebar-left');
  const navHome = document.getElementById('nav-home');
  const navQc = document.getElementById('nav-qc');
  const navExp = document.getElementById('nav-exp');
  const navHomeTop = document.getElementById('nav-home-top');
  const navQcTop = document.getElementById('nav-qc-top');
  const navExpTop = document.getElementById('nav-exp-top');
  const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
  
  // Reset all modes
  qcMode = false;
  mainFeed.classList.add('hidden');
  qcContainer.classList.remove('active');
  expContainer.classList.remove('active');
  sidebarRight.classList.add('hidden');
  sidebarLeft.classList.remove('hidden');
  navHome?.classList.remove('active');
  navQc?.classList.remove('active');
  navExp?.classList.remove('active');
  navHomeTop?.classList.remove('active');
  navQcTop?.classList.remove('active');
  navExpTop?.classList.remove('active');
  
  if (mode === 'qc') {
    qcMode = true;
    qcContainer.classList.add('active');
    navQc?.classList.add('active');
    navQcTop?.classList.add('active');
    mobileNavItems.forEach((item, i) => {
      item.classList.toggle('active', i === 3);
    });
    initQCMode();
  } else if (mode === 'experience') {
    expContainer.classList.add('active');
    sidebarLeft.classList.add('hidden');
    navExp?.classList.add('active');
    navExpTop?.classList.add('active');
    mobileNavItems.forEach((item, i) => {
      item.classList.toggle('active', i === 4);
    });
    initExperienceMode();
  } else {
    // Feed mode
    mainFeed.classList.remove('hidden');
    sidebarRight.classList.remove('hidden');
    navHome?.classList.add('active');
    navHomeTop?.classList.add('active');
    mobileNavItems.forEach((item, i) => {
      item.classList.toggle('active', i === 0);
    });
  }
}

// ============================================
// EXPERIENCE MODE (Admin Builder)
// ============================================
function initExperienceMode() {
  experienceData = { gender: null, age: null, political: 5, issue: null };
  debugMode = false;
  postViewTimes = {};
  
  document.querySelectorAll('.experience-option').forEach(opt => opt.classList.remove('selected'));
  document.getElementById('political-slider').value = 5;
  updatePoliticalDisplay(5);
  document.getElementById('experience-submit').disabled = true;
  document.getElementById('debug-mode-toggle').checked = false;
  
  document.getElementById('experience-survey').classList.remove('hidden');
  document.getElementById('experience-feed').classList.add('hidden');
  document.getElementById('experience-feed').classList.remove('debug-mode');
  
  stopViewTracking();
  setupExperienceListeners();
}

function setupExperienceListeners() {
  document.querySelectorAll('.experience-option').forEach(opt => {
    opt.addEventListener('click', function() {
      const field = this.dataset.field;
      const value = this.dataset.value;
      
      document.querySelectorAll(`.experience-option[data-field="${field}"]`).forEach(o => o.classList.remove('selected'));
      this.classList.add('selected');
      
      experienceData[field] = value;
      checkExperienceComplete();
    });
  });
  
  const slider = document.getElementById('political-slider');
  slider.addEventListener('input', function() {
    const val = parseInt(this.value);
    experienceData.political = val;
    updatePoliticalDisplay(val);
    checkExperienceComplete();
  });
  
  document.getElementById('experience-submit').addEventListener('click', startExperienceFeed);
  
  document.getElementById('debug-mode-toggle').addEventListener('change', function() {
    debugMode = this.checked;
  });
}

function updatePoliticalDisplay(val) {
  const display = document.getElementById('political-value');
  let label, className;
  
  if (val <= 4) {
    label = `Left (${val})`;
    className = 'left';
  } else if (val >= 6) {
    label = `Right (${val})`;
    className = 'right';
  } else {
    label = `Center (${val})`;
    className = 'neutral';
  }
  
  display.innerHTML = `<span class="ideology-badge ${className}">${label}</span>`;
}

function checkExperienceComplete() {
  const complete = experienceData.gender && experienceData.age && experienceData.issue;
  document.getElementById('experience-submit').disabled = !complete;
}

function startExperienceFeed() {
  document.getElementById('experience-survey').classList.add('hidden');
  document.getElementById('experience-feed').classList.remove('hidden');
  
  if (debugMode) {
    document.getElementById('experience-feed').classList.add('debug-mode');
  }
  
  const ideology = getIdeologyFromPolitical(experienceData.political);
  
  const ideologyLabel = ideology.charAt(0).toUpperCase() + ideology.slice(1);
  const issueLabel = policyDisplayNames[experienceData.issue] || experienceData.issue;
  document.getElementById('experience-profile-summary').textContent = 
    `${experienceData.age} · ${experienceData.gender} · ${ideologyLabel} · ${issueLabel}`;
  
  generateExperienceFeed(experienceData.gender, experienceData.age, ideology, experienceData.issue);
  
  startViewTracking();
  
  document.getElementById('experience-container').scrollTop = 0;
}

function resetExperience() {
  initExperienceMode();
}

function toggleExperienceLabels() {
  experienceShowLabels = !experienceShowLabels;
  const btn = document.getElementById('experience-toggle-labels');
  const container = document.getElementById('experience-posts');
  
  btn.classList.toggle('active', experienceShowLabels);
  btn.innerHTML = experienceShowLabels 
    ? '<i class="fas fa-eye-slash"></i><span>Hide AI</span>'
    : '<i class="fas fa-eye"></i><span>Show AI</span>';
  
  container.classList.toggle('show-ai-labels', experienceShowLabels);
}

// ============================================
// QUALITY CONTROL MODE
// ============================================
function initQCMode() {
  const savedCoderId = localStorage.getItem('qc_coder_id') || '';
  document.getElementById('qc-coder-id').value = savedCoderId;
  buildQCImageList();
  setupQCEventListeners();
  showQCImage(0);
}

function buildQCImageList() {
  qcImages = [];
  const showUncodedOnly = document.getElementById('qc-uncoded-only').checked;
  
  conditionsData.conditions.forEach(cond => {
    cond.images.forEach(img => {
      const imageId = `${cond.condition_id}/${img}`;
      const isCoded = qcCodedImages[imageId];
      
      if (!showUncodedOnly || !isCoded) {
        qcImages.push({
          condition: cond,
          image: img,
          imageId: imageId,
          isCoded: isCoded
        });
      }
    });
  });
  
  updateQCProgress();
}

function setupQCEventListeners() {
  document.getElementById('qc-coder-id').addEventListener('change', (e) => {
    localStorage.setItem('qc_coder_id', e.target.value);
  });
  
  document.getElementById('qc-uncoded-only').addEventListener('change', () => {
    buildQCImageList();
    showQCImage(0);
  });
  
  const starContainer = document.getElementById('qc-star-rating');
  const stars = document.querySelectorAll('.qc-star');
  
  stars.forEach(star => {
    star.addEventListener('click', (e) => {
      const value = parseInt(e.target.dataset.value);
      document.getElementById('image_quality').value = value;
      updateStars(value);
    });
    
    star.addEventListener('mouseenter', (e) => {
      const hoverValue = parseInt(e.target.dataset.value);
      highlightStars(hoverValue);
    });
  });
  
  starContainer.addEventListener('mouseleave', () => {
    const currentValue = parseInt(document.getElementById('image_quality').value) || 0;
    highlightStars(currentValue);
  });
  
  document.getElementById('emotional_intensity').addEventListener('input', (e) => {
    document.getElementById('intensity-value').textContent = e.target.value;
  });
  
  document.addEventListener('keydown', (e) => {
    if (!qcMode) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (e.key === 'ArrowLeft') qcNavigate(-1);
    if (e.key === 'ArrowRight') qcNavigate(1);
  });
}

function updateStars(value) {
  document.querySelectorAll('.qc-star').forEach(star => {
    const starValue = parseInt(star.dataset.value);
    star.classList.toggle('active', starValue <= value);
  });
}

function highlightStars(value) {
  document.querySelectorAll('.qc-star').forEach(star => {
    const starValue = parseInt(star.dataset.value);
    star.classList.toggle('hover', starValue <= value);
    const currentValue = parseInt(document.getElementById('image_quality').value) || 0;
    star.classList.toggle('active', starValue <= currentValue);
  });
}

function getOutgroup(ideology) {
  const outgroupMap = {
    'left': 'Right-Wingers',
    'right': 'Left-Wingers',
    'neutral': 'Extremists'
  };
  return outgroupMap[ideology] || 'Unknown';
}

function showQCImage(index) {
  if (qcImages.length === 0) {
    document.getElementById('qc-image').src = '';
    document.getElementById('qc-counter').textContent = 'No images';
    document.getElementById('qc-condition-info').innerHTML = '<span class="qc-condition-tag">No images to display</span>';
    document.getElementById('qc-text-content').textContent = 'No text available';
    document.getElementById('qc-text-content').classList.add('no-text');
    return;
  }
  
  qcCurrentIndex = Math.max(0, Math.min(index, qcImages.length - 1));
  const item = qcImages[qcCurrentIndex];
  
  document.getElementById('qc-image').src = `../generated_images/${item.condition.image_dir}/${item.image}`;
  document.getElementById('qc-counter').textContent = `${qcCurrentIndex + 1} / ${qcImages.length}`;
  
  // Get paired text based on image number (extract from filename like "condition_01.jpg")
  const textContent = document.getElementById('qc-text-content');
  if (item.condition.texts && item.condition.texts.length > 0) {
    // Extract image number from filename (e.g., "condition_01.jpg" -> 0)
    const imageNumMatch = item.image.match(/_(\d{2})\.(jpg|png)$/i);
    const imageIndex = imageNumMatch ? parseInt(imageNumMatch[1], 10) - 1 : 0;
    const textIndex = Math.min(imageIndex, item.condition.texts.length - 1);
    textContent.textContent = item.condition.texts[textIndex] || 'No text available';
    textContent.classList.remove('no-text');
  } else {
    textContent.textContent = 'No generated text available for this condition';
    textContent.classList.add('no-text');
  }
  
  const outgroup = getOutgroup(item.condition.ideology);
  
  const condInfo = document.getElementById('qc-condition-info');
  const policyName = policyDisplayNames[item.condition.policy_issue] || item.condition.policy_issue.replace(/_/g, ' ');
  condInfo.innerHTML = `
    <span class="qc-condition-tag highlight">${item.condition.age_group}</span>
    <span class="qc-condition-tag highlight">${item.condition.gender}</span>
    <span class="qc-condition-tag">${policyName}</span>
    <span class="qc-condition-tag ideology-tag ${item.condition.ideology}">${item.condition.ideology}</span>
    <span class="qc-condition-tag outgroup-tag">Outgroup: ${outgroup}</span>
    ${item.isCoded ? '<span class="qc-coded-badge"><i class="fas fa-check"></i> Coded</span>' : ''}
  `;
  
  document.getElementById('qc-prev').disabled = qcCurrentIndex === 0;
  document.getElementById('qc-next').disabled = qcCurrentIndex === qcImages.length - 1;
  
  resetQCForm();
  updateQCProgress();
}

function qcNavigate(direction) {
  showQCImage(qcCurrentIndex + direction);
}

function updateQCProgress() {
  const totalImages = conditionsData ? 
    conditionsData.conditions.reduce((sum, c) => sum + c.images.length, 0) : 0;
  const codedCount = Object.keys(qcCodedImages).length;
  
  document.getElementById('qc-progress').textContent = 
    `${codedCount} of ${totalImages} coded`;
}

function resetQCForm() {
  const form = document.getElementById('qc-form');
  form.reset();
  document.getElementById('image_quality').value = '0';
  updateStars(0);
  document.getElementById('intensity-value').textContent = '5';
  document.getElementById('qc-status').textContent = '';
  document.getElementById('qc-status').className = 'qc-status';
}

async function submitQCForm(event) {
  event.preventDefault();
  
  const coderId = document.getElementById('qc-coder-id').value.trim();
  if (!coderId) {
    showQCStatus('Please enter your Coder ID', 'error');
    return;
  }
  
  const imageQuality = parseInt(document.getElementById('image_quality').value);
  if (imageQuality === 0) {
    showQCStatus('Please rate the image quality (stars)', 'error');
    return;
  }
  
  const form = document.getElementById('qc-form');
  const formData = new FormData(form);
  const item = qcImages[qcCurrentIndex];
  
  const data = {
    timestamp: new Date().toISOString(),
    coder_id: coderId,
    condition_id: item.condition.condition_id,
    image_filename: item.image,
    no_weird_text: formData.get('no_weird_text'),
    outgroup_present: formData.get('outgroup_present'),
    looks_authentic: formData.get('looks_authentic'),
    age_accurate: formData.get('age_accurate'),
    gender_accurate: formData.get('gender_accurate'),
    suitable: formData.get('suitable'),
    image_quality: imageQuality,
    emotional_intensity: parseInt(formData.get('emotional_intensity')),
    emotional_valence: formData.get('emotional_valence'),
    notes: formData.get('notes') || ''
  };
  
  const submitBtn = document.getElementById('qc-submit-btn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
  
  try {
    if (QC_CONFIG.googleScriptUrl) {
      await fetch(QC_CONFIG.googleScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }
    
    qcCodedImages[item.imageId] = {
      coderId: coderId,
      timestamp: data.timestamp
    };
    localStorage.setItem('qc_coded_images', JSON.stringify(qcCodedImages));
    
    item.isCoded = true;
    
    showQCStatus('Saved successfully!', 'success');
    
    setTimeout(() => {
      if (qcCurrentIndex < qcImages.length - 1) {
        qcNavigate(1);
      } else {
        showQCStatus('All images in current set have been coded!', 'success');
      }
    }, 500);
    
  } catch (error) {
    console.error('Error submitting:', error);
    showQCStatus('Error saving. Data saved locally.', 'error');
    
    qcCodedImages[item.imageId] = {
      coderId: coderId,
      timestamp: data.timestamp,
      data: data
    };
    localStorage.setItem('qc_coded_images', JSON.stringify(qcCodedImages));
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-check"></i> Submit & Next';
    updateQCProgress();
  }
}

function showQCStatus(message, type) {
  const status = document.getElementById('qc-status');
  status.textContent = message;
  status.className = `qc-status ${type}`;
}

function exportQCData() {
  const data = JSON.stringify(qcCodedImages, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `qc_data_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

// ============================================
// REACTION TRACKING
// ============================================
function attachReactionListeners() {
  document.querySelectorAll('.post-action[data-action]').forEach(actionBtn => {
    const action = actionBtn.dataset.action;
    const post = actionBtn.closest('.post');
    
    if (!post || !post._postData) return;
    
    const newBtn = actionBtn.cloneNode(true);
    actionBtn.parentNode.replaceChild(newBtn, actionBtn);
    
    newBtn.addEventListener('click', () => {
      handleReaction(post, action, newBtn);
    });
  });
}

function handleReaction(post, reactionType, btn) {
  switch(reactionType) {
    case 'like':
      btn.classList.toggle('liked');
      if (btn.classList.contains('liked')) {
        btn.innerHTML = '<i class="fas fa-thumbs-up"></i> <span>Liked</span>';
        updateLikeCount(post, 1);
      } else {
        btn.innerHTML = '<i class="far fa-thumbs-up"></i> <span>Like</span>';
        updateLikeCount(post, -1);
      }
      break;
    case 'comment':
      showCommentModal(post.dataset.postId, post._postData);
      break;
    case 'share':
      updateShareCount(post, 1);
      btn.innerHTML = '<i class="fas fa-check"></i> <span>Shared</span>';
      setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-share"></i> <span>Share</span>';
      }, 2000);
      break;
  }
  
  trackReaction(post.dataset.postId, reactionType, null);
}

function updateLikeCount(post, delta) {
  const likeCountEl = post.querySelector('.like-count');
  if (likeCountEl) {
    const current = parseInt(likeCountEl.textContent) || 0;
    likeCountEl.textContent = current + delta;
  }
}

function updateShareCount(post, delta) {
  const shareCountEl = post.querySelector('.share-count');
  if (shareCountEl) {
    const current = parseInt(shareCountEl.textContent) || 0;
    shareCountEl.textContent = current + delta;
  }
}

function showCommentModal(postId, postData) {
  currentCommentPostId = postId;
  currentCommentPostData = postData;
  
  const modal = document.getElementById('comment-modal');
  if (modal) {
    modal.classList.add('active');
    const input = modal.querySelector('.comment-input');
    if (input) input.focus();
  }
}

function hideCommentModal() {
  const modal = document.getElementById('comment-modal');
  if (modal) {
    modal.classList.remove('active');
  }
  currentCommentPostId = null;
  currentCommentPostData = null;
}

function submitComment() {
  const modal = document.getElementById('comment-modal');
  const input = modal?.querySelector('.comment-input');
  const commentText = input?.value?.trim();
  
  if (!commentText) return;
  
  if (currentCommentPostId) {
    const post = document.querySelector(`[data-post-id="${currentCommentPostId}"]`);
    if (post) {
      const commentCountEl = post.querySelector('.comment-count');
      if (commentCountEl) {
        const current = parseInt(commentCountEl.textContent) || 0;
        commentCountEl.textContent = current + 1;
      }
    }
    
    trackReaction(currentCommentPostId, 'comment', commentText);
  }
  
  if (input) input.value = '';
  hideCommentModal();
}

function trackReaction(postId, reactionType, commentText) {
  // Tracking logic - can be extended
  console.log('Reaction:', { postId, reactionType, commentText });
}
