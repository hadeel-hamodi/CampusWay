// Speech voices for the audio guide.
//
// Phones and computers only speak a language they have a voice for. Without
// one, the browser hands Arabic or Hebrew text to an English voice, which
// reads only the numbers. Instead of that, the pages ask here first: when
// the device has no voice for the app language, nothing is spoken and a
// short card explains how to add one on this kind of device.
// Works in the browser (CampusSpeech) and in Node tests.
(function(root, factory){
  const api = factory(root);
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.CampusSpeech = api;
})(typeof self !== 'undefined' ? self : this, function(root){

  const LOCALES = {en:'en-US', he:'he-IL', ar:'ar-SA', ru:'ru-RU'};
  // Android and older browsers still name Hebrew voices "iw".
  const CODES = {en:['en'], he:['he', 'iw'], ar:['ar'], ru:['ru']};
  // Errors that mean "this device cannot speak this language".
  const VOICE_ERRORS = ['language-unavailable', 'voice-unavailable', 'synthesis-unavailable', 'synthesis-failed'];

  const normalize = code => String(code || '').toLowerCase().replace(/_/g, '-');

  function locale(lang){
    return LOCALES[lang] || LOCALES.en;
  }

  function voiceMatches(voice, lang){
    const code = normalize(voice && voice.lang);
    return (CODES[lang] || CODES.en).some(prefix => code === prefix || code.startsWith(`${prefix}-`));
  }

  // Best voice for the language: the one used before, then Google or
  // "natural" voices (clearer), then the exact locale, then any match.
  function pickVoice(voices, lang, savedURI = null){
    const matches = (voices || []).filter(voice => voiceMatches(voice, lang));
    const exact = normalize(locale(lang));
    return matches.find(voice => savedURI && voice.voiceURI === savedURI) ||
      matches.find(voice => /google|natural/i.test(voice.name)) ||
      matches.find(voice => normalize(voice.lang) === exact) ||
      matches[0] || null;
  }

  function synthesis(){
    return root && root.speechSynthesis ? root.speechSynthesis : null;
  }

  // 'ok', 'missing' (the device lists voices, none for this language),
  // 'unknown' (no voice list yet; speak and let the device decide) or
  // 'unsupported' (no speech at all).
  function voiceState(lang, synth = synthesis()){
    if(!synth || typeof synth.getVoices !== 'function') return 'unsupported';
    const voices = synth.getVoices();
    if(!voices.length) return 'unknown';
    return pickVoice(voices, lang) ? 'ok' : 'missing';
  }

  // Browsers load the voice list a moment after the page.
  function whenVoicesReady(synth = synthesis(), timeout = 2500){
    if(!synth || typeof synth.getVoices !== 'function') return Promise.resolve([]);
    if(synth.getVoices().length) return Promise.resolve(synth.getVoices());
    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if(done) return;
        done = true;
        if(typeof synth.removeEventListener === 'function') synth.removeEventListener('voiceschanged', check);
        resolve(synth.getVoices());
      };
      const check = () => { if(synth.getVoices().length) finish(); };
      if(typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', check);
      setTimeout(finish, timeout);
    });
  }

  function isVoiceError(event){
    return Boolean(event && VOICE_ERRORS.includes(event.error));
  }

  // ── Text that reads well aloud ──
  // Directions on screen say "6 م" or "6 מ׳"; a voice reads the letter, not
  // "metres". Symbols such as arrows are dropped.
  function arabicMeters(n){
    if(n === 1) return 'مترًا واحدًا';
    if(n === 2) return 'مترين';
    if(n >= 3 && n <= 10) return `${n} أمتار`;
    return `${n} مترًا`;
  }

  function russianMeters(n){
    const last = n % 10, lastTwo = n % 100;
    if(last === 1 && lastTwo !== 11) return `${n} метр`;
    if(last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} метра`;
    return `${n} метров`;
  }

  function speechText(text, lang){
    let result = String(text || '');
    if(lang === 'ar') result = result.replace(/(\d+)\s?م(?![ء-ي])/g, (match, n) => arabicMeters(Number(n)));
    else if(lang === 'he') result = result.replace(/(\d+)\s?מ[׳']/g, (match, n) => Number(n) === 1 ? 'מטר אחד' : `${n} מטרים`);
    else if(lang === 'ru') result = result.replace(/(\d+)\s?м(?![а-яё])/g, (match, n) => russianMeters(Number(n)));
    else result = result.replace(/(\d+)\s?m\b/g, (match, n) => Number(n) === 1 ? '1 meter' : `${n} meters`);
    return result.replace(/[←→▶◀✓◎•·]/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  // ── Telling the user ──
  function devicePlatform(nav = root && root.navigator){
    const agent = String(nav && nav.userAgent || '');
    if(/iPhone|iPad|iPod/i.test(agent) || (nav && nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)) return 'ios';
    if(/Android/i.test(agent)) return 'android';
    if(/Windows/i.test(agent)) return 'windows';
    if(/Macintosh|Mac OS X/i.test(agent)) return 'mac';
    return 'other';
  }

  const MESSAGES = {
    en: {
      title: 'Your device has no English voice',
      body: 'Directions can’t be read aloud, but they are still shown on screen.',
      ios: 'To add one: Settings → Accessibility → Spoken Content → Voices → English. Then reopen CampusWay.',
      android: 'To add one: open Settings, search for “Text-to-speech”, choose Speech Services by Google, tap Install voice data and download English. Then reopen CampusWay.',
      windows: 'To add one: Settings → Time & Language → Speech → Add voices → English. Then restart your browser.',
      mac: 'To add one: System Settings → Accessibility → Spoken Content → System voice → Manage voices → English. Then restart your browser.',
      other: 'To add one, install an English text-to-speech voice in your device settings, then reopen CampusWay.',
      close: 'Close'
    },
    ar: {
      title: 'لا يتوفر صوت عربي على جهازك',
      body: 'لا يمكن قراءة التعليمات بصوت عالٍ باللغة العربية، لكنها ما زالت ظاهرة على الشاشة.',
      ios: 'لإضافته: الإعدادات ← تسهيلات الاستخدام ← المحتوى المنطوق ← الأصوات ← العربية. ثم أعد فتح CampusWay.',
      android: 'لإضافته: افتح الإعدادات وابحث عن «تحويل النص إلى كلام»، واختر «خدمات الكلام من Google»، ثم اضغط «تثبيت البيانات الصوتية» ونزّل العربية. ثم أعد فتح CampusWay.',
      windows: 'لإضافته: الإعدادات ← الوقت واللغة ← الكلام ← إضافة أصوات ← العربية. ثم أعد تشغيل المتصفح.',
      mac: 'لإضافته: إعدادات النظام ← تسهيلات الاستخدام ← المحتوى المنطوق ← صوت النظام ← إدارة الأصوات ← العربية. ثم أعد تشغيل المتصفح.',
      other: 'لإضافته، ثبّت صوتًا عربيًا لتحويل النص إلى كلام من إعدادات جهازك، ثم أعد فتح CampusWay.',
      close: 'إغلاق'
    },
    he: {
      title: 'אין במכשיר שלך קול בעברית',
      body: 'לא ניתן להקריא את ההוראות בעברית, אבל הן עדיין מוצגות על המסך.',
      ios: 'כדי להוסיף: הגדרות ← נגישות ← תוכן מדובר ← קולות ← עברית. לאחר מכן פתח מחדש את CampusWay.',
      android: 'כדי להוסיף: פתח את ההגדרות, חפש „המרת טקסט לדיבור”, בחר „שירותי דיבור של Google”, הקש „התקנת נתוני קול” והורד עברית. לאחר מכן פתח מחדש את CampusWay.',
      windows: 'כדי להוסיף: הגדרות ← שעה ושפה ← דיבור ← הוספת קולות ← עברית. לאחר מכן הפעל מחדש את הדפדפן.',
      mac: 'כדי להוסיף: הגדרות המערכת ← נגישות ← תוכן מדובר ← קול המערכת ← ניהול קולות ← עברית. לאחר מכן הפעל מחדש את הדפדפן.',
      other: 'כדי להוסיף, התקן קול עברי להמרת טקסט לדיבור בהגדרות המכשיר, ולאחר מכן פתח מחדש את CampusWay.',
      close: 'סגירה'
    },
    ru: {
      title: 'На устройстве нет русского голоса',
      body: 'Подсказки нельзя озвучить, но они по-прежнему показаны на экране.',
      ios: 'Как добавить: Настройки → Универсальный доступ → Устный контент → Голоса → Русский. Затем снова откройте CampusWay.',
      android: 'Как добавить: откройте Настройки, найдите «Синтез речи», выберите «Распознавание и синтез речи от Google», нажмите «Установить голосовые данные» и загрузите русский язык. Затем снова откройте CampusWay.',
      windows: 'Как добавить: Параметры → Время и язык → Речь → Добавить голоса → Русский. Затем перезапустите браузер.',
      mac: 'Как добавить: Системные настройки → Универсальный доступ → Устный контент → Системный голос → Управлять голосами → Русский. Затем перезапустите браузер.',
      other: 'Установите русский голос синтеза речи в настройках устройства, затем снова откройте CampusWay.',
      close: 'Закрыть'
    }
  };

  function missingVoiceMessage(lang, platform = devicePlatform()){
    const text = MESSAGES[lang] || MESSAGES.en;
    return {title:text.title, body:text.body, steps:text[platform] || text.other, close:text.close};
  }

  const NOTICE_ID = 'campuswayVoiceNotice';
  const shownKey = lang => `campusway.voiceNotice.${lang}`;

  function alreadyShown(lang){
    try{ return root.sessionStorage.getItem(shownKey(lang)) === 'shown'; }catch(error){ return false; }
  }

  function hideMissingVoice(){
    const notice = root.document && root.document.getElementById(NOTICE_ID);
    if(notice) notice.remove();
  }

  // Shown once per visit and language, or again when the user turns the
  // audio guide on (force).
  function showMissingVoice(lang, {force = false} = {}){
    const doc = root && root.document;
    if(!doc || !doc.body) return false;
    if(!force && alreadyShown(lang)) return false;
    try{ root.sessionStorage.setItem(shownKey(lang), 'shown'); }catch(error){ /* storage blocked */ }

    hideMissingVoice();
    const message = missingVoiceMessage(lang);
    const notice = doc.createElement('section');
    notice.id = NOTICE_ID;
    notice.setAttribute('role', 'alert');
    notice.lang = lang;
    notice.dir = lang === 'ar' || lang === 'he' ? 'rtl' : 'ltr';
    notice.style.cssText = [
      'position:fixed', 'left:12px', 'right:12px', 'bottom:12px', 'z-index:100000',
      'max-width:460px', 'margin:0 auto', 'padding:14px 44px 14px 16px', 'border-radius:14px',
      'background:#1f2937', 'color:#fff', 'box-shadow:0 8px 28px rgba(0,0,0,.35)',
      'font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'
    ].join(';');
    if(notice.dir === 'rtl') notice.style.padding = '14px 16px 14px 44px';

    const title = doc.createElement('strong');
    title.textContent = `🔇 ${message.title}`;
    title.style.cssText = 'display:block;margin-bottom:4px;font-size:16px';
    const body = doc.createElement('p');
    body.textContent = message.body;
    body.style.cssText = 'margin:0 0 6px';
    const steps = doc.createElement('p');
    steps.textContent = message.steps;
    steps.style.cssText = 'margin:0;opacity:.9';
    const close = doc.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', message.close);
    close.style.cssText = `position:absolute;top:6px;${notice.dir === 'rtl' ? 'left' : 'right'}:6px;width:36px;height:36px;border:0;border-radius:50%;background:transparent;color:#fff;font-size:24px;line-height:1;cursor:pointer`;
    close.addEventListener('click', hideMissingVoice);

    notice.append(title, body, steps, close);
    doc.body.append(notice);
    return true;
  }

  // Waits for the voice list, then tells the user if their language has no
  // voice. Resolves with the voiceState.
  function checkVoice(lang, {force = false} = {}){
    const synth = synthesis();
    if(!synth) return Promise.resolve('unsupported');
    return whenVoicesReady(synth).then(() => {
      const state = voiceState(lang, synth);
      if(state === 'missing') showMissingVoice(lang, {force});
      else hideMissingVoice();
      return state;
    });
  }

  return {
    LOCALES, locale, voiceMatches, pickVoice, voiceState, whenVoicesReady, isVoiceError,
    speechText, devicePlatform, missingVoiceMessage, showMissingVoice, hideMissingVoice, checkVoice
  };
});
