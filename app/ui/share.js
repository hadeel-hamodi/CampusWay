// Share a room, building or route: link and QR code.
// Used by the campus map and the indoor page. Needs qr-code.js.
//
//   CampusShare.open({lang, title, url, text})
(function(root){
  const TEXT = {
    en:{
      share:'Share', link:'Link', copy:'Copy link', copied:'Link copied', shareVia:'Share…',
      qrLabel:'QR code for this link', downloadQr:'Download QR code',
      close:'Close',
      scan:'Scan to open the directions on another phone.'
    },
    he:{
      share:'שיתוף', link:'קישור', copy:'העתקת קישור', copied:'הקישור הועתק', shareVia:'שיתוף…',
      qrLabel:'קוד QR לקישור הזה', downloadQr:'הורדת קוד QR',
      close:'סגירה',
      scan:'סרקו כדי לפתוח את הוראות ההגעה בטלפון אחר.'
    },
    ar:{
      share:'مشاركة', link:'الرابط', copy:'نسخ الرابط', copied:'تم نسخ الرابط', shareVia:'مشاركة…',
      qrLabel:'رمز QR لهذا الرابط', downloadQr:'تنزيل رمز QR',
      close:'إغلاق',
      scan:'امسح الرمز لفتح الاتجاهات على هاتف آخر.'
    },
    ru:{
      share:'Поделиться', link:'Ссылка', copy:'Копировать ссылку', copied:'Ссылка скопирована', shareVia:'Поделиться…',
      qrLabel:'QR-код для этой ссылки', downloadQr:'Скачать QR-код',
      close:'Закрыть',
      scan:'Отсканируйте, чтобы открыть маршрут на другом телефоне.'
    }
  };

  function isRtlLanguage(lang){
    return lang === 'he' || lang === 'ar';
  }

  function el(tag, attributes = {}, children = []){
    const node = document.createElement(tag);
    for(const [key, value] of Object.entries(attributes)){
      if(key === 'text') node.textContent = value;
      else if(key === 'class') node.className = value;
      else if(key === 'html') node.innerHTML = value;
      else if(value !== false && value !== null && value !== undefined) node.setAttribute(key, value === true ? '' : value);
    }
    [].concat(children).filter(Boolean).forEach(child => node.append(child));
    return node;
  }

  function slug(value){
    return String(value || 'campusway').toLowerCase()
      .replace(/[^a-z0-9\u0400-\u04ff֐-׿؀-ۿ]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'campusway';
  }

  function download(filename, blob){
    const url = URL.createObjectURL(blob);
    const link = el('a', {href:url, download:filename});
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function qrPng(svgMarkup, size = 512){
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        context.drawImage(image, 0, 0, size, size);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG failed')), 'image/png');
      };
      image.onerror = reject;
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
    });
  }

  // options: {lang, title, url, text (share message), onToast}
  function open(options){
    const lang = TEXT[options.lang] ? options.lang : 'en';
    const text = TEXT[lang];
    const url = options.url;
    const toast = options.onToast || (() => {});

    document.getElementById('cwShareDialog')?.remove();
    const dialog = el('dialog', {
      id:'cwShareDialog', class:'cw-dialog cw-share', 'aria-labelledby':'cwShareTitle',
      lang, dir:isRtlLanguage(lang) ? 'rtl' : 'ltr'
    });
    const close = () => { dialog.close(); dialog.remove(); };

    let svg = '';
    try{
      const qr = root.CampusQR.encode(url, 'M');
      svg = root.CampusQR.toSvg(qr, {label:text.qrLabel, dark:'#0D1B3E'});
    }catch(error){
      svg = '';
    }

    const linkInput = el('input', {type:'text', readonly:true, value:url, id:'cwShareLink', 'aria-label':text.link, dir:'ltr'});
    const copyButton = el('button', {type:'button', class:'btn btn-ghost', text:text.copy});
    copyButton.addEventListener('click', async () => {
      try{
        await navigator.clipboard.writeText(url);
      }catch(error){
        linkInput.select();
        document.execCommand && document.execCommand('copy');
      }
      copyButton.textContent = text.copied;
      toast(text.copied);
    });

    const actions = el('div', {class:'cw-dialog-actions'});
    if(navigator.share){
      const shareButton = el('button', {type:'button', class:'btn btn-primary', text:text.shareVia});
      shareButton.addEventListener('click', () => {
        navigator.share({title:options.title, text:options.text || options.title, url}).catch(() => {});
      });
      actions.append(shareButton);
    }
    actions.append(copyButton);

    const qrBox = svg ? el('figure', {class:'cw-qr'}, [
      el('div', {class:'cw-qr-code', html:svg}),
      el('figcaption', {text:text.scan})
    ]) : null;
    const qrDownload = svg ? el('button', {type:'button', class:'btn btn-ghost btn-sm', text:text.downloadQr}) : null;
    qrDownload?.addEventListener('click', () => {
      qrPng(svg).then(blob => download(`campusway-${slug(options.title)}-qr.png`, blob)).catch(() => {});
    });

    const closeButton = el('button', {type:'button', class:'cw-dialog-close', 'aria-label':text.close, title:text.close, text:'✕'});
    closeButton.addEventListener('click', close);

    dialog.append(el('div', {class:'cw-dialog-body'}, [
      closeButton,
      el('h2', {id:'cwShareTitle', text:`${text.share}: ${options.title}`}),
      qrBox,
      qrDownload,
      el('label', {class:'cw-field-label', for:'cwShareLink', text:text.link}),
      linkInput,
      actions
    ]));
    dialog.addEventListener('cancel', () => setTimeout(() => dialog.remove(), 0));
    document.body.append(dialog);
    if(typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    linkInput.focus();
    linkInput.select();
    return dialog;
  }

  root.CampusShare = {open};
})(typeof self !== 'undefined' ? self : this);
