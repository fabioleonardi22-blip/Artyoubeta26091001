(function(){
"use strict";
var endpoint=window.ARTYOU_EVENTS_ENDPOINT||"";
window.ARTYOU_DYNAMIC_SHOWS=window.ARTYOU_DYNAMIC_SHOWS||[];
if(!endpoint) return;
fetch(endpoint+"?action=public&_="+Date.now())
  .then(function(r){return r.json();})
  .then(function(res){
    if(!res||!res.ok||!Array.isArray(res.events)) return;
    window.ARTYOU_DYNAMIC_SHOWS=res.events;
    window.dispatchEvent(new CustomEvent("artyou-events-loaded",{detail:res.events}));
  })
  .catch(function(){});
})();
