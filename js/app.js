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
    createTournament(name, date) {
        if (!name.trim()) {
            alert('大会名を入力してください');
            return false;
        }
        
        const newTournament = {
            id: Date.now(),
            name: name.trim(),
            date: date || '',
            teams: [],
            matches: [],
            createdAt: new Date().toISOString()
        };
        
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
        
        const team = tournament.teams.find(t => t.id === id);
        return team ? team.name : '不明';
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
    document.getElementById('teamCount').textContent = currentTournament.teams.length;
    document.getElementById('matchCount').textContent = currentTournament.matches.length;

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
    const listElement = document.getElementById('teamList');
    const teams = tournament.getTeams();
    
    if (!tournament.getCurrentTournament()) {
        listElement.innerHTML = '<li class="empty-state"><p>大会を選択してください</p></li>';
        return;
    }
    
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

// スケジュールリストを更新
function updateScheduleList() {
    const container = document.getElementById('scheduleList');
    const matches = tournament.getMatches();
    
    if (!tournament.getCurrentTournament()) {
        container.innerHTML = `
            <div class="empty-state">
                <p>大会を選択してください</p>
            </div>
        `;
        return;
    }
    
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
    const tbody = document.getElementById('standingsBody');
    const stats = tournament.getTeamStats();
    
    if (!tournament.getCurrentTournament()) {
        tbody.innerHTML = '<tr><td colspan="11" class="empty-state">大会を選択してください</td></tr>';
        document.getElementById('matchupTable').innerHTML = '';
        return;
    }
    
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
    
    if (tournament.createTournament(name, date)) {
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
