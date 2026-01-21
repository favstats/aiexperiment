/**
 * Circl Admin Panel
 * Configuration editor for the Circl feed system
 * Supports both API mode (Flask server) and Standalone mode (GitHub Pages)
 */

// ============================================
// STATE
// ============================================
let config = null;
let stimuliData = null;
let fillersData = null;
let imagesData = null;
let hasUnsavedChanges = false;
let isApiMode = false;

const API_BASE = '/api';

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Setup navigation
  setupNavigation();
  setupTabs();
  setupButtons();
  
  // Detect mode and load data
  await detectModeAndLoadData();
  
  // Setup change tracking
  setupChangeTracking();
}

// ============================================
// MODE DETECTION
// ============================================
async function detectModeAndLoadData() {
  const modeIndicator = document.getElementById('mode-indicator');
  const apiStatus = document.getElementById('api-status');
  
  try {
    // Try to connect to Flask API
    const response = await fetch(`${API_BASE}/status`, { 
      method: 'GET',
      signal: AbortSignal.timeout(2000) // 2 second timeout
    });
    
    if (response.ok) {
      isApiMode = true;
      modeIndicator.className = 'mode-indicator api';
      modeIndicator.innerHTML = '<i class="fas fa-server"></i> API Mode (Flask)';
      apiStatus.style.display = 'flex';
      await loadDataFromApi();
    } else {
      throw new Error('API not available');
    }
  } catch (error) {
    // Fall back to standalone mode
    isApiMode = false;
    modeIndicator.className = 'mode-indicator standalone';
    modeIndicator.innerHTML = '<i class="fas fa-file-code"></i> Standalone Mode';
    apiStatus.style.display = 'none';
    await loadDataFromFiles();
  }
}

// ============================================
// DATA LOADING - API MODE
// ============================================
async function loadDataFromApi() {
  const apiStatus = document.getElementById('api-status');
  
  try {
    apiStatus.innerHTML = '<span class="loading-spinner"></span><span>Loading...</span>';
    
    const [configRes, stimuliRes, fillersRes, imagesRes] = await Promise.all([
      fetch(`${API_BASE}/config`),
      fetch(`${API_BASE}/stimuli`),
      fetch(`${API_BASE}/fillers`),
      fetch(`${API_BASE}/images`)
    ]);
    
    if (!configRes.ok) throw new Error('Failed to load config');
    
    config = await configRes.json();
    stimuliData = stimuliRes.ok ? await stimuliRes.json() : { posts: [] };
    fillersData = fillersRes.ok ? await fillersRes.json() : { posts: [] };
    imagesData = imagesRes.ok ? await imagesRes.json() : { conditions: [] };
    
    populateAllUI();
    
    apiStatus.className = 'admin-status connected';
    apiStatus.innerHTML = '<i class="fas fa-check-circle"></i><span>Connected</span>';
    
  } catch (error) {
    console.error('Error loading from API:', error);
    apiStatus.className = 'admin-status error';
    apiStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i><span>Error</span>';
    showToast('Failed to load from API', 'error');
  }
}

// ============================================
// DATA LOADING - STANDALONE MODE (no Flask)
// ============================================
async function loadDataFromFiles() {
  try {
    // Load directly from JSON files
    const [configRes, stimuliRes, fillersRes] = await Promise.all([
      fetch('data/feed-config.json'),
      fetch('data/stimuli.json'),
      fetch('data/fillers.json')
    ]);
    
    if (!configRes.ok) {
      throw new Error('Could not load feed-config.json');
    }
    
    config = await configRes.json();
    stimuliData = stimuliRes.ok ? await stimuliRes.json() : { posts: [] };
    fillersData = fillersRes.ok ? await fillersRes.json() : { posts: [] };
    imagesData = { conditions: [], total_conditions: 0, total_images: 0 };
    
    // Calculate stats from stimuli data
    if (stimuliData.posts) {
      const conditions = new Set(stimuliData.posts.map(p => p.condition_id));
      imagesData.total_conditions = conditions.size;
      imagesData.total_images = stimuliData.posts.length;
    }
    
    populateAllUI();
    showToast('Loaded configuration (Standalone Mode)', 'success');
    
  } catch (error) {
    console.error('Error loading files:', error);
    showToast('Failed to load configuration files: ' + error.message, 'error');
  }
}

// ============================================
// POPULATE UI
// ============================================
function populateAllUI() {
  populateFeedSettings();
  populatePersonalization();
  populateLocale();
  populateStimuli();
  populateFillers();
  updateStats();
}

function populateFeedSettings() {
  const settings = config.feed_settings || {};
  
  document.getElementById('total-posts').value = settings.total_posts || 40;
  document.getElementById('stimuli-count').value = settings.stimuli_count || 4;
  document.getElementById('filler-ratio').value = settings.filler_ratio || 4;
  document.getElementById('first-n-fillers').value = settings.first_n_fillers || 2;
  document.getElementById('randomize-order').checked = settings.randomize_order !== false;
}

function populatePersonalization() {
  const pers = config.personalization || {};
  
  document.getElementById('personalization-enabled').checked = pers.enabled !== false;
  document.getElementById('tailored-count').value = pers.tailored_count || 1;
  document.getElementById('random-count').value = pers.random_count || 3;
  
  populateMatchingRules(pers.matching || []);
  populateTransforms(pers.transforms || {});
}

function populateMatchingRules(rules) {
  const tbody = document.getElementById('matching-rules-body');
  tbody.innerHTML = '';
  
  rules.forEach((rule, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="rule-url-param" value="${rule.url_param || ''}" data-index="${index}"></td>
      <td><input type="text" class="rule-post-path" value="${rule.post_path || ''}" data-index="${index}"></td>
      <td><input type="text" class="rule-transform" value="${rule.transform || ''}" data-index="${index}" placeholder="(optional)"></td>
      <td>
        <button class="list-item-btn delete" onclick="deleteMatchingRule(${index})">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function populateTransforms(transforms) {
  const container = document.getElementById('transforms-container');
  container.innerHTML = '';
  
  Object.entries(transforms).forEach(([name, transform]) => {
    const div = document.createElement('div');
    div.className = 'form-group';
    div.innerHTML = `
      <label class="form-label">${name}</label>
      <textarea class="form-input form-textarea transform-json" data-name="${name}" rows="4">${JSON.stringify(transform, null, 2)}</textarea>
    `;
    container.appendChild(div);
  });
  
  if (Object.keys(transforms).length === 0) {
    container.innerHTML = '<p style="color: var(--circl-text-secondary);">No transforms defined.</p>';
  }
}

function populateLocale() {
  const locale = config.locale || {};
  
  document.getElementById('locale-language').value = locale.language || 'nl';
  
  const messages = locale.loading_messages || [];
  document.getElementById('loading-messages').value = messages.join('\n');
  
  populateNames('female', locale.first_names?.female || {});
  populateNames('male', locale.first_names?.male || {});
  
  document.getElementById('last-names-input').value = (locale.last_names || []).join(', ');
}

function populateNames(gender, names) {
  const container = document.getElementById(`${gender}-names-container`);
  container.innerHTML = '';
  
  Object.entries(names).forEach(([ageGroup, nameList]) => {
    const div = document.createElement('div');
    div.className = 'form-group';
    div.innerHTML = `
      <label class="form-label">${ageGroup}</label>
      <input type="text" class="form-input names-input" 
             data-gender="${gender}" data-age-group="${ageGroup}"
             value="${nameList.join(', ')}">
    `;
    container.appendChild(div);
  });
}

function populateStimuli() {
  const browser = document.getElementById('stimuli-browser');
  const countEl = document.getElementById('stimuli-count');
  const posts = stimuliData.posts || [];
  
  if (posts.length === 0) {
    browser.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-images"></i>
        <p>No stimuli found</p>
      </div>
    `;
    countEl.textContent = '';
    return;
  }
  
  // Group by condition
  const conditions = {};
  posts.forEach((post, idx) => {
    const condId = post.condition_id || 'unknown';
    if (!conditions[condId]) {
      conditions[condId] = { posts: [], indices: [] };
    }
    conditions[condId].posts.push(post);
    conditions[condId].indices.push(idx);
  });
  
  countEl.textContent = `${Object.keys(conditions).length} conditions, ${posts.length} posts`;
  
  browser.innerHTML = Object.entries(conditions).map(([condId, data]) => `
    <div class="list-item stimuli-item" data-condition="${condId.toLowerCase()}" style="flex-direction: column; align-items: flex-start; gap: 8px;">
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <strong>${condId}</strong>
          <span style="color: var(--circl-text-secondary); font-size: 12px;">
            ${data.posts.length} post(s)
          </span>
        </div>
        <button class="list-item-btn edit" onclick="editStimulus(${data.indices[0]})">
          <i class="fas fa-edit"></i> Edit
        </button>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        ${data.posts.slice(0, 3).map((p, i) => `
          <img src="${p.image?.src || ''}" 
               style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid var(--circl-gray-200); cursor: pointer;"
               onclick="editStimulus(${data.indices[i]})"
               onerror="this.style.display='none'"
               title="Click to edit">
        `).join('')}
      </div>
      <div style="font-size: 12px; color: var(--circl-text-secondary); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${data.posts[0]?.text?.substring(0, 100) || 'No text'}...
      </div>
    </div>
  `).join('');
}

function filterStimuli() {
  const query = document.getElementById('stimuli-search').value.toLowerCase();
  const items = document.querySelectorAll('#stimuli-browser .stimuli-item');
  let visible = 0;
  
  items.forEach(item => {
    const condition = item.dataset.condition || '';
    const text = item.textContent.toLowerCase();
    const matches = condition.includes(query) || text.includes(query);
    item.classList.toggle('hidden', !matches);
    if (matches) visible++;
  });
  
  const countEl = document.getElementById('stimuli-count');
  const total = items.length;
  countEl.textContent = query ? `Showing ${visible} of ${total} conditions` : `${total} conditions, ${stimuliData.posts?.length || 0} posts`;
}

function populateFillers() {
  const container = document.getElementById('fillers-list');
  const countEl = document.getElementById('fillers-count');
  const posts = fillersData.posts || [];
  
  if (posts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-newspaper"></i>
        <p>No fillers found</p>
        <button class="admin-header-btn primary" onclick="addFiller()">
          <i class="fas fa-plus"></i> Add First Filler
        </button>
      </div>
    `;
    countEl.textContent = '';
    return;
  }
  
  countEl.textContent = `${posts.length} filler posts`;
  
  container.innerHTML = posts.map((post, index) => {
    const icon = post.subtype === 'article' ? 'link' : (post.subtype === 'organization' ? 'building' : 'user');
    const typeBadge = post.subtype === 'article' ? '<span style="background: var(--circl-orange); color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">ARTICLE</span>' : '';
    const displayName = post.subtype === 'article' ? (post.article?.source || 'Article') : (post.author?.name || '(Random name)');
    const displayText = post.subtype === 'article' ? (post.article?.title || post.text || '') : (post.text || '');
    
    return `
    <div class="list-item filler-item" data-name="${(post.author?.name || '').toLowerCase()}" data-text="${(post.text || '').toLowerCase()}">
      <div class="list-item-info">
        <div style="width: 40px; height: 40px; background: var(--circl-gray-100); border-radius: ${post.subtype === 'article' ? '8px' : '50%'}; display: flex; align-items: center; justify-content: center;">
          <i class="fas fa-${icon}"></i>
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 500;">${displayName}${typeBadge}</div>
          <div style="font-size: 12px; color: var(--circl-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${displayText.substring(0, 80)}${displayText.length > 80 ? '...' : ''}
          </div>
        </div>
      </div>
      <div class="list-item-actions">
        <button class="list-item-btn edit" onclick="editFiller(${index})">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="list-item-btn delete" onclick="deleteFiller(${index})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `}).join('');
}

function filterFillers() {
  const query = document.getElementById('fillers-search').value.toLowerCase();
  const items = document.querySelectorAll('#fillers-list .filler-item');
  let visible = 0;
  
  items.forEach(item => {
    const name = item.dataset.name || '';
    const text = item.dataset.text || '';
    const matches = name.includes(query) || text.includes(query);
    item.classList.toggle('hidden', !matches);
    if (matches) visible++;
  });
  
  const countEl = document.getElementById('fillers-count');
  const total = items.length;
  countEl.textContent = query ? `Showing ${visible} of ${total} fillers` : `${total} filler posts`;
}

function updateStats() {
  document.getElementById('stat-stimuli').textContent = stimuliData.posts?.length || 0;
  document.getElementById('stat-fillers').textContent = fillersData.posts?.length || 0;
  document.getElementById('stat-conditions').textContent = imagesData.total_conditions || 0;
  document.getElementById('stat-images').textContent = imagesData.total_images || 0;
}

// ============================================
// NAVIGATION
// ============================================
function setupNavigation() {
  document.querySelectorAll('.sidebar-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      if (!section) return;
      
      document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      const targetSection = document.getElementById(`section-${section}`);
      if (targetSection) {
        targetSection.classList.add('active');
      }
    });
  });
}

function setupTabs() {
  document.querySelectorAll('.admin-tabs').forEach(tabContainer => {
    tabContainer.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        
        tabContainer.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const parent = tabContainer.parentElement;
        parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const targetContent = parent.querySelector(`#${tabId}`);
        if (targetContent) {
          targetContent.classList.add('active');
        }
      });
    });
  });
}

function setupButtons() {
  document.getElementById('btn-save').addEventListener('click', saveAll);
  document.getElementById('btn-export').addEventListener('click', exportAllConfigs);
  document.getElementById('btn-add-rule').addEventListener('click', addMatchingRule);
  document.getElementById('btn-add-filler').addEventListener('click', addFiller);
  document.getElementById('btn-refresh-preview').addEventListener('click', refreshPreview);
}

// ============================================
// COLLAPSIBLE CARDS
// ============================================
function toggleCard(header) {
  const card = header.closest('.admin-card');
  card.classList.toggle('collapsed');
}

// ============================================
// CHANGE TRACKING
// ============================================
function setupChangeTracking() {
  document.querySelectorAll('input, textarea, select').forEach(el => {
    el.addEventListener('change', markUnsaved);
    el.addEventListener('input', markUnsaved);
  });
}

function markUnsaved() {
  if (!hasUnsavedChanges) {
    hasUnsavedChanges = true;
    document.getElementById('btn-save').innerHTML = '<i class="fas fa-save"></i> Save All *';
  }
}

// ============================================
// COLLECT CONFIG FROM UI
// ============================================
function collectConfig() {
  config.feed_settings = {
    total_posts: parseInt(document.getElementById('total-posts').value) || 40,
    stimuli_count: parseInt(document.getElementById('stimuli-count').value) || 4,
    filler_ratio: parseInt(document.getElementById('filler-ratio').value) || 4,
    first_n_fillers: parseInt(document.getElementById('first-n-fillers').value) || 2,
    randomize_order: document.getElementById('randomize-order').checked,
    show_ai_labels: false
  };
  
  const matchingRules = [];
  document.querySelectorAll('#matching-rules-body tr').forEach(row => {
    const urlParam = row.querySelector('.rule-url-param')?.value;
    const postPath = row.querySelector('.rule-post-path')?.value;
    const transform = row.querySelector('.rule-transform')?.value;
    
    if (urlParam && postPath) {
      const rule = { url_param: urlParam, post_path: postPath };
      if (transform) rule.transform = transform;
      matchingRules.push(rule);
    }
  });
  
  const transforms = {};
  document.querySelectorAll('.transform-json').forEach(textarea => {
    const name = textarea.dataset.name;
    try {
      transforms[name] = JSON.parse(textarea.value);
    } catch (e) {
      console.error(`Invalid JSON for transform ${name}`);
    }
  });
  
  config.personalization = {
    enabled: document.getElementById('personalization-enabled').checked,
    mode: 'tailored_plus_random',
    tailored_count: parseInt(document.getElementById('tailored-count').value) || 1,
    random_count: parseInt(document.getElementById('random-count').value) || 3,
    matching: matchingRules,
    transforms: transforms
  };
  
  const firstNames = { female: {}, male: {} };
  document.querySelectorAll('.names-input').forEach(input => {
    const gender = input.dataset.gender;
    const ageGroup = input.dataset.ageGroup;
    const names = input.value.split(',').map(n => n.trim()).filter(Boolean);
    firstNames[gender][ageGroup] = names;
  });
  
  config.locale = {
    language: document.getElementById('locale-language').value || 'nl',
    first_names: firstNames,
    last_names: document.getElementById('last-names-input').value.split(',').map(n => n.trim()).filter(Boolean),
    loading_messages: document.getElementById('loading-messages').value.split('\n').map(m => m.trim()).filter(Boolean)
  };
  
  return config;
}

// ============================================
// SAVE / EXPORT
// ============================================
async function saveAll() {
  const saveBtn = document.getElementById('btn-save');
  
  if (isApiMode) {
    // API mode - save to server
    try {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="loading-spinner"></span> Saving...';
      
      const configData = collectConfig();
      
      const response = await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      });
      
      if (!response.ok) throw new Error('Failed to save config');
      
      hasUnsavedChanges = false;
      saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
      showToast('Configuration saved successfully', 'success');
      
      setTimeout(() => {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save All';
        saveBtn.disabled = false;
      }, 2000);
      
    } catch (error) {
      console.error('Error saving:', error);
      showToast('Failed to save configuration', 'error');
      saveBtn.innerHTML = '<i class="fas fa-save"></i> Save All';
      saveBtn.disabled = false;
    }
  } else {
    // Standalone mode - download config file
    downloadConfig();
    hasUnsavedChanges = false;
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save All';
  }
}

// ============================================
// DOWNLOAD FUNCTIONS (Standalone Mode)
// ============================================
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
}

function downloadConfig() {
  const configData = collectConfig();
  downloadJSON(configData, 'feed-config.json');
  showToast('Downloaded feed-config.json - save it to circl/data/', 'success');
}

function downloadStimuli() {
  downloadJSON(stimuliData, 'stimuli.json');
  showToast('Downloaded stimuli.json', 'success');
}

function downloadFillers() {
  downloadJSON(fillersData, 'fillers.json');
  showToast('Downloaded fillers.json - save it to circl/data/', 'success');
}

function exportAllConfigs() {
  const configData = collectConfig();
  
  // Create a zip-like experience by downloading all files
  downloadJSON(configData, 'feed-config.json');
  
  setTimeout(() => {
    if (stimuliData.posts?.length) {
      downloadJSON(stimuliData, 'stimuli.json');
    }
  }, 500);
  
  setTimeout(() => {
    if (fillersData.posts?.length) {
      downloadJSON(fillersData, 'fillers.json');
    }
  }, 1000);
  
  showToast('Downloading all config files...', 'success');
}

// ============================================
// MATCHING RULES
// ============================================
function addMatchingRule() {
  const tbody = document.getElementById('matching-rules-body');
  const index = tbody.querySelectorAll('tr').length;
  
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="rule-url-param" value="" data-index="${index}" placeholder="e.g., gender"></td>
    <td><input type="text" class="rule-post-path" value="" data-index="${index}" placeholder="e.g., author.gender"></td>
    <td><input type="text" class="rule-transform" value="" data-index="${index}" placeholder="(optional)"></td>
    <td>
      <button class="list-item-btn delete" onclick="deleteMatchingRule(${index})">
        <i class="fas fa-trash"></i>
      </button>
    </td>
  `;
  tbody.appendChild(tr);
  markUnsaved();
}

function deleteMatchingRule(index) {
  const tbody = document.getElementById('matching-rules-body');
  const rows = tbody.querySelectorAll('tr');
  if (rows[index]) {
    rows[index].remove();
    markUnsaved();
  }
}

// ============================================
// MODAL FUNCTIONS
// ============================================
let currentEditType = null;
let currentEditIndex = null;

function openModal() {
  document.getElementById('edit-modal').classList.add('show');
}

function closeModal() {
  document.getElementById('edit-modal').classList.remove('show');
  currentEditType = null;
  currentEditIndex = null;
}

function editFiller(index) {
  const post = fillersData.posts[index];
  if (!post) return;
  
  currentEditType = 'filler';
  currentEditIndex = index;
  
  document.getElementById('modal-title').textContent = 'Edit Filler Post';
  document.getElementById('edit-index').value = index;
  document.getElementById('edit-type').value = 'filler';
  document.getElementById('edit-id').value = post.id || `filler_${index}`;
  document.getElementById('edit-subtype').value = post.subtype || 'person';
  document.getElementById('edit-author-name').value = post.author?.name || '';
  document.getElementById('edit-gender').value = post.author?.gender || 'female';
  document.getElementById('edit-age-group').value = post.author?.age_group || '30-44';
  document.getElementById('edit-text').value = post.text || '';
  document.getElementById('edit-avatar-url').value = post.author?.avatar_url || '';
  document.getElementById('edit-image-url').value = post.image?.src || '';
  document.getElementById('edit-show-image').checked = post.image?.show !== false;
  
  // Article fields
  document.getElementById('edit-article-title').value = post.article?.title || '';
  document.getElementById('edit-article-source').value = post.article?.source || '';
  document.getElementById('edit-article-url').value = post.article?.url || '';
  document.getElementById('edit-article-thumbnail').value = post.article?.thumbnail || '';
  
  toggleArticleFields();
  openModal();
}

function toggleArticleFields() {
  const subtype = document.getElementById('edit-subtype').value;
  const articleFields = document.getElementById('article-fields');
  const avatarFields = document.getElementById('avatar-fields');
  
  if (subtype === 'article') {
    articleFields.style.display = 'block';
    avatarFields.style.display = 'none';
  } else {
    articleFields.style.display = 'none';
    avatarFields.style.display = 'block';
  }
}

function editStimulus(index) {
  const post = stimuliData.posts[index];
  if (!post) return;
  
  currentEditType = 'stimulus';
  currentEditIndex = index;
  
  document.getElementById('modal-title').textContent = 'Edit Stimulus Post';
  document.getElementById('edit-index').value = index;
  document.getElementById('edit-type').value = 'stimulus';
  document.getElementById('edit-id').value = post.id || `stim_${index}`;
  document.getElementById('edit-subtype').value = post.subtype || 'person';
  document.getElementById('edit-author-name').value = post.author?.name || '';
  document.getElementById('edit-gender').value = post.author?.gender || 'female';
  document.getElementById('edit-age-group').value = post.author?.age_group || '30-44';
  document.getElementById('edit-text').value = post.text || '';
  document.getElementById('edit-image-url').value = post.image?.src || '';
  document.getElementById('edit-show-image').checked = post.image?.show !== false;
  
  openModal();
}

function saveEdit() {
  const index = currentEditIndex;
  const type = currentEditType;
  
  if (index === null || !type) return;
  
  const data = type === 'filler' ? fillersData : stimuliData;
  const post = data.posts[index];
  
  if (!post) return;
  
  // Update post data
  post.id = document.getElementById('edit-id').value;
  post.subtype = document.getElementById('edit-subtype').value;
  post.text = document.getElementById('edit-text').value;
  
  // Author
  const authorName = document.getElementById('edit-author-name').value.trim();
  post.author = post.author || {};
  post.author.name = authorName || null; // null for random generation
  post.author.gender = document.getElementById('edit-gender').value;
  post.author.age_group = document.getElementById('edit-age-group').value;
  
  // Avatar URL
  const avatarUrl = document.getElementById('edit-avatar-url').value.trim();
  post.author.avatar_url = avatarUrl || null; // null for auto-generated
  
  // Image
  const imageUrl = document.getElementById('edit-image-url').value.trim();
  if (imageUrl) {
    post.image = post.image || {};
    post.image.src = imageUrl;
    post.image.show = document.getElementById('edit-show-image').checked;
  } else {
    post.image = post.image || {};
    post.image.show = document.getElementById('edit-show-image').checked;
  }
  
  // Article fields (for article subtype)
  if (post.subtype === 'article') {
    post.article = {
      title: document.getElementById('edit-article-title').value.trim(),
      source: document.getElementById('edit-article-source').value.trim(),
      url: document.getElementById('edit-article-url').value.trim(),
      thumbnail: document.getElementById('edit-article-thumbnail').value.trim() || null,
      track_clicks: true
    };
  } else {
    delete post.article; // Remove article data if not article type
  }
  
  closeModal();
  
  if (type === 'filler') {
    populateFillers();
  } else {
    populateStimuli();
  }
  
  markUnsaved();
  showToast('Post updated', 'success');
}

// ============================================
// FILLERS
// ============================================
function addFiller() {
  const posts = fillersData.posts || [];
  const newId = `filler_${String(posts.length + 1).padStart(3, '0')}`;
  
  const newIndex = posts.length;
  posts.push({
    id: newId,
    type: 'filler',
    subtype: 'person',
    text: 'New filler post...',
    author: {
      name: null,
      gender: 'female',
      age_group: '30-44'
    },
    engagement: null,
    time: null
  });
  
  fillersData.posts = posts;
  populateFillers();
  markUnsaved();
  
  // Open edit modal for new filler
  editFiller(newIndex);
}

function deleteFiller(index) {
  if (!confirm('Delete this filler post?')) return;
  
  fillersData.posts.splice(index, 1);
  populateFillers();
  markUnsaved();
}

// ============================================
// PREVIEW
// ============================================
function refreshPreview() {
  const iframe = document.getElementById('preview-iframe');
  // Use relative path that works in both modes
  const previewUrl = 'feed.html?source=json&debug=T&t=' + Date.now();
  iframe.src = previewUrl;
}

function openPreviewNewTab() {
  const previewUrl = 'feed.html?source=json&debug=T';
  window.open(previewUrl, '_blank');
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// ============================================
// UNSAVED CHANGES WARNING
// ============================================
window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Close modal on escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});

// Close modal on click outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('edit-modal');
  if (e.target === modal) {
    closeModal();
  }
});
