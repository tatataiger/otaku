/**
 * 草野球大会 スコア管理システム
 * メインアプリケーション
 */

// ===================================
// データ管理
// ===================================
class TournamentManager {
    constructor() {
        this.teams = [];
        this.matches = [];
        this.tournamentName = '';
        this.tournamentDate = '';
        this.currentMatchIndex = -1;
        this.loadData();
    }

    // LocalStorageからデータを読み込み
    loadData() {
        const savedData = localStorage.getItem('baseballTournament');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.teams = data.teams || [];
            this.matches = data.matches || [];
            this.tournamentName = data.tournamentName || '';
            this.tournamentDate = data.tournamentDate || '';
        }
    }

    // LocalStorageにデータを保存
    saveData() {
        const data = {
            teams: this.teams,
            matches: this.matches,
            tournamentName: this.tournamentName,
            tournamentDate: this.tournamentDate
        };
        localStorage.setItem('baseballTournament', JSON.stringify(data));
    }

    // チームを追加
    addTeam(name) {
        if (!name.trim()) {
            alert('チーム名を入力してください');
            return false;
        }
        if (this.teams.find(t => t.name === name.trim())) {
            alert('このチーム名は既に登録されています');
            return false;
        }
        this.teams.push({
            id: Date.now(),
            name: name.trim()
        });
        this.saveData();
        return true;
    }

    // チームを削除
    removeTeam(id) {
        const index = this.teams.findIndex(t => t.id === id);
        if (index !== -1) {
            this.teams.splice(index, 1);
            // 関連する試合も削除
            this.matches = this.matches.filter(m => 
                m.homeTeamId !== id && m.awayTeamId !== id
            );
            this.saveData();
        }
    }

    // 総当たり戦スケジュールを生成
    generateRoundRobinSchedule() {
        if (this.teams.length < 2) {
            alert('スケジュールを生成するには、最低2チーム必要です');
            return false;
        }

        this.matches = [];
        let matchNumber = 1;

        // 総当たり戦: 全チームと全チームが対戦
        for (let i = 0; i < this.teams.length; i++) {
            for (let j = i + 1; j < this.teams.length; j++) {
                this.matches.push({
                    id: Date.now() + matchNumber,
                    matchNumber: matchNumber,
                    homeTeamId: this.teams[i].id,
                    awayTeamId: this.teams[j].id,
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
        if (matchIndex >= 0 && matchIndex < this.matches.length) {
            this.matches[matchIndex].homeScore = parseInt(homeScore);
            this.matches[matchIndex].awayScore = parseInt(awayScore);
            this.matches[matchIndex].completed = true;
            this.saveData();
        }
    }

    // チームの成績を計算
    getTeamStats() {
        const stats = {};
        
        // 全チームの初期化
        this.teams.forEach(team => {
            stats[team.id] = {
                id: team.id,
                name: team.name,
                played: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                runsFor: 0,
                runsAgainst: 0,
                winRate: 0
            };
        });

        // 完了した試合から成績を計算
        this.matches.filter(m => m.completed).forEach(match => {
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
                    away.losses++;
                } else if (match.homeScore < match.awayScore) {
                    home.losses++;
                    away.wins++;
                } else {
                    home.draws++;
                    away.draws++;
                }
            }
        });

        // 勝率を計算してソート
        return Object.values(stats)
            .map(s => {
                const totalGames = s.wins + s.losses;
                s.winRate = totalGames > 0 ? (s.wins / totalGames) : 0;
                s.runDiff = s.runsFor - s.runsAgainst;
                return s;
            })
            .sort((a, b) => {
                // 勝率でソート、同率なら得失点差でソート
                if (b.winRate !== a.winRate) return b.winRate - a.winRate;
                if (b.runDiff !== a.runDiff) return b.runDiff - a.runDiff;
                return b.runsFor - a.runsFor;
            });
    }

    // 対戦結果を取得
    getMatchResult(team1Id, team2Id) {
        const match = this.matches.find(m => 
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
        const team = this.teams.find(t => t.id === id);
        return team ? team.name : '不明';
    }

    // データをリセット
    resetData() {
        if (confirm('全てのデータを削除しますか？この操作は取り消せません。')) {
            this.teams = [];
            this.matches = [];
            this.tournamentName = '';
            this.tournamentDate = '';
            localStorage.removeItem('baseballTournament');
            location.reload();
        }
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

// ホームページを更新
function updateHomePage() {
    document.getElementById('tournamentName').value = tournament.tournamentName;
    document.getElementById('tournamentDate').value = tournament.tournamentDate;
    document.getElementById('teamCount').textContent = tournament.teams.length;
    document.getElementById('matchCount').textContent = tournament.matches.length;

    // 大会名と日付の変更を監視
    document.getElementById('tournamentName').onchange = function() {
        tournament.tournamentName = this.value;
        tournament.saveData();
    };
    document.getElementById('tournamentDate').onchange = function() {
        tournament.tournamentDate = this.value;
        tournament.saveData();
    };
}

// チームリストを更新
function updateTeamList() {
    const listElement = document.getElementById('teamList');
    
    if (tournament.teams.length === 0) {
        listElement.innerHTML = '<li class="empty-state"><p>チームがまだ登録されていません</p></li>';
        return;
    }

    listElement.innerHTML = tournament.teams.map((team, index) => `
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
    if (tournament.matches.length > 0) {
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
    
    if (tournament.matches.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>試合スケジュールがまだ生成されていません</p>
                <button class="btn btn-primary" onclick="showPage('teams')">チームを登録してスケジュールを生成</button>
            </div>
        `;
        return;
    }

    container.innerHTML = tournament.matches.map((match, index) => {
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
    const match = tournament.matches[matchIndex];
    
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
    
    if (stats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-state">チームが登録されていません</td></tr>';
        document.getElementById('matchupTable').innerHTML = '';
        return;
    }

    tbody.innerHTML = stats.map((team, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${team.name}</td>
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
    const teams = tournament.teams;
    
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
        if (e.target === this) {
            closeModal();
        }
    });

    // 初期表示
    showPage('home');
});

// ===================================
// ユーティリティ
// ===================================

// データをエクスポート（JSON形式）
function exportData() {
    const data = {
        tournamentName: tournament.tournamentName,
        tournamentDate: tournament.tournamentDate,
        teams: tournament.teams,
        matches: tournament.matches,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baseball-tournament-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// データをインポート
function importData(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            tournament.teams = data.teams || [];
            tournament.matches = data.matches || [];
            tournament.tournamentName = data.tournamentName || '';
            tournament.tournamentDate = data.tournamentDate || '';
            tournament.saveData();
            location.reload();
        } catch (error) {
            alert('ファイルの読み込みに失敗しました');
        }
    };
    reader.readAsText(file);
}
