// Game State
const gameState = {
    lobitos: [],
    trees: [],
    beds: [],
    wood: 0,
    selectedLobitos: [],
    clickTarget: null
};

// Limites de entidades y coste de construccion (evita crecimiento infinito)
const MAX_LOBITOS = 50;
const MAX_TREES = 15;
const MAX_BEDS = 10;
const BED_COST = 3; // maderas necesarias para construir una cama

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Lobito Class
class Lobito {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.hp = 10;
        this.maxHp = 10;
        this.tier = 1;
        this.targetX = x;
        this.targetY = y;
        this.speed = 2;
        this.attackAnimation = 0;
        this.isAttacking = false;
        this.id = Date.now() + Math.random();
    }
    
    update() {
        // Movement towards target
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) {
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }
        
        // Attack animation
        if (this.isAttacking) {
            this.attackAnimation += 0.2;
            if (this.attackAnimation >= Math.PI) {
                this.attackAnimation = 0;
                this.isAttacking = false;
            }
        }
    }
    
    draw() {
        // Body (white circle)
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Attack animation (stretching)
        if (this.isAttacking) {
            const stretch = Math.sin(this.attackAnimation) * 8;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.ellipse(
                this.x + stretch, 
                this.y, 
                this.radius + stretch, 
                this.radius - stretch/2, 
                0, 0, Math.PI * 2
            );
            ctx.fill();
        }
        
        // HP Bar
        const barWidth = 30;
        const barHeight = 4;
        const hpPercent = this.hp / this.maxHp;
        
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - barWidth/2, this.y - this.radius - 10, barWidth, barHeight);
        
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(this.x - barWidth/2, this.y - this.radius - 10, barWidth * hpPercent, barHeight);
        
        // Tier number
        ctx.fillStyle = 'black';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.tier, this.x, this.y + 4);
    }
    
    attack() {
        this.isAttacking = true;
        this.attackAnimation = 0;
    }
    
    heal(amount) {
        this.hp = Math.min(this.hp + amount, this.maxHp);
    }
}

// Tree Class
class Tree {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 25;
        this.clicks = 0;
        this.maxClicks = 3;
    }
    
    draw() {
        // Trunk
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(this.x - 5, this.y, 10, 30);
        
        // Leaves
        ctx.fillStyle = '#228B22';
        ctx.beginPath();
        ctx.arc(this.x, this.y - 10, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Click progress indicator
        if (this.clicks > 0) {
            ctx.fillStyle = 'yellow';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${this.clicks}/${this.maxClicks}`, this.x, this.y - 30);
        }
    }
    
    handleClick(x, y) {
        // Hitbox corregida: la copa es un circulo Y el tronco es un rectangulo.
        // Antes solo se contaba la copa circular, por lo que clics visibles
        // en el tronco no hacian nada.
        const inCanopy = Math.sqrt((x - this.x) ** 2 + ((y - (this.y - 10)) ** 2)) <= this.radius;
        const inTrunk = (x >= this.x - 5 && x <= this.x + 5 &&
                         y >= this.y && y <= this.y + 30);
        if (inCanopy || inTrunk) {
            this.clicks++;
            if (this.clicks >= this.maxClicks) {
                return true; // Tree destroyed
            }
            return false;
        }
        return false;
    }
}

// Bed Class
class Bed {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 20;
        this.lastHealTime = 0;
        this.healInterval = 200; // 0.2 seconds
    }
    
    update() {
        const now = Date.now();
        if (now - this.lastHealTime >= this.healInterval) {
            // Heal nearby lobitos
            gameState.lobitos.forEach(lobito => {
                const distance = Math.sqrt(
                    (lobito.x - this.x) ** 2 + 
                    (lobito.y - this.y) ** 2
                );
                if (distance < 60) {
                    lobito.heal(1);
                }
            });
            this.lastHealTime = now;
        }
    }
    
    draw() {
        // Bed frame
        ctx.fillStyle = '#DEB887';
        ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        
        // Mattress
        ctx.fillStyle = 'white';
        ctx.fillRect(this.x - this.width/2 + 3, this.y - this.height/2 + 3, this.width - 6, this.height - 6);
        
        // Healing aura
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 60, 0, Math.PI * 2);
        ctx.stroke();
    }
}

// Flask interaction
document.getElementById('flask').addEventListener('click', function() {
    spawnLobito();
});

function spawnLobito() {
    if (gameState.lobitos.length >= MAX_LOBITOS) return; // limite de entidades
    const x = Math.random() * (canvas.width - 100) + 50;
    const y = Math.random() * (canvas.height - 100) + 50;
    const lobito = new Lobito(x, y);
    gameState.lobitos.push(lobito);
    updateUI();
}

// Tree spawning
function spawnTree() {
    if (gameState.trees.length >= MAX_TREES) return; // limite de entidades
    const x = Math.random() * (canvas.width - 100) + 50;
    const y = Math.random() * (canvas.height - 100) + 50;
    const tree = new Tree(x, y);
    gameState.trees.push(tree);
}

// Initial tree spawns
for (let i = 0; i < 5; i++) {
    spawnTree();
}

// Spawn trees periodically (solo mientras haya lobitos, para no acumular madera infinita)
setInterval(() => {
    if (gameState.lobitos.length > 0) spawnTree();
}, 10000); // New tree every 10 seconds

// Canvas click handler (logica tipo RTS: seleccionar / mover / deseleccionar)
canvas.addEventListener('click', function(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 1) Check tree clicks first
    for (let i = gameState.trees.length - 1; i >= 0; i--) {
        const tree = gameState.trees[i];
        if (tree.handleClick(x, y)) {
            gameState.trees.splice(i, 1);
            gameState.wood += 3;
            updateUI(); // ya NO construye una cama automatica: el jugador decide
            return;
        }
    }

    // 2) Clic sobre un lobito -> seleccionarlo (antes solo se podia con Ctrl/Shift)
    let clickedLobito = null;
    for (const lobito of gameState.lobitos) {
        const d = Math.sqrt((lobito.x - x) ** 2 + (lobito.y - y) ** 2);
        if (d <= lobito.radius + 5) { clickedLobito = lobito; break; }
    }

    if (clickedLobito) {
        if (e.ctrlKey || e.shiftKey) {
            // Seleccion multiple: alternar sin limpiar las demas
            const index = gameState.selectedLobitos.indexOf(clickedLobito);
            if (index > -1) {
                gameState.selectedLobitos.splice(index, 1);
            } else {
                gameState.selectedLobitos.push(clickedLobito);
            }
        } else {
            // Clic simple: reemplaza la seleccion
            gameState.selectedLobitos = [clickedLobito];
        }
        return;
    }

    // 3) Clic en zona vacia: orden de movimiento a los seleccionados.
    //    Si no hay seleccionados, DESELECCIONA (movia a todos por error).
    if (gameState.selectedLobitos.length > 0) {
        gameState.selectedLobitos.forEach(lobito => {
            lobito.targetX = x;
            lobito.targetY = y;
        });
    } else {
        gameState.selectedLobitos = []; // limpieza de referencias obsoletas
    }
});

// Construccion MANUAL de camas (el jugador decide cuando y gasta 3 maderas)
document.getElementById('bed-btn').addEventListener('click', craftBed);

function craftBed() {
    if (gameState.wood >= BED_COST && gameState.beds.length < MAX_BEDS) {
        gameState.wood -= BED_COST;
        const x = Math.random() * (canvas.width - 100) + 50;
        const y = Math.random() * (canvas.height - 100) + 50;
        const bed = new Bed(x, y);
        gameState.beds.push(bed);
        updateUI();
    }
}

function updateUI() {
    document.getElementById('lobito-count').textContent = gameState.lobitos.length;
    document.getElementById('wood-count').textContent = gameState.wood;
    document.getElementById('bed-count').textContent = gameState.beds.length;

    // Habilitar/deshabilitar el boton de cama segun recursos y limite
    const bedBtn = document.getElementById('bed-btn');
    bedBtn.disabled = !(gameState.wood >= BED_COST && gameState.beds.length < MAX_BEDS);
}

// Game loop
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw beds
    gameState.beds.forEach(bed => {
        bed.update();
        bed.draw();
    });
    
    // Draw trees
    gameState.trees.forEach(tree => tree.draw());
    
    // Update and draw lobitos
    gameState.lobitos.forEach(lobito => {
        lobito.update();
        lobito.draw();
    });
    
    // Draw selection indicators
    gameState.selectedLobitos.forEach(lobito => {
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(lobito.x, lobito.y, lobito.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
    });
    
    requestAnimationFrame(gameLoop);
}

// Start game
gameLoop();
