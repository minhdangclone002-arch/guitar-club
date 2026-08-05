// ==========================================
// 1. KẾT NỐI SUPABASE
// ==========================================
const SUPABASE_URL = 'https://wtvoatrmrakatuxyukox.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0dm9hdHJtcmFrYXR1eHl1a294Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MjU3OTMsImV4cCI6MjEwMTQwMTc5M30.eYsaZBCHFmEPD7Rkr_PukOhhzLmYJsUBoNN17EMAo6U';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const API_URL = '';

// ==========================================
// 2. BIẾN TOÀN CỤC
// ==========================================
let candidateList = [];
let memberList = [];
let mediaList = [];
let currentPhotoBase64 = "";
let currentRegMemberPhotoBase64 = "";
let currentEditPhotoBase64 = "";
let registerPhotoFile = null;
let regMemberPhotoFile = null;
let editPhotoFile = null;
let currentLookupCandidateId = null;
let currentLookupMemberId = null;

let currentUserRole = 'member';
let realtimeChannel = null;
let realtimeReloadTimer = null;

window.addEventListener('DOMContentLoaded', () => {
    checkSession();
});

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function getAuthHeader() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session ? { 'Authorization': `Bearer ${session.access_token}` } : {};
}

// ==========================================
// 3. TÍNH NĂNG ĐĂNG NHẬP & PHÂN QUYỀN
// ==========================================
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
        document.getElementById('auth-modal').classList.add('hidden');
        document.getElementById('user-display-email').innerHTML = `<i class="fa-solid fa-circle-user mr-1"></i> ${escapeHtml(session.user.email)}`;

        const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', session.user.id).single();
        if (profile) {
            currentUserRole = profile.role;
        }

        applyRoleUI();
        await loadInitialData();
        setupRealtimeSync();
        switchTab('home');
    } else {
        document.getElementById('auth-modal').classList.remove('hidden');
    }
}

function applyRoleUI() {
    const isMember = currentUserRole === 'member';
    const isAdmin = currentUserRole === 'admin';
    const isOwner = currentUserRole === 'owner';

    const adminElements = [
        'btn-admin-nav', 'btn-admin-home', 'btn-tab-member-book',
        'btn-tab-register-book', 'card-member-book', 'card-register-book',
        'upload-media-container'
    ];

    adminElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (isMember) el.classList.add('hidden');
            else el.classList.remove('hidden');
        }
    });

    const rolesTabBtn = document.getElementById('admin-tab-btn-roles');
    if (isOwner) {
        if (rolesTabBtn) rolesTabBtn.classList.remove('hidden');
    } else {
        if (rolesTabBtn) rolesTabBtn.classList.add('hidden');
    }

    renderMedia();
}

function toggleAuthMode(mode) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const btnLogin = document.getElementById('btn-show-login');
    const btnRegister = document.getElementById('btn-show-register');

    if (mode === 'login') {
        loginForm.classList.remove('hidden'); registerForm.classList.add('hidden');
        btnLogin.className = "flex-1 py-2 rounded-lg text-xs font-bold bg-white text-amber-900 shadow transition-all";
        btnRegister.className = "flex-1 py-2 rounded-lg text-xs font-bold text-slate-500 transition-all hover:text-slate-800";
    } else {
        loginForm.classList.add('hidden'); registerForm.classList.remove('hidden');
        btnRegister.className = "flex-1 py-2 rounded-lg text-xs font-bold bg-white text-amber-900 shadow transition-all";
        btnLogin.className = "flex-1 py-2 rounded-lg text-xs font-bold text-slate-500 transition-all hover:text-slate-800";
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng nhập...`;
    const { error } = await supabaseClient.auth.signInWithPassword({
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value
    });
    if (error) { alert("Lỗi: Sai email hoặc mật khẩu!"); btn.innerHTML = `Đăng Nhập`; }
    else { checkSession(); }
}

async function handleRegisterUser(e) {
    e.preventDefault();
    const email = document.getElementById('reg-user-email').value;
    const pass = document.getElementById('reg-user-password').value;
    if (pass !== document.getElementById('reg-user-confirm').value) return alert("Lỗi: Hai mật khẩu không khớp!");

    const btn = document.getElementById('reg-btn');
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo...`;

    const { data, error } = await supabaseClient.auth.signUp({ email: email, password: pass });
    if (error) { alert("Lỗi đăng ký: " + error.message); btn.innerHTML = `Tạo Tài Khoản`; return; }

    await supabaseClient.from('profiles').insert({ id: data.user.id, email: email, role: 'member' });

    alert("Đăng ký thành công! Hãy đăng nhập ngay.");
    document.getElementById('register-form').reset();
    toggleAuthMode('login');
    btn.innerHTML = `Tạo Tài Khoản`;
}

async function handleLogout() {
    if (confirm("Đăng xuất khỏi hệ thống?")) {
        if (realtimeChannel) { supabaseClient.removeChannel(realtimeChannel); realtimeChannel = null; }
        await supabaseClient.auth.signOut();
        location.reload();
    }
}

async function forgotPassword() {
    const email = prompt("Nhập Email bạn đã đăng ký để lấy lại mật khẩu:");
    if (!email) return;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
    if (error) alert("Lỗi: " + error.message);
    else alert("Thành công! Một email khôi phục mật khẩu đã được gửi đến hộp thư của bạn.");
}

// ==========================================
// 4. CHUYỂN TAB & MEDIA
// ==========================================
function switchTab(tabName) {
    ['tab-home', 'tab-register', 'tab-lookup', 'tab-member-book', 'tab-register-book', 'tab-gallery'].forEach(t => {
        const el = document.getElementById(t);
        if(el) el.classList.add('hidden');
    });

    ['home', 'register', 'lookup', 'member-book', 'register-book', 'gallery'].forEach(t => {
        const btn = document.getElementById(`btn-tab-${t}`);
        if (btn) btn.classList.remove('active');
    });

    const targetTab = document.getElementById(`tab-${tabName}`);
    if(targetTab) {
        targetTab.classList.remove('hidden');
    }

    const activeBtn = document.getElementById(`btn-tab-${tabName}`);
    if(activeBtn) activeBtn.classList.add('active');

    document.getElementById('book-form-container').classList.add('hidden');
    document.getElementById('print-area').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadMedia() {
    try {
        const res = await fetch(`${API_URL}/api/media`);
        mediaList = await res.json();
        renderMedia();
    } catch (err) {}
}

async function handleMediaUpload(event) {
    if (currentUserRole === 'member') { alert("Bạn không có quyền tải ảnh/video!"); return; }
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const btn = event.target.nextElementSibling;
    const oldText = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...`;

    const headers = await getAuthHeader();

    for (let file of files) {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch(`${API_URL}/api/upload`, { method: 'POST', headers: headers, body: formData });
            const result = await res.json();
            if (result.success) {
                mediaList.unshift(result.data);
                renderMedia();
            } else {
                alert("Lỗi tải lên: " + (result.error || file.name));
            }
        } catch (err) { alert("Lỗi tải lên: " + file.name); }
    }
    btn.innerHTML = oldText;
    event.target.value = '';
}

function renderMedia() {
    const container = document.getElementById('media-gallery-container');
    if (!container) return;
    container.innerHTML = '';

    if (mediaList.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                <i class="fa-solid fa-cloud-arrow-up text-4xl text-slate-300 mb-2"></i>
                <p class="text-slate-500 text-xs">Chưa có dữ liệu Media.</p>
            </div>`;
        return;
    }

    mediaList.forEach(item => {
        const div = document.createElement('div');
        div.className = 'media-item group';

        const safeUrl = escapeHtml(item.url);
        const safeId = escapeHtml(item.id);

        const deleteBtnHtml = (currentUserRole === 'admin' || currentUserRole === 'owner')
            ? `<button onclick="deleteMedia('${safeId}')" class="delete-media-btn"><i class="fa-solid fa-trash text-xs"></i></button>`
            : '';

        if (item.type === 'video') {
            div.innerHTML = `
                <video src="${safeUrl}" class="w-full h-full object-cover" controls preload="metadata"></video>
                <div class="absolute top-2 left-2 bg-black/60 text-white text-[9px] uppercase font-bold px-2 py-0.5 rounded"><i class="fa-solid fa-play"></i> VIDEO</div>
                ${deleteBtnHtml}`;
        } else {
            div.innerHTML = `
                <img src="${safeUrl}" onclick="viewMediaFull('${safeUrl}')" class="cursor-pointer">
                ${deleteBtnHtml}`;
        }
        container.appendChild(div);
    });
}

async function deleteMedia(id) {
    if (currentUserRole === 'member') return alert("Bạn không có quyền xóa!");
    if (confirm("Xóa file này khỏi thư viện?")) {
        const headers = await getAuthHeader();
        const res = await fetch(`${API_URL}/api/media/${id}`, { method: 'DELETE', headers: headers });
        const result = await res.json();
        if (result.success) {
            mediaList = mediaList.filter(item => item.id !== id);
            renderMedia();
        } else {
            alert("Lỗi xóa: " + (result.error || 'Thao tác thất bại'));
        }
    }
}

function viewMediaFull(src) {
    const w = window.open("");
    w.document.write(`<body style="margin:0; background:#000; display:flex; align-items:center; justify-content:center; height:100vh;"><img src="${escapeHtml(src)}" style="max-width:100%; max-height:100%; object-fit:contain; border-radius: 8px;"></body>`);
}

// ==========================================
// 5. TẢI DỮ LIỆU & REALTIME
// ==========================================
async function loadInitialData() {
    loadMedia();
    try {
        const { data: candidatesRaw, error: cErr } = await supabaseClient
            .from('candidates').select('*').order('created_at', { ascending: false });
        if (cErr) throw cErr;

        const { data: subjectsRaw } = await supabaseClient
            .from('candidate_subjects').select('*').order('id', { ascending: true });

        const { data: reappealsRaw } = await supabaseClient
            .from('candidate_reappeals').select('*').order('created_at', { ascending: true });

        candidateList = (candidatesRaw || []).map(c => {
            const subs = (subjectsRaw || []).filter(s => s.candidate_id === c.id);
            const rooms = {}; const scores = {};
            subs.forEach(s => { rooms[s.subject_name] = s.room || ''; scores[s.subject_name] = s.score || ''; });
            const history = (reappealsRaw || []).filter(r => r.candidate_id === c.id).map(r => ({
                date: r.date,
                subjects: (r.subjects || '').split(',').map(x => x.trim()).filter(Boolean),
                content: r.content, status: r.status, response: r.response, _dbId: r.id
            }));
            const derivedPhuctraStatus = history.length > 0 ? history[history.length - 1].status : (c.phuctra_status || 'Chưa phúc tra');
            return {
                id: c.id, fullname: c.fullname, dob: c.dob, gender: c.gender, school: c.school,
                classroom: c.classroom, phone: c.phone, email: c.email, photo: c.photo || '',
                subjects: subs.map(s => s.subject_name),
                sbd: c.sbd || '', rooms, scores, dtb: c.dtb || '',
                phuctra: c.phuctra || 'Không', phuctraStatus: derivedPhuctraStatus,
                phuctraHistory: history, status: c.status || 'Chưa xét', rank: c.rank || ''
            };
        });

        const { data: membersRaw } = await supabaseClient
            .from('members').select('*').order('created_at', { ascending: false });
        const { data: activitiesRaw } = await supabaseClient
            .from('member_activities').select('*').order('date', { ascending: true });

        memberList = (membersRaw || []).map(m => ({
            id: m.id, fullname: m.fullname, dob: m.dob, gender: m.gender, classroom: m.classroom,
            schoolclub: m.schoolclub, role: m.role, phone: m.phone, email: m.email,
            instruments: m.instruments, joindate: m.joindate, examdate: m.examdate, photo: m.photo || '',
            activities: (activitiesRaw || []).filter(a => a.member_id === m.id).map(a => ({ date: a.date, content: a.content, _dbId: a.id }))
        }));
    } catch (err) {
        console.error('Lỗi tải dữ liệu Supabase:', err);
    }
}

function setupRealtimeSync() {
    if (realtimeChannel) return;
    realtimeChannel = supabaseClient.channel('guitar-club-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, handleRealtimeChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'candidate_subjects' }, handleRealtimeChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'candidate_reappeals' }, handleRealtimeChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, handleRealtimeChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'member_activities' }, handleRealtimeChange)
        .subscribe();
}

function handleRealtimeChange() {
    clearTimeout(realtimeReloadTimer);
    realtimeReloadTimer = setTimeout(async () => {
        await loadInitialData();
        updateReappealBadges();
        if (!document.getElementById('admin-modal').classList.contains('hidden')) {
            renderAdminCandidates(); renderAdminReappeals(); renderAdminMembers();
        }
        if (currentLookupCandidateId && !document.getElementById('lookup-card-detail').classList.contains('hidden')) {
            searchCandidate();
        }
        if (currentLookupMemberId && !document.getElementById('book-form-container').classList.contains('hidden')) {
            searchMemberBook();
        }
    }, 400);
}

async function reloadAndRenderCandidates() {
    await loadInitialData();
    updateReappealBadges();
    if (!document.getElementById('admin-modal').classList.contains('hidden')) { renderAdminCandidates(); renderAdminReappeals(); }
}
async function reloadAndRenderMembers() {
    await loadInitialData();
    if (!document.getElementById('admin-modal').classList.contains('hidden')) { renderAdminMembers(); }
}

function updateReappealBadges() {
    const pendingCount = candidateList.filter(c => c.phuctraStatus === 'Đang chờ').length;
    const badgeNav = document.getElementById('nav-badge-count'); const badgeReappeal = document.getElementById('reappeal-badge-count');
    if (pendingCount > 0) {
        if (badgeNav) { badgeNav.innerText = pendingCount; badgeNav.classList.remove('hidden'); }
        if (badgeReappeal) { badgeReappeal.innerText = pendingCount; badgeReappeal.classList.remove('hidden'); }
    } else {
        if (badgeNav) badgeNav.classList.add('hidden');
        if (badgeReappeal) badgeReappeal.classList.add('hidden');
    }
}

// ==========================================
// 6. XỬ LÝ FORM & ĐĂNG KÝ
// ==========================================
function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        registerPhotoFile = file;
        const reader = new FileReader();
        reader.onload = function(e) {
            currentPhotoBase64 = e.target.result;
            document.getElementById('avatar-preview').src = currentPhotoBase64;
            document.getElementById('avatar-preview').classList.remove('hidden');
            document.getElementById('avatar-placeholder').classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }
}

function previewRegisterMemberImage(event) {
    const file = event.target.files[0];
    if (file) { regMemberPhotoFile = file; const reader = new FileReader(); reader.onload = function(e) { currentRegMemberPhotoBase64 = e.target.result; }; reader.readAsDataURL(file); }
}

function previewEditImage(event) {
    const file = event.target.files[0];
    if (file) {
        editPhotoFile = file;
        const reader = new FileReader();
        reader.onload = function(e) {
            currentEditPhotoBase64 = e.target.result;
            document.getElementById('edit-avatar-preview').src = currentEditPhotoBase64;
            document.getElementById('edit-avatar-preview').classList.remove('hidden');
            document.getElementById('edit-avatar-placeholder-icon').classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }
}

async function uploadPhotoToStorage(file, prefix) {
    const fileName = `${prefix}-${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(fileName, file, { contentType: file.type });
    if (uploadError) throw uploadError;
    const { data: publicUrlData } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
    return publicUrlData.publicUrl;
}

function toggleSubmitBtn() {
    const isChecked = document.getElementById('commitment-check').checked;
    const btn = document.getElementById('submitBtn');
    if (isChecked) {
        btn.disabled = false;
        btn.className = "bg-amber-800 hover:bg-amber-900 text-white font-bold py-3 px-8 rounded-xl shadow transition flex items-center gap-2 text-sm cursor-pointer";
    } else {
        btn.disabled = true;
        btn.className = "bg-slate-400 text-white font-bold py-3 px-8 rounded-xl shadow transition flex items-center gap-2 text-sm cursor-not-allowed";
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const optSubject = document.querySelector('input[name="optional-subject"]:checked');
    if (!optSubject) { alert('Vui lòng chọn 1 trong 3 môn còn lại!'); return; }

    const newId = 'HB' + Date.now().toString().slice(-6);
    let photoUrl = '';
    try {
        if (registerPhotoFile) { photoUrl = await uploadPhotoToStorage(registerPhotoFile, `candidate-${newId}`); }
    } catch (err) { alert('Lỗi tải ảnh lên: ' + err.message); return; }

    const candidateRow = {
        id: newId, fullname: document.getElementById('fullname').value.trim(), dob: document.getElementById('dob').value,
        gender: document.getElementById('gender').value, school: document.getElementById('school').value.trim(),
        classroom: document.getElementById('classroom').value.trim(), phone: document.getElementById('phone').value.trim(),
        email: document.getElementById('email').value.trim(), photo: photoUrl,
        sbd: '', dtb: '', phuctra: 'Không', phuctra_status: 'Chưa phúc tra', status: 'Chưa xét', rank: ''
    };
    const subjectRows = [
        { candidate_id: newId, subject_name: 'Lý thuyết âm nhạc', room: '', score: '' },
        { candidate_id: newId, subject_name: optSubject.value, room: '', score: '' }
    ];

    try {
        const { error: insErr } = await supabaseClient.from('candidates').insert(candidateRow);
        if (insErr) throw insErr;
        const { error: subErr } = await supabaseClient.from('candidate_subjects').insert(subjectRows);
        if (subErr) throw subErr;

        await reloadAndRenderCandidates();
        alert(`Đăng ký dự tuyển thành công!\nMã phiếu của bạn là: ${newId}`);
        registerPhotoFile = null;
        renderPrintCard({
            ...candidateRow,
            subjects: subjectRows.map(s => s.subject_name),
            rooms: {}, scores: {}, phuctraHistory: []
        }, false);
    } catch (err) {
        alert('Lỗi gửi hồ sơ: ' + err.message);
    }
}

async function handleRegisterMemberBook(e) {
    e.preventDefault();
    const newId = 'HB' + Date.now().toString().slice(-6);
    const joindate = document.getElementById('reg-m-joindate').value;
    let photoUrl = '';
    try {
        if (regMemberPhotoFile) { photoUrl = await uploadPhotoToStorage(regMemberPhotoFile, `member-${newId}`); }
    } catch (err) { alert('Lỗi tải ảnh lên: ' + err.message); return; }

    const memberRow = {
        id: newId, fullname: document.getElementById('reg-m-fullname').value.trim(), dob: document.getElementById('reg-m-dob').value,
        gender: document.getElementById('reg-m-gender').value, classroom: document.getElementById('reg-m-classroom').value.trim(),
        schoolclub: document.getElementById('reg-m-schoolclub').value.trim(), role: 'Thành viên',
        phone: document.getElementById('reg-m-phone').value.trim(), email: document.getElementById('reg-m-email').value.trim(),
        instruments: document.getElementById('reg-m-instruments').value.trim(), joindate: joindate,
        examdate: document.getElementById('reg-m-examdate').value, photo: photoUrl
    };

    try {
        const { error: insErr } = await supabaseClient.from('members').insert(memberRow);
        if (insErr) throw insErr;
        await supabaseClient.from('member_activities').insert({ member_id: newId, date: joindate, content: "Chính thức lập sổ thành viên CLB." });

        await reloadAndRenderMembers();
        alert(`Đăng ký lập sổ thành công!\nMã số thành viên: ${newId}`);
        regMemberPhotoFile = null;
        document.getElementById('registerMemberForm').reset(); switchTab('member-book');
    } catch (err) { alert('Lỗi đăng ký: ' + err.message); }
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
    const subs = data.subjects || []; subs.forEach(s => { const p = document.createElement('p'); p.innerHTML = `<span class="font-bold text-amber-900">[X]</span> ${escapeHtml(s)}`; subListEl.appendChild(p); });
    document.getElementById('p-sbd').innerText = data.sbd || '';
    const roomsPrint = document.getElementById('p-rooms-print-container'); roomsPrint.innerHTML = '';
    subs.forEach(s => { const p = document.createElement('p'); let rVal = data.rooms && data.rooms[s] ? data.rooms[s] : ''; p.innerHTML = `<strong>Phòng thi ${escapeHtml(s)}:</strong> <span>${escapeHtml(rVal)}</span>`; roomsPrint.appendChild(p); });
    const scoresPrint = document.getElementById('p-scores-print-container'); scoresPrint.innerHTML = '';
    subs.forEach(s => { const div = document.createElement('div'); let scVal = data.scores && data.scores[s] !== undefined && data.scores[s] !== '' ? data.scores[s] : ''; div.innerHTML = `<strong>Điểm ${escapeHtml(s)}:</strong> <p>${escapeHtml(scVal)}</p>`; scoresPrint.appendChild(div); });
    const currentDTB = calculateDTB(data.scores, subs); document.getElementById('p-dtb').innerText = currentDTB !== '' ? currentDTB : '';
    const conclusionContainer = document.getElementById('p-conclusion-container'); const rankContainer = document.getElementById('p-rank-container');
    if (hasScores(data) && data.status && data.status !== 'Chưa xét') {
        conclusionContainer.classList.remove('hidden');
        if (data.status === 'ĐỦ') { document.getElementById('p-conclusion').innerHTML = `<span class="text-emerald-600 font-bold uppercase">ĐỦ</span> điều kiện trở thành thành viên`; rankContainer.classList.remove('hidden'); document.getElementById('p-rank').innerHTML = `<span class="font-bold uppercase">${escapeHtml(data.rank) || 'CHÍNH THỨC'}</span>`; }
        else if (data.status === 'KHÔNG ĐỦ') { document.getElementById('p-conclusion').innerHTML = `<span class="text-rose-600 font-bold uppercase">KHÔNG ĐỦ</span> điều kiện`; rankContainer.classList.add('hidden'); }
        else { conclusionContainer.classList.add('hidden'); rankContainer.classList.add('hidden'); }
    } else { conclusionContainer.classList.add('hidden'); rankContainer.classList.add('hidden'); }
    const printHistoryContainer = document.getElementById('p-phuctra-history-print'); printHistoryContainer.innerHTML = ''; const history = data.phuctraHistory || [];
    if (history.length === 0) { printHistoryContainer.innerHTML = `<p class="text-slate-500">Chưa có thông tin / Yêu cầu phúc tra.</p>`; } else { history.forEach((h, idx) => { const div = document.createElement('div'); div.className = "mb-1 pb-1 border-b border-slate-200 last:border-b-0"; div.innerHTML = `<p><strong>Lần ${idx + 1} (${escapeHtml(h.date)}):</strong> ${escapeHtml(h.content)}</p><p class="text-amber-900"><strong>Phản hồi (${escapeHtml(h.status)}):</strong> ${escapeHtml(h.response) || 'Chưa phản hồi'}</p>`; printHistoryContainer.appendChild(div); }); }
    ['tab-home', 'tab-register', 'tab-lookup', 'tab-member-book', 'tab-register-book', 'tab-gallery', 'book-form-container'].forEach(id => { const el = document.getElementById(id); if(el) el.classList.add('hidden'); }); document.getElementById('print-area').classList.remove('hidden');
}

function closePrintCard() { document.getElementById('print-area').classList.add('hidden'); switchTab('lookup'); }

async function searchCandidate() {
    await loadInitialData(); const keyword = document.getElementById('lookup-keyword').value.trim().toLowerCase(); const msgDiv = document.getElementById('lookup-result-msg'); const cardDetail = document.getElementById('lookup-card-detail');
    if (!keyword) { alert('Vui lòng nhập Mã phiếu, SĐT hoặc Email!'); return; }
    const found = candidateList.find(c => String(c.id).toLowerCase() === keyword || String(c.phone).toLowerCase() === keyword || String(c.email).toLowerCase() === keyword);
    if (found) {
        currentLookupCandidateId = found.id; msgDiv.classList.add('hidden'); document.getElementById('lk-id').innerText = found.id; document.getElementById('lk-fullname').innerText = found.fullname; document.getElementById('lk-sbd').innerText = found.sbd || 'Chưa cấp SBD'; document.getElementById('lk-classroom').innerText = found.classroom; document.getElementById('lk-subjects').innerText = (found.subjects || []).join(', ');
        const rBadge = document.getElementById('lk-rank-badge'); const tag = document.getElementById('lk-score-status-tag'); const conclusionBox = document.getElementById('lk-conclusion-box'); const rankBox = document.getElementById('lk-rank-box'); const phuctraSec = document.getElementById('phuctra-section');
        const roomsScoresContainer = document.getElementById('lk-rooms-scores-container'); roomsScoresContainer.innerHTML = ''; const subs = found.subjects || [];
        subs.forEach(s => { const rVal = found.rooms && found.rooms[s] ? found.rooms[s] : 'Chưa xếp'; const scVal = found.scores && found.scores[s] !== undefined && found.scores[s] !== '' ? found.scores[s] : '-'; const div = document.createElement('div'); div.className = "p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center"; div.innerHTML = `<div><strong class="text-amber-900 block">${escapeHtml(s)}</strong><span class="text-xs text-slate-500">Phòng thi: <strong class="text-blue-900">${escapeHtml(rVal)}</strong></span></div><div class="text-right"><span class="text-xs text-slate-400 block">Điểm số</span><span class="font-extrabold text-amber-900 text-lg">${escapeHtml(scVal)}</span></div>`; roomsScoresContainer.appendChild(div); });
        const dtbVal = calculateDTB(found.scores, subs); document.getElementById('lk-dtb').innerText = dtbVal !== '' ? dtbVal : 'Chưa có';
        if (!hasScores(found)) { conclusionBox.classList.add('hidden'); rankBox.classList.add('hidden'); rBadge.classList.add('hidden'); tag.innerText = "(Chưa công bố điểm)"; phuctraSec.classList.add('hidden'); }
        else if (!found.status || found.status === 'Chưa xét') { conclusionBox.classList.remove('hidden'); document.getElementById('lk-conclusion').innerHTML = `<span class="text-slate-600 font-bold uppercase">chưa công bố</span>`; rankBox.classList.add('hidden'); rBadge.classList.add('hidden'); tag.innerText = "(Đã có điểm - Chờ kết luận)"; phuctraSec.classList.remove('hidden'); }
        else {
            tag.innerText = "(Đã công bố kết quả)"; phuctraSec.classList.remove('hidden'); conclusionBox.classList.remove('hidden');
            if (found.status === 'ĐỦ') { document.getElementById('lk-conclusion').innerHTML = `<span class="text-emerald-600 font-bold uppercase"><i class="fa-solid fa-circle-check"></i> ĐỦ điều kiện</span>`; document.getElementById('lk-rank').innerHTML = `<span class="font-bold uppercase">${escapeHtml(found.rank) || 'CHÍNH THỨC'}</span>`; rankBox.classList.remove('hidden'); rBadge.innerText = found.rank || 'CHÍNH THỨC'; rBadge.className = "px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm"; rBadge.classList.remove('hidden'); }
            else { document.getElementById('lk-conclusion').innerHTML = `<span class="text-rose-600 font-bold uppercase"><i class="fa-solid fa-circle-xmark"></i> KHÔNG ĐỦ điều kiện</span>`; rankBox.classList.add('hidden'); rBadge.innerText = 'KHÔNG ĐỦ'; rBadge.className = "px-4 py-1.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-sm"; rBadge.classList.remove('hidden'); }
        }
        const historyBox = document.getElementById('lookup-reappeal-history-container'); const historyList = document.getElementById('lookup-reappeal-history-list'); historyList.innerHTML = ''; const historyArr = found.phuctraHistory || [];
        if (historyArr.length > 0) {
            historyBox.classList.remove('hidden');
            historyArr.forEach((item, index) => {
                let statusColor = item.status === 'Đã duyệt' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : (item.status === 'Từ chối' ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-amber-100 text-amber-800 border-amber-300');
                const div = document.createElement('div'); div.className = "p-3 bg-white border rounded-xl text-xs space-y-1 shadow-sm";
                div.innerHTML = `<div class="flex justify-between items-center border-b pb-1"><span class="font-bold text-slate-700">Lần ${index + 1} - Gửi ngày: ${escapeHtml(item.date)}</span><span class="px-2 py-0.5 rounded-full font-bold border text-[10px] ${statusColor}">${escapeHtml(item.status)}</span></div><p class="text-slate-600 mt-1"><strong>Yêu cầu:</strong> ${escapeHtml(item.content)}</p>${item.response ? `<p class="text-amber-900 bg-amber-50 p-2 rounded border border-amber-200 mt-1"><strong>Phản hồi BCN:</strong> ${escapeHtml(item.response)}</p>` : `<p class="text-slate-400 italic mt-1">Đang chờ Ban Chủ Nhiệm phản hồi...</p>`}`;
                historyList.appendChild(div);
            });
        } else { historyBox.classList.add('hidden'); }
        cardDetail.classList.remove('hidden');
    } else {
        cardDetail.classList.add('hidden'); msgDiv.innerHTML = `<p class="text-rose-500 font-semibold p-4 bg-rose-50 rounded-xl border border-rose-200"><i class="fa-solid fa-triangle-exclamation"></i> Không tìm thấy thí sinh!</p>`; msgDiv.classList.remove('hidden');
    }
}

function togglePhucTraForm() {
    const box = document.getElementById('phuctra-form-box');
    if (box.classList.contains('hidden')) {
        const candidate = candidateList.find(c => String(c.id) === String(currentLookupCandidateId)); if (!candidate) return;
        const container = document.getElementById('phuctra-checkbox-subjects'); container.innerHTML = '';
        (candidate.subjects || []).forEach(sub => { const label = document.createElement('label'); label.className = "flex items-center gap-2 p-2 bg-slate-50 border rounded-lg cursor-pointer"; label.innerHTML = `<input type="checkbox" name="phuctra-sub" value="${escapeHtml(sub)}" class="rounded text-amber-800"> <span>${escapeHtml(sub)}</span>`; container.appendChild(label); });
        document.getElementById('phuctra-content-input').value = ''; box.classList.remove('hidden');
    } else { box.classList.add('hidden'); }
}

async function handleSubmitPhucTra(e) {
    e.preventDefault();
    const checkedSubs = Array.from(document.querySelectorAll('input[name="phuctra-sub"]:checked')).map(el => el.value);
    if (checkedSubs.length === 0) { alert('Vui lòng chọn ít nhất 1 môn xin phúc tra!'); return; }
    const contentText = document.getElementById('phuctra-content-input').value.trim();
    const candidate = candidateList.find(c => String(c.id) === String(currentLookupCandidateId));
    if (!candidate) return;

    try {
        const { error: insErr } = await supabaseClient.from('candidate_reappeals').insert({
            candidate_id: candidate.id,
            date: new Date().toLocaleDateString('vi-VN'),
            subjects: checkedSubs.join(', '),
            content: `Môn: [${checkedSubs.join(', ')}]. Lý do: ${contentText}`,
            status: 'Đang chờ', response: ''
        });
        if (insErr) throw insErr;

        await reloadAndRenderCandidates();
        alert('Gửi yêu cầu phúc tra thành công!'); togglePhucTraForm(); searchCandidate();
    } catch (err) { alert('Lỗi gửi phúc tra: ' + err.message); }
}

function viewLookupCandidatePrint() { const candidate = candidateList.find(c => String(c.id) === String(currentLookupCandidateId)); if (candidate) { renderPrintCard(candidate, false); } }
function triggerPrintCandidateCard() { document.body.classList.add('print-candidate-mode'); window.print(); document.body.classList.remove('print-candidate-mode'); }

async function searchMemberBook() {
    await loadInitialData(); const keyword = document.getElementById('member-lookup-keyword').value.trim().toLowerCase(); const msgDiv = document.getElementById('member-lookup-result-msg'); const bookContainer = document.getElementById('book-form-container');
    if (!keyword) { alert('Vui lòng nhập Mã TV, SĐT hoặc Email!'); return; }
    const found = memberList.find(m => String(m.id).toLowerCase() === keyword || String(m.phone).toLowerCase() === keyword || String(m.email).toLowerCase() === keyword);
    if (found) {
        currentLookupMemberId = found.id; msgDiv.classList.add('hidden');
        document.getElementById('bf-id').innerText = found.id; document.getElementById('bf-act-id').innerText = found.id; document.getElementById('bf-fullname').innerText = found.fullname; document.getElementById('bf-act-fullname').innerText = found.fullname; document.getElementById('sign-fullname').innerText = found.fullname; document.getElementById('bf-dob').innerText = found.dob; document.getElementById('bf-gender').innerText = found.gender; document.getElementById('bf-classroom').innerText = found.classroom; document.getElementById('bf-schoolclub').innerText = found.schoolclub || 'CLB Guitar Cổ Điển'; document.getElementById('bf-role').innerText = found.role || 'Thành viên'; document.getElementById('bf-joindate').innerText = found.joindate; document.getElementById('bf-examdate').innerText = found.examdate || found.joindate; document.getElementById('bf-instruments').innerText = found.instruments;
        if (found.photo) { document.getElementById('bf-photo').src = found.photo; document.getElementById('bf-photo').classList.remove('hidden'); document.getElementById('bf-photo-placeholder').classList.add('hidden'); } else { document.getElementById('bf-photo').classList.add('hidden'); document.getElementById('bf-photo-placeholder').classList.remove('hidden'); }
        const actContainer = document.getElementById('bf-activities-container'); actContainer.innerHTML = ''; const acts = found.activities || [];
        if (acts.length === 0) { actContainer.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-4">Chưa có mốc sinh hoạt nào.</p>`; } else { acts.forEach((a, idx) => { const div = document.createElement('div'); div.className = "p-2.5 bg-slate-50 border border-slate-200 rounded text-xs flex gap-3 items-start"; div.innerHTML = `<span class="font-bold text-amber-900 shrink-0">${idx + 1}. [${escapeHtml(a.date)}]</span><span class="text-slate-700 flex-1">${escapeHtml(a.content)}</span>`; actContainer.appendChild(div); }); }
        bookContainer.classList.remove('hidden');
    } else {
        bookContainer.classList.add('hidden'); msgDiv.innerHTML = `<p class="text-rose-500 font-semibold p-4 bg-rose-50 rounded-xl border border-rose-200"><i class="fa-solid fa-triangle-exclamation"></i> Không tìm thấy sổ thành viên!</p>`; msgDiv.classList.remove('hidden');
    }
}

function triggerPrintMemberBook() { document.body.classList.add('print-member-mode'); window.print(); document.body.classList.remove('print-member-mode'); }

// ==========================================
// 7. KHU VỰC QUẢN TRỊ
// ==========================================
function openAdminModal() {
    if (currentUserRole === 'member') { alert("Bạn không có quyền truy cập khu vực quản trị!"); return; }
    const modal = document.getElementById('admin-modal');
    modal.classList.remove('hidden'); modal.classList.add('flex');
    switchAdminTab('candidates');
}

function closeAdminModal() {
    const modal = document.getElementById('admin-modal');
    modal.classList.add('hidden'); modal.classList.remove('flex');
}

function switchAdminTab(subTab) {
    if (currentUserRole === 'member') return;
    ['admin-section-candidates', 'admin-section-reappeals', 'admin-section-members', 'admin-section-roles'].forEach(id => { const el = document.getElementById(id); if(el) el.classList.add('hidden'); });
    ['admin-tab-btn-candidates', 'admin-tab-btn-reappeals', 'admin-tab-btn-members', 'admin-tab-btn-roles'].forEach(id => {
        const btn = document.getElementById(id);
        if(btn) btn.className = btn.id.includes('roles') ? "px-4 py-2 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold transition whitespace-nowrap" : "px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-xs font-bold transition relative flex items-center gap-1.5 whitespace-nowrap";
    });

    const sec = document.getElementById(`admin-section-${subTab}`);
    if(sec) sec.classList.remove('hidden');

    const activeBtn = document.getElementById(`admin-tab-btn-${subTab}`);
    if(activeBtn) {
        activeBtn.className = subTab === 'roles' ? "px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap" : "px-4 py-2 rounded-lg bg-amber-800 text-white text-xs font-bold transition relative flex items-center gap-1.5 whitespace-nowrap";
    }

    if(subTab === 'candidates') renderAdminCandidates();
    else if(subTab === 'reappeals') renderAdminReappeals();
    else if(subTab === 'members') renderAdminMembers();
    else if(subTab === 'roles') renderRoleManagement();
}

function renderAdminCandidates() {
    const tbody = document.getElementById('admin-table-body'); tbody.innerHTML = '';
    let total = candidateList.length, ltanCount = 0, gcdCount = 0, otherCount = 0;
    candidateList.forEach(c => {
        const subs = c.subjects || []; if (subs.includes('Lý thuyết âm nhạc')) ltanCount++; if (subs.includes('Guitar cổ điển')) gcdCount++; if (subs.includes('Guitar đệm hát') || subs.includes('Thanh nhạc')) otherCount++;
        const tr = document.createElement('tr'); tr.className = "hover:bg-slate-50";
        let statusBadge = c.status === 'ĐỦ' ? `<span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">ĐỦ ĐK</span>` : (c.status === 'KHÔNG ĐỦ' ? `<span class="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">LOẠI</span>` : `<span class="px-2 py-0.5 rounded bg-slate-100 text-slate-600 italic">Chưa xét</span>`);
        let reappealBadge = c.phuctraStatus === 'Đang chờ' ? `<span class="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">Đang chờ</span>` : (c.phuctraStatus === 'Đã duyệt' ? `<span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">Đã duyệt</span>` : `<span class="text-slate-400">-</span>`);
        const currentDTB = calculateDTB(c.scores, subs);
        tr.innerHTML = `<td class="p-3 font-mono font-bold text-amber-900">${c.id}</td><td class="p-3 font-bold text-slate-800">${escapeHtml(c.fullname)}</td><td class="p-3 font-mono text-blue-900">${escapeHtml(c.sbd) || '-'}</td><td class="p-3">${escapeHtml(c.classroom)}</td><td class="p-3">${subs.join(', ')}</td><td class="p-3 font-extrabold text-amber-900">${currentDTB !== '' ? currentDTB : '-'}</td><td class="p-3">${reappealBadge}</td><td class="p-3">${statusBadge}</td><td class="p-3 text-center space-x-1"><button onclick="openEditModal('${c.id}')" class="px-2.5 py-1 bg-amber-800 hover:bg-amber-900 text-white rounded font-bold" title="Sửa"><i class="fa-solid fa-pen-to-square"></i></button><button onclick="printCandidateFromAdmin('${c.id}')" class="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold" title="In"><i class="fa-solid fa-print"></i></button><button onclick="deleteCandidate('${c.id}')" class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold" title="Xóa"><i class="fa-solid fa-trash"></i></button></td>`;
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
    const tbody = document.getElementById('admin-reappeals-table-body'); tbody.innerHTML = '';
    const reappealList = candidateList.filter(c => c.phuctraStatus === 'Đang chờ' || (c.phuctraHistory && c.phuctraHistory.some(h => h.status === 'Đang chờ')));
    if (reappealList.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400 italic">Không có yêu cầu phúc tra nào.</td></tr>`; return; }
    reappealList.forEach(c => {
        const tr = document.createElement('tr'); tr.className = "hover:bg-slate-50";
        let latestHistory = (c.phuctraHistory || []).slice(-1)[0]; let contentText = latestHistory ? latestHistory.content : c.phuctra;
        tr.innerHTML = `<td class="p-3 font-mono font-bold text-amber-900">${c.id}</td><td class="p-3 font-bold text-slate-800">${escapeHtml(c.fullname)}</td><td class="p-3 text-slate-700">${escapeHtml(contentText)}</td><td class="p-3"><span class="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">Chờ duyệt</span></td><td class="p-3 text-center"><button onclick="openReappealRespondModal('${c.id}')" class="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded font-bold shadow flex items-center gap-1 mx-auto"><i class="fa-solid fa-reply"></i> Phản Hồi</button></td>`;
        tbody.appendChild(tr);
    });
}

function openReappealRespondModal(id) {
    const c = candidateList.find(item => item.id === id); if (!c) return;
    document.getElementById('resp-candidate-id').value = c.id; document.getElementById('resp-candidate-name').innerText = c.fullname;
    let latestHistory = (c.phuctraHistory || []).slice(-1)[0]; document.getElementById('resp-candidate-content').innerText = latestHistory ? latestHistory.content : c.phuctra;
    const container = document.getElementById('resp-scores-table-container'); container.innerHTML = '';
    (c.subjects || []).forEach(sub => {
        const div = document.createElement('div'); div.className = "flex justify-between items-center gap-2 p-2 bg-slate-50 border rounded";
        div.innerHTML = `<span class="font-bold text-slate-700">${escapeHtml(sub)}:</span><input type="number" step="0.1" min="0" max="10" id="resp-score-${escapeHtml(sub)}" value="${escapeHtml(c.scores && c.scores[sub] !== undefined ? c.scores[sub] : '')}" placeholder="Nhập điểm..." class="custom-input py-1 w-32">`; container.appendChild(div);
    });
    document.getElementById('resp-note-input').value = ''; document.getElementById('reappeal-respond-modal').classList.remove('hidden'); document.getElementById('reappeal-respond-modal').classList.add('flex');
}

function closeReappealRespondModal() { document.getElementById('reappeal-respond-modal').classList.add('hidden'); document.getElementById('reappeal-respond-modal').classList.remove('flex'); }

async function acceptReappeal() {
    const id = document.getElementById('resp-candidate-id').value; const c = candidateList.find(item => item.id === id); if (!c) return;
    const newScores = { ...c.scores };
    (c.subjects || []).forEach(sub => { const el = document.getElementById(`resp-score-${sub}`); if (el) newScores[sub] = el.value; });
    const newDtb = calculateDTB(newScores, c.subjects);
    const responseText = document.getElementById('resp-note-input').value.trim() || 'Đã kiểm tra lại bài thi, điểm số đã được cập nhật.';
    const latest = (c.phuctraHistory || []).slice(-1)[0];

    try {
        for (const sub of (c.subjects || [])) {
            await supabaseClient.from('candidate_subjects').update({ score: newScores[sub] || '' }).eq('candidate_id', id).eq('subject_name', sub);
        }
        await supabaseClient.from('candidates').update({ dtb: newDtb }).eq('id', id);
        if (latest && latest._dbId) {
            await supabaseClient.from('candidate_reappeals').update({ status: 'Đã duyệt', response: responseText }).eq('id', latest._dbId);
        }
        await reloadAndRenderCandidates();
        alert('Đã cập nhật điểm thành công!'); closeReappealRespondModal(); renderAdminReappeals(); renderAdminCandidates();
    } catch (err) { alert('Lỗi cập nhật: ' + err.message); }
}

async function rejectReappeal() {
    const id = document.getElementById('resp-candidate-id').value; const c = candidateList.find(item => item.id === id); if (!c) return;
    const responseText = document.getElementById('resp-note-input').value.trim() || 'Bài chấm đã đúng đáp án, giữ nguyên điểm cũ.';
    const latest = (c.phuctraHistory || []).slice(-1)[0];

    try {
        if (latest && latest._dbId) {
            await supabaseClient.from('candidate_reappeals').update({ status: 'Từ chối', response: responseText }).eq('id', latest._dbId);
        }
        await reloadAndRenderCandidates();
        alert('Đã từ chối đơn phúc tra.'); closeReappealRespondModal(); renderAdminReappeals(); renderAdminCandidates();
    } catch (err) { alert('Lỗi cập nhật: ' + err.message); }
}

function renderAdminMembers() {
    const tbody = document.getElementById('admin-member-table-body'); tbody.innerHTML = '';
    let totalM = memberList.length; let bcnM = memberList.filter(m => m.role === 'Chủ nhiệm' || m.role === 'Phó chủ nhiệm').length; let regM = totalM - bcnM;
    memberList.forEach(m => {
        const tr = document.createElement('tr'); tr.className = "hover:bg-slate-50";
        tr.innerHTML = `<td class="p-3 font-mono font-bold text-amber-900">${m.id}</td><td class="p-3 font-bold text-slate-800">${escapeHtml(m.fullname)}</td><td class="p-3">${escapeHtml(m.classroom)}</td><td class="p-3"><span class="px-2 py-0.5 rounded font-bold ${m.role === 'Chủ nhiệm' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}">${escapeHtml(m.role)}</span></td><td class="p-3">${escapeHtml(m.instruments)}</td><td class="p-3 font-mono">${escapeHtml(m.phone)}</td><td class="p-3 text-center space-x-1"><button onclick="openMemberModal('${m.id}')" class="px-2.5 py-1 bg-amber-800 hover:bg-amber-900 text-white rounded font-bold"><i class="fa-solid fa-pen-to-square"></i></button><button onclick="printMemberFromAdmin('${m.id}')" class="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold"><i class="fa-solid fa-print"></i></button><button onclick="deleteMember('${m.id}')" class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold"><i class="fa-solid fa-trash"></i></button></td>`;
        tbody.appendChild(tr);
    });
    document.getElementById('stat-m-total').innerText = totalM; document.getElementById('stat-m-bcn').innerText = bcnM; document.getElementById('stat-m-reg').innerText = regM;
}

function filterAdminMemberTable() {
    const keyword = document.getElementById('admin-member-search').value.toLowerCase(); const roleFilter = document.getElementById('admin-member-role').value;
    const tbody = document.getElementById('admin-member-table-body'); const rows = tbody.getElementsByTagName('tr');
    for (let r of rows) { const text = r.innerText.toLowerCase(); const matchKeyword = text.includes(keyword); const matchRole = roleFilter === "" || text.includes(roleFilter.toLowerCase()); if (matchKeyword && matchRole) { r.style.display = ""; } else { r.style.display = "none"; } }
}

async function renderRoleManagement() {
    if (currentUserRole !== 'owner') return;
    const tbody = document.getElementById('admin-roles-table-body');
    tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center">Đang tải...</td></tr>';

    const { data: profiles, error } = await supabaseClient.from('profiles').select('*').order('role');
    if (error) return;

    tbody.innerHTML = '';
    const { data: { user } } = await supabaseClient.auth.getUser();

    profiles.forEach(p => {
        const isMe = p.email === user.email;
        let roleOptions = '';
        let transferBtn = '';

        if (p.role === 'owner') {
            roleOptions = `<span class="px-2 py-0.5 font-bold text-rose-600 bg-rose-50 rounded"><i class="fa-solid fa-crown"></i> Chủ Club</span>`;
        } else {
            roleOptions = `
                <select onchange="updateRole('${p.id}', this.value)" class="custom-input py-1 w-auto inline-block text-xs font-bold">
                    <option value="member" ${p.role === 'member' ? 'selected' : ''}>Thành viên</option>
                    <option value="admin" ${p.role === 'admin' ? 'selected' : ''}>Quản trị viên</option>
                </select>
            `;
            transferBtn = `<button onclick="transferOwnership('${p.id}', '${escapeHtml(p.email)}')" class="ml-2 px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded text-[10px] font-bold"><i class="fa-solid fa-crown"></i> Nhượng Quyền</button>`;
        }

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50">
                <td class="p-3 font-mono text-slate-400 text-[10px]">${escapeHtml(p.id)} ${isMe ? '(Bạn)' : ''}</td>
                <td class="p-3 font-bold text-slate-700">${escapeHtml(p.email)}</td>
                <td class="p-3 text-center">${roleOptions} ${transferBtn}</td>
            </tr>
        `;
    });
}

async function updateRole(userId, newRole) {
    if (currentUserRole !== 'owner') return;
    if(confirm(`Xác nhận cấp quyền ${newRole} cho người này?`)) {
        await supabaseClient.from('profiles').update({ role: newRole }).eq('id', userId);
        renderRoleManagement();
    }
}

async function transferOwnership(targetUserId, targetEmail) {
    if (currentUserRole !== 'owner') return;
    if(confirm(`Nhượng quyền CHỦ CLUB cho ${targetEmail}?`)) {
        const { data: { user } } = await supabaseClient.auth.getUser();
        await supabaseClient.from('profiles').update({ role: 'owner' }).eq('id', targetUserId);
        await supabaseClient.from('profiles').update({ role: 'admin' }).eq('id', user.id);
        alert("Đã nhượng quyền thành công.");
        location.reload();
    }
}

async function openAddCandidateModal() {
    const newId = 'HB' + Date.now().toString().slice(-6);
    try {
        await supabaseClient.from('candidates').insert({
            id: newId, fullname: "Thí sinh mới", dob: "2008-01-01", gender: "Nam", school: "THPT Hồng Bàng",
            classroom: "10A1", phone: "0900000000", email: "new@gmail.com", photo: "",
            sbd: "CGC-" + Math.floor(100 + Math.random() * 900), dtb: "", phuctra: "Không",
            phuctra_status: "Chưa phúc tra", status: "Chưa xét", rank: ""
        });
        await supabaseClient.from('candidate_subjects').insert([
            { candidate_id: newId, subject_name: "Lý thuyết âm nhạc", room: "P.101", score: "" },
            { candidate_id: newId, subject_name: "Guitar cổ điển", room: "P.102", score: "" }
        ]);
        await reloadAndRenderCandidates();
        openEditModal(newId);
    } catch (err) { alert('Lỗi tạo hồ sơ: ' + err.message); }
}

function openEditModal(id) {
    const c = candidateList.find(item => item.id === id); if (!c) return;
    document.getElementById('edit-id').value = c.id; document.getElementById('edit-id-display').value = c.id; document.getElementById('edit-fullname').value = c.fullname; document.getElementById('edit-dob').value = c.dob; document.getElementById('edit-gender').value = c.gender; document.getElementById('edit-classroom').value = c.classroom; document.getElementById('edit-phone').value = c.phone; document.getElementById('edit-email').value = c.email; document.getElementById('edit-sbd').value = c.sbd || ''; document.getElementById('edit-phuctra').value = c.phuctra || 'Không'; document.getElementById('edit-status').value = c.status || 'Chưa xét'; document.getElementById('edit-rank').value = c.rank || 'CHÍNH THỨC';
    currentEditPhotoBase64 = c.photo || '';
    editPhotoFile = null;
    document.getElementById('edit-photo').value = '';
    const editAvatarImg = document.getElementById('edit-avatar-preview'); const editAvatarIcon = document.getElementById('edit-avatar-placeholder-icon');
    if (c.photo) { editAvatarImg.src = c.photo; editAvatarImg.classList.remove('hidden'); editAvatarIcon.classList.add('hidden'); }
    else { editAvatarImg.src = ''; editAvatarImg.classList.add('hidden'); editAvatarIcon.classList.remove('hidden'); }
    const subs = c.subjects || ["Lý thuyết âm nhạc", "Guitar cổ điển"]; const optSub = subs.find(s => s !== "Lý thuyết âm nhạc") || "Guitar cổ điển";
    document.querySelectorAll('input[name="edit-optional-sub"]').forEach(radio => { if (radio.value === optSub) radio.checked = true; });
    const roomsContainer = document.getElementById('edit-rooms-inputs-container'); roomsContainer.innerHTML = '';
    subs.forEach(sub => { const div = document.createElement('div'); div.innerHTML = `<label class="form-label">Phòng thi (${escapeHtml(sub)})</label><input type="text" id="edit-room-${escapeHtml(sub)}" value="${escapeHtml(c.rooms && c.rooms[sub] ? c.rooms[sub] : '')}" placeholder="VD: P.101" class="custom-input">`; roomsContainer.appendChild(div); });
    const scoresContainer = document.getElementById('edit-scores-inputs-container'); scoresContainer.innerHTML = '';
    subs.forEach(sub => { const div = document.createElement('div'); div.innerHTML = `<label class="form-label">Điểm (${escapeHtml(sub)})</label><input type="number" step="0.1" min="0" max="10" id="edit-score-${escapeHtml(sub)}" value="${escapeHtml(c.scores && c.scores[sub] !== undefined ? c.scores[sub] : '')}" class="custom-input font-bold text-amber-900">`; scoresContainer.appendChild(div); });
    toggleRankVisibility(); document.getElementById('edit-modal').classList.remove('hidden'); document.getElementById('edit-modal').classList.add('flex');
}

function closeEditModal() { document.getElementById('edit-modal').classList.add('hidden'); document.getElementById('edit-modal').classList.remove('flex'); }

function toggleRankVisibility() { const status = document.getElementById('edit-status').value; const rankBox = document.getElementById('edit-rank-box'); if (status === 'ĐỦ') { rankBox.classList.remove('hidden'); } else { rankBox.classList.add('hidden'); } }

async function handleSaveEdit(e) {
    e.preventDefault(); const id = document.getElementById('edit-id').value; const c = candidateList.find(item => item.id === id); if (!c) return;
    const optRadio = document.querySelector('input[name="edit-optional-sub"]:checked'); const optSubVal = optRadio ? optRadio.value : "Guitar cổ điển"; const newSubs = ["Lý thuyết âm nhạc", optSubVal];

    let newRooms = {}; newSubs.forEach(sub => { const el = document.getElementById(`edit-room-${sub}`); if (el) newRooms[sub] = el.value.trim(); });
    let newScores = {}; newSubs.forEach(sub => { const el = document.getElementById(`edit-score-${sub}`); if (el) newScores[sub] = el.value.trim(); });
    const newDtb = calculateDTB(newScores, newSubs);

    let photoUrl = currentEditPhotoBase64;
    try {
        if (editPhotoFile) { photoUrl = await uploadPhotoToStorage(editPhotoFile, `candidate-${id}`); }
    } catch (err) { alert('Lỗi tải ảnh lên: ' + err.message); return; }

    const updatedRow = {
        fullname: document.getElementById('edit-fullname').value.trim(), dob: document.getElementById('edit-dob').value,
        gender: document.getElementById('edit-gender').value, classroom: document.getElementById('edit-classroom').value.trim(),
        phone: document.getElementById('edit-phone').value.trim(), email: document.getElementById('edit-email').value.trim(),
        sbd: document.getElementById('edit-sbd').value.trim(), phuctra: document.getElementById('edit-phuctra').value.trim(),
        status: document.getElementById('edit-status').value, rank: document.getElementById('edit-rank').value, dtb: newDtb,
        photo: photoUrl
    };

    try {
        await supabaseClient.from('candidates').update(updatedRow).eq('id', id);
        await supabaseClient.from('candidate_subjects').delete().eq('candidate_id', id);
        await supabaseClient.from('candidate_subjects').insert(newSubs.map(sub => ({
            candidate_id: id, subject_name: sub, room: newRooms[sub] || '', score: newScores[sub] || ''
        })));
        await reloadAndRenderCandidates();
        alert('Lưu hồ sơ thành công!'); closeEditModal(); renderAdminCandidates();
    } catch (err) { alert('Lỗi lưu: ' + err.message); }
}

function printCandidateFromAdmin(id) { const c = candidateList.find(item => item.id === id); if (c) { closeAdminModal(); renderPrintCard(c, true); } }

async function deleteCandidate(id) {
    if (!confirm('Chắc chắn xóa thí sinh này?')) return;
    try {
        await supabaseClient.from('candidates').delete().eq('id', id);
        await reloadAndRenderCandidates(); renderAdminCandidates();
    } catch (err) { alert('Lỗi xóa: ' + err.message); }
}

async function deleteAllCandidates() {
    if (!confirm('CẢNH BÁO: Xóa tất cả hồ sơ thí sinh?')) return;
    try {
        await supabaseClient.from('candidates').delete().neq('id', '__none__');
        await reloadAndRenderCandidates(); renderAdminCandidates();
    } catch (err) { alert('Lỗi xóa: ' + err.message); }
}

async function openMemberAddModal() {
    const newId = 'HB' + Date.now().toString().slice(-6);
    const today = new Date().toISOString().split('T')[0];
    try {
        await supabaseClient.from('members').insert({
            id: newId, fullname: "Thành viên mới", dob: "2008-01-01", gender: "Nam", classroom: "10A1",
            schoolclub: "CLB Guitar Cổ Điển", role: "Thành viên", phone: "0900000000", email: "member@gmail.com",
            instruments: "Guitar Cổ Điển", joindate: today, examdate: today, photo: ""
        });
        await supabaseClient.from('member_activities').insert({ member_id: newId, date: today, content: "Chính thức gia nhập Câu lạc bộ." });
        await reloadAndRenderMembers();
        openMemberModal(newId);
    } catch (err) { alert('Lỗi tạo sổ: ' + err.message); }
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
        const div = document.createElement('div'); div.className = "flex gap-2 items-center bg-white p-2 border rounded shadow-sm";
        div.innerHTML = `<input type="date" value="${escapeHtml(a.date)}" class="act-date custom-input py-1 text-xs"><input type="text" value="${escapeHtml(a.content)}" placeholder="Nội dung..." class="act-content flex-1 custom-input py-1 text-xs"><button type="button" onclick="this.parentElement.remove()" class="text-rose-600 hover:text-rose-800 font-bold px-2">&times;</button>`; container.appendChild(div);
    });
}

function addActivityRow() {
    const container = document.getElementById('activities-input-list'); const today = new Date().toISOString().split('T')[0];
    const div = document.createElement('div'); div.className = "flex gap-2 items-center bg-white p-2 border rounded shadow-sm";
    div.innerHTML = `<input type="date" value="${today}" class="act-date custom-input py-1 text-xs"><input type="text" value="Ghi nhận hoạt động..." class="act-content flex-1 custom-input py-1 text-xs"><button type="button" onclick="this.parentElement.remove()" class="text-rose-600 hover:text-rose-800 font-bold px-2">&times;</button>`; container.appendChild(div);
}

async function handleSaveMember(e) {
    e.preventDefault(); const id = document.getElementById('edit-member-id').value; const m = memberList.find(item => item.id === id); if (!m) return;
    const updatedRow = {
        fullname: document.getElementById('m-fullname').value.trim(), dob: document.getElementById('m-dob').value,
        gender: document.getElementById('m-gender').value, classroom: document.getElementById('m-classroom').value.trim(),
        role: document.getElementById('m-role').value, phone: document.getElementById('m-phone').value.trim(),
        email: document.getElementById('m-email').value.trim(), instruments: document.getElementById('m-instruments').value.trim(),
        joindate: document.getElementById('m-joindate').value
    };
    let newActs = []; const rows = document.querySelectorAll('#activities-input-list > div');
    rows.forEach(r => { const d = r.querySelector('.act-date').value; const c = r.querySelector('.act-content').value.trim(); if (c) { newActs.push({ member_id: id, date: d, content: c }); } });

    try {
        await supabaseClient.from('members').update(updatedRow).eq('id', id);
        await supabaseClient.from('member_activities').delete().eq('member_id', id);
        if (newActs.length > 0) { await supabaseClient.from('member_activities').insert(newActs); }
        await reloadAndRenderMembers();
        alert('Lưu sổ thành công!'); closeMemberModal(); renderAdminMembers();
    } catch (err) { alert('Lỗi lưu sổ: ' + err.message); }
}

function printMemberFromAdmin(id) { const m = memberList.find(item => item.id === id); if (m) { closeAdminModal(); switchTab('member-book'); document.getElementById('member-lookup-keyword').value = m.id; searchMemberBook(); } }

async function deleteMember(id) {
    if (!confirm('Chắc chắn xóa sổ này?')) return;
    try {
        await supabaseClient.from('members').delete().eq('id', id);
        await reloadAndRenderMembers(); renderAdminMembers();
    } catch (err) { alert('Lỗi xóa: ' + err.message); }
}

function exportCandidatesExcel() {
    let dataExport = candidateList.map(c => ({ "Mã Phiếu": c.id, "Họ Tên": c.fullname, "SBD": c.sbd, "Lớp": c.classroom, "Trường": c.school, "SĐT": c.phone, "Email": c.email, "Môn Thi": (c.subjects || []).join(', '), "Điểm TB": c.dtb, "Trạng Thái Xét Tuyển": c.status, "Xếp Loại": c.rank }));
    const worksheet = XLSX.utils.json_to_sheet(dataExport); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, "DanhSachThiSinh"); XLSX.writeFile(workbook, "DanhSachThiSinh_HB3.xlsx");
}

function exportMembersExcel() {
    let dataExport = memberList.map(m => ({ "Mã TV": m.id, "Họ Tên": m.fullname, "Ngày Sinh": m.dob, "Giới Tính": m.gender, "Lớp": m.classroom, "Chức Vụ": m.role, "Nhạc Cụ": m.instruments, "SĐT": m.phone, "Email": m.email, "Ngày Vào CLB": m.joindate }));
    const worksheet = XLSX.utils.json_to_sheet(dataExport); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, "SoThanhVien"); XLSX.writeFile(workbook, "SoThanhVien_HB3.xlsx");
}
