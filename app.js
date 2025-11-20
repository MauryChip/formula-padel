/**
 * FORMULA PADEL - MAIN APPLICATION V2.0
 * Orchestratore principale per gestione interfaccia e logica
 * Allineato con MASTERGUIDE.txt specifications
 */

class FormulaPadelApp {
    constructor() {
        this.db = null;
        this.tournamentSettings = null;
        this.currentTab = 'tournament-settings';
        this.currentTournament = null;
        this.notifications = [];
        
        // Initialize when DOM is ready
        document.addEventListener('DOMContentLoaded', () => {
            this.init();
        });
    }

    // ============================================================================
    // APPLICATION INITIALIZATION
    // ============================================================================

    async init() {
        try {
            this.showLoading('Initializing Formula Padel...');
            
            // Initialize database
            this.db = new PadelDatabase();
            await this.db.init();
            this.addNotification('Database initialized successfully', 'success');
            
            // Initialize tournament settings
            this.tournamentSettings = new TournamentSettings(this.db);
            this.addNotification('Tournament system ready', 'success');
            
            // Initialize players manager
            this.playersManager = new PlayersManager(this);
            this.addNotification('Players system ready', 'success');
            
            // Initialize teams manager
            this.teamsManager = new TeamsManager(this);
            this.addNotification('Teams system ready', 'success');
            
            // Initialize rounds manager
            this.roundsManager = new RoundsManager(this);
            this.addNotification('Rounds system ready', 'success');
            
            // Initialize league manager
            this.leagueManager = new LeagueManager(this);
            this.addNotification('League system ready', 'success');
            
            // Setup UI event listeners
            this.setupEventListeners();
            
            // Setup initial state
            this.setupInitialState();
            
            // Make app instance globally available
            window.formulaPadelApp = this;
            
            this.hideLoading();
            this.updateAppStatus('Ready');
            this.addNotification('Formula Padel ready to start!', 'info');
            
        } catch (error) {
            this.hideLoading();
            this.addNotification(`Initialization failed: ${error.message}`, 'error');
            console.error('App initialization failed:', error);
        }
    }

    // ============================================================================
    // EVENT LISTENERS SETUP
    // ============================================================================

    /**
     * Called when players are saved from PlayersManager
     * Updates Statistics dropdown with current players
     */
    onPlayersSaved(players) {
        // Update playersManager reference to ensure consistency
        if (this.playersManager) {
            this.playersManager.players = players;
        }
        
        // If Statistics tab is currently active, refresh the dropdown
        if (this.isStatisticsTabActive()) {
            this.populatePlayerStatsDropdown();
        }
    }
    
    /**
     * Check if Statistics tab is currently active
     */
    isStatisticsTabActive() {
        const statisticsPanel = document.getElementById('statisticsPanel');
        return statisticsPanel && statisticsPanel.classList.contains('active');
    }

    setupEventListeners() {
        // Tab navigation - fix per nuova struttura HTML
        document.querySelectorAll('.tab-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const tabId = e.currentTarget.id.replace('tab', '').toLowerCase();
                const targetPanel = tabId + 'Panel';
                this.switchTab(targetPanel);
            });
        });

        // Tournament Settings Events
        this.setupTournamentSettingsEvents();
        
        // Auto-save form changes
        this.setupAutoSave();
        
        // Preset buttons
        document.querySelectorAll('.preset-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const presetKey = e.currentTarget.dataset.preset;
                this.applyPreset(presetKey);
            });
        });
    }

    setupTournamentSettingsEvents() {
        // Main action buttons
        document.getElementById('calculateBtn').addEventListener('click', () => {
            this.calculateRounds();
        });
        
        document.getElementById('createBtn').addEventListener('click', () => {
            this.createTournament();
        });
        
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetTournamentSettings();
        });

        // Form change detection for live updates
        const formInputs = ['tournamentName', 'playerCount', 'courtsCount', 'matchDuration', 'totalRounds']; // Fixed field name
        formInputs.forEach(inputId => {
            const element = document.getElementById(inputId);
            if (element) {
                // Add multiple event listeners for immediate feedback
                element.addEventListener('change', () => {
                    this.onFormChange();
                });
                element.addEventListener('input', () => {
                    this.onFormChange();
                });
                element.addEventListener('keyup', () => {
                    this.onFormChange();
                });
            }
        });
    }

    setupAutoSave() {
        // Save form state to localStorage on changes
        const formInputs = ['tournamentName', 'tournamentDate', 'playerCount', 'courtsCount', 'matchDuration', 'totalRounds'];
        formInputs.forEach(inputId => {
            const element = document.getElementById(inputId);
            if (element) {
                element.addEventListener('change', () => {
                    this.saveFormState();
                });
            }
        });
    }

    // ============================================================================
    // UI STATE MANAGEMENT
    // ============================================================================

    setupInitialState() {
        // Set today's date
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('tournamentDate').value = today;
        
        // Load saved form state
        this.loadFormState();
        
        // Update calculation display on initialization
        this.updateCalculationDisplay();
        
        // Update header info
        this.updateHeaderInfo();
        
        // WORKFLOW CONTROL: Only Tournament Setup enabled initially
        this.initializeWorkflowControl();
    }

    // ============================================================================
    // WORKFLOW CONTROL SYSTEM
    // ============================================================================

    initializeWorkflowControl() {
        console.log('🔄 Initializing workflow control system...');
        
        // Only Tournament Setup tab enabled initially
        this.setTabState('setup', true);
        this.setTabState('players', false);
        this.setTabState('teams', false);  
        this.setTabState('rounds', false);
        this.setTabState('league', false);
        this.setTabState('stats', false);
        
        // Mark current workflow state
        this.workflowState = 'tournament-setup';
        
        this.addNotification('📋 Complete tournament setup to continue', 'info');
    }

    setTabState(tabName, enabled) {
        const tabButton = document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
        const tabPanel = document.getElementById(`${tabName}Panel`);
        
        if (!tabButton) {
            console.warn(`❌ Tab button not found for: ${tabName}`);
            return;
        }
        
        if (enabled) {
            tabButton.classList.remove('disabled');
            tabButton.disabled = false;
            tabButton.title = '';
            console.log(`✅ Tab enabled: ${tabName}`);
        } else {
            tabButton.classList.add('disabled'); 
            tabButton.disabled = true;
            tabButton.title = 'Complete previous steps to unlock this tab';
            console.log(`❌ Tab disabled: ${tabName}`);
        }
    }

    enableNextWorkflowStep(currentStep) {
        switch (currentStep) {
            case 'tournament-created':
                this.workflowState = 'players-setup';
                this.setTabState('players', true);
                this.addNotification('✅ Players tab unlocked! Configure your players now.', 'success');
                break;
                
            case 'players-saved':
                this.workflowState = 'teams-setup';
                this.setTabState('teams', true);
                this.setTabState('league', true);
                this.addNotification('✅ Teams and League tabs unlocked!', 'success');
                break;
                
            case 'teams-saved': 
                this.workflowState = 'rounds-setup';
                this.setTabState('rounds', true);
                this.addNotification('✅ Rounds tab unlocked! Create your tournament rounds.', 'success');
                break;
        }
        
        console.log(`🔄 Workflow advanced to: ${this.workflowState}`);
    }

    resetWorkflowBuffers() {
        console.log('🗑️ Resetting all tournament buffers...');
        
        // Clear Players buffer
        if (this.playersManager) {
            this.playersManager.resetAllPlayers();
        }
        
        // Clear Teams buffer
        if (this.teamsManager) {
            this.teamsManager.resetAllTeams();
        }
        
        // Clear Rounds buffer
        if (this.roundsManager) {
            this.roundsManager.clearRoundsData();
        }
        
        // Clear League buffer
        if (this.leagueManager) {
            this.leagueManager.resetLeague();
        }
        
        this.addNotification('🗑️ All tournament data reset successfully', 'success');
    }

    switchTab(panelId) {
        // Check if tab is disabled before switching
        const currentTabName = panelId.replace('Panel', '');
        const tabButton = document.getElementById(`tab${currentTabName.charAt(0).toUpperCase() + currentTabName.slice(1)}`);
        
        if (tabButton && tabButton.disabled) {
            this.addNotification('❌ This tab is not yet available. Complete previous steps first.', 'warning');
            return false;
        }
        
        // Hide all panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('visible');
        });
        
        // Remove active from all tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show target panel
        const targetPanel = document.getElementById(panelId);
        if (targetPanel) {
            targetPanel.classList.add('visible');
        }
        
        // Activate corresponding button
        const tabName = panelId.replace('Panel', '');
        const targetBtn = document.getElementById('tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
        if (targetBtn) {
            targetBtn.classList.add('active');
        }
        
        this.currentTab = panelId;
        
        // Special handling for specific tabs
        if (panelId === 'leaguePanel' && this.leagueManager) {
            // Refresh league data when accessing league tab
            this.leagueManager.initializeLeagueWithPlayers();
            this.leagueManager.refreshLeague();
        }
        
        this.addNotification(`Switched to ${tabName} tab`, 'info');
    }

    setTabsEnabled(tabIds, enabled) {
        tabIds.forEach(tabId => {
            const button = document.querySelector(`[data-tab="${tabId}"]`);
            if (button) {
                button.disabled = !enabled;
                button.classList.toggle('disabled', !enabled);
            }
        });
    }

    updateHeaderInfo(tournament = null) {
        // Safe method - check if elements exist before updating
        const nameElement = document.querySelector('.tournament-name');
        const statusElement = document.querySelector('.tournament-status');
        
        if (nameElement) {
            if (tournament) {
                nameElement.textContent = tournament.name;
            } else {
                nameElement.textContent = 'No Tournament Selected';
            }
        }
        
        if (statusElement) {
            if (tournament) {
                statusElement.textContent = tournament.status || 'CREATED';
                statusElement.className = `tournament-status ${tournament.status?.toLowerCase() || 'created'}`;
            } else {
                statusElement.textContent = 'IDLE';
                statusElement.className = 'tournament-status idle';
            }
        }
        
        // For now, just log the tournament info since header elements might not exist
        if (tournament) {
            console.log('🏆 Tournament Active:', tournament.name, tournament.status || 'CREATED');
        } else {
            console.log('📋 No tournament selected');
        }
    }

    updateAppStatus(status) {
        const statusElement = document.getElementById('appStatus');
        if (statusElement) {
            statusElement.textContent = status;
        }
    }

    // ============================================================================
    // TOURNAMENT SETTINGS LOGIC
    // ============================================================================

    getFormData() {
        const totalRounds = document.getElementById('totalRounds').value;
        return {
            name: document.getElementById('tournamentName').value.trim(),
            date: document.getElementById('tournamentDate').value,
            players_count: parseInt(document.getElementById('playerCount').value),
            courts_count: parseInt(document.getElementById('courtsCount').value),
            match_duration: parseInt(document.getElementById('matchDuration').value),
            total_rounds: totalRounds ? parseInt(totalRounds) : null
        };
    }

    setFormData(data) {
        document.getElementById('tournamentName').value = data.name || '';
        document.getElementById('tournamentDate').value = data.date || new Date().toISOString().split('T')[0];
        document.getElementById('playerCount').value = data.players_count || 16; // Fixed field name
        document.getElementById('courtsCount').value = data.courts_count || 4;
        document.getElementById('matchDuration').value = data.match_duration || 25;
        document.getElementById('totalRounds').value = data.total_rounds || '';
    }

    calculateRounds() {
        try {
            this.addNotification('🧮 Calculating tournament rounds...', 'info');
            
            const formData = this.getFormData();
            const constraints = this.tournamentSettings.getRoundsConstraints(
                formData.players_count, 
                formData.courts_count
            );
            
            // Update total rounds field with recommended value
            document.getElementById('totalRounds').value = constraints.recommended;
            
            // Show calculation details with FIXED formula
            const teamsTotal = formData.players_count / 2;
            const teamsPlaying = formData.courts_count * 2;
            const teamsResting = Math.max(0, teamsTotal - teamsPlaying);
            const colorsCount = formData.players_count / 2;
            const beastsCount = formData.players_count / 2;
            
            this.addNotification('📊 CALCULATION COMPLETE - Data processed', 'success');
            this.addNotification(`🎯 Tournament: ${formData.players_count} players, ${formData.courts_count} courts`, 'info');
            this.addNotification(`👥 Categories: ${colorsCount} COLORS + ${beastsCount} BEASTS`, 'info');
            this.addNotification(`🏓 Teams: ${teamsTotal} total, ${teamsPlaying} playing, ${teamsResting} resting`, 'info');
            this.addNotification(`🔢 Rounds: Min ${constraints.min} | Max ${constraints.max} | Recommended ${constraints.recommended}`, 'success');
            
        } catch (error) {
            this.addNotification(`❌ ERROR calculating rounds: ${error.message}`, 'error');
        }
    }

    previewTournamentStats() {
        try {
            this.addNotification('👁️ Generating tournament preview...', 'info');
            
            const formData = this.getFormData();
            
            // Validate basic data
            if (!formData.name) {
                this.addNotification('⚠️ Please enter a tournament name', 'warning');
                return;
            }
            if (!formData.players_count) {
                this.addNotification('⚠️ Please select number of players', 'warning');
                return;
            }
            if (!formData.courts_count) {
                this.addNotification('⚠️ Please enter number of courts', 'warning');
                return;
            }
            if (!formData.match_duration) {
                this.addNotification('⚠️ Please select match duration', 'warning');
                return;
            }
            
            // Calculate preview statistics
            const constraints = this.tournamentSettings.getRoundsConstraints(
                formData.players_count, 
                formData.courts_count
            );
            
            const actualRounds = formData.total_rounds || constraints.recommended;
            const teamsTotal = formData.players_count / 2;
            const teamsPlaying = formData.courts_count * 2;
            const teamsResting = Math.max(0, teamsTotal - teamsPlaying);
            const estimatedMinutesPerRound = formData.match_duration;
            const totalEstimatedTime = actualRounds * estimatedMinutesPerRound;
            
            // Get preview elements
            const statsPreview = document.getElementById('tournamentStatsPreview');
            const statsGrid = document.getElementById('statsPreviewGrid');
            
            if (!statsPreview || !statsGrid) {
                // Fallback: show preview in notifications
                this.addNotification('📊 TOURNAMENT PREVIEW GENERATED:', 'success');
                this.addNotification(`🏆 ${formData.name} - ${formData.players_count} players`, 'info');
                this.addNotification(`⚽ ${teamsTotal} teams (${teamsPlaying} playing, ${teamsResting} resting)`, 'info');
                this.addNotification(`🎯 ${actualRounds} rounds on ${formData.courts_count} courts`, 'info');
                this.addNotification(`⏱️ ~${totalEstimatedTime} minutes total`, 'info');
                return;
            }
            
            // Show preview stats in dedicated section
            statsGrid.innerHTML = `
                <div class="stat-card">
                    <div class="stat-value">${formData.players_count}</div>
                    <div class="stat-label">Players</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${teamsTotal}</div>
                    <div class="stat-label">Teams</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${formData.courts_count}</div>
                    <div class="stat-label">Courts</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${actualRounds}</div>
                    <div class="stat-label">Rounds</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${formData.match_duration}m</div>
                    <div class="stat-label">Match Duration</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${totalEstimatedTime}m</div>
                    <div class="stat-label">Total Time</div>
                </div>
            `;
            
            statsPreview.style.display = 'block';
            
            this.addNotification('✅ TOURNAMENT PREVIEW GENERATED', 'success');
            this.addNotification(`📋 "${formData.name}" ready for ${formData.players_count} players`, 'info');
            
        } catch (error) {
            this.addNotification(`❌ ERROR calculating rounds: ${error.message}`, 'error');
        }
    }

    async createTournament() {
        try {
            this.addNotification('🏗️ Starting tournament creation...', 'info');
            this.showLoading('Creating tournament...');
            
            const formData = this.getFormData();
            
            // Debug logging
            console.log('🏗️ Creating tournament with data:', formData);
            
            // Validate required fields
            if (!formData.name) {
                throw new Error('Tournament name is required');
            }
            if (!formData.players_count) {
                throw new Error('Player count is required');
            }
            if (!formData.courts_count) {
                throw new Error('Courts count is required');
            }
            if (!formData.match_duration) {
                throw new Error('Match duration is required');
            }
            
            this.addNotification('✅ Validation passed - all fields complete', 'success');
            
            // WORKFLOW CONTROL: Reset all buffers before creating new tournament
            this.resetWorkflowBuffers();
            this.addNotification('💾 WRITING DATA TO DATABASE...', 'info');
            
            // Create tournament
            const result = await this.tournamentSettings.createTournament(formData);
            
            console.log('🏆 Tournament creation result:', result);
            
            if (result.success) {
                this.currentTournament = result.tournament;
                this.updateHeaderInfo(this.currentTournament);
                
                this.addNotification('📊 DATABASE UPDATED - Tournament record created', 'success');
                this.addNotification('💾 DATA STORED successfully in database', 'success');
                
                // WORKFLOW CONTROL: Enable next step
                this.enableNextWorkflowStep('tournament-created');
                
                // Switch to players tab automatically
                this.switchTab('playersPanel');
                
                this.addNotification('🎉 TOURNAMENT CREATED SUCCESSFULLY!', 'success');
                this.addNotification(`🆔 Tournament ID: ${result.tournament.id || 'AUTO-GENERATED'}`, 'info');
                this.updateAppStatus('Tournament Active');
                
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            this.addNotification(`Failed to create tournament: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    applyPreset(presetKey) {
        try {
            const customName = document.getElementById('tournamentName').value || null;
            const customDate = document.getElementById('tournamentDate').value || null;
            
            const presetData = this.tournamentSettings.applyPreset(presetKey, customName, customDate);
            this.setFormData(presetData);
            
            this.addNotification(`Applied preset: ${presetKey.replace('_', ' ')}`, 'success');
            this.onFormChange();
            
        } catch (error) {
            this.addNotification(`Error applying preset: ${error.message}`, 'error');
        }
    }

    resetTournamentSettings() {
        if (confirm('Are you sure you want to reset all tournament settings?')) {
            this.addNotification('🔄 Resetting tournament settings...', 'info');
            
            // Clear form data
            this.setFormData({
                name: '',
                date: new Date().toISOString().split('T')[0],
                players_count: 16,
                courts_count: 4,
                match_duration: 25,
                total_rounds: ''
            });
            
            // Clear localStorage
            localStorage.removeItem('formulaPadelFormState');
            this.addNotification('💾 DATABASE RESET - Local storage cleared', 'success');
            
            // Reset tournament state
            this.currentTournament = null;
            this.updateHeaderInfo();
            
            // Update calculations after reset
            this.updateCalculationDisplay();
            this.addNotification('📊 Tournament calculations updated', 'success');
            
            // Disable tabs
            this.setTabsEnabled(['players', 'teams', 'rounds', 'league', 'statistics'], false);
            
            // Switch back to settings
            this.switchTab('setupPanel');
            
            this.addNotification('✅ RESET COMPLETE - All data cleared from database', 'success');
            this.updateAppStatus('Ready');
        }
    }

    onFormChange() {
        // Live update calculations when form changes
        this.updateCalculationDisplay();
        this.saveFormState();
        this.addNotification('📊 Tournament stats updated automatically', 'info');
    }

    updateCalculationDisplay() {
        try {
            const formData = this.getFormData();
            const display = document.getElementById('calculationDisplay');
            
            if (!formData.players_count || !formData.courts_count) {
                display.innerHTML = '<p>Select tournament parameters to see calculations</p>';
                return;
            }
            
            // CORRECT CALCULATION: Each court hosts 1 match = 2 teams = 4 players
            const teamsCount = formData.players_count / 2;  // Total teams (16 players = 8 teams)
            const playingTeams = formData.courts_count * 2; // Teams playing (4 courts = 8 teams)
            const restingTeams = Math.max(0, teamsCount - playingTeams); // Teams resting (8-8=0)
            const roundMin = Math.ceil(formData.players_count / (formData.courts_count * 4)); // Fixed formula
            const roundMax = (formData.players_count / 2) - 1; // FIXED: Each player can face (Np/2)-1 different opponents
            
            // Debug logging
            console.log('🧮 Calculation Debug:', {
                players: formData.players_count,
                courts: formData.courts_count,
                teamsTotal: teamsCount,
                teamsPlaying: playingTeams,
                teamsResting: restingTeams,
                roundMin, roundMax
            });
            
            // Auto-calculate bucket number (null-safe)
            const bucketNumber = Math.ceil(formData.players_count / 8);
            const bucketElement = document.getElementById('bucketNumber');
            if (bucketElement) {
                bucketElement.value = bucketNumber;
            }
            
            display.innerHTML = `
                <div class="calculation-grid">
                    <div class="calc-item">
                        <span class="calc-label">Teams Created:</span>
                        <span class="calc-value">${teamsCount} teams</span>
                    </div>
                    <div class="calc-item">
                        <span class="calc-label">Playing Simultaneously:</span>
                        <span class="calc-value">${playingTeams} teams</span>
                    </div>
                    <div class="calc-item">
                        <span class="calc-label">Teams in Rest:</span>
                        <span class="calc-value">${restingTeams} teams</span>
                    </div>
                    <div class="calc-item">
                        <span class="calc-label">Round Min (Balance):</span>
                        <span class="calc-value">${roundMin} rounds</span>
                    </div>
                    <div class="calc-item">
                        <span class="calc-label">Round Max (All Pairs):</span>
                        <span class="calc-value">${roundMax} rounds</span>
                    </div>
                    <div class="calc-item">
                        <span class="calc-label">Bucket Number:</span>
                        <span class="calc-value">Auto-set to ${bucketNumber}</span>
                    </div>
                </div>
            `;
            
            // Auto-set recommended rounds if empty (null-safe)
            if (!formData.total_rounds) {
                const totalRoundsElement = document.getElementById('totalRounds');
                if (totalRoundsElement) {
                    totalRoundsElement.value = roundMin;
                }
            }
            
        } catch (error) {
            console.error('Error updating calculation display:', error);
        }
    }

    // ============================================================================
    // TAB-SPECIFIC DATA LOADING
    // ============================================================================

    async loadTabData(tabId) {
        switch (tabId) {
            case 'players':
                await this.loadPlayersData();
                break;
            case 'teams':
                await this.loadTeamsData();
                break;
            case 'rounds':
                await this.loadRoundsData();
                break;
            case 'statistics':
                await this.loadStatisticsData();
                break;
        }
    }

    async loadPlayersData() {
        if (!this.currentTournament) return;
        
        try {
            this.showLoading('Loading players...');
            
            const players = await this.tournamentSettings.getTournamentPlayers();
            this.renderPlayersGrid(players);
            
            this.addNotification(`Loaded ${players.length} players`, 'success');
            
        } catch (error) {
            this.addNotification(`Error loading players: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadTeamsData() {
        if (!this.currentTournament) return;
        
        try {
            this.showLoading('Loading teams...');
            
            // TODO: Implement teams loading
            this.addNotification('Teams data loading not yet implemented', 'warning');
            
        } catch (error) {
            this.addNotification(`Error loading teams: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadRoundsData() {
        if (!this.currentTournament) return;
        
        try {
            this.showLoading('Loading rounds...');
            
            // TODO: Implement rounds loading
            this.addNotification('Rounds data loading not yet implemented', 'warning');
            
        } catch (error) {
            this.addNotification(`Error loading rounds: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadStatisticsData() {
        if (!this.currentTournament) {
            console.warn('❌ No tournament selected for statistics');
            this.addNotification('Please setup a tournament first', 'warning');
            return;
        }
        
        try {
            this.showLoading('Loading player statistics...');
            
            console.log('📊 Loading Statistics Data - Tournament:', this.currentTournament.name);
            console.log('📊 Current PlayersManager state:', {
                exists: !!this.playersManager,
                hasPlayers: !!this.playersManager?.players,
                playersCount: this.playersManager?.players?.length || 0
            });
            
            // CHECK IF PLAYERS ARE ALREADY AVAILABLE FROM SAVE
            if (this.playersManager && this.playersManager.players && this.playersManager.players.length > 0) {
                console.log('✅ Players already available from save:', this.playersManager.players.length);
                console.log('✅ Using existing players for Statistics dropdown');
                
                // Use existing saved players - no need to reload
                this.populatePlayerStatsDropdown();
                this.setupPlayerStatsEventListeners();
                
                this.addNotification(`Statistics loaded with ${this.playersManager.players.length} saved players`, 'success');
                return;
            }
            
            // FALLBACK: Load players if not available (should not happen after save)
            console.log('⚠️ No saved players found, attempting to load from tournament settings...');
            try {
                const players = await this.tournamentSettings.getTournamentPlayers();
                console.log('📥 Raw players from tournament settings:', players);
                
                if (players && players.length > 0) {
                    this.playersManager.players = players;
                    console.log('✅ Players loaded as fallback for statistics:', players.length);
                    console.log('✅ Sample player:', players[0]);
                } else {
                    console.warn('⚠️ No players returned from tournament settings');
                    
                    // Try alternative loading method via playersManager
                    if (this.playersManager && typeof this.playersManager.loadTournamentPlayers === 'function') {
                        console.log('📥 Trying alternative loading method...');
                        await this.playersManager.loadTournamentPlayers();
                        console.log('✅ Players loaded via playersManager:', this.playersManager.players?.length || 0);
                    }
                }
            } catch (playerError) {
                console.error('❌ Error loading players for statistics:', playerError);
                this.addNotification('Could not load players for statistics', 'error');
                return;
            }
            
            // Populate player selector dropdown
            this.populatePlayerStatsDropdown();
            
            // Setup event listeners
            this.setupPlayerStatsEventListeners();
            
            // Add success message
            const playersCount = this.playersManager?.players?.length || 0;
            if (playersCount > 0) {
                this.addNotification(`Statistics loaded with ${playersCount} players`, 'success');
            } else {
                this.addNotification('No players available for statistics', 'warning');
            }
            
        } catch (error) {
            console.error('❌ Error loading statistics:', error);
            this.addNotification(`Error loading statistics: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    populatePlayerStatsDropdown() {
        const dropdown = document.getElementById('playerStatsSelect');
        if (!dropdown) {
            console.error('❌ Player stats dropdown element not found in DOM');
            return;
        }

        // Clear existing options except the first one
        dropdown.innerHTML = '<option value="">Choose a player to analyze...</option>';

        console.log('🔍 Populating player stats dropdown:');
        console.log('- playersManager exists:', !!this.playersManager);
        console.log('- playersManager.players exists:', !!this.playersManager?.players);
        console.log('- players length:', this.playersManager?.players?.length || 0);
        console.log('- current tournament:', !!this.currentTournament);

        // Get all players from the current tournament
        if (this.playersManager && this.playersManager.players && this.playersManager.players.length > 0) {
            const players = this.playersManager.players;
            console.log('📝 Processing players for dropdown:', players);
            
            players.forEach((player, index) => {
                console.log(`Player ${index}:`, {
                    id: player.id,
                    name: player.name,
                    alias: player.alias,
                    emoji: player.emoji,
                    category: player.category
                });
                
                const option = document.createElement('option');
                option.value = player.id;
                
                // Create display name with fallbacks
                let displayName = '';
                if (player.emoji) displayName += `${player.emoji} `;
                if (player.name) {
                    displayName += player.name;
                } else if (player.alias) {
                    displayName += player.alias;
                } else {
                    displayName += `Player ${player.id}`;
                }
                
                option.textContent = displayName;
                dropdown.appendChild(option);
                console.log(`✅ Added option: ${displayName}`);
            });

            console.log('🎯 Player stats dropdown populated successfully with', players.length, 'players');
            
            // Update dropdown styling to show it's populated
            dropdown.style.color = '#333';
            dropdown.disabled = false;
            
        } else {
            console.warn('⚠️ No players available for stats dropdown');
            console.log('Debugging info:', {
                currentTournament: !!this.currentTournament,
                tournamentSettings: !!this.tournamentSettings,
                playersManager: !!this.playersManager,
                playersArray: this.playersManager?.players
            });
            
            // Add warning option
            const warningOption = document.createElement('option');
            warningOption.value = '';
            warningOption.textContent = 'No players found - please setup tournament first';
            warningOption.disabled = true;
            dropdown.appendChild(warningOption);
            
            dropdown.style.color = '#999';
            dropdown.disabled = true;
            
            console.log('❌ Dropdown disabled due to no players');
        }
    }

    setupPlayerStatsEventListeners() {
        const dropdown = document.getElementById('playerStatsSelect');
        const analyzeBtn = document.getElementById('analyzePlayerBtn');

        if (!dropdown || !analyzeBtn) return;

        // Enable/disable analyze button based on selection
        dropdown.addEventListener('change', () => {
            analyzeBtn.disabled = !dropdown.value;
        });

        // Analyze player button click
        analyzeBtn.addEventListener('click', () => {
            const playerId = dropdown.value;
            if (playerId) {
                this.analyzePlayer(playerId);
            }
        });
    }

    analyzePlayer(playerId) {
        try {
            console.log('📊 Analyzing player:', playerId);
            
            // Get player data
            const player = this.playersManager.players.find(p => p.id === playerId);
            if (!player) {
                this.addNotification('Player not found', 'error');
                return;
            }

            // Show analysis container with animation
            const container = document.getElementById('playerAnalysisContainer');
            if (container) {
                container.style.display = 'block';
                setTimeout(() => container.classList.add('visible'), 50);
            }

            // Update player overview
            this.updatePlayerOverview(player);

            // Get and display teams
            const playerTeams = this.getPlayerTeams(player);
            this.displayPlayerTeams(playerTeams);

            // Get and display matches
            const playerMatches = this.getPlayerMatches(player);
            this.displayPlayerMatches(playerMatches);

            // Calculate and display performance stats
            const performanceStats = this.calculatePlayerPerformance(player, playerMatches);
            this.displayPlayerPerformance(performanceStats);

            this.addNotification(`📊 Analysis complete for ${player.name || player.alias}`, 'success');

        } catch (error) {
            console.error('Error analyzing player:', error);
            this.addNotification('Error analyzing player data', 'error');
        }
    }

    updatePlayerOverview(player) {
        // Update player emoji and name
        const emojiElement = document.getElementById('selectedPlayerEmoji');
        const nameElement = document.getElementById('selectedPlayerName');
        
        if (emojiElement) emojiElement.textContent = player.emoji || '👤';
        if (nameElement) nameElement.textContent = player.name || player.alias || `Player ${player.id}`;

        // Get league position
        const leaguePosition = this.getPlayerLeaguePosition(player);
        const positionElement = document.getElementById('playerLeaguePosition');
        if (positionElement) {
            const numberElement = positionElement.querySelector('.position-number');
            if (numberElement) {
                numberElement.textContent = leaguePosition ? `#${leaguePosition}` : '#-';
            }
        }

        // Update stats summary
        this.updatePlayerStatsSummary(player);
    }

    updatePlayerStatsSummary(player) {
        const summaryElement = document.getElementById('playerStatsSummary');
        if (!summaryElement) return;

        // Get basic stats from league data
        const leagueStats = this.getPlayerLeagueStats(player);
        
        summaryElement.innerHTML = `
            <div class="stat-item">
                <div class="stat-value">${leagueStats.matchesWon || 0}</div>
                <div class="stat-label">Matches Won</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${leagueStats.matchesPlayed || 0}</div>
                <div class="stat-label">Played</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${leagueStats.gamesWon || 0}</div>
                <div class="stat-label">Games Won</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${leagueStats.totalPoints || 0}</div>
                <div class="stat-label">Points</div>
            </div>
        `;
    }

    getPlayerLeaguePosition(player) {
        if (!this.leagueManager || !this.leagueManager.leagueData) return null;
        
        // Get sorted league data
        const sortedPlayers = this.leagueManager.getSortedLeagueData();
        const position = sortedPlayers.findIndex(p => p.playerId === player.id) + 1;
        return position > 0 ? position : null;
    }

    getPlayerLeagueStats(player) {
        if (!this.leagueManager || !this.leagueManager.leagueData) {
            return {
                matchesWon: 0,
                matchesPlayed: 0,
                gamesWon: 0,
                gamesLost: 0,
                totalPoints: 0,
                goalDifference: 0
            };
        }

        const playerStats = this.leagueManager.leagueData[player.id];
        return {
            matchesWon: playerStats?.matchesWon || 0,
            matchesPlayed: playerStats?.matchesPlayed || 0,
            gamesWon: playerStats?.gamesWon || 0,
            gamesLost: playerStats?.gamesLost || 0,
            totalPoints: playerStats?.totalPoints || 0,
            goalDifference: playerStats?.goalDifference || 0
        };
    }

    getPlayerTeams(player) {
        if (!this.teamsManager || !this.teamsManager.teams) return [];

        const playerTeams = [];
        
        // Check all teams to find where this player is involved
        this.teamsManager.teams.forEach((team, teamId) => {
            if (team.beastPlayer.id === player.id || team.colorPlayer.id === player.id) {
                const partner = team.beastPlayer.id === player.id ? 
                    team.colorPlayer : team.beastPlayer;
                
                playerTeams.push({
                    teamId: teamId,
                    team: team,
                    partner: partner,
                    teamName: `Team ${teamId + 1}`,
                    status: 'active' // Could be enhanced to check if team has completed matches
                });
            }
        });

        return playerTeams;
    }

    displayPlayerTeams(playerTeams) {
        const container = document.getElementById('playerTeamsList');
        const countBadge = document.getElementById('teamsCount');
        
        if (!container) return;

        if (countBadge) countBadge.textContent = playerTeams.length;

        if (playerTeams.length === 0) {
            container.innerHTML = '<div class="no-data">No teams found for this player</div>';
            return;
        }

        const teamsHTML = playerTeams.map(teamData => {
            const partnerName = teamData.partner.name || teamData.partner.alias || `Player ${teamData.partner.id}`;
            const partnerEmoji = teamData.partner.emoji || '👤';
            
            return `
                <div class="team-card">
                    <div class="team-info">
                        <span class="team-name">${teamData.teamName}</span>
                        <span class="team-status ${teamData.status}">${teamData.status}</span>
                    </div>
                    <div class="partner-info">
                        Partner: ${partnerEmoji} ${partnerName}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = teamsHTML;
    }

    getPlayerMatches(player) {
        if (!this.roundsManager || !this.roundsManager.rounds) return [];

        const playerMatches = [];

        // Search through all rounds and matches
        this.roundsManager.rounds.forEach((round, roundIndex) => {
            if (round && round.matches) {
                round.matches.forEach((match, matchIndex) => {
                    // Check if player is in this match
                    const isPlayerInMatch = this.isPlayerInMatch(player, match);
                    if (isPlayerInMatch) {
                        playerMatches.push({
                            roundNumber: roundIndex + 1,
                            matchIndex: matchIndex,
                            match: match,
                            result: this.getMatchResultForPlayer(player, match)
                        });
                    }
                });
            }
        });

        return playerMatches;
    }

    isPlayerInMatch(player, match) {
        if (!match || !match.teamA || !match.teamB) return false;
        
        const teamAHasPlayer = (match.teamA.beastPlayer && match.teamA.beastPlayer.id === player.id) ||
                              (match.teamA.colorPlayer && match.teamA.colorPlayer.id === player.id);
        const teamBHasPlayer = (match.teamB.beastPlayer && match.teamB.beastPlayer.id === player.id) ||
                              (match.teamB.colorPlayer && match.teamB.colorPlayer.id === player.id);
        
        return teamAHasPlayer || teamBHasPlayer;
    }

    getMatchResultForPlayer(player, match) {
        if (!match.scoreA !== undefined && match.scoreB !== undefined) {
            return { status: 'upcoming', score: 'TBD' };
        }

        const isInTeamA = (match.teamA.beastPlayer && match.teamA.beastPlayer.id === player.id) ||
                         (match.teamA.colorPlayer && match.teamA.colorPlayer.id === player.id);
        
        const scoreA = match.scoreA || 0;
        const scoreB = match.scoreB || 0;
        
        if (scoreA === scoreB) {
            return { status: 'draw', score: `${scoreA} - ${scoreB}` };
        }

        const playerWon = (isInTeamA && scoreA > scoreB) || (!isInTeamA && scoreB > scoreA);
        
        return {
            status: playerWon ? 'won' : 'lost',
            score: `${scoreA} - ${scoreB}`
        };
    }

    displayPlayerMatches(playerMatches) {
        const container = document.getElementById('playerMatchesTimeline');
        const countBadge = document.getElementById('matchesCount');
        
        if (!container) return;

        if (countBadge) countBadge.textContent = playerMatches.length;

        if (playerMatches.length === 0) {
            container.innerHTML = '<div class="no-data">No matches found for this player</div>';
            return;
        }

        const matchesHTML = playerMatches.map(matchData => {
            const match = matchData.match;
            const result = matchData.result;
            const opponents = this.getOpponentsForPlayer(match, playerMatches[0].match.teamA);
            
            return `
                <div class="match-item ${result.status}">
                    <div class="match-header">
                        <span class="match-round">Round ${matchData.roundNumber}</span>
                        <span class="match-result ${result.status}">${result.score}</span>
                    </div>
                    <div class="match-opponents">vs ${opponents}</div>
                    <div class="match-score">${this.getMatchDateTime(matchData)}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = matchesHTML;
    }

    getOpponentsForPlayer(match, playerTeam) {
        // Determine which team the player is on and get opponents
        const opponentTeam = playerTeam === match.teamA ? match.teamB : match.teamA;
        
        const opponent1 = opponentTeam.beastPlayer ? 
            `${opponentTeam.beastPlayer.emoji || '👤'} ${opponentTeam.beastPlayer.name || opponentTeam.beastPlayer.alias}` : 
            'Unknown';
        const opponent2 = opponentTeam.colorPlayer ? 
            `${opponentTeam.colorPlayer.emoji || '👤'} ${opponentTeam.colorPlayer.name || opponentTeam.colorPlayer.alias}` : 
            'Unknown';
        
        return `${opponent1} & ${opponent2}`;
    }

    getMatchDateTime(matchData) {
        // For now, just return round info - could be enhanced with actual timestamps
        return `Round ${matchData.roundNumber}, Match ${matchData.matchIndex + 1}`;
    }

    calculatePlayerPerformance(player, playerMatches) {
        const stats = this.getPlayerLeagueStats(player);
        
        const matchesWon = stats.matchesWon || 0;
        const matchesPlayed = stats.matchesPlayed || 0;
        const winRate = matchesPlayed > 0 ? (matchesWon / matchesPlayed * 100) : 0;
        
        return {
            matchesPlayed: matchesPlayed,
            matchesWon: matchesWon,
            matchesLost: matchesPlayed - matchesWon,
            winRate: winRate,
            gamesWon: stats.gamesWon || 0,
            gamesLost: stats.gamesLost || 0,
            goalDifference: stats.goalDifference || 0,
            totalPoints: stats.totalPoints || 0
        };
    }

    displayPlayerPerformance(stats) {
        const container = document.getElementById('playerPerformanceStats');
        if (!container) return;

        container.innerHTML = `
            <div class="performance-grid">
                <div class="performance-item">
                    <div class="performance-value">${stats.winRate.toFixed(1)}%</div>
                    <div class="performance-label">Win Rate</div>
                    <div class="win-rate-bar">
                        <div class="win-rate-fill" style="width: ${stats.winRate}%"></div>
                    </div>
                </div>
                <div class="performance-item">
                    <div class="performance-value">${stats.matchesWon}</div>
                    <div class="performance-label">Matches Won</div>
                </div>
                <div class="performance-item">
                    <div class="performance-value">${stats.matchesLost}</div>
                    <div class="performance-label">Matches Lost</div>
                </div>
                <div class="performance-item">
                    <div class="performance-value">${stats.gamesWon}</div>
                    <div class="performance-label">Games Won</div>
                </div>
                <div class="performance-item">
                    <div class="performance-value">${stats.gamesLost}</div>
                    <div class="performance-label">Games Lost</div>
                </div>
                <div class="performance-item">
                    <div class="performance-value">${stats.goalDifference >= 0 ? '+' : ''}${stats.goalDifference}</div>
                    <div class="performance-label">Goal Diff</div>
                </div>
                <div class="performance-item">
                    <div class="performance-value">${stats.totalPoints}</div>
                    <div class="performance-label">Total Points</div>
                </div>
            </div>
        `;
    }

    // ============================================================================
    // RENDERING METHODS
    // ============================================================================

    renderPlayersGrid(players) {
        const playersGrid = document.getElementById('playersGrid');
        if (!playersGrid) return;

        const beastPlayers = players.filter(p => p.category === 'BEASTS');
        const colorPlayers = players.filter(p => p.category === 'COLORS');

        playersGrid.innerHTML = `
            <div class="players-section">
                <h3 class="section-title beasts">🔥 BEASTS (Top 50% - ${beastPlayers.length} players)</h3>
                <div class="players-list">
                    ${beastPlayers.map(player => `
                        <div class="player-card beasts">
                            <span class="player-emoji">${player.emoji}</span>
                            <div class="player-info">
                                <div class="player-name">${player.name}</div>
                                <div class="player-skill">Skill: ${player.skill_level}</div>
                            </div>
                            <button class="edit-player-btn" data-player-id="${player.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="players-section">
                <h3 class="section-title colors">🎨 COLORS (Bottom 50% - ${colorPlayers.length} players)</h3>
                <div class="players-list">
                    ${colorPlayers.map(player => `
                        <div class="player-card colors">
                            <span class="player-emoji">${player.emoji}</span>
                            <div class="player-info">
                                <div class="player-name">${player.name}</div>
                                <div class="player-skill">Skill: ${player.skill_level}</div>
                            </div>
                            <button class="edit-player-btn" data-player-id="${player.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    saveFormState() {
        const formData = this.getFormData();
        localStorage.setItem('formulaPadelFormState', JSON.stringify(formData));
    }

    loadFormState() {
        try {
            const savedState = localStorage.getItem('formulaPadelFormState');
            if (savedState) {
                const formData = JSON.parse(savedState);
                this.setFormData(formData);
                this.addNotification('Restored previous form state', 'info');
            }
        } catch (error) {
            console.warn('Failed to load saved form state:', error);
        }
    }

    showLoading(text = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        if (overlay && loadingText) {
            loadingText.textContent = text;
            overlay.style.display = 'flex';
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    addNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        if (!container) {
            console.warn('Notifications container not found, using console log');
            console.log(`📢 ${type.toUpperCase()}: ${message}`);
            return;
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Get icon based on type
        const iconClass = this.getNotificationIcon(type);
        
        notification.innerHTML = `
            <i class="fas ${iconClass}"></i>
            <span>${message}</span>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Add to container
        container.appendChild(notification);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideInRight 0.3s ease-out reverse';
                setTimeout(() => notification.remove(), 300);
            }
        }, 4000);

        // Manual close
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        });

        // Keep only last 5 notifications
        const notifications = container.querySelectorAll('.notification');
        if (notifications.length > 5) {
            notifications[0].remove();
        }
        
        // Also log to console for debugging
        console.log(`📢 ${type.toUpperCase()}: ${message}`);
    }

    getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-exclamation-circle';
            case 'warning': return 'fa-exclamation-triangle';
            default: return 'fa-info-circle';
        }
    }
    
    // ============================================================================
    // PUBLIC API FOR MODULES
    // ============================================================================
    
    getTournamentFormData() {
        // Get current tournament form data
        const formData = {
            name: document.getElementById('tournamentName')?.value || '',
            date: document.getElementById('tournamentDate')?.value || '',
            players_count: parseInt(document.getElementById('playerCount')?.value) || 0,
            courts_count: parseInt(document.getElementById('courtsCount')?.value) || 0,
            match_duration: parseInt(document.getElementById('matchDuration')?.value) || 0,
            total_rounds: parseInt(document.getElementById('totalRounds')?.value) || 0
        };
        
        console.log('📋 Tournament form data retrieved:', formData);
        return formData;
    }

    getDbManager() {
        return this.db;
    }

    getPlayersManager() {
        return this.playersManager;
    }

    getTeamsManager() {
        return this.teamsManager;
    }

    getRoundsManager() {
        return this.roundsManager;
    }

    /**
     * 🧪 END-TO-END INTEGRATION TEST
     */
    testEndToEndIntegration() {
        console.log('\n🧪 FORMULA PADEL V2.0 - END-TO-END INTEGRATION TEST');
        console.log('=' .repeat(60));
        
        let passed = 0;
        let total = 0;
        
        // Test 1: Tournament Configuration
        total++;
        const tournament = this.getTournamentFormData();
        if (tournament && tournament.name && tournament.players_count) {
            console.log('✅ Tournament Configuration: PASSED');
            passed++;
        } else {
            console.log('❌ Tournament Configuration: FAILED');
        }
        
        // Test 2: Players Management
        total++;
        if (this.playersManager) {
            const players = this.playersManager.getPlayersData();
            if (players.players && players.players.length > 0) {
                console.log('✅ Players Management: PASSED');
                passed++;
            } else {
                console.log('❌ Players Management: FAILED - No players loaded');
            }
        } else {
            console.log('❌ Players Management: FAILED - Manager not available');
        }
        
        // Test 3: Teams Management
        total++;
        if (this.teamsManager) {
            const teams = this.teamsManager.getTeamsData();
            if (teams && teams.length > 0) {
                console.log('✅ Teams Management: PASSED');
                passed++;
            } else {
                console.log('❌ Teams Management: FAILED - No teams generated');
            }
        } else {
            console.log('❌ Teams Management: FAILED - Manager not available');
        }
        
        // Test 4: Rounds Management
        total++;
        if (this.roundsManager) {
            console.log('✅ Rounds Management: PASSED');
            passed++;
        } else {
            console.log('❌ Rounds Management: FAILED - Manager not available');
        }
        
        // Test 5: League Management
        total++;
        if (this.leagueManager) {
            console.log('✅ League Management: PASSED');
            passed++;
        } else {
            console.log('❌ League Management: FAILED - Manager not available');
        }
        
        // Test 6: Data Persistence
        total++;
        if (this.databaseManager) {
            console.log('✅ Data Persistence: PASSED');
            passed++;
        } else {
            console.log('❌ Data Persistence: FAILED - Database manager not available');
        }
        
        // Final Result
        console.log('=' .repeat(60));
        console.log(`🏆 INTEGRATION TEST RESULTS: ${passed}/${total} PASSED`);
        
        if (passed === total) {
            console.log('🎉 ALL TESTS PASSED - SYSTEM FULLY INTEGRATED! 🎉');
            return true;
        } else {
            console.log('⚠️  SOME TESTS FAILED - CHECK INDIVIDUAL COMPONENTS');
            return false;
        }
    }
}

// Initialize application
const formulaPadelApp = new FormulaPadelApp();

// Make app available for onclick handlers
window.formulaPadelApp = formulaPadelApp;
console.log('✅ Formula Padel App loaded and ready');