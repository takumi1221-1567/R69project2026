// ============================================
// R69project2026 - 動画再生コントローラー
// デュアルビデオによるシームレスループ再生
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

        this.idleTimer = null;
        this.idleTimeout = 5000; // 5秒ごとにランダムアクション

        this.videoPaths = {
            armor: {
                idle: '/videos/armor/装甲通常.mp4',
                speaking: '/videos/armor/装甲通常.mp4',
                idleAction1: '/videos/armor/装甲腕組み.mp4',
                idleAction2: '/videos/armor/装甲キョロ.mp4',
                castoff: '/videos/armor/キャストオフ.mp4'
            },
            normal: {
                idle: '/videos/normal/通常.mp4',
                speaking: '/videos/normal/喋り.mp4',
                idleAction1: '/videos/normal/腕組み.mp4',
                idleAction2: '/videos/normal/キョロ.mp4',
                change: '/videos/normal/チェンジ.mp4'
            }
        };

        this.init();
    }

    async init() {
        console.log('VideoController 初期化中...');
        this.setupEventListeners();
        await this.loadVideo(this.videoPaths.armor.idle, true);
        this.startIdleTimer();
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

    handleVideoEnded() {
        if (this.currentState === 'speaking') {
            this.stopSpeaking();
        } else if (this.currentState === 'action') {
            this.playIdleVideo();
        }
    }

    async playIdleVideo() {
        this.currentState = 'idle';
        const videoPath = this.videoPaths[this.currentMode].idle;
        await this.switchVideo(videoPath, true);
        this.resetIdleTimer();
    }

    async startSpeaking() {
        if (this.isSpeaking) return;
        this.isSpeaking = true;
        this.currentState = 'speaking';
        this.stopIdleTimer();
        const videoPath = this.videoPaths[this.currentMode].speaking;
        await this.switchVideo(videoPath, true);
    }

    async stopSpeaking() {
        if (!this.isSpeaking) return;
        this.isSpeaking = false;
        await this.playIdleVideo();
    }

    async playRandomIdleAction() {
        if (this.isSpeaking) {
            this.resetIdleTimer();
            return;
        }

        this.currentState = 'action';
        const actionType = Math.random() < 0.5 ? 'idleAction1' : 'idleAction2';
        const videoPath = this.videoPaths[this.currentMode][actionType];
        await this.switchVideo(videoPath, false);
    }

    // キャストオフ: 装甲 → 通常
    async playCastoffTransition() {
        console.log('キャストオフ遷移動画再生');
        this.currentState = 'action';
        this.stopIdleTimer();

        const videoPath = this.videoPaths.armor.castoff;
        try {
            await this.switchVideo(videoPath, false);
        } catch (error) {
            console.error('キャストオフ動画エラー:', error);
            this.currentMode = 'normal';
            await this.playIdleVideo();
            return;
        }

        return new Promise((resolve) => {
            let timeoutId = null;

            const handleEnd = async () => {
                this.activeVideo.removeEventListener('ended', handleEnd);
                if (timeoutId) clearTimeout(timeoutId);
                this.currentMode = 'normal';
                await this.playIdleVideo();
                resolve();
            };

            this.activeVideo.addEventListener('ended', handleEnd);

            timeoutId = setTimeout(() => {
                this.activeVideo.removeEventListener('ended', handleEnd);
                this.currentMode = 'normal';
                this.playIdleVideo().then(resolve);
            }, 30000);
        });
    }

    // チェンジ: 通常 → 装甲
    async playChangeTransition() {
        console.log('チェンジ遷移動画再生');
        this.currentState = 'action';
        this.stopIdleTimer();

        const videoPath = this.videoPaths.normal.change;
        try {
            await this.switchVideo(videoPath, false);
        } catch (error) {
            console.error('チェンジ動画エラー:', error);
            this.currentMode = 'armor';
            await this.playIdleVideo();
            return;
        }

        return new Promise((resolve) => {
            let timeoutId = null;

            const handleEnd = async () => {
                this.activeVideo.removeEventListener('ended', handleEnd);
                if (timeoutId) clearTimeout(timeoutId);
                this.currentMode = 'armor';
                await this.playIdleVideo();
                resolve();
            };

            this.activeVideo.addEventListener('ended', handleEnd);

            timeoutId = setTimeout(() => {
                this.activeVideo.removeEventListener('ended', handleEnd);
                this.currentMode = 'armor';
                this.playIdleVideo().then(resolve);
            }, 30000);
        });
    }

    setMode(mode) {
        this.currentMode = mode;
        this.playIdleVideo();
    }

    startIdleTimer() {
        this.stopIdleTimer();
        this.idleTimer = setTimeout(() => {
            this.playRandomIdleAction();
        }, this.idleTimeout);
    }

    stopIdleTimer() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
    }

    resetIdleTimer() {
        this.startIdleTimer();
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
