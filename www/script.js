/* Register Service Worker */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker terdaftar!', reg))
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
      console.log('User menerima install PWA');
      document.getElementById('btn-install-pwa').style.display = 'none';
    }
    deferredPrompt = null;
  }
}

/* State & Storage */
let currentMode = null;
let currentTab  = 0;
let historyData = JSON.parse(localStorage.getItem('macsus_history')) || [];

/* UI Toggles */
function toggleSidebar() {
  document.getElementById('app-sidebar').classList.toggle('active');
  document.getElementById('sidebar-overlay').classList.toggle('active');
  if(document.getElementById('app-sidebar').classList.contains('active')) {
    renderSidebar();
  }
}

function toggleSettings() {
  document.getElementById('settings-modal').classList.toggle('active');
  document.getElementById('settings-overlay').classList.toggle('active');
}

/* New Session Logic */
function newSession() {
  document.getElementById('input-container').style.display = 'block';
  document.getElementById('output-wrapper').classList.remove('visible');
  document.getElementById('serviceInfo').value = '';
  document.getElementById('contentTitle').value = '';
  document.getElementById('reportData').value = '';
  document.getElementById('command').value = '';
  if (document.getElementById('app-sidebar').classList.contains('active')) {
    toggleSidebar();
  }
}

/* Mode switching */
function setMode(mode) {
  currentMode = mode;
  document.getElementById('btn-ig').classList.toggle('active', mode === 'ig');
  document.getElementById('btn-gbisnis').classList.toggle('active', mode === 'gbisnis');
  const igF   = document.getElementById('ig-fields');
  const gbF   = document.getElementById('gbisnis-fields');
  const notes = document.getElementById('notes-card');
  igF.classList.toggle('visible',  mode === 'ig');
  gbF.classList.toggle('visible',  mode === 'gbisnis');
  notes.classList.add('visible');
  document.getElementById('output-wrapper').classList.remove('visible');
  clearError();
}

/* Tab switching */
function switchTab(idx) {
  currentTab = idx;
  const ids  = ['section-notebooklm', 'section-dokumen', 'section-caption'];
  const pills = document.querySelectorAll('#ig-tabs .tab-pill');
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    el.style.display = i === idx ? 'block' : 'none';
    el.classList.toggle('active', i === idx);
  });
  pills.forEach((p, i) => p.classList.toggle('active', i === idx));
}

/* Toast */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.innerHTML = `<i class="fas fa-check-circle"></i> ${msg || 'Teks disalin!'}`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

/* Copy helpers */
function copySection(id) {
  const text = document.getElementById(id).innerText;
  navigator.clipboard.writeText(text).then(() => showToast('Teks disalin!'));
}

function copyAll() {
  const ids = ['notebooklm-body', 'dokumen-body', 'caption-body', 'gbisnis-body'];
  let full  = '';
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.innerText.trim()) full += el.innerText + '\n\n---\n\n';
  });
  navigator.clipboard.writeText(full.trim()).then(() => showToast('Semua disalin!'));
}

/* Error & Loading */
function setError(html) {
  const box = document.getElementById('error-box');
  document.getElementById('error-text').innerHTML = html;
  box.classList.add('visible');
}
function clearError() { document.getElementById('error-box').classList.remove('visible'); }

function setLoading(on) {
  document.getElementById('submit-btn').disabled = on;
  document.getElementById('loading-box').classList.toggle('visible', on);
  if (on) {
    document.getElementById('output-wrapper').classList.remove('visible');
  }
}

/* Char counter */
function updateCharCounter(count) {
  const fill  = document.getElementById('char-fill');
  const label = document.getElementById('char-label');
  const pct   = Math.min((count / 1500) * 100, 100);
  fill.style.width = pct + '%';
  fill.className   = 'char-fill ' + (count > 1500 ? 'over' : 'ok');
  label.textContent = `${count} / 1500`;
  label.className   = 'char-text' + (count > 1500 ? ' over' : '');
}

/* History Management */
function saveSession(title, mode, dataObj) {
  const session = {
    id: Date.now(),
    title: title || (mode === 'gbisnis' ? 'Google Bisnis Post' : 'Tanpa Judul'),
    mode: mode,
    date: new Date().toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }),
    data: dataObj
  };
  historyData.unshift(session);
  if(historyData.length > 50) historyData.pop();
  localStorage.setItem('macsus_history', JSON.stringify(historyData));
}

function renderSidebar() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  if(historyData.length === 0) {
    list.innerHTML = '<p style="color:var(--t3); font-size:12px; text-align:center; margin-top:20px;">Belum ada riwayat.</p>';
    return;
  }
  historyData.forEach(item => {
    const modeClass = item.mode === 'ig' ? 'ig' : 'gb';
    const modeName  = item.mode === 'ig' ? 'Instagram' : 'G-Bisnis';
    
    const btn = document.createElement('button');
    btn.className = 'history-item';
    btn.onclick = () => loadSession(item.id);
    btn.innerHTML = `
      <span class="hist-title">${item.title}</span>
      <div class="hist-meta">
        <span class="hist-mode ${modeClass}">${modeName}</span>
        <span>${item.date}</span>
      </div>
    `;
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
    ['section-notebooklm', 'section-dokumen', 'section-caption'].forEach(elId => {
      document.getElementById(elId).style.display = 'none';
      document.getElementById(elId).classList.remove('active');
    });
    
    const gbEl = document.getElementById('section-gbisnis');
    gbEl.style.display = 'block';
    gbEl.classList.add('active');
  }
  document.getElementById('output-wrapper').classList.add('visible');
}

function clearHistory() {
  if(confirm("Yakin ingin menghapus semua riwayat?")) {
    historyData = [];
    localStorage.removeItem('macsus_history');
    toggleSettings();
    showToast("Riwayat dihapus!");
  }
}

/* Main generate function */
async function generateAds() {
  const API_KEY     = "AIzaSyBB2NhYoTAtn-a5WJ73EXlIpp1XtaFd2Ns"; 
  const serviceInfo = document.getElementById('serviceInfo').value.trim();
  const contentTitle= document.getElementById('contentTitle').value.trim();
  const reportData  = document.getElementById('reportData').value.trim();
  const command     = document.getElementById('command').value.trim();
  
  clearError();
  if (!currentMode)
    return setError('Pilih mode konten terlebih dahulu (Instagram atau Google Bisnis).');
  if (currentMode === 'ig' && !serviceInfo)
    return setError('Harap isi kolom <strong>Layanan / Masalah</strong> terlebih dahulu.');
  if (currentMode === 'ig' && !contentTitle)
    return setError('Harap isi <strong>Judul / Topik Konten IG</strong>.');
  if (currentMode === 'gbisnis' && !reportData)
    return setError('Harap paste <strong>data report pelanggan</strong> terlebih dahulu.');
    
  setLoading(true);
  
  let prompt = '';
  if (currentMode === 'ig') {
    prompt = `Anda adalah asisten periklanan senior untuk Macsus Company. DATA PERUSAHAAN (wajib selalu digunakan): - Nama: Macsus Company - Layanan: Jasa servis & perbaikan laptop (hardware + software) di Surabaya & Sidoarjo - Hardware: Overheat treatment, ganti thermal paste, penggantian layar, perbaikan motherboard, water spill treatment - Software: Optimasi sistem, install ulang, remove virus - Keunggulan: Teknisi ahli, pengerjaan cepat & transparan, harga terjangkau, free diagnosa - Alamat: Jl. Keputih Makam Blk. E No.26, Keputih, Kec. Sukolilo, Surabaya, Jawa Timur 60295 - WhatsApp: 0858-5256-1993 - Hashtag utama: #MacsusCompany #ServiceLaptopSurabaya INPUT: - Layanan hari ini: ${serviceInfo} - Judul/Topik Konten IG: ${contentTitle} ${command ? `- Catatan tambahan: ${command}` : ''} TUGAS: Buat 3 output berikut secara lengkap dan dipisah dengan jelas: ===OUTPUT 1: PROMPT NOTEBOOKLM=== Tulis prompt instruksi untuk NotebookLM agar membuat konten slide IG vertikal (rasio 4:5 / Portrait) mengatasnamakan Macsus Company. Prompt harus menyebut nama dokumen sumber yang akan dibuat di Output 2, menyebutkan hook yang kuat, poin-poin konten utama, dan CTA layanan Macsus yang relevan. ===OUTPUT 2: DOKUMEN SUMBER DATA=== Buat dokumen sumber teks teknis dengan nama "DIAGNOSA [TOPIK] MACSUS COMPANY" yang akan digunakan sebagai basis data di NotebookLM. Isi dengan: analisis gejala/masalah, langkah diagnosa mandiri yang bisa dilakukan user, value preposition layanan Macsus untuk masalah ini. Format dengan bullet points yang informatif. ===OUTPUT 3: CAPTION INSTAGRAM=== Buat caption IG yang menarik dengan struktur: Headline all-caps dengan emoji relevan, paragraf pembuka yang relatable dan bikin orang penasaran, numbered list langkah atau tips praktis, paragraf solusi Macsus dengan checklist, info lokasi & WhatsApp, dan hashtag yang relevan (min. 10 hashtag). Pastikan ketiga output terpisah jelas dengan header masing-masing. PENTING: DILARANG KERAS menggunakan markdown bintang ganda (**) untuk menebalkan teks. Gunakan teks biasa saja, tapi kamu boleh menggunakan emoji.`;
  } else {
    prompt = `Kamu adalah seorang IT consultant spesialis laptop dan PC. Kamu diminta membuat storytelling berbasis Google Business untuk Macsus Company dengan ketentuan berikut: - Gaya bahasa Gen Z: santai, relatable, sedikit lebay/hiperbola tapi tetap informatif - Nada: persuasif, menyentuh perasaan pembaca, bikin orang mau langsung ke workshop - Tujuan: meningkatkan income pelanggan Macsus Company dan mendorong kunjungan kantor agar mau maintenance / perbaikan laptop/PC - Maksimal 1500 karakter (hitung dengan ketat, jangan melebihi) - Jangan sebut nama lengkap pelanggan, cukup sebut nama depan atau panggilan akrab saja - Akhiri dengan info Macsus Company: nama, alamat singkat (Keputih, Sukolilo, Surabaya), dan tagline penutup yang memorable DATA REPORT PELANGGAN: ${reportData} ${command ? `\nCatatan tambahan: ${command}` : ''} PENTING: Output hanya berisi teks storytelling-nya saja, langsung tanpa label/header apapun. Mulai langsung dari kalimat pembuka yang hook. DILARANG KERAS menggunakan markdown bintang ganda (**) untuk menebalkan teks. Gunakan teks biasa saja, tapi kamu boleh menggunakan emoji.`;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        })
      }
    );
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error ${response.status}: ${errText}`);
    }
    
    const data    = await response.json();
    let rawText   = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!rawText) throw new Error('Respons kosong dari API.');
    
    // REGEX CLEANER
    rawText = rawText.replace(/\*\*/g, '');
    
    document.getElementById('input-container').style.display = 'none';
    
    let savedDataObj = {};
    if (currentMode === 'ig') {
      savedDataObj = parseAndShowIG(rawText, contentTitle);
    } else {
      savedDataObj = parseAndShowGBisnis(rawText);
    }
    
    const sessionTitle = currentMode === 'ig' ? contentTitle : (command || 'Google Bisnis Post');
    saveSession(sessionTitle, currentMode, savedDataObj);
    
  } catch (err) {
    const msg = err.message.toLowerCase();
    const isHighDemand = 
      msg.includes('503') || msg.includes('overload') || msg.includes('high demand') || 
      msg.includes('unavailable') || msg.includes('resource_exhausted') || msg.includes('429');
    
    if (isHighDemand) {
      setError('<strong>Antrian AI lagi penuh!</strong><br>Model sedang tinggi permintaan. Coba lagi dalam ~1 menit ya.');
    } else {
      setError('Terjadi kesalahan: ' + err.message);
    }
  } finally {
    setLoading(false);
  }
}

/* Output parser: Instagram */
function parseAndShowIG(rawText, title) {
  const o1 = rawText.match(/OUTPUT\s*1[:\s\S]*?(?=OUTPUT\s*2|===OUTPUT\s*2|$)/i);
  const o2 = rawText.match(/OUTPUT\s*2[:\s\S]*?(?=OUTPUT\s*3|===OUTPUT\s*3|$)/i);
  const o3 = rawText.match(/OUTPUT\s*3[:\s\S]*/i);

  let nb  = cleanSection(o1 ? o1[0] : rawText, ['OUTPUT 1', 'NOTEBOOKLM', 'PROMPT']);
  let dok = cleanSection(o2 ? o2[0] : '', ['OUTPUT 2', 'DOKUMEN SUMBER', 'SUMBER DATA']);
  let cap = cleanSection(o3 ? o3[0] : '', ['OUTPUT 3', 'CAPTION INSTAGRAM', 'CAPTION']);

  if (!dok && !cap) {
    const parts = rawText.split(/\n={3,}\n/);
    nb  = parts[0] ? parts[0].trim() : rawText;
    dok = parts[1] ? parts[1].trim() : '';
    cap = parts[2] ? parts[2].trim() : '';
  }

  document.getElementById('notebooklm-body').innerText = nb  || rawText;
  document.getElementById('dokumen-body').innerText    = dok || '(Tidak terdeteksi. Lihat output bagian 1)';
  document.getElementById('caption-body').innerText    = cap || '(Tidak terdeteksi. Lihat output bagian 1)';

  document.getElementById('ig-tabs').style.display = 'flex';
  document.getElementById('section-gbisnis').style.display = 'none';
  document.getElementById('section-gbisnis').classList.remove('active');
  switchTab(0);

  document.getElementById('output-title').innerText = title || 'Konten Instagram';
  document.getElementById('output-wrapper').classList.add('visible');

  return { nb, dok, cap, gb: '' };
}

/* Output parser: Google Bisnis */
function parseAndShowGBisnis(rawText) {
  const cleaned = rawText.trim();
  document.getElementById('gbisnis-body').innerText = cleaned;
  updateCharCounter(cleaned.length);

  document.getElementById('ig-tabs').style.display = 'none';
  ['section-notebooklm', 'section-dokumen', 'section-caption'].forEach(id => {
    document.getElementById(id).style.display = 'none';
    document.getElementById(id).classList.remove('active');
  });

  const gbEl = document.getElementById('section-gbisnis');
  gbEl.style.display = 'block';
  gbEl.classList.add('active');

  document.getElementById('output-title').innerText = 'Postingan Google Bisnis';
  document.getElementById('output-wrapper').classList.add('visible');

  return { nb: '', dok: '', cap: '', gb: cleaned };
}

/* Text cleaner */
function cleanSection(text, headers) {
  if (!text) return '';
  let result = text.trim();
  headers.forEach(h => {
    result = result.replace(new RegExp(`^[=\\s]*${h}[^\\n]*\\n`, 'i'), '');
  });
  return result.replace(/^===.*===\n?/gm, '').trim();
}

/* --- LOGIKA VIDEO OPENING (SPLASH SCREEN) --- */
window.addEventListener('DOMContentLoaded', () => {
  const splashScreen = document.getElementById('splash-screen');
  const splashVideo = document.getElementById('splash-video');

  if (splashVideo) {
    // FITUR MAGIC: Deteksi warna & memicu Fade In perlahan
    splashVideo.addEventListener('loadeddata', () => {
      // 1. Memicu Fade In CSS pada tag video
      splashVideo.classList.add('show');
      
      // 2. Membaca warna background video
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      canvas.width = splashVideo.videoWidth;
      canvas.height = splashVideo.videoHeight;
      
      ctx.drawImage(splashVideo, 0, 0, canvas.width, canvas.height);
      
      try {
        const pixel = ctx.getImageData(0, 0, 1, 1).data;
        const detectedColor = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
        splashScreen.style.backgroundColor = detectedColor;
      } catch (e) {
        console.log("Warna default aktif.");
      }
    });

    splashVideo.addEventListener('ended', () => {
      splashScreen.classList.add('hidden');
    });

    splashVideo.addEventListener('error', () => {
      splashScreen.classList.add('hidden');
    });

    setTimeout(() => {
      if (splashVideo.paused) {
        splashScreen.classList.add('hidden');
      }
    }, 2000);
  }
});

/* --- LOGIKA DOWNLOAD APK --- */
function downloadAPK() {
  // Ubah USERNAME dan NAMA_REPO sesuai link GitHub kamu!
  const githubReleaseUrl = "https://github.com/DedePark/MACSUS-AI-ADVERTISING/releases/download/latest/macsus-ai.apk";
  window.location.href = githubReleaseUrl;
}