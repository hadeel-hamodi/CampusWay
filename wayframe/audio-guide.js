(function () {
  'use strict';

  const STORAGE_KEY = 'campusway.audioEnabled';
  const LANGUAGE_CODES = {
    en: 'en-US',
    he: 'he-IL',
    ar: 'ar-SA'
  };

  const normalize = code =>
    String(code || '').toLowerCase().replace(/_/g, '-');

  class CampusAudioGuide {
    constructor({ language = 'en', onStatus = () => {} } = {}) {
      this.language = LANGUAGE_CODES[language] ? language : 'en';
      this.onStatus = onStatus;
      this.enabled = false;
      this.lastInstruction = '';
      this.lastAnnouncementKey = null;
      this.pending = null;
      this.voiceTimer = null;
      this.warnedLanguage = null;
      this.utterance = null;

      this.supported =
        'speechSynthesis' in window &&
        'SpeechSynthesisUtterance' in window;

      try {
        this.enabled =
          localStorage.getItem(STORAGE_KEY) === 'true';
      } catch (error) {
        // Storage is optional.
      }

      this.handleVoicesChanged = () => {
        if (!this.pending || !this.enabled) return;

        const request = this.pending;

        // Keep both the message and its de-duplication key.
        this.speak(request.text, request.key);
      };

      if (this.supported) {
        window.speechSynthesis.addEventListener(
          'voiceschanged',
          this.handleVoicesChanged
        );

        // Ask the browser to begin loading its voices.
        window.speechSynthesis.getVoices();
      }
    }

    setEnabled(enabled, confirmation = '') {
      this.enabled = Boolean(enabled);
      this.lastAnnouncementKey = null;

      try {
        localStorage.setItem(
          STORAGE_KEY,
          String(this.enabled)
        );
      } catch (error) {
        // Keep the setting for this page.
      }

      if (!this.enabled) this.stop();

      this.onStatus({
        type: this.enabled ? 'enabled' : 'disabled'
      });

      // Call from the audio button's click handler.
      if (this.enabled && confirmation) {
        this.speak(confirmation);
      }
    }

    setLanguage(language) {
      if (!LANGUAGE_CODES[language]) return;
      if (this.language === language) return;

      this.reset();
      this.language = language;
      this.warnedLanguage = null;
    }

    findVoice() {
      if (!this.supported) return null;

      const language = this.language;
      const fullCode = normalize(LANGUAGE_CODES[language]);

      const matches = window.speechSynthesis
        .getVoices()
        .filter(voice => {
          const code = normalize(voice.lang);

          return code === language ||
            code.startsWith(`${language}-`) ||
            (language === 'he' &&
              (code === 'iw' || code.startsWith('iw-')));
        });

      return matches.find(
        voice =>
          voice.localService &&
          normalize(voice.lang) === fullCode
      ) || matches.find(voice => voice.localService) ||
        matches[0] || null;
    }

    reportMissingVoice() {
      if (this.warnedLanguage === this.language) return;

      this.warnedLanguage = this.language;

      this.onStatus({
        type: 'voice-unavailable',
        language: this.language
      });
    }

    queueUntilVoicesLoad(text, key) {
      // Keep only the latest message, avoiding outdated guidance.
      this.pending = { text, key };

      if (this.voiceTimer !== null) return;

      this.voiceTimer = window.setTimeout(() => {
        this.voiceTimer = null;

        if (!this.pending || !this.enabled) return;

        const request = this.pending;

        if (this.findVoice()) {
          this.speak(request.text, request.key);
        } else {
          this.pending = null;
          this.reportMissingVoice();
        }
      }, 3000);
    }

    speak(text, key = null) {
      const message = String(text || '').trim();

      if (!this.enabled || !message) return false;

      if (!this.supported) {
        this.onStatus({ type: 'unsupported' });
        return false;
      }

      const voice = this.findVoice();

      if (!voice) {
        if (window.speechSynthesis.getVoices().length === 0) {
          this.queueUntilVoicesLoad(message, key);
        } else {
          this.clearPending();
          this.reportMissingVoice();
        }

        return false;
      }

      this.stop();
      this.warnedLanguage = null;

      const utterance = new SpeechSynthesisUtterance(message);

      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = 1;
      utterance.pitch = 1;

      utterance.onend = () => {
        if (this.utterance === utterance) {
          this.utterance = null;
        }
      };

      utterance.onerror = event => {
        // Ignore callbacks belonging to an interrupted old message.
        if (this.utterance !== utterance) return;

        this.utterance = null;

        if (
          event.error === 'canceled' ||
          event.error === 'interrupted'
        ) return;

        // Allow retrying an instruction that failed.
        if (this.lastAnnouncementKey === key) {
          this.lastAnnouncementKey = null;
        }

        this.onStatus({
          type: 'speech-error',
          error: event.error
        });
      };

      this.utterance = utterance;

      if (key !== null) {
        this.lastAnnouncementKey = key;
      }

      try {
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        this.utterance = null;
        this.lastAnnouncementKey = null;

        this.onStatus({
          type: 'speech-error',
          error: String(error)
        });

        return false;
      }

      // Accepted by the engine; actual playback is device-dependent.
      return true;
    }

    instruction(text, key = text) {
      const message = String(text || '').trim();
      if (!message) return false;

      this.lastInstruction = message;

      const announcementKey = `instruction:${key}`;

      if (
        announcementKey === this.lastAnnouncementKey ||
        announcementKey === this.pending?.key
      ) return false;

      return this.speak(message, announcementKey);
    }

    announce(text, key = text) {
      const announcementKey = `announcement:${key}`;

      if (
        announcementKey === this.lastAnnouncementKey ||
        announcementKey === this.pending?.key
      ) return false;

      return this.speak(text, announcementKey);
    }

    repeat() {
      return this.speak(this.lastInstruction);
    }

    clearPending() {
      this.pending = null;

      if (this.voiceTimer !== null) {
        window.clearTimeout(this.voiceTimer);
        this.voiceTimer = null;
      }
    }

    stop() {
      this.clearPending();

      const hadUtterance = Boolean(this.utterance);
      this.utterance = null;

      if (this.supported && hadUtterance) {
        window.speechSynthesis.cancel();
      }
    }

    reset() {
      this.stop();
      this.lastInstruction = '';
      this.lastAnnouncementKey = null;
    }

    destroy() {
      this.reset();

      if (this.supported) {
        window.speechSynthesis.removeEventListener(
          'voiceschanged',
          this.handleVoicesChanged
        );
      }
    }
  }

  CampusAudioGuide.STORAGE_KEY = STORAGE_KEY;
  window.CampusAudioGuide = CampusAudioGuide;
})();