(function(){
  'use strict';

  var d=document;
  var w=window;
  var cfg=w.SAVVANA_TRACKING_CONFIG||{};
  var storageKey='savvana_consent_v2';
  var googleAdsId=String(cfg.googleAdsId||'AW-18498511079');
  var conversionLabel=String(cfg.googleAdsConversionLabel||'xIfICMe01JMdEOfB4_RE');
  var pixelId=String(cfg.metaPixelId||'').trim();
  var metaOk=/^\d{5,}$/.test(pixelId);
  var adsAllowed=false;
  var googleLoaded=false;
  var metaLoaded=false;
  var recentActions=new WeakMap();
  var handledEvents=new WeakSet();

  w.dataLayer=w.dataLayer||[];
  w.gtag=w.gtag||function(){w.dataLayer.push(arguments);};
  w.gtag('consent','default',{
    ad_storage:'denied',
    analytics_storage:'denied',
    ad_user_data:'denied',
    ad_personalization:'denied',
    functionality_storage:'granted',
    personalization_storage:'denied',
    security_storage:'granted',
    wait_for_update:500
  });

  function injectScript(id,src){
    if(d.getElementById(id))return true;
    try{
      var script=d.createElement('script');
      script.id=id;
      script.async=true;
      script.src=src;
      d.head.appendChild(script);
      return true;
    }catch(e){return false;}
  }

  function loadGoogle(){
    if(!adsAllowed||googleLoaded)return;
    googleLoaded=true;
    try{
      w.gtag('js',new Date());
      w.gtag('config',googleAdsId,{send_page_view:false});
      injectScript('savvana-google-ads-tag','https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(googleAdsId));
    }catch(e){googleLoaded=false;}
  }

  function injectMeta(){
    if(d.getElementById('savvana-meta-pixel'))return true;
    return injectScript('savvana-meta-pixel','https://connect.facebook.net/en_US/fbevents.js');
  }

  function ensureFbq(){
    if(typeof w.fbq!=='function'){
      var fbq=function(){
        if(fbq.callMethod)fbq.callMethod.apply(fbq,arguments);
        else fbq.queue.push(arguments);
      };
      fbq.push=fbq;
      fbq.loaded=true;
      fbq.version='2.0';
      fbq.queue=[];
      w.fbq=fbq;
      if(!w._fbq)w._fbq=fbq;
      injectMeta();
    }
    return typeof w.fbq==='function';
  }

  function loadMeta(){
    if(!adsAllowed||!metaOk||metaLoaded)return;
    metaLoaded=true;
    try{
      if(!ensureFbq())return;
      w.fbq('consent','grant');
      w.fbq('set','autoConfig',false,pixelId);
      w.fbq('init',pixelId);
      if(!w.__SAVVANA_META_PAGEVIEW_SENT__){
        w.__SAVVANA_META_PAGEVIEW_SENT__=true;
        w.fbq('track','PageView');
      }
    }catch(e){metaLoaded=false;}
  }

  function applyConsent(allowed){
    adsAllowed=allowed===true;
    try{
      w.gtag('consent','update',{
        ad_storage:adsAllowed?'granted':'denied',
        analytics_storage:'denied',
        ad_user_data:adsAllowed?'granted':'denied',
        ad_personalization:adsAllowed?'granted':'denied',
        functionality_storage:'granted',
        personalization_storage:'denied',
        security_storage:'granted'
      });
    }catch(e){}
    if(metaLoaded&&typeof w.fbq==='function'){try{w.fbq('consent',adsAllowed?'grant':'revoke');}catch(e){}}
    if(adsAllowed){loadGoogle();loadMeta();}
  }

  function readConsent(){
    try{
      var value=JSON.parse(w.localStorage.getItem(storageKey)||'null');
      if(value&&value.version===2&&typeof value.ads==='boolean')return value.ads;
    }catch(e){}
    return null;
  }

  function saveConsent(allowed){
    try{w.localStorage.setItem(storageKey,JSON.stringify({version:2,ads:allowed}));}catch(e){}
  }

  function isWhatsAppLink(link){
    try{
      var url=new URL(link.href||link.getAttribute('href'),w.location.href);
      return url.protocol==='https:'&&url.hostname.toLowerCase()==='wa.me';
    }catch(e){return false;}
  }

  function isValidIntent(source,target,event){
    if(!event||event.isTrusted!==true||!target)return false;
    if(source==='form_submit'){
      if(event.type!=='submit'||event.currentTarget!==target||String(target.tagName).toLowerCase()!=='form')return false;
      try{return typeof target.checkValidity==='function'&&target.checkValidity();}catch(e){return false;}
    }
    if(source==='whatsapp_click'){
      var clicked=event.target&&event.target.closest?event.target.closest('a[href]'):null;
      return event.type==='click'&&event.button===0&&!event.defaultPrevented&&(event.currentTarget===target||(event.currentTarget===d&&clicked===target))&&isWhatsAppLink(target);
    }
    return false;
  }

  function recordIntent(source,target,event){
    if(!adsAllowed||!isValidIntent(source,target,event))return false;
    if(handledEvents.has(event))return false;
    handledEvents.add(event);
    var now=Date.now();
    var previous=recentActions.get(target);
    if(previous!==undefined&&now-previous<750)return false;
    recentActions.set(target,now);
    if(metaOk&&metaLoaded&&typeof w.fbq==='function'){
      try{w.fbq('trackCustom','WhatsAppClick',{source:source});}catch(e){}
    }
    return true;
  }

  function sendConversion(callback){
    if(!adsAllowed||!googleLoaded){if(typeof callback==='function')callback();return false;}
    var settled=false;
    var timer=w.setTimeout(finish,900);
    function finish(){
      if(settled)return;
      settled=true;
      w.clearTimeout(timer);
      if(typeof callback==='function')callback();
    }
    try{
      w.gtag('event','conversion',{
        send_to:googleAdsId+'/'+conversionLabel,
        value:1.0,
        currency:'BRL',
        event_callback:finish,
        event_timeout:900
      });
      return true;
    }catch(e){finish();return false;}
  }

  function assignUrl(url){
    if(!url)return;
    try{w.location.assign(url);}catch(e){w.location.href=url;}
  }

  function openWhatsAppAfterConversion(source,target,event,url){
    if(!isValidIntent(source,target,event))return false;
    var tracked=recordIntent(source,target,event);
    if(!tracked||!adsAllowed||!googleLoaded){assignUrl(url);return false;}
    sendConversion(function(){assignUrl(url);});
    return false;
  }

  w.SavvanaTracking={
    trackWhatsAppIntent:function(source,target,event){
      var tracked=recordIntent(source,target,event);
      if(tracked)sendConversion();
      return tracked;
    },
    openWhatsAppAfterConversion:openWhatsAppAfterConversion,
    isActive:function(){return adsAllowed;},
    hasTracking:function(){return !!(metaOk||googleAdsId);}
  };

  w.gtag_report_conversion=function(url){
    if(!adsAllowed||!googleLoaded){if(url)assignUrl(url);return false;}
    sendConversion(function(){if(url)assignUrl(url);});
    return false;
  };

  d.addEventListener('click',function(event){
    var link=event.target&&event.target.closest?event.target.closest('a[href]'):null;
    if(!link||!isWhatsAppLink(link)||event.isTrusted!==true||event.defaultPrevented||event.button!==0)return;
    var modified=event.metaKey||event.ctrlKey||event.shiftKey||event.altKey;
    var target=(link.getAttribute('target')||'').toLowerCase();
    var sameTab=!target||target==='_self';
    var tracked=recordIntent('whatsapp_click',link,event);
    if(!tracked)return;
    if(sameTab&&!modified&&!link.hasAttribute('download')){
      event.preventDefault();
      sendConversion(function(){assignUrl(link.href);});
    }else{
      sendConversion();
    }
  },true);

  function initializeConsentUi(){
    var banner=d.getElementById('savvana-consent-banner');
    var dialog=d.getElementById('savvana-consent-preferences');
    var checkbox=d.getElementById('savvana-ads-consent');
    var stored=readConsent();
    if(stored===null){if(banner)banner.hidden=false;}
    else{
      applyConsent(stored);
      if(banner)banner.hidden=true;
    }

    function closeDialog(){
      if(!dialog)return;
      try{if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');}catch(e){dialog.removeAttribute('open');}
    }
    function openDialog(){
      if(!dialog)return;
      if(checkbox)checkbox.checked=adsAllowed;
      try{if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}catch(e){dialog.setAttribute('open','');}
    }
    function choose(allowed){
      saveConsent(allowed);
      applyConsent(allowed);
      if(banner)banner.hidden=true;
      closeDialog();
    }

    var accept=d.getElementById('savvana-consent-accept');
    var reject=d.getElementById('savvana-consent-reject');
    var preferences=d.getElementById('savvana-consent-open');
    var save=d.getElementById('savvana-consent-save');
    var close=d.getElementById('savvana-consent-close');
    if(accept)accept.addEventListener('click',function(){choose(true);});
    if(reject)reject.addEventListener('click',function(){choose(false);});
    if(preferences)preferences.addEventListener('click',openDialog);
    if(save)save.addEventListener('click',function(){choose(!!(checkbox&&checkbox.checked));});
    if(close)close.addEventListener('click',closeDialog);
    d.querySelectorAll('[data-open-consent]').forEach(function(button){button.addEventListener('click',openDialog);});
    if(dialog)dialog.addEventListener('click',function(event){if(event.target===dialog)closeDialog();});
    w.addEventListener('storage',function(event){
      if(event.key!==storageKey)return;
      var latest=readConsent();
      if(latest!==null){applyConsent(latest);if(banner)banner.hidden=true;}
    });
  }

  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',initializeConsentUi,{once:true});
  else initializeConsentUi();
})();