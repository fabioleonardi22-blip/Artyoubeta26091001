(function(w){
"use strict";
var TOKEN_KEY="artyouGoogleCredential";
var SESSION_KEY="artyouGoogleSession";

function getToken(){return sessionStorage.getItem(TOKEN_KEY)||""}
function getSession(){try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||"null")}catch(e){return null}}
function clear(){sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(SESSION_KEY);sessionStorage.removeItem("artyouCalendarEmail")}

async function authorizeCredential(credential){
  const r=await fetch("/api/google-auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:credential})});
  const data=await r.json();
  if(!r.ok||!data.ok)throw new Error(data.errore||"accesso_non_autorizzato");
  sessionStorage.setItem(TOKEN_KEY,credential);
  sessionStorage.setItem(SESSION_KEY,JSON.stringify(data));
  sessionStorage.setItem("artyouCalendarEmail",data.email||"");
  return data;
}

async function init(opts){
  opts=opts||{};
  var mount=document.getElementById(opts.buttonId||"googleLoginButton");
  var status=document.getElementById(opts.statusId||"loginStatus");
  function setStatus(msg,kind){if(status){status.textContent=msg;status.className="status "+(kind||"warn")}}
  try{
    const cfg=await fetch("/api/google-client-id",{cache:"no-store"}).then(r=>r.json());
    if(!cfg.ok||!cfg.clientId)throw new Error(cfg.errore||"google_client_id_missing");

    var existing=getToken();
    if(existing){
      try{
        setStatus("Verifica sessione Google…","warn");
        var session=await authorizeCredential(existing);
        if(opts.onAuthorized)opts.onAuthorized(session);
        return;
      }catch(e){clear()}
    }

    async function waitForGoogleIdentity(timeoutMs){
      timeoutMs=timeoutMs||12000;
      var started=Date.now();
      while(Date.now()-started<timeoutMs){
        if(w.google&&w.google.accounts&&w.google.accounts.id)return w.google.accounts.id;
        await new Promise(function(resolve){setTimeout(resolve,120);});
      }
      throw new Error("google_identity_non_caricato");
    }
    var googleId=await waitForGoogleIdentity(12000);
    googleId.initialize({
      client_id:cfg.clientId,
      callback:async function(resp){
        try{
          setStatus("Verifica autorizzazione…","warn");
          var session=await authorizeCredential(resp.credential);
          setStatus("Accesso autorizzato.","ok");
          if(opts.onAuthorized)opts.onAuthorized(session);
        }catch(e){
          clear();
          var m=String(e.message||"");
          if(m==="accesso_non_autorizzato")m="Questo account Google non è autorizzato.";
          else if(m==="google_token_expired")m="Sessione Google scaduta. Accedi di nuovo.";
          setStatus(m,"err");
          if(opts.onDenied)opts.onDenied(e);
        }
      },
      auto_select:false,
      cancel_on_tap_outside:true
    });
    if(mount){
      mount.innerHTML="";
      googleId.renderButton(mount,{theme:"outline",size:"large",text:"signin_with",shape:"rectangular",width:300});
    }
    setStatus("Accedi con un account Google autorizzato da Artyou.","warn");
  }catch(e){
    var msg=String(e.message||e);
    if(msg==="google_client_id_missing")msg="Accesso Google non ancora configurato: manca il Client ID.";
    setStatus(msg,"err");
  }
}

function authHeaders(extra){
  var h=Object.assign({},extra||{});
  var token=getToken();
  if(token)h.Authorization="Bearer "+token;
  return h;
}

w.ArtyouGoogleAuth={init:init,getToken:getToken,getSession:getSession,clear:clear,authHeaders:authHeaders};
})(window);
