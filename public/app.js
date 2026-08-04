// 1. KẾT NỐI SUPABASE
const SUPABASE_URL = 'https://wtvoatrmrakatuxyukox.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0dm9hdHJtcmFrYXR1eHl1a294Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MjU3OTMsImV4cCI6MjEwMTQwMTc5M30.eYsaZBCHFmEPD7Rkr_PukOhhzLmYJsUBoNN17EMAo6U';

// Khởi tạo Supabase client từ CDN
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Đường dẫn gọi API (để trống vì chạy chung 1 server Node.js)
const API_URL = ''; 

// Các hằng số cũ
const ADMIN_PASS = "admin123";
const CANDIDATE_STORAGE = "HB3_GUITAR_CANDIDATES_MERGED_V2";
const MEMBER_STORAGE = "HB3_GUITAR_MEMBERS_MERGED";

const syncChannel = new BroadcastChannel('HB3_GUITAR_SYNC_CHANNEL');

let candidateList = [];
let memberList = [];
let mediaList = [];
let currentPhotoBase64 = "";
let currentRegMemberPhotoBase64 = "";
let currentLookupCandidateId = null;
let currentLookupMemberId = null;

// ==========================================
// TÍNH NĂNG ĐĂNG NHẬP / ĐĂNG KÝ
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
    checkSession();
});

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        document.getElementById('auth-modal').classList.add('hidden');
        document.getElementById('user-display-email').innerText = "Tài khoản: " + session.user.email;
        loadInitialData();
        switchTab('home');
    } else {
        document.getElementById('auth-modal').classList.remove('hidden');
    }
}

function toggleAuthMode(mode) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const btnLogin = document.getElementById('btn-show-login');
    const btnRegister = document.getElementById('btn-show-register');

    if (mode === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        btnLogin.className = "flex-1 py-2 rounded-lg text-sm font-bold bg-white text-slate-800 shadow-sm transition-all";
        btnRegister.className = "flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 transition-all hover:text-slate-800";
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        btnRegister.className = "flex-1 py-2 rounded-lg text-sm font-bold bg-white text-slate-800 shadow-sm transition-all";
        btnLogin.className = "flex-1 py-2 rounded-lg text-sm font-bold text-slate-500 transition-all hover:text-slate-800";
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng nhập...`;
    
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: email, password: pass });
    
    if (error) {
        alert("Lỗi: Sai email hoặc mật khẩu!");
        btn.innerHTML = `Đăng Nhập`;
    } else {
        checkSession();
    }
}

async function handleRegisterUser(e) {
    e.preventDefault();
    const email = document.getElementById('reg-user-email').value;
    const pass = document.getElementById('reg-user-password').value;
    const confirmPass = document.getElementById('reg-user-confirm').value;
    const btn = document.getElementById('reg-btn');

    if (pass !== confirmPass) {
        alert("Lỗi: Hai mật khẩu không khớp nhau!");
        return;
    }

    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo...`;

    const { data, error } = await supabaseClient.auth.signUp({ email: email, password: pass });

    if (error) {
        alert("Lỗi đăng ký: " + error.message);
        btn.innerHTML = `Tạo Tài Khoản`;
    } else {
        alert("Đăng ký thành công! Hãy đăng nhập ngay.");
        document.getElementById('register-form').reset();
        toggleAuthMode('login');
        btn.innerHTML = `Tạo Tài Khoản`;
    }
}

async function handleLogout() {
    if (confirm("Bạn muốn đăng xuất khỏi hệ thống?")) {
        await supabaseClient.auth.signOut();
        location.reload(); 
    }
}

async function forgotPassword() {
    const email = prompt("Nhập Email bạn đã đăng ký để lấy lại mật khẩu:");
    if (!email) return;

    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email);
    if (error) {
        alert("Lỗi: " + error.message);
    } else {
        alert("Thành công! Một email khôi phục mật khẩu đã được gửi đến hộp thư của bạn.");
    }
}

// ==========================================
// THƯ VIỆN MEDIA
// ==========================================
async function loadMedia() {
    try {
        const res = await fetch(`${API_URL}/api/media`);
        mediaList = await res.json();
        renderMedia();
    } catch (err) { console.log("Lỗi tải media", err); }
}

async function handleMediaUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const btn = event.target.nextElementSibling;
    const oldText = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...`;
    btn.classList.add('opacity-70', 'pointer-events-none');

    for (let file of files) {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: formData });
            const result = await res.json();
            if (result.success) {
                mediaList.unshift(result.data);
                renderMedia();
            }
        } catch (err) { alert("Lỗi tải lên: " + file.name); }
    }
    btn.innerHTML = oldText;
    btn.classList.remove('opacity-70', 'pointer-events-none');
    event.target.value = '';
}

function renderMedia() {
    const container = document.getElementById('media-gallery-container');
    if (!container) return;
    container.innerHTML = '';
    
    if (mediaList.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
                <i class="fa-solid fa-cloud-arrow-up text-5xl text-slate-300 mb-3"></i>
                <p class="text-slate-500 font-medium">Chưa có dữ liệu Media.</p>
            </div>`;
        return;
    }

    mediaList.forEach(item => {
        const div = document.createElement('div');
        div.className = 'media-item group';
        if (item.type === 'video') {
            div.innerHTML = `
                <video src="${item.url}" class="w-full h-full object-cover" controls preload="metadata"></video>
                <div class="absolute top-3 left-3 bg-black/60 text-white text-[10px] uppercase font-bold px-2 py-1 rounded backdrop-blur"><i class="fa-solid fa-play"></i> VIDEO</div>
                <button onclick="deleteMedia('${item.id}')" class="delete-media-btn"><i class="fa-solid fa-trash text-sm"></i></button>`;
        } else {
            div.innerHTML = `
                <img src="${item.url}" onclick="viewMediaFull('${item.url}')" class="cursor-pointer">
                <button onclick="deleteMedia('${item.id}')" class="delete-media-btn"><i class="fa-solid fa-trash text-sm"></i></button>`;
        }
        container.appendChild(div);
    });
}

async function deleteMedia(id) {
    if (confirm("Xóa file này khỏi thư viện?")) {
        await fetch(`${API_URL}/api/media/${id}`, { method: 'DELETE' });
        mediaList = mediaList.filter(item => item.id !== id);
        renderMedia();
    }
}

function viewMediaFull(src) {
    const w = window.open("");
    w.document.write(`<body style="margin:0; background:#000; display:flex; align-items:center; justify-content:center; height:100vh;"><img src="${src}" style="max-width:100%; max-height:100%; object-fit:contain; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);"></body>`);
}

// ==========================================
// TÍNH NĂNG QUẢN LÝ DỮ LIỆU CLB
// ==========================================

syncChannel.onmessage = (event) => {
    if (event.data && event.data.type === 'DATA_UPDATED') {
        loadInitialData();
        updateReappealBadges();
        if (!document.getElementById('admin-modal').classList.contains('hidden')) {
            renderAdminCandidates();
            renderAdminReappeals();
            renderAdminMembers();
        }
    }
};

window.addEventListener('storage', (e) => {
    if (e.key === CANDIDATE_STORAGE || e.key === MEMBER_STORAGE) {
        loadInitialData();
        updateReappealBadges();
        if (!document.getElementById('admin-modal').classList.contains('hidden')) {
            renderAdminCandidates();
            renderAdminReappeals();
            renderAdminMembers();
        }
    }
});

function loadInitialData() {
    loadMedia();
    try {
        const cData = localStorage.getItem(CANDIDATE_STORAGE);
        if (cData) { candidateList = JSON.parse(cData); } 
        else {
            candidateList = [{ id: "HB202601", fullname: "Nguyễn Hoàng Nam", dob: "2008-05-12", gender: "Nam", school: "THPT Hồng Bàng", classroom: "11A1", phone: "0901234567", email: "namhn@gmail.com", photo: "", subjects: ["Lý thuyết âm nhạc", "Guitar cổ điển"], sbd: "CGC-101", rooms: { "Lý thuyết âm nhạc": "P.101", "Guitar cổ điển": "P.102" }, scores: { "Lý thuyết âm nhạc": "9.5", "Guitar cổ điển": "9.0" }, dtb: "9.25", phuctra: "Không", phuctraStatus: "Chưa phúc tra", phuctraHistory: [], status: "ĐỦ", rank: "CHÍNH THỨC" }];
            saveCandidates(false);
        }

        const mData = localStorage.getItem(MEMBER_STORAGE);
        if (mData) { memberList = JSON.parse(mData); } 
        else {
            memberList = [{ id: "HB202401", fullname: "Nguyễn Hoàng Nam", dob: "2008-05-12", gender: "Nam", classroom: "11A1", schoolclub: "CLB Guitar Cổ Điển", role: "Chủ nhiệm", phone: "0901234567", email: "namhn@gmail.com", instruments: "Guitar Cổ Điển, Fingerstyle", joindate: "2024-09-05", examdate: "2024-08-20", photo: "", activities: [{ date: "2024-09-05", content: "Chính thức gia nhập CLB Guitar Hồng Bàng." }, { date: "2024-11-20", content: "Tham gia biểu diễn văn nghệ chào mừng Ngày Nhà giáo VN." }] }];
            saveMembers(false);
        }
    } catch (err) {}
}

function saveCandidates(broadcast = true) {
    localStorage.setItem(CANDIDATE_STORAGE, JSON.stringify(candidateList));
    updateReappealBadges();
    if (!document.getElementById('admin-modal').classList.contains('hidden')) { renderAdminCandidates(); renderAdminReappeals(); }
    if (broadcast) syncChannel.postMessage({ type: 'DATA_UPDATED' });
}

function saveMembers(broadcast = true) {
    localStorage.setItem(MEMBER_STORAGE, JSON.stringify(memberList));
    if (!document.getElementById('admin-modal').classList.contains('hidden')) { renderAdminMembers(); }
    if (broadcast) syncChannel.postMessage({ type: 'DATA_UPDATED' });
}

function updateReappealBadges() {
    const pendingCount = candidateList.filter(c => c.phuctraStatus === 'Đang chờ').length;
    const badgeNav = document.getElementById('nav-badge-count'); const badgeBtn = document.getElementById('btn-badge-count'); const badgeReappeal = document.getElementById('reappeal-badge-count');
    if (pendingCount > 0) {
        if (badgeNav) { badgeNav.innerText = pendingCount; badgeNav.classList.remove('hidden'); }
        if (badgeBtn) { badgeBtn.innerText = `${pendingCount} đơn mới`; badgeBtn.classList.remove('hidden'); }
        if (badgeReappeal) { badgeReappeal.innerText = pendingCount; badgeReappeal.classList.remove('hidden'); }
    } else {
        if (badgeNav) badgeNav.classList.add('hidden');
        if (badgeBtn) badgeBtn.classList.add('hidden');
        if (badgeReappeal) badgeReappeal.classList.add('hidden');
    }
}

function switchTab(tabName) {
    ['tab-home', 'tab-register', 'tab-lookup', 'tab-member-book', 'tab-register-book', 'tab-gallery'].forEach(t => { const el = document.getElementById(t); if(el) el.classList.add('hidden'); });
    ['home', 'register', 'lookup', 'member-book', 'register-book', 'gallery'].forEach(t => { 
        const btn = document.getElementById(`btn-tab-${t}`); 
        if (btn) { btn.classList.remove('bg-slate-100', 'text-slate-900', 'active'); btn.classList.add('text-slate-600'); }
    });
    const tTab = document.getElementById(`tab-${tabName}`); 
    if(tTab) {
        tTab.classList.remove('hidden');
        tTab.classList.remove('tab-content');
        void tTab.offsetWidth;
        tTab.classList.add('tab-content');
    }
    const tBtn = document.getElementById(`btn-tab-${tabName}`); if(tBtn) { tBtn.classList.remove('text-slate-600'); tBtn.classList.add('bg-slate-100', 'text-slate-900', 'active'); }
    document.getElementById('book-form-container').classList.add('hidden');
    document.getElementById('print-area').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentPhotoBase64 = e.target.result; document.getElementById('avatar-preview').src = currentPhotoBase64;
            document.getElementById('avatar-preview').classList.remove('hidden'); document.getElementById('avatar-placeholder').classList.add('hidden');
        }; reader.readAsDataURL(file);
    }
}

function previewRegisterMemberImage(event) {
    const file = event.target.files[0];
    if (file) { const reader = new FileReader(); reader.onload = function(e) { currentRegMemberPhotoBase64 = e.target.result; }; reader.readAsDataURL(file); }
}

function toggleSubmitBtn() {
    const isChecked = document.getElementById('commitment-check').checked; const btn = document.getElementById('submitBtn');
    if (isChecked) { btn.disabled = false; btn.className = "w-full sm:w-auto bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"; } 
    else { btn.disabled = true; btn.className = "w-full sm:w-auto bg-slate-300 text-white font-bold py-3.5 px-8 rounded-xl shadow transition-all flex items-center justify-center gap-2 text-sm cursor-not-allowed"; }
}

function validateSubjectSelection() {}

function handleRegister(e) {
    e.preventDefault();
    const optSubject = document.querySelector('input[name="optional-subject"]:checked');
    if (!optSubject) { alert('Vui lòng chọn 1 trong 3 môn còn lại!'); return; }
    const candidateData = {
        id: 'HB' + Date.now().toString().slice(-6), fullname: document.getElementById('fullname').value.trim(), dob: document.getElementById('dob').value, gender: document.getElementById('gender').value, school: document.getElementById('school').value.trim(), classroom: document.getElementById('classroom').value.trim(), phone: document.getElementById('phone').value.trim(), email: document.getElementById('email').value.trim(), photo: currentPhotoBase64, subjects: ["Lý thuyết âm nhạc", optSubject.value], sbd: '', rooms: {}, scores: {}, dtb: '', phuctra: 'Không', phuctraStatus: 'Chưa phúc tra', phuctraHistory: [], status: 'Chưa xét', rank: ''
    };
    candidateList.push(candidateData); saveCandidates(true);
    alert(`Đăng ký dự tuyển thành công!\nMã phiếu của bạn là: ${candidateData.id}`); renderPrintCard(candidateData, false);
}

function handleRegisterMemberBook(e) {
    e.preventDefault();
    const newMember = {
        id: 'HB' + Date.now().toString().slice(-6), fullname: document.getElementById('reg-m-fullname').value.trim(), dob: document.getElementById('reg-m-dob').value, gender: document.getElementById('reg-m-gender').value, classroom: document.getElementById('reg-m-classroom').value.trim(), schoolclub: document.getElementById('reg-m-schoolclub').value.trim(), role: 'Thành viên', phone: document.getElementById('reg-m-phone').value.trim(), email: document.getElementById('reg-m-email').value.trim(), instruments: document.getElementById('reg-m-instruments').value.trim(), joindate: document.getElementById('reg-m-joindate').value, examdate: document.getElementById('reg-m-examdate').value, photo: currentRegMemberPhotoBase64, activities: [{ date: document.getElementById('reg-m-joindate').value, content: "Chính thức lập sổ thành viên CLB." }]
    };
    memberList.push(newMember); saveMembers(true);
    alert(`Đăng ký lập sổ thành công!\nMã số thành viên: ${newMember.id}`); document.getElementById('registerMemberForm').reset(); switchTab('member-book');
}

function hasScores(c) { if (!c || !c.scores) return false; let vals = Object.values(c.scores); if (vals.length === 0) return false; return vals.some(v => v !== '' && v !== null && v !== undefined); }

function calculateDTB(scoresObj, subjectsArr) {
    if (!scoresObj || !subjectsArr || subjectsArr.length === 0) return "";
    let sum = 0; let count = 0;
    subjectsArr.forEach(sub => { let val = parseFloat(scoresObj[sub]); if (!isNaN(val)) { sum += val; count++; } });
    if (count === 0) return ""; return (sum / count).toFixed(2);
}

function renderPrintCard(data, isFromAdmin = false) {
    document.getElementById('p-card-id').innerText = data.id || ''; document.getElementById('p-fullname').innerText = data.fullname || ''; document.getElementById('p-dob').innerText = data.dob || ''; document.getElementById('p-gender').innerText = data.gender || ''; document.getElementById('p-school').innerText = data.school || ''; document.getElementById('p-classroom').innerText = data.classroom || ''; document.getElementById('p-phone').innerText = data.phone || ''; document.getElementById('p-email').innerText = data.email || '';
    if (data.photo) { document.getElementById('p-photo').src = data.photo; document.getElementById('p-photo').classList.remove('hidden'); document.getElementById('p-photo-txt').classList.add('hidden'); } else { document.getElementById('p-photo').classList.add('hidden'); document.getElementById('p-photo-txt').classList.remove('hidden'); }
    const subListEl = document.getElementById('p-subjects-list'); subListEl.innerHTML = '';
    const subs = data.subjects || []; subs.forEach(s => { const p = document.createElement('p'); p.innerHTML = `<span class="font-bold text-amber-900">[X]</span> ${s}`; subListEl.appendChild(p); });
    document.getElementById('p-sbd').innerText = data.sbd || '';
    const roomsPrint = document.getElementById('p-rooms-print-container'); roomsPrint.innerHTML = '';
    subs.forEach(s => { const p = document.createElement('p'); let rVal = data.rooms && data.rooms[s] ? data.rooms[s] : ''; p.innerHTML = `<strong>Phòng thi ${s}:</strong> <span>${rVal}</span>`; roomsPrint.appendChild(p); });
    const scoresPrint = document.getElementById('p-scores-print-container'); scoresPrint.innerHTML = '';
    subs.forEach(s => { const div = document.createElement('div'); let scVal = data.scores && data.scores[s] !== undefined && data.scores[s] !== '' ? data.scores[s] : ''; div.innerHTML = `<strong>Điểm ${s}:</strong> <p>${scVal}</p>`; scoresPrint.appendChild(div); });
    const currentDTB = calculateDTB(data.scores, subs); document.getElementById('p-dtb').innerText = currentDTB !== '' ? currentDTB : '';
    const conclusionContainer = document.getElementById('p-conclusion-container'); const rankContainer = document.getElementById('p-rank-container');
    if (hasScores(data) && data.status && data.status !== 'Chưa xét') {
        conclusionContainer.classList.remove('hidden');
        if (data.status === 'ĐỦ') { document.getElementById('p-conclusion').innerHTML = `<span class="text-emerald-600 font-bold uppercase">ĐỦ</span> điều kiện trở thành thành viên`; rankContainer.classList.remove('hidden'); document.getElementById('p-rank').innerHTML = `<span class="font-bold uppercase">${data.rank || 'CHÍNH THỨC'}</span>`; } 
        else if (data.status === 'KHÔNG ĐỦ') { document.getElementById('p-conclusion').innerHTML = `<span class="text-rose-600 font-bold uppercase">KHÔNG ĐỦ</span> điều kiện`; rankContainer.classList.add('hidden'); } 
        else { conclusionContainer.classList.add('hidden'); rankContainer.classList.add('hidden'); }
    } else { conclusionContainer.classList.add('hidden'); rankContainer.classList.add('hidden'); }
    const printHistoryContainer = document.getElementById('p-phuctra-history-print'); printHistoryContainer.innerHTML = ''; const history = data.phuctraHistory || [];
    if (history.length === 0) { printHistoryContainer.innerHTML = `<p class="text-slate-500">Chưa có thông tin / Yêu cầu phúc tra.</p>`; } else { history.forEach((h, idx) => { const div = document.createElement('div'); div.className = "mb-1 pb-1 border-b border-slate-200 last:border-b-0"; div.innerHTML = `<p><strong>Lần ${idx + 1} (${h.date}):</strong> ${h.content}</p><p class="text-amber-900"><strong>Phản hồi (${h.status}):</strong> ${h.response || 'Chưa phản hồi'}</p>`; printHistoryContainer.appendChild(div); }); }
    ['tab-home', 'tab-register', 'tab-lookup', 'tab-member-book', 'tab-register-book', 'tab-gallery', 'book-form-container'].forEach(id => { const el = document.getElementById(id); if(el) el.classList.add('hidden'); }); document.getElementById('print-area').classList.remove('hidden');
}

function closePrintCard() { document.getElementById('print-area').classList.add('hidden'); switchTab('lookup'); }

function searchCandidate() {
    loadInitialData(); const keyword = document.getElementById('lookup-keyword').value.trim().toLowerCase(); const msgDiv = document.getElementById('lookup-result-msg'); const cardDetail = document.getElementById('lookup-card-detail');
    if (!keyword) { alert('Vui lòng nhập Mã phiếu, SĐT hoặc Email!'); return; }
    const found = candidateList.find(c => String(c.id).toLowerCase() === keyword || String(c.phone).toLowerCase() === keyword || String(c.email).toLowerCase() === keyword);
    if (found) {
        currentLookupCandidateId = found.id; msgDiv.classList.add('hidden'); document.getElementById('lk-id').innerText = found.id; document.getElementById('lk-fullname').innerText = found.fullname; document.getElementById('lk-sbd').innerText = found.sbd || 'Chưa cấp SBD'; document.getElementById('lk-classroom').innerText = found.classroom; document.getElementById('lk-subjects').innerText = (found.subjects || []).join(', ');
        const rBadge = document.getElementById('lk-rank-badge'); const tag = document.getElementById('lk-score-status-tag'); const conclusionBox = document.getElementById('lk-conclusion-box'); const rankBox = document.getElementById('lk-rank-box'); const phuctraSec = document.getElementById('phuctra-section');
        const roomsScoresContainer = document.getElementById('lk-rooms-scores-container'); roomsScoresContainer.innerHTML = ''; const subs = found.subjects || [];
        subs.forEach(s => { const rVal = found.rooms && found.rooms[s] ? found.rooms[s] : 'Chưa xếp'; const scVal = found.scores && found.scores[s] !== undefined && found.scores[s] !== '' ? found.scores[s] : '-'; const div = document.createElement('div'); div.className = "p-4 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center shadow-sm"; div.innerHTML = `<div><strong class="text-slate-800 block">${s}</strong><span class="text-xs text-slate-500">Phòng thi: <strong class="text-amber-600">${rVal}</strong></span></div><div class="text-right"><span class="text-xs text-slate-400 block">Điểm số</span><span class="font-extrabold text-slate-800 text-xl">${scVal}</span></div>`; roomsScoresContainer.appendChild(div); });
        const dtbVal = calculateDTB(found.scores, subs); document.getElementById('lk-dtb').innerText = dtbVal !== '' ? dtbVal : 'Chưa có';
        if (!hasScores(found)) { conclusionBox.classList.add('hidden'); rankBox.classList.add('hidden'); rBadge.classList.add('hidden'); tag.innerText = "(Chưa công bố điểm)"; phuctraSec.classList.add('hidden'); } 
        else if (!found.status || found.status === 'Chưa xét') { conclusionBox.classList.remove('hidden'); document.getElementById('lk-conclusion').innerHTML = `<span class="text-slate-600 font-bold uppercase">chưa công bố</span>`; rankBox.classList.add('hidden'); rBadge.classList.add('hidden'); tag.innerText = "(Đã có điểm - Chờ kết luận)"; phuctraSec.classList.remove('hidden'); } 
        else {
            tag.innerText = "(Đã công bố kết quả)"; phuctraSec.classList.remove('hidden'); conclusionBox.classList.remove('hidden');
            if (found.status === 'ĐỦ') { document.getElementById('lk-conclusion').innerHTML = `<span class="text-emerald-600 font-bold uppercase"><i class="fa-solid fa-circle-check"></i> ĐỦ điều kiện</span>`; document.getElementById('lk-rank').innerHTML = `<span class="font-bold uppercase">${found.rank || 'CHÍNH THỨC'}</span>`; rankBox.classList.remove('hidden'); rBadge.innerText = found.rank || 'CHÍNH THỨC'; rBadge.className = "px-5 py-2 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"; rBadge.classList.remove('hidden'); } 
            else { document.getElementById('lk-conclusion').innerHTML = `<span class="text-rose-600 font-bold uppercase"><i class="fa-solid fa-circle-xmark"></i> KHÔNG ĐỦ điều kiện</span>`; rankBox.classList.add('hidden'); rBadge.innerText = 'KHÔNG ĐỦ'; rBadge.className = "px-5 py-2 rounded-xl text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200"; rBadge.classList.remove('hidden'); }
        }
        const historyBox = document.getElementById('lookup-reappeal-history-container'); const historyList = document.getElementById('lookup-reappeal-history-list'); historyList.innerHTML = ''; const historyArr = found.phuctraHistory || [];
        if (historyArr.length > 0) {
            historyBox.classList.remove('hidden');
            historyArr.forEach((item, index) => {
                let statusColor = item.status === 'Đã duyệt' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : (item.status === 'Từ chối' ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-amber-100 text-amber-800 border-amber-200');
                const div = document.createElement('div'); div.className = "p-4 bg-white border border-slate-100 rounded-2xl text-xs space-y-2 shadow-sm";
                div.innerHTML = `<div class="flex justify-between items-center border-b border-slate-100 pb-2"><span class="font-bold text-slate-700">Lần ${index + 1} - Gửi ngày: ${item.date}</span><span class="px-3 py-1 rounded-lg font-bold border text-[10px] uppercase ${statusColor}">${item.status}</span></div><p class="text-slate-600"><strong>Yêu cầu:</strong> ${item.content}</p>${item.response ? `<p class="text-amber-900 bg-amber-50 p-3 rounded-xl border border-amber-100 mt-2"><strong>Phản hồi BCN:</strong> ${item.response}</p>` : `<p class="text-slate-400 italic mt-2">Đang chờ Ban Chủ Nhiệm phản hồi...</p>`}`;
                historyList.appendChild(div);
            });
        } else { historyBox.classList.add('hidden'); }
        cardDetail.classList.remove('hidden');
    } else {
        cardDetail.classList.add('hidden'); msgDiv.innerHTML = `<div class="bg-rose-50 text-rose-600 p-4 rounded-xl border border-rose-200 font-bold inline-block"><i class="fa-solid fa-triangle-exclamation"></i> Không tìm thấy hồ sơ!</div>`; msgDiv.classList.remove('hidden');
    }
}

function togglePhucTraForm() {
    const box = document.getElementById('phuctra-form-box');
    if (box.classList.contains('hidden')) {
        const candidate = candidateList.find(c => String(c.id) === String(currentLookupCandidateId)); if (!candidate) return;
        const container = document.getElementById('phuctra-checkbox-subjects'); container.innerHTML = '';
        (candidate.subjects || []).forEach(sub => { const label = document.createElement('label'); label.className = "flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-amber-400 transition-colors"; label.innerHTML = `<input type="checkbox" name="phuctra-sub" value="${sub}" class="w-4 h-4 rounded text-amber-800 accent-amber-600"> <span>${sub}</span>`; container.appendChild(label); });
        document.getElementById('phuctra-content-input').value = ''; box.classList.remove('hidden');
    } else { box.classList.add('hidden'); }
}

function handleSubmitPhucTra(e) {
    e.preventDefault(); const checkedSubs = Array.from(document.querySelectorAll('input[name="phuctra-sub"]:checked')).map(el => el.value);
    if (checkedSubs.length === 0) { alert('Vui lòng chọn ít nhất 1 môn xin phúc tra!'); return; }
    const contentText = document.getElementById('phuctra-content-input').value.trim(); const candidate = candidateList.find(c => String(c.id) === String(currentLookupCandidateId)); if (!candidate) return;
    if (!candidate.phuctraHistory) candidate.phuctraHistory = [];
    candidate.phuctraHistory.push({ date: new Date().toLocaleDateString('vi-VN'), subjects: checkedSubs, content: `Môn: [${checkedSubs.join(', ')}]. Lý do: ${contentText}`, status: 'Đang chờ', response: '' });
    candidate.phuctra = `Xin phúc tra ${checkedSubs.join(', ')}`; candidate.phuctraStatus = 'Đang chờ';
    saveCandidates(true); alert('Gửi yêu cầu phúc tra thành công!'); togglePhucTraForm(); searchCandidate();
}

function viewLookupCandidatePrint() { const candidate = candidateList.find(c => String(c.id) === String(currentLookupCandidateId)); if (candidate) { renderPrintCard(candidate, false); } }
function triggerPrintCandidateCard() { document.body.classList.add('print-candidate-mode'); window.print(); document.body.classList.remove('print-candidate-mode'); }

function searchMemberBook() {
    loadInitialData(); const keyword = document.getElementById('member-lookup-keyword').value.trim().toLowerCase(); const msgDiv = document.getElementById('member-lookup-result-msg'); const bookContainer = document.getElementById('book-form-container');
    if (!keyword) { alert('Vui lòng nhập Mã TV, SĐT hoặc Email!'); return; }
    const found = memberList.find(m => String(m.id).toLowerCase() === keyword || String(m.phone).toLowerCase() === keyword || String(m.email).toLowerCase() === keyword);
    if (found) {
        currentLookupMemberId = found.id; msgDiv.classList.add('hidden');
        document.getElementById('bf-id').innerText = found.id; document.getElementById('bf-act-id').innerText = found.id; document.getElementById('bf-fullname').innerText = found.fullname; document.getElementById('bf-act-fullname').innerText = found.fullname; document.getElementById('sign-fullname').innerText = found.fullname; document.getElementById('bf-dob').innerText = found.dob; document.getElementById('bf-gender').innerText = found.gender; document.getElementById('bf-classroom').innerText = found.classroom; document.getElementById('bf-schoolclub').innerText = found.schoolclub || 'CLB Guitar Cổ Điển'; document.getElementById('bf-role').innerText = found.role || 'Thành viên'; document.getElementById('bf-joindate').innerText = found.joindate; document.getElementById('bf-examdate').innerText = found.examdate || found.joindate; document.getElementById('bf-instruments').innerText = found.instruments;
        if (found.photo) { document.getElementById('bf-photo').src = found.photo; document.getElementById('bf-photo').classList.remove('hidden'); document.getElementById('bf-photo-placeholder').classList.add('hidden'); } else { document.getElementById('bf-photo').classList.add('hidden'); document.getElementById('bf-photo-placeholder').classList.remove('hidden'); }
        const actContainer = document.getElementById('bf-activities-container'); actContainer.innerHTML = ''; const acts = found.activities || [];
        if (acts.length === 0) { actContainer.innerHTML = `<p class="text-sm text-slate-400 italic text-center py-8 bg-white rounded-xl border border-slate-100">Chưa có mốc sinh hoạt nào.</p>`; } else { acts.forEach((a, idx) => { const div = document.createElement('div'); div.className = "p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm flex gap-3 items-start shadow-sm"; div.innerHTML = `<span class="font-bold text-amber-900 shrink-0 px-2 py-1 bg-amber-100 rounded-lg text-xs">${a.date}</span><span class="text-slate-700 flex-1 leading-relaxed mt-0.5">${a.content}</span>`; actContainer.appendChild(div); }); }
        bookContainer.classList.remove('hidden');
    } else {
        bookContainer.classList.add('hidden'); msgDiv.innerHTML = `<div class="bg-rose-50 text-rose-600 p-4 rounded-xl border border-rose-200 font-bold inline-block"><i class="fa-solid fa-triangle-exclamation"></i> Không tìm thấy sổ thành viên!</div>`; msgDiv.classList.remove('hidden');
    }
}

function triggerPrintMemberBook() { document.body.classList.add('print-member-mode'); window.print(); document.body.classList.remove('print-member-mode'); }

// --- KHU VỰC QUẢN TRỊ ---
function openAdminModal() { document.getElementById('admin-modal').classList.remove('hidden'); document.getElementById('admin-modal').classList.add('flex'); document.getElementById('admin-login-view').classList.remove('hidden'); document.getElementById('admin-dashboard-view').classList.add('hidden'); document.getElementById('admin-password').value = ''; document.getElementById('login-error').classList.add('hidden'); }
function closeAdminModal() { document.getElementById('admin-modal').classList.add('hidden'); document.getElementById('admin-modal').classList.remove('flex'); }

function verifyPassword() {
    const pass = document.getElementById('admin-password').value;
    if (pass === ADMIN_PASS) { document.getElementById('admin-login-view').classList.add('hidden'); document.getElementById('admin-dashboard-view').classList.remove('hidden'); document.getElementById('admin-dashboard-view').classList.add('flex'); loadInitialData(); switchAdminTab('candidates'); } 
    else { document.getElementById('login-error').classList.remove('hidden'); }
}

function switchAdminTab(subTab) {
    ['admin-section-candidates', 'admin-section-reappeals', 'admin-section-members'].forEach(id => document.getElementById(id).classList.add('hidden'));
    ['admin-tab-btn-candidates', 'admin-tab-btn-reappeals', 'admin-tab-btn-members'].forEach(id => {
        const btn = document.getElementById(id);
        btn.className = "px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold transition-colors relative flex items-center gap-1.5 whitespace-nowrap";
    });
    document.getElementById(`admin-section-${subTab}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`admin-tab-btn-${subTab}`);
    activeBtn.className = "px-5 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold transition-colors relative flex items-center gap-1.5 whitespace-nowrap shadow-md";
    if(subTab === 'candidates') renderAdminCandidates();
    else if(subTab === 'reappeals') renderAdminReappeals();
    else if(subTab === 'members') renderAdminMembers();
}

function renderAdminCandidates() {
    loadInitialData(); const tbody = document.getElementById('admin-table-body'); tbody.innerHTML = '';
    let total = candidateList.length, ltanCount = 0, gcdCount = 0, otherCount = 0;
    candidateList.forEach(c => {
        const subs = c.subjects || []; if (subs.includes('Lý thuyết âm nhạc')) ltanCount++; if (subs.includes('Guitar cổ điển')) gcdCount++; if (subs.includes('Guitar đệm hát') || subs.includes('Thanh nhạc')) otherCount++;
        const tr = document.createElement('tr'); tr.className = "hover:bg-slate-50 transition-colors";
        let statusBadge = c.status === 'ĐỦ' ? `<span class="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">ĐỦ ĐK</span>` : (c.status === 'KHÔNG ĐỦ' ? `<span class="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-bold border border-rose-200">LOẠI</span>` : `<span class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 font-bold border border-slate-200">Chưa xét</span>`);
        let reappealBadge = c.phuctraStatus === 'Đang chờ' ? `<span class="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-bold border border-amber-200">Đang chờ</span>` : (c.phuctraStatus === 'Đã duyệt' ? `<span class="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 font-bold border border-blue-200">Đã duyệt</span>` : `<span class="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-bold border border-rose-200 hidden">${c.phuctraStatus}</span>`);
        if(c.phuctraStatus !== 'Đang chờ' && c.phuctraStatus !== 'Đã duyệt') reappealBadge = `<span class="text-slate-300">-</span>`;
        const currentDTB = calculateDTB(c.scores, subs);
        tr.innerHTML = `<td class="p-4 font-mono font-bold text-slate-800">${c.id}</td><td class="p-4 font-bold text-slate-700">${c.fullname}</td><td class="p-4 font-mono text-slate-500">${c.sbd || '-'}</td><td class="p-4 font-semibold text-slate-600">${c.classroom}</td><td class="p-4 text-slate-600">${subs.join(', ')}</td><td class="p-4 font-black text-amber-600 text-sm">${currentDTB !== '' ? currentDTB : '-'}</td><td class="p-4">${reappealBadge}</td><td class="p-4">${statusBadge}</td><td class="p-4 text-center space-x-1 flex justify-center"><button onclick="openEditModal('${c.id}')" class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-amber-100 hover:text-amber-700 text-slate-600 rounded-lg font-bold transition-colors" title="Sửa"><i class="fa-solid fa-pen-to-square"></i></button><button onclick="printCandidateFromAdmin('${c.id}')" class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 rounded-lg font-bold transition-colors" title="In"><i class="fa-solid fa-print"></i></button><button onclick="deleteCandidate('${c.id}')" class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-600 rounded-lg font-bold transition-colors" title="Xóa"><i class="fa-solid fa-trash"></i></button></td>`;
        tbody.appendChild(tr);
    });
    document.getElementById('stat-total').innerText = total; document.getElementById('stat-ltan').innerText = ltanCount; document.getElementById('stat-gcd').innerText = gcdCount; document.getElementById('stat-other').innerText = otherCount;
}

function filterAdminTable() {
    const keyword = document.getElementById('admin-search-input').value.toLowerCase();
    const tbody = document.getElementById('admin-table-body'); const rows = tbody.getElementsByTagName('tr');
    for (let r of rows) { r.style.display = r.innerText.toLowerCase().includes(keyword) ? "" : "none"; }
}

function renderAdminReappeals() {
    loadInitialData(); const tbody = document.getElementById('admin-reappeals-table-body'); tbody.innerHTML = '';
    const reappealList = candidateList.filter(c => c.phuctraStatus === 'Đang chờ' || (c.phuctraHistory && c.phuctraHistory.some(h => h.status === 'Đang chờ')));
    if (reappealList.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400 font-medium">Không có yêu cầu phúc tra nào.</td></tr>`; return; }
    reappealList.forEach(c => {
        const tr = document.createElement('tr'); tr.className = "hover:bg-slate-50 transition-colors";
        let latestHistory = (c.phuctraHistory || []).slice(-1)[0]; let contentText = latestHistory ? latestHistory.content : c.phuctra;
        tr.innerHTML = `<td class="p-4 font-mono font-bold text-slate-800">${c.id}</td><td class="p-4 font-bold text-slate-700">${c.fullname}</td><td class="p-4 text-slate-600 max-w-xs truncate">${contentText}</td><td class="p-4"><span class="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-bold border border-amber-200">Chờ duyệt</span></td><td class="p-4 text-center"><button onclick="openReappealRespondModal('${c.id}')" class="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold shadow-md transition-colors text-[10px] uppercase tracking-wider">Xử lý ngay</button></td>`;
        tbody.appendChild(tr);
    });
}

function openReappealRespondModal(id) {
    const c = candidateList.find(item => item.id === id); if (!c) return;
    document.getElementById('resp-candidate-id').value = c.id; document.getElementById('resp-candidate-name').innerText = c.fullname; document.getElementById('resp-candidate-id-text').innerText = c.id;
    let latestHistory = (c.phuctraHistory || []).slice(-1)[0]; document.getElementById('resp-candidate-content').innerText = latestHistory ? latestHistory.content : c.phuctra;
    const container = document.getElementById('resp-scores-table-container'); container.innerHTML = '';
    (c.subjects || []).forEach(sub => {
        const div = document.createElement('div'); div.className = "flex justify-between items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl";
        div.innerHTML = `<span class="font-bold text-slate-700 text-sm">${sub}</span><input type="number" step="0.1" min="0" max="10" id="resp-score-${sub}" value="${c.scores && c.scores[sub] !== undefined ? c.scores[sub] : ''}" placeholder="Nhập điểm..." class="w-32 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white text-right">`; container.appendChild(div);
    });
    document.getElementById('resp-note-input').value = ''; document.getElementById('reappeal-respond-modal').classList.remove('hidden'); document.getElementById('reappeal-respond-modal').classList.add('flex');
}

function closeReappealRespondModal() { document.getElementById('reappeal-respond-modal').classList.add('hidden'); document.getElementById('reappeal-respond-modal').classList.remove('flex'); }

function acceptReappeal() {
    const id = document.getElementById('resp-candidate-id').value; const c = candidateList.find(item => item.id === id); if (!c) return;
    let newScores = { ...c.scores };
    (c.subjects || []).forEach(sub => { const inputEl = document.getElementById(`resp-score-${sub}`); if (inputEl) { newScores[sub] = inputEl.value; } });
    c.scores = newScores; c.dtb = calculateDTB(c.scores, c.subjects); c.phuctraStatus = 'Đã duyệt';
    if (c.phuctraHistory && c.phuctraHistory.length > 0) { let latest = c.phuctraHistory[c.phuctraHistory.length - 1]; latest.status = 'Đã duyệt'; latest.response = document.getElementById('resp-note-input').value.trim() || 'Đã kiểm tra lại bài thi, điểm số đã được cập nhật chính thức.'; }
    saveCandidates(true); alert('Đã cập nhật điểm mới và phản hồi thành công đến thí sinh!'); closeReappealRespondModal(); renderAdminReappeals(); renderAdminCandidates();
}

function rejectReappeal() {
    const id = document.getElementById('resp-candidate-id').value; const c = candidateList.find(item => item.id === id); if (!c) return;
    c.phuctraStatus = 'Từ chối';
    if (c.phuctraHistory && c.phuctraHistory.length > 0) { let latest = c.phuctraHistory[c.phuctraHistory.length - 1]; latest.status = 'Từ chối'; latest.response = document.getElementById('resp-note-input').value.trim() || 'Bài chấm đã đúng đáp án, giữ nguyên điểm cũ.'; }
    saveCandidates(true); alert('Đã từ chối đơn phúc tra (giữ nguyên điểm) và gửi phản hồi.'); closeReappealRespondModal(); renderAdminReappeals(); renderAdminCandidates();
}

function renderAdminMembers() {
    loadInitialData(); const tbody = document.getElementById('admin-member-table-body'); tbody.innerHTML = '';
    let totalM = memberList.length; let bcnM = memberList.filter(m => m.role === 'Chủ nhiệm' || m.role === 'Phó chủ nhiệm').length; let regM = totalM - bcnM;
    memberList.forEach(m => {
        const tr = document.createElement('tr'); tr.className = "hover:bg-slate-50 transition-colors";
        tr.innerHTML = `<td class="p-4 font-mono font-bold text-slate-800">${m.id}</td><td class="p-4 font-bold text-slate-700">${m.fullname}</td><td class="p-4 font-medium text-slate-600">${m.classroom}</td><td class="p-4"><span class="px-2.5 py-1 rounded-lg font-bold border text-xs whitespace-nowrap ${m.role === 'Chủ nhiệm' || m.role === 'Phó chủ nhiệm' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}">${m.role}</span></td><td class="p-4 text-slate-600">${m.instruments}</td><td class="p-4 font-mono text-slate-500">${m.phone}</td><td class="p-4 text-center flex justify-center space-x-1"><button onclick="openMemberModal('${m.id}')" class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-amber-100 hover:text-amber-700 text-slate-600 rounded-lg font-bold transition-colors"><i class="fa-solid fa-pen-to-square"></i></button><button onclick="printMemberFromAdmin('${m.id}')" class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 rounded-lg font-bold transition-colors"><i class="fa-solid fa-print"></i></button><button onclick="deleteMember('${m.id}')" class="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-600 rounded-lg font-bold transition-colors"><i class="fa-solid fa-trash"></i></button></td>`;
        tbody.appendChild(tr);
    });
    document.getElementById('stat-m-total').innerText = totalM; document.getElementById('stat-m-bcn').innerText = bcnM; document.getElementById('stat-m-reg').innerText = regM;
}

function filterAdminMemberTable() {
    const keyword = document.getElementById('admin-member-search').value.toLowerCase(); const roleFilter = document.getElementById('admin-member-role').value;
    const tbody = document.getElementById('admin-member-table-body'); const rows = tbody.getElementsByTagName('tr');
    for (let r of rows) { const text = r.innerText.toLowerCase(); const matchKeyword = text.includes(keyword); const matchRole = roleFilter === "" || text.includes(roleFilter.toLowerCase()); if (matchKeyword && matchRole) { r.style.display = ""; } else { r.style.display = "none"; } }
}

function openAddCandidateModal() {
    const newId = 'HB' + Date.now().toString().slice(-6);
    candidateList.push({ id: newId, fullname: "Thí sinh mới", dob: "2008-01-01", gender: "Nam", school: "THPT Hồng Bàng", classroom: "10A1", phone: "0900000000", email: "new@gmail.com", photo: "", subjects: ["Lý thuyết âm nhạc", "Guitar cổ điển"], sbd: "CGC-" + Math.floor(100 + Math.random() * 900), rooms: { "Lý thuyết âm nhạc": "P.101", "Guitar cổ điển": "P.102" }, scores: { "Lý thuyết âm nhạc": "", "Guitar cổ điển": "" }, dtb: "", phuctra: "Không", phuctraStatus: "Chưa phúc tra", phuctraHistory: [], status: "Chưa xét", rank: "" });
    saveCandidates(true); openEditModal(newId);
}

function openEditModal(id) {
    const c = candidateList.find(item => item.id === id); if (!c) return;
    document.getElementById('edit-id').value = c.id; document.getElementById('edit-id-display').value = c.id; document.getElementById('edit-fullname').value = c.fullname; document.getElementById('edit-dob').value = c.dob; document.getElementById('edit-gender').value = c.gender; document.getElementById('edit-classroom').value = c.classroom; document.getElementById('edit-phone').value = c.phone; document.getElementById('edit-email').value = c.email; document.getElementById('edit-sbd').value = c.sbd || ''; document.getElementById('edit-phuctra').value = c.phuctra || 'Không'; document.getElementById('edit-status').value = c.status || 'Chưa xét'; document.getElementById('edit-rank').value = c.rank || 'CHÍNH THỨC';
    const subs = c.subjects || ["Lý thuyết âm nhạc", "Guitar cổ điển"]; const optSub = subs.find(s => s !== "Lý thuyết âm nhạc") || "Guitar cổ điển";
    document.querySelectorAll('input[name="edit-optional-sub"]').forEach(radio => { if (radio.value === optSub) radio.checked = true; });
    const roomsContainer = document.getElementById('edit-rooms-inputs-container'); roomsContainer.innerHTML = '';
    subs.forEach(sub => { const div = document.createElement('div'); div.innerHTML = `<label class="form-label">Phòng thi (${sub})</label><input type="text" id="edit-room-${sub}" value="${c.rooms && c.rooms[sub] ? c.rooms[sub] : ''}" placeholder="VD: P.101" class="custom-input py-2">`; roomsContainer.appendChild(div); });
    const scoresContainer = document.getElementById('edit-scores-inputs-container'); scoresContainer.innerHTML = '';
    subs.forEach(sub => { const div = document.createElement('div'); div.innerHTML = `<label class="form-label">Điểm (${sub})</label><input type="number" step="0.1" min="0" max="10" id="edit-score-${sub}" value="${c.scores && c.scores[sub] !== undefined ? c.scores[sub] : ''}" class="custom-input py-2 font-bold text-emerald-700">`; scoresContainer.appendChild(div); });
    toggleRankVisibility(); document.getElementById('edit-modal').classList.remove('hidden'); document.getElementById('edit-modal').classList.add('flex');
}

function closeEditModal() { document.getElementById('edit-modal').classList.add('hidden'); document.getElementById('edit-modal').classList.remove('flex'); }

function toggleRankVisibility() { const status = document.getElementById('edit-status').value; const rankBox = document.getElementById('edit-rank-box'); if (status === 'ĐỦ') { rankBox.classList.remove('hidden'); } else { rankBox.classList.add('hidden'); } }

function handleSaveEdit(e) {
    e.preventDefault(); const id = document.getElementById('edit-id').value; const c = candidateList.find(item => item.id === id); if (!c) return;
    const optRadio = document.querySelector('input[name="edit-optional-sub"]:checked'); const optSubVal = optRadio ? optRadio.value : "Guitar cổ điển"; const newSubs = ["Lý thuyết âm nhạc", optSubVal];
    c.fullname = document.getElementById('edit-fullname').value.trim(); c.dob = document.getElementById('edit-dob').value; c.gender = document.getElementById('edit-gender').value; c.classroom = document.getElementById('edit-classroom').value.trim(); c.phone = document.getElementById('edit-phone').value.trim(); c.email = document.getElementById('edit-email').value.trim(); c.sbd = document.getElementById('edit-sbd').value.trim(); c.subjects = newSubs; c.phuctra = document.getElementById('edit-phuctra').value.trim(); c.status = document.getElementById('edit-status').value; c.rank = document.getElementById('edit-rank').value;
    let newRooms = {}; newSubs.forEach(sub => { const el = document.getElementById(`edit-room-${sub}`); if (el) newRooms[sub] = el.value.trim(); }); c.rooms = newRooms;
    let newScores = {}; newSubs.forEach(sub => { const el = document.getElementById(`edit-score-${sub}`); if (el) newScores[sub] = el.value.trim(); }); c.scores = newScores; c.dtb = calculateDTB(c.scores, c.subjects);
    saveCandidates(true); alert('Lưu hồ sơ thành công!'); closeEditModal(); renderAdminCandidates();
}

function printCandidateFromAdmin(id) { const c = candidateList.find(item => item.id === id); if (c) { closeAdminModal(); renderPrintCard(c, true); } }
function deleteCandidate(id) { if (confirm('Chắc chắn muốn xóa thí sinh này?')) { candidateList = candidateList.filter(item => item.id !== id); saveCandidates(true); renderAdminCandidates(); } }
function deleteAllCandidates() { if (confirm('CẢNH BÁO: Xóa tất cả hồ sơ thí sinh?')) { candidateList = []; saveCandidates(true); renderAdminCandidates(); } }

function openMemberAddModal() {
    const newId = 'HB' + Date.now().toString().slice(-6);
    memberList.push({ id: newId, fullname: "Thành viên mới", dob: "2008-01-01", gender: "Nam", classroom: "10A1", schoolclub: "CLB Guitar Cổ Điển", role: "Thành viên", phone: "0900000000", email: "member@gmail.com", instruments: "Guitar Cổ Điển", joindate: new Date().toISOString().split('T')[0], examdate: new Date().toISOString().split('T')[0], photo: "", activities: [{ date: new Date().toISOString().split('T')[0], content: "Chính thức gia nhập Câu lạc bộ." }] });
    saveMembers(true); openMemberModal(newId);
}

function openMemberModal(id) {
    const m = memberList.find(item => item.id === id); if (!m) return;
    document.getElementById('edit-member-id').value = m.id; document.getElementById('m-fullname').value = m.fullname; document.getElementById('m-dob').value = m.dob; document.getElementById('m-gender').value = m.gender; document.getElementById('m-classroom').value = m.classroom; document.getElementById('m-role').value = m.role; document.getElementById('m-phone').value = m.phone; document.getElementById('m-email').value = m.email; document.getElementById('m-instruments').value = m.instruments; document.getElementById('m-joindate').value = m.joindate;
    renderActivitiesInputList(m.activities || []); document.getElementById('member-modal').classList.remove('hidden'); document.getElementById('member-modal').classList.add('flex');
}

function closeMemberModal() { document.getElementById('member-modal').classList.add('hidden'); document.getElementById('member-modal').classList.remove('flex'); }

function renderActivitiesInputList(acts) {
    const container = document.getElementById('activities-input-list'); container.innerHTML = '';
    acts.forEach((a, idx) => {
        const div = document.createElement('div'); div.className = "flex gap-2 items-center bg-white p-2 border border-slate-200 rounded-xl shadow-sm";
        div.innerHTML = `<input type="date" value="${a.date}" class="act-date px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"><input type="text" value="${a.content}" placeholder="Nội dung..." class="act-content flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none"><button type="button" onclick="this.parentElement.remove()" class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center font-bold transition-colors"><i class="fa-solid fa-xmark"></i></button>`; container.appendChild(div);
    });
}

function addActivityRow() {
    const container = document.getElementById('activities-input-list'); const today = new Date().toISOString().split('T')[0];
    const div = document.createElement('div'); div.className = "flex gap-2 items-center bg-white p-2 border border-slate-200 rounded-xl shadow-sm";
    div.innerHTML = `<input type="date" value="${today}" class="act-date px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"><input type="text" value="Ghi nhận hoạt động..." class="act-content flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none"><button type="button" onclick="this.parentElement.remove()" class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center font-bold transition-colors"><i class="fa-solid fa-xmark"></i></button>`; container.appendChild(div);
}

function handleSaveMember(e) {
    e.preventDefault(); const id = document.getElementById('edit-member-id').value; const m = memberList.find(item => item.id === id); if (!m) return;
    m.fullname = document.getElementById('m-fullname').value.trim(); m.dob = document.getElementById('m-dob').value; m.gender = document.getElementById('m-gender').value; m.classroom = document.getElementById('m-classroom').value.trim(); m.role = document.getElementById('m-role').value; m.phone = document.getElementById('m-phone').value.trim(); m.email = document.getElementById('m-email').value.trim(); m.instruments = document.getElementById('m-instruments').value.trim(); m.joindate = document.getElementById('m-joindate').value;
    let newActs = []; const rows = document.querySelectorAll('#activities-input-list > div');
    rows.forEach(r => { const d = r.querySelector('.act-date').value; const c = r.querySelector('.act-content').value.trim(); if (c) { newActs.push({ date: d, content: c }); } });
    m.activities = newActs; saveMembers(true); alert('Lưu sổ thành viên thành công!'); closeMemberModal(); renderAdminMembers();
}

function printMemberFromAdmin(id) { const m = memberList.find(item => item.id === id); if (m) { closeAdminModal(); switchTab('member-book'); document.getElementById('member-lookup-keyword').value = m.id; searchMemberBook(); } }
function deleteMember(id) { if (confirm('Chắc chắn xóa sổ này?')) { memberList = memberList.filter(item => item.id !== id); saveMembers(true); renderAdminMembers(); } }

function exportCandidatesExcel() {
    let dataExport = candidateList.map(c => ({ "Mã Phiếu": c.id, "Họ Tên": c.fullname, "SBD": c.sbd, "Lớp": c.classroom, "Trường": c.school, "SĐT": c.phone, "Email": c.email, "Môn Thi": (c.subjects || []).join(', '), "Điểm TB": c.dtb, "Trạng Thái Xét Tuyển": c.status, "Xếp Loại": c.rank }));
    const worksheet = XLSX.utils.json_to_sheet(dataExport); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, "DanhSachThiSinh"); XLSX.writeFile(workbook, "DanhSachThiSinh_HB3.xlsx");
}

function exportMembersExcel() {
    let dataExport = memberList.map(m => ({ "Mã TV": m.id, "Họ Tên": m.fullname, "Ngày Sinh": m.dob, "Giới Tính": m.gender, "Lớp": m.classroom, "Chức Vụ": m.role, "Nhạc Cụ": m.instruments, "SĐT": m.phone, "Email": m.email, "Ngày Vào CLB": m.joindate }));
    const worksheet = XLSX.utils.json_to_sheet(dataExport); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, "SoThanhVien"); XLSX.writeFile(workbook, "SoThanhVien_HB3.xlsx");
}
