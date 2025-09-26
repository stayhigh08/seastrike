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
    const mobileToggleButton = document.getElementById('mobile-toggle');
    const shipSelectionBox = document.getElementById('ship-selection-container');
    const actionButtonsBox = document.getElementById('action-buttons-container');

    // --- Game State ---
    const gridSize = 10;
    const shipTemplates = [
        { name: 'carrier', size: 5 }, 
        { name: 'battleship', size: 4 }, 
        { name: 'cruiser', size: 3 }, 
        { name: 'cruiser-2', size: 3 },
        { name: 'destroyer', size: 2 },
        { name: 'destroyer-2', size: 2 }
    ];
    const totalShipSquares = shipTemplates.reduce((sum, ship) => sum + ship.size, 0) * 2;
    const totalWaterSquares = (gridSize * gridSize * 2) - totalShipSquares;
    let gameState = 'SETUP', orientation = 'horizontal', selectedShip = null, playerShips = [], computerShips = [];
    const MOBILE_BREAKPOINT = 900;
    let isMobileView = window.innerWidth <= MOBILE_BREAKPOINT;
    
    let selectedAbility = 'torpedo', clusterBombs = 3;
    let computerClusterBombs = 3;
    
    let aiMode = 'HUNT', aiTargetQueue = [], aiKnownHits = [];
    let isPlayerAttacking = false;

    function updateGameProgress() {
        const hitCells = document.querySelectorAll('.grid .hit').length;
        const progressPercentage = (hitCells / totalShipSquares) * 100;
        gameStatus.style.setProperty('--progress-width', `${progressPercentage}%`);
    }

    function setGameState(newState) {
        document.body.className = '';
        document.body.classList.add(`gamestate-${newState.toLowerCase()}`);
        gameState = newState;
    }

    function createGrid(gridElement) { for (let i = 0; i < gridSize * gridSize; i++) { const cell = document.createElement('div'); cell.classList.add('cell'); cell.dataset.id = i; gridElement.appendChild(cell); } }
    createGrid(playerGrid); createGrid(computerGrid);

    playerGrid.addEventListener('mouseover', handlePlayerGridMouseover);
    playerGrid.addEventListener('mouseout', handlePlayerGridMouseout);
    playerGrid.addEventListener('click', handleGridClick);
    computerGrid.addEventListener('click', handleGridClick);
    computerGrid.addEventListener('mouseover', handleComputerGridMouseover);
    computerGrid.addEventListener('mouseout', handleComputerGridMouseout);
    rotateButton.addEventListener('click', () => { orientation = orientation === 'horizontal' ? 'vertical' : 'horizontal'; });
    startButton.addEventListener('click', startGame);
    powerUpsContainer.addEventListener('click', selectAbility);
    window.addEventListener('resize', handleResize);
    mobileToggleButton.addEventListener('click', toggleMobileView);

    initializeGame();
    handleResize();

    function initializeGame() {
        setGameState('SETUP');
        populateShipSelection();
        const firstShip = shipSelectionContainer.querySelector('.ship');
        if (firstShip) firstShip.click();
        updateGameProgress();
        clusterCountSpan.textContent = clusterBombs;
    }

    function startGame() {
        if (playerShips.length !== shipTemplates.length) { alert('Please place all your ships first!'); return; }
        document.body.classList.add('all-ships-placed');
        placeComputerShips();
        setGameState('PLAYER_TURN');
        gameStatusText.textContent = 'Your Turn!';
        shipSelectionBox.classList.add('hidden');
        actionButtonsBox.classList.add('hidden');
        powerUpsContainer.classList.remove('hidden');
        document.querySelector("[data-ability='torpedo']").classList.add('selected');
        updateToggleButton();
    }

    function switchTurn(delay = 2500) {
        const isPlayerTurnNow = gameState === 'PLAYER_TURN';
        setTimeout(() => {
            document.body.classList.remove('view-override');
            if (isPlayerTurnNow) {
                setGameState('COMPUTER_TURN');
                gameStatusText.textContent = "Computer's Turn...";
                updateToggleButton();
                setTimeout(computerTurn, 1000);
            } else {
                setGameState('PLAYER_TURN');
                gameStatusText.textContent = 'Your Turn!';
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
        mobileToggleButton.textContent = showingPlayerBoard ? 'Enemy Waters' : 'Your Fleet';
    }

    function toggleMobileView() {
        document.body.classList.toggle('view-override');
        updateToggleButton();
    }

    function handleResize() {
        isMobileView = window.innerWidth <= MOBILE_BREAKPOINT;
        if (!isMobileView) document.body.classList.remove('view-override');
        updateToggleButton();
    }

    function handleGridClick(e) {
        const clickedCell = e.target.closest('.cell');
        if (!clickedCell || isPlayerAttacking) return;
        if (gameState === 'SETUP' && clickedCell.parentElement.id === 'player-grid') placeShip(clickedCell);
        else if (gameState === 'PLAYER_TURN' && clickedCell.parentElement.id === 'computer-grid') handlePlayerAttack(clickedCell);
    }

    function handlePlayerGridMouseover(e) {
        if (isMobileView) return;
        const cell = e.target.closest('.cell');
        if (gameState !== 'SETUP' || !selectedShip || !cell) return;
        const startId = parseInt(cell.dataset.id);
        const { cells, isValid } = getShipCells(startId, selectedShip.size, orientation);
        const isTaken = cells.some(id => playerGrid.querySelector(`[data-id='${id}']`)?.classList.contains('ship-placed'));
        if (isValid && !isTaken) cells.forEach(id => { const c = playerGrid.querySelector(`[data-id='${id}']`); if (c) c.classList.add('hover-valid'); });
        else cell.classList.add('hover-invalid');
    }

    function handlePlayerGridMouseout() {
        document.querySelectorAll('#player-grid .cell').forEach(c => c.classList.remove('hover-valid', 'hover-invalid'));
    }

    function handleComputerGridMouseover(e) {
        if (isMobileView) return;
        const cell = e.target.closest('.cell');
        if (gameState !== 'PLAYER_TURN' || selectedAbility !== 'cluster' || !cell) return;
        const centerId = parseInt(cell.dataset.id);
        if (isClusterAttackValid(centerId, computerGrid)) {
            const targetIds = [centerId, centerId - 1, centerId + 1, centerId - gridSize, centerId + gridSize];
            targetIds.forEach(id => { const targetCell = computerGrid.querySelector(`[data-id='${id}']`); if (targetCell) targetCell.classList.add('hover-cluster'); });
        } else {
            cell.classList.add('hover-invalid');
        }
    }
    
    function handleComputerGridMouseout() {
        document.querySelectorAll('#computer-grid .cell').forEach(c => c.classList.remove('hover-invalid', 'hover-cluster'));
    }

    function populateShipSelection() {
        const shipSelectionDiv = document.getElementById('ship-selection');
        shipSelectionDiv.innerHTML = '';
        const placedShipNames = playerShips.map(ship => ship.name);

        const shipsToDisplay = shipTemplates.filter(shipTpl => !placedShipNames.includes(shipTpl.name));

        if (shipsToDisplay.length > 0) {
            const nextShipName = shipsToDisplay[0].name.split('-')[0];
            gameStatusText.textContent = `Place your ${nextShipName.charAt(0).toUpperCase() + nextShipName.slice(1)}`;
        }

        shipsToDisplay.forEach(shipInfo => {
            const shipDiv = document.createElement('div');
            shipDiv.classList.add('ship');
            shipDiv.dataset.name = shipInfo.name;
            for (let i = 0; i < shipInfo.size; i++) {
                shipDiv.appendChild(document.createElement('div')).classList.add('ship-segment');
            }
            shipDiv.addEventListener('click', (e) => {
                document.querySelectorAll('.ship').forEach(s => s.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                selectedShip = shipInfo;
                const baseName = selectedShip.name.split('-')[0];
                gameStatusText.textContent = `Place your ${baseName.charAt(0).toUpperCase() + baseName.slice(1)}`;
            });
            shipSelectionDiv.appendChild(shipDiv);
        });
    }

    function placeShip(cell) {
        if (!selectedShip) return;
        const startId = parseInt(cell.dataset.id);
        const { cells, isValid } = getShipCells(startId, selectedShip.size, orientation);
        const isTaken = cells.some(id => playerGrid.querySelector(`[data-id='${id}']`)?.classList.contains('ship-placed'));
        if (isValid && !isTaken) {
            cells.forEach(id => playerGrid.querySelector(`[data-id='${id}']`).classList.add('ship-placed'));
            playerShips.push({ name: selectedShip.name, size: selectedShip.size, cells, hits: [] });
            
            populateShipSelection();
            selectedShip = null;
            
            const nextShipElement = shipSelectionContainer.querySelector('.ship');
            if (nextShipElement) {
                nextShipElement.click();
            } else {
                gameStatusText.textContent = "Your fleet is ready!";
                startButton.classList.add('ready-to-start');
            }
        } else {
            playerGrid.classList.add('shake');
            setTimeout(() => playerGrid.classList.remove('shake'), 400);
        }
    }

    function selectAbility(e) {
        const button = e.target.closest('.power-up');
        if (!button || button.disabled) return;
        selectedAbility = button.dataset.ability;
        document.querySelectorAll('.power-up').forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');
    }

    function handlePlayerAttack(cell) {
        if (cell.classList.contains('hit') || cell.classList.contains('miss')) return;
        if (selectedAbility === 'cluster') {
            const centerId = parseInt(cell.dataset.id);
            if (!isClusterAttackValid(centerId, computerGrid)) {
                computerGrid.classList.add('shake');
                setTimeout(() => computerGrid.classList.remove('shake'), 400);
                return; 
            }
        }
        isPlayerAttacking = true;
        if (selectedAbility === 'torpedo') handleTorpedoAttack(cell);
        else if (selectedAbility === 'cluster') handleClusterAttack(cell);
    }

    function handleTorpedoAttack(cell) {
        const cellId = parseInt(cell.dataset.id);
        const { hit, sunkShip } = checkAttack(computerShips, cellId);
        if (hit) {
            cell.classList.add('hit');
            showPopup("HIT!", "var(--hit-color)");
            if (sunkShip) {
                gameStatusText.textContent = `You sunk their ${sunkShip.name.split('-')[0]}!`;
                animateSinking(sunkShip, computerGrid);
                if (checkWinCondition()) return;
                switchTurn(3500);
            } else {
                gameStatusText.textContent = 'Go again!';
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
        const targetIds = [centerId, centerId - 1, centerId + 1, centerId - gridSize, centerId + gridSize];
        let anyHit = false;
        let shipWasSunk = false;
        targetIds.forEach((id, index) => {
            setTimeout(() => {
                const targetCell = computerGrid.querySelector(`[data-id='${id}']`);
                if (targetCell && !targetCell.classList.contains('hit') && !targetCell.classList.contains('miss')) {
                    const { hit, sunkShip } = checkAttack(computerShips, id);
                    targetCell.classList.add(hit ? "hit" : "miss");
                    if (hit) anyHit = true;
                    if (sunkShip) {
                        gameStatusText.textContent = `You sunk their ${sunkShip.name.split('-')[0]}!`;
                        animateSinking(sunkShip, computerGrid);
                        shipWasSunk = true;
                    }
                }
            }, index * 100);
        });
        setTimeout(() => {
            updateGameProgress();
            if (checkWinCondition()) return;
            if (shipWasSunk) switchTurn();
            else if (anyHit) {
                gameStatusText.textContent = 'Cluster bomb hit! Go again.';
                isPlayerAttacking = false;
            } else {
                showPopup("MISS", "var(--miss-color)");
                switchTurn();
            }
        }, 1200);
    }

    function updateAbilityCount(ability, count) {
        clusterCountSpan.textContent = count;
        if (count === 0) {
            const abilityButton = document.querySelector(`[data-ability=${ability}]`);
            abilityButton.disabled = true;
            if (selectedAbility === ability) selectAbility({ target: { closest: () => document.querySelector("[data-ability='torpedo']") } });
        }
    }

    function computerTurn() {
        if (gameState !== 'COMPUTER_TURN') return;
        if ("HUNT" === aiMode && computerClusterBombs > 0 && Math.random() < 0.5) return void handleComputerClusterAttack();
        let targetId;
        if ("TARGET" === aiMode && aiTargetQueue.length > 0) {
            targetId = aiTargetQueue.shift();
        } else {
            aiMode = "HUNT";
            let randomId;
            do { randomId = Math.floor(Math.random() * gridSize * gridSize); } 
            while (playerGrid.querySelector(`[data-id='${randomId}']`).classList.contains("hit") || playerGrid.querySelector(`[data-id='${randomId}']`).classList.contains("miss"));
            targetId = randomId;
        }
        const targetCell = playerGrid.querySelector(`[data-id='${targetId}']`);
        const { hit, sunkShip } = checkAttack(playerShips, targetId);
        if (hit) {
            targetCell.classList.add("hit");
            showPopup("HIT!", "var(--hit-color)");
            if (sunkShip) {
                gameStatusText.textContent = `The computer sunk your ${sunkShip.name.split('-')[0]}!`;
                aiMode = "HUNT";
                aiTargetQueue = [];
                aiKnownHits = [];
                animateSinking(sunkShip, playerGrid);
                if (checkWinCondition()) return;
                switchTurn(3500);
            } else {
                gameStatusText.textContent = "Computer hit! It goes again.";
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

    function updateAiTargetQueue() {
        aiTargetQueue = [];
        let potentialTargets = new Set;
        if (aiKnownHits.length === 1) {
            const hit = aiKnownHits[0];
            [hit - 1, hit + 1, hit - gridSize, hit + gridSize].forEach(id => potentialTargets.add(id));
        } else {
            aiKnownHits.sort((a, b) => a - b);
            const firstHit = aiKnownHits[0];
            const lastHit = aiKnownHits[aiKnownHits.length - 1];
            if (lastHit - firstHit < gridSize) { potentialTargets.add(lastHit + 1); potentialTargets.add(firstHit - 1); } 
            else { potentialTargets.add(lastHit + gridSize); potentialTargets.add(firstHit - gridSize); }
        }
        aiTargetQueue = [...potentialTargets].filter(id => id >= 0 && id < 100 && !playerGrid.querySelector(`[data-id='${id}']`).classList.contains("hit") && !playerGrid.querySelector(`[data-id='${id}']`).classList.contains("miss"));
    }

    function handleComputerClusterAttack() {
        gameStatusText.textContent = "Computer uses a Cluster Bomb!";
        computerClusterBombs--;
        let centerId;
        do { centerId = Math.floor(Math.random() * gridSize * gridSize); } 
        while (!isClusterAttackValid(centerId, playerGrid));
        const targetIds = [centerId, centerId - 1, centerId + 1, centerId - gridSize, centerId + gridSize];
        let anyHit = false, clusterHits = [], shipWasSunkDuringCluster = false;
        targetIds.forEach((id, index) => {
            setTimeout(() => {
                const targetCell = playerGrid.querySelector(`[data-id='${id}']`);
                if (targetCell && !targetCell.classList.contains("hit") && !targetCell.classList.contains("miss")) {
                    const { hit, sunkShip } = checkAttack(playerShips, id);
                    targetCell.classList.add(hit ? "hit" : "miss");
                    if (hit) { anyHit = true; clusterHits.push(id); }
                    if (sunkShip) {
                        shipWasSunkDuringCluster = true;
                        animateSinking(sunkShip, playerGrid);
                        aiMode = "HUNT";
                        aiTargetQueue = [];
                        aiKnownHits = [];
                    }
                }
            }, 150 * index);
        });
        setTimeout(() => {
            updateGameProgress();
            if (checkWinCondition()) return;
            if (shipWasSunkDuringCluster) {
                gameStatusText.textContent = `Computer sunk your ship! It goes again.`;
                setTimeout(computerTurn, 1200);
            } else if (anyHit) {
                aiKnownHits.push(...clusterHits);
                aiMode = "TARGET";
                updateAiTargetQueue();
                gameStatusText.textContent = 'Computer cluster bomb hit! It goes again.';
                setTimeout(computerTurn, 1200);
            } else {
                switchTurn();
            }
        }, 1500);
    }

    function animateSinking(sunkShip, gridElement) {
        gridElement.classList.add('shake');
        setTimeout(() => gridElement.classList.remove('shake'), 400);
        sunkShip.cells.forEach((cellId) => {
            setTimeout(() => {
                const cell = gridElement.querySelector(`[data-id='${cellId}']`);
                if (cell) {
                    cell.classList.add('sunk', 'explode');
                    setTimeout(() => { cell.classList.remove('explode'); }, 500);
                }
            }, Math.random() * 300);
        });
    }

    function placeComputerShips() {
        shipTemplates.forEach(shipInfo => {
            let placed = false, randomOrientation, randomStartId, shipData;
            while (!placed) {
                randomOrientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
                randomStartId = Math.floor(Math.random() * gridSize * gridSize);
                shipData = getShipCells(randomStartId, shipInfo.size, randomOrientation);
                const isTaken = shipData.cells.some(id => computerShips.flatMap(s => s.cells).includes(id));
                if (shipData.isValid && !isTaken) {
                    computerShips.push({ name: shipInfo.name, size: shipInfo.size, cells: shipData.cells, hits: [] });
                    placed = true;
                }
            }
        });
    }

    function checkAttack(ships, cellId) {
        let hit = false, sunkShip = null;
        for (const ship of ships) {
            if (ship.cells.includes(cellId)) {
                hit = true;
                ship.hits.push(cellId);
                if (ship.hits.length === ship.size) sunkShip = ship;
                break;
            }
        }
        return { hit, sunkShip };
    }

    function checkWinCondition() {
        const playerWon = computerShips.every(ship => ship.hits.length === ship.size);
        const computerWon = playerShips.every(ship => ship.hits.length === ship.size);
        if (playerWon || computerWon) {
            setGameState('GAMEOVER');
            const winner = playerWon ? 'You' : 'The Computer';
            gameStatusText.textContent = `GAME OVER! ${winner} Win!`;
            const losingFleet = playerWon ? computerShips : playerShips;
            const losingGrid = playerWon ? computerGrid : playerGrid;
            losingFleet.forEach(ship => {
                ship.cells.forEach(cellId => {
                    if (!ship.hits.includes(cellId)) {
                        const cell = losingGrid.querySelector(`[data-id='${cellId}']`);
                        if (cell) cell.classList.add('ship-reveal');
                    }
                });
            });
            updateToggleButton();
            return true;
        }
        return false;
    }

    function getShipCells(startId, size, orientation) {
        const cells = []; let isValid = true;
        for (let i = 0; i < size; i++) {
            let id = orientation === 'horizontal' ? startId + i : startId + (i * gridSize);
            if (id >= 100 || (orientation === 'horizontal' && Math.floor(id / gridSize) !== Math.floor(startId / gridSize))) {
                isValid = false; break;
            }
            cells.push(id);
        }
        return { cells, isValid };
    }
    
    function isClusterAttackValid(centerId, gridElement) {
        const row = Math.floor(centerId / gridSize), col = centerId % gridSize;
        if (row === 0 || row === gridSize - 1 || col === 0 || col === gridSize - 1) return false;
        const targetIds = [centerId, centerId - 1, centerId + 1, centerId - gridSize, centerId + gridSize];
        for (const id of targetIds) {
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
