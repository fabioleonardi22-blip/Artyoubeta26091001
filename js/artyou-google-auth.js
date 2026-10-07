(function(w){
"use strict";
var SESSION_KEY="artyouGoogleSession";

function getToken(){return ""}
function getSession(){try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||"null")}catch(e){return null}}
function clear(){
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem("artyouCalendarEmail");
  try{fetch("/api/google-auth",{method:"DELETE",credentials:"same-origin",keepalive:true}).catch(function(){})}catch(e){}
}

async function readServerSession(){
  var r=await fetch("/api/google-auth",{method:"GET",credentials:"same-origin",cache:"no-store"});
  var data=await r.json().catch(function(){return {ok:false,errore:"backend_response_invalid"}});
  if(!r.ok||!data.ok)throw new Error(data.errore||"accesso_non_autorizzato");
  sessionStorage.setItem(SESSION_KEY,JSON.stringify(data));
  sessionStorage.setItem("artyouCalendarEmail",data.email||"");
  return data;
}

async function authorizeCredential(credential){
  var controller=new AbortController(), timeout=setTimeout(function(){controller.abort()},18000), r;
  try{
    r=await fetch("/api/google-auth",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:credential}),signal:controller.signal});
  }catch(e){if(e&&e.name==="AbortError")throw new Error("auth_timeout");throw e}
  finally{clearTimeout(timeout)}
  var data=await r.json().catch(function(){return {ok:false,errore:"backend_response_invalid"}});
  if(!r.ok||!data.ok)throw new Error(data.errore||"accesso_non_autorizzato");
  sessionStorage.setItem(SESSION_KEY,JSON.stringify(data));
  sessionStorage.setItem("artyouCalendarEmail",data.email||"");
  return data;
}

function roleAllowed(session,roles){
  if(!Array.isArray(roles)||!roles.length)return true;
  var role=String((session&&session.role)||(session&&session.admin?"admin":"")||"").toLowerCase();
  if(!role){
    var level=String((session&&session.accessLevel)||"").toLowerCase();
    role=level==="amministratore"?"admin":level==="staff"?"staff":"teacher";
  }
  return roles.indexOf(role)!==-1;
}

async function init(opts){
  opts=opts||{};
  var mount=document.getElementById(opts.buttonId||"googleLoginButton");
  var status=document.getElementById(opts.statusId||"loginStatus");
  function setStatus(msg,kind){if(status){status.textContent=msg;status.className="status "+(kind||"warn")}}
  function accept(session){
    if(!roleAllowed(session,opts.roles)){
      clear(); throw new Error("permesso_insufficiente");
    }
    if(opts.onAuthorized)opts.onAuthorized(session);
  }
  try{
    try{
      setStatus("Verifica sessione Google…","warn");
      var existing=await readServerSession();
      accept(existing);
      return;
    }catch(e){
      if(String(e.message||"")!=="google_login_required"&&String(e.message||"")!=="autenticazione_non_valida")clear();
    }

    var cfg=await fetch("/api/google-client-id",{cache:"no-store"}).then(function(r){return r.json()});
    if(!cfg.ok||!cfg.clientId)throw new Error(cfg.errore||"google_client_id_missing");

    async function waitForGoogleIdentity(timeoutMs){
      timeoutMs=timeoutMs||12000;var started=Date.now();
      while(Date.now()-started<timeoutMs){
        if(w.google&&w.google.accounts&&w.google.accounts.id)return w.google.accounts.id;
        await new Promise(function(resolve){setTimeout(resolve,120)});
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
          accept(session);
          setStatus("Accesso autorizzato.","ok");
        }catch(e){
          clear();
          var m=String(e.message||"");
          if(m==="accesso_non_autorizzato")m="Questo account Google non è autorizzato.";
          else if(m==="permesso_insufficiente")m="Il tuo account non ha i permessi necessari per questa sezione.";
          else if(m==="auth_timeout"||m==="backend_timeout")m="Il server di autorizzazione sta impiegando troppo tempo. Riprova.";
          else if(m==="backend_response_invalid")m="Risposta del server non valida. Riprova.";
          setStatus(m,"err");if(opts.onDenied)opts.onDenied(e);
        }
      },
      auto_select:false,cancel_on_tap_outside:true
    });
    if(mount){mount.innerHTML="";googleId.renderButton(mount,{theme:"outline",size:"large",text:"signin_with",shape:"rectangular",width:300})}
    setStatus("Accedi con un account Google autorizzato da Artyou.","warn");
  }catch(e){
    var msg=String(e.message||e);
    if(msg==="google_client_id_missing")msg="Accesso Google non configurato: manca il Client ID.";
    if(msg==="permesso_insufficiente")msg="Il tuo account non ha i permessi necessari per questa sezione.";
    setStatus(msg,"err");if(opts.onDenied)opts.onDenied(e);
  }
}

function authHeaders(extra){return Object.assign({},extra||{})}

w.ArtyouGoogleAuth={init:init,getToken:getToken,getSession:getSession,clear:clear,authHeaders:authHeaders,readServerSession:readServerSession};
})(window);
