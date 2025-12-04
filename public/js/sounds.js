/**
 * Sound Manager
 * Handles all game sound effects
 */

class SoundManager {
    constructor() {
        this.sounds = {};
        this.enabled = true;
        this.volume = 0.5; // 50% volume
        this.init();
    }

    init() {
        // Initialize all sounds with URLs
        this.sounds = {
            move: this.createSound('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', 0.3),
            win: this.createSound('https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3', 0.5),
            lose: this.createSound('https://assets.mixkit.co/active_storage/sfx/2028/2028-preview.mp3', 0.4),
            draw: this.createSound('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3', 0.3),
            tick: this.createSound('https://assets.mixkit.co/active_storage/sfx/2583/2583-preview.mp3', 0.2),
            gameStart: this.createSound('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3', 0.4),
            chat: this.createSound('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3', 0.3),
            notification: this.createSound('https://assets.mixkit.co/active_storage/sfx/2356/2356-preview.mp3', 0.3),
            timeout: this.createSound('https://assets.mixkit.co/active_storage/sfx/2002/2002-preview.mp3', 0.4),
            hover: this.createSound('https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3', 0.1)
        };

        // Load sound preference from localStorage
        const savedEnabled = localStorage.getItem('soundEnabled');
        this.enabled = savedEnabled !== 'false';

        const savedVolume = localStorage.getItem('soundVolume');
        if (savedVolume) {
            this.volume = parseFloat(savedVolume);
        }

        console.log('🔊 Sound Manager initialized');
    }

    createSound(url, volume = 0.5) {
        const audio = new Audio(url);
        audio.volume = volume * this.volume;
        audio.preload = 'auto';
        return audio;
    }

    play(soundName) {
        if (!this.enabled) return;
        
        const sound = this.sounds[soundName];
        if (!sound) {
            console.warn(`Sound "${soundName}" not found`);
            return;
        }

        // Clone the sound to allow multiple plays
        const soundClone = sound.cloneNode();
        soundClone.volume = sound.volume * this.volume;
        
        soundClone.play().catch(err => {
            // Silently fail - browser might block autoplay
            if (err.name !== 'NotAllowedError') {
                console.warn(`Failed to play sound "${soundName}":`, err);
            }
        });
    }

    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('soundEnabled', this.enabled);
        return this.enabled;
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
        localStorage.setItem('soundVolume', this.volume);
        
        // Update all sound volumes
        Object.values(this.sounds).forEach(sound => {
            sound.volume = sound.volume * this.volume;
        });
    }

    isEnabled() {
        return this.enabled;
    }
}

// Initialize sound manager
const soundManager = new SoundManager();
window.soundManager = soundManager;
