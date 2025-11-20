/**
 * FORMULA PADEL - LEAGUE MANAGER V2.0
 * Modulo dedicato alla gestione della classifica live e sistema di punteggi
 * Implementa il sistema DOPPIO PUNTEGGIO secondo MASTERGUIDE
 */

class LeagueManager {
    constructor(app) {
        this.app = app;
        this.leagueData = new Map(); // player_id -> stats object
        this.currentRanking = [];
        
        this.setupEventListeners();
        this.loadLeagueFromStorage();
        
        // Initialize league with existing players
        this.initializeLeagueWithPlayers();
        
        console.log('🏆 League Manager initialized');
    }

    // ============================================================================
    // INITIALIZATION & EVENT LISTENERS
    // ============================================================================

    setupEventListeners() {
        // Refresh League button
        document.getElementById('refreshLeagueBtn')?.addEventListener('click', () => {
            this.refreshLeague();
        });

        // Reset League button
        document.getElementById('resetLeagueBtn')?.addEventListener('click', () => {
            this.resetLeague();
        });
    }

    /**
     * Inizializza la league con tutti i player esistenti nel torneo
     */
    initializeLeagueWithPlayers() {
        console.log('🏆 Initializing league with existing players...');
        
        try {
            if (!this.app.playersManager) {
                console.log('⚠️ Players Manager not yet available');
                return;
            }
            
            const playersData = this.app.playersManager.getPlayersData();
            const allPlayers = [...playersData.beasts, ...playersData.colors];
            
            allPlayers.forEach(player => {
                if (!this.leagueData.has(player.id)) {
                    this.leagueData.set(player.id, {
                        playerId: player.id,
                        playerName: this.getPlayerName(player.id),
                        gamesWon: 0,
                        gamesLost: 0,
                        matchesWon: 0,
                        matchesPlayed: 0,
                        totalPoints: 0,
                        goalDifference: 0
                    });
                    console.log(`🆕 Added ${this.getPlayerName(player.id)} to league`);
                } else {
                    // Update existing player name in case it changed
                    const existingPlayer = this.leagueData.get(player.id);
                    existingPlayer.playerName = this.getPlayerName(player.id);
                    console.log(`🔄 Updated name for ${this.getPlayerName(player.id)}`);
                }
            });
            
            // Process any existing match history
            this.processExistingMatches();
            
            this.calculateRanking();
            this.renderLeagueTable();
            
        } catch (error) {
            console.error('❌ Error initializing league with players:', error);
        }
    }

    /**
     * Processa tutti i match già completati dalla history
     */
    processExistingMatches() {
        try {
            if (!this.app.roundsManager) {
                console.log('⚠️ Rounds Manager not yet available');
                return;
            }
            
            const matchHistory = this.app.roundsManager.getMatchHistory();
            console.log(`🔄 Processing ${matchHistory.length} existing matches...`);
            
            // Reset league data before processing
            this.leagueData.forEach(playerStats => {
                playerStats.gamesWon = 0;
                playerStats.gamesLost = 0;
                playerStats.matchesWon = 0;
                playerStats.matchesPlayed = 0;
                playerStats.totalPoints = 0;
                playerStats.goalDifference = 0;
            });
            
            // Process each completed match
            matchHistory.forEach((match, index) => {
                if (match.status === 'completed' && match.scoreA !== undefined && match.scoreB !== undefined) {
                    console.log(`📊 Processing match ${index + 1}: ${match.scoreA}-${match.scoreB}`);
                    this.updateLeagueFromMatch(match, false); // false = no auto render
                }
            });
            
            // Save and render once at the end
            this.saveLeagueToStorage();
            console.log(`✅ Processed ${matchHistory.length} matches successfully`);
            
        } catch (error) {
            console.error('❌ Error processing existing matches:', error);
        }
    }

    // ============================================================================
    // DOPPIO PUNTEGGIO SYSTEM - SECONDO MASTERGUIDE
    // ============================================================================
    
    /**
     * Aggiorna la classifica dopo un match completato
     * SISTEMA SCORING DOPPIO:
     * 1️⃣ GAME POINTS: 1 punto per ogni game vinto (anche perdendo il match)
     * 2️⃣ MATCH BONUS: +1 punto per vincere l'intero match
     */
    updateLeagueFromMatch(matchResult, autoRender = true) {
        console.log('🏆 LEAGUE DEBUG - Starting updateLeagueFromMatch');
        console.log('🏆 LEAGUE DEBUG - Match result received:', JSON.stringify(matchResult, null, 2));
        
        // Validate match structure
        if (!matchResult || !matchResult.teamA || !matchResult.teamB) {
            console.error('❌ Invalid match result structure:', matchResult);
            return;
        }

        const teamA = matchResult.teamA;
        const teamB = matchResult.teamB;
        const scoreA = parseInt(matchResult.scoreA) || 0;
        const scoreB = parseInt(matchResult.scoreB) || 0;
        
        console.log(`📊 Processing match: Team A (${scoreA}) vs Team B (${scoreB})`);
        console.log('👥 LEAGUE DEBUG - Team A structure:', JSON.stringify(teamA, null, 2));
        console.log('👥 LEAGUE DEBUG - Team B structure:', JSON.stringify(teamB, null, 2));
        
        // Debug player IDs extraction
        if (teamA.beastPlayer) {
            console.log('🔍 LEAGUE DEBUG - Team A Beast Player ID:', teamA.beastPlayer.id, 'Alias:', teamA.beastPlayer.alias);
        }
        if (teamA.colorPlayer) {
            console.log('� LEAGUE DEBUG - Team A Color Player ID:', teamA.colorPlayer.id, 'Alias:', teamA.colorPlayer.alias);
        }
        if (teamB.beastPlayer) {
            console.log('🔍 LEAGUE DEBUG - Team B Beast Player ID:', teamB.beastPlayer.id, 'Alias:', teamB.beastPlayer.alias);
        }
        if (teamB.colorPlayer) {
            console.log('🔍 LEAGUE DEBUG - Team B Color Player ID:', teamB.colorPlayer.id, 'Alias:', teamB.colorPlayer.alias);
        }
        
        // Determina vincitore del match
        let winnerTeam = null;
        let loserTeam = null;
        
        if (scoreA > scoreB) {
            winnerTeam = teamA;
            loserTeam = teamB;
        } else if (scoreB > scoreA) {
            winnerTeam = teamB;
            loserTeam = teamA;
        }
        // Se scoreA === scoreB è un pareggio (nessun match bonus)

        console.log(`🎯 Winner: ${winnerTeam ? winnerTeam.name : 'TIE'}`);

        // Verifica struttura team prima di aggiornare
        if (!teamA.beastPlayer || !teamA.colorPlayer) {
            console.error('❌ Team A missing players:', teamA);
            return;
        }
        if (!teamB.beastPlayer || !teamB.colorPlayer) {
            console.error('❌ Team B missing players:', teamB);
            return;
        }

        console.log('🔄 LEAGUE DEBUG - About to update player stats...');

        // Aggiorna statistiche per ogni player del Team A
        console.log(`🔄 LEAGUE DEBUG - Updating Team A Beast Player: ${teamA.beastPlayer.id}`);
        this.updatePlayerStats(teamA.beastPlayer.id, {
            gamesWon: scoreA,
            gamesLost: scoreB,
            matchesPlayed: 1,
            matchesWon: winnerTeam === teamA ? 1 : 0,
            matchBonus: winnerTeam === teamA ? 1 : 0
        });

        console.log(`🔄 LEAGUE DEBUG - Updating Team A Color Player: ${teamA.colorPlayer.id}`);
        this.updatePlayerStats(teamA.colorPlayer.id, {
            gamesWon: scoreA,
            gamesLost: scoreB,
            matchesPlayed: 1,
            matchesWon: winnerTeam === teamA ? 1 : 0,
            matchBonus: winnerTeam === teamA ? 1 : 0
        });

        // Aggiorna statistiche per ogni player del Team B
        console.log(`🔄 LEAGUE DEBUG - Updating Team B Beast Player: ${teamB.beastPlayer.id}`);
        this.updatePlayerStats(teamB.beastPlayer.id, {
            gamesWon: scoreB,
            gamesLost: scoreA,
            matchesPlayed: 1,
            matchesWon: winnerTeam === teamB ? 1 : 0,
            matchBonus: winnerTeam === teamB ? 1 : 0
        });

        console.log(`🔄 LEAGUE DEBUG - Updating Team B Color Player: ${teamB.colorPlayer.id}`);
        this.updatePlayerStats(teamB.colorPlayer.id, {
            gamesWon: scoreB,
            gamesLost: scoreA,
            matchesPlayed: 1,
            matchesWon: winnerTeam === teamB ? 1 : 0,
            matchBonus: winnerTeam === teamB ? 1 : 0
        });

        console.log(`📊 Match ${matchResult.matchNumber} scored: ${scoreA}-${scoreB}`);
        console.log(`🎯 Winner: ${winnerTeam ? winnerTeam.name : 'TIE'}`);

        // Salva e aggiorna UI solo se richiesto
        if (autoRender) {
            this.saveLeagueToStorage();
            this.calculateRanking();
            this.renderLeagueTable();
        }
    }

    updatePlayerStats(playerId, newStats) {
        console.log(`🔄 LEAGUE DEBUG - updatePlayerStats called for player ${playerId}`);
        console.log(`🔄 LEAGUE DEBUG - Stats to add:`, newStats);
        
        if (!this.leagueData.has(playerId)) {
            // Inizializza player se non esiste
            console.log(`🆕 LEAGUE DEBUG - Creating new player entry for ${playerId}`);
            const playerName = this.getPlayerName(playerId);
            console.log(`🆕 LEAGUE DEBUG - Player name resolved to: ${playerName}`);
            
            this.leagueData.set(playerId, {
                playerId,
                playerName: playerName,
                gamesWon: 0,
                gamesLost: 0,
                matchesWon: 0,
                matchesPlayed: 0,
                totalPoints: 0,
                goalDifference: 0
            });
            console.log(`🆕 LEAGUE DEBUG - New player entry created:`, this.leagueData.get(playerId));
        }

        const playerStats = this.leagueData.get(playerId);
        console.log(`📊 LEAGUE DEBUG - Before update - ${playerId}:`, JSON.stringify(playerStats, null, 2));
        
        // Aggiorna statistiche
        playerStats.gamesWon += newStats.gamesWon;
        playerStats.gamesLost += newStats.gamesLost;
        playerStats.matchesPlayed += newStats.matchesPlayed;
        playerStats.matchesWon += newStats.matchesWon;
        
        // Calcola Total Points = Game Points + Match Bonus
        playerStats.totalPoints = playerStats.gamesWon + playerStats.matchesWon;
        playerStats.goalDifference = playerStats.gamesWon - playerStats.gamesLost;

        console.log(`✅ LEAGUE DEBUG - After update - ${playerId}:`, JSON.stringify(playerStats, null, 2));
        console.log(`📈 LEAGUE DEBUG - Updated ${playerStats.playerName}: ${playerStats.gamesWon} games, ${playerStats.matchesWon} matches = ${playerStats.totalPoints} total pts`);
    }

    getPlayerName(playerId) {
        try {
            if (!this.app.playersManager) {
                console.warn(`🚫 PlayersManager not available for player ${playerId}`);
                return `Player ${playerId}`;
            }
            
            const playersData = this.app.playersManager.getPlayersData();
            const allPlayers = [...playersData.beasts, ...playersData.colors];
            const player = allPlayers.find(p => p.id === playerId);
            
            if (player) {
                console.log(`👤 Found player ${playerId}:`, {
                    name: player.name,
                    alias: player.alias,
                    emoji: player.emoji
                });
                
                // Create formatted name with emoji and alias
                let displayName = '';
                
                // Add emoji if available
                if (player.emoji && player.emoji.trim()) {
                    displayName += `${player.emoji} `;
                }
                
                // Add alias if available, otherwise use name
                if (player.alias && player.alias.trim()) {
                    displayName += player.alias;
                } else if (player.name && player.name.trim()) {
                    displayName += player.name;
                } else {
                    displayName += `Player ${playerId}`;
                }
                
                return displayName;
            } else {
                console.warn(`❌ Player ${playerId} not found in:`, allPlayers.map(p => ({id: p.id, name: p.name, alias: p.alias})));
                return `Player ${playerId}`;
            }
            
        } catch (error) {
            console.warn('Could not get player name:', error);
            return `Player ${playerId}`;
        }
    }

    // ============================================================================
    // RANKING CALCULATION & SORTING
    // ============================================================================

    calculateRanking() {
        this.currentRanking = Array.from(this.leagueData.values()).sort((a, b) => {
            // Primary: Total Points (descending)
            if (a.totalPoints !== b.totalPoints) {
                return b.totalPoints - a.totalPoints;
            }
            
            // Tie-breaker 1: Goal Difference (descending) 
            if (a.goalDifference !== b.goalDifference) {
                return b.goalDifference - a.goalDifference;
            }
            
            // Tie-breaker 2: Games Won (descending)
            if (a.gamesWon !== b.gamesWon) {
                return b.gamesWon - a.gamesWon;
            }
            
            // Tie-breaker 3: Matches Won (descending)
            if (a.matchesWon !== b.matchesWon) {
                return b.matchesWon - a.matchesWon;
            }
            
            // Final tie-breaker: Alphabetical by name
            return a.playerName.localeCompare(b.playerName);
        });

        console.log('🏆 League ranking calculated:', this.currentRanking.map(p => `${p.playerName}: ${p.totalPoints}pts`));
    }

    // ============================================================================
    // UI RENDERING
    // ============================================================================

    renderLeagueTable() {
        console.log('🏆 LEAGUE DEBUG - renderLeagueTable called');
        
        const tableBody = document.getElementById('leagueTableBody');
        if (!tableBody) {
            console.error('League table body not found');
            return;
        }

        // Debug: Log current league data
        console.log('🏆 LEAGUE DEBUG - Current league data size:', this.leagueData.size);
        console.log('🏆 LEAGUE DEBUG - Current league data entries:');
        for (let [playerId, stats] of this.leagueData.entries()) {
            console.log(`   Player ${playerId}:`, JSON.stringify(stats, null, 2));
        }
        console.log('📊 LEAGUE DEBUG - Current ranking:', JSON.stringify(this.currentRanking, null, 2));

        // Se non ci sono dati, mostra messaggio vuoto
        if (this.currentRanking.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 2rem; color: #7f8c8d; font-style: italic;">
                        <i class="fas fa-info-circle" style="margin-right: 8px;"></i>No matches completed yet. Start playing to see rankings!
                    </td>
                </tr>
            `;
            this.hidePodium();
            return;
        }

        // Rendering della tabella
        tableBody.innerHTML = '';
        
        this.currentRanking.forEach((player, index) => {
            const position = index + 1;
            const row = document.createElement('tr');
            
            // Get player details
            const playerDetails = this.getPlayerDetails(player.playerId);
            console.log(`🎭 LEAGUE DEBUG - Rendering player ${player.playerId}:`, playerDetails);
            console.log(`🎭 LEAGUE DEBUG - Player stats:`, JSON.stringify(player, null, 2));
            
            // Format goal difference with color
            let goalDiffClass = 'league-goal-diff-zero';
            if (player.goalDifference > 0) goalDiffClass = 'league-goal-diff-positive';
            else if (player.goalDifference < 0) goalDiffClass = 'league-goal-diff-negative';
            
            row.innerHTML = `
                <td class="rank-col">${position}</td>
                <td class="emoji-col">${playerDetails.emoji}</td>
                <td class="player-col">${playerDetails.name || playerDetails.alias}</td>
                <td class="league-won">${player.gamesWon}</td>
                <td class="league-lost">${player.gamesLost}</td>
                <td class="league-won">${player.matchesWon}</td>
                <td>${player.matchesPlayed}</td>
                <td class="league-total-points">${player.totalPoints}</td>
                <td class="${goalDiffClass}">${player.goalDifference > 0 ? '+' : ''}${player.goalDifference}</td>
                <td>
                    <button class="btn-icon" onclick="formulaPadelApp.leagueManager.showPlayerStats('${player.playerId}')" title="View detailed stats">
                        <i class="fas fa-chart-line"></i>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });

        // Mostra podium se ci sono almeno 3 players
        if (this.currentRanking.length >= 3) {
            this.updatePodium();
        } else {
            this.hidePodium();
        }

        console.log('✅ League table rendered with', this.currentRanking.length, 'players');
    }

    /**
     * Gets player details (emoji, alias, name) separately
     */
    getPlayerDetails(playerId) {
        try {
            if (!this.app.playersManager) {
                console.warn(`🚫 EMOJI DEBUG - PlayersManager not available for player ${playerId}`);
                return {
                    emoji: '👤',
                    alias: '',
                    name: `Player ${playerId}`
                };
            }
            
            const playersData = this.app.playersManager.getPlayersData();
            console.log(`🔍 EMOJI DEBUG - PlayersManager data:`, playersData);
            
            const allPlayers = [...playersData.beasts, ...playersData.colors];
            console.log(`🔍 EMOJI DEBUG - All players available:`, allPlayers.map(p => ({
                id: p.id, 
                name: p.name,
                alias: p.alias,
                emoji: p.emoji
            })));
            
            const player = allPlayers.find(p => p.id === playerId);
            
            console.log(`🔍 EMOJI DEBUG - Looking for player ID: "${playerId}" (type: ${typeof playerId})`);
            console.log(`🔍 EMOJI DEBUG - Available IDs:`, allPlayers.map(p => `"${p.id}" (${typeof p.id})`));
            
            if (player) {
                console.log(`✅ EMOJI DEBUG - Found player ${playerId}:`, {
                    name: player.name,
                    alias: player.alias,
                    emoji: player.emoji,
                    aliasEmoji: player.aliasEmoji
                });
                
                // Clean and validate emoji - check both emoji and aliasEmoji properties
                let emoji = player.aliasEmoji || player.emoji;
                if (!emoji || emoji === undefined || emoji === null || String(emoji).trim() === '') {
                    emoji = '👤'; // Default fallback emoji
                    console.log(`🎭 EMOJI DEBUG - No emoji for player ${playerId} (value: ${emoji}), using fallback: 👤`);
                } else {
                    emoji = String(emoji).trim();
                    console.log(`🎭 EMOJI DEBUG - Player ${playerId} has emoji: ${emoji}`);
                    
                    // Test emoji rendering
                    const testSpan = document.createElement('span');
                    testSpan.textContent = emoji;
                    if (testSpan.textContent !== emoji) {
                        console.warn(`🚨 EMOJI WARNING - Emoji ${emoji} may not render correctly`);
                    }
                }
                
                // Clean alias and name
                let alias = (player.alias && player.alias.trim()) ? player.alias.trim() : '';
                let name = (player.name && player.name.trim()) ? player.name.trim() : `Player ${playerId}`;
                
                return {
                    emoji: emoji,
                    alias: alias,
                    name: name
                };
            } else {
                // Prova con conversione di tipo
                console.log(`🔄 EMOJI DEBUG - Player ${playerId} not found with exact match, trying type conversion...`);
                
                const playerByStringId = allPlayers.find(p => String(p.id) === String(playerId));
                const playerByNumberId = allPlayers.find(p => Number(p.id) === Number(playerId));
                
                console.log(`🔄 EMOJI DEBUG - String match result:`, playerByStringId);
                console.log(`🔄 EMOJI DEBUG - Number match result:`, playerByNumberId);
                
                const foundPlayer = playerByStringId || playerByNumberId;
                
                if (foundPlayer) {
                    console.log(`✅ EMOJI DEBUG - Found player with type conversion:`, {
                        name: foundPlayer.name,
                        alias: foundPlayer.alias,
                        emoji: foundPlayer.emoji
                    });
                    
                    let emoji = foundPlayer.emoji;
                    if (!emoji || emoji === undefined || emoji === null || String(emoji).trim() === '') {
                        emoji = '👤';
                        console.log(`🎭 EMOJI DEBUG - No emoji for converted player (value: ${foundPlayer.emoji}), using fallback: ${emoji}`);
                    } else {
                        emoji = String(emoji).trim();
                        console.log(`🎭 EMOJI DEBUG - Converted player has emoji: ${emoji}`);
                    }
                    
                    let alias = (foundPlayer.alias && foundPlayer.alias.trim()) ? foundPlayer.alias.trim() : '';
                    let name = (foundPlayer.name && foundPlayer.name.trim()) ? foundPlayer.name.trim() : `Player ${playerId}`;
                    
                    return {
                        emoji: emoji,
                        alias: alias,
                        name: name
                    };
                }
            }
            
            console.warn(`❌ Player ${playerId} not found in players data`);
            return {
                emoji: '👤',
                alias: '',
                name: `Player ${playerId}`
            };
        } catch (error) {
            console.error('Error getting player details:', error);
            return {
                emoji: '👤',
                alias: '',
                name: `Player ${playerId}`
            };
        }
    }

    /**
     * Formats player display name with emoji and alias
     */
    formatPlayerDisplayName(playerId) {
        try {
            if (!this.app.playersManager) {
                return `Player ${playerId}`;
            }
            
            const playersData = this.app.playersManager.getPlayersData();
            const allPlayers = [...playersData.beasts, ...playersData.colors];
            const player = allPlayers.find(p => p.id === playerId);
            
            if (player) {
                let displayName = '';
                
                // Add emoji if available
                if (player.emoji && player.emoji.trim()) {
                    displayName += `<span class="league-player-emoji">${player.emoji}</span> `;
                }
                
                // Add name/alias
                let name = '';
                if (player.alias && player.alias.trim()) {
                    name = player.alias;
                } else if (player.name && player.name.trim()) {
                    name = player.name;
                } else {
                    name = `Player ${playerId}`;
                }
                
                displayName += `<span class="league-player-alias">${name}</span>`;
                
                return displayName;
            }
            
            return `Player ${playerId}`;
        } catch (error) {
            console.warn('Could not format player display name:', error);
            return `Player ${playerId}`;
        }
    }

    /**
     * Show detailed stats for a player
     */
    showPlayerStats(playerId) {
        const playerData = this.leagueData.get(playerId);
        if (!playerData) {
            this.app.addNotification('Player stats not found', 'error');
            return;
        }
        
        const winRate = playerData.matchesPlayed > 0 ? 
            (playerData.matchesWon / playerData.matchesPlayed * 100).toFixed(1) : '0.0';
        
        alert(`Player Statistics\n\n` +
              `Player: ${playerData.playerName}\n` +
              `Games Won: ${playerData.gamesWon}\n` +
              `Games Lost: ${playerData.gamesLost}\n` +
              `Matches Won: ${playerData.matchesWon}\n` +
              `Matches Played: ${playerData.matchesPlayed}\n` +
              `Win Rate: ${winRate}%\n` +
              `Total Points: ${playerData.totalPoints}\n` +
              `Goal Difference: ${playerData.goalDifference}`);
    }

    updatePodium() {
        const podiumSection = document.getElementById('podiumSection');
        const firstPlace = document.getElementById('podiumFirst');
        const secondPlace = document.getElementById('podiumSecond');
        const thirdPlace = document.getElementById('podiumThird');
        
        if (!podiumSection || !firstPlace || !secondPlace || !thirdPlace) return;

        const top3 = this.currentRanking.slice(0, 3);
        
        if (top3.length >= 1) {
            firstPlace.querySelector('.player-name').textContent = top3[0].playerName;
            firstPlace.querySelector('.player-points').textContent = `${top3[0].totalPoints} pts`;
        }
        
        if (top3.length >= 2) {
            secondPlace.querySelector('.player-name').textContent = top3[1].playerName;
            secondPlace.querySelector('.player-points').textContent = `${top3[1].totalPoints} pts`;
        }
        
        if (top3.length >= 3) {
            thirdPlace.querySelector('.player-name').textContent = top3[2].playerName;
            thirdPlace.querySelector('.player-points').textContent = `${top3[2].totalPoints} pts`;
        }

        podiumSection.style.display = 'block';
        console.log('🏆 Podium updated with top 3 players');
    }

    hidePodium() {
        const podiumSection = document.getElementById('podiumSection');
        if (podiumSection) {
            podiumSection.style.display = 'none';
        }
    }

    // ============================================================================
    // DATA PERSISTENCE
    // ============================================================================

    saveLeagueToStorage() {
        try {
            const leagueArray = Array.from(this.leagueData.entries());
            localStorage.setItem('tournament_league_data', JSON.stringify(leagueArray));
            console.log('💾 League data saved to storage');
        } catch (error) {
            console.error('Error saving league data:', error);
        }
    }

    loadLeagueFromStorage() {
        try {
            const saved = localStorage.getItem('tournament_league_data');
            if (saved) {
                const leagueArray = JSON.parse(saved);
                this.leagueData = new Map(leagueArray);
                this.calculateRanking();
                console.log('📂 League data loaded from storage');
            }
        } catch (error) {
            console.error('Error loading league data:', error);
            this.leagueData = new Map();
        }
    }

    // ============================================================================
    // PUBLIC METHODS
    // ============================================================================

    refreshLeague() {
        console.log('🔄 Refreshing league table...');
        
        // Update all player names before re-initializing
        this.updateAllPlayerNames();
        
        // Re-initialize with current players and process all matches
        this.initializeLeagueWithPlayers();
        
        this.app.addNotification('League table refreshed!', 'success');
    }

    /**
     * Updates all player names in the league data
     */
    updateAllPlayerNames() {
        console.log('📝 Updating all player names...');
        
        this.leagueData.forEach((playerStats, playerId) => {
            const updatedName = this.getPlayerName(playerId);
            playerStats.playerName = updatedName;
            console.log(`🔄 Updated ${playerId} name to: ${updatedName}`);
        });
    }

    resetLeague() {
        if (confirm('Are you sure you want to reset the entire league? This will delete all player statistics.')) {
            this.leagueData.clear();
            this.currentRanking = [];
            localStorage.removeItem('tournament_league_data');
            
            this.renderLeagueTable();
            
            console.log('🗑️ League data reset');
            this.app.addNotification('League data reset successfully!', 'success');
        }
    }

    getLeagueData() {
        return {
            leagueData: this.leagueData,
            currentRanking: this.currentRanking
        };
    }

    // ============================================================================
    // Method called by rounds manager when match is completed
    // ============================================================================
    onMatchCompleted(matchResult) {
        this.updateLeagueFromMatch(matchResult);
    }
}

// Export per utilizzo in app.js
window.LeagueManager = LeagueManager;