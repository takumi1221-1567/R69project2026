// ============================================
// R69project2026 - メインアプリケーション
// 音声I/O + Dify API チャットボット
// ============================================

let currentMode = 'armor';
let isRecording = false;
let isProcessing = false;
let recognition = null;
let conversationId = null; // Dify会話ID

// DOM要素
const userInput = document.getElementById('user-input');
const micButton = document.getElementById('mic-button');
const sendButton = document.getElementById('send-button');
const modeIndicator = document.getElementById('mode-indicator');
const modeText = document.getElementById('mode-text');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const responseDisplay = document.getElementById('response-display');

// ============================================
// 初期化
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('R69project2026 起動中...');
    initSpeechRecognition();
    setupEventListeners();
    setMode('armor');
    console.log('R69project2026 起動完了');
});

// ============================================
// 音声認識初期化
// ============================================
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('音声認識APIが利用できません');
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
    if (!recognition) {
        alert('音声認識が利用できません');
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
    if (t.includes('キャストオフ') || t.toLowerCase() === 'castoff') return 'castoff';
    if (t.includes('チェンジ') || t.toLowerCase() === 'change') return 'change';
    return null;
}

// ============================================
// コマンド処理
// ============================================
async function handleCommand(command) {
    if (command === 'castoff') {
        if (currentMode === 'normal') {
            speak('すでに通常モードです');
            return;
        }
        // 装甲 → 通常
        if (window.videoController) {
            await window.videoController.playCastoffTransition();
            currentMode = window.videoController.currentMode;
            updateModeUI();
            speak('キャストオフ');
        } else {
            setMode('normal');
            speak('キャストオフ');
        }
    } else if (command === 'change') {
        if (currentMode === 'armor') {
            speak('すでに装甲モードです');
            return;
        }
        // 通常 → 装甲
        if (window.videoController) {
            await window.videoController.playChangeTransition();
            currentMode = window.videoController.currentMode;
            updateModeUI();
            speak('チェンジ');
        } else {
            setMode('armor');
            speak('チェンジ');
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
// 音声出力
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
