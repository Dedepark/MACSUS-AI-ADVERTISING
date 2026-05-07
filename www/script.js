/* --- PENGAMAN SPLASH SCREEN (HARUS PALING ATAS) --- */
window.addEventListener('DOMContentLoaded', () => {
  const splashScreen = document.getElementById('splash-screen');
  const splashVideo = document.getElementById('splash-video');
  
  setTimeout(() => {
    if (splashScreen) splashScreen.classList.add('hidden');
  }, 2500);

  if (splashVideo) {
    splashVideo.addEventListener('loadeddata', () => {
      splashVideo.classList.add('show');
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = splashVideo.videoWidth; 
        canvas.height = splashVideo.videoHeight;
        ctx.drawImage(splashVideo, 0, 0, canvas.width, canvas.height);
        splashScreen.style.backgroundColor = `rgb(${ctx.getImageData(0, 0, 1, 1).data.slice(0,3).join(',')})`;
      } catch(e) {}
    });
    splashVideo.addEventListener('ended', () => splashScreen.classList.add('hidden'));
    splashVideo.addEventListener('error', () => splashScreen.classList.add('hidden'));
  }
});

/* --- KONFIGURASI SUPABASE --- */
const SUPABASE_URL = 'https://kgwelybjmxvvwckyewfu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtnd2VseWJqbXh2dndja3lld2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwOTc0MTMsImV4cCI6MjA5MzY3MzQxM30.nt2R0iFFgDcd3nnPznPYq_0WHcKhw23AHD9_luiD_4Q';

let supabaseClient = null;
let currentUser = null;

try {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error("Supabase CDN belum ter-load!");
  }
} catch (error) {
  console.error("Gagal inisialisasi Supabase:", error);
}

/* Register Service Worker */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker terdaftar!'))
      .catch(err => console.log('SW Gagal:', err));
  });
}

/* PWA Install Logic */
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('btn-install-pwa').style.display = 'block';
});

async function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      document.getElementById('btn-install-pwa').style.display = 'none';
    }
    deferredPrompt = null;
  }
}

/* State & Storage Riwayat */
let currentMode = null;
let currentTab  = 0;
let historyData = []; 

/* --- LOGIKA AUTHENTICATION & FETCH DB --- */
if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      if (session) {
        currentUser = session.user;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('user-email-display').innerText = currentUser.email;
        await fetchUserHistory(); 
      } else {
        document.getElementById('auth-screen').classList.remove('hidden');
      }
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      historyData = [];
      renderSidebar();
      document.getElementById('auth-screen').classList.remove('hidden');
      document.getElementById('user-email-display').innerText = 'Content Generator';
    }
  });
}

async function fetchUserHistory() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from('user_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50); 
    
    if (error) {
      console.error("Supabase Error (Load History):", error.message);
      return;
    }
    
    if (data) {
      historyData = data.map(item => ({
        id: item.id,
        title: item.title,
        mode: item.mode,
        date: new Date(item.created_at).toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }),
        data: item.data
      }));
      renderSidebar();
    }
  } catch(err) {
    console.error("Gagal mengeksekusi load history:", err);
  }
}

async function handleAuth(action) {
  if (!supabaseClient) {
    alert("Sistem database belum siap, cek koneksi atau CDN!");
    return;
  }
  
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errDiv = document.getElementById('auth-error');
  const btnLogin = document.getElementById('btn-login');
  const btnReg = document.getElementById('btn-register');
  
  if (!email || !password) {
    errDiv.innerText = 'Email dan Password wajib diisi.';
    return;
  }

  errDiv.innerText = '';
  btnLogin.disabled = true;
  btnReg.disabled = true;

  try {
    let error;
    if (action === 'register') {
      const { data, error: signUpError } = await supabaseClient.auth.signUp({ email, password });
      error = signUpError;
      if (!error && data.user) {
        showToast('Berhasil daftar! Silakan masuk.');
      }
    } else {
      const { error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password });
      error = signInError;
    }
    if (error) throw error;
  } catch (error) {
    errDiv.innerText = error.message.includes('Invalid login') 
      ? 'Email atau password salah.' 
      : error.message;
  } finally {
    btnLogin.disabled = false;
    btnReg.disabled = false;
  }
}

async function handleLogout() {
  if(!supabaseClient) return;
  const btn = document.querySelector('#app-sidebar .btn-danger');
  
  try {
    // Memberikan indikator proses agar UI tidak terasa macet
    if(btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Proses Logout...';
    
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    
    if (document.getElementById('app-sidebar').classList.contains('active')) {
      toggleSidebar();
    }
  } catch(err) {
    alert("Gagal logout: " + err.message);
    console.error("Logout Error:", err);
  } finally {
    if(btn) btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout Akun';
  }
}

/* UI Toggles */
function toggleSidebar() {
  document.getElementById('app-sidebar').classList.toggle('active');
  document.getElementById('sidebar-overlay').classList.toggle('active');
  if(document.getElementById('app-sidebar').classList.contains('active')) renderSidebar();
}

function toggleSettings() {
  document.getElementById('settings-modal').classList.toggle('active');
  document.getElementById('settings-overlay').classList.toggle('active');
}

function newSession() {
  document.getElementById('input-container').style.display = 'block';
  document.getElementById('output-wrapper').classList.remove('visible');
  document.getElementById('serviceInfo').value = '';
  document.getElementById('contentTitle').value = '';
  document.getElementById('reportData').value = '';
  document.getElementById('command').value = '';
  
  if(document.getElementById('gb-name-filter')) document.getElementById('gb-name-filter').value = 'first';
  if(document.getElementById('gb-price-filter')) document.getElementById('gb-price-filter').value = 'no';
  
  if (document.getElementById('app-sidebar').classList.contains('active')) toggleSidebar();
}

function setMode(mode) {
  currentMode = mode;
  document.getElementById('btn-ig').classList.toggle('active', mode === 'ig');
  document.getElementById('btn-gbisnis').classList.toggle('active', mode === 'gbisnis');
  document.getElementById('ig-fields').classList.toggle('visible',  mode === 'ig');
  document.getElementById('gbisnis-fields').classList.toggle('visible',  mode === 'gbisnis');
  document.getElementById('notes-card').classList.add('visible');
  document.getElementById('output-wrapper').classList.remove('visible');
  clearError();
}

function switchTab(idx) {
  currentTab = idx;
  const ids  = ['section-notebooklm', 'section-dokumen', 'section-caption'];
  document.querySelectorAll('#ig-tabs .tab-pill').forEach((p, i) => p.classList.toggle('active', i === idx));
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    el.style.display = i === idx ? 'block' : 'none';
    el.classList.toggle('active', i === idx);
  });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.innerHTML = `<i class="fas fa-check-circle"></i> ${msg || 'Berhasil!'}`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function copySection(id) {
  navigator.clipboard.writeText(document.getElementById(id).innerText).then(() => showToast('Teks disalin!'));
}

function copyAll() {
  let full = '';
  ['notebooklm-body', 'dokumen-body', 'caption-body', 'gbisnis-body'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.innerText.trim()) full += el.innerText + '\n\n---\n\n';
  });
  navigator.clipboard.writeText(full.trim()).then(() => showToast('Semua disalin!'));
}

function setError(html) {
  document.getElementById('error-text').innerHTML = html;
  document.getElementById('error-box').classList.add('visible');
}
function clearError() { document.getElementById('error-box').classList.remove('visible'); }

function setLoading(on) {
  document.getElementById('submit-btn').disabled = on;
  document.getElementById('loading-box').classList.toggle('visible', on);
  if (on) document.getElementById('output-wrapper').classList.remove('visible');
}

function updateCharCounter(count) {
  const fill = document.getElementById('char-fill'), label = document.getElementById('char-label');
  fill.style.width = Math.min((count / 1500) * 100, 100) + '%';
  fill.className = 'char-fill ' + (count > 1500 ? 'over' : 'ok');
  label.textContent = `${count} / 1500`;
  label.className = 'char-text' + (count > 1500 ? ' over' : '');
}

/* --- SAVE HISTORY KE SUPABASE --- */
async function saveSession(title, mode, dataObj) {
  if (!currentUser || !supabaseClient) return;

  const realTitle = title || (mode === 'gbisnis' ? 'Google Bisnis Post' : 'Tanpa Judul');
  
  try {
    const { data, error } = await supabaseClient
      .from('user_history')
      .insert([{ 
        user_id: currentUser.id, 
        title: realTitle, 
        mode: mode, 
        data: dataObj 
      }])
      .select();

    if (error) {
      console.error("Gagal Save History:", error.message);
      return;
    }

    if (data && data.length > 0) {
      const item = data[0];
      historyData.unshift({ 
        id: item.id, 
        title: item.title, 
        mode: item.mode, 
        date: new Date(item.created_at).toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }), 
        data: item.data 
      });
      if(historyData.length > 50) historyData.pop();
      renderSidebar();
    }
  } catch(err) {
    console.error("Sistem error saat save history:", err);
  }
}

function renderSidebar() {
  const list = document.getElementById('history-list');
  list.innerHTML = historyData.length === 0 ? '<p style="color:var(--t3); font-size:12px; text-align:center; margin-top:20px;">Belum ada riwayat.</p>' : '';
  historyData.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'history-item';
    btn.onclick = () => loadSession(item.id);
    btn.innerHTML = `<span class="hist-title">${item.title}</span><div class="hist-meta"><span class="hist-mode ${item.mode === 'ig' ? 'ig' : 'gb'}">${item.mode === 'ig' ? 'Instagram' : 'G-Bisnis'}</span><span>${item.date}</span></div>`;
    list.appendChild(btn);
  });
}

function loadSession(id) {
  const session = historyData.find(s => s.id === id);
  if(!session) return;
  toggleSidebar();
  document.getElementById('input-container').style.display = 'none';
  setMode(session.mode);
  document.getElementById('output-title').innerText = session.title;
  
  if (session.mode === 'ig') {
    document.getElementById('notebooklm-body').innerText = session.data.nb;
    document.getElementById('dokumen-body').innerText = session.data.dok;
    document.getElementById('caption-body').innerText = session.data.cap;
    document.getElementById('ig-tabs').style.display = 'flex';
    document.getElementById('section-gbisnis').style.display = 'none';
    document.getElementById('section-gbisnis').classList.remove('active');
    switchTab(0);
  } else {
    document.getElementById('gbisnis-body').innerText = session.data.gb;
    updateCharCounter(session.data.gb.length);
    document.getElementById('ig-tabs').style.display = 'none';
    ['section-notebooklm', 'section-dokumen', 'section-caption'].forEach(id => { document.getElementById(id).style.display = 'none'; document.getElementById(id).classList.remove('active'); });
    document.getElementById('section-gbisnis').style.display = 'block';
    document.getElementById('section-gbisnis').classList.add('active');
  }
  document.getElementById('output-wrapper').classList.add('visible');
}

/* --- HAPUS HISTORY DI SUPABASE --- */
async function clearHistory() {
  if(confirm("Yakin ingin menghapus semua riwayat di akun ini?")) {
    if (currentUser && supabaseClient) {
      await supabaseClient.from('user_history').delete().eq('user_id', currentUser.id);
    }
    historyData = [];
    toggleSettings();
    renderSidebar();
    showToast("Riwayat akun berhasil dihapus!");
  }
}

/* --- LOGIKA AMBIL API KEY DARI DATABASE --- */
async function fetchGeminiKey() {
  if(!supabaseClient) throw new Error("Sistem database belum terhubung dengan baik.");
  
  try {
    const { data, error } = await supabaseClient
      .from('app_settings')
      .select('key_value')
      .eq('key_name', 'gemini_api')
      .single();

    if (error) {
      console.error("Supabase Error (Fetch Key):", error.message);
      throw new Error("Gagal mengambil kunci API. Pastikan RLS di tabel app_settings mengizinkan akses READ.");
    }
    
    if (!data) throw new Error("API Key tidak ditemukan di dalam database.");
    
    return data.key_value;
  } catch(err) {
    throw new Error(err.message);
  }
}

/* --- MAIN GENERATE FUNCTION --- */
async function generateAds() {
  const serviceInfo = document.getElementById('serviceInfo').value.trim();
  const contentTitle= document.getElementById('contentTitle').value.trim();
  const reportData  = document.getElementById('reportData').value.trim();
  const command     = document.getElementById('command').value.trim();
  
  clearError();
  if (!currentMode) return setError('Pilih mode konten terlebih dahulu.');
  if (currentMode === 'ig' && !serviceInfo) return setError('Harap isi kolom <strong>Layanan / Masalah</strong>.');
  if (currentMode === 'ig' && !contentTitle) return setError('Harap isi <strong>Judul / Topik Konten IG</strong>.');
  if (currentMode === 'gbisnis' && !reportData) return setError('Harap paste <strong>data report pelanggan</strong>.');
    
  setLoading(true);
  
  try {
    const API_KEY = await fetchGeminiKey();

    let prompt = '';
    if (currentMode === 'ig') {
      prompt = `Anda adalah asisten periklanan senior untuk Macsus Company. DATA PERUSAHAAN (wajib selalu digunakan): - Nama: Macsus Company - Layanan: Jasa servis & perbaikan laptop (hardware + software) di Surabaya & Sidoarjo - Hardware: Overheat treatment, ganti thermal paste, penggantian layar, perbaikan motherboard, water spill treatment - Software: Optimasi sistem, install ulang, remove virus - Keunggulan: Teknisi ahli, pengerjaan cepat & transparan, harga terjangkau, free diagnosa - Alamat: Jl. Keputih Makam Blk. E No.26, Keputih, Kec. Sukolilo, Surabaya, Jawa Timur 60295 - WhatsApp: 0858-5256-1993 - Hashtag utama: #MacsusCompany #ServiceLaptopSurabaya INPUT: - Layanan hari ini: ${serviceInfo} - Judul/Topik Konten IG: ${contentTitle} ${command ? `- Catatan tambahan: ${command}` : ''} TUGAS: Buat 3 output berikut secara lengkap dan dipisah dengan jelas: ===OUTPUT 1: PROMPT NOTEBOOKLM=== Tulis prompt instruksi untuk NotebookLM agar membuat konten slide IG vertikal (rasio 4:5 / Portrait) mengatasnamakan Macsus Company. Prompt harus menyebut nama dokumen sumber yang akan dibuat di Output 2, menyebutkan hook yang kuat, poin-poin konten utama, dan CTA layanan Macsus yang relevan. ===OUTPUT 2: DOKUMEN SUMBER DATA=== Buat dokumen sumber teks teknis dengan nama "DIAGNOSA [TOPIK] MACSUS COMPANY" yang akan digunakan sebagai basis data di NotebookLM. Isi dengan: analisis gejala/masalah, langkah diagnosa mandiri yang bisa dilakukan user, value preposition layanan Macsus untuk masalah ini. Format dengan bullet points yang informatif. ===OUTPUT 3: CAPTION INSTAGRAM=== Buat caption IG yang menarik dengan struktur: Headline all-caps dengan emoji relevan, paragraf pembuka yang relatable dan bikin orang penasaran, numbered list langkah atau tips praktis, paragraf solusi Macsus dengan checklist, info lokasi & WhatsApp, dan hashtag yang relevan (min. 10 hashtag). Pastikan ketiga output terpisah jelas dengan header masing-masing. PENTING: DILARANG KERAS menggunakan markdown bintang ganda (**) untuk menebalkan teks. Gunakan teks biasa saja, tapi kamu boleh menggunakan emoji.`;
    } else {
      const gbNameFilter = document.getElementById('gb-name-filter') ? document.getElementById('gb-name-filter').value : 'first';
      const gbPriceFilter = document.getElementById('gb-price-filter') ? document.getElementById('gb-price-filter').value : 'no';
      let nameInstruction = gbNameFilter === 'full' ? "- Sebutkan NAMA LENGKAP pelanggan sesuai data." : "- Jangan sebut nama lengkap pelanggan, cukup sebut NAMA DEPAN atau panggilan akrab saja.";
      let priceInstruction = gbPriceFilter === 'yes' ? "- Sebutkan BIAYA atau HARGA perbaikan jika ada di dalam data." : "- DILARANG KERAS menyebutkan biaya atau harga perbaikan sama sekali.";
      prompt = `Kamu adalah seorang IT consultant spesialis laptop dan PC. Kamu diminta membuat storytelling berbasis Google Business untuk Macsus Company dengan ketentuan berikut: - Gaya bahasa Gen Z: santai, relatable, sedikit lebay/hiperbola tapi tetap informatif - Nada: persuasif, menyentuh perasaan pembaca, bikin orang mau langsung ke workshop - Tujuan: meningkatkan income pelanggan Macsus Company dan mendorong kunjungan kantor agar mau maintenance / perbaikan laptop/PC - Maksimal 1500 karakter (hitung dengan ketat, jangan melebihi) ${nameInstruction} ${priceInstruction} - Akhiri dengan info Macsus Company: nama, alamat singkat (Keputih, Sukolilo, Surabaya), dan tagline penutup yang memorable DATA REPORT PELANGGAN: ${reportData} ${command ? `\nCatatan tambahan: ${command}` : ''} PENTING: Output hanya berisi teks storytelling-nya saja, langsung tanpa label/header apapun. Mulai langsung dari kalimat pembuka yang hook. DILARANG KERAS menggunakan markdown bintang ganda (**) untuk menebalkan teks. Gunakan teks biasa saja, tapi kamu boleh menggunakan emoji.`;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
      }
    );
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error dari Google API: ${errText}`);
    }
    
    const data = await response.json();
    let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!rawText) throw new Error('Respons kosong dari AI.');
    rawText = rawText.replace(/\*\*/g, '');
    
    document.getElementById('input-container').style.display = 'none';
    let savedDataObj = currentMode === 'ig' ? parseAndShowIG(rawText, contentTitle) : parseAndShowGBisnis(rawText);
    
    saveSession(currentMode === 'ig' ? contentTitle : (command || 'Google Bisnis Post'), currentMode, savedDataObj);
    
  } catch (err) {
    const msg = err.message.toLowerCase();
    if (msg.includes('503') || msg.includes('429')) {
      setError('<strong>Antrian AI lagi penuh!</strong><br>Coba lagi dalam ~1 menit ya.');
    } else {
      setError('Terjadi kesalahan: ' + err.message);
    }
  } finally {
    setLoading(false);
  }
}

function parseAndShowIG(rawText, title) {
  const o1 = rawText.match(/OUTPUT\s*1[:\s\S]*?(?=OUTPUT\s*2|===OUTPUT\s*2|$)/i);
  const o2 = rawText.match(/OUTPUT\s*2[:\s\S]*?(?=OUTPUT\s*3|===OUTPUT\s*3|$)/i);
  const o3 = rawText.match(/OUTPUT\s*3[:\s\S]*/i);

  let nb = cleanSection(o1 ? o1[0] : rawText, ['OUTPUT 1', 'NOTEBOOKLM', 'PROMPT']);
  let dok = cleanSection(o2 ? o2[0] : '', ['OUTPUT 2', 'DOKUMEN SUMBER', 'SUMBER DATA']);
  let cap = cleanSection(o3 ? o3[0] : '', ['OUTPUT 3', 'CAPTION INSTAGRAM', 'CAPTION']);

  if (!dok && !cap) {
    const parts = rawText.split(/\n={3,}\n/);
    nb = parts[0] ? parts[0].trim() : rawText; dok = parts[1] ? parts[1].trim() : ''; cap = parts[2] ? parts[2].trim() : '';
  }

  document.getElementById('notebooklm-body').innerText = nb || rawText;
  document.getElementById('dokumen-body').innerText = dok || '(Tidak terdeteksi)';
  document.getElementById('caption-body').innerText = cap || '(Tidak terdeteksi)';

  document.getElementById('ig-tabs').style.display = 'flex';
  document.getElementById('section-gbisnis').style.display = 'none';
  document.getElementById('section-gbisnis').classList.remove('active');
  switchTab(0);
  document.getElementById('output-title').innerText = title || 'Konten Instagram';
  document.getElementById('output-wrapper').classList.add('visible');
  return { nb, dok, cap, gb: '' };
}

function parseAndShowGBisnis(rawText) {
  const cleaned = rawText.trim();
  document.getElementById('gbisnis-body').innerText = cleaned;
  updateCharCounter(cleaned.length);
  document.getElementById('ig-tabs').style.display = 'none';
  ['section-notebooklm', 'section-dokumen', 'section-caption'].forEach(id => { document.getElementById(id).style.display = 'none'; document.getElementById(id).classList.remove('active'); });
  document.getElementById('section-gbisnis').style.display = 'block';
  document.getElementById('section-gbisnis').classList.add('active');
  document.getElementById('output-title').innerText = 'Postingan Google Bisnis';
  document.getElementById('output-wrapper').classList.add('visible');
  return { nb: '', dok: '', cap: '', gb: cleaned };
}

function cleanSection(text, headers) {
  if (!text) return '';
  let result = text.trim();
  headers.forEach(h => result = result.replace(new RegExp(`^[=\\s]*${h}[^\\n]*\\n`, 'i'), ''));
  return result.replace(/^===.*===\n?/gm, '').trim();
}

function downloadAPK() { window.location.href = "https://github.com/DedePark/MACSUS-AI-ADVERTISING/releases/download/latest/macsus-ai.apk"; }