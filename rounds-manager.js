/**
 * FORMULA PADEL - ROUNDS MANAGER V2.0
 * Modulo dedicato alla gestione dei rounds e match
 * Implementa algoritmi di accoppiamenti ranking-based e rest rotation
 */

class RoundsManager {
    constructor(app) {
        this.app = app;
        this.rounds = [];
        this.currentRound = 1;
        this.matchHistory = []; // Track all completed matches
        this.restHistory = {}; // Track team rest patterns across rounds
        this.activeTimers = new Map(); // Track active match timers
        
        this.setupEventListeners();
        this.loadRoundsFromStorage(); // Load saved data
        
        // Delay teams status check to ensure teams manager is ready
        setTimeout(() => {
            this.checkTeamsStatus();
        }, 100);
    }

    // ============================================================================
    // INITIALIZATION & STATUS CHECK
    // ============================================================================

    async checkTeamsStatus() {
        try {
            const teamsManager = this.app.getTeamsManager();
            const teamsData = teamsManager.getTeamsData();
            
            console.log('📊 Teams status check:', {
                teamHistory: teamsData?.teamHistory?.length || 0,
                currentRound: this.currentRound,
                roundsGenerated: this.rounds.length
            });
            
            // Pass the complete team history to UI update
            this.updateRoundsStatusUI(teamsData?.teamHistory || []);
        } catch (error) {
            console.error('Error checking teams status:', error);
            this.updateRoundsStatusUI([]);
        }
    }

    // Public method that can be called by teams manager
    refreshTeamsStatus() {
        this.checkTeamsStatus();
    }

    updateRoundsStatusUI(teamHistory) {
        const roundsInfo = document.getElementById('currentRoundsInfo');
        const startBtn = document.getElementById('startRoundsBtn');
        
        if (teamHistory && teamHistory.length > 0) {
            // Calculate next round number
            const nextRound = this.rounds.length + 1;
            const config = this.getTournamentConfig();
            
            // Check if there's a team group for the next round
            const nextGroupExists = teamHistory.some(group => group.round === nextRound);
            
            if (nextGroupExists && nextRound <= config.totalRounds) {
                const nextGroup = teamHistory.find(group => group.round === nextRound);
                const teamCount = nextGroup.teams.length;
                
                // Teams ready - enable rounds functionality
                roundsInfo.innerHTML = `
                    <div class="status-ready">
                        <span class="status-icon">✅</span>
                        <span class="status-text">Ready! Group ${nextRound} has ${teamCount} teams</span>
                    </div>
                `;
                if (startBtn) {
                    startBtn.disabled = false;
                    startBtn.textContent = `START ROUND ${nextRound}`;
                    this.currentRound = nextRound;
                }
            } else if (nextRound > config.totalRounds) {
                // Tournament complete
                roundsInfo.innerHTML = `
                    <div class="status-complete">
                        <span class="status-icon">🏆</span>
                        <span class="status-text">Tournament Complete!</span>
                    </div>
                `;
                if (startBtn) {
                    startBtn.disabled = true;
                    startBtn.textContent = 'Tournament Complete';
                }
            } else {
                // No team group for next round
                roundsInfo.innerHTML = `
                    <div class="status-warning">
                        <span class="status-icon">⚠️</span>
                        <span class="status-text">Please generate Group ${nextRound} teams first</span>
                    </div>
                `;
                if (startBtn) {
                    startBtn.disabled = true;
                    startBtn.textContent = `Generate Group ${nextRound} Teams First`;
                }
            }
        } else {
            // No teams - disable rounds functionality
            roundsInfo.innerHTML = `
                <div class="status-warning">
                    <span class="status-icon">⚠️</span>
                    <span class="status-text">Please generate and save teams first</span>
                </div>
            `;
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.textContent = 'Teams Required';
            }
        }
    }

    // ============================================================================
    // EVENT LISTENERS
    // ============================================================================

    setupEventListeners() {
        // Start rounds button
        const startBtn = document.getElementById('startRoundsBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startRound());
        }

        // Clear rounds button
        const clearBtn = document.getElementById('clearRoundsBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all rounds? This action cannot be undone.')) {
                    this.clearRoundsData();
                }
            });
        }

        // Round collapse toggles
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('round-toggle')) {
                this.toggleRoundCollapse(e.target);
            }
            
            // Match timer controls
            if (e.target.classList.contains('timer-start')) {
                this.startMatchTimer(e.target);
            } else if (e.target.classList.contains('timer-stop')) {
                this.stopMatchTimer(e.target);
            } else if (e.target.classList.contains('timer-reset')) {
                this.resetMatchTimer(e.target);
            }
            
            // Save match results
            if (e.target.classList.contains('save-match-btn')) {
                this.saveMatchResult(e.target);
            }
        });

        // Score input listeners
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('score-input')) {
                this.handleScoreInput(e.target);
            }
        });
    }

    toggleRoundCollapse(toggleButton) {
        const roundFrame = toggleButton.closest('.round-frame');
        const roundContent = roundFrame.querySelector('.round-matches-content');
        
        if (roundContent.style.display === 'none') {
            roundContent.style.display = 'block';
            toggleButton.textContent = '▼';
        } else {
            roundContent.style.display = 'none';
            toggleButton.textContent = '▶';
        }
    }

    // ============================================================================
    // CORE ROUNDS GENERATION
    // ============================================================================

    startRound() {
        try {
            // Get teams using intelligent group rotation + rest priority
            const teamsManager = this.app.getTeamsManager();
            const teamsData = teamsManager.getTeamsData();
            
            let availableTeams = [];
            if (teamsData && teamsData.teamHistory && teamsData.teamHistory.length > 0) {
                availableTeams = this.selectTeamsForRound(teamsData.teamHistory, this.currentRound);
                console.log(`� Round ${this.currentRound} team selection: ${availableTeams.length} teams`);
            }
            
            if (!availableTeams || availableTeams.length === 0) {
                this.showError(`No teams available for Round ${this.currentRound}. Please generate Group ${this.currentRound} teams first.`);
                return;
            }

            console.log(`🚀 Starting round ${this.currentRound} with ${availableTeams.length} teams from Group ${this.currentRound}`);

            // Get tournament configuration
            const config = this.getTournamentConfig();
            if (!config) {
                this.showError('Tournament configuration not available.');
                return;
            }

            // Generate round matches
            const roundData = this.generateRoundMatches(availableTeams, this.currentRound, config);
            
            // Add to rounds array
            this.rounds.push(roundData);
            
            // Render round UI
            this.renderRoundFrame(roundData);
            
            // Save to storage
            this.saveToStorage();
            
            // Update UI for next round
            this.checkTeamsStatus();
            
            this.showSuccess(`Round ${this.currentRound} started with ${roundData.matches.length} matches!`);

        } catch (error) {
            console.error('Error starting round:', error);
            this.showError('Failed to start round. Please try again.');
        }
    }

    generateRoundMatches(teams, roundNumber, config) {
        console.log(`🚀 Generating matches for round ${roundNumber}...`);
        console.log('📊 Teams data received:', teams);
        console.log('⚙️ Config:', config);
        
        if (!teams || teams.length === 0) {
            throw new Error('No teams provided for match generation');
        }
        
        // Step 1: Calculate rest rotation
        const { playingTeams, restingTeams } = this.calculateRestRotation(teams, config.courtsCount, roundNumber);
        
        // Step 2: Sort playing teams by ranking
        const rankedTeams = this.sortTeamsByRanking(playingTeams);
        
        // Step 3: Create ranking-based matches
        const matches = this.createRankingMatches(rankedTeams, config.courtsCount, config.matchDuration);
        
        // Step 4: Assign courts
        const matchesWithCourts = this.assignCourts(matches, config.courtsCount);
        
        return {
            roundNumber: roundNumber,
            matches: matchesWithCourts,
            restingTeams: restingTeams,
            status: 'active',
            createdAt: new Date().toISOString()
        };
    }

    // ============================================================================
    // INTELLIGENT TEAM SELECTION WITH GROUP ROTATION
    // ============================================================================

    selectTeamsForRound(teamHistory, roundNumber) {
        console.log(`\n🔄 TEAM SELECTION FOR ROUND ${roundNumber}`);
        console.log('========================================');
        
        if (roundNumber === 1) {
            // Round 1: Always use Group 1 (first group)
            const group1 = teamHistory.find(group => group.round === 1);
            if (group1) {
                console.log(`📊 Round 1: Using Group 1 (${group1.teams.length} teams)`);
                return group1.teams;
            }
        }
        
        // Round 2+: Smart rotation with rest priority
        const currentGroupNumber = ((roundNumber - 1) % teamHistory.length) + 1;
        const currentGroup = teamHistory.find(group => group.round === currentGroupNumber);
        
        if (!currentGroup) {
            console.warn(`⚠️ Group ${currentGroupNumber} not found, using Group 1 as fallback`);
            return teamHistory[0]?.teams || [];
        }
        
        // Get teams that rested in previous round
        const teamsRestedPreviously = this.getTeamsRestedInPreviousRound();
        
        if (teamsRestedPreviously.length === 0) {
            // No teams rested previously, use current group as normal
            console.log(`📊 Round ${roundNumber}: Using Group ${currentGroupNumber} (${currentGroup.teams.length} teams)`);
            return currentGroup.teams;
        }
        
        // Merge: Rested teams get TOP PRIORITY + fill with current group teams
        const currentGroupTeams = currentGroup.teams.filter(team => 
            !teamsRestedPreviously.some(restedTeam => restedTeam.id === team.id)
        );
        
        const mergedTeams = [
            ...teamsRestedPreviously, // PRIORITY: Teams that rested last round
            ...currentGroupTeams      // FILL: Remaining teams from current group
        ];
        
        console.log(`🎯 Round ${roundNumber}: Merged selection`);
        console.log(`  - Priority teams (rested last): ${teamsRestedPreviously.length}`);
        console.log(`  - Group ${currentGroupNumber} teams: ${currentGroupTeams.length}`);
        console.log(`  - Total available: ${mergedTeams.length}`);
        
        teamsRestedPreviously.forEach(team => {
            console.log(`  🏆 PRIORITY: ${team.name} (rested Round ${roundNumber - 1})`);
        });
        
        return mergedTeams;
    }

    getTeamsRestedInPreviousRound() {
        const previousRoundNumber = this.currentRound - 1;
        
        if (previousRoundNumber < 1 || this.rounds.length === 0) {
            return []; // No previous rounds
        }
        
        const previousRound = this.rounds.find(round => round.roundNumber === previousRoundNumber);
        if (!previousRound || !previousRound.restingTeams) {
            return []; // No resting teams found
        }
        
        console.log(`🔍 Found ${previousRound.restingTeams.length} teams that rested in Round ${previousRoundNumber}:`);
        previousRound.restingTeams.forEach(team => {
            console.log(`  💤 ${team.name}`);
        });
        
        return previousRound.restingTeams;
    }

    // ============================================================================
    // REST ROTATION ALGORITHM (FROM MASTERGUIDE)
    // ============================================================================

    calculateRestRotation(teams, courtsCount, roundNumber) {
        const maxPlayingTeams = courtsCount * 2; // 2 teams per court
        
        if (teams.length <= maxPlayingTeams) {
            // All teams play - no rest needed
            console.log(`✅ All ${teams.length} teams can play (${courtsCount} courts available)`);
            return { playingTeams: teams, restingTeams: [] };
        }
        
        // Some teams must rest - use intelligent priority system
        const restCount = teams.length - maxPlayingTeams;
        console.log(`🏃‍♀️ Need to rest ${restCount} teams out of ${teams.length} (${courtsCount} courts, max ${maxPlayingTeams} playing)`);
        
        // Smart rest selection based on history and priorities
        const restingTeams = this.selectRestingTeamsWithPriority(teams, restCount, roundNumber);
        const playingTeams = teams.filter(team => !restingTeams.some(rt => rt.id === team.id));
        
        // Update rest history
        this.updateRestHistory(restingTeams, playingTeams, roundNumber);
        
        console.log(`📊 Round ${roundNumber}: ${playingTeams.length} playing, ${restingTeams.length} resting`);
        console.log('🏃‍♀️ Playing teams:', playingTeams.map(t => t.name));
        console.log('💤 Resting teams:', restingTeams.map(t => t.name));
        
        return { playingTeams, restingTeams };
    }

    selectRestingTeamsWithPriority(teams, restCount, roundNumber) {
        console.log(`\n🔍 SIMPLIFIED REST SELECTION FOR ROUND ${roundNumber}`);
        console.log('===============================================');
        console.log('Available teams (in priority order):', teams.map(t => t.name));
        
        // With new team selection logic, teams that rested last round are already 
        // at the FRONT of the array (highest priority to play)
        // So we simply take the LAST teams for resting (lowest priority)
        
        const selectedForRest = teams.slice(-restCount);
        
        console.log(`\n🎯 SIMPLE SELECTION: Last ${restCount} teams will rest`);
        selectedForRest.forEach((team, index) => {
            console.log(`  💤 ${team.name} (position ${teams.length - restCount + index + 1}/${teams.length})`);
        });
        
        return selectedForRest;
    }

    calculateRestPriority(teamHistory, currentRound, restedLastRound = false) {
        let priority = 0;
        
        // MASSIVE penalty for resting last round (avoid consecutive rests)
        if (restedLastRound) {
            priority -= 1000; // Very low priority to rest again
        }
        
        // Base priority from total rests (fewer rests = lower priority to rest)
        priority -= teamHistory.totalRests * 50;
        
        // Bonus for older rest (longer since last rest = higher priority to rest)
        const roundsSinceRest = currentRound - (teamHistory.lastRestRound || 0);
        priority += roundsSinceRest * 20;
        
        return priority;
    }

    updateRestHistory(restingTeams, playingTeams, roundNumber) {
        // Update history for resting teams
        restingTeams.forEach(team => {
            if (!this.restHistory[team.id]) {
                this.restHistory[team.id] = { 
                    totalRests: 0, 
                    lastRestRound: 0, 
                    consecutiveRests: 0,
                    restRounds: [] 
                };
            }
            
            const history = this.restHistory[team.id];
            
            // Check for consecutive rests BEFORE updating lastRestRound
            const previousRestRound = history.lastRestRound;
            if (previousRestRound === roundNumber - 1) {
                history.consecutiveRests++;
            } else {
                history.consecutiveRests = 1; // Start new consecutive sequence
            }
            
            // Update the rest data
            history.totalRests++;
            history.lastRestRound = roundNumber;
            history.restRounds.push(roundNumber);
            
            console.log(`💤 ${team.name}: rested Round ${roundNumber}, consecutive=${history.consecutiveRests}, total=${history.totalRests}`);
        });
        
        // Update history for playing teams (reset consecutive rests)
        playingTeams.forEach(team => {
            if (!this.restHistory[team.id]) {
                this.restHistory[team.id] = { 
                    totalRests: 0, 
                    lastRestRound: 0, 
                    consecutiveRests: 0,
                    restRounds: [] 
                };
            }
            
            // Reset consecutive rests since they're playing this round
            this.restHistory[team.id].consecutiveRests = 0;
            
            console.log(`🏃‍♀️ ${team.name}: playing Round ${roundNumber}, consecutive rests reset`);
        });
        
        // Save updated history
        this.saveToStorage();
    }

    // ============================================================================
    // RANKING-BASED MATCHING ALGORITHM
    // ============================================================================

    sortTeamsByRanking(teams) {
        return teams.sort((teamA, teamB) => {
            // Teams already have a calculated score, use it directly
            const scoreA = teamA.score || 0;
            const scoreB = teamB.score || 0;
            
            console.log(`📊 Team ranking: ${teamA.name} score=${scoreA}, ${teamB.name} score=${scoreB}`);
            
            // Descending order (highest ranking first)
            return scoreB - scoreA;
        });
    }

    createRankingMatches(rankedTeams, courtsCount, matchDuration) {
        const matches = [];
        
        // ALGORITHM: Team(N) vs Team(N+1) for minimal ranking delta
        for (let i = 0; i < rankedTeams.length && matches.length < courtsCount; i += 2) {
            if (i + 1 < rankedTeams.length) {
                matches.push({
                    id: `round_${this.currentRound}_match_${matches.length + 1}`,
                    matchNumber: matches.length + 1,
                    teamA: rankedTeams[i],
                    teamB: rankedTeams[i + 1],
                    scoreA: '',
                    scoreB: '',
                    status: 'pending', // 'pending', 'active', 'completed'
                    startTime: null,
                    endTime: null,
                    duration: matchDuration,
                    court: null, // Assigned later
                    winner: null,
                    timerRemaining: matchDuration * 60 // Convert to seconds
                });
            }
        }
        
        console.log(`Created ${matches.length} matches from ${rankedTeams.length} teams`);
        return matches;
    }

    assignCourts(matches, courtsCount) {
        return matches.map((match, index) => ({
            ...match,
            court: (index % courtsCount) + 1 // Court 1, 2, 3, 4...
        }));
    }

    // ============================================================================
    // UI RENDERING
    // ============================================================================

    renderRoundFrame(roundData) {
        const roundsContainer = document.getElementById('roundsContainer');
        if (!roundsContainer) {
            console.error('Rounds container not found');
            return;
        }

        const roundFrame = document.createElement('div');
        roundFrame.className = 'round-frame';
        roundFrame.innerHTML = `
            <div class="round-header">
                <h3 class="round-title">
                    <button class="round-toggle">▼</button>
                    ROUND ${roundData.roundNumber}
                </h3>
                <div class="round-info">
                    <span class="matches-count">${roundData.matches.length} matches</span>
                    ${roundData.restingTeams.length > 0 ? `<span class="resting-count">${roundData.restingTeams.length} teams resting</span>` : ''}
                </div>
            </div>
            
            <div class="round-matches-content">
                <div class="matches-grid">
                    ${roundData.matches.map(match => this.renderMatchCard(match)).join('')}
                </div>
                
                ${roundData.restingTeams.length > 0 ? `
                    <div class="resting-teams">
                        <h4>Teams Resting:</h4>
                        <div class="resting-list">
                            ${roundData.restingTeams.map(team => `
                                <span class="resting-team">${team.emojiName || '🏐'} ${team.name}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        // Insert new rounds at the top (latest first) to match teams order
        roundsContainer.insertBefore(roundFrame, roundsContainer.firstChild);
        
        // Ensure round content is visible by default
        const roundContent = roundFrame.querySelector('.round-matches-content');
        if (roundContent) {
            roundContent.style.display = 'block';
        }
    }

    renderMatchCard(match) {
        return `
            <div class="match-card" data-match-id="${match.id}">
                <div class="match-header">
                    <span class="match-number">Match #${match.matchNumber}</span>
                    <span class="court-assignment">Court ${match.court}</span>
                </div>
                
                <div class="teams-matchup">
                    <div class="team-side team-a">
                        <div class="team-info">
                            <div class="team-emoji">${match.teamA.emojiName || match.teamA.emoji}</div>
                            <div class="team-name">${match.teamA.name}</div>
                        </div>
                        <div class="players-list">
                            <span class="player">${match.teamA.beastPlayer.aliasEmoji} ${match.teamA.beastPlayer.name}</span>
                            <span class="player">${match.teamA.colorPlayer.aliasEmoji} ${match.teamA.colorPlayer.name}</span>
                        </div>
                    </div>
                    
                    <div class="vs-separator">VS</div>
                    
                    <div class="team-side team-b">
                        <div class="team-info">
                            <div class="team-emoji">${match.teamB.emojiName || match.teamB.emoji}</div>
                            <div class="team-name">${match.teamB.name}</div>
                        </div>
                        <div class="players-list">
                            <span class="player">${match.teamB.beastPlayer.aliasEmoji} ${match.teamB.beastPlayer.name}</span>
                            <span class="player">${match.teamB.colorPlayer.aliasEmoji} ${match.teamB.colorPlayer.name}</span>
                        </div>
                    </div>
                </div>
                
                <div class="score-section">
                    <input type="number" class="score-input score-a" placeholder="0" value="${match.scoreA || ''}" min="0">
                    <span class="score-separator">-</span>
                    <input type="number" class="score-input score-b" placeholder="0" value="${match.scoreB || ''}" min="0">
                </div>
                
                <div class="timer-section">
                    <div class="timer-display" id="timer-${match.id}">${this.formatTime(match.timerRemaining)}</div>
                    <div class="timer-controls">
                        <button class="timer-btn timer-start" data-match-id="${match.id}">START</button>
                        <button class="timer-btn timer-stop" data-match-id="${match.id}">STOP</button>
                        <button class="timer-btn timer-reset" data-match-id="${match.id}">RESET</button>
                    </div>
                </div>
                
                <div class="match-actions">
                    <button class="save-match-btn" data-match-id="${match.id}">SAVE MATCH</button>
                </div>
            </div>
        `;
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    // ============================================================================
    // TIMER MANAGEMENT (STEP 3.3 - COUNTDOWN SYSTEM)
    // ============================================================================

    startMatchTimer(button) {
        const matchId = button.dataset.matchId;
        const match = this.findMatchById(matchId);
        
        if (!match) {
            console.error('Match not found:', matchId);
            return;
        }

        if (match.status === 'active') {
            this.showError('Match timer is already running');
            return;
        }

        // Update match status
        match.status = 'active';
        match.startTime = new Date().toISOString();
        
        // Start countdown timer
        this.startCountdownTimer(matchId, match);
        
        // Update UI
        this.updateMatchCardUI(matchId, match);
        
        // Save state
        this.saveToStorage();
        
        console.log(`🚀 Countdown timer started for match ${matchId} - ${this.formatTime(match.timerRemaining)} remaining`);
        this.showSuccess(`Match ${match.matchNumber} timer started!`);
    }

    stopMatchTimer(button) {
        const matchId = button.dataset.matchId;
        const match = this.findMatchById(matchId);
        
        if (!match) {
            console.error('Match not found:', matchId);
            return;
        }

        if (match.status !== 'active') {
            this.showError('Match timer is not running');
            return;
        }

        // Stop countdown timer
        this.stopCountdownTimer(matchId);

        // Update match status
        match.status = 'paused';
        
        // Update UI
        this.updateMatchCardUI(matchId, match);
        
        // Save state
        this.saveToStorage();
        
        console.log(`⏸️ Countdown timer paused for match ${matchId} - ${this.formatTime(match.timerRemaining)} remaining`);
        this.showSuccess(`Match ${match.matchNumber} timer paused!`);
    }

    resetMatchTimer(button) {
        const matchId = button.dataset.matchId;
        const match = this.findMatchById(matchId);
        
        if (!match) {
            console.error('Match not found:', matchId);
            return;
        }

        // Stop any active countdown
        this.stopCountdownTimer(matchId);

        // Reset match data
        match.status = 'pending';
        match.startTime = null;
        match.scoreA = '';
        match.scoreB = '';
        match.timerRemaining = this.getTournamentConfig().matchDuration * 60;
        
        // Reset UI
        this.updateMatchCardUI(matchId, match);
        
        // Clear score inputs
        const matchCard = document.querySelector(`[data-match-id="${matchId}"]`);
        if (matchCard) {
            const scoreInputs = matchCard.querySelectorAll('.score-input');
            scoreInputs.forEach(input => input.value = '');
        }
        
        // Save state
        this.saveToStorage();
        
        console.log(`🔄 Timer reset for match ${matchId}`);
        this.showSuccess(`Match ${match.matchNumber} reset!`);
    }

    // ============================================================================
    // COUNTDOWN TIMER SYSTEM
    // ============================================================================

    startCountdownTimer(matchId, match) {
        // Stop any existing timer for this match
        this.stopCountdownTimer(matchId);
        
        // Create interval that decrements every second
        const intervalId = setInterval(() => {
            if (match.timerRemaining > 0) {
                match.timerRemaining--;
                this.updateTimerDisplay(matchId, match);
                this.saveToStorage(); // Persist timer state
                
                // Check for warnings
                this.checkTimerWarnings(matchId, match);
            } else {
                // Timer reached zero
                this.handleTimerExpired(matchId, match);
            }
        }, 1000);
        
        // Store interval ID for this match
        this.activeTimers.set(matchId, intervalId);
        
        console.log(`⏰ Countdown started for match ${matchId}`);
    }

    stopCountdownTimer(matchId) {
        const intervalId = this.activeTimers.get(matchId);
        if (intervalId) {
            clearInterval(intervalId);
            this.activeTimers.delete(matchId);
            console.log(`⏸️ Countdown stopped for match ${matchId}`);
        }
    }

    updateTimerDisplay(matchId, match) {
        const timerElement = document.getElementById(`timer-${matchId}`);
        if (timerElement) {
            timerElement.textContent = this.formatTime(match.timerRemaining);
            
            // Update visual state based on time remaining
            this.updateTimerVisualState(timerElement, match.timerRemaining);
        }
    }

    updateTimerVisualState(timerElement, timeRemaining) {
        const config = this.getTournamentConfig();
        const totalDuration = config.matchDuration * 60;
        
        // Remove previous warning classes
        timerElement.classList.remove('timer-warning', 'timer-critical', 'timer-normal');
        
        if (timeRemaining <= 0) {
            // Time expired
            timerElement.classList.add('timer-critical');
        } else {
            // Dynamic thresholds based on match duration
            if (totalDuration <= 180) {
                // Short timer (3 min): critical at 30s, warning at 90s
                if (timeRemaining <= 30) {
                    timerElement.classList.add('timer-critical');
                } else if (timeRemaining <= 90) {
                    timerElement.classList.add('timer-warning');
                } else {
                    timerElement.classList.add('timer-normal');
                }
            } else {
                // Standard timer: critical at 1min, warning at 2min
                if (timeRemaining <= 60) {
                    timerElement.classList.add('timer-critical');
                } else if (timeRemaining <= 120) {
                    timerElement.classList.add('timer-warning');
                } else {
                    timerElement.classList.add('timer-normal');
                }
            }
        }
    }

    checkTimerWarnings(timeRemaining) {
        // Dynamic thresholds based on match duration
        const config = this.getTournamentConfig();
        const totalDuration = config.matchDuration * 60; // Convert to seconds
        
        // For test timer (3 min): warning at 90s, critical at 60s, emergency at 30s
        if (totalDuration <= 180) {
            if (timeRemaining <= 30) return 'critical';
            if (timeRemaining <= 60) return 'warning';
            if (timeRemaining <= 90) return 'warning';
        } 
        // For standard timers (15+ min): warning at 2min, critical at 1min, emergency at 30s
        else {
            if (timeRemaining <= 30) return 'critical';
            if (timeRemaining <= 60) return 'critical';
            if (timeRemaining <= 120) return 'warning'; // 2 minutes
        }
        
        return null; // Normal state
    }

    checkTimerWarnings(matchId, match) {
        const timeRemaining = match.timerRemaining;
        const config = this.getTournamentConfig();
        const totalDuration = config.matchDuration * 60;
        
        // Dynamic warnings based on match duration
        if (totalDuration <= 180) {
            // Short timer (3 min) - more frequent warnings
            if (timeRemaining === 90) {
                this.showTimerWarning(matchId, match, '⚠️ 90 seconds remaining!');
            } else if (timeRemaining === 60) {
                this.showTimerWarning(matchId, match, '⚠️ 1 minute remaining!');
            } else if (timeRemaining === 30) {
                this.showTimerWarning(matchId, match, '🚨 30 seconds remaining!');
            } else if (timeRemaining === 10) {
                this.showTimerWarning(matchId, match, '🔴 10 SECONDS LEFT!');
            }
        } else {
            // Standard timer (15+ min) - standard warnings
            if (timeRemaining === 120) { // 2 minutes
                this.showTimerWarning(matchId, match, '⚠️ 2 minutes remaining!');
            } else if (timeRemaining === 60) {
                this.showTimerWarning(matchId, match, '⚠️ 1 minute remaining!');
            } else if (timeRemaining === 30) {
                this.showTimerWarning(matchId, match, '🚨 30 seconds remaining!');
            } else if (timeRemaining === 10) {
                this.showTimerWarning(matchId, match, '🔴 10 SECONDS LEFT!');
            }
        }
    }

    handleTimerExpired(matchId, match) {
        // Stop the countdown
        this.stopCountdownTimer(matchId);
        
        // Update match status
        match.status = 'expired';
        
        // Update UI
        this.updateMatchCardUI(matchId, match);
        this.updateTimerDisplay(matchId, match);
        
        // Show critical alert
        this.showTimerWarning(matchId, match, '🔴 TIME EXPIRED!');
        
        // Save state
        this.saveToStorage();
        
        console.log(`⏰ Timer expired for match ${matchId}`);
    }

    /**
     * Get timer state for a specific match
     * Returns the active timer state from activeTimers Map
     */
    getMatchTimerState(matchId) {
        const match = this.findMatchById(matchId);
        if (!match) {
            return null;
        }

        // Check if there's an active timer for this match
        const activeTimer = this.activeTimers.get(matchId);
        
        return {
            state: activeTimer ? 'running' : 'stopped',
            remaining: match.timerRemaining || 0,
            isActive: !!activeTimer,
            matchStatus: match.status
        };
    }

    showTimerWarning(matchId, match, message) {
        // Show notification
        this.app.addNotification(`Match ${match.matchNumber}: ${message}`, 'warning');
        
        // Optional: Add visual pulse effect to match card
        const matchCard = document.querySelector(`[data-match-id="${matchId}"]`);
        if (matchCard) {
            matchCard.classList.add('timer-alert');
            setTimeout(() => {
                matchCard.classList.remove('timer-alert');
            }, 3000);
        }
    }

    // ============================================================================
    // SCORE MANAGEMENT
    // ============================================================================

    updateMatchScore(matchId, scoreA, scoreB) {
        const match = this.findMatchById(matchId);
        
        if (!match) {
            console.error('Match not found:', matchId);
            return false;
        }

        // Validate scores
        if (!this.validateScore(scoreA) || !this.validateScore(scoreB)) {
            this.showError('Invalid score. Please enter numbers between 0 and 50.');
            return false;
        }

        // Update match scores
        match.scoreA = parseInt(scoreA) || 0;
        match.scoreB = parseInt(scoreB) || 0;
        
        // Save state
        this.saveToStorage();
        
        console.log(`📊 Scores updated for match ${matchId}: ${scoreA} - ${scoreB}`);
        return true;
    }

    validateScore(score) {
        const num = parseInt(score);
        return !isNaN(num) && num >= 0 && num <= 50;
    }

    handleScoreInput(input) {
        const matchCard = input.closest('.match-card');
        const matchId = matchCard.dataset.matchId;
        const scoreA = matchCard.querySelector('.score-a').value;
        const scoreB = matchCard.querySelector('.score-b').value;

        // Visual feedback for invalid input
        if (input.value && !this.validateScore(input.value)) {
            input.style.borderColor = '#e74c3c';
            input.style.backgroundColor = '#fdf2f2';
        } else {
            input.style.borderColor = '';
            input.style.backgroundColor = '';
        }

        // Update match data if both scores are valid
        if (scoreA && scoreB && this.validateScore(scoreA) && this.validateScore(scoreB)) {
            this.updateMatchScore(matchId, scoreA, scoreB);
        }
    }

    saveMatchResult(button) {
        const matchId = button.dataset.matchId;
        const match = this.findMatchById(matchId);
        
        if (!match) {
            console.error('Match not found:', matchId);
            return;
        }

        // Get current scores from inputs
        const matchCard = document.querySelector(`[data-match-id="${matchId}"]`);
        const scoreAInput = matchCard.querySelector('.score-a');
        const scoreBInput = matchCard.querySelector('.score-b');
        
        const scoreA = scoreAInput.value;
        const scoreB = scoreBInput.value;

        // Validate scores
        if (!scoreA || !scoreB) {
            this.showError('Please enter scores for both teams before saving.');
            return;
        }

        if (!this.updateMatchScore(matchId, scoreA, scoreB)) {
            return; // Validation failed
        }

        // Determine winner
        const scoreANum = parseInt(scoreA);
        const scoreBNum = parseInt(scoreB);
        
        if (scoreANum === scoreBNum) {
            match.winner = 'tie';
        } else {
            match.winner = scoreANum > scoreBNum ? 'teamA' : 'teamB';
        }

        // Update match status
        match.status = 'completed';
        match.endTime = new Date().toISOString();
        
        // Add to match history
        this.matchHistory.push({
            ...match,
            roundNumber: this.currentRound,
            savedAt: new Date().toISOString()
        });

        // Update UI
        this.updateMatchCardUI(matchId, match);
        
        // Save state
        this.saveToStorage();
        
        // Update league standings
        if (this.app.leagueManager) {
            this.app.leagueManager.updateLeagueFromMatch(match);
        }
        
        // Check if round is complete
        this.checkRoundCompletion();
        
        const winnerText = match.winner === 'tie' ? 'Tie game' : 
                          match.winner === 'teamA' ? match.teamA.name : match.teamB.name;
        
        console.log(`💾 Match ${match.matchNumber} saved: ${scoreA}-${scoreB}, Winner: ${winnerText}`);
        this.showSuccess(`Match ${match.matchNumber} saved! Winner: ${winnerText}`);
    }

    // ============================================================================
    // UI UPDATE METHODS
    // ============================================================================

    updateMatchCardUI(matchId, match) {
        console.log(`🔄 updateMatchCardUI called for match ${matchId}:`, {
            scoreA: match.scoreA,
            scoreB: match.scoreB,
            status: match.status
        });
        
        const matchCard = document.querySelector(`[data-match-id="${matchId}"]`);
        if (!matchCard) {
            console.warn(`❌ Match card not found for match ${matchId}`);
            return;
        }

        // Update score inputs if match has scores
        if (match.scoreA !== undefined && match.scoreB !== undefined) {
            const scoreAInput = matchCard.querySelector('.score-a');
            const scoreBInput = matchCard.querySelector('.score-b');
            
            if (scoreAInput) {
                scoreAInput.value = match.scoreA;
                console.log(`✅ Updated scoreA input to ${match.scoreA}`);
            }
            if (scoreBInput) {
                scoreBInput.value = match.scoreB;
                console.log(`✅ Updated scoreB input to ${match.scoreB}`);
            }
        }

        // Update timer display
        const timerDisplay = matchCard.querySelector('.timer-display');
        if (timerDisplay) {
            timerDisplay.textContent = this.formatTime(match.timerRemaining);
            
            // Update timer visual state
            timerDisplay.className = 'timer-display';
            if (match.status === 'active') {
                timerDisplay.classList.add('timer-active');
            } else if (match.status === 'completed') {
                timerDisplay.classList.add('timer-completed');
            }
        }

        // Update button states
        const startBtn = matchCard.querySelector('.timer-start');
        const stopBtn = matchCard.querySelector('.timer-stop');
        const saveBtn = matchCard.querySelector('.save-match-btn');

        // Apply timer visual state classes
        matchCard.className = matchCard.className.replace(/\btimer-\w+\b/g, ''); // Remove existing timer classes
        
        const timerState = this.getMatchTimerState(match.id);
        if (timerState && match.status === 'active' && timerState.state === 'running') {
            const warningLevel = this.checkTimerWarnings(timerState.remaining);
            if (warningLevel) {
                matchCard.classList.add(`timer-${warningLevel}`);
            } else {
                matchCard.classList.add('timer-normal');
            }
        } else if (match.status === 'expired') {
            matchCard.classList.add('timer-expired');
        }
        
        if (startBtn && stopBtn && saveBtn) {
            switch (match.status) {
                case 'pending':
                    startBtn.disabled = false;
                    startBtn.textContent = 'START';
                    stopBtn.disabled = true;
                    saveBtn.disabled = false;
                    break;
                    
                case 'active':
                    startBtn.disabled = true;
                    startBtn.textContent = 'RUNNING';
                    stopBtn.disabled = false;
                    saveBtn.disabled = false;
                    break;
                    
                case 'paused':
                    startBtn.disabled = false;
                    startBtn.textContent = 'RESUME';
                    stopBtn.disabled = true;
                    saveBtn.disabled = false;
                    break;
                    
                case 'expired':
                    startBtn.disabled = false;
                    startBtn.textContent = 'OVERTIME';
                    stopBtn.disabled = true;
                    saveBtn.disabled = false;
                    break;
                    
                case 'completed':
                    startBtn.disabled = true;
                    startBtn.textContent = 'COMPLETED';
                    stopBtn.disabled = true;
                    saveBtn.disabled = true;
                    saveBtn.textContent = '✅ SAVED';
                    break;
            }
        }

        // Update match card visual state
        matchCard.className = `match-card match-${match.status}`;
        
        // Re-apply timer visual state classes (since we reset the class above)
        if (timerState && match.status === 'active' && timerState.state === 'running') {
            const warningLevel = this.checkTimerWarnings(timerState.remaining);
            if (warningLevel) {
                matchCard.classList.add(`timer-${warningLevel}`);
            } else {
                matchCard.classList.add('timer-normal');
            }
        } else if (match.status === 'expired') {
            matchCard.classList.add('timer-expired');
        }
        
        // Update timer display with current remaining time
        if (timerDisplay) {
            if (timerState && timerState.state === 'running') {
                timerDisplay.textContent = this.formatTime(timerState.remaining);
            } else {
                timerDisplay.textContent = this.formatTime(match.timerRemaining || this.getTournamentConfig().matchDuration * 60);
            }
        }
    }

    findMatchById(matchId) {
        for (const round of this.rounds) {
            const match = round.matches.find(m => m.id === matchId);
            if (match) return match;
        }
        return null;
    }

    checkRoundCompletion() {
        const currentRoundData = this.rounds[this.rounds.length - 1];
        if (!currentRoundData) return;

        const completedMatches = currentRoundData.matches.filter(m => m.status === 'completed');
        const totalMatches = currentRoundData.matches.length;

        console.log(`📊 Round ${currentRoundData.roundNumber} progress: ${completedMatches.length}/${totalMatches} matches completed`);

        if (completedMatches.length === totalMatches) {
            console.log(`🏁 Round ${currentRoundData.roundNumber} completed!`);
            
            // Calculate round statistics
            const roundStats = this.calculateRoundStatistics(currentRoundData);
            
            // Update round status
            currentRoundData.status = 'completed';
            currentRoundData.completedAt = new Date().toISOString();
            currentRoundData.statistics = roundStats;
            
            // Show completion notification with statistics
            this.showRoundCompletionNotification(currentRoundData);
            
            // Check if tournament is finished or enable next round
            this.handleRoundProgression(currentRoundData);
            
            // Save state
            this.saveToStorage();
        }
    }

    calculateRoundStatistics(roundData) {
        const matches = roundData.matches;
        const stats = {
            totalMatches: matches.length,
            completedMatches: matches.filter(m => m.status === 'completed').length,
            totalGoals: 0,
            averageScore: 0,
            winners: {
                teamA: 0,
                teamB: 0,
                ties: 0
            },
            longestMatch: null,
            shortestMatch: null
        };

        let totalScoreA = 0;
        let totalScoreB = 0;
        let matchDurations = [];

        matches.forEach(match => {
            if (match.status === 'completed') {
                const scoreA = parseInt(match.scoreA) || 0;
                const scoreB = parseInt(match.scoreB) || 0;
                
                totalScoreA += scoreA;
                totalScoreB += scoreB;
                stats.totalGoals += scoreA + scoreB;
                
                // Count winners
                if (match.winner === 'teamA') stats.winners.teamA++;
                else if (match.winner === 'teamB') stats.winners.teamB++;
                else stats.winners.ties++;

                // Calculate match duration if available
                if (match.startTime && match.endTime) {
                    const duration = new Date(match.endTime) - new Date(match.startTime);
                    matchDurations.push({ match: match.matchNumber, duration });
                }
            }
        });

        if (stats.completedMatches > 0) {
            stats.averageScore = Math.round((totalScoreA + totalScoreB) / (stats.completedMatches * 2) * 100) / 100;
        }

        // Find longest and shortest matches
        if (matchDurations.length > 0) {
            matchDurations.sort((a, b) => b.duration - a.duration);
            stats.longestMatch = matchDurations[0];
            stats.shortestMatch = matchDurations[matchDurations.length - 1];
        }

        return stats;
    }

    showRoundCompletionNotification(roundData) {
        const stats = roundData.statistics;
        let message = `🏁 Round ${roundData.roundNumber} Complete!\n`;
        message += `📊 ${stats.totalMatches} matches played\n`;
        message += `⚽ ${stats.totalGoals} total goals\n`;
        message += `📈 Average score: ${stats.averageScore}\n`;
        
        if (stats.winners.ties > 0) {
            message += `🤝 ${stats.winners.ties} tie games\n`;
        }

        this.showSuccess(message);
        console.log(`📈 Round ${roundData.roundNumber} Statistics:`, stats);
        
        // Update UI with round statistics
        this.displayRoundStatistics(roundData);
    }

    displayRoundStatistics(roundData) {
        const statsPanel = document.getElementById('roundStatistics');
        const statsGrid = document.getElementById('roundStatsGrid');
        
        if (!statsPanel || !statsGrid) return;
        
        const stats = roundData.statistics;
        
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">🏆</div>
                <div class="stat-content">
                    <h4>Round ${roundData.roundNumber}</h4>
                    <p>Completed at ${new Date(roundData.completedAt).toLocaleTimeString()}</p>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon">🎯</div>
                <div class="stat-content">
                    <h4>${stats.totalMatches}</h4>
                    <p>Total Matches</p>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon">⚽</div>
                <div class="stat-content">
                    <h4>${stats.totalGoals}</h4>
                    <p>Total Goals</p>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-content">
                    <h4>${stats.averageScore}</h4>
                    <p>Average Score</p>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon">🥇</div>
                <div class="stat-content">
                    <h4>${stats.winners.teamA + stats.winners.teamB}</h4>
                    <p>Decisive Matches</p>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon">🤝</div>
                <div class="stat-content">
                    <h4>${stats.winners.ties}</h4>
                    <p>Tie Games</p>
                </div>
            </div>
        `;
        
        // Add match duration stats if available
        if (stats.longestMatch || stats.shortestMatch) {
            const durationStats = document.createElement('div');
            durationStats.className = 'stat-card duration-stats';
            
            let durationContent = '<div class="stat-icon">⏱️</div><div class="stat-content"><h4>Match Duration</h4>';
            
            if (stats.longestMatch) {
                const duration = Math.round(stats.longestMatch.duration / (1000 * 60));
                durationContent += `<p>Longest: ${duration}min (Match ${stats.longestMatch.match})</p>`;
            }
            
            if (stats.shortestMatch) {
                const duration = Math.round(stats.shortestMatch.duration / (1000 * 60));
                durationContent += `<p>Shortest: ${duration}min (Match ${stats.shortestMatch.match})</p>`;
            }
            
            durationContent += '</div>';
            durationStats.innerHTML = durationContent;
            statsGrid.appendChild(durationStats);
        }
        
        // Show the statistics panel
        statsPanel.style.display = 'block';
        
        // Scroll to statistics
        statsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    handleRoundProgression(completedRound) {
        const config = this.getTournamentConfig();
        const nextRoundNumber = completedRound.roundNumber + 1;
        
        // Check if tournament is finished
        if (nextRoundNumber > config.totalRounds) {
            this.completeTournament();
            return;
        }

        // Check if next round teams are available
        const teamsManager = this.app.getTeamsManager();
        const teamsData = teamsManager.getTeamsData();
        const nextRoundTeams = teamsData?.teamHistory?.find(group => group.round === nextRoundNumber);

        if (nextRoundTeams) {
            // Next round teams available - enable automatic progression
            this.enableNextRoundProgression(nextRoundNumber, nextRoundTeams);
        } else {
            // Next round teams not yet generated
            this.showNextRoundGenerationPrompt(nextRoundNumber);
        }
    }

    completeTournament() {
        console.log('🏆 TOURNAMENT COMPLETED!');
        
        // Calculate tournament statistics
        const tournamentStats = this.calculateTournamentStatistics();
        
        // Show tournament completion
        this.showTournamentCompletion(tournamentStats);
        
        // Update UI to show tournament complete state
        this.updateRoundsStatusUI([]);
    }

    calculateTournamentStatistics() {
        const allMatches = this.matchHistory;
        const stats = {
            totalRounds: this.rounds.length,
            totalMatches: allMatches.length,
            totalGoals: 0,
            playerStats: new Map(),
            teamStats: new Map()
        };

        // Analyze all matches
        allMatches.forEach(match => {
            if (match.status === 'completed') {
                const scoreA = parseInt(match.scoreA) || 0;
                const scoreB = parseInt(match.scoreB) || 0;
                stats.totalGoals += scoreA + scoreB;

                // Track team performance
                const teamAId = match.teamA.id;
                const teamBId = match.teamB.id;
                
                if (!stats.teamStats.has(teamAId)) {
                    stats.teamStats.set(teamAId, { name: match.teamA.name, wins: 0, losses: 0, ties: 0, goals: 0 });
                }
                if (!stats.teamStats.has(teamBId)) {
                    stats.teamStats.set(teamBId, { name: match.teamB.name, wins: 0, losses: 0, ties: 0, goals: 0 });
                }

                const teamAStats = stats.teamStats.get(teamAId);
                const teamBStats = stats.teamStats.get(teamBId);
                
                teamAStats.goals += scoreA;
                teamBStats.goals += scoreB;

                if (match.winner === 'teamA') {
                    teamAStats.wins++;
                    teamBStats.losses++;
                } else if (match.winner === 'teamB') {
                    teamBStats.wins++;
                    teamAStats.losses++;
                } else {
                    teamAStats.ties++;
                    teamBStats.ties++;
                }
            }
        });

        return stats;
    }

    showTournamentCompletion(stats) {
        // Create tournament summary
        const topTeams = Array.from(stats.teamStats.values())
            .sort((a, b) => (b.wins * 3 + b.ties) - (a.wins * 3 + a.ties))
            .slice(0, 3);

        let message = `🏆 TOURNAMENT COMPLETE!\n\n`;
        message += `📊 Tournament Summary:\n`;
        message += `• ${stats.totalRounds} rounds played\n`;
        message += `• ${stats.totalMatches} total matches\n`;
        message += `• ${stats.totalGoals} total goals\n\n`;
        
        if (topTeams.length > 0) {
            message += `🥇 Top Teams:\n`;
            topTeams.forEach((team, index) => {
                const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
                message += `${emoji} ${team.name}: ${team.wins}W ${team.losses}L ${team.ties}T\n`;
            });
        }

        this.app.addNotification(message, 'success');
    }

    enableNextRoundProgression(nextRoundNumber, nextRoundTeams) {
        // Show progression notification
        this.app.addNotification(
            `✅ Round ${nextRoundNumber} teams are ready! You can start the next round.`,
            'info'
        );
        
        // Update UI to enable next round
        this.checkTeamsStatus();
    }

    showNextRoundGenerationPrompt(nextRoundNumber) {
        this.app.addNotification(
            `⚠️ Round ${this.currentRound} complete! Please generate teams for Round ${nextRoundNumber} to continue.`,
            'warning'
        );
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    getTournamentConfig() {
        const config = this.app.getTournamentFormData();
        return {
            courtsCount: config?.courts_count || 2,
            matchDuration: config?.match_duration || 25,
            totalRounds: config?.total_rounds || 3
        };
    }

    // ============================================================================
    // DATA PERSISTENCE
    // ============================================================================

    saveToStorage() {
        try {
            const roundsData = {
                rounds: this.rounds,
                currentRound: this.currentRound,
                matchHistory: this.matchHistory,
                restHistory: this.restHistory,
                timestamp: new Date().toISOString()
            };
            
            localStorage.setItem('formula_padel_rounds', JSON.stringify(roundsData));
            console.log('Rounds data saved to storage');
        } catch (error) {
            console.error('Error saving rounds data:', error);
        }
    }

    loadRoundsFromStorage() {
        try {
            const savedData = localStorage.getItem('formula_padel_rounds');
            if (savedData) {
                const roundsData = JSON.parse(savedData);
                this.rounds = roundsData.rounds || [];
                this.currentRound = roundsData.currentRound || 1;
                this.matchHistory = roundsData.matchHistory || [];
                this.restHistory = roundsData.restHistory || {};
                
                console.log('Rounds data loaded from storage');
                
                // Re-render existing rounds in descending order (latest first)
                const sortedRounds = [...this.rounds].sort((a, b) => b.roundNumber - a.roundNumber);
                sortedRounds.forEach(round => {
                    this.renderRoundFrame(round);
                    // Update UI state for all matches
                    round.matches.forEach(match => {
                        this.updateMatchCardUI(match.id, match);
                    });
                });
                this.checkTeamsStatus();
            }
        } catch (error) {
            console.error('Error loading rounds data:', error);
        }
    }

    clearRoundsData() {
        this.rounds = [];
        this.currentRound = 1;
        this.matchHistory = [];
        this.restHistory = {};
        this.activeTimers.clear();
        
        localStorage.removeItem('formula_padel_rounds');
        
        // Clear UI
        const roundsContainer = document.getElementById('roundsContainer');
        if (roundsContainer) {
            roundsContainer.innerHTML = '';
        }
        
        // Reset button status
        this.checkTeamsStatus();
        
        console.log('✅ Rounds data cleared and reset to initial state');
    }

    // ============================================================================
    // REST STATISTICS & DEBUGGING
    // ============================================================================

    getRestStatistics() {
        const stats = {};
        
        // Analyze each team's rest pattern
        Object.keys(this.restHistory).forEach(teamId => {
            const history = this.restHistory[teamId];
            stats[teamId] = {
                totalRests: history.totalRests,
                lastRestRound: history.lastRestRound,
                consecutiveRests: history.consecutiveRests,
                restRounds: history.restRounds,
                restPercentage: this.currentRound > 1 ? (history.totalRests / (this.currentRound - 1) * 100).toFixed(1) : '0.0'
            };
        });
        
        return stats;
    }

    printRestStatistics() {
        const stats = this.getRestStatistics();
        console.log('\n🏃‍♀️💤 REST STATISTICS:');
        console.log('================================');
        
        Object.keys(stats).forEach(teamId => {
            const teamStats = stats[teamId];
            // Find team name
            const teamName = this.findTeamNameById(teamId) || teamId;
            console.log(`${teamName}:`);
            console.log(`  Total rests: ${teamStats.totalRests}`);
            console.log(`  Last rest: Round ${teamStats.lastRestRound || 'Never'}`);
            console.log(`  Consecutive: ${teamStats.consecutiveRests}`);
            console.log(`  Rest %: ${teamStats.restPercentage}%`);
            console.log(`  Rounds rested: [${teamStats.restRounds.join(', ')}]`);
            console.log('');
        });
    }

    findTeamNameById(teamId) {
        // Search in all rounds for team name
        for (const round of this.rounds) {
            if (round.restingTeams) {
                const team = round.restingTeams.find(t => t.id === teamId);
                if (team) return team.name;
            }
            if (round.matches) {
                for (const match of round.matches) {
                    if (match.teamA.id === teamId) return match.teamA.name;
                    if (match.teamB.id === teamId) return match.teamB.name;
                }
            }
        }
        return null;
    }

    validateRestAlgorithm() {
        console.log('\n🔍 VALIDATING REST ALGORITHM:');
        console.log('==============================');
        
        // Check for consecutive rests
        let hasConsecutiveRests = false;
        Object.keys(this.restHistory).forEach(teamId => {
            const history = this.restHistory[teamId];
            if (history.consecutiveRests > 1) {
                console.warn(`⚠️ Team ${this.findTeamNameById(teamId)} has ${history.consecutiveRests} consecutive rests!`);
                hasConsecutiveRests = true;
            }
        });
        
        if (!hasConsecutiveRests) {
            console.log('✅ No consecutive rests detected');
        }
        
        // Check for fair distribution
        const stats = this.getRestStatistics();
        const restCounts = Object.values(stats).map(s => s.totalRests);
        const minRests = Math.min(...restCounts);
        const maxRests = Math.max(...restCounts);
        
        console.log(`📊 Rest distribution: min=${minRests}, max=${maxRests}, delta=${maxRests - minRests}`);
        
        if (maxRests - minRests <= 1) {
            console.log('✅ Fair rest distribution achieved');
        } else {
            console.warn('⚠️ Uneven rest distribution detected');
        }
        
        return { hasConsecutiveRests, restDistributionDelta: maxRests - minRests };
    }

    // ============================================================================
    // NOTIFICATION METHODS
    // ============================================================================

    showError(message) {
        console.error(message);
        // TODO: Use app notification system
        alert('Error: ' + message);
    }

    showSuccess(message) {
        console.log(message);
        // TODO: Use app notification system
        alert('Success: ' + message);
    }

    // ============================================================================
    // PUBLIC API METHODS
    // ============================================================================

    getCurrentRound() {
        return this.currentRound;
    }

    getRoundsData() {
        return this.rounds;
    }

    getMatchHistory() {
        return this.matchHistory;
    }

}

// Export for use in main application
window.RoundsManager = RoundsManager;
