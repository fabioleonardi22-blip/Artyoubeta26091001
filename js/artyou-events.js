(function(){
"use strict";
var endpoint=window.ARTYOU_EVENTS_ENDPOINT||"";
window.ARTYOU_DYNAMIC_SHOWS=window.ARTYOU_DYNAMIC_SHOWS||[];
// Existing editorial announcement: no date, capacity or booking is advertised.
window.ARTYOU_PUBLIC_PROGRAM = function () {
  var live = window.ARTYOU_DYNAMIC_SHOWS || [];
  var events = live.map(function (e) {
    var copy = Object.assign({}, e);
    if (/shortyou/i.test(e.slug || "")) {
      copy.cat = "Improvvisazione";
      if (!copy.poster) copy.poster = /29-novembre/.test(e.slug) ? (window.SHORTYOU_29_NOV_POSTER || "") : "/img/shortyou-4-ottobre.jpg";
    }
    return copy;
  });
  if (!events.some(function (e) { return e.slug === "standup-bistrot68"; })) {
    events.push({slug:"standup-bistrot68", title:"Stand-up comedy · lo spettacolo del corso", cat:"Stand-up",
      venue:"Bistrot68 Centocelle", desc:"Gli allievi del corso salgono sul palco con i loro monologhi. Data da definire.",
      tbd:true, informational:true, dates:[{label:"Data da definire"}],
      href:"https://wa.me/393271881956?text=" + encodeURIComponent("Ciao! Vorrei informazioni sullo spettacolo Stand-up al Bistrot68.")});
  }
  return events;
};
if(!endpoint) return;
fetch(endpoint+"?action=public&_="+Date.now())
  .then(function(r){return r.json();})
  .then(function(res){
    if(!res||!res.ok||!Array.isArray(res.events)) return;
    window.ARTYOU_DYNAMIC_SHOWS=res.events;
    window.ARTYOU_EVENTS_LOADED=true;
    window.dispatchEvent(new CustomEvent("artyou-events-loaded",{detail:res.events}));
  })
  .catch(function(){});
})();
