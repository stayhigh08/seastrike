document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const playerGrid = document.getElementById('player-grid');
    const computerGrid = document.getElementById('computer-grid');
    const shipSelectionContainer = document.getElementById('ship-selection');
    const rotateButton = document.getElementById('rotate-button');
    const startButton = document.getElementById('start-button');
    const gameStatus = document.getElementById('game-status');
    const gameStatusText = document.querySelector('#game-status span');
    const popupMessage = document.getElementById('popup-message');
    const powerUpsContainer = document.getElementById('power-ups-container');
    const clusterCountSpan = document.getElementById('cluster-count');
    const radarCountSpan = document.getElementById('radar-count');
    const mobileToggleButton = document.getElementById('mobile-toggle');
    const shipSelectionBox = document.getElementById('ship-selection-container');
    const actionButtonsBox = document.getElementById('action-buttons-container');
    const playAgainButton = document.getElementById('play-again-button');
    const enemyShipsTracker = document.getElementById('enemy-ships-tracker');
    const enemyShipList = document.getElementById('enemy-ship-list');

    // --- Game State ---
    const gridSize = 9; 
    const shipTemplates = [
        { name: 'carrier', size: 5 }, 
        { name: 'battleship', size: 4 }, 
        { name: 'cruiser', size: 3 }, 
        { name: 'cruiser', size: 3 },
        { name: 'destroyer', size: 2 },
        { name: 'destroyer', size: 2 }
    ];
    
    let totalShipSquares, totalWaterSquares;
    let gameState, orientation, selectedShip, playerShips, computerShips;
    
    const MOBILE_BREAKPOINT = 900;
    let isMobileView = window.innerWidth <= MOBILE_BREAKPOINT;
    
    let selectedAbility, clusterBombs, radarScans;
    let computerClusterBombs, computerRadarScans, aiMode, aiTargetQueue, aiKnownHits;
    
    let isPlayerAttacking = false;
    let typewriterInterval;

    function typewriterEffect(element, text, speed = 50) {
        clearInterval(typewriterInterval);
        element.textContent = '';
        let i = 0;
        typewriterInterval = setInterval(() => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
            } else {
                clearInterval(typewriterInterval);
            }
        }, speed);
    }

    function updateGameProgress() {
        const missedCells = document.querySelectorAll('.grid .miss').length;
        const progressPercentage = (missedCells / totalWaterSquares) * 100;
        gameStatus.style.setProperty('--progress-width', `${progressPercentage}%`);
    }

    function setGameState(newState) {
        document.body.className = '';
        document.body.classList.add(`gamestate-${newState.toLowerCase()}`);
        gameState = newState;
    }

    function createGrid(gridElement) { 
        gridElement.innerHTML = '';
        for (let i = 0; i < gridSize * gridSize; i++) { 
            const cell = document.createElement('div'); 
            cell.classList.add('cell'); 
            cell.dataset.id = i; 
            gridElement.appendChild(cell); 
        } 
    }

    function initializeGame() {
        orientation = 'horizontal';
        selectedShip = null;
        playerShips = [];
        computerShips = [];
        selectedAbility = 'torpedo';
        clusterBombs = 3;
        radarScans = 2;
        computerClusterBombs = 3;
        computerRadarScans = 2;
        aiMode = 'HUNT';
        aiTargetQueue = [];
        aiKnownHits = [];

        totalShipSquares = shipTemplates.reduce((sum, ship) => sum + ship.size, 0) * 2;
        totalWaterSquares = (gridSize * gridSize * 2) - totalShipSquares;

        createGrid(playerGrid); 
        createGrid(computerGrid);
        
        playerGrid.addEventListener('mouseover', handlePlayerGridMouseover);
        playerGrid.addEventListener('mouseout', handlePlayerGridMouseout);
        playerGrid.addEventListener('click', handleGridClick);
        computerGrid.addEventListener('click', handleGridClick);
        computerGrid.addEventListener('mouseover', handleComputerGridMouseover);
        computerGrid.addEventListener('mouseout', handleComputerGridMouseout);

        setGameState('SETUP');
        populateShipSelection();
        populateEnemyTracker();
        
        const firstShip = shipSelectionContainer.querySelector('.ship:not(.placed)');
        if (firstShip) firstShip.click();
        
        updateAbilityCount('cluster', clusterBombs);
        updateAbilityCount('radar', radarScans);
        
        document.querySelectorAll('.power-up').forEach(p => p.disabled = false);
        document.querySelector("[data-ability='torpedo']").classList.add('selected');

        shipSelectionBox.classList.remove('hidden');
        actionButtonsBox.classList.remove('hidden');
        powerUpsContainer.classList.add('hidden');
        playAgainButton.classList.add('hidden');
        enemyShipsTracker.classList.add('hidden');

        updateGameProgress();
    }

    rotateButton.addEventListener('click', () => {
        orientation = orientation === 'horizontal' ? 'vertical' : 'horizontal';
        document.querySelector('#ship-selection .ship.selected')?.classList.toggle('vertical', orientation === 'vertical');
    });

    startButton.addEventListener('click', startGame);
    powerUpsContainer.addEventListener('click', handleAbilityClick);
    
    playAgainButton.addEventListener('click', () => {
        location.reload();
    });
    
    window.addEventListener('resize', handleResize);
    mobileToggleButton.addEventListener('click', toggleMobileView);

    initializeGame();
    handleResize();

    function startGame() {
        if (playerShips.length !== shipTemplates.length) { alert('Please place all your ships first!'); return; }
        document.body.classList.add('all-ships-placed');
        placeComputerShips();
        setGameState('PLAYER_TURN');
        typewriterEffect(gameStatusText, 'Your Turn!');
        shipSelectionBox.classList.add('hidden');
        actionButtonsBox.classList.add('hidden');
        powerUpsContainer.classList.remove('hidden');
        enemyShipsTracker.classList.remove('hidden');
        document.querySelector("[data-ability='torpedo']").classList.add('selected');
        updateToggleButton();
    }

    function switchTurn(delay = 2500) {
        const isPlayerTurnNow = gameState === 'PLAYER_TURN';
        setTimeout(() => {
            document.body.classList.remove('view-override');
            if (isPlayerTurnNow) {
                setGameState('COMPUTER_TURN');
                typewriterEffect(gameStatusText, "Computer's Turn...");
                updateToggleButton();
                setTimeout(computerTurn, 1000);
            } else {
                setGameState('PLAYER_TURN');
                typewriterEffect(gameStatusText, 'Your Turn!');
                const clusterButton = document.querySelector("[data-ability='cluster']");
                if (clusterBombs > 0) {
                    clusterButton.disabled = false;
                }
                updateToggleButton();
                isPlayerAttacking = false;
            }
        }, delay);
    }
    
    function updateToggleButton() {
        const isOverridden = document.body.classList.contains('view-override');
        if (!isMobileView || gameState === 'SETUP' || gameState === 'GAMEOVER') {
            mobileToggleButton.classList.add('hidden');
            return;
        }
        mobileToggleButton.classList.remove('hidden');

        const showingPlayerBoard = (gameState === 'COMPUTER_TURN' && !isOverridden) || (gameState === 'PLAYER_TURN' && isOverridden);
        if (showingPlayerBoard) {
            mobileToggleButton.textContent = 'Enemy Waters';
        } else {
            mobileToggleButton.textContent = 'Your Fleet';
        }
    }

    function toggleMobileView() {
        document.body.classList.toggle('view-override');
        updateToggleButton();
    }

    function handleResize() {
        isMobileView = window.innerWidth <= MOBILE_BREAKPOINT;
        if (!isMobileView) {
            document.body.classList.remove('view-override');
        }
        updateToggleButton();
    }

    function handleGridClick(e) {
        const clickedCell = e.target.closest('.cell');
        if (!clickedCell || isPlayerAttacking) return;
        if (gameState === 'SETUP' && clickedCell.parentElement.id === 'player-grid') {
            placeShip(clickedCell);
        } else if (gameState === 'PLAYER_TURN' && clickedCell.parentElement.id === 'computer-grid') {
            handlePlayerAttack(clickedCell);
        }
    }

    // --- MODIFICATION: Hover effect is now disabled on mobile ---
    function handlePlayerGridMouseover(e) {
        if (isMobileView) return;
        const cell = e.target.closest('.cell');
        if (gameState !== 'SETUP' || !selectedShip || !cell) return;
        const startId = parseInt(cell.dataset.id);
        const { cells, isValid } = getShipCells(startId, selectedShip.size, orientation);
        const isTaken = cells.some(id => playerGrid.querySelector(`[data-id='${id}']`)?.classList.contains('ship-placed'));

        cells.forEach(id => {
            const cellEl = playerGrid.querySelector(`[data-id='${id}']`);
            if (cellEl) {
                if (isValid && !isTaken) {
                    cellEl.classList.add('hover-valid');
                } else {
                    cellEl.classList.add('hover-invalid');
                }
            }
        });
    }

    function handlePlayerGridMouseout() {
        if (isMobileView) return;
        document.querySelectorAll('#player-grid .cell').forEach(c => c.classList.remove('hover-valid', 'hover-invalid'));
    }

    function handleComputerGridMouseover(e) {
        if (isMobileView) return;
        const cell = e.target.closest('.cell');
        if (gameState !== 'PLAYER_TURN' || selectedAbility !== 'cluster' || !cell) return;
        const centerId = parseInt(cell.dataset.id);
        if (isClusterAttackValid(centerId, computerGrid)) {
            getClusterCells(centerId).forEach(id => {
                const targetCell = computerGrid.querySelector(`[data-id='${id}']`);
                if (targetCell) targetCell.classList.add('hover-cluster');
            });
        } else {
            cell.classList.add('hover-invalid');
        }
    }
    
    function handleComputerGridMouseout() {
        if (isMobileView) return;
        document.querySelectorAll('#computer-grid .cell').forEach(c => c.classList.remove('hover-invalid', 'hover-cluster'));
    }

    function populateShipSelection() {
        shipSelectionContainer.innerHTML = '';
        typewriterEffect(gameStatusText, 'Place your first ship');

        shipTemplates.forEach((shipInfo, index) => {
            const shipDiv = document.createElement('div');
            shipDiv.classList.add('ship');
            shipDiv.dataset.id = index;
            shipDiv.dataset.name = shipInfo.name;
            for (let i = 0; i < shipInfo.size; i++) {
                shipDiv.appendChild(document.createElement('div')).classList.add('ship-segment');
            }
            
            shipDiv.addEventListener('click', (e) => {
                if (shipDiv.classList.contains('placed')) return;

                document.querySelectorAll('.ship').forEach(s => { 
                    s.classList.remove('selected'); 
                    s.classList.remove('vertical');
                });
                
                e.currentTarget.classList.add('selected');
                if (orientation === 'vertical') e.currentTarget.classList.add('vertical');

                selectedShip = { ...shipInfo, id: index };
                
                const shipDisplayName = shipInfo.name.charAt(0).toUpperCase() + shipInfo.name.slice(1);
                typewriterEffect(gameStatusText, `Place your ${shipDisplayName}`);
            });
            shipSelectionContainer.appendChild(shipDiv);
        });
    }
    
    function populateEnemyTracker() {
        enemyShipList.innerHTML = '';
        const uniqueShipTypes = [...new Map(shipTemplates.map(item => [item.name, item])).values()];
        
        uniqueShipTypes.forEach(shipInfo => {
            const shipCount = shipTemplates.filter(s => s.name === shipInfo.name).length;
            for(let i = 0; i < shipCount; i++) {
                const shipIndicator = document.createElement('div');
                shipIndicator.classList.add('enemy-ship-indicator');
                shipIndicator.id = `tracker-${shipInfo.name}-${i}`;
                for(let j = 0; j < shipInfo.size; j++) {
                    const segment = document.createElement('div');
                    segment.classList.add('enemy-ship-segment');
                    shipIndicator.appendChild(segment);
                }
                enemyShipList.appendChild(shipIndicator);
            }
        });
    }

    function placeShip(cell) {
        if (!selectedShip) return;
        const startId = parseInt(cell.dataset.id);
        const { cells, isValid } = getShipCells(startId, selectedShip.size, orientation);
        const isTaken = cells.some(id => playerGrid.querySelector(`[data-id='${id}']`)?.classList.contains('ship-placed'));
        
        if (isValid && !isTaken) {
            cells.forEach(id => playerGrid.querySelector(`[data-id='${id}']`).classList.add('ship-placed'));
            
            const shipCount = playerShips.filter(s => s.name === selectedShip.name).length;
            playerShips.push({ name: selectedShip.name, id: `${selectedShip.name}-${shipCount}`, cells, hits: [] });
            
            const placedShipEl = shipSelectionContainer.querySelector(`[data-id='${selectedShip.id}']`);
            if(placedShipEl) placedShipEl.classList.add('placed');

            selectedShip = null;

            const nextShipElement = shipSelectionContainer.querySelector('.ship:not(.placed)');
            if (nextShipElement) {
                nextShipElement.click();
            } else {
                typewriterEffect(gameStatusText, "Your fleet is ready!");
            }
        }
    }

    function handleAbilityClick(e) {
        const button = e.target.closest('.power-up');
        if (!button || button.disabled) return;
        
        const ability = button.dataset.ability;
        
        if (ability === 'radar') {
            handleRadarScan();
            return;
        }

        selectedAbility = ability;
        document.querySelectorAll('.power-up').forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');
    }

    function handlePlayerAttack(cell) {
        if (cell.classList.contains('hit') || cell.classList.contains('miss')) return;
        if (selectedAbility === 'cluster') {
            const centerId = parseInt(cell.dataset.id);
            if (!isClusterAttackValid(centerId, computerGrid)) {
                return; 
            }
        }
        isPlayerAttacking = true;
        if (selectedAbility === 'torpedo') {
            handleTorpedoAttack(cell);
        } else if (selectedAbility === 'cluster') {
            handleClusterAttack(cell);
        }
    }

    function handleTorpedoAttack(cell) {
        const cellId = parseInt(cell.dataset.id);
        const { hit, sunkShip } = checkAttack(computerShips, cellId);
        if (hit) {
            cell.classList.add('hit');
            showPopup("HIT!", "var(--hit-color-light)");
            if (sunkShip) {
                typewriterEffect(gameStatusText, `You sunk their ${sunkShip.name}!`);
                animateSinking(sunkShip, computerGrid);
                if (checkWinCondition()) return;
                switchTurn(3500);
            } else {
                typewriterEffect(gameStatusText, 'Go again!');
                isPlayerAttacking = false;
            }
        } else {
            cell.classList.add('miss');
            showPopup("MISS", "var(--miss-color)");
            switchTurn();
        }
        updateGameProgress();
    }

    function handleClusterAttack(cell) {
        if (clusterBombs <= 0) { isPlayerAttacking = false; return; }
        clusterBombs--;
        updateAbilityCount('cluster', clusterBombs);
        const centerId = parseInt(cell.dataset.id);
        let anyHit = false;
        let shipsSunkInAttack = 0;

        getClusterCells(centerId).forEach((id, index) => {
            setTimeout(() => {
                const targetCell = computerGrid.querySelector(`[data-id='${id}']`);
                if (targetCell && !targetCell.classList.contains('hit') && !targetCell.classList.contains('miss')) {
                    const { hit, sunkShip } = checkAttack(computerShips, id);
                    targetCell.classList.add(hit ? "hit" : "miss");
                    if (hit) anyHit = true;
                    if (sunkShip) {
                        shipsSunkInAttack++;
                        animateSinking(sunkShip, computerGrid);
                    }
                }
            }, index * 100);
        });

        setTimeout(() => {
            updateGameProgress();
            if (checkWinCondition()) return;
            if (shipsSunkInAttack > 0) {
                typewriterEffect(gameStatusText, `You sunk ${shipsSunkInAttack} ship(s)!`);
                switchTurn();
            } else if (anyHit) {
                typewriterEffect(gameStatusText, 'Cluster bomb hit! Go again.');
                isPlayerAttacking = false;
            } else {
                showPopup("MISS", "var(--miss-color)");
                switchTurn();
            }
        }, 1200);
    }
    
    function handleRadarScan() {
        if (radarScans <= 0) return;
        radarScans--;
        updateAbilityCount('radar', radarScans);

        document.querySelector("[data-ability='torpedo']").click();
        document.querySelector("[data-ability='cluster']").disabled = true;

        const sweepOverlay = document.querySelector('#computer-board-container .radar-sweep');
        const newSweepOverlay = sweepOverlay.cloneNode(true);
        sweepOverlay.parentNode.replaceChild(newSweepOverlay, sweepOverlay);

        newSweepOverlay.classList.add('active');
        setTimeout(() => {
            newSweepOverlay.classList.remove('active');
        }, 2000);

        const unhitEnemyCells = computerShips
            .flatMap(ship => ship.cells)
            .filter(cellId => {
                const cell = computerGrid.querySelector(`[data-id='${cellId}']`);
                return cell && !cell.classList.contains('hit');
            });

        if (unhitEnemyCells.length > 0) {
            const randomCellId = unhitEnemyCells[Math.floor(Math.random() * unhitEnemyCells.length)];
            const cellToReveal = computerGrid.querySelector(`[data-id='${randomCellId}']`);
            if (cellToReveal) {
                setTimeout(() => {
                    cellToReveal.classList.add('radar-reveal');
                    setTimeout(() => {
                        cellToReveal.classList.remove('radar-reveal');
                    }, 2000);
                }, 500);
            }
        }
    }

    function updateAbilityCount(ability, count) {
        const span = ability === 'cluster' ? clusterCountSpan : radarCountSpan;
        const button = span.closest('.power-up');
        span.textContent = count;
        if (count === 0) {
            button.disabled = true;
            if (selectedAbility === ability) {
                document.querySelector("[data-ability='torpedo']").click();
            }
        }
    }

    function handleComputerTorpedoAttack() {
        let targetId;
        if (aiMode === "TARGET" && aiTargetQueue.length > 0) {
            targetId = aiTargetQueue.shift();
        } else {
            aiMode = "HUNT";
            let randomId;
            do {
                randomId = Math.floor(Math.random() * gridSize * gridSize);
            } while (playerGrid.querySelector(`[data-id='${randomId}']`).classList.contains("hit") || playerGrid.querySelector(`[data-id='${randomId}']`).classList.contains("miss"));
            targetId = randomId;
        }
        const targetCell = playerGrid.querySelector(`[data-id='${targetId}']`);
        const { hit, sunkShip } = checkAttack(playerShips, targetId);
        if (hit) {
            targetCell.classList.add("hit");
            showPopup("HIT!", "var(--hit-color-light)");
            if (sunkShip) {
                typewriterEffect(gameStatusText, `They sunk your ${sunkShip.name}!`);
                aiMode = "HUNT"; aiTargetQueue = []; aiKnownHits = [];
                animateSinking(sunkShip, playerGrid);
                if (checkWinCondition()) return;
                switchTurn(3500);
            } else {
                typewriterEffect(gameStatusText, "Computer hit! It goes again.");
                aiMode = "TARGET";
                aiKnownHits.push(targetId);
                updateAiTargetQueue();
                setTimeout(computerTurn, 1200);
            }
        } else {
            targetCell.classList.add("miss");
            showPopup("MISS", "var(--miss-color)");
            switchTurn();
        }
        updateGameProgress();
    }

    function computerTurn() {
        if (gameState !== 'COMPUTER_TURN') return;

        let primaryAction = 'torpedo';
        if (aiMode === 'HUNT' && computerRadarScans > 0 && Math.random() < 0.15) {
            primaryAction = 'radar';
        } else if (aiMode === 'HUNT' && computerClusterBombs > 0 && Math.random() < 0.25) {
            primaryAction = 'cluster';
        }

        if (primaryAction === 'radar') {
            typewriterEffect(gameStatusText, "Computer uses Radar Scan!");
            computerRadarScans--;
            const unhitPlayerCells = playerShips.flatMap(ship => ship.cells).filter(cellId => !playerGrid.querySelector(`[data-id='${cellId}']`).classList.contains('hit'));
            if (unhitPlayerCells.length > 0) {
                const randomCellId = unhitPlayerCells[Math.floor(Math.random() * unhitPlayerCells.length)];
                const cellToReveal = playerGrid.querySelector(`[data-id='${randomCellId}']`);
                if (cellToReveal) {
                    cellToReveal.classList.add('radar-reveal');
                    setTimeout(() => cellToReveal.classList.remove('radar-reveal'), 2000);
                }
            }
            setTimeout(handleComputerTorpedoAttack, 1200);
        } else if (primaryAction === 'cluster') {
            handleComputerClusterAttack();
        } else {
            handleComputerTorpedoAttack();
        }
    }

    function updateAiTargetQueue() {
        aiTargetQueue = [];
        let potentialTargets = new Set();
        if (aiKnownHits.length === 1) {
            const hit = aiKnownHits[0];
            [hit - 1, hit + 1, hit - gridSize, hit + gridSize].forEach(id => potentialTargets.add(id));
        } else {
            aiKnownHits.sort((a, b) => a - b);
            const firstHit = aiKnownHits[0];
            const lastHit = aiKnownHits[aiKnownHits.length - 1];
            if (lastHit - firstHit < gridSize) { 
                potentialTargets.add(lastHit + 1); potentialTargets.add(firstHit - 1);
            } else {
                potentialTargets.add(lastHit + gridSize); potentialTargets.add(firstHit - gridSize);
            }
        }
        aiTargetQueue = [...potentialTargets].filter(id => {
            if (id < 0 || id >= gridSize * gridSize) return false;
            const row = Math.floor(id / gridSize);
            const col = id % gridSize;
            const lastHit = aiKnownHits[aiKnownHits.length - 1];
            const lastRow = Math.floor(lastHit / gridSize);
            const lastCol = lastHit % gridSize;
            if (aiKnownHits.length > 1 && (lastHit - aiKnownHits[0] < gridSize)) {
                if (row !== lastRow) return false;
            }
            if (aiKnownHits.length > 1 && (lastHit - aiKnownHits[0] >= gridSize)) {
                if (col !== lastCol) return false;
            }
            const cell = playerGrid.querySelector(`[data-id='${id}']`);
            return cell && !cell.classList.contains("hit") && !cell.classList.contains("miss");
        });
    }

    function handleComputerClusterAttack() {
        typewriterEffect(gameStatusText, "Computer uses a Cluster Bomb!");
        computerClusterBombs--;
        let centerId;
        do { centerId = Math.floor(Math.random() * gridSize * gridSize); } while (!isClusterAttackValid(centerId, playerGrid));
        let anyHit = false, clusterHits = [], shipsSunkInAttack = 0;
        getClusterCells(centerId).forEach((id, index) => {
            setTimeout(() => {
                const targetCell = playerGrid.querySelector(`[data-id='${id}']`);
                if (targetCell && !targetCell.classList.contains("hit") && !targetCell.classList.contains("miss")) {
                    const { hit, sunkShip } = checkAttack(playerShips, id);
                    targetCell.classList.add(hit ? "hit" : "miss");
                    if (hit) { anyHit = true; clusterHits.push(id); }
                    if (sunkShip) {
                        shipsSunkInAttack++;
                        animateSinking(sunkShip, playerGrid);
                        aiMode = "HUNT"; aiTargetQueue = []; aiKnownHits = [];
                    }
                }
            }, 150 * index);
        });
        setTimeout(() => {
            updateGameProgress();
            if (checkWinCondition()) return;
            if (shipsSunkInAttack > 0) {
                typewriterEffect(gameStatusText, `Computer sunk your ship(s)!`);
                switchTurn();
            } else if (anyHit) {
                aiKnownHits.push(...clusterHits.filter(h => !aiKnownHits.includes(h)));
                aiMode = "TARGET";
                updateAiTargetQueue();
                typewriterEffect(gameStatusText, 'Computer cluster hit! It goes again.');
                setTimeout(computerTurn, 1200);
            } else {
                switchTurn();
            }
        }, 1500);
    }

    function animateSinking(sunkShip, gridElement) {
        if (gridElement.id === 'computer-grid') {
             document.getElementById(`tracker-${sunkShip.id}`).classList.add('sunk');
        }
        
        sunkShip.cells.forEach((cellId, index) => {
            setTimeout(() => {
                const cell = gridElement.querySelector(`[data-id='${cellId}']`);
                if (cell) {
                    cell.classList.add('sunk', 'explode');
                    setTimeout(() => { cell.classList.remove('explode'); }, 500);
                }
            }, index * 100);
        });
    }

    function placeComputerShips() {
        shipTemplates.forEach(shipInfo => {
            let placed = false;
            while (!placed) {
                const randomOrientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
                const randomStartId = Math.floor(Math.random() * gridSize * gridSize);
                const { cells, isValid } = getShipCells(randomStartId, shipInfo.size, randomOrientation);
                const isTaken = cells.some(id => computerShips.flatMap(s => s.cells).includes(id));
                if (isValid && !isTaken) {
                    const shipCount = computerShips.filter(s => s.name === shipInfo.name).length;
                    computerShips.push({ name: shipInfo.name, id: `${shipInfo.name}-${shipCount}`, cells, hits: [] });
                    placed = true;
                }
            }
        });
    }

    function checkAttack(ships, cellId) {
        let hit = false, sunkShip = null;
        for (const ship of ships) {
            if (ship.cells.includes(cellId) && !ship.hits.includes(cellId)) {
                hit = true;
                ship.hits.push(cellId);
                if (ship.hits.length === ship.cells.length) sunkShip = ship;
                break;
            }
        }
        return { hit, sunkShip };
    }

    function checkWinCondition() {
        const playerWon = computerShips.every(ship => ship.hits.length === ship.cells.length);
        const computerWon = playerShips.every(ship => ship.hits.length === ship.cells.length);
        if (playerWon || computerWon) {
            setGameState('GAMEOVER');
            typewriterEffect(gameStatusText, `GAME OVER! ${playerWon ? 'You' : 'The Computer'} Win!`);
            powerUpsContainer.classList.add('hidden');
            playAgainButton.classList.remove('hidden');
            updateToggleButton();
            return true;
        }
        return false;
    }

    function getShipCells(startId, size, orientation) {
        const cells = [];
        if (orientation === 'horizontal') {
            if ((startId % gridSize) + size > gridSize) return { cells, isValid: false };
            for (let i = 0; i < size; i++) cells.push(startId + i);
        } else {
            if (startId + (size - 1) * gridSize >= gridSize * gridSize) return { cells, isValid: false };
            for (let i = 0; i < size; i++) cells.push(startId + i * gridSize);
        }
        return { cells, isValid: true };
    }
    
    function getClusterCells(centerId) {
        return [centerId, centerId - 1, centerId + 1, centerId - gridSize, centerId + gridSize].filter(id => {
            const row = Math.floor(id/gridSize);
            const centerRow = Math.floor(centerId/gridSize);
            return id >= 0 && id < gridSize*gridSize && (id === centerId || row === centerRow || id % gridSize === centerId % gridSize);
        });
    }

    function isClusterAttackValid(centerId, gridElement) {
        const row = Math.floor(centerId / gridSize);
        const col = centerId % gridSize;
        if (row === 0 || row === gridSize - 1 || col === 0 || col === gridSize - 1) return false;
        for (const id of getClusterCells(centerId)) {
            const cell = gridElement.querySelector(`[data-id='${id}']`);
            if (cell && (cell.classList.contains('hit') || cell.classList.contains('miss'))) return false;
        }
        return true;
    }

    function showPopup(message, color) {
        popupMessage.textContent = message;
        popupMessage.style.color = color;
        popupMessage.classList.add('show');
        setTimeout(() => { popupMessage.classList.remove('show'); }, 1200);
    }
});
