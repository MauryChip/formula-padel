/**
 * FORMULA PADEL - TOURNAMENT SETTINGS V2.0
 * Gestione configurazione e creazione tornei
 * Allineato con MASTERGUIDE.txt specifications
 */

class TournamentSettings {
    constructor(databaseManager) {
        this.db = databaseManager;
        this.currentTournament = null;
        this.validPlayerCounts = [8, 16, 24, 32];
        this.defaultSettings = {
            name: '',
            date: new Date().toISOString().split('T')[0],
            players_count: 16,
            courts_count: 4,
            match_duration: 25, // Standard 25 minutes (3min still available in dropdown)
            total_rounds: null // Will be calculated or set by user
        };
        this.validMatchDurations = [3, 15, 20, 25, 30, 45, 60, 90]; // 3 min for testing + Fixed options
    }

    // ============================================================================
    // TOURNAMENT CREATION & VALIDATION
    // ============================================================================

    /**
     * Create new tournament with validation
     */
    async createTournament(settings) {
        try {
            // Validate settings
            const validatedSettings = this.validateTournamentSettings(settings);
            
            console.log('🏆 Creating tournament with settings:', validatedSettings);
            
            // Create tournament in database
            const result = await this.db.createTournament(validatedSettings);
            
            if (result.success) {
                this.currentTournament = {
                    id: result.id,
                    ...validatedSettings,
                    roundsMin: result.roundsMin,
                    roundsMax: result.roundsMax,
                    totalRounds: result.totalRounds,
                    status: 'CREATED',
                    currentRound: 0
                };
                
                console.log(`✅ Tournament created successfully! ID: ${result.id}`);
                console.log(`📊 Rounds calculation: Min=${result.roundsMin}, Max=${result.roundsMax}, Tournament=${result.totalRounds}`);
                
                // Load players from bucket
                await this.loadPlayersFromBucket();
                
                return {
                    success: true,
                    tournament: this.currentTournament,
                    message: 'Tournament created and players loaded successfully!'
                };
            }
            
            throw new Error('Failed to create tournament in database');
            
        } catch (error) {
            console.error('❌ Tournament creation failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate tournament settings according to MASTERGUIDE specs
     */
    validateTournamentSettings(settings) {
        const validated = { ...this.defaultSettings, ...settings };
        
        // Validate tournament name
        if (!validated.name || validated.name.trim().length < 3) {
            throw new Error('Tournament name must be at least 3 characters long');
        }
        validated.name = validated.name.trim();
        
        // Validate players count (must be 8, 16, 24, or 32)
        if (!this.validPlayerCounts.includes(validated.players_count)) {
            throw new Error(`Invalid players count. Must be one of: ${this.validPlayerCounts.join(', ')}`);
        }
        
        // Validate courts count
        if (validated.courts_count < 1 || validated.courts_count > 10) {
            throw new Error('Courts count must be between 1 and 10');
        }
        
        // Validate match duration (must be from fixed list)
        if (!this.validMatchDurations.includes(validated.match_duration)) {
            throw new Error(`Invalid match duration. Must be one of: ${this.validMatchDurations.join(', ')} minutes`);
        }
        
        // Calculate rounds constraints for validation using corrected logic
        const constraints = this.calculateRecommendedRounds(validated.players_count, validated.courts_count);
        const roundsMin = constraints.min;
        const roundsMax = constraints.max;
        
        // Validate total_rounds if specified
        if (validated.total_rounds !== null && validated.total_rounds !== undefined) {
            if (validated.total_rounds < roundsMin) {
                throw new Error(`Tournament rounds (${validated.total_rounds}) cannot be less than minimum required (${roundsMin})`);
            }
            if (validated.total_rounds > roundsMax) {
                throw new Error(`Tournament rounds (${validated.total_rounds}) cannot exceed maximum possible (${roundsMax})`);
            }
        }
        
        // Validate date
        const tournamentDate = new Date(validated.date);
        if (isNaN(tournamentDate.getTime())) {
            throw new Error('Invalid tournament date');
        }
        
        // Calculate if courts are sufficient for simultaneous games
        const maxSimultaneousMatches = Math.floor(validated.players_count / 4);
        if (validated.courts_count > maxSimultaneousMatches) {
            console.warn(`⚠️ Warning: ${validated.courts_count} courts specified, but only ${maxSimultaneousMatches} matches can be played simultaneously with ${validated.players_count} players`);
        }
        
        return validated;
    }

    // ============================================================================
    // PLAYER MANAGEMENT FROM BUCKET SYSTEM
    // ============================================================================

    /**
     * Load players from bucket based on tournament size
     */
    async loadPlayersFromBucket() {
        if (!this.currentTournament) {
            throw new Error('No active tournament to load players into');
        }
        
        try {
            console.log(`🎯 Loading ${this.currentTournament.players_count} players from bucket...`);
            
            const players = await this.db.loadPlayersFromBucket(
                this.currentTournament.id, 
                this.currentTournament.players_count
            );
            
            // Calculate BEASTS/COLORS categories
            const categories = await this.db.calculatePlayerCategories(this.currentTournament.id);
            
            this.currentTournament.players = players;
            this.currentTournament.categories = categories;
            
            console.log(`✅ Players loaded: ${players.length} total`);
            console.log(`📊 Categories: ${categories.beasts} BEASTS, ${categories.colors} COLORS`);
            
            return {
                success: true,
                players: players,
                categories: categories
            };
            
        } catch (error) {
            console.error('❌ Failed to load players from bucket:', error.message);
            throw error;
        }
    }

    /**
     * Get current tournament players with categories
     */
    async getTournamentPlayers() {
        if (!this.currentTournament) {
            throw new Error('No active tournament');
        }
        
        return await this.db.getTournamentPlayers(this.currentTournament.id);
    }

    /**
     * Update player in current tournament
     */
    async updatePlayer(playerId, playerData) {
        if (!this.currentTournament) {
            throw new Error('No active tournament');
        }
        
        try {
            await this.db.updatePlayer(playerId, playerData);
            
            // Recalculate categories if skill_level changed
            if (playerData.skill_level !== undefined) {
                await this.db.calculatePlayerCategories(this.currentTournament.id);
            }
            
            console.log(`✅ Player ${playerId} updated successfully`);
            return { success: true };
            
        } catch (error) {
            console.error('❌ Failed to update player:', error.message);
            throw error;
        }
    }

    // ============================================================================
    // TOURNAMENT STATUS & CALCULATIONS
    // ============================================================================

    /**
     * Get tournament statistics and status
     */
    getTournamentStats() {
        if (!this.currentTournament) {
            return null;
        }
        
        const stats = {
            id: this.currentTournament.id,
            name: this.currentTournament.name,
            playersCount: this.currentTournament.players_count,
            courtsCount: this.currentTournament.courts_count,
            matchDuration: this.currentTournament.match_duration,
            roundsMin: this.currentTournament.roundsMin,
            roundsMax: this.currentTournament.roundsMax,
            totalRounds: this.currentTournament.totalRounds,
            status: this.currentTournament.status,
            
            // Calculated statistics
            maxSimultaneousMatches: Math.floor(this.currentTournament.players_count / 4),
            estimatedTotalTime: this.calculateEstimatedTime(),
            teamsPerRound: this.currentTournament.players_count / 2,
            
            // Categories info
            categories: this.currentTournament.categories
        };
        
        return stats;
    }

    /**
     * Calculate estimated tournament time
     */
    calculateEstimatedTime() {
        if (!this.currentTournament) return 0;
        
        const { totalRounds, courts_count, match_duration } = this.currentTournament;
        const matchesPerRound = this.currentTournament.players_count / 4;
        const roundsNeeded = Math.ceil(matchesPerRound / courts_count);
        
        return totalRounds * roundsNeeded * match_duration;
    }

    /**
     * Check if tournament is ready to start
     */
    isReadyToStart() {
        if (!this.currentTournament) return false;
        
        return (
            this.currentTournament.status === 'CREATED' &&
            this.currentTournament.players &&
            this.currentTournament.players.length === this.currentTournament.players_count &&
            this.currentTournament.categories
        );
    }

    // ============================================================================
    // TOURNAMENT SETTINGS PRESETS
    // ============================================================================

    /**
     * Get predefined tournament templates
     */
    getTournamentPresets() {
        return {
            'quick_8': {
                name: 'Quick Tournament (8 Players)',
                players_count: 8,
                courts_count: 2,
                match_duration: 15,
                description: 'Fast tournament for small groups'
            },
            'standard_16': {
                name: 'Standard Tournament (16 Players)',
                players_count: 16,
                courts_count: 4,
                match_duration: 25,
                description: 'Most common tournament size'
            },
            'large_24': {
                name: 'Large Tournament (24 Players)',
                players_count: 24,
                courts_count: 6,
                match_duration: 45,
                description: 'Extended tournament for bigger groups'
            },
            'championship_32': {
                name: 'Championship (32 Players)',
                players_count: 32,
                courts_count: 8,
                match_duration: 60,
                description: 'Full championship tournament'
            }
        };
    }

    /**
     * Apply preset settings to current configuration
     */
    applyPreset(presetKey, customName = null, customDate = null) {
        const presets = this.getTournamentPresets();
        const preset = presets[presetKey];
        
        if (!preset) {
            throw new Error(`Unknown preset: ${presetKey}`);
        }
        
        // Auto-calculate bucket based on player count (as per MASTERGUIDE)
        const bucketNumber = Math.ceil(preset.players_count / 8);
        
        return {
            name: customName || preset.name,
            date: customDate || this.defaultSettings.date,
            location: this.defaultSettings.location,
            players_count: preset.players_count,
            courts_count: preset.courts_count,
            match_duration: preset.match_duration,
            bucket_number: bucketNumber // Auto-calculated bucket
        };
    }

    /**
     * Calculate recommended rounds based on tournament size
     */
    calculateRecommendedRounds(playersCount, courtsCount) {
        // FORMULA PADEL LOGIC:
        // - Each team = 2 players (1 Beast + 1 Color)
        // - Each match = 2 teams = 4 players
        // - Each court hosts 1 match
        
        const teamsTotal = playersCount / 2;
        const teamsPlayingPerRound = courtsCount * 2;
        
        // MINIMUM ROUNDS: At least 1 round always possible
        // If courts < teams, need multiple rounds for everyone to play
        const roundsMin = 1; // Fixed minimum - at least 1 round must be possible
        
        // MAXIMUM ROUNDS: Each player can face different opponents
        // In Beast vs Color system, max is (playersCount/2) - 1 opponents
        const roundsMax = (playersCount / 2) - 1;
        
        // RECOMMENDED: Based on tournament size and court availability
        // For small tournaments: 2-3 rounds
        // For larger tournaments: scale with player count
        let recommended;
        if (playersCount <= 8) {
            recommended = Math.min(2, roundsMax);
        } else if (playersCount <= 16) {
            recommended = Math.min(3, roundsMax);
        } else {
            recommended = Math.min(Math.floor(playersCount / 6), roundsMax);
        }
        
        return {
            min: roundsMin,
            max: roundsMax,
            recommended: recommended,
            optimal: Math.min(recommended + 1, Math.floor(roundsMax * 0.6))
        };
    }

    /**
     * Get rounds constraints for current settings
     */
    getRoundsConstraints(playersCount = null, courtsCount = null) {
        const players = playersCount || this.defaultSettings.players_count;
        const courts = courtsCount || this.defaultSettings.courts_count;
        
        return this.calculateRecommendedRounds(players, courts);
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    /**
     * Reset current tournament
     */
    resetTournament() {
        this.currentTournament = null;
        console.log('🔄 Tournament reset');
    }

    /**
     * Get current tournament info
     */
    getCurrentTournament() {
        return this.currentTournament;
    }

    /**
     * Get valid match durations
     */
    getValidMatchDurations() {
        return this.validMatchDurations;
    }

    /**
     * Validate players count options
     */
    getValidPlayerCounts() {
        return this.validPlayerCounts;
    }

    /**
     * Export tournament configuration for backup/restore
     */
    exportTournamentConfig() {
        if (!this.currentTournament) {
            return null;
        }
        
        return {
            settings: {
                name: this.currentTournament.name,
                date: this.currentTournament.date,
                location: this.currentTournament.location,
                players_count: this.currentTournament.players_count,
                courts_count: this.currentTournament.courts_count,
                match_duration: this.currentTournament.match_duration
            },
            stats: this.getTournamentStats(),
            timestamp: new Date().toISOString()
        };
    }
}

// Export per browser
window.TournamentSettings = TournamentSettings;

// Export per uso in moduli Node.js (se necessario)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TournamentSettings;
}

console.log('✅ TournamentSettings loaded - ready for initialization');