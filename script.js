// アプリデータ管理
let games = JSON.parse(localStorage.getItem('baseball_games_v5')) || [];
let playerRoster = JSON.parse(localStorage.getItem('baseball_roster_v5')) || [
    "山田", "鈴木", "佐藤", "田中", "高橋", "渡辺", "伊藤", "山本", "中村", "小林"
]; // デフォルトの選手リスト
let activeGameId = null;

// 試合内の動的イニング・カウント・走者ステート
let currentInning = 1;
let isTopInning = true;
let currentBatterIndex = { away: 0, home: 0 };

let countS = 0;
let countB = 0;
let countO = 0;

let bases = { first: 0, second: 0, third: 0 };

let inningsScore = {
    away: [null, null, null, null, null, null, null, null, null],
    home: [null, null, null, null, null, null, null, null, null]
};

document.addEventListener('DOMContentLoaded', () => {
    updateDate();
    renderGames();
    renderRoster();
});

function updateDate() {
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    document.getElementById('current-date').innerText = today.toLocaleDateString('ja-JP', options);
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // ナビゲーションの「アクティブ切り替え」を正確に処理
    const matchedBtn = Array.from(document.querySelectorAll('.nav-btn')).find(btn => btn.getAttribute('onclick').includes(tabId));
    if (matchedBtn) matchedBtn.classList.add('active');
}

// 選手名簿の管理
function renderRoster() {
    const listContainer = document.getElementById('roster-list');
    listContainer.innerHTML = '';
    playerRoster.forEach((player, idx) => {
        listContainer.innerHTML += `
            <li class="roster-li">
                <span>${player}</span>
                <button class="remove-player-btn" onclick="removePlayerFromRoster(${idx})">×</button>
            </li>
        `;
    });
    localStorage.setItem('baseball_roster_v5', JSON.stringify(playerRoster));
}

function addPlayerToRoster() {
    const nameInput = document.getElementById('new-player-name');
    const name = nameInput.value.trim();
    if (name) {
        playerRoster.push(name);
        nameInput.value = '';
        renderRoster();
    }
}

function removePlayerFromRoster(idx) {
    playerRoster.splice(idx, 1);
    renderRoster();
}

// メンバー設定セレクトボックスの生成
function populateRosterSelects() {
    const selects = document.querySelectorAll('.roster-select');
    selects.forEach(select => {
        const prevValue = select.value;
        select.innerHTML = '<option value="">-- 選択 --</option>';
        playerRoster.forEach(player => {
            select.innerHTML += `<option value="${player}">${player}</option>`;
        });
        if (prevValue) select.value = prevValue;
    });
}

// 試合の追加
document.getElementById('game-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const date = document.getElementById('game-date').value;
    const home = document.getElementById('home-team').value;
    const away = document.getElementById('away-team').value;

    const newGame = {
        id: Date.now(),
        date, home, away,
        homePitcher: '',
        awayPitcher: '',
        awayLineup: Array.from({length: 9}, (_, i) => ({ name: '', plateApps: 0, atBats: 0, hits: 0, double: 0, triple: 0, hrs: 0, bb: 0 })),
        homeLineup: Array.from({length: 9}, (_, i) => ({ name: '', plateApps: 0, atBats: 0, hits: 0, double: 0, triple: 0, hrs: 0, bb: 0 })),
        bench: "",
        scoreAwayHits: 0,
        scoreHomeHits: 0,
        scoreAway: 0,  // 最終的な決着スコア
        scoreHome: 0,  // 最終的な決着スコア
        isFinished: false // 終了判定
    };

    games.push(newGame);
    saveData();
    renderGames();
    document.getElementById('game-form').reset();
    switchTab('home');
});

// 【NEW】試合結果スコアを反映したゲームリストレンダリング
function renderGames() {
    const gameListContainer = document.getElementById('game-list');
    if (games.length === 0) {
        gameListContainer.innerHTML = `<p class="no-data">試合予定がありません。試合を追加してください。</p>`;
        return;
    }
    gameListContainer.innerHTML = '';
    games.forEach(game => {
        const gameCard = document.createElement('div');
        gameCard.className = 'game-card';
        
        let scoreUI = `<span class="card-versus">VS</span>`;
        let statusBadge = `<span class="game-status-label live">試合前/LIVE</span>`;

        // 試合終了している場合のみ、スコアを大きく表示
        if (game.isFinished) {
            scoreUI = `<span class="score-badge">${game.scoreAway} - ${game.scoreHome}</span>`;
            statusBadge = `<span class="game-status-label finished">GAME SET</span>`;
        }

        gameCard.innerHTML = `
            <button class="delete-game-btn" onclick="event.stopPropagation(); deleteGame(${game.id})">削除</button>
            <div onclick="openGameManager(${game.id})">
                <span class="card-date">${game.date}</span>
                <div class="card-teams">
                    <span>${game.away}</span>
                    ${scoreUI}
                    <span>${game.home}</span>
                </div>
                ${statusBadge}
            </div>
        `;
        gameListContainer.appendChild(gameCard);
    });
}

function deleteGame(id) {
    games = games.filter(g => g.id !== id);
    saveData();
    renderGames();
}

// メンバー入力欄（セレクトボックス型）の動的生成
function generateBattingOrderInputs() {
    const awayContainer = document.getElementById('away-batting-inputs');
    const homeContainer = document.getElementById('home-batting-inputs');
    awayContainer.innerHTML = '';
    homeContainer.innerHTML = '';

    for (let i = 1; i <= 9; i++) {
        awayContainer.innerHTML += `
            <div class="order-row">
                <span class="order-num">${i}番</span>
                <select id="away-b-${i}" class="roster-select"></select>
            </div>`;
        homeContainer.innerHTML += `
            <div class="order-row">
                <span class="order-num">${i}番</span>
                <select id="home-b-${i}" class="roster-select"></select>
            </div>`;
    }
}

function openGameManager(gameId) {
    activeGameId = gameId;
    const game = games.find(g => g.id === gameId);

    document.getElementById('manage-game-date').innerText = game.date;
    document.getElementById('manage-away').innerText = game.away;
    document.getElementById('manage-home').innerText = game.home;
    document.getElementById('setup-away-title').innerText = `先攻: ${game.away}`;
    document.getElementById('setup-home-title').innerText = `後攻: ${game.home}`;

    // 入力欄を生成し、名簿プルダウンを注入
    generateBattingOrderInputs();
    populateRosterSelects();

    // 既存データがあればセット
    document.getElementById('member-away-pitcher').value = game.awayPitcher;
    document.getElementById('member-home-pitcher').value = game.homePitcher;
    document.getElementById('bench-members').value = game.bench || '';

    for (let i = 1; i <= 9; i++) {
        const valAway = game.awayLineup[i-1].name || playerRoster[i-1] || '';
        const valHome = game.homeLineup[i-1].name || playerRoster[i] || '';
        document.getElementById(`away-b-${i}`).value = valAway;
        document.getElementById(`home-b-${i}`).value = valHome;
    }
    switchTab('game-manager');
}

// メンバー決定
function proceedToScoreInput() {
    const game = games.find(g => g.id === activeGameId);
    game.awayPitcher = document.getElementById('member-away-pitcher').value || 'ピッチャーA';
    game.homePitcher = document.getElementById('member-home-pitcher').value || 'ピッチャーB';
    game.bench = document.getElementById('bench-members').value;

    for (let i = 1; i <= 9; i++) {
        game.awayLineup[i-1].name = document.getElementById(`away-b-${i}`).value || `打者${i}`;
        game.homeLineup[i-1].name = document.getElementById(`home-b-${i}`).value || `打者${i}`;
    }
    saveData();

    document.getElementById('sb-away-name').innerText = game.away;
    document.getElementById('sb-home-name').innerText = game.home;

    currentInning = 1;
    isTopInning = true;
    currentBatterIndex = { away: 0, home: 0 };
    inningsScore = {
        away: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        home: [null, null, null, null, null, null, null, null, null]
    };
    game.scoreAwayHits = 0;
    game.scoreHomeHits = 0;
    
    resetBases();
    resetSBO();
    updateScoreboardUI();
    updateScoreInputUI();
    switchTab('score-input-section');
}

function backToManager() { switchTab('game-manager'); }

// イニングボードおよび得点表示
function updateScoreboardUI() {
    const game = games.find(g => g.id === activeGameId);
    const awayRow = document.getElementById('score-row-away').querySelectorAll('td');
    const homeRow = document.getElementById('score-row-home').querySelectorAll('td');

    let totalAway = 0;
    let totalHome = 0;

    for (let i = 1; i <= 9; i++) {
        const aScore = inningsScore.away[i-1];
        awayRow[i].innerText = aScore !== null ? aScore : '';
        if (aScore !== null) totalAway += aScore;

        const hScore = inningsScore.home[i-1];
        homeRow[i].innerText = hScore !== null ? hScore : '';
        if (hScore !== null) totalHome += hScore;
    }

    document.getElementById('sb-away-r').innerText = totalAway;
    document.getElementById('sb-home-r').innerText = totalHome;
    document.getElementById('sb-away-h').innerText = game.scoreAwayHits;
    document.getElementById('sb-home-h').innerText = game.scoreHomeHits;

    // ゲーム内進捗をゲームデータオブジェクトにも記憶
    game.scoreAway = totalAway;
    game.scoreHome = totalHome;
}

// 走者・SBO状況表示の更新
function updateFieldAndSBOIndicators() {
    document.getElementById('dot-s1').className = countS >= 1 ? 'active' : '';
    document.getElementById('dot-s2').className = countS >= 2 ? 'active' : '';
    document.getElementById('dot-b1').className = countB >= 1 ? 'active' : '';
    document.getElementById('dot-b2').className = countB >= 2 ? 'active' : '';
    document.getElementById('dot-b3').className = countB >= 3 ? 'active' : '';
    document.getElementById('dot-o1').className = countO >= 1 ? 'active' : '';
    document.getElementById('dot-o2').className = countO >= 2 ? 'active' : '';

    document.getElementById('display-inning-number').innerText = currentInning;
    document.getElementById('display-inning-arrow').innerText = isTopInning ? '表' : '裏';

    document.getElementById('base-1').className = bases.first ? 'base first active' : 'base first';
    document.getElementById('base-2').className = bases.second ? 'base second active' : 'base second';
    document.getElementById('base-3').className = bases.third ? 'base third active' : 'base third';
}

function addBall() {
    countB++;
    if (countB >= 4) recordAtBat('walk');
    updateFieldAndSBOIndicators();
}

function addStrike() {
    countS++;
    if (countS >= 3) recordAtBat('strikeout');
    updateFieldAndSBOIndicators();
}

function resetSBO() {
    countS = 0;
    countB = 0;
    updateFieldAndSBOIndicators();
}

function resetBases() {
    bases = { first: 0, second: 0, third: 0 };
}

function updateScoreInputUI() {
    const game = games.find(g => g.id === activeGameId);
    const isAwayActive = isTopInning;
    const lineup = isAwayActive ? game.awayLineup : game.homeLineup;
    const idx = isAwayActive ? currentBatterIndex.away : currentBatterIndex.home;
    const currentBatter = lineup[idx];
    const opponentPitcher = isAwayActive ? game.homePitcher : game.awayPitcher;

    document.getElementById('current-batter-team').innerText = isAwayActive ? game.away : game.home;
    document.getElementById('current-batter-name').innerText = currentBatter.name;
    document.getElementById('current-batter-order').innerText = `${idx + 1}番打者`;
    document.getElementById('current-opponent-pitcher').innerText = opponentPitcher;

    updateFieldAndSBOIndicators();
    renderStats();
}

// 打撃イベントハンドラー
function recordAtBat(resultType) {
    const game = games.find(g => g.id === activeGameId);
    const isAwayActive = isTopInning;
    const lineup = isAwayActive ? game.awayLineup : game.homeLineup;
    const idx = isAwayActive ? currentBatterIndex.away : currentBatterIndex.home;
    const batter = lineup[idx];

    let runsScored = 0;
    batter.plateApps += 1;

    if (resultType === 'strikeout' || resultType === 'out') {
        batter.atBats += 1;
        countO++;
        if (countO >= 3) {
            alert('3アウト！攻守交代です。');
            changeInning();
            return;
        }
    } else {
        if (resultType === 'walk') {
            batter.bb += 1;
            if (bases.first === 1) {
                if (bases.second === 1) {
                    if (bases.third === 1) {
                        runsScored++;
                    } else {
                        bases.third = 1;
                    }
                } else {
                    bases.second = 1;
                }
            } else {
                bases.first = 1;
            }
        } else {
            batter.atBats += 1;
            batter.hits += 1;
            if (isAwayActive) game.scoreAwayHits++; else game.scoreHomeHits++;

            if (resultType === 'single') {
                runsScored += bases.third;
                bases.third = bases.second;
                bases.second = bases.first;
                bases.first = 1;
            } else if (resultType === 'double') {
                batter.double += 1;
                runsScored += (bases.third + bases.second);
                bases.third = bases.first;
                bases.second = 1;
                bases.first = 0;
            } else if (resultType === 'triple') {
                batter.triple += 1;
                runsScored += (bases.third + bases.second + bases.first);
                bases.third = 1;
                bases.second = 0;
                bases.first = 0;
            } else if (resultType === 'hr') {
                batter.hrs += 1;
                runsScored += (bases.third + bases.second + bases.first + 1);
                resetBases();
            }
        }
    }

    if (runsScored > 0) {
        if (isAwayActive) {
            inningsScore.away[currentInning - 1] += runsScored;
        } else {
            inningsScore.home[currentInning - 1] += runsScored;
        }
    }

    if (isAwayActive) {
        currentBatterIndex.away = (currentBatterIndex.away + 1) % 9;
    } else {
        currentBatterIndex.home = (currentBatterIndex.home + 1) % 9;
    }

    resetSBO();
    saveData();
    updateScoreboardUI();
    updateScoreInputUI();
}

function changeInning() {
    countO = 0;
    resetSBO();
    resetBases();

    if (isTopInning) {
        isTopInning = false;
        inningsScore.home[currentInning - 1] = 0;
    } else {
        isTopInning = true;
        currentInning++;
        if (currentInning > 9) {
            alert('9回裏が終了しました。');
        } else {
            inningsScore.away[currentInning - 1] = 0;
        }
    }

    saveData();
    updateScoreboardUI();
    updateScoreInputUI();
}

// 試合終了＆スタッツ最終集計レポート
function finishGame() {
    if (!confirm('試合を終了し、スタッツレポートを生成しますか？')) return;

    const game = games.find(g => g.id === activeGameId);
    game.isFinished = true; // 終了フラグをONにする

    // スコアボードの複製
    const currentScoreHtml = document.querySelector('.scoreboard-container').innerHTML;
    document.getElementById('report-scoreboard-container').innerHTML = currentScoreHtml;

    // MVP、本塁打王の集計
    const allPlayers = [...game.awayLineup, ...game.homeLineup];
    
    // MVP
    let mvp = { name: 'なし', hits: 0 };
    allPlayers.forEach(p => {
        if (p.hits > mvp.hits) mvp = { name: p.name, hits: p.hits };
    });
    document.getElementById('mvp-winner').innerText = mvp.hits > 0 ? mvp.name : '該当者なし';
    document.getElementById('mvp-stats').innerText = mvp.hits > 0 ? `${mvp.hits} 安打` : '0安打';

    // 本塁打王
    let hrKing = { name: 'なし', hrs: 0 };
    allPlayers.forEach(p => {
        if (p.hrs > hrKing.hrs) hrKing = { name: p.name, hrs: p.hrs };
    });
    document.getElementById('hr-winner').innerText = hrKing.hrs > 0 ? hrKing.name : '該当者なし';
    document.getElementById('hr-stats').innerText = hrKing.hrs > 0 ? `${hrKing.hrs} 本塁打` : '0本塁打';

    // フルスタッツテーブルの生成
    const renderReportTable = (lineup, tbodyId) => {
        const tbody = document.getElementById(tbodyId);
        tbody.innerHTML = '';
        lineup.forEach((p, i) => {
            const avg = p.atBats > 0 ? (p.hits / p.atBats).toFixed(3) : '.000';
            const displayAvg = avg.startsWith('1') ? '1.000' : avg.substring(1);

            tbody.innerHTML += `
                <tr>
                    <td>${i + 1}</td>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.plateApps}</td>
                    <td>${p.atBats}</td>
                    <td>${p.hits}</td>
                    <td>${p.double}</td>
                    <td>${p.triple}</td>
                    <td>${p.hrs}</td>
                    <td>${p.bb}</td>
                    <td style="color: var(--primary); font-weight: bold;">${displayAvg}</td>
                </tr>
            `;
        });
    };

    renderReportTable(game.awayLineup, 'report-away-body');
    renderReportTable(game.homeLineup, 'report-home-body');

    saveData();
    renderGames(); // ホーム画面のリストを更新（ここが重要）
    switchTab('game-report-section');
}

function renderStats() {
    const game = games.find(g => g.id === activeGameId);
    
    const renderTable = (lineup, tbodyId) => {
        const tbody = document.getElementById(tbodyId);
        tbody.innerHTML = '';
        lineup.forEach((player, i) => {
            const avg = player.atBats > 0 ? (player.hits / player.atBats).toFixed(3) : '.000';
            const displayAvg = avg.startsWith('1') ? '1.000' : avg.substring(1);

            tbody.innerHTML += `
                <tr>
                    <td>${i + 1}</td>
                    <td><strong>${player.name}</strong></td>
                    <td>${player.atBats}</td>
                    <td>${player.hits}</td>
                    <td>${player.hrs}</td>
                    <td>${player.bb}</td>
                    <td style="color: var(--primary); font-weight: bold;">${displayAvg}</td>
                </tr>
            `;
        });
    };

    renderTable(game.awayLineup, 'away-stats-body');
    renderTable(game.homeLineup, 'home-stats-body');
}

function switchStatsTab(paneId, event) {
    const parent = event.target.closest('.tab-content, .report-details-card');
    parent.querySelectorAll('.stats-pane').forEach(p => p.classList.remove('active'));
    parent.querySelectorAll('.stats-tab-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(paneId).classList.add('active');
    event.currentTarget.classList.add('active');
}

function saveData() {
    localStorage.setItem('baseball_games_v5', JSON.stringify(games));
}
