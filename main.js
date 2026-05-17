// --- DOM Elements ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startMenu = document.getElementById('start-menu');
const inGameUI = document.getElementById('in-game-ui');
const gameOverMenu = document.getElementById('game-over-menu');

const scoreDisplay = document.getElementById('score-display');
const finalScoreDisplay = document.getElementById('final-score');
const bestScoreDisplay = document.getElementById('best-score');

const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const menuBtn = document.getElementById('menu-btn');
const duckOptions = document.querySelectorAll('.duck-option');

// --- Game State & Constants ---
let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let bestScore = localStorage.getItem('flappyDuckBestScore') || 0;
let frames = 0;

// Canvas resizing
function resize() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}
window.addEventListener('resize', resize);
resize();

// --- Assets ---
const images = {};
let selectedDuckKey = 'mallard_duck.png';

function loadImage(name, src) {
  const img = new Image();
  img.src = src;
  images[name] = img;
}

loadImage('mallard', '/mallard_duck.png');
loadImage('white', '/white_duck.png');
loadImage('rubber', '/rubber_duck.png');
loadImage('tree', '/tree_obstacle.png');
loadImage('bg', '/lake_background.png');

// Map filename to loaded image key
const duckKeyMap = {
  'mallard_duck.png': 'mallard',
  'white_duck.png': 'white',
  'rubber_duck.png': 'rubber'
};

// --- Character Selection Logic ---
duckOptions.forEach(option => {
  option.addEventListener('click', () => {
    duckOptions.forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    selectedDuckKey = option.getAttribute('data-duck');
  });
});

// --- Entities ---

const background = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  speed: 1,
  draw: function() {
    if(!images.bg.complete) return;
    
    // Maintain aspect ratio while covering height
    const ratio = images.bg.width / images.bg.height;
    this.height = canvas.height;
    this.width = canvas.height * ratio;

    ctx.drawImage(images.bg, this.x, this.y, this.width, this.height);
    // Draw second image to loop
    ctx.drawImage(images.bg, this.x + this.width, this.y, this.width, this.height);
  },
  update: function() {
    if (gameState === 'PLAYING') {
      this.x = (this.x - this.speed) % this.width;
    }
  }
};

const duck = {
  x: 50,
  y: 150,
  width: 75,
  height: 75,
  gravity: 0.4,
  velocity: 0,
  jump: -7.5,
  radius: 15,
  
  draw: function() {
    const imgKey = duckKeyMap[selectedDuckKey];
    const img = images[imgKey];
    if(!img || !img.complete) return;
    
    ctx.save();
    ctx.translate(this.x + this.width/2, this.y + this.height/2);
    
    // Rotate based on velocity
    let rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (this.velocity * 0.1)));
    ctx.rotate(rotation);
    
    const scale = Math.min(this.width / img.width, this.height / img.height);
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    
    ctx.drawImage(img, -drawWidth/2, -drawHeight/2, drawWidth, drawHeight);
    ctx.restore();
  },
  
  update: function() {
    this.velocity += this.gravity;
    this.y += this.velocity;
    
    // Ground collision
    if (this.y + this.height >= canvas.height) {
      this.y = canvas.height - this.height;
      setGameOver();
    }
    
    // Ceiling collision
    if (this.y <= 0) {
      this.y = 0;
      this.velocity = 0;
    }
  },
  
  flap: function() {
    this.velocity = this.jump;
  },

  reset: function() {
    this.y = canvas.height / 2;
    this.velocity = 0;
  }
};

const trees = {
  items: [],
  width: 130,
  gap: 220, // Increased gap for larger duck
  dx: 3.5,  // Increased speed to match new gravity/scale
  
  draw: function() {
    const img = images.tree;
    if(!img || !img.complete) return;

    for (let i = 0; i < this.items.length; i++) {
      let p = this.items[i];
      
      const scale = this.width / img.width;
      const drawnHeight = img.height * scale;
      
      // Sample a slice from the middle of the tree image for the trunk
      // This avoids sampling transparent pixels at the very bottom edge
      const trunkSy = Math.floor(img.height / 2);
      const trunkSh = 10;
      
      // Top tree
      ctx.save();
      ctx.translate(p.x + this.width / 2, p.topHeight);
      ctx.scale(1, -1); // Flip vertically so leaves point towards the gap
      ctx.drawImage(img, -this.width / 2, 0, this.width, drawnHeight);
      
      // Extend trunk up to the screen edge
      if (drawnHeight < p.topHeight) {
        ctx.drawImage(img, 0, trunkSy, img.width, trunkSh, 
                      -this.width / 2, drawnHeight - 1, this.width, p.topHeight - drawnHeight + 2);
      }
      ctx.restore();
      
      // Bottom tree
      ctx.save();
      ctx.translate(p.x + this.width / 2, canvas.height - p.bottomHeight);
      ctx.drawImage(img, -this.width / 2, 0, this.width, drawnHeight);
      
      // Extend trunk down to the screen edge
      if (drawnHeight < p.bottomHeight) {
        ctx.drawImage(img, 0, trunkSy, img.width, trunkSh, 
                      -this.width / 2, drawnHeight - 1, this.width, p.bottomHeight - drawnHeight + 2);
      }
      ctx.restore();
    }
  },
  
  update: function() {
    // Add new pipes
    if (frames % 120 === 0) {
      const minHeight = 50;
      const maxHeight = canvas.height - this.gap - minHeight;
      const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1) + minHeight);
      const bottomHeight = canvas.height - this.gap - topHeight;
      
      this.items.push({
        x: canvas.width,
        y: 0,
        topHeight: topHeight,
        bottomHeight: bottomHeight,
        passed: false
      });
    }
    
    for (let i = 0; i < this.items.length; i++) {
      let p = this.items[i];
      
      // Move pipe
      p.x -= this.dx;
      
      // Collision detection (AABB approximation)
      // Duck hitbox (huge padding to account for transparent sprite background)
      const duckHitbox = {
        left: duck.x + 20,
        right: duck.x + duck.width - 20,
        top: duck.y + 20,
        bottom: duck.y + duck.height - 20
      };

      // Tree padding (to ignore the transparent background around the tree sprite)
      const treePadding = 30;

      // Top pipe hitbox
      if (duckHitbox.right > p.x + treePadding && duckHitbox.left < p.x + this.width - treePadding && duckHitbox.top < p.y + p.topHeight) {
        setGameOver();
      }
      
      // Bottom pipe hitbox
      if (duckHitbox.right > p.x + treePadding && duckHitbox.left < p.x + this.width - treePadding && duckHitbox.bottom > canvas.height - p.bottomHeight) {
        setGameOver();
      }
      
      // Update score
      if (p.x + this.width < duck.x && !p.passed) {
        score++;
        scoreDisplay.innerText = score;
        p.passed = true;
      }
      
      // Remove off-screen pipes
      if (p.x + this.width < 0) {
        this.items.shift();
        i--;
      }
    }
  },

  reset: function() {
    this.items = [];
  }
};

// --- Game Logic ---

function draw() {
  ctx.fillStyle = '#70c5ce'; // Fallback background color
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  background.draw();
  trees.draw();
  duck.draw();
}

function update() {
  background.update();
  
  if (gameState === 'PLAYING') {
    duck.update();
    trees.update();
    frames++;
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// --- Control Functions ---

function startGame() {
  gameState = 'PLAYING';
  score = 0;
  frames = 0;
  scoreDisplay.innerText = score;
  duck.reset();
  trees.reset();
  
  startMenu.classList.remove('active');
  gameOverMenu.classList.remove('active');
  inGameUI.classList.add('active');
}

function setGameOver() {
  gameState = 'GAMEOVER';
  inGameUI.classList.remove('active');
  gameOverMenu.classList.add('active');
  
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('flappyDuckBestScore', bestScore);
  }
  
  finalScoreDisplay.innerText = score;
  bestScoreDisplay.innerText = bestScore;
}

function showMenu() {
  gameState = 'START';
  gameOverMenu.classList.remove('active');
  startMenu.classList.add('active');
  
  duck.reset();
  trees.reset();
  score = 0;
  frames = 0;
}

// --- Inputs ---

function handleInput(e) {
  // Prevent default scrolling on mobile if touching canvas
  if(e.type === 'touchstart' && e.target === canvas) {
    e.preventDefault(); 
  }

  if (gameState === 'PLAYING') {
    duck.flap();
  } else if (gameState === 'START' && (e.type === 'click' || e.code === 'Space')) {
    // Only allow click/space to start if not clicking UI buttons
    if (e.target === canvas) {
       // startGame(); // Optional: allow clicking canvas to start. We have a button though.
    }
  } else if (gameState === 'GAMEOVER' && (e.type === 'click' || e.code === 'Space')) {
    if (e.target === canvas) {
       // startGame();
    }
  }
}

canvas.addEventListener('mousedown', handleInput);
canvas.addEventListener('touchstart', handleInput, { passive: false });
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault(); // Stop page scrolling
    handleInput(e);
  }
});

// UI Buttons
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
menuBtn.addEventListener('click', showMenu);

// Start loop
images.bg.onload = () => {
    // ensure ratio is calculated once
};

// initialize screens
showMenu();
loop();
