/**
 * Circl Core - Shared functionality for both admin and participant views
 */

// ============================================
// GLOBAL STATE
// ============================================
let conditionsData = null;
let debugMode = false;
let postViewTimes = {};
let viewTrackingObserver = null;
let isPageVisible = true;
let viewTimerInterval = null;

// Used avatar/name trackers to prevent duplicates
let usedAvatarIds = new Set();
let usedNames = new Set();

// Experience data (shared between modes)
let experienceData = {
  gender: null,
  age: null,
  political: 5,
  issue: null
};

// ============================================
// CONSTANTS
// ============================================
const postTemplates = [
  "Dit is wat er echt speelt in onze samenleving. We moeten hier iets aan doen! 🏠 {hashtags}",
  "Kijk naar dit beeld en vertel me dat dit acceptabel is. {hashtags}",
  "De realiteit van vandaag. Wanneer gaan we eindelijk actie ondernemen? {hashtags}",
  "Dit raakt miljoenen Nederlanders. Het is tijd voor verandering. 💪 {hashtags}",
  "Herkenbaar? Dit is de werkelijkheid voor veel mensen in ons land. {hashtags}",
  "We kunnen niet langer wegkijken. Dit moet anders! {hashtags}",
  "Een beeld zegt meer dan duizend woorden. Dit is Nederland vandaag. {hashtags}",
  "Hoelang blijven we dit nog accepteren? Er moet nu iets gebeuren. {hashtags}",
  "Stem van de straat. Dit is wat mensen écht bezighoudt. {hashtags}",
  "De feiten spreken voor zich. Tijd om te handelen! {hashtags}"
];

const policyDisplayNames = {
  'Affordable_childcare_access': 'Affordable childcare (access)',
  'Build_more_homes_accelerate_construction': 'Build more homes (construction)',
  'CO2_levy_for_industry_climate': 'CO2 levy for industry (climate)',
  'purchasing_power': 'Strengthen purchasing power (cost of living)',
  'stop_weapon_ship_to_israel': 'Stop weapon shipments to Israel'
};

const policyHashtags = {
  'Affordable_childcare_access': 'Kinderopvang',
  'Build_more_homes_accelerate_construction': 'Woningbouw',
  'CO2_levy_for_industry_climate': 'Klimaat',
  'purchasing_power': 'Koopkracht',
  'stop_weapon_ship_to_israel': 'IsraelWapens'
};

const placeholderPosts = [
  "Net terug van een heerlijke wandeling in het bos. De natuur is zo mooi in deze tijd van het jaar! 🌳",
  "Wie heeft er tips voor een goed restaurant in Amsterdam? Zoek iets gezelligs voor vanavond.",
  "Mijn kat heeft vandaag weer gekke dingen gedaan 😂 Huisdieren zijn het beste!",
  "Eindelijk vrijdag! Wat zijn jullie plannen voor het weekend?",
  "Zojuist een geweldige podcast geluisterd over geschiedenis. Aanrader!",
  "De koffie is klaar ☕ Tijd om aan het werk te gaan!",
  "Wat een prachtige zonsondergang vandaag. Soms moet je even stilstaan bij de kleine dingen.",
  "Iemand zin om te gamen vanavond? Stuur me een berichtje!",
  "Net mijn nieuwe boek uit. Kan niet wachten om te beginnen met lezen! 📚",
  "Vandaag lekker thuis werken. Geen files, geen stress.",
  "Wie anders is ook verslaafd aan kookprogramma's? 👨‍🍳",
  "De kinderen zijn naar school, eindelijk even rust!",
  "Gisteren een oude vriend tegengekomen. Wat leuk om bij te praten!",
  "Tip: de nieuwe serie op Netflix is echt de moeite waard!",
  "Heerlijk, de eerste lentedag van het jaar! ☀️",
  "Net terug van yoga. Voel me helemaal zen nu.",
  "Waarom duurt de werkweek 5 dagen en het weekend maar 2? 🤔",
  "Vandaag maar eens de garage opruimen. Wish me luck!",
  "Wie heeft er ervaring met thuiswerken? Tips welkom!",
  "De supermarkt was weer gezellig druk vandaag... 😅"
];

const organizationPlaceholderPosts = [
  "Belangrijke update over de nieuwe regelgeving voor duurzame energie. Lees meer op onze website.",
  "Onze nieuwste analyse van de woningmarkt toont aan dat betaalbaarheid een groeiend probleem is. Wat vind jij?",
  "Vandaag lanceren we een campagne voor betere kinderopvang. Doe mee en steun gezinnen in heel Nederland!",
  "De impact van klimaatverandering op onze steden: een diepgaande blik op de uitdagingen en oplossingen.",
  "Hoe kunnen we de koopkracht van huishoudens versterken in tijden van inflatie? Onze experts delen hun visie.",
  "Nieuwsbericht: De Tweede Kamer debatteert over wapenleveringen. Volg de live-uitzending op onze kanalen.",
  "Een oproep aan de politiek: investeer in publiek transport voor een groenere toekomst.",
  "Onze organisatie zet zich in voor gelijke kansen voor iedereen. Steun ons werk!",
  "De feiten over de CO2-heffing voor de industrie: wat betekent dit voor Nederland?",
  "Samen bouwen aan een inclusieve samenleving. Ontdek onze projecten en hoe je kunt bijdragen."
];

const organizations = [
  { name: 'NOS Nieuws', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/NOS_logo.svg/200px-NOS_logo.svg.png', fallbackIcon: 'newspaper', posts: [
    'LIVE: Kamerdebat over de begroting voor volgend jaar. Volg het hier.',
    'Nieuwe cijfers CBS: werkloosheid daalt naar laagste punt in 10 jaar.',
    'Weerbericht: komende dagen wisselvallig met kans op buien.'
  ]},
  { name: 'De Volkskrant', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/De_Volkskrant_logo.svg/200px-De_Volkskrant_logo.svg.png', fallbackIcon: 'newspaper', posts: [
    'Analyse: Wat betekenen de nieuwe klimaatplannen voor Nederlandse huishoudens?',
    'Interview met de nieuwe burgemeester: "We moeten de stad groener maken"',
    'Recensie: Het nieuwe boek van Arnon Grunberg is een meesterwerk.'
  ]},
  { name: 'RTL Nieuws', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/RTL_Nederland_logo.svg/200px-RTL_Nederland_logo.svg.png', fallbackIcon: 'tv', posts: [
    'BREAKING: Kabinet presenteert nieuwe maatregelen voor de woningmarkt.',
    'Vanavond in RTL Late Night: gesprek over de toekomst van werk.',
    'Video: Zo ziet de nieuwe snelweg eruit na jaren van verbouwing.'
  ]},
  { name: 'NU.nl', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Nu.nl_logo.svg/200px-Nu.nl_logo.svg.png', fallbackIcon: 'globe', posts: [
    'Liveblog: Volg hier het laatste nieuws over de stakingen.',
    'Dit zijn de belangrijkste nieuwsfeiten van vandaag.',
    'Quiz: Hoeveel weet jij over de Nederlandse geschiedenis?'
  ]},
  { name: 'NRC', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/71/NRC_logo.svg', fallbackIcon: 'newspaper', posts: [
    'Analyse: De gevolgen van het nieuwe regeringsbeleid voor de middenklasse.',
    'Opinie: Waarom we het klimaatdebat anders moeten voeren.',
    'Boekrecensie: Een verrassende kijk op de Nederlandse geschiedenis.'
  ]},
  { name: 'Gemeente Amsterdam', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Coat_of_arms_of_Amsterdam.svg/200px-Coat_of_arms_of_Amsterdam.svg.png', fallbackIcon: 'landmark', posts: [
    'Reminder: Morgen start de afsluiting van de Amstelveenseweg voor werkzaamheden.',
    'Nieuw initiatief: gratis sportlessen voor jongeren in de zomervakantie.',
    'Doe mee met de buurtschoonmaak dit weekend! Aanmelden via de link.'
  ]},
  { name: 'Rijksoverheid', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Logo_rijksoverheid.svg/200px-Logo_rijksoverheid.svg.png', fallbackIcon: 'building-columns', posts: [
    'Nieuwe regeling: zo vraag je de energietoeslag aan.',
    'Vanaf 1 januari gelden nieuwe regels voor thuiswerken. Lees meer →',
    'Campagne gestart: samen maken we Nederland verkeersveiliger.'
  ]},
  { name: 'Milieudefensie', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Milieudefensie_logo.svg/200px-Milieudefensie_logo.svg.png', fallbackIcon: 'leaf', posts: [
    'Grote overwinning! Shell moet sneller verduurzamen van de rechter.',
    'Doe mee met onze actie voor schonere lucht in de stad.',
    'Nieuw rapport: zo kunnen we Nederland klimaatneutraal maken.'
  ]},
  { name: 'Woonbond', logoUrl: null, fallbackIcon: 'house', posts: [
    'Petitie: Stop de huurverhogingen! Al 50.000 handtekeningen verzameld.',
    'Tips: Dit zijn je rechten als huurder bij achterstallig onderhoud.',
    'Woondebat in de Tweede Kamer: dit zijn de belangrijkste punten.'
  ]},
  { name: 'FNV', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/FNV_logo.svg/200px-FNV_logo.svg.png', fallbackIcon: 'users', posts: [
    'Stakingsoproep: Morgen leggen medewerkers in de zorg het werk neer.',
    'Onderhandelingen CAO vastgelopen. Werkgevers moeten bewegen!',
    'Succesvol: 5% loonsverhoging bereikt na lange onderhandelingen.'
  ]},
  { name: 'Amnesty Nederland', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Amnesty_International_logo.svg/200px-Amnesty_International_logo.svg.png', fallbackIcon: 'hand-fist', posts: [
    'Urgent: Schrijf een brief voor vrijlating van politieke gevangenen.',
    'Nieuw rapport over mensenrechtenschendingen gepubliceerd.',
    'Bedankt voor jullie steun! Samen vechten we voor rechtvaardigheid.'
  ]}
];

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

// ============================================
// UTILITY FUNCTIONS
// ============================================
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function getUniqueAvatarId() {
  let id;
  do {
    id = Math.floor(Math.random() * 99) + 1;
  } while (usedAvatarIds.has(id) && usedAvatarIds.size < 99);
  usedAvatarIds.add(id);
  return id;
}

function getAgeAppropriateAvatarId(age) {
  const ranges = {
    '18-29': { min: 1, max: 30 },
    '30-44': { min: 15, max: 50 },
    '45-59': { min: 35, max: 70 },
    '60+': { min: 50, max: 99 }
  };
  const range = ranges[age] || { min: 1, max: 99 };
  let id;
  let attempts = 0;
  do {
    id = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    attempts++;
  } while (usedAvatarIds.has(id) && attempts < 50);
  usedAvatarIds.add(id);
  return id;
}

function getUniqueName(gender, age) {
  const firstNames = dutchFirstNames[gender]?.[age] || dutchFirstNames[gender]?.['30-44'] || ['Jan'];
  let name;
  let attempts = 0;
  do {
    const first = firstNames[Math.floor(Math.random() * firstNames.length)];
    const last = dutchLastNames[Math.floor(Math.random() * dutchLastNames.length)];
    name = `${first} ${last}`;
    attempts++;
  } while (usedNames.has(name) && attempts < 50);
  usedNames.add(name);
  return name;
}

function getUniqueOrg() {
  const available = organizations.filter(o => !usedNames.has(o.name));
  if (available.length === 0) return organizations[Math.floor(Math.random() * organizations.length)];
  const org = available[Math.floor(Math.random() * available.length)];
  usedNames.add(org.name);
  return org;
}

function getIdeologyFromPolitical(val) {
  if (val <= 4) return 'left';
  if (val >= 6) return 'right';
  return 'neutral';
}

// ============================================
// DATA LOADING
// ============================================
async function loadConditionsData() {
  const response = await fetch('../conditions.json');
  if (!response.ok) throw new Error('Failed to load conditions.json');
  conditionsData = await response.json();
  return conditionsData;
}

// ============================================
// CAROUSEL FUNCTIONALITY
// ============================================
function initCarousels() {
  document.querySelectorAll('.post-media').forEach(media => {
    const track = media.querySelector('.carousel-track');
    const slides = media.querySelectorAll('.carousel-slide');
    const dots = media.querySelectorAll('.carousel-dot');
    const counter = media.querySelector('.carousel-counter .current');
    const prevBtn = media.querySelector('.carousel-nav.prev');
    const nextBtn = media.querySelector('.carousel-nav.next');
    
    let currentIndex = 0;
    
    function goTo(idx) {
      currentIndex = Math.max(0, Math.min(idx, slides.length - 1));
      track.style.transform = `translateX(-${currentIndex * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle('active', i === currentIndex));
      if (counter) counter.textContent = currentIndex + 1;
    }
    
    prevBtn?.addEventListener('click', () => goTo(currentIndex - 1));
    nextBtn?.addEventListener('click', () => goTo(currentIndex + 1));
    dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));
  });
}

function initExperienceCarousels() {
  initCarousels();
}

// ============================================
// EXPERIENCE FEED GENERATION
// ============================================
function generateExperienceFeed(gender, age, ideology, issue, customTotalPosts = 40) {
  const container = document.getElementById('experience-posts');
  container.innerHTML = '';
  
  // Reset used trackers
  usedAvatarIds = new Set();
  usedNames = new Set();
  
  const posts = [];
  const totalPosts = customTotalPosts;
  const aiPostCount = 4;
  
  // Find the tailored condition
  const tailoredCondition = conditionsData.conditions.find(c => 
    c.gender === gender && 
    c.age_group === age && 
    c.ideology === ideology && 
    c.policy_issue === issue
  );
  
  // Get random conditions for the other 3 AI posts (different from tailored)
  const otherConditions = conditionsData.conditions.filter(c => 
    c.images && c.images.length > 0 &&
    !(c.gender === gender && c.age_group === age && c.ideology === ideology && c.policy_issue === issue)
  );
  shuffleArray(otherConditions);
  const randomConditions = otherConditions.slice(0, 3);
  
  // Create placeholder posts
  for (let i = 0; i < totalPosts - aiPostCount; i++) {
    posts.push(createExperiencePlaceholderPost(i, gender, age));
  }
  
  // Create AI posts
  if (tailoredCondition && tailoredCondition.images && tailoredCondition.images.length > 0) {
    posts.push(createExperienceAIPost(tailoredCondition, true, gender, age));
  }
  
  randomConditions.forEach(cond => {
    if (cond.images && cond.images.length > 0) {
      posts.push(createExperienceAIPost(cond, false, gender, age));
    }
  });
  
  // Shuffle posts
  shuffleArray(posts);
  
  // Add to container
  posts.forEach(post => container.appendChild(post));
  
  // Initialize carousels and interactions
  initExperienceCarousels();
  attachExperienceInteractions();
}

function createExperiencePlaceholderPost(index, userGender, userAge) {
  const post = document.createElement('article');
  post.className = 'post placeholder-post';
  
  const postId = `placeholder-${index}-${Date.now()}`;
  post.dataset.postId = postId;
  post.dataset.postType = 'placeholder';
  
  // Decide if this is a person or organization (15% chance org)
  const isOrg = Math.random() < 0.15;
  
  let authorName, authorSub, avatarHtml, postText;
  
  if (isOrg) {
    const org = getUniqueOrg();
    authorName = org.name;
    authorSub = '';
    postText = org.posts[Math.floor(Math.random() * org.posts.length)];
    if (org.logoUrl) {
      avatarHtml = `<div class="avatar-wrapper"><img class="post-avatar-img org-logo" src="${org.logoUrl}" alt="${org.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="post-avatar org-avatar" style="display:none;"><i class="fas fa-${org.fallbackIcon}"></i></div></div>`;
    } else {
      avatarHtml = `<div class="avatar-wrapper"><div class="post-avatar org-avatar"><i class="fas fa-${org.fallbackIcon}"></i></div></div>`;
    }
  } else {
    const postGender = Math.random() > 0.5 ? 'female' : 'male';
    const postAge = ['18-29', '30-44', '45-59', '60+'][Math.floor(Math.random() * 4)];
    authorName = getUniqueName(postGender, postAge);
    authorSub = '';
    postText = placeholderPosts[Math.floor(Math.random() * placeholderPosts.length)];
    
    const avatarId = getAgeAppropriateAvatarId(postAge);
    const avatarUrl = `https://randomuser.me/api/portraits/${postGender === 'female' ? 'women' : 'men'}/${avatarId}.jpg`;
    const initials = authorName.split(' ').map(n => n[0]).join('').toUpperCase();
    const colors = ['#1877F2', '#42B72A', '#F5A623', '#FA383E', '#00A3A3'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];
    avatarHtml = `<div class="avatar-wrapper"><img class="post-avatar-img" src="${avatarUrl}" alt="${authorName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="post-avatar" style="background: ${avatarColor}; display: none;">${initials}</div></div>`;
  }
  
  const time = `${Math.floor(Math.random() * 23) + 1}h`;
  const likes = Math.floor(Math.random() * 200) + 10;
  const comments = Math.floor(Math.random() * 30) + 1;
  const shares = Math.floor(Math.random() * 50) + 1;
  
  // 35% chance of having an image
  const hasImage = Math.random() < 0.35;
  const imageId = Math.floor(Math.random() * 1000) + 1;
  const imageHtml = hasImage ? `
    <div class="post-media">
      <img class="post-single-image" src="https://picsum.photos/seed/${imageId}/600/400" loading="lazy" alt="Post image">
    </div>
  ` : '';
  
  post.innerHTML = `
    <div class="post-header">
      ${avatarHtml}
      <div class="post-header-info">
        <div class="post-name-row">
          <span class="post-author">${authorName}</span>
        </div>
        <div class="post-meta">
          <span>${time}</span>
          <span>·</span>
          <i class="fas fa-earth-americas"></i>
        </div>
      </div>
      <div class="post-more"><i class="fas fa-ellipsis"></i></div>
    </div>
    <div class="post-content">
      <div class="post-text">${postText}</div>
    </div>
    ${imageHtml}
    <div class="post-engagement">
      <div class="engagement-counts">
        <span class="like-count"><i class="fas fa-thumbs-up" style="color: var(--circl-blue);"></i> ${likes}</span>
        <span class="comment-share-count">${comments} comment${comments !== 1 ? 's' : ''} · ${shares} share${shares !== 1 ? 's' : ''}</span>
      </div>
    </div>
    <div class="post-actions">
      <button class="post-action-btn like-btn" data-post-id="${postId}"><i class="far fa-thumbs-up"></i> Like</button>
      <button class="post-action-btn comment-btn" data-post-id="${postId}"><i class="far fa-comment"></i> Comment</button>
      <button class="post-action-btn share-btn" data-post-id="${postId}"><i class="far fa-share-square"></i> Share</button>
    </div>
    <div class="post-comment-section" style="display: none;">
      <input type="text" class="post-comment-input" placeholder="Write a comment...">
    </div>
    <div class="view-timer" style="display: none;">0.0s</div>
  `;
  
  return post;
}

function createExperienceAIPost(condition, isTailored, userGender, userAge) {
  const post = document.createElement('article');
  post.className = 'post ai-post';
  post.dataset.isTailored = isTailored.toString();
  
  const postId = `ai-${condition.condition_id}-${Date.now()}`;
  post.dataset.postId = postId;
  post.dataset.postType = isTailored ? 'ai-tailored' : 'ai-random';
  
  // Use condition's demographic for avatar
  const condGender = condition.gender;
  const condAge = condition.age_group;
  const authorName = getUniqueName(condGender, condAge);
  
  const avatarId = getAgeAppropriateAvatarId(condAge);
  const avatarUrl = `https://randomuser.me/api/portraits/${condGender === 'female' ? 'women' : 'men'}/${avatarId}.jpg`;
  const initials = authorName.split(' ').map(n => n[0]).join('').toUpperCase();
  const colors = ['#1877F2', '#42B72A', '#F5A623', '#FA383E', '#00A3A3'];
  const avatarColor = colors[Math.floor(Math.random() * colors.length)];
  
  const time = `${Math.floor(Math.random() * 23) + 1}h`;
  const policyTag = policyHashtags[condition.policy_issue] || condition.policy_issue.replace(/_/g, '');
  const hashtags = `#${condition.ideology} #${policyTag}`;
  const postTextContent = postTemplates[Math.floor(Math.random() * postTemplates.length)]
    .replace('{hashtags}', `<span class="post-hashtag">${hashtags}</span>`);
  
  // Pick ONE random image instead of carousel
  const randomImage = condition.images[Math.floor(Math.random() * condition.images.length)];
  
  const likes = Math.floor(Math.random() * 500) + 50;
  const comments = Math.floor(Math.random() * 50) + 5;
  const shares = Math.floor(Math.random() * 200) + 20;
  
  const debugInfo = debugMode ? `
    <div class="ai-debug-info">
      <span class="debug-badge ${isTailored ? 'tailored' : 'random'}">${isTailored ? '🎯 Tailored' : '🎲 Random'}</span>
      <span class="debug-details">${condAge} ${condGender} · ${condition.ideology} · ${policyDisplayNames[condition.policy_issue] || condition.policy_issue}</span>
    </div>
  ` : '';
  
  post.innerHTML = `
    <div class="post-header">
      <div class="avatar-wrapper">
        <img class="post-avatar-img" src="${avatarUrl}" alt="${authorName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="post-avatar" style="background: ${avatarColor}; display: none;">${initials}</div>
      </div>
      <div class="post-header-info">
        <div class="post-name-row">
          <span class="post-author">${authorName}</span>
        </div>
        <div class="post-meta">
          <span>${time}</span>
          <span>·</span>
          <i class="fas fa-earth-americas"></i>
        </div>
      </div>
      <div class="post-more"><i class="fas fa-ellipsis"></i></div>
    </div>
    ${debugInfo}
    <div class="post-content">
      <div class="post-text">${postTextContent}</div>
    </div>
    <div class="post-media">
      <img class="post-single-image" src="../generated_images/${condition.image_dir}/${randomImage}" loading="lazy">
    </div>
    <div class="post-engagement">
      <div class="engagement-counts">
        <span class="like-count"><i class="fas fa-thumbs-up" style="color: var(--circl-blue);"></i> ${likes}</span>
        <span class="comment-share-count">${comments} comment${comments !== 1 ? 's' : ''} · ${shares} share${shares !== 1 ? 's' : ''}</span>
      </div>
    </div>
    <div class="post-actions">
      <button class="post-action-btn like-btn" data-post-id="${postId}"><i class="far fa-thumbs-up"></i> Like</button>
      <button class="post-action-btn comment-btn" data-post-id="${postId}"><i class="far fa-comment"></i> Comment</button>
      <button class="post-action-btn share-btn" data-post-id="${postId}"><i class="far fa-share-square"></i> Share</button>
    </div>
    <div class="post-comment-section" style="display: none;">
      <input type="text" class="post-comment-input" placeholder="Write a comment...">
    </div>
    <div class="view-timer" style="display: none;">0.0s</div>
  `;
  
  return post;
}

function attachExperienceInteractions() {
  document.querySelectorAll('#experience-posts .like-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const post = this.closest('.post');
      const likeCountEl = post.querySelector('.like-count');
      const currentCount = parseInt(likeCountEl.textContent.match(/\d+/)[0]);
      
      if (this.classList.contains('liked')) {
        this.classList.remove('liked');
        this.innerHTML = '<i class="far fa-thumbs-up"></i> Like';
        likeCountEl.innerHTML = `<i class="fas fa-thumbs-up" style="color: var(--circl-blue);"></i> ${currentCount - 1}`;
      } else {
        this.classList.add('liked');
        this.innerHTML = '<i class="fas fa-thumbs-up"></i> Liked';
        this.style.color = 'var(--circl-blue)';
        likeCountEl.innerHTML = `<i class="fas fa-thumbs-up" style="color: var(--circl-blue);"></i> ${currentCount + 1}`;
      }
    });
  });
  
  document.querySelectorAll('#experience-posts .comment-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const post = this.closest('.post');
      const commentSection = post.querySelector('.post-comment-section');
      const input = post.querySelector('.post-comment-input');
      
      // Toggle comment section visibility
      if (commentSection.style.display === 'none') {
        commentSection.style.display = 'block';
        input.focus();
      } else {
        commentSection.style.display = 'none';
      }
    });
  });
  
  document.querySelectorAll('#experience-posts .post-comment-input').forEach(input => {
    input.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && this.value.trim()) {
        const post = this.closest('.post');
        const countEl = post.querySelector('.comment-share-count');
        const match = countEl.textContent.match(/(\d+) comment/);
        if (match) {
          const newCount = parseInt(match[1]) + 1;
          const sharesMatch = countEl.textContent.match(/(\d+) share/);
          const shares = sharesMatch ? parseInt(sharesMatch[1]) : 0;
          countEl.textContent = `${newCount} comment${newCount !== 1 ? 's' : ''} · ${shares} share${shares !== 1 ? 's' : ''}`;
        }
        this.value = '';
      }
    });
  });
  
  document.querySelectorAll('#experience-posts .share-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const post = this.closest('.post');
      const countEl = post.querySelector('.comment-share-count');
      const sharesMatch = countEl.textContent.match(/(\d+) share/);
      const commentsMatch = countEl.textContent.match(/(\d+) comment/);
      const comments = commentsMatch ? parseInt(commentsMatch[1]) : 0;
      
      if (this.classList.contains('shared')) {
        // Un-share
        this.classList.remove('shared');
        this.innerHTML = '<i class="far fa-share-square"></i> Share';
        this.style.color = '';
        if (sharesMatch) {
          const newShares = parseInt(sharesMatch[1]) - 1;
          countEl.textContent = `${comments} comment${comments !== 1 ? 's' : ''} · ${newShares} share${newShares !== 1 ? 's' : ''}`;
        }
      } else {
        // Share
        this.classList.add('shared');
        this.innerHTML = '<i class="fas fa-check"></i> Shared';
        this.style.color = 'var(--circl-green)';
        if (sharesMatch) {
          const newShares = parseInt(sharesMatch[1]) + 1;
          countEl.textContent = `${comments} comment${comments !== 1 ? 's' : ''} · ${newShares} share${newShares !== 1 ? 's' : ''}`;
        }
      }
    });
  });
}

// ============================================
// VIEW TRACKING
// ============================================
function startViewTracking() {
  const posts = document.querySelectorAll('#experience-posts .post');
  
  viewTrackingObserver = new IntersectionObserver((entries) => {
    if (!isPageVisible) return;
    
    entries.forEach(entry => {
      const postId = entry.target.dataset.postId;
      if (!postId) return;
      
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        if (!postViewTimes[postId]) {
          const author = entry.target.querySelector('.post-author')?.textContent || 'Unknown';
          const isAI = entry.target.classList.contains('ai-post');
          const isTailored = entry.target.dataset.isTailored === 'true';
          postViewTimes[postId] = {
            totalTime: 0,
            lastEnterTime: Date.now(),
            author: author,
            type: isAI ? (isTailored ? 'ai-tailored' : 'ai-random') : 'regular',
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
    
    updateViewTimers();
  }, {
    threshold: 0.5
  });
  
  posts.forEach(post => {
    viewTrackingObserver.observe(post);
  });
  
  viewTimerInterval = setInterval(updateViewTimers, 1000);
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('blur', handleWindowBlur);
  window.addEventListener('focus', handleWindowFocus);
}

function handleVisibilityChange() {
  if (document.hidden) {
    pauseAllTimers();
  } else {
    resumeVisibleTimers();
  }
}

function handleWindowBlur() {
  pauseAllTimers();
}

function handleWindowFocus() {
  if (!document.hidden) {
    resumeVisibleTimers();
  }
}

function pauseAllTimers() {
  if (!isPageVisible) return;
  
  isPageVisible = false;
  const now = Date.now();
  
  Object.keys(postViewTimes).forEach(postId => {
    if (postViewTimes[postId].lastEnterTime) {
      postViewTimes[postId].totalTime += now - postViewTimes[postId].lastEnterTime;
      postViewTimes[postId].lastEnterTime = null;
    }
  });
  
  updateViewTimers();
}

function resumeVisibleTimers() {
  if (isPageVisible) return;
  
  isPageVisible = true;
  const now = Date.now();
  
  Object.keys(postViewTimes).forEach(postId => {
    if (postViewTimes[postId].isCurrentlyVisible && !postViewTimes[postId].lastEnterTime) {
      postViewTimes[postId].lastEnterTime = now;
    }
  });
  
  updateViewTimers();
}

function updateViewTimers() {
  const now = Date.now();
  
  Object.keys(postViewTimes).forEach(postId => {
    const data = postViewTimes[postId];
    let totalMs = data.totalTime;
    if (data.lastEnterTime && isPageVisible) {
      totalMs += now - data.lastEnterTime;
    }
    
    const timerEl = document.querySelector(`[data-post-id="${postId}"] .view-timer`);
    if (timerEl) {
      timerEl.textContent = `${Math.round(totalMs / 1000)}s`;
      if (debugMode) {
        timerEl.style.display = 'block';
      }
    }
  });
}

function showResults() {
  const sorted = Object.entries(postViewTimes)
    .map(([postId, data]) => ({
      postId,
      ...data,
      totalMs: data.totalTime + (data.lastEnterTime && isPageVisible ? Date.now() - data.lastEnterTime : 0)
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 5);
  
  const resultsContent = document.getElementById('results-content');
  resultsContent.innerHTML = sorted.map((item, idx) => {
    const typeLabel = item.type === 'ai-tailored' ? '🎯 AI (Tailored)' : 
                      item.type === 'ai-random' ? '🎲 AI (Random)' : '📝 Regular';
    const seconds = Math.round(item.totalMs / 1000);
    
    return `
      <div class="results-item">
        <div class="results-rank">#${idx + 1}</div>
        <div class="results-info">
          <div class="results-author">${item.author}</div>
          <div class="results-type">${typeLabel}</div>
        </div>
        <div class="results-time">${seconds}s <small>viewed</small></div>
      </div>
    `;
  }).join('');
  
  document.getElementById('results-modal').classList.add('active');
}

function closeResults() {
  document.getElementById('results-modal').classList.remove('active');
}

function stopViewTracking() {
  if (viewTrackingObserver) {
    viewTrackingObserver.disconnect();
    viewTrackingObserver = null;
  }
  if (viewTimerInterval) {
    clearInterval(viewTimerInterval);
    viewTimerInterval = null;
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('blur', handleWindowBlur);
  window.removeEventListener('focus', handleWindowFocus);
  isPageVisible = true;
}
