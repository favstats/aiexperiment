// ============================================
// CIRCL FEED LOADER
// Loads and processes feed configuration from JSON files
// ============================================

const FeedLoader = (function() {
  'use strict';

  // ============================================
  // DUTCH NAME DATA
  // ============================================
  const dutchFirstNames = {
    female: {
      '18-29': ['Emma', 'Sophie', 'Julia', 'Lotte', 'Anna', 'Lisa', 'Eva', 'Sanne', 'Fleur', 'Iris', 'Mila', 'Noa', 'Sara', 'Isa', 'Tessa'],
      '30-44': ['Linda', 'Sandra', 'Monique', 'Petra', 'Nicole', 'Wendy', 'Bianca', 'Marjolein', 'Esther', 'Ingrid', 'Manon', 'Danielle', 'Kim', 'Anouk', 'Femke'],
      '45-59': ['Joke', 'Annemarie', 'Ria', 'Truus', 'Hennie', 'Gerda', 'Thea', 'Wilma', 'Marian', 'Corrie', 'Anneke', 'Liesbeth', 'Janny', 'Bep', 'Nel'],
      '60+': ['Maria', 'Elisabeth', 'Johanna', 'Cornelia', 'Hendrika', 'Geertruida', 'Wilhelmina', 'Adriana', 'Jacoba', 'Petronella', 'Antje', 'Grietje', 'Dirkje', 'Aaltje', 'Neeltje']
    },
    male: {
      '18-29': ['Daan', 'Sem', 'Lars', 'Luuk', 'Tim', 'Jesse', 'Thomas', 'Thijs', 'Max', 'Bram', 'Ruben', 'Niels', 'Stijn', 'Nick', 'Milan'],
      '30-44': ['Peter', 'Mark', 'Erik', 'Marco', 'Robert', 'Jeroen', 'Marcel', 'Ronald', 'Martijn', 'Bas', 'Wouter', 'Dennis', 'Vincent', 'Rick', 'Michiel'],
      '45-59': ['Jan', 'Henk', 'Kees', 'Wim', 'Piet', 'Gerard', 'Hans', 'Frank', 'Albert', 'Willem', 'Theo', 'Jaap', 'Dick', 'Bert', 'Arie'],
      '60+': ['Johannes', 'Cornelis', 'Hendrik', 'Pieter', 'Willem', 'Gerrit', 'Jacobus', 'Dirk', 'Albertus', 'Antonius', 'Adrianus', 'Petrus', 'Franciscus', 'Bernardus', 'Martinus']
    }
  };

  const dutchLastNames = [
    'de Jong', 'Jansen', 'de Vries', 'van den Berg', 'van Dijk', 'Bakker', 'Janssen', 'Visser', 'Smit', 'Meijer',
    'de Boer', 'Mulder', 'de Groot', 'Bos', 'Vos', 'Peters', 'Hendriks', 'van Leeuwen', 'Dekker', 'Brouwer',
    'de Wit', 'Dijkstra', 'Smits', 'de Graaf', 'van der Meer', 'van der Linden', 'Kok', 'Jacobs', 'de Haan', 'Vermeer'
  ];

  const avatarAgeRanges = {
    '18-29': { min: 1, max: 30 },
    '30-44': { min: 15, max: 50 },
    '45-59': { min: 35, max: 70 },
    '60+': { min: 50, max: 99 }
  };

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

  function generateDutchName(gender, ageGroup) {
    const firstNames = dutchFirstNames[gender]?.[ageGroup] || dutchFirstNames[gender]?.['30-44'] || ['Jan'];
    let name;
    let attempts = 0;
    do {
      const first = randomChoice(firstNames);
      const last = randomChoice(dutchLastNames);
      name = `${first} ${last}`;
      attempts++;
    } while (usedNames.has(name) && attempts < 50);
    usedNames.add(name);
    return name;
  }

  function getAvatarId(ageGroup) {
    const range = avatarAgeRanges[ageGroup] || { min: 1, max: 99 };
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
    return `https://randomuser.me/api/portraits/${genderPath}/${id}.jpg`;
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
      
      // For person posts (not organization)
      if (processed.subtype !== 'organization') {
        // Generate name if null
        if (author.name === null || author.name === undefined) {
          const gender = author.gender || 'male';
          const ageGroup = author.age_group || '30-44';
          author.name = generateDutchName(gender, ageGroup);
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
  // PERSONALIZATION
  // ============================================
  
  /**
   * Select personalized stimuli based on config
   * @param {Array} stimuli - All available stimuli
   * @param {Object} params - Personalization params {gender, age, ideology, issue}
   * @param {Object} personalizationConfig - Config from feed-config.json
   * @returns {Array} - Selected stimuli with _isTailored markers
   */
  function selectPersonalizedStimuli(stimuli, params, personalizationConfig = {}) {
    const tailoredCount = personalizationConfig.tailored_count ?? 1;
    const randomCount = personalizationConfig.random_count ?? 3;
    const totalCount = tailoredCount + randomCount;

    if (!params || !params.gender || !params.age || !params.ideology || !params.issue) {
      // No personalization params - return random selection (all marked as random)
      return shuffleArray(stimuli).slice(0, totalCount).map(s => ({ ...s, _isTailored: false }));
    }

    const { gender, age, ideology, issue } = params;

    // Find all stimuli that match the tailored criteria
    const tailoredMatches = stimuli.filter(s => 
      s.author?.gender === gender &&
      s.author?.age_group === age &&
      s.metadata?.ideology === ideology &&
      s.metadata?.policy_issue === issue
    );

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
   * Convert political score (1-10) to ideology string
   */
  function getIdeologyFromPolitical(politicalScore) {
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
   * Load and generate a feed from JSON configuration
   * @param {string} configPath - Path to feed-config.json
   * @param {Object} options - Optional settings
   * @param {Object} options.personalization - Personalization params {gender, age, ideology, issue}
   *                                          OR {gender, age, politics, issue} where politics is 1-10 scale
   * @param {number} options.totalPosts - Override total posts count
   * @returns {Object} - { config, posts, stimuliCount, fillersCount, personalization }
   */
  async function loadFeed(configPath = 'data/feed-config.json', options = {}) {
    // Reset tracking sets
    usedNames.clear();
    usedAvatarIds.clear();

    // Load config
    const config = await loadJSON(configPath);
    
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
    if (options.personalization) {
      personalization = { ...options.personalization };
      // Convert politics (1-10) to ideology if needed
      if (personalization.politics !== undefined && !personalization.ideology) {
        personalization.ideology = getIdeologyFromPolitical(personalization.politics);
      }
    }

    // Override total_posts if specified
    const feedSettings = { ...config.feed_settings };
    if (options.totalPosts) {
      feedSettings.total_posts = options.totalPosts;
    }

    // Get personalization config from feed config
    const personalizationConfig = config.personalization || {};

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
    // Expose utilities for testing
    generateDutchName,
    getAvatarUrl,
    shuffleArray
  };

})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FeedLoader;
}
