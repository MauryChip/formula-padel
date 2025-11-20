/**
 * FORMULA PADEL - DATABASE MANAGER V2.0
 * SQLite wrapper per bucket system e gestione tornei
 * Allineato con MASTERGUIDE.txt specifications
 */

class PadelDatabase {
    constructor() {
        this.db = null;
        this.isInitialized = false;
    }

    // ============================================================================
    // INIZIALIZZAZIONE DATABASE
    // ============================================================================
    
    async init() {
        try {
            // Per ora simuliamo con localStorage fino a integrazione sql.js
            this.db = {
                storage: localStorage,
                execute: this.mockExecute.bind(this),
                all: this.mockAll.bind(this)
            };
            
            console.log('🗄️ PadelDatabase initialized (localStorage simulation)');
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('❌ Database init failed:', error);
            return false;
        }
    }

    // Mock execution per testing (da sostituire con sql.js)
    mockExecute(sql, params = []) {
        console.log('📝 SQL:', sql);
        console.log('📝 Params:', params);
        return { rowsAffected: 1, insertId: Math.random() };
    }

    mockAll(sql, params = []) {
        console.log('📝 SQL Query:', sql);
        console.log('📝 Params:', params);
        return [];
    }

    // ============================================================================
    // BUCKET SYSTEM - CORE FUNCTIONALITY
    // ============================================================================

    /**
     * Load players subset from bucket based on tournament size
     */
    async loadPlayersFromBucket(tournamentId, playerCount) {
        if (![8, 16, 24, 32].includes(playerCount)) {
            throw new Error('Invalid player count. Must be 8, 16, 24, or 32');
        }

        const query = `
            SELECT id, name, default_score, category 
            FROM default_names 
            WHERE is_active = 1 
            ORDER BY id 
            LIMIT ?
        `;
        
        // Mock data per testing
        const bucketPlayers = [];
        for (let i = 1; i <= playerCount; i++) {
            bucketPlayers.push({
                id: i,
                name: `Player ${i.toString().padStart(2, '0')}`,
                default_score: 5,
                category: 'COLORS'
            });
        }

        // Assign random emoji to each player
        const playersWithEmoji = await this.assignRandomEmojis(bucketPlayers);
        
        // Insert into tournament players table
        for (const player of playersWithEmoji) {
            await this.insertTournamentPlayer(tournamentId, player);
        }

        console.log(`✅ Loaded ${playerCount} players from bucket for tournament ${tournamentId}`);
        return playersWithEmoji;
    }

    /**
     * Assign random emoji to players from emoji bucket
     */
    async assignRandomEmojis(players) {
        const emojiQuery = `SELECT emoji FROM emoji_bucket WHERE is_active = 1`;
        
        // Mock emoji bucket
        const emojiBucket = [
            '🎾', '⚡', '🔥', '🌟', '💫', '⭐', '🏆', '🚀',
            '💎', '👑', '🦅', '🐅', '🦁', '🐺', '⚽', '🏀',
            '🎯', '💪', '🔱', '⚔️', '🛡️', '🏹', '🎪', '🎭',
            '🎨', '🎵', '🎸', '🥁', '🎺', '🎻', '🎤', '🎬',
            '🌶️', '🍕', '🍔', '🌮', '🍰', '🍩', '☕', '🥤'
        ];

        const availableEmojis = [...emojiBucket];
        
        return players.map(player => {
            const randomIndex = Math.floor(Math.random() * availableEmojis.length);
            const selectedEmoji = availableEmojis.splice(randomIndex, 1)[0];
            
            return {
                ...player,
                emoji: selectedEmoji || '🎾' // fallback
            };
        });
    }

    /**
     * Load player bucket for Players Manager compatibility
     * Returns formatted players with proper structure for UI
     */
    async loadPlayerBucket(playerCount) {
        try {
            if (![8, 16, 24, 32].includes(playerCount)) {
                return {
                    success: false,
                    error: 'Invalid player count. Must be 8, 16, 24, or 32',
                    players: []
                };
            }

            // Generate realistic player data with PlayerScore between 0.5-5.0 (1 decimal)
            const players = [];
            const baseNames = [
                'Marco', 'Luca', 'Andrea', 'Francesco', 'Alessandro', 'Matteo', 'Lorenzo', 'Gabriele',
                'Davide', 'Simone', 'Giuseppe', 'Antonio', 'Roberto', 'Stefano', 'Paolo', 'Michele',
                'Giorgio', 'Emanuele', 'Riccardo', 'Fabio', 'Daniele', 'Alberto', 'Federico', 'Claudio',
                'Giovanni', 'Vincenzo', 'Nicola', 'Salvatore', 'Massimo', 'Gianluca', 'Diego', 'Sergio'
            ];
            
            for (let i = 0; i < playerCount; i++) {
                // Generate random PlayerScore between 0.5 and 5.0 with max 1 decimal
                const score = Math.round((Math.random() * 4.5 + 0.5) * 10) / 10;
                
                players.push({
                    id: i + 1,
                    name: baseNames[i] || `Player ${(i + 1).toString().padStart(2, '0')}`,
                    PlayerScore: score, // Between 0.5-5.0 with 1 decimal
                    category: null, // Will be calculated by players-manager (BEAST/COLOR)
                    alias: null, // Will be assigned from category-specific buckets
                    aliasEmoji: null, // Emoji associated with alias
                    ranking: null // Will be calculated
                });
            }

            console.log(`🗄️ Generated ${playerCount} players with random scores 0.5-5.0`);
            return {
                success: true,
                players: players
            };

        } catch (error) {
            console.error('❌ Load player bucket failed:', error);
            return {
                success: false,
                error: error.message,
                players: []
            };
        }
    }

    /**
     * Get COLOR aliases bucket (colors + corresponding emojis)
     */
    getColorAliases() {
        return [
            { alias: 'Red', emoji: '🔴' },
            { alias: 'Blue', emoji: '🔵' },
            { alias: 'Green', emoji: '🟢' },
            { alias: 'Yellow', emoji: '🟡' },
            { alias: 'Purple', emoji: '🟣' },
            { alias: 'Orange', emoji: '🟠' },
            { alias: 'Pink', emoji: '🩷' },
            { alias: 'Brown', emoji: '🤎' },
            { alias: 'Black', emoji: '⚫' },
            { alias: 'White', emoji: '⚪' },
            { alias: 'Gold', emoji: '🟨' },
            { alias: 'Silver', emoji: '🩶' },
            { alias: 'Bronze', emoji: '🟤' },
            { alias: 'Turquoise', emoji: '🟦' },
            { alias: 'Magenta', emoji: '🟪' },
            { alias: 'Cyan', emoji: '🩵' },
            { alias: 'Lime', emoji: '🟩' },
            { alias: 'Indigo', emoji: '💙' }
        ];
    }

    /**
     * Get BEAST aliases bucket (animals + corresponding emojis)
     */
    getBeastAliases() {
        return [
            { alias: 'Lion', emoji: '🦁' },
            { alias: 'Tiger', emoji: '🐅' },
            { alias: 'Eagle', emoji: '🦅' },
            { alias: 'Wolf', emoji: '🐺' },
            { alias: 'Bear', emoji: '🐻' },
            { alias: 'Hawk', emoji: '🦜' },
            { alias: 'Panther', emoji: '🐆' },
            { alias: 'Cobra', emoji: '🐍' },
            { alias: 'Shark', emoji: '🦈' },
            { alias: 'Dragon', emoji: '🐲' },
            { alias: 'Phoenix', emoji: '🔥' },
            { alias: 'Viper', emoji: '🐍' },
            { alias: 'Jaguar', emoji: '🐆' },
            { alias: 'Puma', emoji: '🐈‍⬛' },
            { alias: 'Rhino', emoji: '🦏' },
            { alias: 'Bull', emoji: '🐂' },
            { alias: 'Stallion', emoji: '🐎' }
        ];
    }

    /**
     * Assign category-specific aliases to players
     */
    assignCategoryAliases(players) {
        const colorAliases = this.getColorAliases();
        const beastAliases = this.getBeastAliases();
        
        // Shuffle alias buckets for randomization
        const shuffledColors = [...colorAliases].sort(() => Math.random() - 0.5);
        const shuffledBeasts = [...beastAliases].sort(() => Math.random() - 0.5);
        
        let colorIndex = 0;
        let beastIndex = 0;
        
        return players.map(player => {
            if (player.category === 'COLOR') {
                const colorAlias = shuffledColors[colorIndex % shuffledColors.length];
                colorIndex++;
                return {
                    ...player,
                    alias: colorAlias.alias,
                    aliasEmoji: colorAlias.emoji
                };
            } else if (player.category === 'BEAST') {
                const beastAlias = shuffledBeasts[beastIndex % shuffledBeasts.length];
                beastIndex++;
                return {
                    ...player,
                    alias: beastAlias.alias,
                    aliasEmoji: beastAlias.emoji
                };
            }
            return player;
        });
    }

    /**
     * Generate realistic score distribution for BEAST/COLOR categories
     * DEPRECATED - Using random scores 0.5-5.0 instead
     */
    generateRealisticScores(playerCount) {
        const scores = [];
        
        // Generate scores with normal distribution
        // BEASTS: 70-95 range (top players)
        // COLORS: 20-69 range (developing players)
        
        for (let i = 0; i < playerCount; i++) {
            let score;
            if (i < playerCount / 2) {
                // Top half - BEASTS (future)
                score = Math.floor(Math.random() * 26) + 70; // 70-95
            } else {
                // Bottom half - COLORS (future) 
                score = Math.floor(Math.random() * 50) + 20; // 20-69
            }
            scores.push(score);
        }
        
        // Shuffle for more realistic distribution
        return scores.sort(() => Math.random() - 0.5);
    }

    // ============================================================================
    // TOURNAMENT MANAGEMENT
    // ============================================================================

    async createTournament(data) {
        const query = `
            INSERT INTO tournaments (name, date, players_count, courts_count, match_duration, rounds_min, rounds_max, total_rounds)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        // Calculate rounds constraints using FORMULA PADEL logic
        // Minimum: Always allow at least 1 round
        const roundsMin = 1;
        // Maximum: Each player can face different opponents in Beast vs Color system
        const roundsMax = (data.players_count / 2) - 1;
        
        // Determine actual tournament rounds
        let tournamentRounds = data.total_rounds;
        if (!tournamentRounds) {
            // Default to recommended rounds based on tournament size
            if (data.players_count <= 8) {
                tournamentRounds = Math.min(2, roundsMax);
            } else if (data.players_count <= 16) {
                tournamentRounds = Math.min(3, roundsMax);
            } else {
                tournamentRounds = Math.min(Math.floor(data.players_count / 6), roundsMax);
            }
        }
        
        // Validate tournament rounds
        if (tournamentRounds < roundsMin) {
            throw new Error(`Tournament rounds (${tournamentRounds}) cannot be less than minimum required (${roundsMin})`);
        }
        if (tournamentRounds > roundsMax) {
            throw new Error(`Tournament rounds (${tournamentRounds}) cannot exceed maximum possible (${roundsMax})`);
        }
        
        const params = [
            data.name,
            data.date || new Date().toISOString().split('T')[0],
            data.players_count,
            data.courts_count,
            data.match_duration,
            roundsMin,
            roundsMax,
            tournamentRounds
        ];
        
        const result = this.db.execute(query, params);
        const tournamentId = result.insertId;
        
        // Load players from bucket
        await this.loadPlayersFromBucket(tournamentId, data.players_count);
        
        console.log(`✅ Tournament created with ID: ${tournamentId}`);
        return { id: tournamentId, success: true, roundsMin, roundsMax, totalRounds: tournamentRounds };
    }

    async getTournaments() {
        const query = `
            SELECT 
                t.*,
                COUNT(p.id) as players_loaded,
                COUNT(DISTINCT r.id) as rounds_count
            FROM tournaments t
            LEFT JOIN players p ON t.id = p.tournament_id
            LEFT JOIN rounds r ON t.id = r.tournament_id
            GROUP BY t.id
            ORDER BY t.date DESC
        `;
        
        return this.db.all(query);
    }

    // ============================================================================
    // PLAYER MANAGEMENT
    // ============================================================================

    async insertTournamentPlayer(tournamentId, playerData) {
        const query = `
            INSERT INTO players (tournament_id, name, skill_level, emoji, category)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        const params = [
            tournamentId,
            playerData.name,
            playerData.default_score || 5,
            playerData.emoji,
            playerData.category || 'COLORS'
        ];
        
        return this.db.execute(query, params);
    }

    async updatePlayer(playerId, data) {
        const query = `
            UPDATE players 
            SET name = ?, skill_level = ?, emoji = ?
            WHERE id = ?
        `;
        
        const params = [data.name, data.skill_level, data.emoji, playerId];
        return this.db.execute(query, params);
    }

    async getTournamentPlayers(tournamentId) {
        const query = `
            SELECT * FROM players 
            WHERE tournament_id = ? AND is_active = 1
            ORDER BY skill_level DESC, name ASC
        `;
        
        return this.db.all(query, [tournamentId]);
    }

    /**
     * Calculate BEASTS/COLORS division based on scores
     */
    async calculatePlayerCategories(tournamentId) {
        const players = await this.getTournamentPlayers(tournamentId);
        
        // Sort by skill_level (high to low)
        players.sort((a, b) => b.skill_level - a.skill_level);
        
        const halfPoint = Math.floor(players.length / 2);
        
        // Top 50% = BEASTS, Bottom 50% = COLORS
        for (let i = 0; i < players.length; i++) {
            const category = i < halfPoint ? 'BEASTS' : 'COLORS';
            await this.updatePlayerCategory(players[i].id, category);
        }
        
        console.log(`✅ Updated player categories for tournament ${tournamentId}`);
        return { beasts: halfPoint, colors: players.length - halfPoint };
    }

    async updatePlayerCategory(playerId, category) {
        const query = `UPDATE players SET category = ? WHERE id = ?`;
        return this.db.execute(query, [category, playerId]);
    }

    // ============================================================================
    // TEAMS MANAGEMENT
    // ============================================================================

    async createTeamsForRound(tournamentId, roundNumber) {
        const beasts = await this.getPlayersByCategory(tournamentId, 'BEASTS');
        const colors = await this.getPlayersByCategory(tournamentId, 'COLORS');
        
        if (beasts.length !== colors.length) {
            throw new Error('Unequal BEASTS and COLORS count - cannot create balanced teams');
        }

        const teams = [];
        
        for (let i = 0; i < beasts.length; i++) {
            const beast = beasts[i];
            const color = colors[i];
            
            // Check if pairing already exists (anti-repetition)
            const existingPairing = await this.checkExistingPairing(tournamentId, beast.id, color.id);
            if (existingPairing && roundNumber > 1) {
                // Skip this pairing or implement pairing shuffling logic
                console.warn(`⚠️ Pairing ${beast.name} + ${color.name} already exists`);
                continue;
            }
            
            const teamScore = (beast.skill_level + color.skill_level) / 2;
            const teamName = `${color.emoji} ${beast.emoji}`;
            
            const teamResult = await this.insertTeam(
                tournamentId, roundNumber, teamName, color.id, beast.id, teamScore
            );
            
            teams.push({
                id: teamResult.insertId,
                name: teamName,
                beast: beast,
                color: color,
                score: teamScore
            });
        }
        
        // Sort teams by score and assign ranking
        teams.sort((a, b) => b.score - a.score);
        
        for (let i = 0; i < teams.length; i++) {
            await this.updateTeamRanking(teams[i].id, i + 1);
        }
        
        console.log(`✅ Created ${teams.length} teams for round ${roundNumber}`);
        return teams;
    }

    async getPlayersByCategory(tournamentId, category) {
        const query = `
            SELECT * FROM players 
            WHERE tournament_id = ? AND category = ? AND is_active = 1
            ORDER BY skill_level DESC
        `;
        
        return this.db.all(query, [tournamentId, category]);
    }

    async checkExistingPairing(tournamentId, player1Id, player2Id) {
        const query = `
            SELECT * FROM team_pairings_history 
            WHERE tournament_id = ? 
            AND ((player1_id = ? AND player2_id = ?) OR (player1_id = ? AND player2_id = ?))
        `;
        
        const result = this.db.all(query, [tournamentId, player1Id, player2Id, player2Id, player1Id]);
        return result.length > 0;
    }

    async insertTeam(tournamentId, roundNumber, teamName, player1Id, player2Id, teamScore) {
        const teamQuery = `
            INSERT INTO teams (tournament_id, round_number, name, player1_id, player2_id, team_score)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const teamResult = this.db.execute(teamQuery, [
            tournamentId, roundNumber, teamName, player1Id, player2Id, teamScore
        ]);
        
        // Add to pairings history
        const historyQuery = `
            INSERT INTO team_pairings_history (tournament_id, player1_id, player2_id, round_number, team_id)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        this.db.execute(historyQuery, [
            tournamentId, player1Id, player2Id, roundNumber, teamResult.insertId
        ]);
        
        return teamResult;
    }

    async updateTeamRanking(teamId, ranking) {
        const query = `UPDATE teams SET team_ranking = ? WHERE id = ?`;
        return this.db.execute(query, [ranking, teamId]);
    }

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    async calculateRoundsMin(playersCount, courtsCount) {
        return Math.ceil(playersCount / (courtsCount * 2));
    }

    async isValidPlayerCount(count) {
        return [8, 16, 24, 32].includes(count);
    }

    // ============================================================================
    // TESTING HELPERS
    // ============================================================================

    async testBucketSystem() {
        console.log('🧪 Testing Bucket System...');
        
        const testSizes = [8, 16, 24, 32];
        
        for (const size of testSizes) {
            const mockTournamentId = Date.now() + size;
            const players = await this.loadPlayersFromBucket(mockTournamentId, size);
            
            console.log(`✅ ${size} players loaded:`, players.slice(0, 3).map(p => `${p.emoji} ${p.name}`));
        }
    }

    // ============================================================================
    // PLAYERS PERSISTENCE
    // ============================================================================

    /**
     * Save players data to localStorage
     */
    async savePlayers(players) {
        try {
            if (!players || !Array.isArray(players)) {
                throw new Error('Invalid players data provided');
            }

            const tournamentData = {
                players: players,
                timestamp: new Date().toISOString(),
                version: '2.0',
                totalPlayers: players.length,
                beastCount: players.filter(p => p.category === 'BEAST').length,
                colorCount: players.filter(p => p.category === 'COLOR').length
            };

            // Save to localStorage with tournament prefix
            const storageKey = 'formulaPadel_players';
            localStorage.setItem(storageKey, JSON.stringify(tournamentData));

            console.log(`✅ Saved ${players.length} players to localStorage`);
            console.log('Players summary:', {
                total: tournamentData.totalPlayers,
                beasts: tournamentData.beastCount,
                colors: tournamentData.colorCount
            });

            return {
                success: true,
                playersCount: players.length,
                storageKey: storageKey
            };

        } catch (error) {
            console.error('Error saving players:', error);
            throw new Error(`Failed to save players: ${error.message}`);
        }
    }

    /**
     * Load saved players data from localStorage
     */
    async loadSavedPlayers() {
        try {
            const storageKey = 'formulaPadel_players';
            const savedData = localStorage.getItem(storageKey);
            
            if (!savedData) {
                return null;
            }

            const tournamentData = JSON.parse(savedData);
            
            if (!tournamentData.players || !Array.isArray(tournamentData.players)) {
                throw new Error('Invalid saved players data format');
            }

            console.log(`✅ Loaded ${tournamentData.players.length} saved players from localStorage`);
            return {
                players: tournamentData.players,
                metadata: {
                    timestamp: tournamentData.timestamp,
                    version: tournamentData.version,
                    totalPlayers: tournamentData.totalPlayers,
                    beastCount: tournamentData.beastCount,
                    colorCount: tournamentData.colorCount
                }
            };

        } catch (error) {
            console.error('Error loading saved players:', error);
            throw new Error(`Failed to load players: ${error.message}`);
        }
    }

    /**
     * Clear saved players data
     */
    async clearSavedPlayers() {
        try {
            const storageKey = 'formulaPadel_players';
            localStorage.removeItem(storageKey);
            console.log('✅ Cleared saved players data');
            return { success: true };
        } catch (error) {
            console.error('Error clearing saved players:', error);
            throw new Error(`Failed to clear players: ${error.message}`);
        }
    }
}

// Export per uso in moduli
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PadelDatabase;
}

// Istanza globale per uso in HTML
const padelDB = new PadelDatabase();

console.log('✅ PadelDatabase loaded - ready for initialization');