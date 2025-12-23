const supabaseUrl = 'https://hysjbwysizpczgcsqvuv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5c2pid3lzaXpwY3pnY3NxdnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MjA2MTYsImV4cCI6MjA3OTQ5NjYxNn0.sLSfXMn9htsinETKUJ5IAsZ2l774rfeaNNmB7mVQcR4';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let globalData = []; 
let globalHistory = [];
let vipLists = {1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[], 9:[]};
let achieverTxtContent = "";
let sortState = {col:'joinDate', dir:'asc'};

document.addEventListener('DOMContentLoaded', async () => {
    const path = window.location.pathname;
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    
    // Inisialisasi User Asli
    if (isLoggedIn && !sessionStorage.getItem('realUserUid')) {
        sessionStorage.setItem('realUserUid', sessionStorage.getItem('userUid'));
    }

    // Redirect jika belum login
    if (!isLoggedIn && !path.includes('index.html') && !path.endsWith('/')) {
        window.location.href = 'index.html';
        return;
    }

    // LOAD DATA UNTUK SEMUA HALAMAN JIKA LOGIN
    if (isLoggedIn) {
        await loadData();
    }

    // ROUTING LOGIC
    if (path.includes('index.html') || path.endsWith('/')) {
        const btn = document.getElementById('loginButton');
        if(btn) btn.addEventListener('click', doLogin);
    } else if (path.includes('dashboard.html')) {
        renderDashboard(); 
        startCountdown();
    } else if (path.includes('list.html')) {
        prepareMyTeamData();
        initList();
    } else if (path.includes('network.html')) {
        prepareMyTeamData();
        initNetwork();
    }
});

async function loadData() {
    try {
        const { data: members, error: errMem } = await db.from('members').select('*');
        if (errMem) throw errMem;
        
        globalData = members.map(a => ({
            uid: String(a.UID || a.uid).trim(),
            name: (a.Nama || a.nama || a.name || '-').trim(),
            upline: a.Upline || a.upline ? String(a.Upline || a.upline).trim() : "",
            joinDate: new Date(a.TanggalBergabung || a.tanggalbergabung || a.joinDate)
        }));

        const { data: history, error: errHist } = await db.from('vip_history').select('*');
        if (!errHist) globalHistory = history;

    } catch (err) {
        console.error("Gagal load data:", err);
    }
}

// === FUNGSI HALAMAN LAIN (NETWORK & LIST) ===
let myTeamData = [];
function prepareMyTeamData(){
    const userUid = sessionStorage.getItem('userUid');
    const user = globalData.find(m => m.uid === userUid);
    if(user){
        myTeamData = [user, ...getDownlinesRecursive(userUid)];
    }
}

// === LOGIN SYSTEM ===
async function doLogin() {
    const uidInput = document.getElementById('loginUid').value.trim();
    const btn = document.getElementById('loginButton');
    const errText = document.getElementById('error');

    if (!uidInput) return;
    
    btn.innerText = "Loading...";
    btn.disabled = true;
    
    await loadData();
    
    const user = globalData.find(m => m.uid === uidInput);
    if (user) {
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('userUid', user.uid);
        sessionStorage.setItem('realUserUid', user.uid);
        window.location.href = 'dashboard.html';
    } else {
        errText.innerText = "UID Tidak Terdaftar";
        btn.innerText = "MASUK";
        btn.disabled = false;
    }
}

function logout() { sessionStorage.clear(); window.location.href = 'index.html'; }

// === DASHBOARD LOGIC ===
function renderDashboard() {
    if (!globalData || globalData.length === 0) return;

    const currentUid = sessionStorage.getItem('userUid');
    const realUid = sessionStorage.getItem('realUserUid'); 
    const currentUser = globalData.find(m => m.uid === currentUid);

    if (!currentUser) return logout();

    // Tombol Kembali
    const returnBtn = document.getElementById('returnToMeBtn');
    if (realUid && currentUid !== realUid) {
        returnBtn.style.display = 'block';
    } else {
        returnBtn.style.display = 'none';
    }

    document.getElementById('mName').innerText = currentUser.name;
    document.getElementById('mUid').innerText = currentUser.uid;
    
    const uplineData = globalData.find(m => m.uid === currentUser.upline);
    document.getElementById('mRefUid').innerText = uplineData ? uplineData.uid : '-';

    const downlines = getDownlinesRecursive(currentUid);
    const totalTeam = 1 + downlines.length; 
    document.getElementById('totalMembers').innerText = totalTeam;

    calculateMyRank(totalTeam, globalData.filter(m => m.upline === currentUid).length, currentUid);
    
    const teamFull = [currentUser, ...downlines];
    countVipStats(teamFull);
    renderTargetChart(totalTeam);

    // Hitung Growth
    const now = new Date();
    const d = now.getDate();
    const m = now.getMonth();
    const y = now.getFullYear();
    let startP, endP, pLabel;

    if (d <= 15) {
        startP = new Date(y, m, 1);
        endP = new Date(y, m, 15, 23, 59, 59);
        pLabel = `PERIODE 1 (${getMonthName(m)})`;
    } else {
        startP = new Date(y, m, 16);
        endP = new Date(y, m + 1, 0, 23, 59, 59);
        pLabel = `PERIODE 2 (${getMonthName(m)})`;
    }
    
    document.getElementById('currentPeriodLabel').innerText = pLabel;

    const prevCount = teamFull.filter(m => m.joinDate < startP).length;
    const newCount = teamFull.filter(m => m.joinDate >= startP && m.joinDate <= endP).length;
    const targetGrowth = Math.ceil(prevCount / 2); 
    let gap = targetGrowth - newCount;
    if (gap < 0) gap = 0;

    document.getElementById('prevPeriodCount').innerText = prevCount;
    document.getElementById('targetCount').innerText = targetGrowth;
    document.getElementById('newMemberCount').innerText = newCount;
    document.getElementById('gapCount').innerText = gap;

    renderChart(newCount, targetGrowth);
}

// === UTILS ===
function getDownlinesRecursive(uid) {
    let list = [];
    const children = globalData.filter(m => m.upline === uid);
    children.forEach(child => {
        list.push(child);
        list = list.concat(getDownlinesRecursive(child.uid));
    });
    return list;
}

function countSpecificVipInTeam(teamMembers, targetLevel) {
    let count = 0;
    for (let i = 1; i < teamMembers.length; i++) { 
        const rank = getRankLevel(teamMembers[i].uid); 
        if (rank >= targetLevel) count++;
    }
    return count;
}

function getRankLevel(uid) {
    const tm = [globalData.find(m => m.uid === uid), ...getDownlinesRecursive(uid)];
    const total = tm.length;
    const direct = globalData.filter(m => m.upline === uid).length;
    
    if (total >= 3501 && countSpecificVipInTeam(tm, 2) >= 2) return 9;
    if (total >= 1601 && countSpecificVipInTeam(tm, 2) >= 2) return 8;
    if (total >= 901 && countSpecificVipInTeam(tm, 2) >= 2) return 7;
    if (total >= 501 && countSpecificVipInTeam(tm, 2) >= 2) return 6;
    if (total >= 351 && countSpecificVipInTeam(tm, 2) >= 2) return 5;
    if (total >= 201 && countSpecificVipInTeam(tm, 2) >= 2) return 4;
    if (total >= 101 && countSpecificVipInTeam(tm, 2) >= 2) return 3;
    if (total >= 31 && countSpecificVipInTeam(tm, 1) >= 2) return 2;
    if (direct >= 5) return 1;
    return 0;
}

function calculateMyRank(totalTeam, direct, uid) {
    const myRank = getRankLevel(uid);
    document.getElementById('rankName').innerText = myRank > 0 ? `V.I.P ${myRank}` : 'MEMBER';
    
    const nextLevels = [
        { l: 1, req: '5 Direct' }, { l: 2, req: '31 Team + 2 VIP1' }, 
        { l: 3, req: '101 Team + 2 VIP2' }, { l: 4, req: '201 Team + 2 VIP2' },
        { l: 5, req: '351 Team + 2 VIP2' }, { l: 6, req: '501 Team + 2 VIP2' }
    ];
    const next = nextLevels.find(n => n.l === myRank + 1);
    document.getElementById('rankNextGoal').innerText = next ? `Target: ${next.req}` : 'Top Rank';
}

function countVipStats(teamArray) {
    for(let i=1; i<=9; i++) {
        vipLists[i] = [];
        const box = document.getElementById(`cVIP${i}`);
        const boxParent = document.getElementById(`cVIP${i}Box`);
        if(box) box.innerText = 0;
        if(boxParent) boxParent.classList.remove('new-alert');
    }

    teamArray.forEach(m => {
        const rank = getRankLevel(m.uid);
        if (rank > 0) {
            vipLists[rank].push(m);
            checkHistory(m.uid, rank).then(isNew => {
                if (isNew) {
                    const boxParent = document.getElementById(`cVIP${rank}Box`);
                    if(boxParent) boxParent.classList.add('new-alert');
                }
            });
        }
    });

    for(let i=1; i<=9; i++) {
        const box = document.getElementById(`cVIP${i}`);
        if(box) box.innerText = vipLists[i].length;
    }
}

async function checkHistory(uid, level) {
    let hist = globalHistory.find(h => h.uid === uid && h.vip_level === level);
    if (!hist) {
        const now = new Date().toISOString();
        db.from('vip_history').insert([{ uid, vip_level: level, achieved_at: now }]);
        globalHistory.push({ uid, vip_level: level, achieved_at: now });
        return true;
    }
    const achieveTime = new Date(hist.achieved_at);
    return (new Date() - achieveTime) < (24*60*60*1000);
}

function viewUpline() {
    const currentUid = sessionStorage.getItem('userUid');
    const user = globalData.find(m => m.uid === currentUid);
    if (user && user.upline && globalData.find(m => m.uid === user.upline)) {
        sessionStorage.setItem('userUid', user.upline);
        location.reload();
    } else {
        alert("Tidak ada upline atau data belum siap.");
    }
}

function returnToMyDashboard() {
    const real = sessionStorage.getItem('realUserUid');
    if (real) {
        sessionStorage.setItem('userUid', real);
        location.reload();
    }
}

// === CHART & VISUALS ===
function renderTargetChart(currentTotal) {
    const milestones = [5, 31, 101, 201, 351, 501, 901, 1601, 3501];
    let nextTarget = milestones.find(m => m > currentTotal);
    if (!nextTarget) nextTarget = Math.ceil((currentTotal + 1)/1000)*1000;
    
    document.getElementById('nextTargetNum').innerText = nextTarget;
    document.getElementById('targetGap').innerText = Math.max(0, nextTarget - currentTotal);

    const ctx = document.getElementById('targetChart').getContext('2d');
    if (window.donutChart) window.donutChart.destroy();
    window.donutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [currentTotal, nextTarget - currentTotal],
                backgroundColor: ['#D4AF37', '#222'],
                borderWidth: 0
            }]
        },
        options: { cutout: '80%', plugins: { tooltip: {enabled: false} } }
    });
}

function renderChart(growth, target) {
    const ctx = document.getElementById('growthChart').getContext('2d');
    if (window.barChart) window.barChart.destroy();
    window.barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Target', 'Actual'],
            datasets: [{
                data: [target, growth],
                backgroundColor: ['#333', '#D4AF37'],
                barThickness: 25,
                borderRadius: 4
            }]
        },
        options: { 
            maintainAspectRatio: false,
            plugins: { legend: {display: false} },
            scales: { 
                x: { grid: {display: false}, ticks: {color: '#888', font:{size:10}} }, 
                y: { display: false } 
            } 
        }
    });
}

// === MODALS & FITUR TAMBAHAN ===
window.openVipModal = function(level) {
    const modal = document.getElementById('vipModal');
    const body = document.getElementById('modalBody');
    document.getElementById('modalTitle').innerText = `DAFTAR V.I.P ${level}`;
    body.innerHTML = '';
    
    const list = vipLists[level];
    
    // SORTING: TERBARU KE TERLAMA (Berdasarkan History)
    list.sort((a, b) => {
        const histA = globalHistory.find(h => h.uid === a.uid && h.vip_level === level);
        const histB = globalHistory.find(h => h.uid === b.uid && h.vip_level === level);
        const dateA = histA ? new Date(histA.achieved_at) : new Date(a.joinDate);
        const dateB = histB ? new Date(histB.achieved_at) : new Date(b.joinDate);
        return dateB - dateA; // Descending
    });

    if (list.length === 0) {
        body.innerHTML = '<div class="v-empty">Belum ada anggota.</div>';
    } else {
        list.forEach(m => {
            const hist = globalHistory.find(h => h.uid === m.uid && h.vip_level === level);
            const dateObj = hist ? new Date(hist.achieved_at) : new Date(m.joinDate);
            
            // Format Tanggal: 24 Des 2025, 14:30
            const dateStr = dateObj.toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) + 
                            ', ' + dateObj.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});

            // Cek New Alert
            const isNew = (new Date() - dateObj) < (24*60*60*1000);
            const badge = isNew ? '🔥' : '';
            const alertClass = isNew ? 'new-name-alert' : '';

            const html = `
            <div class="v-item ${alertClass}">
                <div style="display:flex; flex-direction:column;">
                    <span class="v-n">${m.name} ${badge}</span>
                    <small style="color:#666; font-size:9px;">${dateStr}</small>
                </div>
                <span class="v-u">${m.uid}</span>
            </div>`;
            body.innerHTML += html;
        });
    }
    modal.style.display = 'flex';
}

function openAchieverModal() {
    const modal = document.getElementById('achieverModal');
    const body = document.getElementById('achieverBody');
    document.getElementById('achieverTitle').innerText = "PERAIH 50%";
    body.innerHTML = ''; 
    achieverTxtContent = "DATA PERAIH 50%\n\n";

    const currentUid = sessionStorage.getItem('userUid');
    const now = new Date();
    let startP, endP;
    if (now.getDate() <= 15) {
        startP = new Date(now.getFullYear(), now.getMonth(), 1);
        endP = new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59);
    } else {
        startP = new Date(now.getFullYear(), now.getMonth(), 16);
        endP = new Date(now.getFullYear(), now.getMonth()+1, 0, 23, 59, 59);
    }

    const myTeam = [globalData.find(m => m.uid === currentUid), ...getDownlinesRecursive(currentUid)];
    let count = 0;

    myTeam.forEach((mem) => {
        if (!mem) return;
        const memDownlines = getDownlinesRecursive(mem.uid);
        const prev = memDownlines.filter(d => d.joinDate < startP).length + 1; 
        const grow = memDownlines.filter(d => d.joinDate >= startP && d.joinDate <= endP).length;
        const target = Math.floor(prev / 2);
        const rank = getRankLevel(mem.uid);

        if (grow >= target && grow > 0 && rank >= 1) {
            count++;
            const row = `
            <div class="achiever-item">
                <div class="achiever-top">
                    <span class="v-n" style="font-size:11px;">${count}. ${mem.name}</span>
                    <span class="achiever-rank-badge">VIP ${rank}</span>
                </div>
                <div class="achiever-stats">
                    <span>Target: <b class="val-target">${target}</b></span>
                    <span>Capaian: <b class="val-actual">${grow}</b></span>
                </div>
            </div>`;
            body.innerHTML += row;
            achieverTxtContent += `${count}. ${mem.name} (VIP ${rank}) - Target: ${target}, Actual: ${grow}\n`;
        }
    });

    if (count === 0) body.innerHTML = '<div class="v-empty">Belum ada yang mencapai target.</div>';
    modal.style.display = 'flex';
}

function openBroadcastModal() {
    const total = document.getElementById('totalMembers').innerText;
    const gap = document.getElementById('gapCount').innerText;
    const timer = document.getElementById('countdownTimer').innerText;
    const date = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

    const text = `🔥 *UPDATE TIM DV NAGA PERSADA* 🔥\n\n` +
                 `📅 ${date}\n` +
                 `⏳ Sisa Waktu: ${timer}\n` +
                 `👥 Total Pasukan: *${total} Anggota*\n\n` +
                 `"Disiplin adalah jembatan antara tujuan dan pencapaian."\n\n` +
                 `🚀 *MISI KITA:* Kurang ${gap} anggota lagi untuk capai target pertumbuhan 50%!\n` +
                 `#DVTeamNP #SatuVisi #Gaspol`;
                 
    document.getElementById('broadcastText').value = text;
    document.getElementById('broadcastModal').style.display = 'flex';
}

function copyBroadcast() {
    const t = document.getElementById("broadcastText");
    t.select(); document.execCommand("copy");
    document.getElementById('broadcastModal').style.display = 'none';
}

function downloadAchieverData() {
    const blob = new Blob([achieverTxtContent], {type: 'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'achievers.txt';
    a.click();
}

window.closeVipModal = function() { document.getElementById('vipModal').style.display = 'none'; }
window.closeAchieverModal = function() { document.getElementById('achieverModal').style.display = 'none'; }

function startCountdown() {
    const timerEl = document.getElementById('countdownTimer');
    setInterval(() => {
        const now = new Date();
        let target;
        if (now.getDate() <= 15) target = new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59);
        else target = new Date(now.getFullYear(), now.getMonth()+1, 0, 23, 59, 59);
        
        const diff = target - now;
        if (diff < 0) { timerEl.innerText = "SELESAI"; return; }
        
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        timerEl.innerText = `${d}H ${h}J ${m}M`;
    }, 1000);
}

function getMonthName(m) { return ["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"][m]; }

// === FUNGSI LIST.HTML ===
function initList() {
    window.sortData = (col) => {
        if(sortState.col === col) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
        else { sortState.col = col; sortState.dir = 'asc'; }
        renderTable();
    };
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('membersTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const {col, dir} = sortState;
    const sorted = [...myTeamData].sort((a,b) => {
        let valA = a[col] || '', valB = b[col] || '';
        if(col === 'joinDate') { valA = new Date(valA); valB = new Date(valB); }
        else { valA = valA.toString().toLowerCase(); valB = valB.toString().toLowerCase(); }
        
        if(valA < valB) return dir === 'asc' ? -1 : 1;
        if(valA > valB) return dir === 'asc' ? 1 : -1;
        return 0;
    });

    sorted.forEach((m, i) => {
        const dateStr = new Date(m.joinDate).toLocaleDateString('id-ID');
        tbody.innerHTML += `<tr>
            <td class="col-no">${i+1}</td>
            <td class="col-name">${m.name}</td>
            <td class="col-uid">${m.uid}</td>
            <td class="col-ref">${m.upline}</td>
            <td class="col-date">${dateStr}</td>
        </tr>`;
    });
}

// === FUNGSI NETWORK.HTML ===
function initNetwork() {
    const $ = go.GraphObject.make;
    const diagram = $(go.Diagram, "networkDiagram", {
        padding: 50,
        layout: $(go.TreeLayout, { angle: 90, layerSpacing: 50 }),
        "undoManager.isEnabled": true,
        initialContentAlignment: go.Spot.Center
    });

    diagram.nodeTemplate = $(go.Node, "Auto",
        $(go.Shape, "RoundedRectangle", { fill: "#111", stroke: "#D4AF37", strokeWidth: 2 }),
        $(go.TextBlock, { margin: 8, stroke: "white", font: "bold 12px sans-serif" },
          new go.Binding("text", "label"))
    );

    diagram.linkTemplate = $(go.Link, 
        { routing: go.Link.Orthogonal, corner: 5 },
        $(go.Shape, { strokeWidth: 1.5, stroke: "#666" })
    );

    const nodes = myTeamData.map(m => ({ 
        key: m.uid, 
        label: `${m.name}\n(${m.uid})` 
    }));
    
    const links = myTeamData.filter(m => m.upline && m.upline !== "").map(m => ({ from: m.upline, to: m.uid }));

    diagram.model = new go.GraphLinksModel(nodes, links);
    
    window.downloadNetworkImage = function() {
        const img = diagram.makeImage({ scale: 2, background: "#000" });
        const a = document.createElement('a');
        a.href = img.src;
        a.download = 'jaringan.png';
        a.click();
    };
}
