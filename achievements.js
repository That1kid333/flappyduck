// achievements.js — Achievement definitions and earned-state helpers

const EARNED_KEY = 'flappyDuckAchievements';

export const ACHIEVEMENTS = [
  { id: 'first_flap',  emoji: '🐣', name: 'First Flap!',    desc: 'Score your first point'          },
  { id: 'sharp_10',    emoji: '🎯', name: 'Sharpshooter',   desc: 'Score 10 in one game'             },
  { id: 'master_25',   emoji: '🏆', name: 'Duck Master',    desc: 'Score 25 in one game'             },
  { id: 'fire_50',     emoji: '🔥', name: 'On Fire',        desc: 'Score 50 in one game'             },
  { id: 'legend_100',  emoji: '👑', name: 'Legend',         desc: 'Score 100 in one game'            },
  { id: 'daily_done',  emoji: '📅', name: 'Daily Duck',     desc: 'Submit a daily challenge score'   },
  { id: 'hard_10',     emoji: '💀', name: 'Daredevil',      desc: 'Score 10 on Hard difficulty'      },
  { id: 'share',       emoji: '📤', name: 'Show Off',       desc: 'Share a score'                    },
];

export function loadEarned() {
  return JSON.parse(localStorage.getItem(EARNED_KEY) || '[]');
}

function saveEarned(earned) {
  localStorage.setItem(EARNED_KEY, JSON.stringify(earned));
}

// Mark an achievement earned locally; returns the achievement object if it was NEW, else null
export function tryEarn(id) {
  const earned = loadEarned();
  if (earned.includes(id)) return null;
  earned.push(id);
  saveEarned(earned);
  return ACHIEVEMENTS.find(a => a.id === id) ?? null;
}

// Check which score-based achievements fire for a given score; returns array of newly earned
export function checkScoreAchievements(score, difficulty) {
  const checks = [
    { id: 'first_flap',  ok: score >= 1   },
    { id: 'sharp_10',    ok: score >= 10  },
    { id: 'master_25',   ok: score >= 25  },
    { id: 'fire_50',     ok: score >= 50  },
    { id: 'legend_100',  ok: score >= 100 },
    { id: 'hard_10',     ok: score >= 10 && difficulty === 'hard' },
  ];
  return checks.map(c => c.ok ? tryEarn(c.id) : null).filter(Boolean);
}
