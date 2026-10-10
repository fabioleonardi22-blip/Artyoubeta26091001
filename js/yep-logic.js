/* Precompiled Artyou page logic: avoids dynamic code evaluation. */
window.ARTYOU_DC_LOGIC_FACTORY = function(DCLogic, React) {

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { type: 0, lv: 0, room: 0, pay: 0, confirmed: false };
  }
  componentDidMount() {
    var self = this;
    this.onCapacityRefresh = function () { self.setState({ capVersion: Date.now() }); };
    window.addEventListener("hashchange", this.onCapacityRefresh);
    window.addEventListener("artyou:capacity-updated", this.onCapacityRefresh);
    this.onBookingSuccess = function () { self.setState({ confirmed: true }); };
    window.addEventListener("artyou:booking-success", this.onBookingSuccess);
    this.onCapacityRefresh();
    setTimeout(this.onCapacityRefresh, 250);
    setTimeout(this.onCapacityRefresh, 1000);
  }
  componentWillUnmount() {
    window.removeEventListener("hashchange", this.onCapacityRefresh);
    window.removeEventListener("artyou:capacity-updated", this.onCapacityRefresh);
    window.removeEventListener("artyou:booking-success", this.onBookingSuccess);
  }
  avail(r) {
    if (r === null || r === undefined) {
      return { left: "Dato in arrivo LIVE", leftColor: "#777777", leftWeight: 600 };
    }
    return { left: r === 0 ? "Completo" : (r <= 5 ? "Ultimi " + r + " posti" : r + " posti liberi"), leftColor: r <= 5 ? "#7A1631" : "#555D64", leftWeight: r <= 5 ? 700 : 500 };
  }
  chip(on) {
    return { bg: on ? "#13181D" : "#FFFFFF", fg: on ? "#FFFFFF" : "#13181D", border: on ? "#13181D" : "#CFC8BA" };
  }
  row(on) {
    return { bg: on ? "#E6F3FA" : "#FFFFFF", border: on ? "#1A6E99" : "#E4DED2" };
  }
  renderVals() {
    var self = this, st = this.state || {};
    var typeNames = ["Alloggio + workshop", "Solo vacanza", "Solo workshop"];
    var type = st.type || 0, lv = st.lv || 0, room = st.room || 0, pay = st.pay == null ? 0 : st.pay;
    var mysqlCap = window.ARTYOU_YEP_MYSQL_CAP || {};
    var mysqlEvents = window.ARTYOU_YEP_MYSQL_EVENT_INFO || {};
    var capMap = Object.keys(mysqlCap).length ? mysqlCap : (window.ARTYOU_CAP || {});
    var eventMap = Object.keys(mysqlEvents).length ? mysqlEvents : (window.ARTYOU_EVENT_INFO || {});
    var keys = Object.keys(eventMap || {});

    function isYep(k, info) {
      var t = String((info && (info.titolo || info.descrizione || info.tipo)) || "");
      return /^yep[-_]/i.test(k) || /\byep\b/i.test(t);
    }
    function isRoom(k, info) {
      var tipo = String((info && info.tipo) || "");
      var t = String((info && (info.titolo || info.descrizione)) || "");
      return /camera|room/i.test(tipo) || /camera|room|doppia|tripla|singola/i.test(k) || /camera|room|doppia|tripla|singola/i.test(t);
    }
    function isWorkshop(k, info) {
      var tipo = String((info && info.tipo) || "");
      var t = String((info && (info.titolo || info.descrizione)) || "");
      return !isRoom(k,info) && (/workshop|corso|livello/i.test(tipo) || /workshop|corso|livello|principianti|intermedio|intermedi|avanzati|tutti/i.test(k) || /workshop|corso|livello|principianti|intermedio|intermedi|avanzati|tutti/i.test(t));
    }
    function sortIds(a,b) {
      var A=eventMap[a]||{}, B=eventMap[b]||{};
      var oa=Number(A.ordine||9999), ob=Number(B.ordine||9999);
      if(oa!==ob) return oa-ob;
      return String(A.data||"").localeCompare(String(B.data||"")) || String(A.ora||"").localeCompare(String(B.ora||"")) || a.localeCompare(b);
    }

    var dynamicLevels = keys.filter(function(k){ return isYep(k,eventMap[k]) && isWorkshop(k,eventMap[k]); }).sort(sortIds);
    var legacyLevels = ["yep-2027-livello-principianti","yep-2027-livello-intermedio","yep-2027-livello-avanzati","yep-2027-livello-tutti"];
    var levelIds = dynamicLevels.length ? dynamicLevels : legacyLevels;

    var lvData = levelIds.map(function(id, i) {
      var info = eventMap[id] || {};
      return {
        label: info.titolo || ("Livello " + (i + 1)),
        sub: info.descrizione || [info.data, info.ora].filter(Boolean).join(" · ") || "Dato in arrivo LIVE nel gestionale"
      };
    });

    var roomData = [
      { label: "Camera quadrupla", key:"quadrupla", sub: "Preferenza, non garantisce disponibilità" },
      { label: "Camera tripla", key:"tripla", sub: "Preferenza, non garantisce disponibilità" },
      { label: "Camera doppia", key:"doppia", sub: "Preferenza, non garantisce disponibilità" },
      { label: "Camera singola", key:"singola", sub: "Su richiesta, con supplemento" }
    ];

    if (lv >= lvData.length) lv = 0;
    if (room >= roomData.length) room = 0;

    var lvRem = lvData.map(function (l, i) {
      return Object.prototype.hasOwnProperty.call(capMap, levelIds[i])
        ? Math.max(0, Number(capMap[levelIds[i]]) || 0)
        : null;
    });

    var hasWorkshop = type === 0 || type === 2;
    var hasStay = type === 0 || type === 1;
    var isWs = hasWorkshop;
    var levelRem = lvRem[lv];
    var capacityReady = !isWs || (levelRem !== null && levelRem !== undefined);
    var rem = !isWs ? 1 : levelRem;

    var types = typeNames.map(function (l, i) {
      return Object.assign({ label: l, pick: function () { self.setState({ type: i }); } }, self.chip(i === type));
    });

    var wsMeta = [["#2CA8E0", "#1A6E99", "#0F4A66"], ["#F09000", "#9A5A00", "#5C3700"], ["#941880", "#941880", "#4A1040"], ["#28B4A8", "#127A70", "#0E4A45"]];
    var wsCards = lvData.map(function (l, i) {
      var m = wsMeta[i % wsMeta.length];
      var on = isWs && i === lv, full = lvRem[i] === 0, info = eventMap[levelIds[i]] || {};
      return {
        level: l.label,
        title: info.titolo || l.label,
        desc: info.descrizione || l.sub,
        color: m[0], tag: m[1], tint: m[2], border: on ? "#13181D" : "#E4DED2",
        btnLabel: full ? "Completo · lista d’attesa" : (on ? "Selezionato" : "Scegli questo workshop"),
        btnBg: on ? "#13181D" : "#FFFFFF", btnFg: on ? "#FFFFFF" : "#13181D",
        pick: function () { self.setState({ type: 0, lv: i }); }
      };
    });

    var levels = lvData.map(function (l, i) {
      var a = (lvRem[i] === null || lvRem[i] === undefined)
        ? { left: "Dato in arrivo LIVE", leftColor: "#555D64", leftWeight: 500 }
        : self.avail(lvRem[i]);
      return Object.assign({ label: l.label, sub: l.sub, pick: function () { self.setState({ lv: i }); } }, a, self.row(i === lv));
    });

    var rooms = roomData.map(function (r, i) {
      return Object.assign({
        label: r.label,
        sub: r.sub,
        left: i === room ? "Selezionata" : (i === 3 ? "Opzionale" : "Preferenza"),
        leftColor: i === room ? "#1A6E99" : "#555D64",
        leftWeight: i === room ? 700 : 600,
        pick: function () { self.setState({ room: i }); }
      }, self.row(i === room));
    });

    var payOpts = [
      "Paga l’iscrizione · 10 € e salda prima del Festival",
      "Paga tutto · prezzo completo"
    ].map(function(l,i){
      return Object.assign({
        label:l,
        pick:function(){ self.setState({pay:i}); }
      },self.chip(i===pay));
    });

    var what = typeNames[type] + (hasWorkshop ? " · " + lvData[lv].label : "") + (hasStay ? " · " + roomData[room].label : "");
    var eventId = hasWorkshop ? levelIds[lv] : "yep-2027-solo-soggiorno";

    var defaults={cutoff:"2027-06-30",early:{alloggioWorkshop:{quadrupla:320,tripla:330,doppia:350},soloVacanza:{quadrupla:200,tripla:210,doppia:230},soloWorkshop:250},late:{alloggioWorkshop:{quadrupla:350,tripla:360,doppia:380},soloVacanza:{quadrupla:230,tripla:240,doppia:260},soloWorkshop:280}};
    var pricing=defaults;
    for(var pk=0;pk<keys.length;pk++){var pi=eventMap[keys[pk]]||{};if(pi.yepPricing){pricing=pi.yepPricing;break;}}
    var now=new Date(), cutoff=new Date((pricing.cutoff||"2027-06-30")+"T23:59:59");
    var tier=now<=cutoff?(pricing.early||defaults.early):(pricing.late||defaults.late);
    var roomKey=roomData[room].key;
    var fullPrice=0;
    if(type===0) fullPrice=roomKey==="singola"?0:Number((tier.alloggioWorkshop||{})[roomKey]||0);
    else if(type===1) fullPrice=roomKey==="singola"?0:Number((tier.soloVacanza||{})[roomKey]||0);
    else fullPrice=Number(tier.soloWorkshop||0);
    var priceText=fullPrice?fullPrice+" €":"Supplemento su richiesta";
    var roomNote=hasStay?"Preferenza camera: "+roomData[room].label:"Nessun alloggio";

    return {
      accent: this.props.accent ?? "#F09000",
      eventId: eventId,
      bookingResources: "",
      bookingChoice: what,
      bookingNote: roomNote + " · Prezzo YEP: " + priceText,
      bookingSeats: 1,
      payOnline: true,
      paymentMode: pay===0 ? "Iscrizione 10 € + saldo prima del Festival · da regolare con la segreteria" : "Quota intera · da regolare con la segreteria",
      paymentAmount: pay===0 ? 10 : fullPrice,
      payOpts: payOpts,
      wsCards: wsCards,
      types: types, levels: levels, rooms: rooms,
      isWs: isWs, hasStay: hasStay,
      available: capacityReady && rem > 0,
      soldOut: capacityReady && rem === 0,
      capacityPending: !capacityReady,
      soldTitle: "Workshop al completo",
      payNote: pay===0
        ? "Prenoti ora senza pagare online: i <strong>10 €</strong> di iscrizione e il saldo si regolano con la segreteria prima del Festival. La camera resta una preferenza."
        : "Prenoti ora senza pagare online: l’importo di <strong>"+(fullPrice?fullPrice+" €":"da confermare")+"</strong> da regolare con la segreteria: ti scriviamo noi con le istruzioni." + (hasStay ? " La camera resta una preferenza." : ""),
      ctaLabel: "Conferma prenotazione",
      wa: "https://wa.me/393271881956?text=" + encodeURIComponent("Ciao! Vorrei prenotare YEP 2027: " + what + "."),
      waWait: "https://wa.me/393271881956?text=" + encodeURIComponent("Ciao! Per YEP 2027 (" + what + ") il workshop risulta completo: potete mettermi in lista d’attesa?"),
      confirmed: !!st.confirmed, notConfirmed: !st.confirmed,
      doneTitle: "Prenotazione confermata!",
      summary: "YEP 2027, 3-4-5 settembre · " + what + ".",
      doneNote: "Ti abbiamo inviato un’email con i dettagli della prenotazione.",
      confirm: function () { self.setState({ confirmed: true }); },
      edit: function () { self.setState({ confirmed: false }); }
    };

  }
}

return Component;
};
