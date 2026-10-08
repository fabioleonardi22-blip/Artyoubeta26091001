/* Precompiled page logic. No dynamic JavaScript evaluation. */
window.ARTYOU_DC_LOGIC_FACTORY = function(DCLogic, React) {

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { filter: "Tutti" };
  }
  renderVals() {
    var self = this;
    var filter = (this.state && this.state.filter) || "Tutti";
    var meta = {
      "Improvvisazione": { color: "#1A6E99", dot: "#2CA8E0", tint: "#0F4A66" },
      "Teatro": { color: "#941880", dot: "#941880", tint: "#4A1040" },
      "ImproEnglish": { color: "#127A70", dot: "#28B4A8", tint: "#0E4A45" },
      "Formazione docenti": { color: "#4F7A0A", dot: "#94C01C", tint: "#3D5410" },
      "Stand-up": { color: "#C0145C", dot: "#E41870", tint: "#5A0F30" }
    };
    var all = [
      { name: "Cinzia Zadro", role: "Triennio e avanzati · Responsabile comunicazione", disc: ["Improvvisazione"] },
      { name: "Federica Forb", slug: "federica-forbicioni", role: "Impro triennio e avanzati", disc: ["Improvvisazione"] },
      { name: "Valerio Boni", role: "Teatro di testo", disc: ["Teatro"] },
      { name: "Francesco Parisi", role: "Triennio e ImproEnglish", disc: ["Improvvisazione", "ImproEnglish"] },
      { name: "Marco Masi", role: "Triennio improvvisazione teatrale", disc: ["Improvvisazione"] },
      { name: "Francesca Giombini", role: "Triennio improvvisazione teatrale", disc: ["Improvvisazione"] },
      { name: "Andrea Onori", role: "Teatro di testo base e avanzato", disc: ["Teatro"] },
      { name: "Alberto Bellandi", role: "Corsi Amatori · Movimento scenico", disc: ["Improvvisazione"] },
      { name: "Giulia Bornacin", role: "Corsi Amatori · Movimento scenico", disc: ["Improvvisazione"] },
      { name: "Livia Massimi", role: "Teatro di testo", disc: ["Teatro"] },
      { name: "Andrea Cecili", role: "Affiancatori Formazione Docenti", disc: ["Formazione docenti"] },
      { name: "Andrea Verteramo", role: "Affiancatori Formazione Docenti", disc: ["Formazione docenti"] },
      { name: "Sandro Canori", role: "Stand-up comedy", disc: ["Stand-up"], ig: "https://www.instagram.com/sandro_canori/", handle: "@sandro_canori" },
      { name: "Antonio Micali", role: "Stand-up comedy", disc: ["Stand-up"], ig: "https://www.instagram.com/antomicanto/", handle: "@antomicanto" },
      { name: "Velia Lalli", role: "Stand-up comedy", disc: ["Stand-up"], ig: "https://www.instagram.com/velialalli/", handle: "@velialalli" }
    ];
    var PHOTO = {"Cinzia Zadro":"/img/insegnanti/cinzia-zadro.jpg","Federica Forb":"/img/insegnanti/federica-forbicioni.jpg","Francesco Parisi":"/img/insegnanti/francesco-parisi.jpg","Marco Masi":"/img/insegnanti/marco-masi.jpg","Francesca Giombini":"/img/insegnanti/francesca-giombini.jpg","Andrea Onori":"/img/insegnanti/andrea-onori.jpg","Andrea Verteramo":"/img/insegnanti/andrea-verteramo.png","Livia Massimi":"/img/insegnanti/livia-massimi.jpg","Valerio Boni":"/img/insegnanti/valerio-boni.jpg","Giulia Scarpino":"/img/insegnanti/giulia-scarpino.jpg","Fabio Leonardi":"/img/insegnanti/fabio-leonardi.jpg","Sandro Canori":"/img/standup-sandro.jpg","Antonio Micali":"/img/standup-antonio.jpg","Velia Lalli":"/img/standup-velia.jpg"};
    var teachers = all.filter(function (t) { return filter === "Tutti" || t.disc.indexOf(filter) >= 0; }).map(function (t) {
      var ph = PHOTO[t.name]; return { slug: t.slug || t.name.toLowerCase().replace(/ /g, "-"), name: t.name, role: t.role, photo: ph || "", hasPhoto: !!ph, noPhoto: !ph, hasProfile: !t.noProfile, noProfile: !!t.noProfile, ig: t.ig || "https://www.instagram.com/[username]/", handle: t.handle || "@[username]", tint: meta[t.disc[0]].tint, tags: t.disc.map(function (x) { return { label: x, color: meta[x].color, dot: meta[x].dot }; }) };
    });
    var filters = ["Tutti", "Improvvisazione", "Teatro", "Stand-up"].map(function (label) {
      var on = label === filter;
      return { label: label, bg: on ? "#13181D" : "transparent", fg: on ? "#FFFFFF" : "#13181D", border: on ? "#13181D" : "#CFC8BA", pick: function () { self.setState({ filter: label }); } };
    });
    return { accent: this.props.accent ?? "#F09000", teachers: teachers, filters: filters };
  }
}

return Component;
};
