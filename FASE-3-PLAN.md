# FASE 3 - ROUNDS & MATCHES MANAGEMENT
*Piano di sviluppo basato su MASTERGUIDE.txt*

## 🎯 **OBIETTIVO FASE 3**
Implementare il sistema completo di gestione rounds e matches seguendo le specifiche del MASTERGUIDE.

### **📋 SPECIFICHE MASTERGUIDE CHIAVE:**
- **Rounds collassabili**: Frame "ROUND 1", "ROUND 2", etc.
- **Match Cards individuali**: Team A vs Team B con tutti i controlli
- **Timer countdown**: Da MATCH_Duration con alert visivi
- **Score boxes**: Input numerici per risultati
- **Save Results**: Persistenza e progression al round successivo
- **Rest Algorithm**: Gestione teams che riposano se Nc < Nt/2
- **Priorità**: FUNZIONALITÀ BASE > PERFEZIONE algoritmo

---

## 🚀 **PIANO DI SVILUPPO STEP-BY-STEP**

### **STEP 3.1 - ROUNDS MANAGER MODULE** ⚡
**Obiettivo**: Creare il modulo base rounds-manager.js
**File**: `/rounds-manager.js`

#### **Implementazione:**
1. **Modulo ES6+** seguendo pattern esistente (players-manager.js, teams-manager.js)
2. **Constructor** con riferimento app e inizializzazione dati
3. **UI Structure** per tab ROUNDS in index.html
4. **Frame collassabili** per ogni round (ROUND 1, ROUND 2, etc.)
5. **Integration** con teams-manager per prendere dati teams salvati

#### **Struttura base rounds-manager.js:**
```javascript
class RoundsManager {
    constructor(app) {
        this.app = app;
        this.rounds = [];
        this.currentRound = 1;
        this.activeMatches = new Map(); // Track active timers
        this.matchResults = []; // Store all match results
        
        this.setupEventListeners();
        this.checkTeamsStatus(); // Verify teams are saved
    }
}
```

#### **UI Requirements:**
- Tab ROUNDS abilitato solo dopo teams saved
- Frame collassabili per ogni round
- Integrazione con sistema di notifiche esistente

---

### **STEP 3.2 - MATCH CARDS SYSTEM** 🎮
**Obiettivo**: Creare match cards individuali secondo specifiche MASTERGUIDE
**Focus**: Team A vs Team B con controlli completi

#### **Match Card Components:**
```html
<div class="match-card">
    <div class="match-header">
        <span class="match-number">#1</span>
        <span class="court-assignment">Court 1</span>
    </div>
    
    <div class="teams-matchup">
        <div class="team-side team-a">
            <div class="team-emoji">🔥⚡</div>
            <div class="team-name">Marco Vale</div>
            <div class="players-list">
                <span>🔥 Marco Rossi</span>
                <span>⚡ Luca Bianchi</span>
            </div>
        </div>
        
        <div class="vs-separator">VS</div>
        
        <div class="team-side team-b">
            <!-- Same structure for Team B -->
        </div>
    </div>
    
    <div class="score-section">
        <input type="number" class="score-input" placeholder="Team A Score">
        <span class="score-separator">-</span>
        <input type="number" class="score-input" placeholder="Team B Score">
    </div>
    
    <div class="timer-section">
        <div class="timer-display">15:00</div>
        <div class="timer-controls">
            <button class="timer-btn start">START</button>
            <button class="timer-btn stop">STOP</button>
            <button class="timer-btn reset">RESET</button>
        </div>
    </div>
    
    <div class="match-actions">
        <button class="save-match-btn">SAVE MATCH</button>
    </div>
</div>
```

#### **Algoritmo Pairing:**
- **Ranking-based**: Team(N) vs Team(N+1) per score delta minimo
- **Duplicate Check**: Evitare players che si sono già affrontati (NICE TO HAVE)
- **Fallback Simple**: Team(N) vs Team(N+2) se duplicati rilevati

---

### **STEP 3.3 - TIMER SYSTEM** ⏱️
**Obiettivo**: Timer countdown funzionante con alert visivi secondo MASTERGUIDE

#### **Timer Specifications da MASTERGUIDE:**
- **Start**: MATCH_Duration (da tournament settings)
- **Normal State**: Colore verde/bianco
- **Warning State**: Ultimi 2 minuti → Colore giallo
- **Finished State**: Timer a zero → Colore rosso
- **Visual Alert**: Cambio colore graduale

#### **Timer Implementation:**
```javascript
class MatchTimer {
    constructor(matchId, duration) {
        this.matchId = matchId;
        this.duration = duration * 60; // Convert to seconds
        this.remainingTime = this.duration;
        this.intervalId = null;
        this.isRunning = false;
    }
    
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.intervalId = setInterval(() => {
            this.tick();
        }, 1000);
    }
    
    tick() {
        this.remainingTime--;
        this.updateDisplay();
        this.updateVisualState();
        
        if (this.remainingTime <= 0) {
            this.finish();
        }
    }
    
    updateVisualState() {
        const minutes = Math.floor(this.remainingTime / 60);
        const element = document.getElementById(`timer-${this.matchId}`);
        
        if (this.remainingTime <= 0) {
            element.classList.add('timer-finished');
        } else if (minutes < 2) {
            element.classList.add('timer-warning');
        }
    }
}
```

#### **CSS Timer States:**
```css
.timer-display {
    font-size: 24px;
    font-weight: bold;
    transition: all 0.3s ease;
}

.timer-warning {
    background-color: #f39c12;
    color: white;
}

.timer-finished {
    background-color: #e74c3c;
    color: white;
    animation: pulse 1s infinite;
}
```

---

### **STEP 3.4 - REST ALGORITHM** 🔄
**Obiettivo**: Gestire teams che riposano quando Nc < Nt/2

#### **Algoritmo da MASTERGUIDE:**
- **Round 1**: Sorteggio casuale chi gioca/riposa
- **Round 2+**: Priorità gioco per chi ha riposato
- **Vincolo**: Nessun player riposa 2 round consecutivi
- **Rotazione**: Equilibrio match per tutti

#### **Rest Management:**
```javascript
calculatePlayingTeams(teams, availableCourts) {
    const maxPlayingTeams = availableCourts * 2; // 2 teams per court
    
    if (teams.length <= maxPlayingTeams) {
        // All teams play
        return { playing: teams, resting: [] };
    }
    
    // Some teams must rest
    const restCount = teams.length - maxPlayingTeams;
    const resting = this.selectRestingTeams(teams, restCount);
    const playing = teams.filter(team => !resting.includes(team));
    
    return { playing, resting };
}

selectRestingTeams(teams, restCount) {
    // Priority system: who rested last has lower priority to rest again
    const teamsWithRestHistory = teams.map(team => ({
        team,
        lastRestRound: this.getLastRestRound(team),
        consecutiveRests: this.getConsecutiveRests(team)
    }));
    
    // Sort by rest priority (who should rest)
    teamsWithRestHistory.sort((a, b) => {
        // Never rest 2 rounds in a row
        if (a.consecutiveRests > 0 && b.consecutiveRests === 0) return 1;
        if (b.consecutiveRests > 0 && a.consecutiveRests === 0) return -1;
        
        // Prioritize teams that rested longer ago
        return (b.lastRestRound || 0) - (a.lastRestRound || 0);
    });
    
    return teamsWithRestHistory.slice(-restCount).map(item => item.team);
}
```

---

### **STEP 3.5 - RESULTS & PROGRESSION** 💾
**Obiettivo**: Save results e progression automatico al round successivo

#### **Results Management:**
- **Match Results**: Save score, vincitore, timestamp
- **Round Completion**: Check tutti match completati
- **Progression**: Abilitare round successivo
- **Persistenza**: localStorage per resume torneo

#### **Save System:**
```javascript
saveMatchResult(matchId, teamAScore, teamBScore) {
    const match = this.findMatch(matchId);
    const result = {
        matchId,
        roundNumber: this.currentRound,
        teamA: match.teamA,
        teamB: match.teamB,
        scoreA: parseInt(teamAScore),
        scoreB: parseInt(teamBScore),
        winner: teamAScore > teamBScore ? match.teamA : match.teamB,
        timestamp: new Date().toISOString()
    };
    
    this.matchResults.push(result);
    this.saveToStorage();
    
    // Check if round is complete
    if (this.isRoundComplete()) {
        this.enableNextRound();
    }
}

isRoundComplete() {
    const currentRoundMatches = this.rounds[this.currentRound - 1]?.matches || [];
    const completedMatches = this.matchResults.filter(
        result => result.roundNumber === this.currentRound
    );
    
    return currentRoundMatches.length === completedMatches.length;
}
```

---

## 🎨 **CSS STYLING STRATEGY**

### **Match Cards Layout:**
```css
.rounds-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.round-frame {
    border: 2px solid var(--ochre-light);
    border-radius: 12px;
    overflow: hidden;
}

.matches-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 20px;
    padding: 20px;
}

.match-card {
    background: linear-gradient(135deg, var(--beige), var(--ochre-light));
    border-radius: 12px;
    padding: 20px;
    box-shadow: var(--card-shadow);
}
```

---

## 📊 **INTEGRATION POINTS**

### **Con Teams Manager:**
```javascript
// rounds-manager.js
initializeFromTeams() {
    const teamsData = this.app.getTeamsManager().getTeamHistory();
    if (!teamsData || teamsData.length === 0) {
        this.showError('No teams found. Please generate teams first.');
        return false;
    }
    
    this.generateRoundsFromTeams(teamsData);
    return true;
}
```

### **Con Tournament Settings:**
```javascript
getTournamentConfig() {
    const config = this.app.getTournamentFormData();
    return {
        matchDuration: config.match_duration,
        courtsCount: config.courts_count,
        totalRounds: config.total_rounds
    };
}
```

---

## ✅ **MILESTONE TESTING**

### **Per ogni Step:**
1. **Step 3.1**: ✅ UI rounds carica, frame collassabili funzionanti
2. **Step 3.2**: ✅ Match cards renderizzate correttamente
3. **Step 3.3**: ✅ Timer funzionante con alert visivi
4. **Step 3.4**: ✅ Algoritmo riposi calcola correttamente
5. **Step 3.5**: ✅ Save results e progression automatico

### **Testing Completo Fase 3:**
- [ ] Generare round da teams salvati
- [ ] Match cards con tutti i controlli
- [ ] Timer countdown con alert
- [ ] Salvare risultati match
- [ ] Progression automatico round successivo
- [ ] Persistenza dati tra sessioni

---

## 🚀 **READY TO START**
**Prossimo comando**: Iniziare Step 3.1 - Creazione rounds-manager.js module