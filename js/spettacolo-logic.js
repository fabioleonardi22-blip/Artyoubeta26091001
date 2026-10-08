/* Precompiled spettacolo component: no eval / new Function required. */
window.ARTYOU_DC_LOGIC_FACTORY = function(DCLogic, React) {

class Component extends DCLogic {
  constructor(props) { super(props); this.state = { date: 0, seats: 2, confirmed: false, bookingCode: "", paymentMode: "paypal" }; }
  componentDidMount() {
    var self = this;
    this.onHash = function () { self.setState({ h: window.location.hash }); };
    this.onBookingCode = function (ev) {
      var code = ev && ev.detail ? String(ev.detail) : "";
      self.setState({ bookingCode: code });
    };
    this.onEventsLoaded = function () { self.setState({ eventsVersion: Date.now() }); };
    window.addEventListener("hashchange", this.onHash);
    window.addEventListener("artyou-booking-code", this.onBookingCode);
    window.addEventListener("artyou-events-loaded", this.onEventsLoaded);
  }
  componentWillUnmount() {
    window.removeEventListener("hashchange", this.onHash);
    window.removeEventListener("artyou-booking-code", this.onBookingCode);
    window.removeEventListener("artyou-events-loaded", this.onEventsLoaded);
  }
  hash() {
    try {
      var m = window.location.pathname.match(/^\/spettacoli\/([^\/]+)\/?$/);
      if (m && m[1]) return decodeURIComponent(m[1]);
      return decodeURIComponent((window.location.hash || "").slice(1));
    } catch (e) { return ""; }
  }
  avail(r) {
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
    /* COME INSERIRE IL CAST: dentro ogni spettacolo usa, per esempio, cast: [{name: "Fabio Leonardi", slug: "fabio-leonardi"}] */
    var SHOWS_FALLBACK = [{"slug": "shortyou", "title": "ShortYou · show & aperitivo", "cat": "Improvvisazione", "poster": "img/shortyou-4-ottobre.jpg", "desc": "Scene brevi, giochi e tanta complicità con il pubblico: lo show di improvvisazione di Artyou, con aperitivo, al The Spot Improv.", "venue": "The Spot Improv", "addr": "Via Giuseppe Bonaccorsi, 28 – Roma (Valle Aurelia)", "maps": "The Spot Improv, Via Giuseppe Bonaccorsi 28, Roma", "price": 15, "pagaOnline": true, "capienza": 40, "dates": [{"label": "Domenica 4 ottobre · dalle 19:30", "sold": 0}], "cast": []}, {"slug": "shortyou-29-novembre", "title": "ShortYou · show & aperitivo", "cat": "Improvvisazione", "poster": (window.SHORTYOU_29_NOV_POSTER || ""), "desc": "Scene brevi, giochi e tanta complicità con il pubblico: lo show di improvvisazione di Artyou, con aperitivo, al The Spot Improv.", "venue": "The Spot Improv", "addr": "Via Giuseppe Bonaccorsi, 28 – Roma (Valle Aurelia)", "maps": "The Spot Improv, Via Giuseppe Bonaccorsi 28, Roma", "price": 15, "pagaOnline": true, "capienza": 40, "dates": [{"label": "Domenica 29 novembre · dalle 19:30", "sold": 0}], "cast": []}, {"slug": "spettacolo-9-ottobre", "title": "[Titolo spettacolo]", "cat": "Improvvisazione", "poster": "", "desc": "[Descrizione dello spettacolo: il format, chi sale sul palco, cosa aspettarsi.]", "venue": "[Teatro]", "addr": "[Indirizzo], Roma", "maps": "Roma", "price": "[Prezzo]", "dates": [{"label": "Venerdì 9 ottobre · 21:00", "sold": 22}], "cast": []}, {"slug": "spettacolo-24-ottobre", "title": "[Titolo spettacolo]", "cat": "Teatro", "poster": "", "desc": "[Descrizione dello spettacolo.]", "venue": "[Teatro]", "addr": "[Indirizzo], Roma", "maps": "Roma", "price": "[Prezzo]", "dates": [{"label": "Sabato 24 ottobre · 20:45", "sold": 54}], "cast": []}, {"slug": "standup-bistrot68", "title": "Stand-up comedy · lo spettacolo del corso", "cat": "Stand-up", "poster": "", "desc": "Gli allievi del corso di stand-up comedy salgono sul palco con i loro monologhi. Data in via di definizione: lascia il contatto e ti avvisiamo appena esce.", "venue": "Bistrot68 Centocelle", "addr": "[Indirizzo], Roma (Centocelle)", "maps": "Bistrot68 Centocelle Roma", "price": "[Prezzo]", "tbd": true, "dates": [{"label": "Data da definire", "sold": 0}], "cast": []}];
    // Preserve static event details when the API returns only a subset of events.
    // A missing slug must never silently display another event or mark it as past.
    var liveShows = Array.isArray(window.ARTYOU_DYNAMIC_SHOWS) ? window.ARTYOU_DYNAMIC_SHOWS : [];
    var SHOWS = SHOWS_FALLBACK.map(function (fallback) {
      var live = liveShows.filter(function (x) { return x && x.slug === fallback.slug; })[0];
      if (!live) return fallback;
      var merged = Object.assign({}, fallback, live);
      if (!live.title) merged.title = fallback.title;
      if (!live.desc) merged.desc = fallback.desc;
      if (!live.poster) merged.poster = fallback.poster;
      if (!live.venue) merged.venue = fallback.venue;
      if (!live.addr) merged.addr = fallback.addr;
      if (!live.maps) merged.maps = fallback.maps;
      if (!live.cat) merged.cat = fallback.cat;
      if (!Array.isArray(live.dates) || !live.dates.length || !live.dates.some(function(d){return d && (d.label || d.start || d.date);})) merged.dates = fallback.dates;
      return merged;
    }).concat(liveShows.filter(function(x){
      return x && x.slug && !SHOWS_FALLBACK.some(function(f){return f.slug===x.slug;});
    }));
    var META = {"Improvvisazione": ["#1A6E99", "#2CA8E0", "#0F4A66"], "Teatro": ["#941880", "#941880", "#4A1040"], "Stand-up": ["#C0145C", "#E41870", "#5A0F30"], "ImproEnglish": ["#127A70", "#28B4A8", "#0E4A45"]};
    var slug = this.hash();
    var cur = SHOWS.filter(function (x) { return x && x.slug === slug; })[0] || SHOWS_FALLBACK.filter(function (x) { return x.slug === slug; })[0] || null;
    if (!cur) {
      cur = {slug:slug,title:"Spettacolo non disponibile",cat:"Improvvisazione",desc:"Non troviamo questo spettacolo. Consulta il calendario per gli eventi disponibili.",poster:"",venue:"",addr:"",maps:"Roma",price:0,tbd:true,dates:[{label:"Data da definire",sold:0}],cast:[]};
    }
    if (!Array.isArray(cur.dates) || !cur.dates.length) cur.dates=[{label:"Data da definire",sold:0}];
    if (!META[cur.cat]) cur.cat="Improvvisazione";
    function eventEndTime(ev) {
      if (!ev || ev.tbd) return Infinity;
      var values = [], items = Array.isArray(ev.dates) ? ev.dates : [];
      items.forEach(function (d) {
        var raw = d && (d.end || d.ends_at || d.endDate || d.start || d.starts_at || d.startDate || d.datetime || d.date);
        if (raw) {
          var parsed = new Date(raw);
          if (!isNaN(parsed.getTime())) values.push(parsed.getTime());
        }
      });
      var labels = items.map(function (d) { return d && d.label || ""; }).join(" · ");
      var months = {gennaio:0,febbraio:1,marzo:2,aprile:3,maggio:4,giugno:5,luglio:6,agosto:7,settembre:8,ottobre:9,novembre:10,dicembre:11};
      var now = new Date(), re = /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(20\d{2}))?/gi, m;
      while ((m = re.exec(labels))) {
        var mon = months[m[2].toLowerCase()];
        var year = m[3] ? Number(m[3]) : now.getFullYear();
        if (!m[3] && mon < now.getMonth() - 6) year += 1;
        values.push(new Date(year, mon, Number(m[1]), 23, 59, 59, 999).getTime());
      }
      return values.length ? Math.max.apply(Math, values) : Infinity;
    }
    var pastEvent = eventEndTime(cur) < Date.now();
    try {
      var isPlaceholder = !cur || /^\s*\[/.test(String(cur.title||""));
      var canonical = "https://artyouroma.it/spettacoli/" + encodeURIComponent(cur.slug||slug||"") + "/";
      var title = (cur.title ? cur.title + " a Roma | Artyou" : "Spettacolo a Roma | Artyou");
      var desc = cur.desc || ("Scopri " + (cur.title||"lo spettacolo Artyou") + ": date, sede, informazioni e prenotazioni.");
      document.title = title;
      var md = document.querySelector('meta[name="description"]');
      if (md) md.setAttribute("content", desc.slice(0, 160));
      var can = document.querySelector('link[rel="canonical"]');
      if (can) can.setAttribute("href", canonical);
      var rob = document.querySelector('meta[name="robots"]');
      if (rob) rob.setAttribute("content", isPlaceholder ? "noindex,follow" : "index,follow");
    } catch(e) {}
    var cap = cur.capienza ?? (this.props.capienza ?? 60), maxPer = this.props.maxPerPrenotazione ?? 6;
    var sel = Math.min(st.date || 0, cur.dates.length - 1);
    var remaining = cur.dates.map(function (d, i) { var evId = cur.dates.length > 1 ? cur.slug + "-" + i : cur.slug; if (window.ARTYOU_CAP && Object.prototype.hasOwnProperty.call(window.ARTYOU_CAP, evId)) return Math.max(0, window.ARTYOU_CAP[evId]); return Math.max(0, cap - Math.min(cap, d.sold)); });
    var dates = cur.dates.map(function (d, i) { var a = self.avail(remaining[i]); if (cur.tbd) { a.left = "In arrivo"; a.leftColor = "#555D64"; a.leftWeight = 600; } return Object.assign({ label: d.label, sub: cur.venue, pick: function () { self.setState({ date: i }); } }, a, self.row(i === sel)); });
    var rem = cur.tbd ? 1 : remaining[sel];
    var maxAllowed = Math.min(rem, maxPer);
    var seats = Math.max(1, Math.min(st.seats || 2, Math.max(1, maxAllowed)));
    var seatsLabel = seats === 1 ? "1 posto" : seats + " posti";
    var payOnline = !!(cur.pagaOnline && typeof cur.price === "number" && cur.price > 0);
    var paymentMode = st.paymentMode || "paypal";
    var payAtVenue = paymentMode === "locale";
    var what = cur.title + " · " + cur.dates[sel].label;
    var s = { title: cur.title, cat: cur.cat, desc: cur.desc, venue: cur.venue, addr: cur.addr, price: cur.price,
      when: cur.dates.map(function (d) { return d.label; }).join(" / "),
      tag: META[cur.cat][0], dot: META[cur.cat][1], tint: META[cur.cat][2],
      bg: cur.poster ? "url(" + cur.poster + ")" : "none", phOp: cur.poster ? 0 : 1,
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(cur.maps),
      slugId: cur.dates.length > 1 ? cur.slug + "-" + sel : cur.slug,
      prezzoNum: typeof cur.price === "number" ? cur.price : "", pagaOnlineFlag: payOnline };
    return {
      accent: this.props.accent ?? "#F09000", s: s, dates: dates, cast: cur.cast || [], hasCast: !!(cur.cast && cur.cast.length),
      bookingDisplay: pastEvent ? "none" : "flex", pastDisplay: pastEvent ? "flex" : "none",
      cardTitle: cur.tbd ? "Avvisami quando esce la data" : "Prenota il tuo posto",
      dateLabelTitle: cur.tbd ? "Data" : "Scegli la data",
      notTbd: !cur.tbd, seats: seats, seatsLabel: seatsLabel,
      maxNote: rem <= maxPer ? "Restano " + rem + " posti" : "Massimo " + maxPer + " a prenotazione",
      plusOpacity: seats >= maxAllowed ? 0.35 : 1,
      available: rem > 0, soldOut: rem === 0, soldTitle: "Spettacolo esaurito",
      payTitle: cur.tbd ? "Nessun pagamento ora" : "Modalità di pagamento",
      payNote: cur.tbd ? "Ti scriviamo appena la data è confermata, e potrai prenotare per primo." : (payOnline ? ((payAtVenue ? "Pagherai al locale: " : "Pagamento PayPal: ") + (cur.price * seats).toFixed(2).replace(".", ",") + " € per " + seatsLabel + ".") : "Prenoti ora e paghi in cassa la sera dello spettacolo."),
      paymentModeLabel: payAtVenue ? "Paga al Locale" : "Paga con PayPal",
      pagaOnlineSelected: payOnline && !payAtVenue ? "true" : "false",
      paypalBg: !payAtVenue ? "#FFF3CF" : "#FFFFFF", paypalBorder: !payAtVenue ? "#F09000" : "#CFC8BA",
      localeBg: payAtVenue ? "#E9F8EE" : "#FFFFFF", localeBorder: payAtVenue ? "#25A95A" : "#CFC8BA",
      payPaypal: function () { self.setState({ paymentMode: "paypal" }); },
      payLocale: function () { self.setState({ paymentMode: "locale" }); },
      ctaLabel: cur.tbd ? "Avvisami" : (payOnline ? (payAtVenue ? "Prenota e paga al Locale · " + seatsLabel : "Paga con PayPal · " + seatsLabel) : "Conferma prenotazione · " + seatsLabel),
      wa: "https://wa.me/393271881956?text=" + encodeURIComponent("Ciao! Vorrei prenotare per " + what + "."),
      waWait: "https://wa.me/393271881956?text=" + encodeURIComponent("Ciao! " + what + " è esaurito: potete mettermi in lista d’attesa?"),
      confirmed: !!st.confirmed, notConfirmed: !st.confirmed, bookingCode: st.bookingCode || "",
      doneTitle: cur.tbd ? "Ti avviseremo!" : "Prenotazione confermata!",
      summary: cur.tbd ? cur.title + ", " + cur.venue + "." : seatsLabel + " per " + what + ".",
      doneNote: cur.tbd ? "Appena la data è confermata ti scriviamo per prenotare." : (payOnline && !payAtVenue ? "Prenotazione registrata: ora completi il pagamento su PayPal." : "Ti abbiamo inviato un’email di riepilogo: paghi al locale la sera dello spettacolo."),
      minus: function () { self.setState({ seats: Math.max(1, seats - 1) }); },
      plus: function () { self.setState({ seats: Math.min(maxAllowed, seats + 1) }); },
      confirm: function () { self.setState({ confirmed: true }); },
      edit: function () { self.setState({ confirmed: false }); }
    };
  }
}

return Component;
};
