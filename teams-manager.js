/**
 * FORMULA PADEL - TEAMS MANAGER V2.0
 * Modulo dedicato alla gestione delle squadre
 * Implementa algoritmi di pairing BEAST+COLOR secondo MASTERGUIDE
 */

class TeamsManager {
    constructor(app) {
        this.app = app;
        this.teams = [];
        this.currentRound = 1;
        this.teamHistory = []; // Track all teams created across rounds
        this.restRotation = []; // Track who's resting in current teams
        this.restHistory = {}; // Track player rest patterns across rounds
        this.usedPairings = new Set(); // Track used player pairings across rounds
        
        this.setupEventListeners();
        this.loadTeamsFromStorage(); // Load saved data
        this.checkPlayersStatus(); // Check if players are ready
    }

    // ============================================================================
    // INITIALIZATION & STATUS CHECK
    // ============================================================================

    async checkPlayersStatus() {
        try {
            const savedPlayersData = await this.app.getDbManager().loadSavedPlayers();
            this.updateTeamsStatusUI(savedPlayersData);
        } catch (error) {
            console.error('Error checking players status:', error);
            this.updateTeamsStatusUI(null);
        }
    }

    updateTeamsStatusUI(savedPlayersData) {
        const roundInfo = document.getElementById('currentRoundInfo');
        const generateBtn = document.getElementById('generateTeamsBtn');
        const loadBtn = document.getElementById('loadTeamsBtn');
        
        // Check if there are saved teams
        const hasSavedTeams = localStorage.getItem('teams_history') !== null;
        
        if (savedPlayersData && savedPlayersData.players && savedPlayersData.players.length > 0) {
            // Players are saved and ready
            if (roundInfo) {
                roundInfo.innerHTML = `
                    <h3><i class="fas fa-flag"></i> Round ${this.currentRound} Teams</h3>
                    <p>✅ ${savedPlayersData.players.length} players ready (saved ${new Date(savedPlayersData.metadata.timestamp).toLocaleString()})</p>
                `;
            }
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.classList.remove('disabled');
            }
        } else {
            // Players not saved yet
            if (roundInfo) {
                roundInfo.innerHTML = `
                    <h3><i class="fas fa-flag"></i> Round ${this.currentRound} Teams</h3>
                    <p>❌ Waiting for players to be saved in Players Management tab</p>
                `;
            }
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.classList.add('disabled');
            }
        }
        
        // Update Load Teams button
        if (loadBtn) {
            if (hasSavedTeams) {
                loadBtn.disabled = false;
                loadBtn.classList.remove('disabled');
                loadBtn.title = 'Load previously saved teams';
            } else {
                loadBtn.disabled = true;
                loadBtn.classList.add('disabled');
                loadBtn.title = 'No saved teams available';
            }
        }
    }

    // ============================================================================
    // EVENT LISTENERS
    // ============================================================================

    setupEventListeners() {
        // Team generation buttons
        const loadBtn = document.getElementById('loadTeamsBtn');
        const generateBtn = document.getElementById('generateTeamsBtn');
        const shuffleBtn = document.getElementById('shuffleTeamsBtn');
        const saveBtn = document.getElementById('saveTeamsBtn');
        const resetBtn = document.getElementById('resetTeamsBtn');

        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.loadSavedTeams());
        }

        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateTeamsForRound());
        }
        
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => this.shuffleTeams());
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveTeamsConfiguration());
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to reset all rounds and teams data?')) {
                    this.resetAllTeams();
                }
            });
        }
    }

    resetAllTeams() {
        this.teams = [];
        this.teamHistory = [];
        this.currentRound = 1;
        this.restRotation = [];
        this.restHistory = {};
        this.usedPairings = new Set();
        
        // Clear from localStorage
        localStorage.removeItem('teams_history');
        localStorage.removeItem('tournament_teams_meta');
        
        // Reset UI
        this.renderAllRoundsGroups();
        
        this.app.addNotification('All rounds and teams data has been reset', 'info');
    }

    // ============================================================================
    // PERSISTENCE & DATA MANAGEMENT
    // ============================================================================
    
    saveTeamsToStorage() {
        try {
            // Save team history
            localStorage.setItem('teams_history', JSON.stringify(this.teamHistory));
            
            // Save current round and used pairings
            localStorage.setItem('tournament_teams_meta', JSON.stringify({
                currentRound: this.currentRound,
                usedPairings: Array.from(this.usedPairings),
                timestamp: new Date().toISOString()
            }));
            
        } catch (error) {
            console.error('Error saving teams to storage:', error);
        }
    }

    loadTeamsFromStorage() {
        try {
            // Load team history
            const historyData = localStorage.getItem('teams_history');
            if (historyData) {
                this.teamHistory = JSON.parse(historyData);
                console.log(`📂 Loaded ${this.teamHistory.length} groups from storage`);
                
                // Rebuild used pairings from history
                this.rebuildUsedPairingsFromHistory();
                
                // Render if we have history
                if (this.teamHistory.length > 0) {
                    this.renderAllRoundsGroups();
                }
            } else {
                console.log('📂 No team history found in storage');
            }
            
            // Load meta data
            const metaData = localStorage.getItem('tournament_teams_meta');
            if (metaData) {
                const data = JSON.parse(metaData);
                this.currentRound = data.currentRound || 1;
                // Don't overwrite the rebuilt pairings, just add any extra ones
                const savedPairings = new Set(data.usedPairings || []);
                savedPairings.forEach(pairing => this.usedPairings.add(pairing));
            }
            
        } catch (error) {
            console.error('Error loading teams from storage:', error);
        }
    }

    rebuildUsedPairingsFromHistory() {
        // Reset and rebuild all used pairings from team history
        this.usedPairings = new Set();
        
        this.teamHistory.forEach(roundData => {
            if (roundData.teams) {
                roundData.teams.forEach(team => {
                    if (team.beastPlayer && team.colorPlayer) {
                        // Use alias instead of ID for stable tracking
                        const beastAlias = team.beastPlayer.alias;
                        const colorAlias = team.colorPlayer.alias;
                        const pairingKey = [beastAlias, colorAlias].sort().join('-');
                        this.usedPairings.add(pairingKey);
                    }
                });
            }
        });
        
        console.log(`🔄 Rebuilt ${this.usedPairings.size} used pairings from history`);
        console.log('📋 Used pairings:', Array.from(this.usedPairings));
    }

    loadSavedTeams() {
        try {
            // Check if there are saved teams
            const historyData = localStorage.getItem('teams_history');
            if (!historyData) {
                this.app.addNotification('No saved teams found. Please generate teams first.', 'warning');
                return;
            }

            // Parse and load teams
            this.teamHistory = JSON.parse(historyData);
            
            if (this.teamHistory.length === 0) {
                this.app.addNotification('No teams found in storage.', 'warning');
                return;
            }

            // Rebuild used pairings from the loaded history
            this.rebuildUsedPairingsFromHistory();

            // Load meta data
            const metaData = localStorage.getItem('tournament_teams_meta');
            if (metaData) {
                const data = JSON.parse(metaData);
                this.currentRound = data.currentRound || 1;
                // Add any extra pairings from meta data
                const savedPairings = new Set(data.usedPairings || []);
                savedPairings.forEach(pairing => this.usedPairings.add(pairing));
            }

            // Render the teams and show section
            this.renderAllRoundsGroups();
            this.showTeamsSection();
            
            // Notify rounds manager that teams are available
            const roundsManager = this.app.getRoundsManager();
            if (roundsManager) {
                roundsManager.refreshTeamsStatus();
            }
            
            // Show success message
            const totalTeams = this.teamHistory.reduce((sum, round) => sum + round.teams.length, 0);
            const roundsCount = this.teamHistory.length;
            
            console.log(`📂 Loaded ${totalTeams} teams from ${roundsCount} rounds`);
            this.app.addNotification(`✅ Loaded ${totalTeams} teams from ${roundsCount} saved rounds!`, 'success');
            
        } catch (error) {
            console.error('Error loading saved teams:', error);
            this.app.addNotification('Error loading saved teams. Please try again.', 'error');
        }
    }

    updateUsedPairings(teams) {
        teams.forEach(team => {
            // Use alias instead of ID for stable tracking
            const beastAlias = team.beastPlayer.alias;
            const colorAlias = team.colorPlayer.alias;
            const pairingKey = [beastAlias, colorAlias].sort().join('-');
            this.usedPairings.add(pairingKey);
            console.log(`📝 Added pairing to history: ${pairingKey}`);
        });
    }

    // ============================================================================
    // TEAM GENERATION ALGORITHM
    // ============================================================================

    async generateTeamsForRound() {
        try {
            // Get tournament settings first
            const tournamentData = this.app.getTournamentFormData();
            if (!tournamentData) {
                this.app.addNotification('Tournament settings not found.', 'error');
                return;
            }

            console.log('🎯 Tournament data:', tournamentData);
            console.log('🎯 Rounds from tournament:', tournamentData.total_rounds, typeof tournamentData.total_rounds);

            // Check if we've reached the maximum rounds limit based on existing groups
            const existingGroups = this.teamHistory.length;
            const maxRounds = parseInt(tournamentData.total_rounds) || 1;
            
            console.log(`🔍 Generate check: existingGroups=${existingGroups}, maxRounds=${maxRounds}`);
            console.log('🔍 teamHistory:', this.teamHistory.map(h => h.round));
            
            if (maxRounds <= 0) {
                this.app.addNotification('Invalid tournament rounds configuration. Please check tournament settings.', 'error');
                return;
            }
            
            if (existingGroups >= maxRounds) {
                this.app.addNotification(`Cannot generate more groups. Tournament limit: ${maxRounds} rounds. You have already generated ${existingGroups} groups.`, 'warning');
                return;
            }

            // CRITICAL: Verify players are saved and locked before generating teams
            const savedPlayersData = await this.verifyPlayersAreSaved();
            if (!savedPlayersData) {
                return; // Error already shown in verifyPlayersAreSaved
            }

            // Process players into BEASTS and COLORS
            const playersData = this.processPlayersData(savedPlayersData.players);

            // Check maximum possible teams
            const maxPossibleTeams = Math.min(playersData.beasts.length, playersData.colors.length);
            if (maxPossibleTeams === 0) {
                this.app.addNotification('No teams can be generated. Check player categories.', 'error');
                return;
            }

            this.app.addNotification(`Generating teams for Group ${this.currentRound}...`, 'info');

            // TOURNAMENT SIMULATION: Check if extra rounds needed for fairness
            const simulationResult = this.simulateCompleteTournament(playersData, tournamentData, maxRounds);
            if (simulationResult.needsExtraRound) {
                this.app.addNotification(
                    `⚠️ Extra round needed to complete the tournament fairly. Click "Generate Extra Round" button to balance matches.`, 
                    'warning'
                );
                console.warn('🚨 SIMULATION RESULT: Extra round required for fair play distribution');
                
                // Store simulation result for extra round generation
                this.pendingExtraRound = {
                    simulationResult,
                    playersData,
                    tournamentData
                };
                
                // Show extra round button
                this.showExtraRoundButton();
            }

            // Generate teams using BEAST + COLOR pairing with anti-duplication
            const newTeams = this.createTeamPairingsWithAntiDuplication(playersData, tournamentData);
            
            // Calculate team rankings
            this.calculateTeamRankings(newTeams);
            
            // Store teams for this round
            this.teams = newTeams;
            
            console.log(`➕ Adding group ${this.currentRound} to history. Current history length: ${this.teamHistory.length}`);
            
            this.teamHistory.push({
                round: this.currentRound,
                teams: [...newTeams],
                timestamp: new Date().toISOString()
            });
            
            console.log(`✅ After adding: history length = ${this.teamHistory.length}`);

            // Update used pairings for anti-duplication
            this.updateUsedPairings(newTeams);

            // Save to localStorage
            this.saveTeamsToStorage();

            // AUTO-RESET ROUNDS when teams are saved
            const roundsManager = this.app.getRoundsManager();
            if (roundsManager) {
                roundsManager.clearRoundsData();
                console.log('🔄 Auto-reset rounds after teams save');
            }

            // Update UI with round groups
            this.renderAllRoundsGroups();
            this.showTeamsSection();
            
            // Notify rounds manager that teams are available
            if (roundsManager) {
                roundsManager.refreshTeamsStatus();
            }
            
            // Increment round for next manual generation
            this.currentRound++;
            
            this.app.addNotification(
                `Round ${this.currentRound - 1}: ${newTeams.length} teams generated successfully`, 
                'success'
            );

        } catch (error) {
            this.app.addNotification(`Error generating teams: ${error.message}`, 'error');
            console.error('Team generation error:', error);
        }
    }

    async verifyPlayersAreSaved() {
        try {
            // Check if players are saved in localStorage
            const savedPlayersData = await this.app.getDbManager().loadSavedPlayers();
            
            if (!savedPlayersData || !savedPlayersData.players || savedPlayersData.players.length === 0) {
                this.app.addNotification(
                    '❌ No saved players found! Please complete and SAVE players configuration in Players tab first.',
                    'error'
                );
                
                // Highlight players tab to guide user
                this.highlightPlayersTab();
                return null;
            }

            // Verify players configuration is complete
            if (!savedPlayersData.metadata || !savedPlayersData.metadata.timestamp) {
                this.app.addNotification(
                    '❌ Players configuration incomplete! Please save players properly.',
                    'error'
                );
                return null;
            }

            // Success - players are properly saved
            console.log(`✅ Verified ${savedPlayersData.players.length} saved players for team generation`);
            console.log('📅 Players saved at:', savedPlayersData.metadata.timestamp);
            
            this.app.addNotification(
                `✅ Using ${savedPlayersData.players.length} saved players (${savedPlayersData.metadata.beastCount} BEASTS, ${savedPlayersData.metadata.colorCount} COLORS)`,
                'info'
            );

            return savedPlayersData;

        } catch (error) {
            this.app.addNotification(
                '❌ Error verifying players configuration. Please check Players tab.',
                'error'
            );
            console.error('Players verification error:', error);
            return null;
        }
    }

    highlightPlayersTab() {
        // Visual feedback to guide user to Players tab
        const playersTab = document.getElementById('tabPlayers');
        if (playersTab) {
            playersTab.classList.add('attention');
            setTimeout(() => {
                if (playersTab) playersTab.classList.remove('attention');
            }, 3000);
        }
    }

    processPlayersData(players) {
        const beasts = players.filter(p => p.category === 'BEAST');
        const colors = players.filter(p => p.category === 'COLOR');
        
        console.log(`📊 Loaded players: ${beasts.length} BEASTS, ${colors.length} COLORS`);
        
        return {
            beasts,
            colors,
            totalCount: players.length,
            beastsCount: beasts.length,
            colorsCount: colors.length
        };
    }

    createTeamPairingsWithAntiDuplication(playersData, tournamentData) {
        const { beasts, colors } = playersData;
        const teams = [];
        
        console.log(`🔄 Starting Group ${this.currentRound} generation...`);
        console.log(`📋 Current used pairings (${this.usedPairings.size}):`, Array.from(this.usedPairings));
        
        // PLAYER-LEVEL REST CALCULATION
        const courtsCount = tournamentData.courts_count || 4;
        const playingPlayersCount = courtsCount * 4; // 4 players per court (2 teams of 2)
        const totalPlayers = playersData.totalCount;
        const restingPlayersCount = Math.max(0, totalPlayers - playingPlayersCount);
        
        console.log(`\n🏃‍♀️ REST CALCULATION FOR ROUND ${this.currentRound}:`);
        console.log(`📊 Courts: ${courtsCount} | Playing: ${playingPlayersCount} | Total: ${totalPlayers} | Resting: ${restingPlayersCount}`);
        
        // Get players that rested in previous round (if any)
        const priorityPlayers = this.getPlayersRestedPreviousRound();
        
        // Sort players to give priority to those who rested
        const sortedBeasts = this.sortPlayersByRestPriority(beasts, priorityPlayers);
        const sortedColors = this.sortPlayersByRestPriority(colors, priorityPlayers);
        
        console.log(`🎯 Priority beasts (rested last):`, sortedBeasts.slice(0, 5).map(p => `${p.alias}(${this.getPlayerRestRounds(p.id).length})`));
        console.log(`🎯 Priority colors (rested last):`, sortedColors.slice(0, 5).map(p => `${p.alias}(${this.getPlayerRestRounds(p.id).length})`));
        
        // Create teams with priority system
        const maxTeams = Math.min(sortedBeasts.length, sortedColors.length);
        const playingTeams = Math.floor(playingPlayersCount / 2); // 2 players per team
        const actualTeamsToCreate = Math.min(maxTeams, playingTeams);
        
        console.log(`🏆 Creating ${actualTeamsToCreate} teams (max possible: ${maxTeams}, court limit: ${playingTeams})`);
        
        for (let i = 0; i < actualTeamsToCreate; i++) {
            const beastPlayer = sortedBeasts[i];
            let colorPlayer = null;
            
            // Find best color match with anti-duplication + rest priority
            for (let j = 0; j < sortedColors.length; j++) {
                const candidateColor = sortedColors[j];
                const pairingKey = [beastPlayer.alias, candidateColor.alias].sort().join('-');
                
                if (!this.usedPairings.has(pairingKey)) {
                    colorPlayer = candidateColor;
                    sortedColors.splice(j, 1);
                    console.log(`✅ Team ${i+1}: ${beastPlayer.alias} + ${candidateColor.alias} (${pairingKey})`);
                    break;
                } else {
                    console.log(`❌ Skipping used pairing: ${beastPlayer.alias} + ${candidateColor.alias}`);
                }
            }
            
            // Fallback for reused pairing if needed
            if (!colorPlayer && sortedColors.length > 0) {
                colorPlayer = sortedColors.shift();
                const pairingKey = [beastPlayer.alias, colorPlayer.alias].sort().join('-');
                console.warn(`⚠️ Reused pairing: ${beastPlayer.alias} + ${colorPlayer.alias} (${pairingKey})`);
            }
            
            if (colorPlayer) {
                const team = this.createTeam(beastPlayer, colorPlayer, i + 1);
                teams.push(team);
            }
        }
        
        // Track resting players for this round
        this.trackRestingPlayers(playersData.beasts, playersData.colors, teams, restingPlayersCount);
        
        return teams;
    }

    // ============================================================================
    // PLAYER-LEVEL REST PRIORITY SYSTEM
    // ============================================================================

    getPlayersRestedPreviousRound() {
        const previousRound = this.currentRound - 1;
        if (previousRound < 1) return [];
        
        const restedPlayers = [];
        Object.keys(this.restHistory).forEach(playerId => {
            const restRounds = this.restHistory[playerId];
            if (restRounds.includes(previousRound)) {
                restedPlayers.push(playerId);
            }
        });
        
        console.log(`🔍 Players who rested in Round ${previousRound}:`, restedPlayers);
        return restedPlayers;
    }

    sortPlayersByRestPriority(players, priorityPlayerIds) {
        if (!players || !Array.isArray(players)) {
            console.error('Invalid players array in sortPlayersByRestPriority');
            return [];
        }
        
        if (!priorityPlayerIds || !Array.isArray(priorityPlayerIds)) {
            console.warn('Invalid priorityPlayerIds in sortPlayersByRestPriority, using empty array');
            priorityPlayerIds = [];
        }
        
        return players.filter(player => player && player.id).sort((a, b) => {
            // Priority 1: Players who rested last round go first
            const aRested = priorityPlayerIds.includes(a.id);
            const bRested = priorityPlayerIds.includes(b.id);
            
            if (aRested && !bRested) return -1;
            if (!aRested && bRested) return 1;
            
            // Priority 2: Players with fewer total rests go first
            const aRestCount = this.getPlayerRestRounds(a.id).length;
            const bRestCount = this.getPlayerRestRounds(b.id).length;
            
            if (aRestCount !== bRestCount) {
                return aRestCount - bRestCount;
            }
            
            // Priority 3: Random for fairness
            return Math.random() - 0.5;
        });
    }

    getPlayerRestRounds(playerId) {
        return this.restHistory[playerId] || [];
    }

    trackRestingPlayers(beasts, colors, createdTeams, restingCount) {
        if (restingCount <= 0) {
            console.log('✅ All players are playing this round');
            return;
        }
        
        // Get all players
        const allPlayers = [...beasts, ...colors];
        
        // Get playing players from created teams
        const playingPlayerIds = new Set();
        createdTeams.forEach(team => {
            if (team.beastPlayer && team.beastPlayer.id) {
                playingPlayerIds.add(team.beastPlayer.id);
            }
            if (team.colorPlayer && team.colorPlayer.id) {
                playingPlayerIds.add(team.colorPlayer.id);
            }
        });
        
        // Identify resting players
        const restingPlayers = allPlayers.filter(player => player && player.id && !playingPlayerIds.has(player.id));
        
        console.log(`\n💤 RESTING PLAYERS FOR ROUND ${this.currentRound}:`);
        restingPlayers.forEach(player => {
            if (player && player.alias && player.name && player.id) {
                console.log(`  - ${player.alias} (${player.name}) | Previous rests: ${this.getPlayerRestRounds(player.id).length}`);
                this.addPlayerRest(player.id, this.currentRound);
            }
        });
        
        if (restingPlayers.length !== restingCount) {
            console.warn(`⚠️ Expected ${restingCount} resting players, but got ${restingPlayers.length}`);
        }
    }

    addPlayerRest(playerId, round) {
        if (!this.restHistory[playerId]) {
            this.restHistory[playerId] = [];
        }
        this.restHistory[playerId].push(round);
    }

    createTeamPairings(playersData, tournamentData) {
        const { beasts, colors } = playersData;
        const teams = [];
        
        // Shuffle arrays for randomization
        const shuffledBeasts = [...beasts].sort(() => Math.random() - 0.5);
        const shuffledColors = [...colors].sort(() => Math.random() - 0.5);
        
        // Create teams by pairing BEAST + COLOR
        const maxTeams = Math.min(shuffledBeasts.length, shuffledColors.length);
        
        for (let i = 0; i < maxTeams; i++) {
            const beastPlayer = shuffledBeasts[i];
            const colorPlayer = shuffledColors[i];
            
            // Check for duplicate pairings in previous rounds
            if (this.currentRound > 1 && this.isPairDuplicate(beastPlayer, colorPlayer)) {
                // Try to find alternative pairing
                const altColorPlayer = this.findAlternativePartner(beastPlayer, shuffledColors, i);
                if (altColorPlayer) {
                    // Swap positions
                    const altIndex = shuffledColors.indexOf(altColorPlayer);
                    shuffledColors[altIndex] = colorPlayer;
                    shuffledColors[i] = altColorPlayer;
                }
            }

            const team = this.createTeam(beastPlayer, shuffledColors[i], teams.length + 1);
            teams.push(team);
        }

        console.log(`🏆 Generated ${teams.length} teams for Round ${this.currentRound}`);
        return teams;
    }

    createTeam(beastPlayer, colorPlayer, teamNumber) {
        const teamScore = (beastPlayer.PlayerScore + colorPlayer.PlayerScore) / 2;
        
        return {
            id: `R${this.currentRound}T${teamNumber}`,
            number: teamNumber,
            round: this.currentRound,
            beastPlayer: beastPlayer,
            colorPlayer: colorPlayer,
            name: `${colorPlayer.alias} ${beastPlayer.alias}`, // COLOR Alias + BEAST Alias
            emojiName: `${colorPlayer.aliasEmoji}${beastPlayer.aliasEmoji}`, // Emoji combination
            displayName: `${colorPlayer.name} & ${beastPlayer.name}`,
            score: Math.round(teamScore * 10) / 10, // Round to 1 decimal
            status: 'ready', // ready, playing, resting
            court: null,
            position: teamNumber
        };
    }

    // ============================================================================
    // DUPLICATE PREVENTION & PARTNER SELECTION
    // ============================================================================

    isPairDuplicate(beastPlayer, colorPlayer) {
        return this.teamHistory.some(roundData => 
            roundData.teams.some(team => 
                (team.beastPlayer.id === beastPlayer.id && team.colorPlayer.id === colorPlayer.id) ||
                (team.beastPlayer.id === colorPlayer.id && team.colorPlayer.id === beastPlayer.id)
            )
        );
    }

    findAlternativePartner(beastPlayer, colorPlayers, startIndex) {
        for (let i = startIndex + 1; i < colorPlayers.length; i++) {
            if (!this.isPairDuplicate(beastPlayer, colorPlayers[i])) {
                return colorPlayers[i];
            }
        }
        return null;
    }

    // ============================================================================
    // EXTRA ROUND GENERATION FOR FAIRNESS
    // ============================================================================

    showExtraRoundButton() {
        const container = document.getElementById('teamsRoundsContainer');
        if (!container) return;
        
        // Remove existing extra round button
        const existingBtn = document.getElementById('extraRoundBtn');
        if (existingBtn) existingBtn.remove();
        
        // Calculate how many players need balancing
        const { simulationResult } = this.pendingExtraRound;
        const playersNeedingBalance = Object.entries(simulationResult.playerMatchCounts)
            .filter(([, count]) => count === simulationResult.minMatches).length;
        
        const teamsNeeded = Math.ceil(playersNeedingBalance / 2);
        
        // Create extra round button
        const extraRoundDiv = document.createElement('div');
        extraRoundDiv.className = 'extra-round-section';
        extraRoundDiv.innerHTML = `
            <div class="notification warning">
                <h3>⚠️ Tournament Fairness Alert</h3>
                <p><strong>${playersNeedingBalance} players</strong> will have fewer matches than others (${simulationResult.minMatches} vs ${simulationResult.maxMatches} matches).</p>
                <p><strong>Solution:</strong> Generate extra round with ${teamsNeeded} team${teamsNeeded !== 1 ? 's' : ''} to balance match distribution.</p>
                <p><em>Note: Extra round can use fewer courts than available if needed for fairness.</em></p>
                <button id="extraRoundBtn" class="btn btn-warning">
                    🎯 Generate Extra Round (${teamsNeeded} team${teamsNeeded !== 1 ? 's' : ''})
                </button>
            </div>
        `;
        
        container.insertBefore(extraRoundDiv, container.firstChild);
        
        // Add event listener
        document.getElementById('extraRoundBtn').addEventListener('click', () => {
            this.generateExtraRound();
        });
    }

    generateExtraRound() {
        if (!this.pendingExtraRound) {
            console.error('No pending extra round data found');
            return;
        }
        
        console.log('\n🎯 GENERATING EXTRA ROUND FOR FAIRNESS');
        console.log('====================================');
        
        const { simulationResult, playersData, tournamentData } = this.pendingExtraRound;
        
        // Determine which players need more matches
        const playerMatchCounts = simulationResult.playerMatchCounts;
        const minMatches = simulationResult.minMatches;
        
        // Get players who have fewer matches than the maximum
        const priorityPlayers = [];
        Object.entries(playerMatchCounts).forEach(([playerId, matchCount]) => {
            if (matchCount === minMatches) {
                // Find player object
                const player = [...playersData.beasts, ...playersData.colors].find(p => p.id === playerId);
                if (player) {
                    priorityPlayers.push(player);
                }
            }
        });
        
        console.log(`🎯 Priority players (${minMatches} matches):`, priorityPlayers.map(p => p.alias));
        
        // Generate extra round with priority players
        const extraRoundNumber = this.currentRound + 1;
        this.currentRound = extraRoundNumber;
        
        // Create teams for extra round with priority for players with fewer matches
        const extraTeams = this.createExtraRoundTeams(priorityPlayers, playersData, tournamentData);
        
        if (extraTeams.length > 0) {
            // Store extra round teams
            this.teams = extraTeams;
            this.teamHistory.push({
                round: extraRoundNumber,
                teams: extraTeams,
                timestamp: new Date().toISOString(),
                isExtraRound: true
            });
            
            // Update UI
            this.renderTeamsGrid();
            
            // Clear pending extra round
            this.pendingExtraRound = null;
            
            // Remove extra round button
            const extraRoundSection = document.querySelector('.extra-round-section');
            if (extraRoundSection) extraRoundSection.remove();
            
            // Show success notification
            this.app.addNotification(
                `✅ Extra Round ${extraRoundNumber} generated with ${extraTeams.length} team${extraTeams.length !== 1 ? 's' : ''}! Match distribution is now balanced for all players.`, 
                'success'
            );
            
            console.log(`✅ Extra Round ${extraRoundNumber} created with ${extraTeams.length} teams (using ${extraTeams.length} out of ${tournamentData.courts_count || 4} available courts)`);
        }
    }

    createExtraRoundTeams(priorityPlayers, playersData, tournamentData) {
        console.log('🎯 CREATING EXTRA ROUND TEAMS FOR FAIRNESS');
        console.log(`🎯 Priority players needing extra matches: ${priorityPlayers.length}`);
        
        // Separate priority players by category
        const priorityBeasts = priorityPlayers.filter(p => p.category === 'BEAST');
        const priorityColors = priorityPlayers.filter(p => p.category === 'COLOR');
        
        console.log(`🎯 Priority breakdown: ${priorityBeasts.length} beasts, ${priorityColors.length} colors`);
        
        // For extra rounds, we only need to balance matches - not fill all courts
        // Calculate minimum teams needed to balance the matches
        const priorityPlayersCount = priorityPlayers.length;
        const maxPossibleTeams = Math.floor(priorityPlayersCount / 2); // Each team needs 2 players
        
        // If we have exactly 4 priority players -> 2 teams (1 match)
        // If we have 6 priority players -> 3 teams, but we can only make pairs
        const targetTeams = Math.min(priorityBeasts.length, priorityColors.length);
        
        console.log(`🎯 Target teams for extra round: ${targetTeams} (based on ${priorityBeasts.length} beasts + ${priorityColors.length} colors)`);
        
        // If we don't have balanced categories, fill from all players
        const allBeasts = [...playersData.beasts];
        const allColors = [...playersData.colors];
        
        // Sort all players by total rest rounds (ascending) for fairness
        allBeasts.sort((a, b) => {
            const aRests = this.getPlayerRestRounds(a.id).length;
            const bRests = this.getPlayerRestRounds(b.id).length;
            return aRests - bRests;
        });
        
        allColors.sort((a, b) => {
            const aRests = this.getPlayerRestRounds(a.id).length;
            const bRests = this.getPlayerRestRounds(b.id).length;
            return aRests - bRests;
        });
        
        // Select players for extra round
        const selectedBeasts = [...priorityBeasts];
        const selectedColors = [...priorityColors];
        
        // Fill remaining spots to create balanced teams
        while (selectedBeasts.length < selectedColors.length && selectedBeasts.length < allBeasts.length) {
            const nextBeast = allBeasts.find(b => !selectedBeasts.includes(b));
            if (nextBeast) {
                selectedBeasts.push(nextBeast);
                console.log(`🎯 Added beast ${nextBeast.alias} to balance categories`);
            } else break;
        }
        
        while (selectedColors.length < selectedBeasts.length && selectedColors.length < allColors.length) {
            const nextColor = allColors.find(c => !selectedColors.includes(c));
            if (nextColor) {
                selectedColors.push(nextColor);
                console.log(`🎯 Added color ${nextColor.alias} to balance categories`);
            } else break;
        }
        
        // Create teams - use minimum of both categories (no court limitation for extra rounds)
        const finalTeamCount = Math.min(selectedBeasts.length, selectedColors.length);
        const teams = [];
        
        console.log(`🎯 Creating ${finalTeamCount} teams for extra round (no court limitation)`);
        
        for (let i = 0; i < finalTeamCount; i++) {
            const beastPlayer = selectedBeasts[i];
            const colorPlayer = selectedColors[i];
            
            if (beastPlayer && colorPlayer) {
                const team = this.createTeam(beastPlayer, colorPlayer, i + 1);
                teams.push(team);
                
                console.log(`🎯 Extra Round Team ${i + 1}: ${beastPlayer.alias} + ${colorPlayer.alias}`);
            }
        }
        
        console.log(`✅ Extra round created: ${teams.length} teams (${teams.length * 2} players playing)`);
        return teams;
    }

    // ============================================================================
    // TOURNAMENT SIMULATION & FAIRNESS ANALYSIS
    // ============================================================================

    simulateCompleteTournament(playersData, tournamentData, plannedRounds) {
        console.log('\n🎯 SIMULATING COMPLETE TOURNAMENT');
        console.log('==================================');
        
        const courtsCount = tournamentData.courts_count || 4;
        const playingPlayersPerRound = courtsCount * 4;
        const totalPlayers = playersData.totalCount;
        
        console.log(`📊 Tournament parameters: ${totalPlayers} players, ${courtsCount} courts, ${playingPlayersPerRound} playing per round`);
        
        // Simulate player matches for planned rounds
        const playerMatchCounts = {};
        playersData.beasts.concat(playersData.colors).forEach(player => {
            playerMatchCounts[player.id] = 0;
        });
        
        // Simulate each round
        for (let round = 1; round <= plannedRounds; round++) {
            const playingPlayers = Math.min(playingPlayersPerRound, totalPlayers);
            const restingPlayers = totalPlayers - playingPlayers;
            
            console.log(`Round ${round}: ${playingPlayers} playing, ${restingPlayers} resting`);
            
            // For simulation, assume optimal distribution
            // In real tournament, we'd need complex simulation of actual pairing algorithm
            const sortedByMatches = Object.entries(playerMatchCounts)
                .sort(([,a], [,b]) => a - b)
                .map(([id]) => id);
            
            // Players with fewest matches get priority to play
            for (let i = 0; i < playingPlayers; i++) {
                const playerId = sortedByMatches[i];
                playerMatchCounts[playerId]++;
            }
        }
        
        // Analyze fairness
        const matchCounts = Object.values(playerMatchCounts);
        const minMatches = Math.min(...matchCounts);
        const maxMatches = Math.max(...matchCounts);
        const matchDifference = maxMatches - minMatches;
        
        console.log(`📈 Match distribution: min=${minMatches}, max=${maxMatches}, difference=${matchDifference}`);
        
        // Determine if extra round needed (if difference > 1)
        const needsExtraRound = matchDifference > 1;
        
        if (needsExtraRound) {
            console.warn(`🚨 UNFAIR DISTRIBUTION: Some players get ${maxMatches} matches, others only ${minMatches}`);
            console.warn(`💡 SOLUTION: Add 1 extra round to balance matches`);
        } else {
            console.log(`✅ FAIR DISTRIBUTION: All players get ${minMatches}-${maxMatches} matches`);
        }
        
        return {
            needsExtraRound,
            minMatches,
            maxMatches,
            matchDifference,
            playerMatchCounts
        };
    }

    // ============================================================================
    // TEAM RANKING SYSTEM
    // ============================================================================

    calculateTeamRankings(teams) {
        // Sort teams by score (highest first)
        teams.sort((a, b) => b.score - a.score);
        
        // Assign rankings
        teams.forEach((team, index) => {
            team.ranking = index + 1;
        });

        console.log('📊 Team rankings calculated:', teams.map(t => `${t.name}: ${t.score}`));
    }

    // ============================================================================
    // COURTS & REST MANAGEMENT
    // ============================================================================

    assignCourtsAndRest(teams, tournamentData) {
        const availableCourts = tournamentData.courts_count;
        const teamsPerRound = teams.length;
        const playingTeams = Math.min(availableCourts, teamsPerRound);
        
        // Assign courts to top teams by ranking
        for (let i = 0; i < playingTeams; i++) {
            teams[i].status = 'playing';
            teams[i].court = i + 1;
        }
        
        // Remaining teams rest
        for (let i = playingTeams; i < teamsPerRound; i++) {
            teams[i].status = 'resting';
            teams[i].court = null;
            
            // Track rest for both players
            this.trackPlayerRest(teams[i].beastPlayer.id, this.currentRound);
            this.trackPlayerRest(teams[i].colorPlayer.id, this.currentRound);
        }

        console.log(`🏟️ Court assignments: ${playingTeams} playing, ${teamsPerRound - playingTeams} resting`);
    }

    trackPlayerRest(playerId, round) {
        if (!this.restHistory[playerId]) {
            this.restHistory[playerId] = [];
        }
        this.restHistory[playerId].push(round);
    }

    // ============================================================================
    // UI RENDERING SYSTEM
    // ============================================================================

    showTeamsSection() {
        const section = document.getElementById('teamsListSection');
        if (section) {
            section.style.display = 'block';
        }
    }

    renderTeamsGrid() {
        const container = document.getElementById('teamsRoundsContainer');
        const teamsStats = document.getElementById('teamsStats');
        
        if (!container) return;

        // Clear container
        container.innerHTML = '';

        // Update stats for current teams
        if (teamsStats && this.teams) {
            teamsStats.innerHTML = `
                <span class="stat-badge total">TEAMS: ${this.teams.length}</span>
            `;
        }

        // Show teams in simple table
        if (this.teams && this.teams.length > 0) {
            const teamsTable = document.createElement('div');
            teamsTable.className = 'teams-table-container';
            teamsTable.innerHTML = `
                <table class="teams-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Team</th>
                            <th>Name</th>
                            <th>Score</th>
                            <th>Beast Player</th>
                            <th>Color Player</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.teams.map((team, index) => this.renderTeamCard(team, index + 1)).join('')}
                    </tbody>
                </table>
            `;
            
            container.appendChild(teamsTable);
        } else {
            container.innerHTML = `
                <div class="teams-status-message">
                    <i class="fas fa-info-circle"></i>
                    <p>No teams generated yet. Click "Generate Teams" to create team formations.</p>
                </div>
            `;
        }
    }

    // ============================================================================
    // TEAMS RENDERING
    // ============================================================================

    groupTeamsByRound() {
        const groups = {};
        
        // Add current teams if they exist
        if (this.teams && this.teams.length > 0) {
            groups[this.currentRound] = this.teams;
        }
        
        // Add historical teams from teamHistory
        this.teamHistory.forEach(roundData => {
            if (roundData.teams && roundData.teams.length > 0) {
                groups[roundData.round] = roundData.teams;
            }
        });
        
        return groups;
    }

    setupCollapsibleListeners() {
        // Event listeners are handled inline with onclick for simplicity
        // Could be moved to proper event delegation if needed
        console.log('✅ Round groups rendered with collapsible functionality');
    }

    renderTeamCard(team, ranking) {
        return `
            <tr class="team-row" data-team-id="${team.id}">
                <td class="team-ranking">${ranking}</td>
                <td class="team-emoji">${team.emojiName}</td>
                <td class="team-name">${team.name}</td>
                <td class="team-score">${team.score}</td>
                <td class="player-beast">
                    <span class="player-emoji">${team.beastPlayer.aliasEmoji}</span>
                    ${team.beastPlayer.name}
                    <span class="player-score">(${team.beastPlayer.PlayerScore})</span>
                </td>
                <td class="player-color">
                    <span class="player-emoji">${team.colorPlayer.aliasEmoji}</span>
                    ${team.colorPlayer.name}
                    <span class="player-score">(${team.colorPlayer.PlayerScore})</span>
                </td>
            </tr>
        `;
    }

    renderAllRoundsGroups() {
        const container = document.getElementById('teamsRoundsContainer');
        if (!container) return;

        // Group team history by round
        const roundGroups = this.groupTeamsByRound();
        
        // Generate HTML for all rounds
        container.innerHTML = Object.keys(roundGroups)
            .sort((a, b) => parseInt(b) - parseInt(a)) // Latest rounds first
            .map(round => this.renderRoundGroup(parseInt(round), roundGroups[round]))
            .join('');

        // Add event listeners for collapsible functionality
        this.setupCollapsibleListeners();
    }

    groupTeamsByRound() {
        const groups = {};
        
        // Add teams from history
        this.teamHistory.forEach(roundData => {
            if (roundData.teams && roundData.teams.length > 0) {
                groups[roundData.round] = roundData.teams;
            }
        });
        
        return groups;
    }

    renderRoundGroup(round, teams) {
        // Sort teams by ranking within the round
        const sortedTeams = [...teams].sort((a, b) => a.ranking - b.ranking);
        
        const isLatestRound = round === Math.max(...this.teamHistory.map(h => h.round));
        const expandedClass = isLatestRound ? 'expanded' : '';
        
        return `
            <div class="round-group ${expandedClass}" data-round="${round}">
                <div class="round-header" onclick="this.parentElement.classList.toggle('expanded')">
                    <div class="round-info">
                        <h4>
                            <i class="fas fa-flag"></i>
                            Group ${round} 
                            ${isLatestRound ? '<span class="current-badge">LATEST</span>' : ''}
                        </h4>
                        <div class="round-stats">
                            <span class="round-stat total">Teams: ${sortedTeams.length}</span>
                        </div>
                    </div>
                    <div class="round-toggle">
                        <i class="fas fa-chevron-down"></i>
                    </div>
                </div>
                <div class="round-content">
                    <div class="teams-table-container">
                        <table class="teams-table">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Team</th>
                                    <th>Name</th>
                                    <th>Score</th>
                                    <th>Beast Player</th>
                                    <th>Color Player</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sortedTeams.map((team, index) => this.renderTeamCard(team, index + 1)).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    setupCollapsibleListeners() {
        // Listeners are handled inline in the HTML for simplicity
        // Each round header has onclick="this.parentElement.classList.toggle('expanded')"
    }

    // ============================================================================
    // TEAM OPERATIONS
    // ============================================================================

    async shuffleTeams() {
        // Check if we have groups to shuffle
        if (!this.teamHistory || this.teamHistory.length === 0) {
            this.app.addNotification('No groups to shuffle', 'error');
            return;
        }

        try {
            this.app.addNotification('Shuffling latest group...', 'info');
            
            // Get the latest group
            const latestGroupIndex = this.teamHistory.length - 1;
            const latestGroup = this.teamHistory[latestGroupIndex];
            
            // Get tournament settings and player data
            const tournamentData = this.app.getTournamentFormData();
            const savedPlayersData = await this.verifyPlayersAreSaved();
            if (!savedPlayersData || !tournamentData) {
                this.app.addNotification('Cannot shuffle: missing data', 'error');
                return;
            }

            // Remove the latest group's pairings from used pairings
            latestGroup.teams.forEach(team => {
                const beastId = team.beastPlayer.id;
                const colorId = team.colorPlayer.id;
                const pairingKey = [beastId, colorId].sort().join('-');
                this.usedPairings.delete(pairingKey);
            });

            // Process players into BEASTS and COLORS
            const playersData = this.processPlayersData(savedPlayersData.players);

            // Set current round to the latest group's round for regeneration
            const targetRound = latestGroup.round;
            
            // Generate new teams with anti-duplication for this round
            const newTeams = this.createTeamPairingsWithAntiDuplication(playersData, tournamentData);
            
            // Calculate rankings
            this.calculateTeamRankings(newTeams);
            
            // Update the latest group in history
            this.teamHistory[latestGroupIndex] = {
                round: targetRound,
                teams: [...newTeams],
                timestamp: new Date().toISOString()
            };

            // Update used pairings with new teams
            this.updateUsedPairings(newTeams);

            // Save to localStorage
            this.saveTeamsToStorage();

            // Update UI
            this.renderAllRoundsGroups();
            
            this.app.addNotification(`Group ${targetRound} shuffled successfully!`, 'success');

        } catch (error) {
            this.app.addNotification(`Error shuffling teams: ${error.message}`, 'error');
            console.error('Team shuffle error:', error);
        }
    }

    async saveTeamsConfiguration() {
        try {
            if (!this.teams || this.teams.length === 0) {
                this.app.addNotification('No teams to save', 'error');
                return;
            }

            this.app.addNotification('Saving teams configuration...', 'info');

            // Validate teams data
            const isValid = this.validateTeamsData();
            if (!isValid) return;

            // Save to database via main app
            // const result = await this.app.getDbManager().saveTeams(this.teams);

            // Enable Rounds tab progression
            this.enableRoundsTab();
            
            // WORKFLOW CONTROL: Enable next step
            if (typeof this.app.enableNextWorkflowStep === 'function') {
                this.app.enableNextWorkflowStep('teams-saved');
            }

            const totalGroups = this.teamHistory.length;
            const totalTeams = this.teamHistory.reduce((total, group) => total + group.teams.length, 0);

            this.app.addNotification(
                `Teams configuration saved! ${totalGroups} groups with ${totalTeams} total teams ready for matches.`,
                'success'
            );

        } catch (error) {
            this.app.addNotification(`Error saving teams: ${error.message}`, 'error');
            console.error('Save teams error:', error);
        }
    }

    validateTeamsData() {
        // Check for proper team formation
        const invalidTeams = this.teams.filter(team => 
            !team.beastPlayer || !team.colorPlayer || !team.score
        );
        
        if (invalidTeams.length > 0) {
            this.app.addNotification('Some teams have invalid data. Please regenerate teams.', 'error');
            return false;
        }

        return true;
    }

    enableRoundsTab() {
        const roundsTab = document.getElementById('tabRounds');
        if (roundsTab) {
            roundsTab.disabled = false;
            roundsTab.classList.remove('disabled');
        }
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    getTeamsData() {
        return {
            teams: this.teams,
            currentRound: this.currentRound,
            teamHistory: this.teamHistory,
            playingTeams: this.teams.filter(t => t.status === 'playing'),
            restingTeams: this.teams.filter(t => t.status === 'resting')
        };
    }

    resetTeamsData() {
        this.teams = [];
        this.currentRound = 1;
        this.teamHistory = [];
        this.restHistory = {};
        this.usedPairings = new Set(); // Reset used pairings
        
        // Clear localStorage
        localStorage.removeItem('teams_history');
        localStorage.removeItem('tournament_teams_meta');
        
        const section = document.getElementById('teamsListSection');
        if (section) {
            section.style.display = 'none';
        }
        
        // Clear the container
        const container = document.getElementById('teamsRoundsContainer');
        if (container) {
            container.innerHTML = '';
        }
        
        console.log('🔄 Teams data completely reset - including used pairings');
        this.app.addNotification('Teams data completely reset', 'info');
    }

    // ============================================================================
    // ROUND MANAGEMENT
    // ============================================================================

    canGenerateNextRound() {
        const tournamentData = this.app.getTournamentFormData();
        const maxRounds = tournamentData?.total_rounds || 7;
        
        return this.currentRound <= maxRounds;
    }

    getRestPriorityPlayers() {
        // Return players who have rested least or haven't rested consecutively
        const playersData = this.app.playersManager?.getPlayersData();
        if (!playersData) return [];

        return playersData.players.filter(player => {
            const restRounds = this.restHistory[player.id] || [];
            const lastRound = this.currentRound - 1;
            
            // Prioritize players who haven't rested in the last round
            return !restRounds.includes(lastRound);
        });
    }
}

// Export for use in main application
window.TeamsManager = TeamsManager;