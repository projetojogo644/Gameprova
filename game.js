const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const levelDisplay = document.getElementById('level-display');
const livesDisplay = document.getElementById('lives-display');
const scoreDisplay = document.getElementById('score-display');
const tempFill = document.getElementById('temp-fill');
const iglooProgressDisplay = document.getElementById('igloo-progress');
const finalScoreDisplay = document.getElementById('final-score');

// Overlays
const menuOverlay = document.getElementById('menu');
const gameOverOverlay = document.getElementById('game-over');
const levelCompleteOverlay = document.getElementById('level-complete');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const nextLevelBtn = document.getElementById('next-level-btn');

// Game Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const MARGIN_BOTTOM = 180; // y = 0 to 180 is top margin
const ROW_HEIGHT = 105;
const IGLOO_BLOCKS_NEEDED = 15;

const IGLOO_POSITIONS = [
    {x: 350, y: 140}, {x: 375, y: 140}, {x: 400, y: 140}, {x: 425, y: 140}, {x: 450, y: 140},
    {x: 362.5, y: 115}, {x: 387.5, y: 115}, {x: 412.5, y: 115}, {x: 437.5, y: 115},
    {x: 375, y: 90}, {x: 400, y: 90}, {x: 425, y: 90},
    {x: 387.5, y: 65}, {x: 412.5, y: 65},
    {x: 400, y: 40}
];

// Utility
function MathMod(n, m) { return ((n % m) + m) % m; }

class IceBlock {
    constructor(xOffset, width) {
        this.xOffset = xOffset;
        this.width = width;
        this.color = 'white'; // 'white' = uncollected, '#0ff' = collected
        this.x = 0; // Calculated during update
        this.y = 0; // Calculated by lane
        this.enemy = null; // Can hold an enemy
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y + 20, this.width, 60);
        
        // Ice details
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(this.x, this.y + 75, this.width, 5);
        
        if (this.enemy) {
            this.enemy.draw(ctx, this.x, this.y + 20);
        }
    }
}

class Enemy {
    constructor(blockWidth) {
        this.x = 10;
        this.yOffset = -30;
        this.width = 30;
        this.height = 30;
        this.speed = 40; // px per second relative to block
        this.dir = 1;
        this.blockWidth = blockWidth;
    }

    update(dt) {
        this.x += this.speed * this.dir * dt;
        if (this.x + this.width > this.blockWidth - 5) {
            this.x = this.blockWidth - this.width - 5;
            this.dir = -1;
        } else if (this.x < 5) {
            this.x = 5;
            this.dir = 1;
        }
    }

    draw(ctx, blockX, blockY) {
        ctx.fillStyle = '#f0f'; // Neon pink enemy
        ctx.fillRect(blockX + this.x, blockY + this.yOffset, this.width, this.height);
        // eyes
        ctx.fillStyle = 'white';
        ctx.fillRect(blockX + this.x + 5, blockY + this.yOffset + 5, 8, 8);
        ctx.fillRect(blockX + this.x + 17, blockY + this.yOffset + 5, 8, 8);
        ctx.fillStyle = 'black';
        ctx.fillRect(blockX + this.x + 8 + (this.dir === 1 ? 2 : 0), blockY + this.yOffset + 7, 4, 4);
        ctx.fillRect(blockX + this.x + 20 + (this.dir === 1 ? 2 : 0), blockY + this.yOffset + 7, 4, 4);
    }
}

class IceLane {
    constructor(row, y, speed, blockCount) {
        this.row = row;
        this.y = y;
        this.speed = speed;
        this.blocks = [];
        this.offset = 0;
        this.laneLength = blockCount * 300; // 300px spacing
        
        for (let i = 0; i < blockCount; i++) {
            let block = new IceBlock(i * 300, 120);
            this.blocks.push(block);
        }
    }

    spawnEnemy() {
        if (this.blocks.length > 0) {
            let b = this.blocks[Math.floor(Math.random() * this.blocks.length)];
            b.enemy = new Enemy(b.width);
        }
    }

    update(dt) {
        this.offset += this.speed * dt;
        this.blocks.forEach(b => {
             b.y = this.y;
             // Wrap logic: total length is laneLength, we map it back to -150 to laneLength-150
             b.x = MathMod(this.offset + b.xOffset, this.laneLength) - 150;
             if (b.enemy) {
                 b.enemy.update(dt);
             }
        });
    }

    draw(ctx) {
        this.blocks.forEach(b => b.draw(ctx));
    }
}

class Player {
    constructor() {
        this.width = 30;
        this.height = 40;
        this.reset();
    }

    reset() {
        this.currentRow = 0; // 0 = margin, 1-4 = lanes
        this.x = CANVAS_WIDTH / 2 - this.width / 2;
        this.y = 100;
        this.isJumping = false;
        this.jumpProgress = 0;
        this.startX = 0;
        this.startY = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.targetRow = 0;
        this.attachedBlock = null;
        this.jumpDuration = 0.25; // seconds
        this.dead = false;
    }

    jumpTo(rowTarget, xOffsetDir) {
        if (this.isJumping || this.dead) return;
        
        this.targetRow = rowTarget;
        if (this.targetRow < 0) this.targetRow = 0;
        if (this.targetRow > 4) this.targetRow = 4;

        this.startX = this.x;
        this.startY = this.y;

        // Determine target Y based on row
        if (this.targetRow === 0) {
            this.targetY = 100; // Safe margin Y
        } else {
            // lanes start at row 1, lane index 0
            // Lane 0: y=180, Lane 1: y=285, Lane 2: y=390, Lane 3: y=495
            this.targetY = 180 + (this.targetRow - 1) * ROW_HEIGHT;
        }

        // Horizontal movement
        this.targetX = this.startX + (xOffsetDir * 120);
        
        // Clamp horizontal
        if (this.targetX < 0) this.targetX = 0;
        if (this.targetX > CANVAS_WIDTH - this.width) this.targetX = CANVAS_WIDTH - this.width;

        this.isJumping = true;
        this.jumpProgress = 0;
        this.attachedBlock = null; // Detach immediately physically
    }

    update(dt) {
        if (this.dead) return;

        if (this.isJumping) {
            this.jumpProgress += dt / this.jumpDuration;
            if (this.jumpProgress >= 1) {
                this.jumpProgress = 1;
                this.isJumping = false;
                this.currentRow = this.targetRow;
                this.x = this.targetX;
                this.y = this.targetY;
                this.onLand();
            } else {
                this.x = this.startX + (this.targetX - this.startX) * this.jumpProgress;
                let arc = Math.sin(this.jumpProgress * Math.PI) * 40;
                this.y = this.startY + (this.targetY - this.startY) * this.jumpProgress - arc;
            }
        } else if (this.attachedBlock) {
            // Move with attached block
            this.x = this.attachedBlock.x + this.attachedBlock.width / 2 - this.width / 2;
            this.y = this.attachedBlock.y;
            
            // Screen boundaries wrap?? No, if block goes offscreen, player drops or dies
            if (this.x < -this.width || this.x > CANVAS_WIDTH) {
                game.playerDies();
            }

            // Check enemy collision
            if (this.attachedBlock.enemy) {
                let pRect = {x: this.x, y: this.y, w: this.width, h: this.height};
                let eRect = {
                    x: this.attachedBlock.x + this.attachedBlock.enemy.x,
                    y: this.attachedBlock.y + this.attachedBlock.enemy.yOffset + 20,
                    w: this.attachedBlock.enemy.width,
                    h: this.attachedBlock.enemy.height
                };
                if (this.checkCollision(pRect, eRect)) {
                    game.playerDies();
                }
            }
        }
    }

    checkCollision(r1, r2) {
        return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x &&
               r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
    }

    onLand() {
        if (this.currentRow === 0) { // top margin
            // Safe!
            // Check igloo entering
            if (game.iceCollected >= IGLOO_BLOCKS_NEEDED) {
                // Approximate bounding logic for igloo door: 380 to 420
                if (this.x > 360 && this.x < 420) {
                    game.completeLevel();
                }
            }
            return;
        }

        let lane = game.lanes[this.currentRow - 1];
        let landedBlock = null;

        for (let block of lane.blocks) {
            // Check if player lands horizontally on the block
            if (this.x + this.width / 2 >= block.x && this.x + this.width / 2 <= block.x + block.width) {
                landedBlock = block;
                break;
            }
        }

        if (landedBlock) {
            this.attachedBlock = landedBlock;
            // Center smoothly on block immediately visually
            this.x = this.attachedBlock.x + this.attachedBlock.width / 2 - this.width / 2;
            
            if (landedBlock.color === 'white') {
                landedBlock.color = '#0ff'; // neon cyan
                game.collectIce();
            }
        } else {
            // Splash!
            game.playerDies();
        }
    }

    draw(ctx) {
        // Simple neon player character
        ctx.fillStyle = this.dead ? '#555' : '#0f0';
        ctx.fillRect(this.x, this.y + 10, this.width, this.height);
        // Head
        ctx.fillStyle = this.dead ? '#333' : '#aaffaa';
        ctx.fillRect(this.x + 5, this.y, 20, 15);
    }
}

class GameEngine {
    constructor() {
        this.level = 1;
        this.lives = 3;
        this.score = 0;
        this.iceCollected = 0;
        this.temp = 100;
        this.state = 'menu'; // menu, playing, levelComplete, gameOver
        this.lastTime = 0;
        
        this.player = new Player();
        this.lanes = [];
        
        this.keys = {};
        
        window.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }
            this.keys[e.key] = true;
            this.handleInput(e.key);
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }

    startLevel() {
        this.iceCollected = 0;
        this.temp = 100;
        this.player.reset();
        
        let speedMult = 1 + (this.level - 1) * 0.25;

        this.lanes = [
            new IceLane(1, 180, -90 * speedMult, 3),   // row 1: moves left
            new IceLane(2, 285, 120 * speedMult, 4),   // row 2: moves right
            new IceLane(3, 390, -100 * speedMult, 3),  // row 3: moves left
            new IceLane(4, 495, 110 * speedMult, 3)    // row 4: moves right
        ];

        // Add enemies
        if (this.level >= 1) this.lanes[1].spawnEnemy();
        if (this.level >= 2) this.lanes[3].spawnEnemy();
        if (this.level >= 3) {
            this.lanes[0].spawnEnemy();
            this.lanes[2].spawnEnemy();
        }

        this.state = 'playing';
        this.updateUI();
        requestAnimationFrame((t) => this.loop(t));
    }

    handleInput(key) {
        if (this.state !== 'playing') {
            if (key === 'Enter') {
                if (this.state === 'menu') startBtn.click();
                if (this.state === 'gameOver') restartBtn.click();
                if (this.state === 'levelComplete') nextLevelBtn.click();
            }
            return;
        }

        if (this.player.isJumping || this.player.dead) return;

        if (key === 'ArrowUp') this.player.jumpTo(this.player.currentRow - 1, 0);
        else if (key === 'ArrowDown') this.player.jumpTo(this.player.currentRow + 1, 0);
        else if (key === 'ArrowLeft') this.player.jumpTo(this.player.currentRow, -1);
        else if (key === 'ArrowRight') this.player.jumpTo(this.player.currentRow, 1);
    }

    collectIce() {
        if (this.iceCollected < IGLOO_BLOCKS_NEEDED) {
            this.iceCollected++;
            this.score += 10;
            this.updateUI();
        }
    }

    playerDies() {
        this.player.dead = true;
        this.lives--;
        this.updateUI();
        
        setTimeout(() => {
            if (this.lives > 0) {
                this.player.reset();
                // Reset falling blocks to white? In Frostbite yes, but we can leave them
            } else {
                this.state = 'gameOver';
                menuOverlay.classList.add('hidden');
                levelCompleteOverlay.classList.add('hidden');
                gameOverOverlay.classList.remove('hidden');
                finalScoreDisplay.innerText = this.score;
            }
        }, 1000); // 1 sec delay before respawn
    }

    completeLevel() {
        this.score += Math.floor(this.temp) * 10; // score bonus
        this.state = 'levelComplete';
        menuOverlay.classList.add('hidden');
        gameOverOverlay.classList.add('hidden');
        levelCompleteOverlay.classList.remove('hidden');
        this.updateUI();
    }

    updateUI() {
        levelDisplay.innerText = `Level: ${this.level}`;
        livesDisplay.innerText = `Lives: ${this.lives}`;
        scoreDisplay.innerText = `Score: ${this.score}`;
        iglooProgressDisplay.innerText = `Ice: ${this.iceCollected}/${IGLOO_BLOCKS_NEEDED}`;
        
        let tempPct = Math.max(0, this.temp);
        tempFill.style.width = `${tempPct}%`;
        if (tempPct > 50) tempFill.style.backgroundColor = '#0f0';
        else if (tempPct > 20) tempFill.style.backgroundColor = '#ff0';
        else tempFill.style.backgroundColor = '#f00';
    }

    loop(timestamp) {
        if (this.state !== 'playing') {
            this.lastTime = timestamp;
            return; // pause loop
        }

        let dt = (timestamp - this.lastTime) / 1000;
        if (dt > 0.1) dt = 0.1; // Cap dt in case tab is inactive
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        // Update Temperature
        if (!this.player.dead) {
            let tempDropRate = 2 + this.level * 0.5; // per second
            this.temp -= tempDropRate * dt;
            if (this.temp <= 0) {
                this.temp = 0;
                this.playerDies();
            }
            this.updateUI();
            
            this.lanes.forEach(lane => lane.update(dt));
        }

        this.player.update(dt);
    }

    draw() {
        // Clear background
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw Margin (Ice shelf)
        ctx.fillStyle = '#eee';
        ctx.fillRect(0, 0, CANVAS_WIDTH, MARGIN_BOTTOM);

        // Draw Igloo
        this.drawIgloo();

        // Draw Lanes
        this.lanes.forEach(lane => lane.draw(ctx));

        // Draw Player
        this.player.draw(ctx);
        
        // Effects if dead (like a visual flash or particles could be added here)
    }

    drawIgloo() {
        // Base Igloo drawing
        IGLOO_POSITIONS.forEach((pos, index) => {
            if (index < this.iceCollected) {
                ctx.fillStyle = '#fff';
                ctx.fillRect(pos.x, pos.y, 23, 23);
                ctx.strokeStyle = '#aaa';
                ctx.strokeRect(pos.x, pos.y, 23, 23);
            } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.strokeRect(pos.x, pos.y, 23, 23);
            }
        });

        // Door opens if complete
        if (this.iceCollected >= IGLOO_BLOCKS_NEEDED) {
            ctx.fillStyle = '#000';
            ctx.fillRect(390, 140, 20, 23);
        }
    }
}

const game = new GameEngine();

// Event Listeners for UI
startBtn.addEventListener('click', () => {
    menuOverlay.classList.add('hidden');
    game.level = 1;
    game.lives = 3;
    game.score = 0;
    game.lastTime = performance.now();
    game.startLevel();
});

restartBtn.addEventListener('click', () => {
    gameOverOverlay.classList.add('hidden');
    game.level = 1;
    game.lives = 3;
    game.score = 0;
    game.lastTime = performance.now();
    game.startLevel();
});

nextLevelBtn.addEventListener('click', () => {
    levelCompleteOverlay.classList.add('hidden');
    game.level++;
    game.lastTime = performance.now();
    game.startLevel();
});
