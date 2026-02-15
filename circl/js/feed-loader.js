// ============================================
// CIRCL FEED LOADER
// Loads and processes feed configuration from JSON files
// All data comes from config - no embedded defaults
// ============================================

const FeedLoader = (function() {
  'use strict';

  // ============================================
  // STATE - loaded from config
  // ============================================
  let loadedConfig = null;
  let localeData = null;
  let avatarSettings = null;

  // Track used values to avoid duplicates
  const usedNames = new Set();
  const usedAvatarIds = new Set();

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomChoice(array) {
    if (!array || array.length === 0) return null;
    return array[Math.floor(Math.random() * array.length)];
  }

  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get a nested value from an object using dot notation
   * e.g., getNestedValue(obj, 'author.gender') returns obj.author.gender
   */
  function getNestedValue(obj, path) {
    if (!path) return undefined;
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Apply a transform to a value based on config
   */
  function applyTransform(value, transformName, transforms) {
    if (!transformName || !transforms || !transforms[transformName]) {
      return value;
    }

    const transform = transforms[transformName];
    
    if (transform.type === 'range') {
      const numValue = parseInt(value, 10);
      if (isNaN(numValue)) return null;
      
      for (const range of transform.ranges || []) {
        if (numValue >= range.min && numValue <= range.max) {
          return range.value;
        }
      }
      return null;
    }
    
    // Direct mapping
    if (transform.map && transform.map[value] !== undefined) {
      return transform.map[value];
    }
    
    return value;
  }

  // ============================================
  // NAME AND AVATAR GENERATION (from config)
  // ============================================
  function generateName(gender, ageGroup) {
    if (!localeData || !localeData.first_names || !localeData.last_names) {
      console.error('FeedLoader: No locale data loaded. Cannot generate name.');
      return 'Unknown User';
    }

    const firstNames = localeData.first_names[gender]?.[ageGroup] || 
                       localeData.first_names[gender]?.['30-44'] || 
                       Object.values(localeData.first_names[gender] || {})[0] ||
                       ['User'];
    const lastNames = localeData.last_names || [''];

    let name;
    let attempts = 0;
    do {
      const first = randomChoice(firstNames);
      const last = randomChoice(lastNames);
      name = last ? `${first} ${last}` : first;
      attempts++;
    } while (usedNames.has(name) && attempts < 50);
    usedNames.add(name);
    return name;
  }

  function getAvatarId(ageGroup) {
    if (!avatarSettings || !avatarSettings.age_ranges) {
      return randomInt(1, 99);
    }
    
    const range = avatarSettings.age_ranges[ageGroup] || { min: 1, max: 99 };
    let id;
    let attempts = 0;
    do {
      id = randomInt(range.min, range.max);
      attempts++;
    } while (usedAvatarIds.has(id) && attempts < 50);
    usedAvatarIds.add(id);
    return id;
  }

  function getAvatarUrl(gender, ageGroup) {
    const id = getAvatarId(ageGroup);
    const genderPath = gender === 'female' ? 'women' : 'men';
    const baseUrl = avatarSettings?.api_url || 'https://randomuser.me/api/portraits';
    return `${baseUrl}/${genderPath}/${id}.jpg`;
  }

  // ============================================
  // POST PROCESSING
  // ============================================
  function processPost(post, config) {
    const defaults = config.defaults || {};
    const processed = { ...post };

    // Generate time if null
    if (processed.time === null || processed.time === undefined) {
      const timeRange = defaults.time_range || { min: 1, max: 23, unit: 'h' };
      processed.time = `${randomInt(timeRange.min, timeRange.max)}${timeRange.unit}`;
    }

    // Generate engagement if null
    if (processed.engagement === null || processed.engagement === undefined) {
      const likesRange = defaults.likes_range || { min: 50, max: 500 };
      const commentsRange = defaults.comments_range || { min: 5, max: 80 };
      const sharesRange = defaults.shares_range || { min: 10, max: 200 };
      processed.engagement = {
        likes: randomInt(likesRange.min, likesRange.max),
        comments: randomInt(commentsRange.min, commentsRange.max),
        shares: randomInt(sharesRange.min, sharesRange.max)
      };
    }

    // Process author
    if (processed.author) {
      const author = { ...processed.author };
      
      // For person posts (not organization/org-style)
      const isOrgStyle = processed.subtype === 'organization' || (author.fallback_icon && !author.gender);
      if (!isOrgStyle) {
        // Generate name if null
        if (author.name === null || author.name === undefined) {
          const gender = author.gender || 'male';
          const ageGroup = author.age_group || '30-44';
          author.name = generateName(gender, ageGroup);
        }

        // Generate avatar URL if null
        if (author.avatar_url === null || author.avatar_url === undefined) {
          const gender = author.gender || 'male';
          const ageGroup = author.age_group || '30-44';
          author.avatar_url = getAvatarUrl(gender, ageGroup);
        }

        // Generate initials
        author.initials = author.name.split(' ').map(n => n[0]).join('').toUpperCase();
      }

      processed.author = author;
    }

    // Generate fallback color for avatar
    const colors = config.avatar_settings?.fallback_colors || 
      ['#1877F2', '#42B72A', '#F5A623', '#FA383E', '#00A3A3', '#7B68EE', '#FF6B6B'];
    processed._fallbackColor = randomChoice(colors);

    return processed;
  }

  // ============================================
  // PERSONALIZATION (config-driven matching)
  // ============================================
  
  /**
   * Select personalized stimuli based on config-driven matching rules
   * @param {Array} stimuli - All available stimuli
   * @param {Object} params - URL params (keys matching personalization.matching[].url_param)
   * @param {Object} personalizationConfig - Config from feed-config.json
   * @returns {Array} - Selected stimuli with _isTailored markers
   */
  function selectPersonalizedStimuli(stimuli, params, personalizationConfig = {}) {
    const tailoredCount = personalizationConfig.tailored_count ?? 1;
    const randomCount = personalizationConfig.random_count ?? 3;
    const totalCount = tailoredCount + randomCount;
    const matchingRules = personalizationConfig.matching || [];
    const transforms = personalizationConfig.transforms || {};

    // Check if we have required params for matching
    const hasParams = matchingRules.some(rule => params[rule.url_param] !== undefined);
    
    if (!hasParams || matchingRules.length === 0) {
      // No personalization params - return random selection (all marked as random)
      return shuffleArray(stimuli).slice(0, totalCount).map(s => ({ ...s, _isTailored: false }));
    }

    // Build transformed params for matching
    const transformedParams = {};
    for (const rule of matchingRules) {
      let value = params[rule.url_param];
      if (value !== undefined && rule.transform) {
        value = applyTransform(value, rule.transform, transforms);
      }
      transformedParams[rule.url_param] = value;
    }

    // Find all stimuli that match the tailored criteria
    const tailoredMatches = stimuli.filter(stimulus => {
      return matchingRules.every(rule => {
        const paramValue = transformedParams[rule.url_param];
        if (paramValue === undefined || paramValue === null) return true; // Skip if param not provided
        
        const postValue = getNestedValue(stimulus, rule.post_path);
        return postValue === paramValue;
      });
    });

    // Shuffle and take tailored_count from matches
    const selectedTailored = shuffleArray(tailoredMatches)
      .slice(0, tailoredCount)
      .map(s => ({ ...s, _isTailored: true }));

    // Get random stimuli from different conditions (not any tailored condition)
    const tailoredConditionIds = new Set(selectedTailored.map(s => s.condition_id));
    const others = stimuli.filter(s => !tailoredConditionIds.has(s.condition_id));
    const selectedRandom = shuffleArray(others)
      .slice(0, randomCount)
      .map(s => ({ ...s, _isTailored: false }));

    // Combine: tailored first, then random
    return [...selectedTailored, ...selectedRandom];
  }

  /**
   * Convert political score to ideology using config transforms
   * Falls back to hardcoded logic if no config available
   */
  function getIdeologyFromPolitical(politicalScore, transforms = null) {
    if (transforms && transforms.political_to_ideology) {
      return applyTransform(politicalScore, 'political_to_ideology', transforms);
    }
    
    // Fallback if no config (should not happen with proper config)
    const score = parseInt(politicalScore, 10);
    if (isNaN(score)) return null;
    if (score <= 4) return 'left';
    if (score >= 6) return 'right';
    return 'neutral';
  }

  // ============================================
  // FEED MIXING
  // ============================================
  function mixFeeds(stimuli, fillers, settings, personalization = null, personalizationConfig = null) {
    const result = [];
    const fillerRatio = settings.filler_ratio || 4;
    const firstNFillers = settings.first_n_fillers || 2;
    const totalPosts = settings.total_posts || 40;

    // Determine stimuli to use
    let orderedStimuli;
    if (personalization && personalizationConfig?.enabled !== false) {
      // Use personalized selection (tailored + random based on config)
      orderedStimuli = selectPersonalizedStimuli(stimuli, personalization, personalizationConfig);
    } else {
      // Use config-based selection (all random, no tailoring)
      const stimuliCount = Math.min(settings.stimuli_count || stimuli.length, stimuli.length);
      orderedStimuli = settings.randomize_order ? shuffleArray(stimuli) : [...stimuli];
      orderedStimuli = orderedStimuli.slice(0, stimuliCount).map(s => ({ ...s, _isTailored: false }));
    }

    // Shuffle fillers
    let orderedFillers = settings.randomize_order !== false ? shuffleArray(fillers) : [...fillers];

    let stimulusIndex = 0;
    let fillerIndex = 0;

    // Add first N fillers
    for (let i = 0; i < firstNFillers && fillerIndex < orderedFillers.length; i++) {
      result.push(orderedFillers[fillerIndex++]);
    }

    // Interleave stimuli with fillers
    while (stimulusIndex < orderedStimuli.length && result.length < totalPosts) {
      // Add one stimulus
      result.push(orderedStimuli[stimulusIndex++]);

      // Add filler_ratio number of fillers after each stimulus
      for (let i = 0; i < fillerRatio && fillerIndex < orderedFillers.length && result.length < totalPosts; i++) {
        result.push(orderedFillers[fillerIndex++]);
      }
    }

    // Fill remaining slots with fillers if needed
    while (result.length < totalPosts && fillerIndex < orderedFillers.length) {
      result.push(orderedFillers[fillerIndex++]);
    }

    return result;
  }

  // ============================================
  // MAIN LOADER FUNCTIONS
  // ============================================
  async function loadJSON(path) {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error loading JSON from ${path}:`, error);
      throw error;
    }
  }

  /**
   * Validate that required config sections exist
   */
  function validateConfig(config) {
    const errors = [];
    
    if (!config.locale) {
      errors.push('Missing "locale" section in config');
    } else {
      if (!config.locale.first_names) errors.push('Missing "locale.first_names" in config');
      if (!config.locale.last_names) errors.push('Missing "locale.last_names" in config');
    }
    
    if (!config.feed_settings) {
      errors.push('Missing "feed_settings" section in config');
    }
    
    if (errors.length > 0) {
      console.error('FeedLoader: Config validation errors:', errors);
      throw new Error(`Invalid feed configuration: ${errors.join('; ')}`);
    }
  }

  /**
   * Load and generate a feed from JSON configuration
   * @param {string} configPath - Path to feed-config.json
   * @param {Object} options - Optional settings
   * @param {Object} options.personalization - Personalization params from URL
   * @param {number} options.totalPosts - Override total posts count
   * @returns {Object} - { config, posts, stimuliCount, fillersCount, personalization }
   */
  async function loadFeed(configPath = 'data/feed-config.json', options = {}) {
    // Reset tracking sets
    usedNames.clear();
    usedAvatarIds.clear();

    // Load config
    const config = await loadJSON(configPath);
    
    // Validate config
    validateConfig(config);
    
    // Store config for use by other functions
    loadedConfig = config;
    localeData = config.locale;
    avatarSettings = config.avatar_settings || {};
    
    // Determine base path
    const basePath = configPath.substring(0, configPath.lastIndexOf('/') + 1);

    // Load stimuli and fillers
    const stimuliPath = basePath + (config.stimuli_source || 'stimuli.json');
    const fillersPath = basePath + (config.fillers_source || 'fillers.json');

    const [stimuliData, fillersData] = await Promise.all([
      loadJSON(stimuliPath),
      loadJSON(fillersPath)
    ]);

    // Process each post
    const processedStimuli = (stimuliData.posts || []).map(p => processPost(p, config));
    const processedFillers = (fillersData.posts || []).map(p => processPost(p, config));

    // Prepare personalization if provided
    let personalization = null;
    const personalizationConfig = config.personalization || {};
    
    if (options.personalization) {
      personalization = { ...options.personalization };
      
      // Apply transforms to personalization params
      const transforms = personalizationConfig.transforms || {};
      
      // Convert politics (1-10) to ideology if transform is defined
      if (personalization.politics !== undefined && !personalization.ideology) {
        personalization.ideology = getIdeologyFromPolitical(personalization.politics, transforms);
      }
    }

    // Override total_posts if specified
    const feedSettings = { ...config.feed_settings };
    if (options.totalPosts) {
      feedSettings.total_posts = options.totalPosts;
    }

    // Mix feeds according to settings (with personalization if provided)
    const mixedFeed = mixFeeds(processedStimuli, processedFillers, feedSettings, personalization, personalizationConfig);

    // Calculate selected stimuli count
    const tailoredCount = personalizationConfig.tailored_count ?? 1;
    const randomCount = personalizationConfig.random_count ?? 3;
    const selectedStimuliCount = personalization && personalizationConfig.enabled !== false 
      ? tailoredCount + randomCount 
      : (feedSettings.stimuli_count || processedStimuli.length);

    return {
      config,
      posts: mixedFeed,
      stimuliCount: processedStimuli.length,
      fillersCount: processedFillers.length,
      personalization: personalization,
      personalizationConfig: personalizationConfig,
      selectedStimuliCount: selectedStimuliCount
    };
  }

  // ============================================
  // LOAD CONDITIONS (for main page and QC)
  // Transforms stimuli.json into the conditions format
  // ============================================
  async function loadConditions(stimuliPath = 'data/stimuli.json') {
    const stimuliData = await loadJSON(stimuliPath);
    const posts = stimuliData.posts || [];

    // Group posts by condition_id
    const conditionMap = new Map();
    
    posts.forEach(post => {
      const condId = post.condition_id;
      if (!conditionMap.has(condId)) {
        conditionMap.set(condId, {
          condition_id: condId,
          image_dir: condId, // Same as condition_id, used for image path construction
          age_group: post.author?.age_group || '',
          gender: post.author?.gender || '',
          ideology: post.metadata?.ideology || '',
          policy_issue: post.metadata?.policy_issue || '',
          images: [],
          texts: [],
          _posts: [] // Keep full post data for reference
        });
      }
      
      const condition = conditionMap.get(condId);
      
      // Extract image filename from path
      const imagePath = post.image?.src || '';
      const imageFilename = imagePath.split('/').pop();
      if (imageFilename && !condition.images.includes(imageFilename)) {
        condition.images.push(imageFilename);
      }
      
      // Add text
      if (post.text && !condition.texts.includes(post.text)) {
        condition.texts.push(post.text);
      }
      
      // Store full post reference
      condition._posts.push(post);
    });

    // Convert map to array
    const conditions = Array.from(conditionMap.values());

    // Build filters from unique values
    const ageGroups = [...new Set(conditions.map(c => c.age_group).filter(Boolean))];
    const genders = [...new Set(conditions.map(c => c.gender).filter(Boolean))];
    const ideologies = [...new Set(conditions.map(c => c.ideology).filter(Boolean))];
    const policyIssues = [...new Set(conditions.map(c => c.policy_issue).filter(Boolean))];

    return {
      conditions,
      filters: {
        age_groups: ageGroups.sort(),
        genders: genders.sort(),
        ideologies: ideologies.sort(),
        policy_issues: policyIssues.sort()
      },
      source: stimuliPath,
      generatedAt: stimuliData.generated_at || null
    };
  }

  // Get full image path from condition
  function getImagePath(condition, imageFilename) {
    return `../generated_images/${condition.condition_id}/${imageFilename}`;
  }

  /**
   * Get the loaded config (for access by other modules)
   */
  function getConfig() {
    return loadedConfig;
  }

  /**
   * Get locale data (for access by other modules)
   */
  function getLocale() {
    return localeData;
  }

  // ============================================
  // PUBLIC API
  // ============================================
  return {
    loadFeed,
    loadConditions,
    loadJSON,
    processPost,
    mixFeeds,
    getImagePath,
    selectPersonalizedStimuli,
    getIdeologyFromPolitical,
    getConfig,
    getLocale,
    // Expose utilities for testing/admin
    generateName,
    getAvatarUrl,
    shuffleArray,
    getNestedValue,
    applyTransform,
    validateConfig
  };

})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FeedLoader;
}
