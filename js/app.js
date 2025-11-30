/**
 * 草野球大会 スコア管理システム
 * メインアプリケーション（複数大会対応版）
 */

// ===================================
// データ管理
// ===================================
class TournamentManager {
    constructor() {
        this.tournaments = [];      // 全大会のリスト
        this.currentTournamentId = null;  // 現在選択中の大会ID
        this.currentMatchIndex = -1;
        this.loadData();
    }

    // LocalStorageからデータを読み込み
    loadData() {
        const savedData = localStorage.getItem('baseballTournaments');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.tournaments = data.tournaments || [];
            this.currentTournamentId = data.currentTournamentId || null;
        }
        
        // 旧データ形式からの移行
        const oldData = localStorage.getItem('baseballTournament');
        if (oldData && this.tournaments.length === 0) {
            const old = JSON.parse(oldData);
            if (old.teams && old.teams.length > 0) {
                const migrated = {
                    id: Date.now(),
                    name: old.tournamentName || '移行された大会',
                    date: old.tournamentDate || '',
                    teams: old.teams || [],
                    matches: old.matches || [],
                    createdAt: new Date().toISOString()
                };
                this.tournaments.push(migrated);
                this.currentTournamentId = migrated.id;
                this.saveData();
                localStorage.removeItem('baseballTournament');
            }
        }
    }

    // LocalStorageにデータを保存
    saveData() {
        const data = {
            tournaments: this.tournaments,
            currentTournamentId: this.currentTournamentId
        };
        localStorage.setItem('baseballTournaments', JSON.stringify(data));
    }

    // 現在の大会を取得
    getCurrentTournament() {
        if (!this.currentTournamentId) return null;
        return this.tournaments.find(t => t.id === this.currentTournamentId);
    }

    // 新規大会を作成
    createTournament(name, date, type = 'normal') {
        if (!name.trim()) {
            alert('大会名を入力してください');
            return false;
        }
        
        const newTournament = {
            id: Date.now(),
            name: name.trim(),
            date: date || '',
            type: type, // 'normal' または 'taiko'
            teams: [],
            matches: [],
            createdAt: new Date().toISOString()
        };
        
        // 対抗戦の場合は追加データ構造
        if (type === 'taiko') {
            newTournament.campA = {
                name: '陣営A',
                teams: [],
                matches: []
            };
            newTournament.campB = {
                name: '陣営B',
                teams: [],
                matches: []
            };
            newTournament.finalMatches = [];
            newTournament.phase = 'setup'; // 'setup', 'preliminary', 'final', 'completed'
        }
        
        this.tournaments.push(newTournament);
        this.currentTournamentId = newTournament.id;
        this.saveData();
        return true;
    }

    // 大会を削除
    deleteTournament(id) {
        const index = this.tournaments.findIndex(t => t.id === id);
        if (index !== -1) {
            this.tournaments.splice(index, 1);
            if (this.currentTournamentId === id) {
                this.currentTournamentId = this.tournaments.length > 0 ? this.tournaments[0].id : null;
            }
            this.saveData();
            return true;
        }
        return false;
    }

    // 大会を切り替え
    switchTournament(id) {
        const tournament = this.tournaments.find(t => t.id === id);
        if (tournament) {
            this.currentTournamentId = id;
            this.saveData();
            return true;
        }
        return false;
    }

    // 大会情報を更新
    updateTournamentInfo(name, date) {
        const tournament = this.getCurrentTournament();
        if (tournament) {
            tournament.name = name;
            tournament.date = date;
            this.saveData();
        }
    }

    // チームを追加
    addTeam(name) {
        const tournament = this.getCurrentTournament();
        if (!tournament) {
            alert('先に大会を選択してください');
            return false;
        }
        
        if (!name.trim()) {
            alert('チーム名を入力してください');
            return false;
        }
        if (tournament.teams.find(t => t.name === name.trim())) {
            alert('このチーム名は既に登録されています');
            return false;
        }
        tournament.teams.push({
            id: Date.now(),
            name: name.trim()
        });
        this.saveData();
        return true;
    }

    // チームを削除
    removeTeam(id) {
        const tournament = this.getCurrentTournament();
        if (!tournament) return;
        
        const index = tournament.teams.findIndex(t => t.id === id);
        if (index !== -1) {
            tournament.teams.splice(index, 1);
            // 関連する試合も削除
            tournament.matches = tournament.matches.filter(m => 
                m.homeTeamId !== id && m.awayTeamId !== id
            );
            this.saveData();
        }
    }

    // 総当たり戦スケジュールを生成
    generateRoundRobinSchedule() {
        const tournament = this.getCurrentTournament();
        if (!tournament) {
            alert('先に大会を選択してください');
            return false;
        }
        
        if (tournament.teams.length < 2) {
            alert('スケジュールを生成するには、最低2チーム必要です');
            return false;
        }

        tournament.matches = [];
        let matchNumber = 1;

        // 総当たり戦: 全チームと全チームが対戦
        for (let i = 0; i < tournament.teams.length; i++) {
            for (let j = i + 1; j < tournament.teams.length; j++) {
                tournament.matches.push({
                    id: Date.now() + matchNumber,
                    matchNumber: matchNumber,
                    homeTeamId: tournament.teams[i].id,
                    awayTeamId: tournament.teams[j].id,
                    homeScore: null,
                    awayScore: null,
                    completed: false
                });
                matchNumber++;
            }
        }

        this.saveData();
        return true;
    }

    // スコアを保存
    saveMatchScore(matchIndex, homeScore, awayScore) {
        const tournament = this.getCurrentTournament();
        if (!tournament) return;
        
        if (matchIndex >= 0 && matchIndex < tournament.matches.length) {
            tournament.matches[matchIndex].homeScore = parseInt(homeScore);
            tournament.matches[matchIndex].awayScore = parseInt(awayScore);
            tournament.matches[matchIndex].completed = true;
            this.saveData();
        }
    }

    // チームの成績を計算
    getTeamStats() {
        const tournament = this.getCurrentTournament();
        if (!tournament) return [];
        
        const stats = {};
        
        // 全チームの初期化
        tournament.teams.forEach(team => {
            stats[team.id] = {
                id: team.id,
                name: team.name,
                played: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                points: 0,  // 勝ち点
                runsFor: 0,
                runsAgainst: 0,
                winRate: 0
            };
        });

        // 完了した試合から成績を計算
        tournament.matches.filter(m => m.completed).forEach(match => {
            const home = stats[match.homeTeamId];
            const away = stats[match.awayTeamId];

            if (home && away) {
                home.played++;
                away.played++;
                home.runsFor += match.homeScore;
                home.runsAgainst += match.awayScore;
                away.runsFor += match.awayScore;
                away.runsAgainst += match.homeScore;

                if (match.homeScore > match.awayScore) {
                    home.wins++;
                    home.points += 3;  // 勝利: 3点
                    away.losses++;
                    // 敗北: 0点
                } else if (match.homeScore < match.awayScore) {
                    home.losses++;
                    // 敗北: 0点
                    away.wins++;
                    away.points += 3;  // 勝利: 3点
                } else {
                    home.draws++;
                    home.points += 1;  // 引分: 1点
                    away.draws++;
                    away.points += 1;  // 引分: 1点
                }
            }
        });

        // 勝ち点でソート（同点なら得失点差、さらに同点なら得点）
        return Object.values(stats)
            .map(s => {
                const totalGames = s.wins + s.losses;
                s.winRate = totalGames > 0 ? (s.wins / totalGames) : 0;
                s.runDiff = s.runsFor - s.runsAgainst;
                return s;
            })
            .sort((a, b) => {
                // 勝ち点でソート
                if (b.points !== a.points) return b.points - a.points;
                // 同点なら得失点差でソート
                if (b.runDiff !== a.runDiff) return b.runDiff - a.runDiff;
                // さらに同点なら得点でソート
                return b.runsFor - a.runsFor;
            });
    }

    // 対戦結果を取得
    getMatchResult(team1Id, team2Id) {
        const tournament = this.getCurrentTournament();
        if (!tournament) return { result: '-', score: '-' };
        
        const match = tournament.matches.find(m => 
            (m.homeTeamId === team1Id && m.awayTeamId === team2Id) ||
            (m.homeTeamId === team2Id && m.awayTeamId === team1Id)
        );

        if (!match || !match.completed) {
            return { result: '-', score: '-' };
        }

        const isHome = match.homeTeamId === team1Id;
        const myScore = isHome ? match.homeScore : match.awayScore;
        const oppScore = isHome ? match.awayScore : match.homeScore;

        let result;
        if (myScore > oppScore) {
            result = 'win';
        } else if (myScore < oppScore) {
            result = 'lose';
        } else {
            result = 'draw';
        }

        return {
            result: result,
            score: `${myScore}-${oppScore}`
        };
    }

    // チーム名をIDから取得
    getTeamName(id) {
        const tournament = this.getCurrentTournament();
        if (!tournament) return '不明';
        
        // 通常モード
        let team = tournament.teams.find(t => t.id === id);
        if (team) return team.name;
        
        // 対抗戦モード
        if (tournament.type === 'taiko') {
            team = tournament.campA.teams.find(t => t.id === id);
            if (team) return team.name;
            team = tournament.campB.teams.find(t => t.id === id);
            if (team) return team.name;
        }
        
        return '不明';
    }

    // 現在の大会のチーム一覧を取得
    getTeams() {
        const tournament = this.getCurrentTournament();
        return tournament ? tournament.teams : [];
    }

    // 現在の大会の試合一覧を取得
    getMatches() {
        const tournament = this.getCurrentTournament();
        return tournament ? tournament.matches : [];
    }

    // ===================================
    // 対抗戦用メソッド
    // ===================================
    
    // 陣営にチームを追加
    addTeamToCamp(camp, name) {
        const tournament = this.getCurrentTournament();
        if (!tournament || tournament.type !== 'taiko') return false;
        
        if (!name.trim()) {
            alert('チーム名を入力してください');
            return false;
        }
        
        const campData = camp === 'A' ? tournament.campA : tournament.campB;
        const otherCamp = camp === 'A' ? tournament.campB : tournament.campA;
        
        // 両陣営で重複チェック
        if (campData.teams.find(t => t.name === name.trim()) || 
            otherCamp.teams.find(t => t.name === name.trim())) {
            alert('このチーム名は既に登録されています');
            return false;
        }
        
        campData.teams.push({
            id: Date.now(),
            name: name.trim(),
            role: null // 役職（大将、副将、次鋒、先鋒）
        });
        
        this.saveData();
        return true;
    }

    // 陣営からチームを削除
    removeTeamFromCamp(camp, id) {
        const tournament = this.getCurrentTournament();
        if (!tournament || tournament.type !== 'taiko') return;
        
        const campData = camp === 'A' ? tournament.campA : tournament.campB;
        const index = campData.teams.findIndex(t => t.id === id);
        if (index !== -1) {
            campData.teams.splice(index, 1);
            this.saveData();
        }
    }

    // 陣営名を更新
    updateCampName(camp, name) {
        const tournament = this.getCurrentTournament();
        if (!tournament || tournament.type !== 'taiko') return;
        
        if (camp === 'A') {
            tournament.campA.name = name || '陣営A';
        } else {
            tournament.campB.name = name || '陣営B';
        }
        this.saveData();
    }

    // 予選（陣営内総当たり）を生成
    generatePreliminarySchedule() {
        const tournament = this.getCurrentTournament();
        if (!tournament || tournament.type !== 'taiko') return false;
        
        if (tournament.campA.teams.length < 2 || tournament.campB.teams.length < 2) {
            alert('各陣営に最低2チーム必要です');
            return false;
        }
        
        // 陣営Aの総当たり
        tournament.campA.matches = this.generateRoundRobinForCamp(tournament.campA.teams);
        
        // 陣営Bの総当たり
        tournament.campB.matches = this.generateRoundRobinForCamp(tournament.campB.teams);
        
        tournament.phase = 'preliminary';
        this.saveData();
        return true;
    }

    // 陣営内総当たりを生成
    generateRoundRobinForCamp(teams) {
        const matches = [];
        let matchNumber = 1;
        
        for (let i = 0; i < teams.length; i++) {
            for (let j = i + 1; j < teams.length; j++) {
                matches.push({
                    id: Date.now() + matchNumber,
                    matchNumber: matchNumber,
                    homeTeamId: teams[i].id,
                    awayTeamId: teams[j].id,
                    homeScore: null,
                    awayScore: null,
                    completed: false
                });
                matchNumber++;
            }
        }
        
        return matches;
    }

    // 陣営の試合スコアを保存
    saveCampMatchScore(camp, matchIndex, homeScore, awayScore) {
        const tournament = this.getCurrentTournament();
        if (!tournament || tournament.type !== 'taiko') return;
        
        const campData = camp === 'A' ? tournament.campA : tournament.campB;
        
        if (matchIndex >= 0 && matchIndex < campData.matches.length) {
            campData.matches[matchIndex].homeScore = parseInt(homeScore);
            campData.matches[matchIndex].awayScore = parseInt(awayScore);
            campData.matches[matchIndex].completed = true;
            this.saveData();
        }
    }

    // 陣営のチーム成績を計算
    getCampTeamStats(camp) {
        const tournament = this.getCurrentTournament();
        if (!tournament || tournament.type !== 'taiko') return [];
        
        const campData = camp === 'A' ? tournament.campA : tournament.campB;
        const stats = {};
        
        campData.teams.forEach(team => {
            stats[team.id] = {
                id: team.id,
                name: team.name,
                role: team.role,
                played: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                points: 0,
                runsFor: 0,
                runsAgainst: 0
            };
        });

        campData.matches.filter(m => m.completed).forEach(match => {
            const home = stats[match.homeTeamId];
            const away = stats[match.awayTeamId];

            if (home && away) {
                home.played++;
                away.played++;
                home.runsFor += match.homeScore;
                home.runsAgainst += match.awayScore;
                away.runsFor += match.awayScore;
                away.runsAgainst += match.homeScore;

                if (match.homeScore > match.awayScore) {
                    home.wins++;
                    home.points += 3;
                    away.losses++;
                } else if (match.homeScore < match.awayScore) {
                    home.losses++;
                    away.wins++;
                    away.points += 3;
                } else {
                    home.draws++;
                    home.points += 1;
                    away.draws++;
                    away.points += 1;
                }
            }
        });

        return Object.values(stats)
            .map(s => {
                s.runDiff = s.runsFor - s.runsAgainst;
                s.winRate = s.played > 0 ? (s.wins / s.played) : 0;
                return s;
            })
            .sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.runDiff !== a.runDiff) return b.runDiff - a.runDiff;
                return b.runsFor - a.runsFor;
            });
    }

    // 予選終了 - 役職を確定
    finalizePreliminary() {
        const tournament = this.getCurrentTournament();
        if (!tournament || tournament.type !== 'taiko') return false;
        
        // 全試合完了チェック
        const allACompleted = tournament.campA.matches.every(m => m.completed);
        const allBCompleted = tournament.campB.matches.every(m => m.completed);
        
        if (!allACompleted || !allBCompleted) {
            alert('全ての予選試合を完了してください');
            return false;
        }
        
        const roles = ['大将', '副将', '次鋒', '先鋒'];
        
        // 陣営Aの役職を決定
        const statsA = this.getCampTeamStats('A');
        statsA.forEach((team, index) => {
            const campTeam = tournament.campA.teams.find(t => t.id === team.id);
            if (campTeam && index < roles.length) {
                campTeam.role = roles[index];
            }
        });
        
        // 陣営Bの役職を決定
        const statsB = this.getCampTeamStats('B');
        statsB.forEach((team, index) => {
            const campTeam = tournament.campB.teams.find(t => t.id === team.id);
            if (campTeam && index < roles.length) {
                campTeam.role = roles[index];
            }
        });
        
        // 本戦対決を生成
        tournament.finalMatches = [];
        roles.forEach((role, index) => {
            const teamA = tournament.campA.teams.find(t => t.role === role);
            const teamB = tournament.campB.teams.find(t => t.role === role);
            
            if (teamA && teamB) {
                tournament.finalMatches.push({
                    id: Date.now() + index,
                    role: role,
                    teamAId: teamA.id,
                    teamBId: teamB.id,
                    teamAScore: null,
                    teamBScore: null,
                    completed: false
                });
            }
        });
        
        tournament.phase = 'final';
        this.saveData();
        return true;
    }

    // 本戦スコアを保存
    saveFinalMatchScore(matchIndex, teamAScore, teamBScore) {
        const tournament = this.getCurrentTournament();
        if (!tournament || tournament.type !== 'taiko') return;
        
        if (matchIndex >= 0 && matchIndex < tournament.finalMatches.length) {
            tournament.finalMatches[matchIndex].teamAScore = parseInt(teamAScore);
            tournament.finalMatches[matchIndex].teamBScore = parseInt(teamBScore);
            tournament.finalMatches[matchIndex].completed = true;
            this.saveData();
        }
    }

    // 対抗戦の最終結果を計算
    getTaikoResult() {
        const tournament = this.getCurrentTournament();
        if (!tournament || tournament.type !== 'taiko') return null;
        
        let campAPoints = 0;
        let campBPoints = 0;
        let allCompleted = true;
        
        tournament.finalMatches.forEach(match => {
            if (!match.completed) {
                allCompleted = false;
                return;
            }
            
            if (match.teamAScore > match.teamBScore) {
                campAPoints += 3;
            } else if (match.teamAScore < match.teamBScore) {
                campBPoints += 3;
            } else {
                campAPoints += 1;
                campBPoints += 1;
            }
        });
        
        if (!allCompleted) return null;
        
        let winner;
        if (campAPoints > campBPoints) {
            winner = 'A';
        } else if (campBPoints > campAPoints) {
            winner = 'B';
        } else {
            winner = 'draw';
        }
        
        return {
            winner: winner,
            campAPoints: campAPoints,
            campBPoints: campBPoints,
            campAName: tournament.campA.name,
            campBName: tournament.campB.name
        };
    }
}

// ===================================
// UI管理
// ===================================
const tournament = new TournamentManager();

// ページ切り替え
function showPage(pageId) {
    // 全ページを非表示
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // ナビゲーションリンクのアクティブ状態を更新
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === pageId) {
            link.classList.add('active');
        }
    });

    // 選択したページを表示
    document.getElementById(pageId).classList.add('active');

    // ページごとの更新処理
    switch (pageId) {
        case 'home':
            updateHomePage();
            break;
        case 'teams':
            updateTeamList();
            break;
        case 'schedule':
            updateScheduleList();
            break;
        case 'standings':
            updateStandings();
            break;
    }
}

// 大会セレクターを更新
function updateTournamentSelector() {
    const select = document.getElementById('tournamentSelect');
    select.innerHTML = '<option value="">-- 大会を選択 --</option>';
    
    tournament.tournaments.forEach(t => {
        const option = document.createElement('option');
        option.value = t.id;
        option.textContent = t.name + (t.date ? ` (${t.date})` : '');
        if (t.id === tournament.currentTournamentId) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

// 大会を切り替え
function switchTournament() {
    const select = document.getElementById('tournamentSelect');
    const id = parseInt(select.value);
    
    if (id) {
        tournament.switchTournament(id);
    } else {
        tournament.currentTournamentId = null;
        tournament.saveData();
    }
    
    // 現在のページを更新
    const activePage = document.querySelector('.page.active');
    if (activePage) {
        showPage(activePage.id);
    }
}

// ホームページを更新
function updateHomePage() {
    const currentTournament = tournament.getCurrentTournament();
    const noTournamentMsg = document.getElementById('noTournamentMessage');
    const tournamentContent = document.getElementById('tournamentContent');
    
    if (!currentTournament) {
        noTournamentMsg.style.display = 'block';
        tournamentContent.style.display = 'none';
        return;
    }
    
    noTournamentMsg.style.display = 'none';
    tournamentContent.style.display = 'block';
    
    document.getElementById('tournamentName').value = currentTournament.name;
    document.getElementById('tournamentDate').value = currentTournament.date;
    
    // 大会形式を表示
    const typeText = currentTournament.type === 'taiko' ? '⚔️ 対抗戦' : '🏆 通常総当たり';
    document.getElementById('tournamentType').textContent = typeText;
    
    // チーム数を表示
    if (currentTournament.type === 'taiko') {
        const totalTeams = currentTournament.campA.teams.length + currentTournament.campB.teams.length;
        document.getElementById('teamCount').textContent = totalTeams;
    } else {
        document.getElementById('teamCount').textContent = currentTournament.teams.length;
    }

    // 大会名と日付の変更を監視
    document.getElementById('tournamentName').onchange = function() {
        tournament.updateTournamentInfo(this.value, document.getElementById('tournamentDate').value);
        updateTournamentSelector();
    };
    document.getElementById('tournamentDate').onchange = function() {
        tournament.updateTournamentInfo(document.getElementById('tournamentName').value, this.value);
        updateTournamentSelector();
    };
}

// チームリストを更新
function updateTeamList() {
    const currentTournament = tournament.getCurrentTournament();
    
    if (!currentTournament) {
        document.getElementById('normalTeamMode').style.display = 'none';
        document.getElementById('taikoTeamMode').style.display = 'none';
        return;
    }
    
    // モード切替
    if (currentTournament.type === 'taiko') {
        document.getElementById('normalTeamMode').style.display = 'none';
        document.getElementById('taikoTeamMode').style.display = 'block';
        updateTaikoTeamList();
    } else {
        document.getElementById('normalTeamMode').style.display = 'block';
        document.getElementById('taikoTeamMode').style.display = 'none';
        updateNormalTeamList();
    }
}

// 通常モードのチームリスト更新
function updateNormalTeamList() {
    const listElement = document.getElementById('teamList');
    const teams = tournament.getTeams();
    
    if (teams.length === 0) {
        listElement.innerHTML = '<li class="empty-state"><p>チームがまだ登録されていません</p></li>';
        return;
    }

    listElement.innerHTML = teams.map((team, index) => `
        <li>
            <span>${index + 1}. ${team.name}</span>
            <button class="btn btn-danger" onclick="removeTeam(${team.id})">削除</button>
        </li>
    `).join('');
}

// 対抗戦モードのチームリスト更新
function updateTaikoTeamList() {
    const currentTournament = tournament.getCurrentTournament();
    if (!currentTournament) return;
    
    // 陣営名を設定
    document.getElementById('campAName').value = currentTournament.campA.name;
    document.getElementById('campBName').value = currentTournament.campB.name;
    
    // 陣営Aのチームリスト
    const listA = document.getElementById('teamListA');
    if (currentTournament.campA.teams.length === 0) {
        listA.innerHTML = '<li class="empty-state"><p>チームを追加してください</p></li>';
    } else {
        listA.innerHTML = currentTournament.campA.teams.map((team, index) => `
            <li>
                <span>${index + 1}. ${team.name}${team.role ? ` <span class="role-badge ${getRoleBadgeClass(team.role)}">${team.role}</span>` : ''}</span>
                <button class="btn btn-danger" onclick="removeTeamFromCampUI('A', ${team.id})">削除</button>
            </li>
        `).join('');
    }
    
    // 陣営Bのチームリスト
    const listB = document.getElementById('teamListB');
    if (currentTournament.campB.teams.length === 0) {
        listB.innerHTML = '<li class="empty-state"><p>チームを追加してください</p></li>';
    } else {
        listB.innerHTML = currentTournament.campB.teams.map((team, index) => `
            <li>
                <span>${index + 1}. ${team.name}${team.role ? ` <span class="role-badge ${getRoleBadgeClass(team.role)}">${team.role}</span>` : ''}</span>
                <button class="btn btn-danger" onclick="removeTeamFromCampUI('B', ${team.id})">削除</button>
            </li>
        `).join('');
    }
}

// 役職バッジのクラス名を取得
function getRoleBadgeClass(role) {
    switch(role) {
        case '大将': return 'taisho';
        case '副将': return 'fukusho';
        case '次鋒': return 'jiho';
        case '先鋒': return 'senpo';
        default: return '';
    }
}

// チームを追加
function addTeam() {
    const input = document.getElementById('teamName');
    if (tournament.addTeam(input.value)) {
        input.value = '';
        updateTeamList();
        updateHomePage();
    }
}

// チームを削除
function removeTeam(id) {
    if (confirm('このチームを削除しますか？関連する試合も削除されます。')) {
        tournament.removeTeam(id);
        updateTeamList();
        updateHomePage();
    }
}

// スケジュールを生成
function generateSchedule() {
    const currentTournament = tournament.getCurrentTournament();
    if (!currentTournament) return;
    
    if (currentTournament.type === 'taiko') {
        generateTaikoSchedule();
    } else {
        generateNormalSchedule();
    }
}

// 通常モードのスケジュール生成
function generateNormalSchedule() {
    const matches = tournament.getMatches();
    if (matches.length > 0) {
        if (!confirm('既存のスケジュールを上書きしますか？全ての試合結果がリセットされます。')) {
            return;
        }
    }
    
    if (tournament.generateRoundRobinSchedule()) {
        alert('総当たり戦スケジュールを生成しました！');
        showPage('schedule');
    }
}

// 対抗戦モードのスケジュール生成
function generateTaikoSchedule() {
    const currentTournament = tournament.getCurrentTournament();
    
    // 予選が既にある場合は確認
    if (currentTournament.campA.matches.length > 0 || currentTournament.campB.matches.length > 0) {
        if (!confirm('既存の予選スケジュールを上書きしますか？全ての試合結果がリセットされます。')) {
            return;
        }
    }
    
    if (tournament.generatePreliminarySchedule()) {
        alert('予選リーグのスケジュールを生成しました！');
        showPage('schedule');
    }
}

// スケジュールリストを更新
function updateScheduleList() {
    const currentTournament = tournament.getCurrentTournament();
    
    if (!currentTournament) {
        document.getElementById('normalScheduleMode').style.display = 'none';
        document.getElementById('taikoScheduleMode').style.display = 'none';
        return;
    }
    
    if (currentTournament.type === 'taiko') {
        document.getElementById('normalScheduleMode').style.display = 'none';
        document.getElementById('taikoScheduleMode').style.display = 'block';
        updateTaikoScheduleList();
    } else {
        document.getElementById('normalScheduleMode').style.display = 'block';
        document.getElementById('taikoScheduleMode').style.display = 'none';
        updateNormalScheduleList();
    }
}

// 通常モードのスケジュールリスト更新
function updateNormalScheduleList() {
    const container = document.getElementById('scheduleList');
    const matches = tournament.getMatches();
    
    if (matches.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>試合スケジュールがまだ生成されていません</p>
                <button class="btn btn-primary" onclick="showPage('teams')">チームを登録してスケジュールを生成</button>
            </div>
        `;
        return;
    }

    container.innerHTML = matches.map((match, index) => {
        const homeName = tournament.getTeamName(match.homeTeamId);
        const awayName = tournament.getTeamName(match.awayTeamId);
        const isCompleted = match.completed;
        
        let scoreDisplay;
        if (isCompleted) {
            const homeWin = match.homeScore > match.awayScore;
            const awayWin = match.awayScore > match.homeScore;
            scoreDisplay = `
                <div class="score-display">
                    <span class="score ${homeWin ? 'winner' : ''}">${match.homeScore}</span>
                    <span class="vs">-</span>
                    <span class="score ${awayWin ? 'winner' : ''}">${match.awayScore}</span>
                </div>
            `;
        } else {
            scoreDisplay = `
                <button class="btn btn-score" onclick="openScoreModal(${index})">スコア入力</button>
            `;
        }

        return `
            <div class="match-card ${isCompleted ? 'completed' : ''}">
                <div class="team-name home">${homeName}</div>
                ${scoreDisplay}
                <div class="team-name away">${awayName}</div>
                ${isCompleted ? `<button class="btn btn-secondary" onclick="openScoreModal(${index})">修正</button>` : ''}
            </div>
        `;
    }).join('');
}

// 対抗戦モードのスケジュールリスト更新
function updateTaikoScheduleList() {
    const currentTournament = tournament.getCurrentTournament();
    if (!currentTournament) return;
    
    // 予選リーグ
    updateCampMatchList('A');
    updateCampMatchList('B');
    
    // 決勝戦
    updateFinalMatchList();
    
    // 予選完了ボタンの状態
    const allPrelimCompleted = checkAllPreliminaryCompleted();
    const finalizeBtn = document.getElementById('finalizePreliminaryBtn');
    if (finalizeBtn) {
        finalizeBtn.disabled = !allPrelimCompleted || currentTournament.preliminaryFinalized;
        if (currentTournament.preliminaryFinalized) {
            finalizeBtn.textContent = '予選確定済み';
        }
    }
}

// 陣営の試合リストを更新
function updateCampMatchList(camp) {
    const currentTournament = tournament.getCurrentTournament();
    const matches = camp === 'A' ? currentTournament.campA.matches : currentTournament.campB.matches;
    const teams = camp === 'A' ? currentTournament.campA.teams : currentTournament.campB.teams;
    const container = document.getElementById(`matchList${camp}`);
    
    if (!container) return;
    
    if (matches.length === 0) {
        container.innerHTML = '<p class="empty-state">予選スケジュールが生成されていません</p>';
        return;
    }
    
    container.innerHTML = matches.map((match, index) => {
        const homeTeam = teams.find(t => t.id === match.homeTeamId);
        const awayTeam = teams.find(t => t.id === match.awayTeamId);
        const homeName = homeTeam ? homeTeam.name : '不明';
        const awayName = awayTeam ? awayTeam.name : '不明';
        const isCompleted = match.completed;
        
        let scoreDisplay;
        if (isCompleted) {
            const homeWin = match.homeScore > match.awayScore;
            const awayWin = match.awayScore > match.homeScore;
            scoreDisplay = `
                <div class="score-display">
                    <span class="score ${homeWin ? 'winner' : ''}">${match.homeScore}</span>
                    <span class="vs">-</span>
                    <span class="score ${awayWin ? 'winner' : ''}">${match.awayScore}</span>
                </div>
            `;
        } else {
            scoreDisplay = `
                <button class="btn btn-score" onclick="openCampScoreModal('${camp}', ${index})">スコア入力</button>
            `;
        }
        
        return `
            <div class="match-card ${isCompleted ? 'completed' : ''}">
                <div class="team-name home">${homeName}</div>
                ${scoreDisplay}
                <div class="team-name away">${awayName}</div>
                ${isCompleted ? `<button class="btn btn-secondary" onclick="openCampScoreModal('${camp}', ${index})">修正</button>` : ''}
            </div>
        `;
    }).join('');
}

// 決勝戦リストを更新
function updateFinalMatchList() {
    const currentTournament = tournament.getCurrentTournament();
    const container = document.getElementById('finalMatchList');
    
    if (!container) return;
    
    if (!currentTournament.preliminaryFinalized) {
        container.innerHTML = '<p class="empty-state">予選リーグ終了後に決勝戦が表示されます</p>';
        return;
    }
    
    const finalMatches = currentTournament.finalMatches;
    if (finalMatches.length === 0) {
        container.innerHTML = '<p class="empty-state">決勝戦データがありません</p>';
        return;
    }
    
    const roleOrder = ['大将', '副将', '次鋒', '先鋒'];
    
    container.innerHTML = finalMatches.map((match, index) => {
        const teamA = currentTournament.campA.teams.find(t => t.id === match.teamAId);
        const teamB = currentTournament.campB.teams.find(t => t.id === match.teamBId);
        const teamAName = teamA ? teamA.name : '不明';
        const teamBName = teamB ? teamB.name : '不明';
        const role = match.role;
        const badgeClass = getRoleBadgeClass(role);
        const isCompleted = match.completed;
        
        let scoreDisplay;
        if (isCompleted) {
            const aWin = match.teamAScore > match.teamBScore;
            const bWin = match.teamBScore > match.teamAScore;
            scoreDisplay = `
                <div class="score-display">
                    <span class="score ${aWin ? 'winner' : ''}">${match.teamAScore}</span>
                    <span class="vs">-</span>
                    <span class="score ${bWin ? 'winner' : ''}">${match.teamBScore}</span>
                </div>
            `;
        } else {
            scoreDisplay = `
                <button class="btn btn-score" onclick="openFinalScoreModal(${index})">スコア入力</button>
            `;
        }
        
        return `
            <div class="final-match-card ${isCompleted ? 'completed' : ''}">
                <div class="final-match-role"><span class="role-badge ${badgeClass}">${role}</span></div>
                <div class="final-match-content">
                    <div class="camp-label camp-a">${currentTournament.campA.name}</div>
                    <div class="team-name">${teamAName}</div>
                    ${scoreDisplay}
                    <div class="team-name">${teamBName}</div>
                    <div class="camp-label camp-b">${currentTournament.campB.name}</div>
                </div>
                ${isCompleted ? `<button class="btn btn-secondary" onclick="openFinalScoreModal(${index})">修正</button>` : ''}
            </div>
        `;
    }).join('');
    
    // 対抗戦結果を表示
    updateTaikoResult();
}

// 予選が全て完了しているかチェック
function checkAllPreliminaryCompleted() {
    const currentTournament = tournament.getCurrentTournament();
    if (!currentTournament || currentTournament.type !== 'taiko') return false;
    
    const allACompleted = currentTournament.campA.matches.length > 0 &&
        currentTournament.campA.matches.every(m => m.completed);
    const allBCompleted = currentTournament.campB.matches.length > 0 &&
        currentTournament.campB.matches.every(m => m.completed);
    
    return allACompleted && allBCompleted;
}

// 対抗戦結果を更新
function updateTaikoResult() {
    const resultContainer = document.getElementById('taikoResultContainer');
    if (!resultContainer) return;
    
    const result = tournament.getTaikoResult();
    if (!result) {
        resultContainer.innerHTML = '';
        return;
    }
    
    let winnerText;
    if (result.winner === 'A') {
        winnerText = `🏆 ${result.campAName} の勝利！`;
    } else if (result.winner === 'B') {
        winnerText = `🏆 ${result.campBName} の勝利！`;
    } else if (result.winner === 'draw') {
        winnerText = '🤝 引き分け';
    } else {
        winnerText = '試合未完了';
    }
    
    resultContainer.innerHTML = `
        <div class="taiko-result">
            <h3>対抗戦結果</h3>
            <div class="taiko-result-score">
                <span class="camp-name camp-a">${result.campAName}</span>
                <span class="score-large">${result.campAWins}</span>
                <span class="vs">-</span>
                <span class="score-large">${result.campBWins}</span>
                <span class="camp-name camp-b">${result.campBName}</span>
            </div>
            <div class="taiko-result-winner">${winnerText}</div>
        </div>
    `;
}

// スコア入力モーダルを開く
function openScoreModal(matchIndex) {
    tournament.currentMatchIndex = matchIndex;
    const matches = tournament.getMatches();
    const match = matches[matchIndex];
    
    document.getElementById('homeTeamLabel').textContent = tournament.getTeamName(match.homeTeamId);
    document.getElementById('awayTeamLabel').textContent = tournament.getTeamName(match.awayTeamId);
    document.getElementById('homeScore').value = match.homeScore !== null ? match.homeScore : 0;
    document.getElementById('awayScore').value = match.awayScore !== null ? match.awayScore : 0;
    
    document.getElementById('scoreModal').classList.add('active');
}

// モーダルを閉じる
function closeModal() {
    document.getElementById('scoreModal').classList.remove('active');
    tournament.currentMatchIndex = -1;
}

// スコアを保存
function saveScore() {
    const homeScore = document.getElementById('homeScore').value;
    const awayScore = document.getElementById('awayScore').value;
    
    if (homeScore === '' || awayScore === '') {
        alert('スコアを入力してください');
        return;
    }

    tournament.saveMatchScore(tournament.currentMatchIndex, homeScore, awayScore);
    closeModal();
    updateScheduleList();
}

// 順位表を更新
function updateStandings() {
    const currentTournament = tournament.getCurrentTournament();
    
    if (!currentTournament) {
        document.getElementById('normalStandingsMode').style.display = 'none';
        document.getElementById('taikoStandingsMode').style.display = 'none';
        return;
    }
    
    if (currentTournament.type === 'taiko') {
        document.getElementById('normalStandingsMode').style.display = 'none';
        document.getElementById('taikoStandingsMode').style.display = 'block';
        updateTaikoStandings();
    } else {
        document.getElementById('normalStandingsMode').style.display = 'block';
        document.getElementById('taikoStandingsMode').style.display = 'none';
        updateNormalStandings();
    }
}

// 通常モードの順位表更新
function updateNormalStandings() {
    const tbody = document.getElementById('standingsBody');
    const stats = tournament.getTeamStats();
    
    if (stats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="empty-state">チームが登録されていません</td></tr>';
        document.getElementById('matchupTable').innerHTML = '';
        return;
    }

    tbody.innerHTML = stats.map((team, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${team.name}</td>
            <td><strong>${team.points}</strong></td>
            <td>${team.played}</td>
            <td>${team.wins}</td>
            <td>${team.losses}</td>
            <td>${team.draws}</td>
            <td>${(team.winRate * 100).toFixed(1)}%</td>
            <td>${team.runsFor}</td>
            <td>${team.runsAgainst}</td>
            <td>${team.runDiff > 0 ? '+' : ''}${team.runDiff}</td>
        </tr>
    `).join('');

    // 対戦表を更新
    updateMatchupTable();
}

// 対抗戦モードの順位表更新
function updateTaikoStandings() {
    updateCampStandings('A');
    updateCampStandings('B');
}

// 陣営の順位表を更新
function updateCampStandings(camp) {
    const currentTournament = tournament.getCurrentTournament();
    const tbody = document.getElementById(`standingsBody${camp}`);
    if (!tbody) return;
    
    const stats = tournament.getCampTeamStats(camp);
    
    if (stats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="empty-state">チームが登録されていません</td></tr>';
        return;
    }
    
    tbody.innerHTML = stats.map((team, index) => {
        const roleClass = team.role ? getRoleBadgeClass(team.role) : '';
        const roleHtml = team.role ? `<span class="role-badge ${roleClass}">${team.role}</span>` : '';
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${team.name} ${roleHtml}</td>
                <td><strong>${team.points}</strong></td>
                <td>${team.played}</td>
                <td>${team.wins}</td>
                <td>${team.losses}</td>
                <td>${team.draws}</td>
                <td>${(team.winRate * 100).toFixed(1)}%</td>
                <td>${team.runsFor}</td>
                <td>${team.runsAgainst}</td>
                <td>${team.runDiff > 0 ? '+' : ''}${team.runDiff}</td>
            </tr>
        `;
    }).join('');
}

// 対戦表を更新
function updateMatchupTable() {
    const container = document.getElementById('matchupTable');
    const teams = tournament.getTeams();
    
    if (teams.length < 2) {
        container.innerHTML = '<p class="empty-state">対戦表を表示するには、最低2チーム必要です</p>';
        return;
    }

    let html = '<table class="matchup-table"><thead><tr><th></th>';
    
    // ヘッダー行
    teams.forEach(team => {
        html += `<th>${team.name}</th>`;
    });
    html += '</tr></thead><tbody>';

    // データ行
    teams.forEach(team1 => {
        html += `<tr><td class="team-header">${team1.name}</td>`;
        teams.forEach(team2 => {
            if (team1.id === team2.id) {
                html += '<td class="diagonal">-</td>';
            } else {
                const result = tournament.getMatchResult(team1.id, team2.id);
                let cellClass = '';
                if (result.result === 'win') cellClass = 'win';
                else if (result.result === 'lose') cellClass = 'lose';
                else if (result.result === 'draw') cellClass = 'draw';
                
                html += `<td class="${cellClass}">${result.score}</td>`;
            }
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// ===================================
// 大会管理モーダル
// ===================================

// 新規大会モーダルを開く
function openNewTournamentModal() {
    document.getElementById('newTournamentName').value = '';
    document.getElementById('newTournamentDate').value = '';
    document.getElementById('tournamentTypeNormal').checked = true;
    document.getElementById('newTournamentModal').classList.add('active');
}

// 新規大会モーダルを閉じる
function closeNewTournamentModal() {
    document.getElementById('newTournamentModal').classList.remove('active');
}

// 新規大会を作成
function createNewTournament() {
    const name = document.getElementById('newTournamentName').value;
    const date = document.getElementById('newTournamentDate').value;
    const typeRadio = document.querySelector('input[name="tournamentType"]:checked');
    const type = typeRadio ? typeRadio.value : 'normal';
    
    if (tournament.createTournament(name, date, type)) {
        closeNewTournamentModal();
        updateTournamentSelector();
        showPage('home');
    }
}

// 大会削除モーダルを開く
function openDeleteTournamentModal() {
    const currentTournament = tournament.getCurrentTournament();
    if (!currentTournament) return;
    
    document.getElementById('deleteTournamentName').textContent = currentTournament.name;
    document.getElementById('deleteTournamentModal').classList.add('active');
}

// 大会削除モーダルを閉じる
function closeDeleteTournamentModal() {
    document.getElementById('deleteTournamentModal').classList.remove('active');
}

// 大会削除を確定
function confirmDeleteTournament() {
    if (tournament.deleteTournament(tournament.currentTournamentId)) {
        closeDeleteTournamentModal();
        updateTournamentSelector();
        showPage('home');
    }
}

// ===================================
// イベントリスナー
// ===================================
document.addEventListener('DOMContentLoaded', function() {
    // ナビゲーションリンクのクリックイベント
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            showPage(this.dataset.page);
        });
    });

    // チーム名入力でEnterキーを押した時
    document.getElementById('teamName').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addTeam();
        }
    });

    // モーダル外をクリックした時に閉じる
    document.getElementById('scoreModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
    document.getElementById('newTournamentModal').addEventListener('click', function(e) {
        if (e.target === this) closeNewTournamentModal();
    });
    document.getElementById('deleteTournamentModal').addEventListener('click', function(e) {
        if (e.target === this) closeDeleteTournamentModal();
    });

    // 大会セレクターを初期化
    updateTournamentSelector();
    
    // 初期表示
    showPage('home');
});

// ===================================
// ユーティリティ
// ===================================

// データをエクスポート（JSON形式）
function exportData() {
    const data = {
        tournaments: tournament.tournaments,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baseball-tournaments-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// データをインポート
function importData(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            tournament.tournaments = data.tournaments || [];
            tournament.currentTournamentId = tournament.tournaments.length > 0 ? tournament.tournaments[0].id : null;
            tournament.saveData();
            location.reload();
        } catch (error) {
            alert('ファイルの読み込みに失敗しました');
        }
    };
    reader.readAsText(file);
}

// ===================================
// 対抗戦用UI関数
// ===================================

// 陣営にチームを追加
function addTeamToCamp(camp) {
    const inputId = camp === 'A' ? 'teamNameA' : 'teamNameB';
    const input = document.getElementById(inputId);
    if (tournament.addTeamToCamp(camp, input.value)) {
        input.value = '';
        updateTaikoTeamList();
        updateHomePage();
    }
}

// 陣営からチームを削除
function removeTeamFromCampUI(camp, id) {
    if (confirm('このチームを削除しますか？')) {
        tournament.removeTeamFromCamp(camp, id);
        updateTaikoTeamList();
        updateHomePage();
    }
}

// 陣営名を変更
function saveCampName(camp) {
    const inputId = camp === 'A' ? 'campAName' : 'campBName';
    const name = document.getElementById(inputId).value;
    tournament.updateCampName(camp, name);
    alert(`陣営${camp}の名前を「${name}」に変更しました`);
}

// 予選スコアモーダルを開く
let currentCampMatch = { camp: null, index: -1 };

function openCampScoreModal(camp, matchIndex) {
    currentCampMatch = { camp, index: matchIndex };
    const currentTournament = tournament.getCurrentTournament();
    const matches = camp === 'A' ? currentTournament.campA.matches : currentTournament.campB.matches;
    const teams = camp === 'A' ? currentTournament.campA.teams : currentTournament.campB.teams;
    const match = matches[matchIndex];
    
    const homeTeam = teams.find(t => t.id === match.homeTeamId);
    const awayTeam = teams.find(t => t.id === match.awayTeamId);
    
    document.getElementById('campScoreModalTitle').textContent = `予選 - ${camp === 'A' ? currentTournament.campA.name : currentTournament.campB.name}`;
    document.getElementById('campHomeTeamLabel').textContent = homeTeam ? homeTeam.name : '不明';
    document.getElementById('campAwayTeamLabel').textContent = awayTeam ? awayTeam.name : '不明';
    document.getElementById('campHomeScore').value = match.homeScore !== null ? match.homeScore : 0;
    document.getElementById('campAwayScore').value = match.awayScore !== null ? match.awayScore : 0;
    
    document.getElementById('campScoreModal').classList.add('active');
}

function closeCampScoreModal() {
    document.getElementById('campScoreModal').classList.remove('active');
    currentCampMatch = { camp: null, index: -1 };
}

function saveCampScore() {
    const homeScore = document.getElementById('campHomeScore').value;
    const awayScore = document.getElementById('campAwayScore').value;
    
    if (homeScore === '' || awayScore === '') {
        alert('スコアを入力してください');
        return;
    }
    
    tournament.saveCampMatchScore(currentCampMatch.camp, currentCampMatch.index, homeScore, awayScore);
    closeCampScoreModal();
    updateTaikoScheduleList();
    updateTaikoStandings();
}

// 決勝戦スコアモーダルを開く
let currentFinalMatch = -1;

function openFinalScoreModal(matchIndex) {
    currentFinalMatch = matchIndex;
    const currentTournament = tournament.getCurrentTournament();
    const match = currentTournament.finalMatches[matchIndex];
    
    const teamA = currentTournament.campA.teams.find(t => t.id === match.teamAId);
    const teamB = currentTournament.campB.teams.find(t => t.id === match.teamBId);
    
    document.getElementById('finalScoreModalTitle').textContent = `決勝 - ${match.role}`;
    document.getElementById('finalTeamALabel').textContent = `${currentTournament.campA.name}: ${teamA ? teamA.name : '不明'}`;
    document.getElementById('finalTeamBLabel').textContent = `${currentTournament.campB.name}: ${teamB ? teamB.name : '不明'}`;
    document.getElementById('finalTeamAScore').value = match.teamAScore !== null ? match.teamAScore : 0;
    document.getElementById('finalTeamBScore').value = match.teamBScore !== null ? match.teamBScore : 0;
    
    document.getElementById('finalScoreModal').classList.add('active');
}

function closeFinalScoreModal() {
    document.getElementById('finalScoreModal').classList.remove('active');
    currentFinalMatch = -1;
}

function saveFinalScore() {
    const teamAScore = document.getElementById('finalTeamAScore').value;
    const teamBScore = document.getElementById('finalTeamBScore').value;
    
    if (teamAScore === '' || teamBScore === '') {
        alert('スコアを入力してください');
        return;
    }
    
    tournament.saveFinalMatchScore(currentFinalMatch, teamAScore, teamBScore);
    closeFinalScoreModal();
    updateFinalMatchList();
}

// 予選を確定して決勝戦を生成
function finalizePreliminaryUI() {
    if (!checkAllPreliminaryCompleted()) {
        alert('全ての予選試合が完了していません');
        return;
    }
    
    if (!confirm('予選を確定して決勝戦を生成しますか？\n役職（大将・副将・次鋒・先鋒）が順位に基づいて割り当てられます。')) {
        return;
    }
    
    if (tournament.finalizePreliminary()) {
        alert('予選が確定しました！決勝戦のスケジュールが生成されました。');
        updateTaikoScheduleList();
        updateTaikoTeamList();
        updateTaikoStandings();
    }
}

// 対抗戦フェーズタブの切り替え
function showTaikoPhase(phase) {
    // タブの状態を更新
    document.querySelectorAll('.phase-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`.phase-tab[onclick*="${phase}"]`).classList.add('active');
    
    // コンテンツの表示切り替え
    document.getElementById('preliminaryPhase').style.display = phase === 'preliminary' ? 'block' : 'none';
    document.getElementById('finalPhase').style.display = phase === 'final' ? 'block' : 'none';
}
