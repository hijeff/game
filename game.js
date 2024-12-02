const WEBSOCKET_URL = "wss://nanoslo.0x.no/websocket";

let ship;
let asteroids = [];
let debris = [];
let gameLevel = 1;
let score = 0;
let gameState = 'start'; // Possible states: start, playing, levelComplete, gameover
let isMobile = false;
let bombs = 3;
let nextLevelBtn;
let shotgunPowerUps = [];
let homingMissilePowerUps = [];
let hammerPowerUps = [];
let shieldDrops = [];
let touchControls = {
    left: { x: 0, y: 0, size: 0 },
    right: { x: 0, y: 0, size: 0 },
    thrust: { x: 0, y: 0, size: 0 },
    shoot: { x: 0, y: 0, size: 0 },
};

function setup() {
    createCanvas(windowWidth, windowHeight);
    textFont("Courier");
    createStartButton();
    createRestartButton();

    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        setupTouchControls();
    }
}

function setupTouchControls() {
    const buttonSize = min(width, height) * 0.15; // Dynamically adjust size
    const padding = buttonSize * 0.2;

    touchControls.left = {
        x: padding,
        y: height - buttonSize - padding,
        size: buttonSize
    };

    touchControls.right = {
        x: buttonSize + padding * 2,
        y: height - buttonSize - padding,
        size: buttonSize
    };

    touchControls.thrust = {
        x: width - buttonSize - padding,
        y: height - buttonSize - padding,
        size: buttonSize
    };

    touchControls.shoot = {
        x: width - buttonSize - padding,
        y: height - buttonSize * 2 - padding * 2,
        size: buttonSize
    };

    // Centered Bomb button at the bottom
    touchControls.bomb = {
        x: width / 2 - buttonSize / 2,
        y: height - buttonSize - padding,
        size: buttonSize
    };
}




function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    
    if (isMobile) {
        setupTouchControls();
    }
    
    if (window.startBtn) {
        window.startBtn.position(width/2 - min(width, height) * 0.1, height/2);
    }
    if (window.restartBtn) {
        window.restartBtn.position(width/2 - min(width, height) * 0.1, height/2 + 50);
    }
    
    if (ship) {
        ship.pos.x = constrain(ship.pos.x, 0, width);
        ship.pos.y = constrain(ship.pos.y, 0, height);
        ship.r = min(width, height) * 0.02;
    }
}

function createStartButton() {
    const buttonWidth = min(width, height) * 0.2;
    const startBtn = createButton('Start Game');
    startBtn.class('game-button');
    startBtn.position(width / 2 - buttonWidth / 2, height / 2);
    startBtn.style('width', buttonWidth + 'px');
    startBtn.mousePressed(() => {
        startGame();
        startBtn.hide();
    });
    window.startBtn = startBtn;
}


function createRestartButton() {
    const buttonWidth = min(width, height) * 0.2;
    const restartBtn = createButton('Try Again');
    restartBtn.class('game-button');
    restartBtn.position(width / 2 - buttonWidth / 2, height / 2 + 50);
    restartBtn.style('width', buttonWidth + 'px');
    restartBtn.hide();
    restartBtn.mousePressed(() => {
        restartGame();
    });
    window.restartBtn = restartBtn;

    // Add button styles
    const style = document.createElement('style');
    style.textContent = `
        .game-button {
            padding: 10px 20px;
            font-size: 16px;
            background: transparent;
            color: white;
            border: 2px solid white;
            cursor: pointer;
            font-family: Courier;
            transition: all 0.3s;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        .game-button:hover {
            background: rgba(255, 255, 255, 0.1);
            box-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
        }
    `;
    document.head.appendChild(style);
}

function startGame() {
    gameState = 'playing';
    gameLevel = 1;
    score = 0;
    bombs = 3;
    ship = new Ship();
    asteroids = [];
    debris = [];
    initializeGame();
    connectNanoWebSocket();
    loop();
}

function restartGame() {
    gameState = 'start';
    score = 0;
    gameLevel = 1;
    bombs = 3;
    ship = null;
    asteroids = [];
    debris = [];
    window.restartBtn.hide(); // Hide the restart button
    startGame();
}

// draw
function draw() {
    background(0);

    // Start screen
    if (gameState === 'start') {
        displayTitleScreen();
        return;
    }

    // Level complete screen
    if (gameState === 'levelComplete') {
        levelCompleteScreen();
        return;
    }

    // Game over screen
    if (gameState === 'gameover') {
        displayGameOver();
        noLoop();
        return;
    }

    // Main gameplay
    if (gameState === 'playing') {
        displayStats();

        // Update and render debris
        for (let i = debris.length - 1; i >= 0; i--) {
            debris[i].update();
            debris[i].render();
            if (debris[i].isExpired()) {
                debris.splice(i, 1); // Remove expired debris
            }
        }

        // Update and render homing missile power-ups
        for (let i = homingMissilePowerUps.length - 1; i >= 0; i--) {
            homingMissilePowerUps[i].update(ship); // Magnetic behavior towards ship
            homingMissilePowerUps[i].render();

            // Check if collected
            if (homingMissilePowerUps[i].isCollected(ship)) {
                ship.activateHomingMissile(); // Activate homing missile mode
                homingMissilePowerUps.splice(i, 1); // Remove power-up
            }

            // Remove expired power-ups
            if (homingMissilePowerUps[i] && homingMissilePowerUps[i].isExpired()) {
                homingMissilePowerUps.splice(i, 1);
            }
        }

        // Update and render shield drops
        for (let i = shieldDrops.length - 1; i >= 0; i--) {
            shieldDrops[i].update(ship); // Magnetic behavior towards ship
            shieldDrops[i].render();

            // Check if collected
            if (shieldDrops[i].isCollected(ship)) {
                ship.shield = Math.min(ship.shield + 20, 100); // Increase shield, max 100
                shieldDrops.splice(i, 1); // Remove power-up
            }

            // Remove expired power-ups
            if (shieldDrops[i] && shieldDrops[i].isExpired()) {
                shieldDrops.splice(i, 1);
            }
        }

        // Update and render shotgun power-ups
        for (let i = shotgunPowerUps.length - 1; i >= 0; i--) {
            shotgunPowerUps[i].update(ship); // Magnetic behavior towards ship
            shotgunPowerUps[i].render();

            // Check if collected
            if (shotgunPowerUps[i].isCollected(ship)) {
                ship.activateShotgun(); // Activate shotgun mode
                shotgunPowerUps.splice(i, 1); // Remove power-up
            }

            // Remove expired power-ups
            if (shotgunPowerUps[i] && shotgunPowerUps[i].isExpired()) {
                shotgunPowerUps.splice(i, 1);
            }
        }

        // Update and render hammer power-ups
        for (let i = hammerPowerUps.length - 1; i >= 0; i--) {
            hammerPowerUps[i].update(ship); // Magnetic behavior towards ship
            hammerPowerUps[i].render();

            // Check if collected
            if (hammerPowerUps[i].isCollected(ship)) {
                ship.activateHammer(); // Activate hammer mode
                hammerPowerUps.splice(i, 1); // Remove power-up
            }

            // Remove expired power-ups
            if (hammerPowerUps[i] && hammerPowerUps[i].isExpired()) {
                hammerPowerUps.splice(i, 1);
            }
        }

 // Update and render lasers, including homing missiles
for (let i = ship.lasers.length - 1; i >= 0; i--) {
    const laser = ship.lasers[i];
    laser.update(asteroids); // Pass the asteroids array for homing missiles
    laser.render();

    for (let j = asteroids.length - 1; j >= 0; j--) {
        const asteroid = asteroids[j];

        if (laser.hits(asteroid)) {
            score += Math.floor(50 / asteroid.size); // Add score based on asteroid size
            asteroid.explode(); // Trigger asteroid explosion
            asteroids.splice(j, 1); // Remove asteroid
            ship.lasers.splice(i, 1); // Remove laser/missile
            break; // Exit asteroid loop for this laser
        }
    }

    if (laser.offscreen()) {
        ship.lasers.splice(i, 1); // Remove offscreen laser
    }
}



    // Update and render the ship
if (ship.alive) {
    ship.update(); // Updates the ship, including the hammer timer
    ship.render();
    ship.edges();
    ship.checkCollisionsWithAsteroids(asteroids); // Handle asteroid collisions
} else {
    gameState = 'gameover';
    return;
}



        // Update and render asteroids
        for (let i = asteroids.length - 1; i >= 0; i--) {
            asteroids[i].update();
            asteroids[i].render();
            asteroids[i].edges();
        }

        // Check if the level is complete
        const nonNanoAsteroids = asteroids.filter(ast => ast.amount === null);
        if (nonNanoAsteroids.length === 0 && ship.alive) {
            gameLevel++;
            gameState = 'levelComplete';
        }
    }
}








function renderTouchControls() {
    push();
    noFill();
    strokeWeight(2);

    // Left button
    stroke(255);
    circle(
        touchControls.left.x + touchControls.left.size / 2,
        touchControls.left.y + touchControls.left.size / 2,
        touchControls.left.size
    );
    textSize(touchControls.left.size * 0.3);
    textAlign(CENTER, CENTER);
    text('←', touchControls.left.x + touchControls.left.size / 2,
         touchControls.left.y + touchControls.left.size / 2);

    // Right button
    circle(
        touchControls.right.x + touchControls.right.size / 2,
        touchControls.right.y + touchControls.right.size / 2,
        touchControls.right.size
    );
    text('→', touchControls.right.x + touchControls.right.size / 2,
         touchControls.right.y + touchControls.right.size / 2);

    // Thrust button
    stroke(255, 0, 0);
    circle(
        touchControls.thrust.x + touchControls.thrust.size / 2,
        touchControls.thrust.y + touchControls.thrust.size / 2,
        touchControls.thrust.size
    );
    stroke(255);
    text('▲', touchControls.thrust.x + touchControls.thrust.size / 2,
         touchControls.thrust.y + touchControls.thrust.size / 2);

    // Shoot button
    stroke(0, 255, 0);
    circle(
        touchControls.shoot.x + touchControls.shoot.size / 2,
        touchControls.shoot.y + touchControls.shoot.size / 2,
        touchControls.shoot.size
    );
    stroke(255);
    text('⚡', touchControls.shoot.x + touchControls.shoot.size / 2,
         touchControls.shoot.y + touchControls.shoot.size / 2);

    // Bomb button
    stroke(255, 255, 0);
    circle(
        touchControls.bomb.x + touchControls.bomb.size / 2,
        touchControls.bomb.y + touchControls.bomb.size / 2,
        touchControls.bomb.size
    );
    stroke(255);
    text('💣', touchControls.bomb.x + touchControls.bomb.size / 2,
         touchControls.bomb.y + touchControls.bomb.size / 2);

    pop();
}



function touchStarted() {
    if (!isMobile || gameState !== 'playing') return;
    
    checkTouchControls(touches);
    return false;
}

function touchMoved() {
    if (!isMobile || gameState !== 'playing') return;
    
    checkTouchControls(touches);
    return false;
}

function touchEnded() {
    if (!isMobile || gameState !== 'playing') return;
    
    ship.setRotation(0);
    ship.setBoosting(false);
    return false;
}

function checkTouchControls(touches) {
    for (let touch of touches) {
        if (isInsideCircle(touch.x, touch.y, touchControls.left)) {
            ship.setRotation(-0.1);
        }
        if (isInsideCircle(touch.x, touch.y, touchControls.right)) {
            ship.setRotation(0.1);
        }
        if (isInsideCircle(touch.x, touch.y, touchControls.thrust)) {
            ship.setBoosting(true);
        }
        if (isInsideCircle(touch.x, touch.y, touchControls.shoot)) {
            ship.shoot();
        }
        if (isInsideCircle(touch.x, touch.y, touchControls.bomb)) {
            useBomb(); // Trigger bomb action
        }
    }
}



function isInsideCircle(x, y, control) {
    const centerX = control.x + control.size/2;
    const centerY = control.y + control.size/2;
    const distance = dist(x, y, centerX, centerY);
    return distance < control.size/2;
}

function displayTitleScreen() {
    const titleSize = min(width, height) * 0.05; // Scales title size based on screen dimensions
    const subTextSize = min(width, height) * 0.025; // Slightly larger for better readability on mobile
    const padding = 50; // Increased padding for better spacing
    const linkYOffset = height / 2 + 100; // Explicit offset to move buttons further down

    textAlign(CENTER, CENTER);
    background(0); // Black background for contrast
    fill(255);

    // Title and subtitle
    textSize(titleSize);
    text('JEFF HODGENS', width / 2, height / 3);
    textSize(subTextSize);
    text('Award Winning Digital Strategist', width / 2, height / 3 + titleSize);

    // Links
    textSize(subTextSize);
    const links = [
        { text: 'Honda: Project Courage', url: 'https://www.youtube.com/watch?v=e5LpeP_Kj9Q&t' },
        { text: 'AMP ALS Campaign', url: 'https://shortyawards.com/9th-impact/fnih-accelerating-medicines-partnership-in-amyotrophic-lateral-sclerosis-launch' },
        { text: 'See My Portfolio', url: 'https://static1.squarespace.com/static/638ecfebffc03756db80b372/t/6737e73cc57ba1639f1f46d5/1731716941232/jeffhodgensportfolio.pdf' },
    ];

    links.forEach((link, index) => {
        const yPos = linkYOffset + index * padding;

        // Calculate hover zone
        const linkWidth = textWidth(link.text);
        const linkHeight = subTextSize * 1.5; // Add some vertical padding for hover effect
        const xStart = width / 2 - linkWidth / 2 - 10; // Add some horizontal padding
        const xEnd = width / 2 + linkWidth / 2 + 10;
        const yStart = yPos - linkHeight / 2;
        const yEnd = yPos + linkHeight / 2;

        // Check for hover
        const isHovering = mouseX > xStart && mouseX < xEnd && mouseY > yStart && mouseY < yEnd;

        if (isHovering) {
            fill(0, 255, 0); // Highlight color
            cursor(HAND);
            rect(xStart, yStart, xEnd - xStart, yEnd - yStart, 5); // Highlight background rectangle
            if (mouseIsPressed) {
                window.open(link.url, '_blank');
            }
        } else {
            fill(255); // Default text color
        }

        // Draw link text
        text(link.text, width / 2, yPos);
    });

    // Reset cursor if no hover
    if (!links.some(link => {
        const yPos = linkYOffset + links.indexOf(link) * padding;
        const linkWidth = textWidth(link.text);
        const xStart = width / 2 - linkWidth / 2 - 10;
        const xEnd = width / 2 + linkWidth / 2 + 10;
        const yStart = yPos - subTextSize * 0.75;
        const yEnd = yPos + subTextSize * 0.75;

        return mouseX > xStart && mouseX < xEnd && mouseY > yStart && mouseY < yEnd;
    })) {
        cursor(AUTO);
    }
}



function displayGameOver() {
    const titleSize = min(width, height) * 0.04;
    const subTextSize = min(width, height) * 0.025;

    textAlign(CENTER, CENTER);
    fill(255, 0, 0);
    textSize(titleSize);
    text("Game Over", width / 2, height / 3);
    textSize(subTextSize);
    fill(255);
    text(`Final Score: ${score}`, width / 2, height / 3 + titleSize);
    text(`Levels Completed: ${gameLevel - 1}`, width / 2, height / 3 + titleSize * 2);

    // Show restart button
    window.restartBtn.show();
}

function displayStats() {
    const padding = min(width, height) * 0.02;
    const fontSize = min(width, height) * 0.016;
    
    fill(255);
    textSize(fontSize);
    
    // Top left stats
    textAlign(LEFT, TOP);
    text(`Score: ${score}`, padding, padding);
    text(`Level: ${gameLevel}`, padding, padding + fontSize * 1.5);
    text(`Shield: ${Math.round(ship.shield)}`, padding, padding + fontSize * 3);
    text(`Bombs: ${bombs}`, padding, padding + fontSize * 4.5);


    
    // Bottom left text
    textAlign(LEFT, BOTTOM);
    text(`jeffhodgens.com`, padding, height - padding - fontSize * 2.5);
    text(`Asteroids are live transactions on the NANO blockchain.`, padding, height - padding - fontSize * 3.5);
    
}

function keyPressed() {
    if (keyCode === RIGHT_ARROW) {
        ship.setRotation(0.1);
    } else if (keyCode === LEFT_ARROW) {
        ship.setRotation(-0.1);
    } else if (keyCode === UP_ARROW) {
        ship.setBoosting(true);
    } else if (key === " ") {
        ship.shoot();
    }
}

function keyReleased() {
    if (keyCode === RIGHT_ARROW || keyCode === LEFT_ARROW) {
        ship.setRotation(0);
    } else if (keyCode === UP_ARROW) {
        ship.setBoosting(false);
    }
}

function initializeGame() {
    asteroids = [];
    shieldDrops = [];
    shotgunPowerUps = [];
    homingMissilePowerUps = [];
    for (let i = 0; i < gameLevel + 2; i++) {
        asteroids.push(new Asteroid(random(20, 50)));
    }
}
function levelCompleteScreen() {
    background(0);
    textAlign(CENTER, CENTER);
    fill(255);
    textSize(min(width, height) * 0.05);
    text(`Level ${gameLevel - 1} Complete!`, width / 2, height / 3);

    // Create the button only if it doesn't already exist
    if (!nextLevelBtn) {
        const buttonWidth = min(width, height) * 0.2;
        nextLevelBtn = createButton('Next Level');
        nextLevelBtn.class('game-button');
        nextLevelBtn.position(width / 2 - buttonWidth / 2, height / 2);
        nextLevelBtn.style('width', buttonWidth + 'px');
        nextLevelBtn.mousePressed(() => {
            startNextLevel();
        });
    }
}

function startNextLevel() {
    gameState = 'playing';
    bombs = 3; // Reset bombs
    initializeGame();

    // Remove the button and set it to null
    if (nextLevelBtn) {
        nextLevelBtn.remove();
        nextLevelBtn = null;
    }
}


function connectNanoWebSocket() {
    const socket = new WebSocket(WEBSOCKET_URL);

    socket.onopen = () => {
        console.log("Connected to Nano WebSocket");
        socket.send(JSON.stringify({ action: "subscribe", topic: "confirmation" }));
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.topic === "confirmation") {
            const transaction = data.message;
            addNanoAsteroid(transaction);
        }
    };

    socket.onerror = (error) => {
        console.error("WebSocket Error:", error);
    };

    socket.onclose = () => {
        console.log("Reconnecting to Nano WebSocket...");
        setTimeout(connectNanoWebSocket, 5000);
    };
}

function addNanoAsteroid(transaction) {
    const amount = parseNanoAmount(transaction.amount);
    const size = map(amount, 0.1, 10, 20, 50);
    asteroids.push(new Asteroid(size * (min(width, height) / 1000), transaction.hash, amount));
}

function parseNanoAmount(rawAmount) {
    const nanoAmount = BigInt(rawAmount) / BigInt(10 ** 30);
    const fraction = BigInt(rawAmount) % BigInt(10 ** 30);
    return Number(nanoAmount) + Number(fraction) / 10 ** 30;
}
class Ship {
    constructor() {
        this.pos = createVector(width / 2, height / 2);
        this.vel = createVector(0, 0);
        this.r = min(width, height) * 0.02; // Radius of the ship
        this.heading = 0;
        this.rotation = 0;
        this.boosting = false; // Whether the ship is boosting
        this.lasers = []; // Array to store lasers and missiles
        this.shield = 100; // Starting shield value
        this.alive = true; // Ship's alive status
        this.weapon = "laser"; // Default weapon type
        this.weaponTimer = 0; // Timer for weapon duration
        this.hasHammer = false; // Hammer power-up state
        this.hammerTimer = 0; // Timer for hammer duration
    }

    render() {
        push();
        translate(this.pos.x, this.pos.y);
        rotate(this.heading + PI / 2);
    
        // Render the ship as a triangle
        fill(0);
        stroke(255);
        strokeWeight(2);
        triangle(-this.r, this.r, this.r, this.r, 0, -this.r);
    
        // Thruster effect when boosting
        if (this.boosting) {
            stroke(255, 0, 0); // Red color for the thruster
            strokeWeight(2);
    
            // Thruster lines forming a cone in the downward direction
            const baseY = this.r; // Starting Y position at the base of the triangle
            const thrusterLength = this.r * random(0.8, 1.5); // Randomized length for dynamic effect
            const spread = this.r * 0.5; // Spread for cone effect
    
            // Left thruster line (angled inward toward center of cone)
            line(
                -this.r * 0.6, baseY, // Start point on the left base
                -spread, baseY + thrusterLength // End point angled inward
            );
    
            // Right thruster line (angled inward toward center of cone)
            line(
                this.r * 0.6, baseY, // Start point on the right base
                spread, baseY + thrusterLength // End point angled inward
            );
    
            // Center thruster line (straight down)
            line(
                0, baseY, // Start at the center of the base
                0, baseY + thrusterLength // Extend straight down
            );
        }
    
        pop();
    
        // Render all active lasers/missiles
        for (let laser of this.lasers) {
            laser.render();
        }
    }
    
    
    
    
    
    
    

    update() {
        if (this.boosting) {
            const force = p5.Vector.fromAngle(this.heading).mult(0.1);
            this.vel.add(force);
        }

        this.pos.add(this.vel);
        this.vel.mult(0.99);
        this.heading += this.rotation;

        // Handle weapon timer
        if (this.weapon !== "laser" && this.weaponTimer > 0) {
            this.weaponTimer--; // Decrease weapon timer
            if (this.weaponTimer <= 0) {
                this.weapon = "laser"; // Revert to default laser
            }
        }

        // Handle hammer timer
        if (this.hasHammer && this.hammerTimer > 0) {
            this.hammerTimer--; // Decrease hammer timer
            if (this.hammerTimer <= 0) {
                this.hasHammer = false; // Disable hammer when timer expires
            }
        }
    }

    setRotation(angle) {
        this.rotation = angle;
    }

    setBoosting(boost) {
        this.boosting = boost;
    }

    shoot() {
        if (this.weapon === "laser") {
            // Single laser
            const laserPos = p5.Vector.add(
                this.pos,
                p5.Vector.fromAngle(this.heading).mult(this.r)
            );
            this.lasers.push(new Laser(laserPos, this.heading));
        } else if (this.weapon === "shotgun") {
            // Shotgun blast: multiple lasers in a cone shape
            for (let angle = -0.3; angle <= 0.3; angle += 0.15) {
                const laserPos = p5.Vector.add(
                    this.pos,
                    p5.Vector.fromAngle(this.heading + angle).mult(this.r)
                );
                this.lasers.push(new Laser(laserPos, this.heading + angle));
            }
        } else if (this.weapon === "homing") {
            // Fire a homing missile
            const missilePos = p5.Vector.add(
                this.pos,
                p5.Vector.fromAngle(this.heading).mult(this.r)
            );
            this.lasers.push(new HomingMissile(missilePos, this.heading));
        }
    }

    activateHammer() {
        this.hasHammer = true; // Enable hammer shield
        this.hammerTimer = 420; // 7 seconds (60 FPS * 7 = 420 frames)
    }
    activateHomingMissile() {
        this.weapon = "homing"; // Switch to homing missile weapon
        this.weaponTimer = 420; // 7 seconds (60 FPS * 7 = 420 frames)
    }
    activateShotgun() {
    this.weapon = "shotgun"; // Switch to shotgun weapon
}

    

    checkCollisionsWithAsteroids(asteroids) {
        for (let i = asteroids.length - 1; i >= 0; i--) {
            const asteroid = asteroids[i];
            const distance = dist(this.pos.x, this.pos.y, asteroid.pos.x, asteroid.pos.y);
    
            // Check for collision with the ship itself
            if (distance < this.r + asteroid.size / 2) {
                if (this.hasHammer) {
                    // Destroy the asteroid
                    asteroid.explode();
                    asteroids.splice(i, 1);
                } else {
                    // Take damage if no hammer
                    this.takeDamage(asteroid.size);
                    asteroid.explode();
                    asteroids.splice(i, 1);
                }
            }
    
            // Check for collision with the hammer's aura
            if (this.hasHammer && distance < this.r * 3 + asteroid.size / 2) {
                // Destroy the asteroid
                asteroid.explode();
                asteroids.splice(i, 1);
            }
        }
    }
    

    takeDamage(size) {
        if (!this.hasHammer) {
            this.shield -= size;
            if (this.shield <= 0) {
                this.alive = false;
            }
        }
    }

    edges() {
        // Wrap the ship around screen edges
        if (this.pos.x > width + this.r) this.pos.x = -this.r;
        if (this.pos.x < -this.r) this.pos.x = width + this.r;
        if (this.pos.y > height + this.r) this.pos.y = -this.r;
        if (this.pos.y < -this.r) this.pos.y = height + this.r;
    }
}




function keyPressed() {
    if (keyCode === RIGHT_ARROW) {
        ship.setRotation(0.1);
    } else if (keyCode === LEFT_ARROW) {
        ship.setRotation(-0.1);
    } else if (keyCode === UP_ARROW) {
        ship.setBoosting(true);
    } else if (key === " ") {
        ship.shoot();
    } else if (key === "B" || key === "b") {
        useBomb();
    }
}

function useBomb() {
    if (bombs > 0 && gameState === 'playing') {
        bombs--;
        clearNearbyAsteroids();
    }
}

function clearNearbyAsteroids() {
    const bombRadius = min(width, height) * 0.5;
    for (let i = asteroids.length - 1; i >= 0; i--) {
        if (dist(ship.pos.x, ship.pos.y, asteroids[i].pos.x, asteroids[i].pos.y) < bombRadius) {
            score += Math.floor(50 / asteroids[i].size);
            asteroids[i].explode();
            asteroids.splice(i, 1);
        }
    }
}


class Laser {
    constructor(pos, heading) {
        this.pos = pos.copy();
        this.vel = p5.Vector.fromAngle(heading).mult(10);
        this.size = min(width, height) * 0.004;
        this.color = color(0, 255, 0);
    }

    update() {
        this.pos.add(this.vel);
    }

    render() {
        push();
        stroke(this.color);
        strokeWeight(this.size);
        point(this.pos.x, this.pos.y);
        strokeWeight(this.size/2);
        stroke(this.color.levels[0], this.color.levels[1], this.color.levels[2], 100);
        point(this.pos.x, this.pos.y);
        pop();
    }

    hits(asteroid) {
        const d = dist(this.pos.x, this.pos.y, asteroid.pos.x, asteroid.pos.y);
        return d < asteroid.size / 2;
    }

    offscreen() {
        return (
            this.pos.x < 0 || 
            this.pos.x > width || 
            this.pos.y < 0 || 
            this.pos.y > height
        );
    }
}

class Asteroid {
    constructor(size, hash = null, amount = null) {
        this.size = size * (min(width, height) / 1000);
        this.pos = createVector(random(width), random(height));
        this.vel = p5.Vector.random2D().mult(random(1, 3));
        this.hash = hash;
        this.amount = amount;
        
        while (ship && dist(this.pos.x, this.pos.y, ship.pos.x, ship.pos.y) < min(width, height) * 0.2) {
            this.pos = createVector(random(width), random(height));
        }
    }

    render() {
        push();
        translate(this.pos.x, this.pos.y);
        fill(0);
        stroke(255);
        ellipse(0, 0, this.size * 2);

        if (this.amount) {
            fill(255);
            const maxWidth = this.size * 1.5;
            let fontSize = min(width, height) * 0.012;
            textSize(fontSize);
            const displayText = `${this.amount.toFixed(2)} Nano`;
            let textW = textWidth(displayText);
            
            while (textW > maxWidth && fontSize > min(width, height) * 0.006) {
                fontSize--;
                textSize(fontSize);
                textW = textWidth(displayText);
            }
            
            textAlign(CENTER, CENTER);
            text(displayText, 0, 0);
        }
        pop();
    }

    update() {
        this.pos.add(this.vel);
    }

    edges() {
        if (this.pos.x > width + this.size) this.pos.x = -this.size;
        if (this.pos.x < -this.size) this.pos.x = width + this.size;
        if (this.pos.y > height + this.size) this.pos.y = -this.size;
        if (this.pos.y < -this.size) this.pos.y = height + this.size;
    }

    explode() {
        const debrisCount = Math.min(Math.floor(this.size), 10); // Limit debris count
        for (let i = 0; i < debrisCount; i++) {
            debris.push(new Debris(this.pos.copy(), true));
        }
    
        // Drop power-ups with reasonable probabilities
        if (random(1) < 0.1) {
            homingMissilePowerUps.push(new HomingMissilePowerUp(this.pos.copy()));
        }
        if (random(1) < 0.05) { // 5% chance to drop a hammer power-up
            hammerPowerUps.push(new HammerPowerUp(this.pos.copy()));
        }
        if (random(1) < 0.2) {
            shieldDrops.push(new ShieldDrop(this.pos.copy()));
        }
        if (random(1) < 0.1) {
            shotgunPowerUps.push(new ShotgunPowerUp(this.pos.copy()));
        }
    }
    
}    

class Debris {
    constructor(pos, isAsteroidDebris = true) {
        this.pos = pos.copy();
        this.vel = p5.Vector.random2D().mult(random(1, 6)); // Varied speed
        this.transparency = 255;
        this.size = random(1, 3) * (min(width, height) / 1200); // Small debris sizes
        this.rotation = random(TWO_PI);
        this.rotationSpeed = random(-0.15, 0.15); // Increased rotation variety
        
        // Determine color based on type of debris
        if (isAsteroidDebris) {
            const gradientPos = random(1);
            if (gradientPos < 0.33) {
                this.color = color(238, 130, 238); // Purple
            } else if (gradientPos < 0.66) {
                this.color = color(64, 224, 208); // Turquoise
            } else {
                this.color = color(0, 191, 255); // Deep Sky Blue
            }
        } else {
            const gradientPos = random(1);
            if (gradientPos < 0.33) {
                this.color = color(255, 0, 0); // Red
            } else if (gradientPos < 0.66) {
                this.color = color(255, 140, 0); // Orange
            } else {
                this.color = color(255, 215, 0); // Gold
            }
        }
    }

    update() {
        this.pos.add(this.vel);
        this.transparency -= 1.5; // Fade slower (reduce transparency by 1.5 per frame)
        this.size *= 0.995; // Shrink more slowly
    }

    render() {
        push();
        translate(this.pos.x, this.pos.y);
        rotate(this.rotation);
        fill(red(this.color), green(this.color), blue(this.color), this.transparency);
        noStroke();
        ellipse(0, 0, this.size); // Draw debris as small circles
        pop();
        
        this.rotation += this.rotationSpeed; // Apply rotation
    }

    isExpired() {
        return this.transparency <= 0 || this.size <= 0.5; // Remove debris if invisible or too small
    }
}

class ShieldDrop {
    constructor(pos) {
        this.pos = pos.copy();
        this.size = min(width, height) * 0.02; // Adjust size based on screen dimensions
        this.timer = 0; // Timer to track lifespan
        this.maxLifetime = 600; // 600 frames (10 seconds at 60 FPS)
        this.color = color(0, 255, 0); // Green for shields
        this.offsetX = random(1000); // Offset for Perlin noise
        this.offsetY = random(1000);
    }

    update(ship) {
        // Smoothly move using Perlin noise
        const noiseScale = 0.005; // Controls the smoothness of the motion
        const floatRange = 2; // Controls how far the shield moves
        this.pos.x += (noise(this.offsetX) - 0.5) * floatRange;
        this.pos.y += (noise(this.offsetY) - 0.5) * floatRange;

        // Increment Perlin noise offsets
        this.offsetX += noiseScale;
        this.offsetY += noiseScale;

        // Apply magnetic pull if ship is nearby
        const magnetRange = min(width, height) * 0.1; // Range within which magnetism works
        const distanceToShip = dist(this.pos.x, this.pos.y, ship.pos.x, ship.pos.y);
        if (distanceToShip < magnetRange) {
            const attractionForce = p5.Vector.sub(ship.pos, this.pos).mult(0.1); // Magnetic pull strength
            this.pos.add(attractionForce);
        }

        this.timer++; // Increment timer
    }

    render() {
        push();
        translate(this.pos.x, this.pos.y);
        fill(this.color);
        noStroke();
        ellipse(0, 0, this.size); // Draw as a circle
        pop();
    }

    isExpired() {
        return this.timer > this.maxLifetime; // Check if lifetime has elapsed
    }

    isCollected(ship) {
        return dist(this.pos.x, this.pos.y, ship.pos.x, ship.pos.y) < this.size / 2 + ship.r;
    }
}

class ShotgunPowerUp {
    constructor(pos) {
        this.pos = pos.copy();
        this.size = min(width, height) * 0.025; // Slightly larger than shield drops
        this.timer = 0; // Timer to track lifespan
        this.maxLifetime = 600; // 600 frames (10 seconds at 60 FPS)
        this.color = color(255, 165, 0); // Orange for shotgun power-up
        this.offsetX = random(1000); // Offset for Perlin noise
        this.offsetY = random(1000);
    }

    update(ship) {
        // Smoothly move using Perlin noise
        const noiseScale = 0.005; // Controls the smoothness of the motion
        const floatRange = 2; // Controls how far the power-up moves
        this.pos.x += (noise(this.offsetX) - 0.5) * floatRange;
        this.pos.y += (noise(this.offsetY) - 0.5) * floatRange;

        // Increment Perlin noise offsets
        this.offsetX += noiseScale;
        this.offsetY += noiseScale;

        // Apply magnetic pull if the ship is nearby
        const magnetRange = min(width, height) * 0.1; // Range within which magnetism works
        const distanceToShip = dist(this.pos.x, this.pos.y, ship.pos.x, ship.pos.y);
        if (distanceToShip < magnetRange) {
            const attractionForce = p5.Vector.sub(ship.pos, this.pos).mult(0.1); // Magnetic pull strength
            this.pos.add(attractionForce);
        }

        this.timer++; // Increment timer
    }

    render() {
        push();
        translate(this.pos.x, this.pos.y);
        fill(this.color);
        noStroke();
        ellipse(0, 0, this.size); // Draw as a circle
        pop();
    }

    isExpired() {
        return this.timer > this.maxLifetime; // Check if lifetime has elapsed
    }

    isCollected(ship) {
        return dist(this.pos.x, this.pos.y, ship.pos.x, ship.pos.y) < this.size / 2 + ship.r;
    }
}

class HomingMissilePowerUp {
    constructor(pos) {
        this.pos = pos.copy();
        this.size = min(width, height) * 0.03; // Slightly larger for visibility
        this.timer = 0; // Timer to track lifespan
        this.maxLifetime = 600; // 600 frames (10 seconds at 60 FPS)
        this.color = color(255, 0, 0); // Red for homing missile power-up
        this.offsetX = random(1000); // Offset for Perlin noise
        this.offsetY = random(1000);
    }

    update(ship) {
        // Smoothly move using Perlin noise
        const noiseScale = 0.005;
        const floatRange = 2;
        this.pos.x += (noise(this.offsetX) - 0.5) * floatRange;
        this.pos.y += (noise(this.offsetY) - 0.5) * floatRange;

        // Increment Perlin noise offsets
        this.offsetX += noiseScale;
        this.offsetY += noiseScale;

        // Apply magnetic pull if the ship is nearby
        const magnetRange = min(width, height) * 0.1;
        const distanceToShip = dist(this.pos.x, this.pos.y, ship.pos.x, ship.pos.y);
        if (distanceToShip < magnetRange) {
            const attractionForce = p5.Vector.sub(ship.pos, this.pos).mult(0.1);
            this.pos.add(attractionForce);
        }

        this.timer++;
    }

    render() {
        push();
        translate(this.pos.x, this.pos.y);
        fill(this.color);
        noStroke();
        ellipse(0, 0, this.size); // Draw as a circle
        pop();
    }

    isExpired() {
        return this.timer > this.maxLifetime; // Check if lifetime has elapsed
    }

    isCollected(ship) {
        return dist(this.pos.x, this.pos.y, ship.pos.x, ship.pos.y) < this.size / 2 + ship.r;
    }
}
class HomingMissile {
    constructor(pos, heading) {
        this.pos = pos.copy(); // Start position
        this.vel = p5.Vector.fromAngle(heading).mult(6); // Initial velocity
        this.target = null; // Target asteroid
        this.size = min(width, height) * 0.02; // Missile size
        this.speed = 4; // Speed for homing adjustments
        this.maxTrackingDistance = min(width, height) * 0.3; // Distance to consider targets
        this.color = color(255, 0, 0); // Missile color
    }

    findTarget(asteroids) {
        let closest = null;
        let closestDist = Infinity;

        for (const asteroid of asteroids) {
            const d = dist(this.pos.x, this.pos.y, asteroid.pos.x, asteroid.pos.y);
            if (d < closestDist && d <= this.maxTrackingDistance) {
                closestDist = d;
                closest = asteroid;
            }
        }

        this.target = closest || null; // Assign target or null
    }

    update(asteroids) {
        if (!this.target || !asteroids.includes(this.target)) {
            this.findTarget(asteroids); // Find target only if missing or invalid
        }

        if (this.target) {
            const direction = p5.Vector.sub(this.target.pos, this.pos).normalize();
            this.vel.lerp(direction.mult(this.speed), 0.1); // Adjust smoothly
        } else {
            this.vel = this.vel.normalize().mult(this.speed); // Continue straight
        }

        this.pos.add(this.vel);
    }

    render() {
        push();
        stroke(this.color);
        strokeWeight(2); // Thin red line
        line(
            this.pos.x,
            this.pos.y,
            this.pos.x - this.vel.x * 2,
            this.pos.y - this.vel.y * 2
        );
        pop();
    }

    hits(asteroid) {
        return (
            dist(this.pos.x, this.pos.y, asteroid.pos.x, asteroid.pos.y) <
            this.size / 2 + asteroid.size / 2
        );
    }

    offscreen() {
        return (
            this.pos.x < 0 || this.pos.x > width || this.pos.y < 0 || this.pos.y > height
        );
    }
}


class HammerPowerUp {
    constructor(pos) {
        this.pos = pos.copy();
        this.size = min(width, height) * 0.03; // Power-up size
        this.timer = 0; // Lifetime counter
        this.maxLifetime = 600; // 600 frames (10 seconds at 60 FPS)
        this.color = color(0, 0, 255); // Bright blue
        this.offsetX = random(1000); // Offset for Perlin noise
        this.offsetY = random(1000);
    }

    update(ship) {
        // Smooth floating motion using Perlin noise
        const noiseScale = 0.005;
        const floatRange = 2;
        this.pos.x += (noise(this.offsetX) - 0.5) * floatRange;
        this.pos.y += (noise(this.offsetY) - 0.5) * floatRange;

        // Increment Perlin noise offsets
        this.offsetX += noiseScale;
        this.offsetY += noiseScale;

        // Apply magnetic pull if the ship is nearby
        const magnetRange = min(width, height) * 0.1;
        const distanceToShip = dist(this.pos.x, this.pos.y, ship.pos.x, ship.pos.y);
        if (distanceToShip < magnetRange) {
            const attractionForce = p5.Vector.sub(ship.pos, this.pos).mult(0.1);
            this.pos.add(attractionForce);
        }

        this.timer++;
    }

    render() {
        push();
        translate(this.pos.x, this.pos.y);
        fill(this.color);
        noStroke();
        ellipse(0, 0, this.size); // Draw as a circle
        pop();
    }

    isExpired() {
        return this.timer > this.maxLifetime; // Check if lifetime has elapsed
    }

    isCollected(ship) {
        return dist(this.pos.x, this.pos.y, ship.pos.x, ship.pos.y) < this.size / 2 + ship.r;
    }
}













//I don't know what I am doing. game based on https://codepen.io/RON9999/pen/qwGRwR
