/* Precompiled Artyou page logic: avoids dynamic code evaluation. */
window.ARTYOU_DC_LOGIC_FACTORY = function(DCLogic, React) {

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { ev: 0, seats: 2, confirmed: false };
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
    var maxPer = this.props.maxPerPrenotazione ?? 6;
    var names = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica", "Lunedì"];
    var shNames = ["Spettacolo", "Spettacolo"], shTimes = ["Caricamento…", "Caricamento…"];
    var ev = st.ev || 0, sh = st.sh || 0;
    var remS = names.map(function(){ return [null,null]; });
    var mk = function (i) { return { label: names[i] + " " + (15 + i) + " febbraio", sub: "Primo e secondo spettacolo" }; };
    var evenings = names.map(function (n, i) {
      var d = mk(i);
      return Object.assign({ label: d.label, sub: "Caricamento dal gestionale…", pick: function () { self.setState({ ev: i }); } },
        {left:"Caricamento…",leftColor:"#555D64",leftWeight:500}, self.row(i === ev));
    });
    var calendar = names.map(function (n, i) {
      return { day: String(15 + i), wd: n.slice(0, 3), shows: [0, 1].map(function (j) {
        var on = i === ev && j === sh;
        return Object.assign({ n: "Spettacolo", time: "Caricamento…", title: "Caricamento dal gestionale…", teacher: "", posterCss: "none", posterFallback: "Locandina", bg: on ? "#F6EAF3" : "#FFFFFF", border: on ? "#941880" : "#E4DED2", pick: function () { self.setState({ ev: i, sh: j }); } }, {left:"",leftColor:"#555D64",leftWeight:500});
      }) };
    });
    var showOpts = [0, 1].map(function (j) { return Object.assign({ label: "Caricamento dal gestionale…", time: "", pick: function () { self.setState({ sh: j }); } }, {left:"Caricamento…",leftColor:"#555D64",leftWeight:500}, self.row(j === sh)); });
    var r = null;
    var maxAllowed = maxPer;
    var seats = Math.max(1, Math.min(st.seats || 2, Math.max(1, maxAllowed)));
    var seatsLabel = seats === 1 ? "1 posto" : seats + " posti";
    var what = seatsLabel + " per il " + shNames[sh].toLowerCase() + " di " + mk(ev).label.toLowerCase();
    return {
      accent: this.props.accent ?? "#F09000",
      evenings: evenings, calendar: calendar, showOpts: showOpts,
      seats: seats, maxNote: "Disponibilità dal gestionale",
      plusOpacity: seats >= maxAllowed ? 0.35 : 1,
      available: true, soldOut: false, soldTitle: "Spettacolo esaurito",
      payNote: "Costo: 12 € a persona. Totale per " + seatsLabel + ": " + (12 * seats) + " €.",
      ctaLabel: "Conferma e paga con PayPal",
      wa: "https://wa.me/393271881956?text=" + encodeURIComponent("Ciao! Vorrei prenotare per Un Vortice di Emozioni: " + what + "."),
      waWait: "https://wa.me/393271881956?text=" + encodeURIComponent("Ciao! Il " + shNames[sh].toLowerCase() + " di " + mk(ev).label.toLowerCase() + " di Un Vortice di Emozioni è esaurito: potete mettermi in lista d’attesa?"),
      confirmed: !!st.confirmed, notConfirmed: !st.confirmed,
      doneTitle: "Posto prenotato!",
      summary: "Un Vortice di Emozioni · " + what + ".",
      doneNote: "La prenotazione non costituisce una ricevuta di pagamento. Conserva il codice e verifica l’esito mostrato dal sistema.",
      minus: function () { self.setState({ seats: Math.max(1, seats - 1) }); },
      plus: function () { self.setState({ seats: Math.min(maxAllowed, seats + 1) }); },
      confirm: function () { self.setState({ confirmed: true }); },
      edit: function () { self.setState({ confirmed: false }); }
    };
  }
}

return Component;
};
