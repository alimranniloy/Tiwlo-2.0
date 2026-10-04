// ====================================================================
// TIWLO LIVE SUPPORT: 500+ REALISTIC ENGLISH AGENT PERSONAS POOL
// ====================================================================

const FIRST_NAMES = [
  'Sarah', 'Michael', 'David', 'Emma', 'James', 'Jessica', 'Alexander', 'Emily',
  'Daniel', 'Sophia', 'Matthew', 'Olivia', 'Christopher', 'Isabella', 'Andrew',
  'Mia', 'Joseph', 'Charlotte', 'William', 'Amelia', 'Joshua', 'Harper', 'Ryan',
  'Evelyn', 'Nicholas', 'Abigail', 'Tyler', 'Elizabeth', 'Jacob', 'Sofia', 'Brandon',
  'Avery', 'Benjamin', 'Ella', 'Samuel', 'Madison', 'Nathan', 'Scarlett', 'Christian',
  'Victoria', 'Jonathan', 'Aria', 'Dylan', 'Grace', 'Ethan', 'Chloe', 'Anthony',
  'Camila', 'Kevin', 'Penelope', 'Thomas', 'Riley', 'Robert', 'Layla', 'Justin',
  'Lillian', 'Brian', 'Nora', 'Adam', 'Zoey', 'Eric', 'Mila', 'Aaron', 'Aubrey',
  'Charles', 'Hannah', 'Steven', 'Lily', 'Jack', 'Addison', 'Sean', 'Eleanor',
  'Austin', 'Natalie', 'Jordan', 'Luna', 'Luke', 'Savannah', 'Connor', 'Brooklyn',
  'Cameron', 'Leah', 'Cole', 'Zoe', 'Ian', 'Stella', 'Julian', 'Hazel', 'Owen',
  'Ellie', 'Gavin', 'Paisley', 'Caleb', 'Audrey', 'Evan', 'Skylar', 'Cody', 'Violet',
  'Liam', 'Claire', 'Mason', 'Bella', 'Noah', 'Aurora', 'Lucas', 'Lucy', 'Oliver'
];

const LAST_NAMES = [
  'Jenkins', 'Miller', 'Anderson', 'Taylor', 'Wilson', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez',
  'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott',
  'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker',
  'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Gomez', 'Phillips',
  'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
  'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz',
  'Morgan', 'Cooper', 'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos',
  'Kim', 'Cox', 'Ward', 'Richardson', 'Watson', 'Brooks', 'Chavez', 'Wood',
  'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes', 'Price', 'Alvarez',
  'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez'
];

const ROLES = [
  'Senior Support Specialist',
  'Cloud Solutions Specialist',
  'Customer Success Lead',
  'Technical Support Lead',
  'POS & Systems Specialist',
  'Infrastructure Advisor',
  'Enterprise Account Lead',
  'Billing & Storefront Specialist'
];

// Enterprise SVG / Initials avatars for support agents pool
function getAgentAvatarUrl(firstName, lastName) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName + ' ' + lastName)}&background=0284c7&color=fff&size=150&bold=true`;
}

// Generate deterministic pool of 500+ realistic agents
export function generateAgentsPool(count = 500) {
  const pool = [];
  let id = 1;

  for (let i = 0; i < FIRST_NAMES.length; i++) {
    for (let j = 0; j < LAST_NAMES.length; j++) {
      if (pool.length >= count) break;
      const first = FIRST_NAMES[i];
      const last = LAST_NAMES[j];
      const role = ROLES[(i + j) % ROLES.length];
      const avatar = getAgentAvatarUrl(first, last);

      pool.push({
        id: `agent_${id++}`,
        name: `${first} ${last}`,
        firstName: first,
        role,
        avatar,
        status: 'online',
        rating: (4.8 + ((i + j) % 3) * 0.1).toFixed(1),
        responseTime: '< 1 min'
      });
    }
    if (pool.length >= count) break;
  }

  return pool;
}

const ALL_AGENTS = generateAgentsPool(500);

// Get random agent from pool by tier level
export function getAgentByTier(tier = 1, excludeId = null) {
  let filtered = ALL_AGENTS;
  if (tier === 1) {
    filtered = ALL_AGENTS.filter(a => a.role.includes('Customer') || a.role.includes('Support'));
  } else if (tier === 2) {
    filtered = ALL_AGENTS.filter(a => a.role.includes('Technical') || a.role.includes('Cloud') || a.role.includes('Systems'));
  } else if (tier === 3) {
    filtered = ALL_AGENTS.filter(a => a.role.includes('Infrastructure') || a.role.includes('Enterprise'));
  }

  if (excludeId) {
    filtered = filtered.filter(a => a.id !== excludeId);
  }

  if (!filtered.length) filtered = ALL_AGENTS;
  const index = Math.floor(Math.random() * filtered.length);
  const agent = filtered[index];
  
  // Custom tier title for clear differentiation
  const tierTitle = tier === 1 
    ? 'Tier-1 Customer Specialist' 
    : tier === 2 
    ? 'Tier-2 Technical Cloud Lead' 
    : 'Tier-3 Senior Systems Architect';

  return {
    ...agent,
    tier,
    tierTitle
  };
}

export function getRandomAgent() {
  return getAgentByTier(1);
}

// Get active online specialists (shows 512 online)
export function getOnlineSpecialists(count = 4) {
  const shuffled = [...ALL_AGENTS].sort(() => 0.5 - Math.random());
  return {
    totalOnline: 512,
    sampleAgents: shuffled.slice(0, count)
  };
}

// Generate realistic ticket serial & queue status
export function generateTicketSerial() {
  const serialNum = Math.floor(10000 + Math.random() * 90000);
  const position = Math.random() > 0.5 ? 1 : 2;
  return {
    ticketId: `TWTK-${serialNum}`,
    serialNumber: `#TWTK-${serialNum}`,
    position,
    estimatedWait: position === 1 ? '1s' : '3s',
    totalOnline: 512
  };
}
