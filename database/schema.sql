-- FORMULA PADEL - DATABASE SCHEMA
-- SQLite Database Structure per gestione tornei padel

-- ============================================================================
-- TABELLA NOMI DEFAULT (per generazione automatica)
-- ============================================================================
CREATE TABLE default_names (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    default_score INTEGER DEFAULT 5 CHECK (default_score >= 1 AND default_score <= 10),
    category TEXT DEFAULT 'COLORS' CHECK (category IN ('BEASTS', 'COLORS')),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inserimento 32 nomi default - TEMPLATE generici per inizializzazione
-- Questi nomi verranno sostituiti con giocatori reali durante la configurazione
INSERT INTO default_names (name, default_score, category) VALUES
-- 32 nomi template con score neutri (score verrà personalizzato per ogni giocatore)
('Player 01', 5, 'COLORS'),
('Player 02', 5, 'COLORS'),
('Player 03', 5, 'COLORS'),
('Player 04', 5, 'COLORS'),
('Player 05', 5, 'COLORS'),
('Player 06', 5, 'COLORS'),
('Player 07', 5, 'COLORS'),
('Player 08', 5, 'COLORS'),
('Player 09', 5, 'COLORS'),
('Player 10', 5, 'COLORS'),
('Player 11', 5, 'COLORS'),
('Player 12', 5, 'COLORS'),
('Player 13', 5, 'COLORS'),
('Player 14', 5, 'COLORS'),
('Player 15', 5, 'COLORS'),
('Player 16', 5, 'COLORS'),
('Player 17', 5, 'COLORS'),
('Player 18', 5, 'COLORS'),
('Player 19', 5, 'COLORS'),
('Player 20', 5, 'COLORS'),
('Player 21', 5, 'COLORS'),
('Player 22', 5, 'COLORS'),
('Player 23', 5, 'COLORS'),
('Player 24', 5, 'COLORS'),
('Player 25', 5, 'COLORS'),
('Player 26', 5, 'COLORS'),
('Player 27', 5, 'COLORS'),
('Player 28', 5, 'COLORS'),
('Player 29', 5, 'COLORS'),
('Player 30', 5, 'COLORS'),
('Player 31', 5, 'COLORS'),
('Player 32', 5, 'COLORS');

-- ============================================================================
-- TABELLA TORNEI
-- ============================================================================
CREATE TABLE tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date DATE NOT NULL,
    location TEXT,
    status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
    players_count INTEGER NOT NULL CHECK (players_count IN (8, 16, 24, 32)),
    courts_count INTEGER DEFAULT 4 CHECK (courts_count >= 1 AND courts_count <= 8),
    match_duration INTEGER DEFAULT 25 CHECK (match_duration IN (10,15,20,25,30,45,60,90)),
    rounds_min INTEGER,  -- Calculated automatically
    rounds_max INTEGER,  -- Calculated automatically  
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABELLA EMOJI BUCKET (per assignment casuale)
-- ============================================================================
CREATE TABLE emoji_bucket (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emoji TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inserimento emoji bucket per random assignment
INSERT INTO emoji_bucket (emoji) VALUES
('🎾'), ('⚡'), ('🔥'), ('🌟'), ('💫'), ('⭐'), ('🏆'), ('🚀'),
('💎'), ('👑'), ('🦅'), ('🐅'), ('🦁'), ('🐺'), ('⚽'), ('🏀'),
('🎯'), ('💪'), ('🔱'), ('⚔️'), ('🛡️'), ('🏹'), ('🎪'), ('🎭'),
('🎨'), ('🎵'), ('🎸'), ('🥁'), ('🎺'), ('🎻'), ('🎤'), ('🎬'),
('🌶️'), ('🍕'), ('🍔'), ('🌮'), ('🍰'), ('🍩'), ('☕'), ('🥤');

-- ============================================================================
-- TABELLA GIOCATORI (per ogni torneo)
-- ============================================================================
CREATE TABLE players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    skill_level INTEGER CHECK (skill_level >= 1 AND skill_level <= 10),
    emoji TEXT,
    category TEXT CHECK (category IN ('BEASTS', 'COLORS')),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABELLA TEAMS (con tracking per univocità)  
-- ============================================================================
CREATE TABLE teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    round_number INTEGER NOT NULL,
    name TEXT NOT NULL,  -- "Emoji1 Emoji2" format
    player1_id INTEGER NOT NULL,  -- COLORS player
    player2_id INTEGER NOT NULL,  -- BEASTS player
    team_score REAL,  -- Average of players scores
    team_ranking INTEGER,  -- Position in round ranking
    emoji TEXT DEFAULT '🎾',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (player1_id) REFERENCES players(id),
    FOREIGN KEY (player2_id) REFERENCES players(id),
    UNIQUE(tournament_id, round_number, player1_id, player2_id)
);

-- ============================================================================
-- TABELLA TEAMS HISTORY (per tracking accoppiamenti univoci)
-- ============================================================================
CREATE TABLE team_pairings_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    player1_id INTEGER NOT NULL,
    player2_id INTEGER NOT NULL,
    round_number INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (player1_id) REFERENCES players(id),
    FOREIGN KEY (player2_id) REFERENCES players(id),
    FOREIGN KEY (team_id) REFERENCES teams(id),
    
    -- Constraint per garantire che lo stesso accoppiamento non si ripeta
    UNIQUE(tournament_id, player1_id, player2_id, round_number)
);

-- ============================================================================
-- TABELLA ROUNDS
-- ============================================================================
CREATE TABLE rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    round_number INTEGER NOT NULL,
    name TEXT,  -- es: "Round 1", "Semifinal", etc
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    UNIQUE(tournament_id, round_number)
);

-- ============================================================================
-- TABELLA MATCHES (IL CUORE DEL SISTEMA)
-- ============================================================================
CREATE TABLE matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    round_id INTEGER NOT NULL,
    court_number INTEGER NOT NULL,
    team1_id INTEGER NOT NULL,
    team2_id INTEGER NOT NULL,
    
    -- SCORES
    score_team1 INTEGER DEFAULT 0,
    score_team2 INTEGER DEFAULT 0,
    
    -- TIMING
    scheduled_time DATETIME,
    start_time DATETIME,
    end_time DATETIME,
    duration_minutes INTEGER,
    
    -- STATUS
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    winner_team_id INTEGER,
    
    -- METADATA
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
    FOREIGN KEY (team1_id) REFERENCES teams(id),
    FOREIGN KEY (team2_id) REFERENCES teams(id),
    FOREIGN KEY (winner_team_id) REFERENCES teams(id)
);

-- ============================================================================
-- ============================================================================
-- TABELLA STATISTICHE GIOCATORI (SISTEMA SCORING DOPPIO)
-- ============================================================================
CREATE TABLE player_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    
    -- DOPPIO SCORING SYSTEM
    games_won INTEGER DEFAULT 0,        -- Game points
    games_lost INTEGER DEFAULT 0,       -- Games persi
    matches_won INTEGER DEFAULT 0,      -- Match bonus
    matches_played INTEGER DEFAULT 0,   -- Totale match giocati
    total_points INTEGER DEFAULT 0,     -- games_won + matches_won
    
    -- CALCULATED FIELDS
    game_difference INTEGER GENERATED ALWAYS AS (games_won - games_lost),
    win_percentage REAL GENERATED ALWAYS AS (
        CASE 
            WHEN matches_played > 0 THEN (matches_won * 100.0 / matches_played)
            ELSE 0 
        END
    ),
    
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE(tournament_id, player_id)
);

-- ============================================================================
-- INDICI PER PERFORMANCE
-- ============================================================================
CREATE INDEX idx_players_tournament ON players(tournament_id);
CREATE INDEX idx_teams_tournament_round ON teams(tournament_id, round_number);
CREATE INDEX idx_rounds_tournament ON rounds(tournament_id);
CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_matches_round ON matches(round_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_player_stats_tournament ON player_stats(tournament_id);
CREATE INDEX idx_team_pairings_tournament ON team_pairings_history(tournament_id);

-- ============================================================================
-- TRIGGER PER AUTO-UPDATE
-- ============================================================================

-- Auto-update timestamp
CREATE TRIGGER update_tournaments_timestamp 
    AFTER UPDATE ON tournaments
BEGIN
    UPDATE tournaments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_matches_timestamp 
    AFTER UPDATE ON matches
BEGIN
    UPDATE matches SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Auto-calcola statistiche quando un match finisce
CREATE TRIGGER update_player_stats_after_match
    AFTER UPDATE OF status, score_team1, score_team2 ON matches
    WHEN NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
    -- Aggiorna stats per tutti i giocatori coinvolti nel match
    -- (Implementeremo questa logica in JavaScript per semplicità)
    UPDATE player_stats 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE tournament_id = NEW.tournament_id;
END;