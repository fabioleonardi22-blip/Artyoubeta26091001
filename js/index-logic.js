/* Precompiled page logic. No dynamic JavaScript evaluation. */
window.ARTYOU_DC_LOGIC_FACTORY = function(DCLogic, React) {

class Component extends DCLogic {
  constructor(props) {
    super(props);
    var __artyouConsent = null, __artyouCats = {}; try { var saved = JSON.parse(window.localStorage.getItem("artyou-cookie-consent") || "null"); if(saved && saved.version === 2 && ["all","none","custom"].includes(saved.choice) && saved.categories){ __artyouConsent = saved.choice; __artyouCats = saved.categories; } } catch (e) {}
    this.state = { consent: __artyouConsent, cc: __artyouCats, filter: "Tutti", sent: false, gal: "Tutte", idx: 0, paused: false, heroIdx: 0, heroPaused: false };
  }
  componentDidMount() {
    var self = this;
    this.timer = setInterval(function () {
      var st = self.state || {};
      if (!st.paused) self.setState({ idx: (st.idx || 0) + 1 });
    }, 5000);
    this.heroTimer = setInterval(function () {
      var st = self.state || {};
      if (!st.heroPaused) self.setState({ heroIdx: ((st.heroIdx || 0) + 1) % 14 });
    }, 6000);
    this.onEventsLoaded = function () { self.setState({ eventsVersion: Date.now() }); };
    window.addEventListener("artyou-events-loaded", this.onEventsLoaded);
  }
  componentWillUnmount() {
    if (this.timer) clearInterval(this.timer);
    if (this.heroTimer) clearInterval(this.heroTimer);
    window.removeEventListener("artyou-events-loaded", this.onEventsLoaded);
  }
  renderVals() {
    var self = this;
    var st = this.state || {};
    var filter = st.filter || "Tutti";
    var tints = { "Improvvisazione": "#0F4A66", "Teatro": "#4A1040", "Stand-up": "#5A0F30", "ImproEnglish": "#0E4A45", "Eventi": "#3D5410", "Festival": "#3A1330", "Workshop": "#5B4010" };
    var tags = { "Improvvisazione": "#1A6E99", "Teatro": "#941880", "Stand-up": "#C0145C", "ImproEnglish": "#127A70", "Eventi": "#4F7A0A", "Festival": "#7A1631", "Workshop": "#8A6200" };
    var fallbackShows = [
      { cat: "Improvvisazione", day: "04", month: "ott", when: "Domenica 4 ottobre · dalle 19:30", slug: "shortyou", title: "ShortYou · show & aperitivo", where: "The Spot Improv · Via G. Bonaccorsi, 28", img: "img/shortyou-4-ottobre.jpg" },
      { cat: "Improvvisazione", day: "29", month: "nov", when: "Domenica 29 novembre · dalle 19:30", slug: "shortyou-29-novembre", title: "ShortYou · show & aperitivo", where: "The Spot Improv · Via G. Bonaccorsi, 28", img: (window.SHORTYOU_29_NOV_POSTER || "") },
      { cat: "Stand-up", day: "25", month: "ott", when: "Dal 25 ottobre al 13 dicembre · 7 giornate", title: "Corso di Stand-up Comedy · 8ª edizione", where: "Docenti: Antonio Micali · Sandro Canori · Velia Lalli", img: "img/standup-locandina-8-edizione.jpg", href: "stand-up.html", ctaLabel: "Scopri il corso", waText: "Ciao volevo informazioni sul corso di Stand up!" },
      { cat: "Teatro", day: "24", month: "ott", when: "Sabato 24 ottobre · 20:45", slug: "spettacolo-24-ottobre" },
      { cat: "Stand-up", day: "?", month: "presto", when: "Data da definire", title: "Stand-up comedy · lo spettacolo del corso", where: "Bistrot68 Centocelle", slug: "standup-bistrot68" },
      { cat: "Improvvisazione", day: "30", month: "ott", when: "Venerdì 30 ottobre · 21:00" },
      { cat: "Improvvisazione", day: "07", month: "nov", when: "Sabato 7 novembre · 21:00" },
      { cat: "Stand-up", day: "13", month: "nov", when: "Venerdì 13 novembre · 21:30" },
      { cat: "Teatro", day: "20", month: "nov", when: "Venerdì 20 novembre · 20:45" },
      { cat: "Improvvisazione", day: "21", month: "nov", when: "Sabato 21 novembre · 21:00" },
      { cat: "Stand-up", day: "27", month: "nov", when: "Venerdì 27 novembre · 21:30" },
      { cat: "Improvvisazione", day: "04", month: "dic", when: "Venerdì 4 dicembre · 21:00" },
      { cat: "Teatro", day: "11", month: "dic", when: "Venerdì 11 dicembre · 20:45" },
      { cat: "Improvvisazione", day: "18", month: "dic", when: "Venerdì 18 dicembre · 21:00" }
    ];

    function badgeFromLabel(label, tbd) {
      if (tbd) return { day: "?", month: "presto" };
      var s = String(label || "");
      var m = s.match(/\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\b/i);
      if (!m) return { day: "•", month: "data" };
      var months = {gennaio:"gen",febbraio:"feb",marzo:"mar",aprile:"apr",maggio:"mag",giugno:"giu",luglio:"lug",agosto:"ago",settembre:"set",ottobre:"ott",novembre:"nov",dicembre:"dic"};
      return { day: String(m[1]).padStart(2,"0"), month: months[m[2].toLowerCase()] || m[2].slice(0,3).toLowerCase() };
    }

    var managed = (window.ARTYOU_DYNAMIC_SHOWS && window.ARTYOU_DYNAMIC_SHOWS.length) ? window.ARTYOU_DYNAMIC_SHOWS.map(function (e) {
      var first = e.dates && e.dates.length ? e.dates[0] : {label:"Data da definire"};
      var badge = badgeFromLabel(first.label, e.tbd);
      return {
        cat: e.cat || "Eventi",
        day: badge.day,
        month: badge.month,
        when: first.label || "Data da definire",
        slug: e.slug,
        title: e.title,
        where: [e.venue,e.addr].filter(Boolean).join(" · "),
        img: e.poster || "",
        tbd: !!e.tbd,
        dates: Array.isArray(e.dates) ? e.dates : []
      };
    }) : [];

    function eventEndTime(s) {
      if (!s || s.tbd) return Infinity;
      var values = [];
      var dateItems = Array.isArray(s.dates) ? s.dates : [];
      dateItems.forEach(function (d) {
        var raw = d && (d.end || d.ends_at || d.endDate || d.start || d.starts_at || d.startDate || d.datetime || d.date);
        if (raw) {
          var parsed = new Date(raw);
          if (!isNaN(parsed.getTime())) values.push(parsed.getTime());
        }
      });
      var label = String(s.when || (dateItems[dateItems.length - 1] && dateItems[dateItems.length - 1].label) || "");
      var months = {gennaio:0,febbraio:1,marzo:2,aprile:3,maggio:4,giugno:5,luglio:6,agosto:7,settembre:8,ottobre:9,novembre:10,dicembre:11};
      var now = new Date();
      var re = /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(20\d{2}))?/gi;
      var m;
      while ((m = re.exec(label))) {
        var mon = months[m[2].toLowerCase()];
        var year = m[3] ? Number(m[3]) : now.getFullYear();
        if (!m[3] && mon < now.getMonth() - 6) year += 1;
        values.push(new Date(year, mon, Number(m[1]), 23, 59, 59, 999).getTime());
      }
      return values.length ? Math.max.apply(Math, values) : Infinity;
    }
    var all = (managed.length ? managed : fallbackShows).filter(function (s) {
      return eventEndTime(s) >= Date.now();
    });
    var venues = { "Improvvisazione": "[Teatro], Roma", "Teatro": "[Teatro], Roma", "Stand-up": "[Locale], Roma", "ImproEnglish": "[Teatro], Roma", "Eventi": "Roma", "Festival": "Roma", "Workshop": "Roma" };
    var shows = all.filter(function (s) { return filter === "Tutti" || s.cat === filter; }).map(function (s) {
      var msg = s.waText || ("Ciao! Vorrei informazioni su " + (s.title || "l'evento") + " · " + s.when + ".");
      return {
        cat: s.cat, day: s.day, month: s.month, when: s.when,
        title: s.title || "[Titolo spettacolo]", where: s.where || venues[s.cat] || "Roma",
        bgImg: s.img ? "url(" + s.img + ")" : "none",
        href: s.href || ("spettacolo.html#" + (s.slug || "")),
        phOp: s.img ? 0 : 1,
        badgeDisp: s.img ? "none" : "flex",
        tint: tints[s.cat] || "#26343D",
        tagColor: tags[s.cat] || "#415D6B",
        wa: "https://wa.me/393271881956?text=" + encodeURIComponent(msg),
        ctaLabel: s.ctaLabel || "Prenota"
      };
    });
    shows = shows.slice(0, 4);
    var filters = ["Tutti", "Improvvisazione", "Teatro", "Stand-up", "Eventi"].map(function (label) {
      var on = label === filter;
      return {
        label: label,
        bg: on ? "#13181D" : "transparent",
        fg: on ? "#FFFFFF" : "#13181D",
        border: on ? "#13181D" : "#CFC8BA",
        pick: function () { self.setState({ filter: label }); }
      };
    });
    var heroData = [
      { img: "img/home-carousel-01.jpg", pos: "50% 50%", color: "#2CA8E0", caption: "Artyou in scena", alt: "Artyou in scena 1" },
      { img: "img/home-carousel-02.jpg", pos: "50% 50%", color: "#2CA8E0", caption: "Artyou in scena", alt: "Artyou in scena 2" },
      { img: "img/home-carousel-03.jpg", pos: "50% 50%", color: "#2CA8E0", caption: "Artyou in scena", alt: "Artyou in scena 3" },
      { img: "img/home-carousel-04.jpg", pos: "50% 50%", color: "#2CA8E0", caption: "Artyou in scena", alt: "Artyou in scena 4" },
      { img: "img/home-carousel-05.jpg", pos: "50% 50%", color: "#2CA8E0", caption: "Artyou in scena", alt: "Artyou in scena 5" },
      { img: "img/home-carousel-06.jpg", pos: "50% 50%", color: "#2CA8E0", caption: "Artyou in scena", alt: "Artyou in scena 6" },
      { img: "img/home-carousel-07.jpg", pos: "50% 50%", color: "#2CA8E0", caption: "Artyou in scena", alt: "Artyou in scena 7" },
      { img: "img/home-carousel-08.jpg", pos: "50% 50%", color: "#2CA8E0", caption: "Artyou in scena", alt: "Artyou in scena 8" },
      { img: "img/home-carousel-09.jpg", pos: "50% 50%", color: "#2CA8E0", caption: "Artyou in scena", alt: "Artyou in scena 9" },
      { img: "img/home-carousel-10.jpg", pos: "50% 50%", color: "#2CA8E0", caption: "Artyou in scena", alt: "Artyou in scena 10" },
      { img: "img/home-carousel-11.jpg", pos: "50% 50%", color: "#2CA8E0", caption: "Artyou in scena", alt: "Artyou in scena 11" },
      { img: "img/home-carousel-12.jpg", pos: "50% 50%", color: "#2CA8E0", caption: "Artyou in scena", alt: "Artyou in scena 12" },
      { img: "img/home-carousel-13.jpg", pos: "50% 50%", color: "#2CA8E0", caption: "Artyou in scena", alt: "Artyou in scena 13" },
      { img: "img/home-carousel-14.jpg", pos: "50% 50%", color: "#2CA8E0", caption: "Artyou in scena", alt: "Artyou in scena 14" }
    ];
    var hIdx = (st.heroIdx || 0) % heroData.length;
    var heroMode = this.props.heroMode ?? "Foto a rotazione";
    var isVideo = heroMode === "Video";
    var heroSlides = heroData.map(function (h, i) {
      var on = i === hIdx;
      return { n: i + 1, img: h.img, pos: h.pos, alt: h.alt, op: on ? 1 : 0, scale: on ? 1.06 : 1 };
    });
    var heroDots = heroData.map(function (h, i) {
      var on = i === hIdx;
      return { n: i + 1, w: on ? "28px" : "10px", bg: on ? "#F6F3EC" : "#5A646C", pick: function () { self.setState({ heroIdx: i }); } };
    });
    var T = { masi: "Marco Masi", giombini: "Francesca Giombini", zadro: "Cinzia Zadro", leonardi: "Fabio Leonardi", forbicioni: "Federica Forbicioni", spadoni: "Spadoni", parisi: "Francesco Parisi", scarpino: "Giulia Scarpino", bornacin: "Giulia Bornacin", onori: "Andrea Onori", boni: "Valerio Boni" };
    var SEDI = { eroi: ["Eroi", "Via Ruggero Fiore, 36"], ionio: ["Ionio", "Via Monte Ruggero, 44"], sg73: ["San Giovanni", "Via La Spezia, 73"], sg83: ["San Giovanni", "Via La Spezia, 83"], sgx: ["San Giovanni", "Via La Spezia, [civico]"], va: ["Valle Aurelia", "Via Giuseppe Bonaccorsi, 28"], afr: ["Africano", "Via Eritrea, 91"], boccea: ["Boccea", "Via Teodolfo Mertel, 32-34"] };
    var R = function (sede, when, teachers, extra) {
      var sd = SEDI[sede]; extra = extra || {};
      return { sede: sd[0], addr: sd[1], when: when, teachers: teachers.map(function (k) { var sl = T[k].toLowerCase().replace(/ /g, "-"); var known = ["marco-masi","francesca-giombini","cinzia-zadro","fabio-leonardi","federica-forbicioni","francesco-parisi","giulia-scarpino","andrea-onori","valerio-boni"].indexOf(sl) >= 0; return { name: T[k], href: known ? "insegnante.html#" + sl : "insegnanti.html" }; }), lab: extra.lab || "", hasLab: !!extra.lab, labHref: extra.labHref || "", hasLabHref: !!extra.labHref, "with": extra["with"] || "", hasWith: !!extra["with"] };
    };
    var courses = [
      { label: "1° anno", kicker: "Improvvisazione teatrale", dot: "#2CA8E0", tag: "#1A6E99", title: "Primo anno", desc: "Creatività, ascolto e gioco: si abbassano le difese e si impara a stare in scena senza copione. Non serve esperienza.", start: "Da ottobre", saggi: "Saggio di fine anno: 14-25 giugno, Teatro Primo Piano.", third: "Insegnante",
        groups: [{ title: "", rows: [R("eroi", "Lunedì · 21:15", ["masi"]), R("ionio", "Mercoledì · 21:00", ["giombini"]), R("sg73", "Mercoledì · 19:00", ["zadro"]), R("sg83", "Giovedì · 21:00", ["leonardi"])] }] },
      { label: "2° anno", kicker: "Improvvisazione teatrale", dot: "#2CA8E0", tag: "#1A6E99", title: "Secondo anno", desc: "L’universo emotivo e storie più articolate: si lavora sulle relazioni e sulla costruzione della scena.", start: "Da ottobre", saggi: "In scena il 15-22 febbraio e il 14-25 giugno, Teatro Primo Piano.", third: "Insegnante",
        groups: [{ title: "", rows: [R("eroi", "Mercoledì · 21:15", ["forbicioni"]), R("ionio", "Lunedì · 21:00", ["forbicioni"]), R("ionio", "Giovedì · 21:00", ["spadoni"]), R("sg83", "Lunedì · 21:00", ["zadro"]), R("sg73", "Martedì · 19:00", ["forbicioni", "spadoni"])] }] },
      { label: "3° anno", kicker: "Improvvisazione teatrale", dot: "#2CA8E0", tag: "#1A6E99", title: "Terzo anno", desc: "Personaggi, archetipi e stili teatrali. A fine triennio, l’attestato.", start: "Da ottobre", saggi: "In scena il 15-22 febbraio e il 14-25 giugno, Teatro Primo Piano.", third: "Insegnante",
        groups: [{ title: "", rows: [R("eroi", "Martedì · 21:15", ["zadro"]), R("va", "Giovedì · 21:00", ["parisi"]), R("afr", "Giovedì · 21:00", ["scarpino"]), R("sg73", "Martedì · 21:15", ["spadoni", "forbicioni"]), R("sg83", "Mercoledì · 21:15", ["zadro"])] }] },
      { label: "Amatori", kicker: "Dopo il triennio", dot: "#28B4A8", tag: "#127A70", title: "Corsi Amatori", desc: "Per chi ha finito il triennio, da noi o in un’altra scuola: laboratori settimanali su uno stile, una tecnica o un autore, con spettacolo finale.", start: "2° quadrimestre da febbraio", saggi: "In scena il 15-22 febbraio e il 14-25 giugno, Teatro Primo Piano.", third: "Laboratorio e insegnante",
        groups: [
          { title: "1° quadrimestre · settimanali", rows: [R("va", "Mercoledì · 21:00", ["masi"], { lab: "Il gioco della scena", labHref: "/improvvisazione-teatrale/#amatori-il-gioco-della-scena" }), R("sg73", "Lunedì · 21:00", ["bornacin"], { lab: "Dalla testa ai piedi", labHref: "/improvvisazione-teatrale/#amatori-dalla-testa-ai-piedi" }), R("sg83", "Martedì · 21:15", ["forbicioni"], { lab: "La coscienza di Zero", labHref: "/improvvisazione-teatrale/#amatori-la-coscienza-di-zero" }), R("sg73", "Giovedì · 21:00", ["zadro"], { lab: "Grand Hotel Bellevue", labHref: "/improvvisazione-teatrale/#amatori-grand-hotel-bellevue" })] },
          { title: "2° quadrimestre · San Giovanni", rows: [R("sgx", "Martedì · [orario]", ["forbicioni"], { lab: "[Laboratorio]" }), R("sgx", "Mercoledì · [orario]", ["spadoni"], { lab: "[Laboratorio]" }), R("sgx", "Giovedì · [orario]", ["zadro", "masi"], { lab: "[Laboratorio]" })] }
        ] },
      { label: "Teatro", kicker: "Teatro di testo · open", dot: "#941880", tag: "#941880", title: "Teatro di testo", desc: "Voce, corpo ed emozioni al servizio di un testo. Corsi open, aperti a tutti.", start: "Da ottobre", saggi: "Saggio di fine anno: 14-25 giugno, Teatro Primo Piano.", third: "Insegnante",
        groups: [{ title: "", rows: [R("boccea", "Lunedì · 21:00", ["onori"], { "with": "Massimi" }), R("sg83", "Martedì · 21:15", ["boni"], { "with": "Massimi" })] }] }
    ];
    var ct = st.courseTab || 0;
    var cur = courses[ct];
    var nRows = 0, sediSet = {};
    cur.groups.forEach(function (g) { g.rows.forEach(function (r) { nRows++; sediSet[r.sede] = 1; }); });
    var nSedi = Object.keys(sediSet).length;
    var course = {
      kicker: cur.kicker, dot: cur.dot, tag: cur.tag, title: cur.title, desc: cur.desc, start: cur.start, saggi: cur.saggi,
      count: nRows + (nRows === 1 ? " corso" : " corsi") + " in " + nSedi + (nSedi === 1 ? " sede" : " sedi"),
      groups: cur.groups.map(function (g) { return { title: g.title, hasTitle: !!g.title, thirdHead: cur.third, rows: g.rows }; })
    };
    var courseTabs = courses.map(function (c, i) { var on = i === ct; return { label: c.label, dot: c.dot, bg: on ? "#13181D" : "#FFFFFF", fg: on ? "#FFFFFF" : "#13181D", border: on ? "#13181D" : "#CFC8BA", pick: function () { self.setState({ courseTab: i }); } }; });
    var galColors = { "Spettacoli": "#2CA8E0", "Festival": "#F09000", "YEP": "#28B4A8" };
    var photos = [
      { cat: "Spettacoli", caption: "Artyou in scena", meta: "Foto di scena", img: "img/hero-1.jpg", bpos: "50% 60%", alt: "Allievi di Artyou in una scena di gruppo" },
      { cat: "Spettacoli", caption: "In scena con i teli colorati", meta: "Foto: Alessandra Albertini", img: "img/hero-5.jpg", bpos: "50% 60%", alt: "Allievi in scena con grandi teli colorati" },
      { cat: "Festival", caption: "Roma Improv Festival", meta: "12-13-14 marzo 2027", img: "img/rome-improv-festival.jpg", bpos: "50% 40%", alt: "Improvvisatori applaudono sul palco" },
      { cat: "Spettacoli", caption: "Il saluto finale", meta: "Foto di scena", img: "img/hero-3.jpg", bpos: "50% 60%", alt: "La compagnia saluta il pubblico" },
      { cat: "YEP", caption: "YEP, il raduno estivo", meta: "3-4-5 settembre 2027", img: "img/yep-foto.jpg", bpos: "50% 55%", alt: "Il gruppo di YEP sul prato" },
      { cat: "Spettacoli", caption: "Tre in scena", meta: "Foto di scena", img: "img/hero-2.jpg", bpos: "50% 55%", alt: "Tre improvvisatori in scena" },
      { cat: "Spettacoli", caption: "Due attrici, una storia", meta: "Foto: Alessandra Albertini", img: "img/hero-4.jpg", bpos: "65% 45%", alt: "Due attrici improvvisano una scena" }
    ];
    var gal = st.gal || "Tutte";
    var list = photos.filter(function (p) { return gal === "Tutte" || p.cat === gal; });
    var idx = ((st.idx || 0) % list.length + list.length) % list.length;
    var cur = list[idx];
    var slide = { n: photos.indexOf(cur) + 1, cat: cur.cat, caption: cur.caption, meta: cur.meta, color: galColors[cur.cat], img: cur.img, bpos: cur.bpos, alt: cur.alt, pos: (idx + 1) + " / " + list.length };
    var thumbs = list.map(function (p, i) {
      var on = i === idx;
      return { n: photos.indexOf(p) + 1, img: p.img, border: on ? "#F6F3EC" : "transparent", op: on ? 1 : 0.55, pick: function () { self.setState({ idx: i }); } };
    });
    var galTabs = ["Tutte", "Spettacoli", "Festival", "YEP"].map(function (label) {
      var on = label === gal;
      return { label: label, bg: on ? "#F6F3EC" : "transparent", fg: on ? "#13181D" : "#E6EBEE", border: on ? "#F6F3EC" : "#3A444D", pick: function () { self.setState({ gal: label, idx: 0 }); } };
    });
    return {
      wsOneLine: (this.props.workshowLayout ?? "Titolo su una riga") !== "Punti in evidenza",
      wsTwoLines: (this.props.workshowLayout ?? "Titolo su una riga") === "Punti in evidenza",
      heroPhotos: !isVideo, heroVideo: isVideo,
      heroSlides: heroSlides, heroDots: heroDots,
      heroCaption: isVideo ? "Video dagli spettacoli Artyou" : heroData[hIdx].caption,
      heroColor: isVideo ? "#2CA8E0" : heroData[hIdx].color,
      heroPlaying: !st.heroPaused, heroStopped: !!st.heroPaused,
      heroPlayLabel: st.heroPaused ? "Riprendi la rotazione delle immagini" : "Metti in pausa la rotazione delle immagini",
      heroToggle: function () { self.setState({ heroPaused: !st.heroPaused }); },
      showCookie: (this.props.mostraBannerCookie ?? true) && !st.consent,
      cookieDone: (this.props.mostraBannerCookie ?? true) && !!st.consent,
      cookiePrefs: !!st.cookiePrefs,
      cookiePrefsLabel: st.cookiePrefs ? "Salva preferenze" : "Preferenze",
      cookieCats: [["pref", "Preferenze"], ["stat", "Statistiche"], ["mkt", "Marketing"]].map(function (c) {
        var on = !!(st.cc && st.cc[c[0]]);
        return { label: c[1], on: on ? "true" : "false", track: on ? "#127A70" : "#B9C2C9", justify: on ? "flex-end" : "flex-start", toggle: function () { var cc = Object.assign({}, st.cc || {}); cc[c[0]] = !on; self.setState({ cc: cc }); } };
      }),
      cookieAccept: function () { try { window.localStorage.setItem("artyou-cookie-consent", JSON.stringify({version:2,choice:"all",categories:{pref:true,stat:true,mkt:true},updatedAt:new Date().toISOString()})); } catch (e) {} self.setState({ consent: "all", cc:{pref:true,stat:true,mkt:true}, cookiePrefs: false }); },
      cookieDeny: function () { try { window.localStorage.setItem("artyou-cookie-consent", JSON.stringify({version:2,choice:"none",categories:{pref:false,stat:false,mkt:false},updatedAt:new Date().toISOString()})); } catch (e) {} self.setState({ consent: "none", cc:{pref:false,stat:false,mkt:false}, cookiePrefs: false }); },
      cookiePrefsAction: function () { if (st.cookiePrefs) { try { window.localStorage.setItem("artyou-cookie-consent", JSON.stringify({version:2,choice:"custom",categories:{pref:!!(st.cc&&st.cc.pref),stat:!!(st.cc&&st.cc.stat),mkt:!!(st.cc&&st.cc.mkt)},updatedAt:new Date().toISOString()})); } catch (e) {} } if (st.cookiePrefs) self.setState({ consent: "custom", cookiePrefs: false }); else self.setState({ cookiePrefs: true }); },
      cookieReopen: function () { self.setState({ consent: null }); },
      course: course, courseTabs: courseTabs,
      slide: slide, thumbs: thumbs, galTabs: galTabs,
      playing: !st.paused, paused: !!st.paused,
      playLabel: st.paused ? "Riprendi la rotazione" : "Metti in pausa la rotazione",
      togglePlay: function () { self.setState({ paused: !st.paused }); },
      prev: function () { self.setState({ idx: idx - 1 }); },
      next: function () { self.setState({ idx: idx + 1 }); },
      accent: this.props.accent ?? "#F09000",
      shows: shows,
      filters: filters,
      sent: !!st.sent,
      notSent: !st.sent,
      sendTrial: function () { self.setState({ sent: true }); },
      resetTrial: function () { self.setState({ sent: false }); }
    };
  }
}

return Component;
};
