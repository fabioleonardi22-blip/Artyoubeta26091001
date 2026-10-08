/* Precompiled page logic. No dynamic JavaScript evaluation. */
window.ARTYOU_DC_LOGIC_FACTORY = function(DCLogic, React) {

class Component extends DCLogic {
  constructor(props) { super(props); this.state = { sent: false }; }
  componentDidMount() {
    var self = this;
    this.onHash = function () { self.setState({ h: window.location.hash, pick: null }); };
    window.addEventListener("hashchange", this.onHash);
  }
  componentWillUnmount() { window.removeEventListener("hashchange", this.onHash); }
  hash() { try { return decodeURIComponent((window.location.hash || "").slice(1)); } catch (e) { return ""; } }
  renderVals() {
    var self = this, st = this.state || {};
    var C = [["pattern", "Amatori · Pattern"], ["gioco-della-scena", "Amatori · Il gioco della scena"], ["grand-hotel-bellevue", "Amatori · Grand Hotel Bellevue"], ["coscienza-di-zero", "Amatori · La coscienza di Zero"], ["dalla-testa-ai-piedi", "Amatori · Dalla testa ai piedi"]];
    var h = this.hash();
    var idx = st.pick != null ? st.pick : Math.max(0, C.map(function (c) { return c[0]; }).indexOf(h));
    var courses = C.map(function (c, i) { var on = i === idx; return { label: c[1], bg: on ? "#13181D" : "#FFFFFF", fg: on ? "#FFFFFF" : "#13181D", border: on ? "#13181D" : "#CFC8BA", pick: function () { self.setState({ pick: i }); } }; });
    var selId = C[idx][0];
    var isWorkshow = /^ws-/.test(selId);
    return { accent: this.props.accent ?? "#F09000", courses: courses, selLabel: C[idx][1], selId: selId, waEnrollment: "https://wa.me/393271881956?text=" + encodeURIComponent("Ciao volevo iscrivermi al corso " + C[idx][1].replace(/^Amatori · /, "") + " degli Amatori"), isWorkshow: isWorkshow, notWorkshow: !isWorkshow, sent: !!st.sent, notSent: !st.sent,
      send: function () { self.setState({ sent: true }); }, reset: function () { self.setState({ sent: false }); } };
  }
}

return Component;
};
