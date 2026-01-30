// ============================================
// R69project2026 - メインアプリケーション
// 音声I/O + Dify API チャットボット
// ============================================

let currentMode = 'armor';
let isRecording = false;
let isProcessing = false;
let recognition = null;
let conversationId = null;
let audioUnlocked = false; // iOS音声再生ロック解除済みフラグ

// DOM要素
const userInput = document.getElementById('user-input');
const micButton = document.getElementById('mic-button');
const sendButton = document.getElementById('send-button');
const modeIndicator = document.getElementById('mode-indicator');
const modeText = document.getElementById('mode-text');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const responseDisplay = document.getElementById('response-display');
const startOverlay = document.getElementById('start-overlay');

// ============================================
// LINE内ブラウザ検出
// ============================================
function isLineBrowser() {
    return /Line/i.test(navigator.userAgent);
}

function isIOSSafari() {
    const ua = navigator.userAgent;
    return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|Line/.test(ua);
}

// ============================================
// 初期化
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('R69project2026 起動中...');

    // LINE内ブラウザの場合 → Safari誘導を表示
    if (isLineBrowser()) {
        showLineBrowserNotice();
        return;
    }

    initSpeechRecognition();
    setupEventListeners();
    setMode('armor');

    // iOS: タップで音声とビデオのロックを解除する画面を表示
    if (startOverlay) {
        startOverlay.addEventListener('click', unlockAudioAndStart);
    }

    console.log('R69project2026 起動完了');
});

// ============================================
// LINE内ブラウザ通知
// ============================================
function showLineBrowserNotice() {
    if (startOverlay) {
        startOverlay.innerHTML =
            '<div class="overlay-content">' +
            '<p class="overlay-title">Safariで開いてください</p>' +
            '<p class="overlay-sub">LINEブラウザではマイク・音声再生が<br>使用できません</p>' +
            '<p class="overlay-url">右下の「…」→「Safariで開く」</p>' +
            '</div>';
        startOverlay.classList.remove('hidden');
    }
}

// ============================================
// iOS音声・動画ロック解除（初回タップ必須）
// ============================================
function unlockAudioAndStart() {
    if (audioUnlocked) return;
    audioUnlocked = true;

    // SpeechSynthesisを空発話でアンロック（iOS必須）
    const dummy = new SpeechSynthesisUtterance('');
    dummy.volume = 0;
    window.speechSynthesis.speak(dummy);

    // video要素を再生してアンロック
    const v1 = document.getElementById('character-video-1');
    const v2 = document.getElementById('character-video-2');
    if (v1) v1.play().catch(() => {});
    if (v2) {
        v2.play().then(() => v2.pause()).catch(() => {});
    }

    // オーバーレイ非表示
    if (startOverlay) {
        startOverlay.classList.add('hidden');
    }

    // VideoControllerが初期化前の場合、動画読み込み再実行
    if (window.videoController) {
        window.videoController.playIdleVideo();
    }
}

// ============================================
// 音声認識初期化
// ============================================
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('音声認識APIが利用できません');
        micButton.classList.add('disabled');
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('音声認識結果:', transcript);
        userInput.value = transcript;
        handleUserInput(transcript);
    };

    recognition.onend = () => {
        isRecording = false;
        micButton.classList.remove('recording');
    };

    recognition.onerror = (event) => {
        console.error('音声認識エラー:', event.error);
        isRecording = false;
        micButton.classList.remove('recording');
        if (event.error === 'not-allowed') {
            alert('マイクの使用が許可されていません。\nブラウザの設定でマイクを許可してください。');
        }
    };
}

// ============================================
// イベントリスナー
// ============================================
function setupEventListeners() {
    userInput.addEventListener('input', () => {
        sendButton.classList.toggle('hidden', !userInput.value.trim());
    });

    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const text = userInput.value.trim();
            if (text) {
                handleUserInput(text);
                userInput.value = '';
                sendButton.classList.add('hidden');
            }
        }
    });

    sendButton.addEventListener('click', () => {
        const text = userInput.value.trim();
        if (text) {
            handleUserInput(text);
            userInput.value = '';
            sendButton.classList.add('hidden');
        }
    });

    micButton.addEventListener('click', toggleRecording);
}

// ============================================
// 音声録音トグル
// ============================================
function toggleRecording() {
    // iOS音声未解除なら先に解除
    if (!audioUnlocked) {
        unlockAudioAndStart();
    }

    if (!recognition) {
        alert('このブラウザでは音声認識を利用できません。\nSafariまたはChromeで開いてください。');
        return;
    }

    if (isRecording) {
        recognition.stop();
        isRecording = false;
        micButton.classList.remove('recording');
    } else {
        recognition.start();
        isRecording = true;
        micButton.classList.add('recording');
    }
}

// ============================================
// ユーザー入力処理
// ============================================
async function handleUserInput(text) {
    if (isProcessing) return;

    // iOS音声未解除なら先に解除
    if (!audioUnlocked) {
        unlockAudioAndStart();
    }

    console.log('入力:', text, '現在のモード:', currentMode);

    const command = detectCommand(text);
    if (command) {
        await handleCommand(command);
    } else {
        await sendToDify(text);
    }
}

// ============================================
// コマンド検出
// ============================================
function detectCommand(text) {
    const t = text.trim();
    if (t.includes('キャストオフ') || t.includes('チェンジ') ||
        t.includes('キャストオン') ||
        t.toLowerCase() === 'castoff' || t.toLowerCase() === 'change') {
        return 'toggle';
    }
    return null;
}

// ============================================
// コマンド処理
// ============================================
async function handleCommand(command) {
    if (command === 'toggle') {
        if (window.videoController) {
            await window.videoController.playTransition();
            currentMode = window.videoController.currentMode;
            updateModeUI();
            speak(currentMode === 'armor' ? 'チェンジ' : 'キャストオフ');
        } else {
            const newMode = currentMode === 'armor' ? 'normal' : 'armor';
            setMode(newMode);
            speak(newMode === 'armor' ? 'チェンジ' : 'キャストオフ');
        }
    }
}

// ============================================
// Dify APIへ送信
// ============================================
async function sendToDify(text) {
    isProcessing = true;
    showStatus('考え中...');

    if (window.videoController) {
        window.videoController.startSpeaking();
    }

    try {
        const payload = { query: text };
        if (conversationId) {
            payload.conversation_id = conversationId;
        }

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (data.answer) {
            conversationId = data.conversation_id || conversationId;
            displayResponse(data.answer);
            speak(data.answer);
        } else if (data.error) {
            console.error('API error:', data.error);
            speak('すみません、エラーが発生しました');
        } else {
            speak('すみません、わかりませんでした');
        }
    } catch (error) {
        console.error('通信エラー:', error);
        speak('通信エラーが発生しました');
    } finally {
        isProcessing = false;
        hideStatus();
    }
}

// ============================================
// 音声出力（iOS対応）
// ============================================
function speak(text) {
    console.log('音声出力:', text);
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
        if (window.videoController) window.videoController.startSpeaking();
    };

    utterance.onend = () => {
        if (window.videoController) window.videoController.stopSpeaking();
    };

    // iOS Safari: speechSynthesisが止まるバグ対策
    // 長文の場合、途中で再生が止まるのを防ぐ
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        const iosResume = setInterval(() => {
            if (!window.speechSynthesis.speaking) {
                clearInterval(iosResume);
            } else {
                window.speechSynthesis.resume();
            }
        }, 3000);

        utterance.onend = () => {
            clearInterval(iosResume);
            if (window.videoController) window.videoController.stopSpeaking();
        };
    }

    window.speechSynthesis.speak(utterance);
}

// ============================================
// レスポンス表示
// ============================================
function displayResponse(text) {
    if (responseDisplay) {
        responseDisplay.textContent = text;
        responseDisplay.classList.remove('hidden');
    }
}

// ============================================
// モード管理
// ============================================
function setMode(mode) {
    currentMode = mode;
    if (window.videoController) {
        window.videoController.setMode(mode);
        currentMode = window.videoController.currentMode;
    }
    updateModeUI();
}

function updateModeUI() {
    if (currentMode === 'armor') {
        modeText.textContent = '装甲モード';
        modeIndicator.classList.remove('normal-mode');
        modeIndicator.classList.add('armor-mode');
    } else {
        modeText.textContent = '通常モード';
        modeIndicator.classList.remove('armor-mode');
        modeIndicator.classList.add('normal-mode');
    }
}

// ============================================
// ステータス表示
// ============================================
function showStatus(text) {
    statusText.textContent = text;
    statusIndicator.classList.remove('hidden');
}

function hideStatus() {
    statusIndicator.classList.add('hidden');
}
