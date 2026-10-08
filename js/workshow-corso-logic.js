/* Precompiled Artyou page logic: avoids dynamic code evaluation. */
window.ARTYOU_DC_LOGIC_FACTORY = function(DCLogic, React) {

class Component extends DCLogic {
  renderVals() {
    return { accent: this.props.accent ?? "#F09000" };
  }
}

return Component;
};
