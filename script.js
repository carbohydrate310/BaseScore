// アプリ全体のローカルステート
let games = JSON.parse(localStorage.getItem('baseball_games_v2')) || [];
let activeGameId = null;

// 打順トラッカー (先攻1~9, 後攻1~9番打者のインデックス)
let currentBatterIndex = { away: 0, home: 0 };
let currentInningTeam = 'away'; // 現在攻撃中のチーム ('away' or 'home')

document.addEventListener('DOMContentLoaded', () => {
    updateDate();
    renderGames();
    generateBattingOrderInputs();
});

function updateDate() {
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    document.getElementById('current-date').innerText = today.toLocaleDateString('ja-JP', options);
}

// タブ切り替えシステム
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    // ナビボタンのハイライト同期
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const matchedBtn = Array.from(document.querySelectorAll('.nav-btn')).find(btn => btn.getAttribute('onclick').includes(tabId));
    if (matchedBtn) matchedBtn.classList.add('active');
}

// 試合追加処理
document.getElementById('game-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const date = document.getElementById('game-date').value;
    const home = document.getElementById('home-team').value;
    const away = document.getElementById('away-team').value;

    const newGame = {
        id: Date.now(),
        date,
        home,
        away,
        homePitcher: 'ピッチャーA',
        awayPitcher: 'ピッチャーB',
        // 初期スタメンテンプレート
        awayLineup: Array.from({length: 9}, (_, i) => ({ name: `先攻打者${i+1}`, atBats: 0, hits: 0, hrs: 0, bb: 0 })),
        homeLineup: Array.from({length: 9}, (_, i) => ({ name: `後攻打者${i+1}`, atBats: 0, hits: 0, hrs: 0, bb: 0 })),
        bench: ""
    };

    games.push(newGame);
    saveData();
    renderGames();
    document.getElementById('game-form').reset();
    switchTab('home');
});

// ホームの試合一覧描画
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
        gameCard.innerHTML = `
            <button class="delete-game-btn" onclick="event.stopPropagation(); deleteGame(${game.id})">削除</button>
            <div onclick="openGameManager(${game.id})">
                <span class="card-date">${game.date}</span>
                <div class="card-teams">
                    <span>${game.away}</span>
                    <span class="card-versus">VS</span>
                    <span>${game.home}</span>
                </div>
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

// メンバー入力フィールド（1~9番）を自動生成
function generateBattingOrderInputs() {
    const awayContainer = document.getElementById('away-batting-inputs');
    const homeContainer = document.getElementById('home-batting-inputs');
    awayContainer.innerHTML = '';
    homeContainer.innerHTML = '';

    for (let i = 1; i <= 9; i++) {
        awayContainer.innerHTML += `
            <div class="order-row">
                <span class="order-num">${i}番</span>
                <input type="text" id="away-b-${i}" placeholder="打者${i}">
            </div>`;
        homeContainer.innerHTML += `
            <div class="order-row">
                <span class="order-num">${i}番</span>
                <input type="text" id="home-b-${i}" placeholder="打者${i}">
            </div>`;
    }
}

// ３．試合管理・メンバー登録画面を開く
function openGameManager(gameId) {
    activeGameId = gameId;
    const game = games.find(g => g.id === gameId);

    document.getElementById('manage-game-date').innerText = game.date;
    document.getElementById('manage-away').innerText = game.away;
    document.getElementById('manage-home').innerText = game.home;
    document.getElementById('setup-away-title').innerText = `先攻: ${game.away}`;
    document.getElementById('setup-home-title').innerText = `後攻: ${game.home}`;

    // 入力フォームに現在の値をセット
    document.getElementById('member-away-pitcher').value = game.awayPitcher;
    document.getElementById('member-home-pitcher').value = game.homePitcher;
    document.getElementById('bench-members').value = game.bench || '';

    for (let i = 1; i <= 9; i++) {
        document.getElementById(`away-b-${i}`).value = game.awayLineup[i-1].name;
        document.getElementById(`home-b-${i}`).value = game.homeLineup[i-1].name;
    }

    switchTab('game-manager');
}

// メンバーを決定して結果入力へ移行
function proceedToScoreInput() {
    const game = games.find(g => g.id === activeGameId);

    // 画面のデータをオブジェクトに回収
    game.awayPitcher = document.getElementById('member-away-pitcher').value;
    game.homePitcher = document.getElementById('member-home-pitcher').value;
    game.bench = document.getElementById('bench-members').value;

    for (let i = 1; i <= 9; i++) {
        game.awayLineup[i-1].name = document.getElementById(`away-b-${i}`).value;
        game.homeLineup[i-1].name = document.getElementById(`home-b-${i}`).value;
    }

    saveData();
    updateScoreInputUI();
    switchTab('score-input-section');
}

function backToManager() {
    switchTab('game-manager');
}

// ４．結果入力画面の更新
function updateScoreInputUI() {
    const game = games.find(g => g.id === activeGameId);
    
    // 現在の打撃チーム、打者、相手投手を特定
    const isAwayActive = currentInningTeam === 'away';
    const lineup = isAwayActive ? game.awayLineup : game.homeLineup;
    const idx = isAwayActive ? currentBatterIndex.away : currentBatterIndex.home;
    const currentBatter = lineup[idx];
    const opponentPitcher = isAwayActive ? game.homePitcher : game.awayPitcher;

    // UIへ繁栄
    document.getElementById('current-batter-team').innerText = isAwayActive ? game.away : game.home;
    document.getElementById('current-batter-name').innerText = currentBatter.name;
    document.getElementById('current-batter-order').innerText = `${idx + 1}番打者`;
    document.getElementById('current-opponent-pitcher').innerText = opponentPitcher;

    renderStats();
}

// 打席結果の記録
function recordAtBat(resultType) {
    const game = games.find(g => g.id === activeGameId);
    const isAwayActive = currentInningTeam === 'away';
    const lineup = isAwayActive ? game.awayLineup : game.homeLineup;
    const idx = isAwayActive ? currentBatterIndex.away : currentBatterIndex.home;
    const batter = lineup[idx];

    // 成績の加算ロジック
    if (resultType === 'single' || resultType === 'double' || resultType === 'triple' || resultType === 'hr') {
        batter.atBats += 1;
        batter.hits += 1;
        if (resultType === 'hr') batter.hrs += 1;
    } else if (resultType === 'strikeout' || resultType === 'out') {
        batter.atBats += 1;
    } else if (resultType === 'walk') {
        batter.bb += 1;
    }

    // 次の打者に送る
    if (isAwayActive) {
        currentBatterIndex.away = (currentBatterIndex.away + 1) % 9;
    } else {
        currentBatterIndex.home = (currentBatterIndex.home + 1) % 9;
    }

    // 攻守交代の簡易疑似イベント（1周したらチェンジする等お好みで。ここでは交互でも打撃可能にしています）
    // 実運用に合わせ、打順は順次繰り上がりループします。

    saveData();
    updateScoreInputUI();
}

// ５．個人スタッツ（打率等）の表示
function renderStats() {
    const game = games.find(g => g.id === activeGameId);
    
    const renderTable = (lineup, tbodyId) => {
        const tbody = document.getElementById(tbodyId);
        tbody.innerHTML = '';
        lineup.forEach((player, i) => {
            // 打率 = 安打 / 打数
            const avg = player.atBats > 0 ? (player.hits / player.atBats).toFixed(3) : '.000';
            const displayAvg = avg.startsWith('1') ? '1.000' : avg.substring(1); // 「0.300」を「.300」表記にする野球風ルール

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

// スタッツ内の先攻・後攻タブ切り替え
function switchStatsTab(paneId) {
    document.querySelectorAll('.stats-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.stats-tab-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(paneId).classList.add('active');
    event.currentTarget.classList.add('active');
}

function saveData() {
    localStorage.setItem('baseball_games_v2', JSON.stringify(games));
}
