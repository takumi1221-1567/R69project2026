// ============================================
// R69project2026 - 動画再生コントローラー
// デュアルビデオによるシームレスループ再生
// ============================================
//
// ■ キャストオンモード (armor)
//   話す時       : 装甲通常.mp4
//   待機中       : 装甲通常.mp4 (ループ)
//   3秒操作なし  : 装甲腕組み.mp4
//   6秒操作なし  : 装甲キョロ.mp4
//   チェンジ/キャストオフ指示 : キャストオフ.mp4 → normalへ遷移
//
// ■ キャストオフモード (normal)
//   話す時       : 喋り.mp4
//   待機中       : 通常.mp4 (ループ)
//   3秒操作なし  : 腕組み.mp4
//   6秒操作なし  : キョロ.mp4
//   チェンジ/キャストオン指示 : チェンジ.mp4 → armorへ遷移
// ============================================

class VideoController {
    constructor() {
        this.video1 = document.getElementById('character-video-1');
        this.video2 = document.getElementById('character-video-2');
        this.loadingElement = document.getElementById('video-loading');

        this.activeVideo = this.video1;
        this.inactiveVideo = this.video2;

        this.currentMode = 'armor'; // 'armor' or 'normal'
        this.currentState = 'idle';
        this.isSpeaking = false;
        this.currentVideoPath = '';

        // 2段階アイドルタイマー
        this.idleTimer1 = null; // 3秒後 → 腕組み
        this.idleTimer2 = null; // 6秒後 → キョロ

        this.videoPaths = {
            armor: {
                idle:     '/videos/armor/装甲通常.mp4',
                speaking: '/videos/armor/装甲通常.mp4',
                action3s: '/videos/armor/装甲腕組み.mp4',
                action6s: '/videos/armor/装甲キョロ.mp4',
                transition: '/videos/armor/キャストオフ.mp4'
            },
            normal: {
                idle:     '/videos/normal/通常.mp4',
                speaking: '/videos/normal/喋り.mp4',
                action3s: '/videos/normal/腕組み.mp4',
                action6s: '/videos/normal/キョロ.mp4',
                transition: '/videos/normal/チェンジ.mp4'
            }
        };

        this.init();
    }

    async init() {
        console.log('VideoController 初期化中...');
        this.setupEventListeners();
        await this.loadVideo(this.videoPaths.armor.idle, true);
        this.startIdleTimers();
        console.log('VideoController 初期化完了');
    }

    setupEventListeners() {
        this.video1.addEventListener('ended', () => {
            if (this.video1 === this.activeVideo) this.handleVideoEnded();
        });
        this.video2.addEventListener('ended', () => {
            if (this.video2 === this.activeVideo) this.handleVideoEnded();
        });

        this.video1.addEventListener('error', (e) => {
            console.error('動画1 エラー:', e);
            this.hideLoading();
        });
        this.video2.addEventListener('error', (e) => {
            console.error('動画2 エラー:', e);
            this.hideLoading();
        });
    }

    // ============================================
    // 動画読み込み（初回）
    // ============================================
    async loadVideo(videoPath, autoplay = true) {
        return new Promise((resolve, reject) => {
            this.showLoading();
            this.activeVideo.src = videoPath;
            this.activeVideo.loop = true;
            this.activeVideo.load();
            this.currentVideoPath = videoPath;

            this.activeVideo.onloadeddata = () => {
                if (autoplay) {
                    this.activeVideo.play().catch(err => console.error('自動再生エラー:', err));
                }
                this.hideLoading();
                resolve();
            };

            this.activeVideo.onerror = (error) => {
                console.error('動画読み込みエラー:', error);
                this.hideLoading();
                reject(error);
            };
        });
    }

    // ============================================
    // シームレス動画切り替え
    // ============================================
    async switchVideo(videoPath, loop = true) {
        if (this.currentVideoPath === videoPath) {
            this.activeVideo.loop = loop;
            return;
        }

        console.log('動画切り替え:', videoPath);

        return new Promise((resolve) => {
            this.inactiveVideo.src = videoPath;
            this.inactiveVideo.loop = loop;
            this.inactiveVideo.currentTime = 0;
            this.inactiveVideo.load();

            const onReady = async () => {
                this.inactiveVideo.removeEventListener('canplay', onReady);
                try {
                    await this.inactiveVideo.play();
                    setTimeout(() => {
                        this.activeVideo.classList.remove('active');
                        this.inactiveVideo.classList.add('active');

                        const temp = this.activeVideo;
                        this.activeVideo = this.inactiveVideo;
                        this.inactiveVideo = temp;

                        this.inactiveVideo.pause();
                        this.currentVideoPath = videoPath;
                        resolve();
                    }, 50);
                } catch (err) {
                    console.error('動画再生エラー:', err);
                    resolve();
                }
            };

            this.inactiveVideo.addEventListener('canplay', onReady);

            setTimeout(() => {
                this.inactiveVideo.removeEventListener('canplay', onReady);
                resolve();
            }, 5000);
        });
    }

    // ============================================
    // 動画再生終了ハンドラ
    // ============================================
    handleVideoEnded() {
        if (this.currentState === 'speaking') {
            this.stopSpeaking();
        } else if (this.currentState === 'action') {
            this.playIdleVideo();
        }
    }

    // ============================================
    // 待機動画再生
    // ============================================
    async playIdleVideo() {
        this.currentState = 'idle';
        const videoPath = this.videoPaths[this.currentMode].idle;
        await this.switchVideo(videoPath, true);
        this.startIdleTimers();
    }

    // ============================================
    // 話す動画
    // ============================================
    async startSpeaking() {
        if (this.isSpeaking) return;
        this.isSpeaking = true;
        this.currentState = 'speaking';
        this.stopIdleTimers();
        const videoPath = this.videoPaths[this.currentMode].speaking;
        await this.switchVideo(videoPath, true);
    }

    async stopSpeaking() {
        if (!this.isSpeaking) return;
        this.isSpeaking = false;
        await this.playIdleVideo();
    }

    // ============================================
    // 2段階アイドルタイマー
    //   3秒 → 腕組み (action3s)
    //   6秒 → キョロ (action6s)
    // ============================================
    startIdleTimers() {
        this.stopIdleTimers();

        // 3秒後: 腕組み
        this.idleTimer1 = setTimeout(async () => {
            if (this.isSpeaking || this.currentState === 'transition') return;
            console.log('3秒操作なし → 腕組み');
            this.currentState = 'action';
            const videoPath = this.videoPaths[this.currentMode].action3s;
            await this.switchVideo(videoPath, false);
        }, 3000);

        // 6秒後: キョロ
        this.idleTimer2 = setTimeout(async () => {
            if (this.isSpeaking || this.currentState === 'transition') return;
            console.log('6秒操作なし → キョロ');
            this.currentState = 'action';
            const videoPath = this.videoPaths[this.currentMode].action6s;
            await this.switchVideo(videoPath, false);
        }, 6000);
    }

    stopIdleTimers() {
        if (this.idleTimer1) {
            clearTimeout(this.idleTimer1);
            this.idleTimer1 = null;
        }
        if (this.idleTimer2) {
            clearTimeout(this.idleTimer2);
            this.idleTimer2 = null;
        }
    }

    resetIdleTimers() {
        this.startIdleTimers();
    }

    // ============================================
    // モード遷移動画
    // armor → normal : キャストオフ.mp4 再生後 normalへ
    // normal → armor : チェンジ.mp4 再生後 armorへ
    // ============================================
    async playTransition() {
        const fromMode = this.currentMode;
        const toMode = fromMode === 'armor' ? 'normal' : 'armor';

        console.log(`遷移動画再生: ${fromMode} → ${toMode}`);
        this.currentState = 'transition';
        this.stopIdleTimers();

        const videoPath = this.videoPaths[fromMode].transition;
        try {
            await this.switchVideo(videoPath, false);
        } catch (error) {
            console.error('遷移動画エラー:', error);
            this.currentMode = toMode;
            await this.playIdleVideo();
            return;
        }

        return new Promise((resolve) => {
            let timeoutId = null;

            const handleEnd = async () => {
                this.activeVideo.removeEventListener('ended', handleEnd);
                if (timeoutId) clearTimeout(timeoutId);
                this.currentMode = toMode;
                await this.playIdleVideo();
                resolve();
            };

            this.activeVideo.addEventListener('ended', handleEnd);

            timeoutId = setTimeout(() => {
                this.activeVideo.removeEventListener('ended', handleEnd);
                this.currentMode = toMode;
                this.playIdleVideo().then(resolve);
            }, 30000);
        });
    }

    setMode(mode) {
        this.currentMode = mode;
        this.playIdleVideo();
    }

    showLoading() {
        if (this.loadingElement) this.loadingElement.classList.remove('hidden');
    }

    hideLoading() {
        if (this.loadingElement) this.loadingElement.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.videoController = new VideoController();
});
