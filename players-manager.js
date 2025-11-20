/**
 * FORMULA PADEL - PLAYERS MANAGER V2.0
 * Modulo dedicato alla gestione dei giocatori
 * Mantiene app.js leggera e organizza le funzionalità specifiche
 */

class PlayersManager {
    constructor(app) {
        this.app = app;
        this.players = [];
        this.availableEmojis = [
            '🎾', '⚡', '🔥', '🌟', '💫', '⭐', '🏆', '🚀',
            '💎', '👑', '🦅', '🐅', '🦁', '🐺', '⚽', '🏀',
            '🎯', '💪', '🔱', '⚔️', '🛡️', '🏹', '🎪', '🎭'
        ];
        
        this.setupEventListeners();
    }

    // ============================================================================
    // EVENT LISTENERS
    // ============================================================================

    setupEventListeners() {
        // Tournament players loading button
        const loadPlayersBtn = document.getElementById('loadTournamentPlayersBtn');
        
        if (loadPlayersBtn) {
            loadPlayersBtn.addEventListener('click', () => this.loadTournamentPlayers());
        }

        // Player management buttons
        // const addPlayerBtn = document.getElementById('addPlayerBtn');
        const randomizeBtn = document.getElementById('randomizeAliasesBtn');
        const updatePlayersBtn = document.getElementById('updatePlayersBtn');
        const saveBtn = document.getElementById('savePlayersBtn');

        // if (addPlayerBtn) {
        //     addPlayerBtn.addEventListener('click', () => this.addNewPlayer());
        // }
        
        if (randomizeBtn) {
            randomizeBtn.addEventListener('click', () => this.randomizeAllAliases());
        }
        
        if (updatePlayersBtn) {
            updatePlayersBtn.addEventListener('click', () => this.updatePlayers());
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.savePlayersConfiguration());
        }

        // Player card interactions - use document delegation since grids are dynamic
        this.setupPlayerCardEvents();
    }

    setupPlayerCardEvents() {
        // Remove existing listeners to avoid duplicates
        if (this.playerInputEventHandler) {
            document.removeEventListener('input', this.playerInputEventHandler);
            document.removeEventListener('blur', this.playerBlurEventHandler, true);
        }

        // Future: Player action buttons (delete, refresh alias) - Commented for now
        /*
        this.playerCardEventHandler = (event) => {
            const button = event.target.closest('.player-action-btn');
            if (!button) return;
            
            const playerCard = button.closest('.player-card');
            if (!playerCard) return;
            
            const playerId = playerCard.getAttribute('data-player-id');
            const action = button.getAttribute('data-action');
            
            switch(action) {
                case 'delete':
                    this.removePlayer(playerId);
                    break;
                case 'refresh-alias':
                    this.refreshPlayerAlias(playerId);
                    break;
            }
        };
        */

        // Player field editing (name and score)
        this.playerInputEventHandler = (event) => {
            const input = event.target;
            const field = input.getAttribute('data-field');
            if (!field) return;
            
            const playerCard = input.closest('.player-card');
            if (!playerCard) return;
            
            const playerId = playerCard.getAttribute('data-player-id');
            const player = this.players.find(p => p.id === playerId);
            
            if (!player) return;
            
            switch(field) {
                case 'name':
                    player.name = input.value;
                    console.log(`Name updated: ${player.name}`);
                    break;
                case 'score':
                    const score = parseFloat(input.value);
                    if (score >= 0.5 && score <= 5.0) {
                        player.PlayerScore = Math.round(score * 10) / 10; // Ensure 1 decimal place
                        console.log(`Score updated: ${player.name} -> ${player.PlayerScore}`);
                        // Don't auto-refresh to preserve user edits
                    }
                    break;
            }
        };

        // Player field validation on blur
        this.playerBlurEventHandler = (event) => {
            const input = event.target;
            const field = input.getAttribute('data-field');
            if (field === 'score') {
                const score = parseFloat(input.value);
                if (isNaN(score) || score < 0.5 || score > 5.0) {
                    input.value = 2.5; // Reset to default
                    const playerCard = input.closest('.player-card');
                    if (playerCard) {
                        const playerId = playerCard.getAttribute('data-player-id');
                        const player = this.players.find(p => p.id === playerId);
                        if (player) {
                            player.PlayerScore = 2.5;
                            console.log(`Score reset to default: ${player.name} -> 2.5`);
                            // Don't auto-refresh to preserve other edits
                        }
                    }
                }
            }
        };

        // Attach event listeners to document
        // document.addEventListener('click', this.playerCardEventHandler); // Future: For player action buttons
        document.addEventListener('input', this.playerInputEventHandler);
        document.addEventListener('blur', this.playerBlurEventHandler, true);
    }

    // ============================================================================
    // AUTOMATIC PLAYER LOADING BASED ON TOURNAMENT
    // ============================================================================

    async loadTournamentPlayers() {
        try {
            // Get tournament configuration
            const tournamentData = this.app.getTournamentFormData();
            if (!tournamentData || !tournamentData.players_count) {
                this.app.addNotification('Tournament not configured. Please complete tournament setup first.', 'error');
                return;
            }

            const playerCount = tournamentData.players_count;
            this.app.addNotification(`Loading ${playerCount} players for tournament...`, 'info');
            
            // Load player bucket from database
            const response = await this.app.getDbManager().loadPlayerBucket(playerCount);
            
            if (response.success && response.players) {
                this.players = response.players;
                
                // Process players: ranking, categories, aliases
                this.processPlayersData();
                
                // Show UI and render
                this.showPlayersSection();
                this.renderPlayersGrid();
                
                this.app.addNotification(
                    `${playerCount} players loaded successfully for "${tournamentData.name}"`, 
                    'success'
                );
            } else {
                this.app.addNotification('Failed to load players: ' + (response.error || 'Unknown error'), 'error');
            }
            
        } catch (error) {
            this.app.addNotification(`Error loading players: ${error.message}`, 'error');
            console.error('Load tournament players error:', error);
        }
    }

    processPlayersData() {
        this.calculatePlayerRanking();
        this.assignCategoryAliases();
    }

    // ============================================================================
    // RANKING & CATEGORIES SYSTEM
    // ============================================================================

    calculatePlayerRanking() {
        if (!this.players || this.players.length === 0) return;
        
        // Sort by PlayerScore descending
        this.players.sort((a, b) => b.PlayerScore - a.PlayerScore);
        
        // Split into BEASTS (top 50%) and COLORS (bottom 50%)
        const midpoint = Math.floor(this.players.length / 2);
        
        this.players.forEach((player, index) => {
            player.category = index < midpoint ? 'BEAST' : 'COLOR';
            player.ranking = index + 1;
        });
        
        console.log('📊 Player ranking calculated:', {
            total: this.players.length,
            beasts: this.players.filter(p => p.category === 'BEAST').length,
            colors: this.players.filter(p => p.category === 'COLOR').length
        });
    }

    // ============================================================================
    // ALIAS SYSTEM - CATEGORY SPECIFIC BUCKETS
    // ============================================================================

    assignCategoryAliases() {
        if (!this.players) return;
        
        // Get category-specific alias buckets from database
        this.players = this.app.getDbManager().assignCategoryAliases(this.players);
        
        console.log('🏷️ Category aliases assigned:', {
            colors: this.players.filter(p => p.category === 'COLOR').map(p => p.alias),
            beasts: this.players.filter(p => p.category === 'BEAST').map(p => p.alias)
        });
    }

    assignRandomAliases() {
        // This method is now deprecated - use assignCategoryAliases instead
        this.assignCategoryAliases();
    }

    assignPlayerAlias(player) {
        // Get fresh alias from category-specific bucket
        const dbManager = this.app.getDbManager();
        let aliasData;
        
        if (player.category === 'COLOR') {
            const colorAliases = dbManager.getColorAliases();
            aliasData = colorAliases[Math.floor(Math.random() * colorAliases.length)];
        } else if (player.category === 'BEAST') {
            const beastAliases = dbManager.getBeastAliases();
            aliasData = beastAliases[Math.floor(Math.random() * beastAliases.length)];
        }
        
        if (aliasData) {
            player.alias = aliasData.alias;
            player.aliasEmoji = aliasData.emoji;
        }
    }

    refreshPlayerAlias(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            this.assignPlayerAlias(player);
            this.renderPlayersGrid();
            this.app.addNotification(`Player alias refreshed: ${player.alias}`, 'success');
        }
    }

    randomizeAllAliases() {
        if (!this.players || this.players.length === 0) {
            this.app.addNotification('No players to randomize', 'error');
            return;
        }
        
        this.assignCategoryAliases();
        this.renderPlayersGrid();
        this.app.addNotification('All player aliases randomized', 'success');
    }

    // ============================================================================
    // UI RENDERING SYSTEM
    // ============================================================================

    showPlayersSection() {
        console.log('🔍 DEBUG - showPlayersSection() called');
        
        // Show main players list section container
        const playersListSection = document.getElementById('playersListSection');
        console.log('🔍 DEBUG - playersListSection found:', !!playersListSection);
        if (playersListSection) {
            playersListSection.style.display = 'block';
            console.log('✅ playersListSection shown');
        }
        
        // Show all player management UI elements
        const playersHeader = document.getElementById('playersHeader');
        const playersControls = document.getElementById('playersControls');
        const playersCategories = document.getElementById('playersCategories');
        
        console.log('🔍 DEBUG - elements found:', {
            header: !!playersHeader,
            controls: !!playersControls, 
            categories: !!playersCategories
        });
        
        if (playersHeader) {
            playersHeader.style.display = 'flex';
            console.log('✅ playersHeader shown');
        }
        if (playersControls) {
            playersControls.style.display = 'flex';
            console.log('✅ playersControls shown');
        }
        if (playersCategories) {
            playersCategories.style.display = 'flex';
            console.log('✅ playersCategories shown');
        }
        
        console.log('✅ Players section UI elements shown');
    }

    renderPlayersGrid() {
        console.log('🔍 DEBUG - renderPlayersGrid() called');
        console.log('🔍 DEBUG - players array:', this.players ? this.players.length : 'null');
        
        const beastsGrid = document.getElementById('beastsGrid');
        const colorsGrid = document.getElementById('colorsGrid');
        const beastCounter = document.getElementById('beastCounter');
        const colorCounter = document.getElementById('colorCounter');
        
        console.log('🔍 DEBUG - grid elements found:', {
            beastsGrid: !!beastsGrid,
            colorsGrid: !!colorsGrid,
            beastCounter: !!beastCounter,
            colorCounter: !!colorCounter
        });
        
        if (!beastsGrid || !colorsGrid || !this.players) {
            console.log('❌ DEBUG - Missing elements or players data');
            return;
        }
        
        // Separate players by category
        const beasts = this.players.filter(p => p.category === 'BEAST');
        const colors = this.players.filter(p => p.category === 'COLOR');
        
        // Update counters
        if (beastCounter) beastCounter.textContent = beasts.length;
        if (colorCounter) colorCounter.textContent = colors.length;
        
        // Update old stats if they exist
        const beastsCount = document.getElementById('beastsCount');
        const colorsCount = document.getElementById('colorsCount');
        const totalCount = document.getElementById('totalCount');
        if (beastsCount) beastsCount.textContent = `BEASTS: ${beasts.length}`;
        if (colorsCount) colorsCount.textContent = `COLORS: ${colors.length}`;
        if (totalCount) totalCount.textContent = `TOTAL: ${this.players.length}`;
        
        // Render player cards in separate grids
        beastsGrid.innerHTML = beasts.map(player => this.renderPlayerCard(player)).join('');
        colorsGrid.innerHTML = colors.map(player => this.renderPlayerCard(player)).join('');
    }

    updatePlayersStats(beastsCount, colorsCount, totalCount) {
        const beasts = this.players.filter(p => p.category === 'BEAST');
        const colors = this.players.filter(p => p.category === 'COLOR');
        
        if (beastsCount) beastsCount.textContent = `BEASTS: ${beasts.length}`;
        if (colorsCount) colorsCount.textContent = `COLORS: ${colors.length}`;
        if (totalCount) totalCount.textContent = `TOTAL: ${this.players.length}`;
    }

    renderPlayerCard(player) {
        const categoryClass = player.category.toLowerCase();
        return `
            <div class="player-card ${categoryClass}" data-player-id="${player.id}">
                <div class="player-header">
                    <span class="player-category ${categoryClass}">${player.category}</span>
                    <!-- Future: Player action buttons for individual control
                    <div class="player-actions">
                        <button class="player-action-btn refresh" data-action="refresh-alias" title="New Alias">
                            <i class="fas fa-sync"></i>
                        </button>
                        <button class="player-action-btn delete" data-action="delete" title="Delete Player">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    -->
                </div>
                
                <div class="player-info">
                    <div class="player-alias-section">
                        <div class="player-emoji">${player.aliasEmoji || '🎾'}</div>
                        <div class="player-alias-name">${player.alias || 'No Alias'}</div>
                    </div>
                    <div class="player-details">
                        <input type="text" value="${player.name}" data-field="name" placeholder="Player Name">
                        <div class="score-label">Rank #${player.ranking || 1}</div>
                    </div>
                    <div class="player-score">
                        <div class="score-label">Score</div>
                        <input type="number" class="score-input" value="${player.PlayerScore || 2.5}" 
                               data-field="score" min="0.5" max="5.0" step="0.1" placeholder="2.5">
                    </div>
                </div>
            </div>
        `;
    }

    // ============================================================================
    // PLAYER MANAGEMENT OPERATIONS
    // ============================================================================

    addNewPlayer() {
        if (!this.players) this.players = [];
        
        const newPlayer = {
            id: Date.now(),
            name: `Player ${this.players.length + 1}`,
            PlayerScore: 50,
            category: 'COLOR',
            alias: this.availableEmojis[Math.floor(Math.random() * this.availableEmojis.length)]
        };
        
        this.players.push(newPlayer);
        this.calculatePlayerRanking();
        this.renderPlayersGrid();
        
        this.app.addNotification('New player added', 'success');
    }

    deletePlayer(playerId) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex !== -1) {
            const playerName = this.players[playerIndex].name;
            this.players.splice(playerIndex, 1);
            
            // Recalculate ranking after deletion
            this.calculatePlayerRanking();
            this.renderPlayersGrid();
            
            this.app.addNotification(`Player ${playerName} deleted`, 'info');
        }
    }

    // ============================================================================
    // UPDATE & RECALCULATION
    // ============================================================================

    async updatePlayers() {
        try {
            if (!this.players || this.players.length === 0) {
                this.app.addNotification('No players to update', 'warning');
                return;
            }

            this.app.addNotification('Updating players configuration...', 'info');
            
            // First, sync any manual changes from the DOM to the data model
            this.syncPlayerDataFromDOM();
            
            // Then recalculate rankings based on updated data
            this.recalculateRankings();
            
            // Finally re-render with the updated rankings
            this.renderPlayersGrid();
            
            this.app.addNotification(`Updated ${this.players.length} players successfully`, 'success');
            
        } catch (error) {
            console.error('Error updating players:', error);
            this.app.addNotification('Error updating players configuration', 'error');
        }
    }

    syncPlayerDataFromDOM() {
        // Sync data from DOM inputs back to player objects
        this.players.forEach(player => {
            // Find the player card in the DOM
            const playerCard = document.querySelector(`.player-card[data-player-id="${player.id}"]`);
            if (playerCard) {
                // Sync name
                const nameInput = playerCard.querySelector('input[data-field="name"]');
                if (nameInput && nameInput.value !== player.name) {
                    player.name = nameInput.value;
                }
                
                // Sync score
                const scoreInput = playerCard.querySelector('input[data-field="score"]');
                if (scoreInput) {
                    const score = parseFloat(scoreInput.value);
                    if (!isNaN(score) && score >= 0.5 && score <= 5.0) {
                        player.PlayerScore = Math.round(score * 10) / 10;
                    }
                }
            }
        });
        
        console.log('Data synced from DOM:', this.players.map(p => `${p.name}: ${p.PlayerScore}`));
    }

    recalculateRankings() {
        if (!this.players || this.players.length === 0) return;
        
        // Sort players by score (descending) and assign rankings
        this.players.sort((a, b) => (b.PlayerScore || 0) - (a.PlayerScore || 0));
        
        // Calculate midpoint for category redistribution
        const midpoint = Math.ceil(this.players.length / 2);
        
        this.players.forEach((player, index) => {
            player.ranking = index + 1;
            
            // Redistribute categories based on new ranking
            // Top 50% = BEAST (higher scores), Bottom 50% = COLOR (lower scores)
            const wasCategory = player.category;
            player.category = index < midpoint ? 'BEAST' : 'COLOR';
            
            // If category changed, update alias to match new category
            if (wasCategory !== player.category) {
                this.assignPlayerAlias(player);
            }
        });
        
        console.log('Rankings and categories recalculated:');
        console.log('BEASTS:', this.players.filter(p => p.category === 'BEAST').map(p => `${p.name}: ${p.PlayerScore} (Rank ${p.ranking})`));
        console.log('COLORS:', this.players.filter(p => p.category === 'COLOR').map(p => `${p.name}: ${p.PlayerScore} (Rank ${p.ranking})`));
    }

    // ============================================================================
    // SAVE & PROGRESSION
    // ============================================================================

    async savePlayersConfiguration() {
        try {
            if (!this.players || this.players.length === 0) {
                this.app.addNotification('No players to save', 'error');
                return;
            }
            
            this.app.addNotification('Saving players configuration...', 'info');
            
            // Validate players data
            const isValid = this.validatePlayersData();
            if (!isValid) return;
            
            // Save to database via main app
            const result = await this.app.getDbManager().savePlayers(this.players);
            
            // Disable editing after successful save
            this.disablePlayerEditing();
            
            // Enable Teams tab progression
            this.enableTeamsTab();

            // Notify teams manager that players are now saved
            if (this.app.teamsManager) {
                this.app.teamsManager.checkPlayersStatus();
            }

            // UPDATE STATISTICS DROPDOWN: Notify main app that players have been saved
            // This ensures the Statistics tab dropdown gets updated immediately
            console.log('🎯 Players saved - updating Statistics dropdown...');
            if (typeof this.app.onPlayersSaved === 'function') {
                this.app.onPlayersSaved(this.players);
            }
            
            // WORKFLOW CONTROL: Enable next step
            if (typeof this.app.enableNextWorkflowStep === 'function') {
                this.app.enableNextWorkflowStep('players-saved');
            }

            this.app.addNotification(
                `Players saved successfully! ${this.players.length} players ready for team generation.`,
                'success'
            );
        } catch (error) {
            this.app.addNotification(`Error saving players: ${error.message}`, 'error');
            console.error('Save players error:', error);
        }
    }

    validatePlayersData() {
        // Check for empty names
        const emptyNames = this.players.filter(p => !p.name || p.name.trim() === '');
        if (emptyNames.length > 0) {
            this.app.addNotification('Some players have empty names. Please fill all player names.', 'error');
            return false;
        }
        
        // Check for duplicate names
        const names = this.players.map(p => p.name.trim().toLowerCase());
        const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
        if (duplicates.length > 0) {
            this.app.addNotification('Duplicate player names found. Please use unique names.', 'error');
            return false;
        }
        
        return true;
    }

    enableTeamsTab() {
        const teamsTab = document.getElementById('tabTeams');
        if (teamsTab) {
            teamsTab.disabled = false;
            teamsTab.classList.remove('disabled');
        }
    }

    disablePlayerEditing() {
        // Disable all input fields
        document.querySelectorAll('.player-card input').forEach(input => {
            input.disabled = true;
            input.classList.add('disabled');
        });

        // Disable management buttons
        const managementButtons = [
            // 'addPlayerBtn',  // Commented out for now
            'randomizeAliasesBtn',
            'updatePlayersBtn'
        ];
        
        managementButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = true;
                btn.classList.add('disabled');
            }
        });

        // Change save button to "Locked" state
        const saveBtn = document.getElementById('savePlayersBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-lock"></i> Players Locked';
            saveBtn.classList.add('disabled', 'locked');
        }

        console.log('🔒 Players editing disabled - data locked for tournament consistency');
    }

    enablePlayerEditing() {
        // Enable all input fields
        document.querySelectorAll('.player-card input').forEach(input => {
            input.disabled = false;
            input.classList.remove('disabled');
        });

        // Enable management buttons
        const managementButtons = [
            'randomizeAliasesBtn',
            'updatePlayersBtn'
        ];
        
        managementButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = false;
                btn.classList.remove('disabled');
            }
        });

        // Change save button back to normal state
        const saveBtn = document.getElementById('savePlayersBtn');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Players';
            saveBtn.classList.remove('disabled', 'locked');
        }

        console.log('🔓 Players editing enabled - data can be modified');
    }

    resetPlayersData() {
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    getPlayersData() {
        return {
            players: this.players,
            beasts: this.players.filter(p => p.category === 'BEAST'),
            colors: this.players.filter(p => p.category === 'COLOR'),
            totalCount: this.players.length
        };
    }

    resetPlayersData() {
        this.players = [];
        const section = document.getElementById('playersListSection');
        if (section) {
            section.style.display = 'none';
        }
        this.app.addNotification('Players data reset', 'info');
    }

    // ============================================================================
    // WORKFLOW CONTROL METHODS
    // ============================================================================

    resetAllPlayers() {
        console.log('🗑️ Resetting tournament players data...');
        
        // Clear only the currently selected/working players array
        // DO NOT clear the bucket - keep players available for regeneration
        this.players = [];
        
        // Clear only the SAVED tournament players from localStorage
        // Keep the bucket data intact for reloading
        localStorage.removeItem('formulaPadel_players');
        
        // Reset UI to show no players selected/generated
        this.resetPlayersData();
        
        // Re-enable editing so players can be regenerated
        this.enablePlayerEditing();
        
        // Reset button states to initial state
        const generateBtn = document.getElementById('generatePlayersBtn');
        const saveBtn = document.getElementById('savePlayersBtn');
        
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-users"></i> Generate Players';
        }
        
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Players';
        }
        
        console.log('✅ Tournament players reset - bucket preserved for regeneration');
    }
}

// Export for use in main application
window.PlayersManager = PlayersManager;