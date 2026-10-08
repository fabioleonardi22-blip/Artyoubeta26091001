/* Precompiled Artyou page logic: avoids dynamic code evaluation. */
window.ARTYOU_DC_LOGIC_FACTORY = function(DCLogic, React) {

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { type: 0, ws: 0, ev: 0, seats: 2, pay: 0, confirmed: false };
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
    var maxPer = 6;
    var typeNames = ["Pass festival", "Solo workshop", "Spettacoli"];
    var type = st.type || 0;
    var mysqlCap = window.ARTYOU_RIF_MYSQL_CAP || {};
    var mysqlEvents = window.ARTYOU_RIF_MYSQL_EVENT_INFO || {};
    var capMap = Object.keys(mysqlCap).length ? mysqlCap : (window.ARTYOU_CAP || {});
    var eventMap = Object.keys(mysqlEvents).length ? mysqlEvents : (window.ARTYOU_EVENT_INFO || {});
    var keys = Object.keys(eventMap || {});

    function isRif(k, info) {
      var t = (k + " " + String((info && (info.titolo || info.descrizione || info.tipo)) || "")).toLowerCase();
      return /(^|[-_ ])rif([-_ ]|$)|rome improv|roma improv|improv festival/.test(t);
    }
    function isShow(k, info) {
      var t = (k + " " + String((info && (info.titolo || info.descrizione || info.tipo)) || "")).toLowerCase();
      return /spettacolo|show|serata/.test(t);
    }
    function isWorkshop(k, info) {
      var t = (k + " " + String((info && (info.titolo || info.descrizione || info.tipo)) || "")).toLowerCase();
      return !isShow(k,info) && /workshop|laboratorio|corso/.test(t);
    }
    function sortIds(a,b) {
      var A=eventMap[a]||{}, B=eventMap[b]||{};
      var oa=Number(A.ordine||9999), ob=Number(B.ordine||9999);
      if(oa!==ob) return oa-ob;
      return String(A.data||"").localeCompare(String(B.data||"")) ||
             String(A.ora||"").localeCompare(String(B.ora||"")) ||
             a.localeCompare(b);
    }
    function labelFor(id, fallback) {
      var x=eventMap[id]||{};
      return x.titolo || fallback;
    }
    function subFor(id, fallback) {
      var x=eventMap[id]||{};
      return x.descrizione || [x.data,x.ora].filter(Boolean).join(" · ") || fallback;
    }
    function freeFor(id) {
      if(Object.prototype.hasOwnProperty.call(capMap,id)) return Math.max(0,Number(capMap[id])||0);
      var x=eventMap[id]||{};
      if(typeof x.liberi==="number") return Math.max(0,Number(x.liberi)||0);
      return null;
    }

    var wsIds=keys.filter(function(k){return isRif(k,eventMap[k])&&isWorkshop(k,eventMap[k]);}).sort(sortIds);
    var evIds=keys.filter(function(k){return isRif(k,eventMap[k])&&isShow(k,eventMap[k]);}).sort(sortIds);

    function excludedOtherProject(k,info){
      var t=(k+" "+String((info&&(info.titolo||info.descrizione||info.tipo))||"")).toLowerCase();
      return /yep|workshow|shortyou|terapia|lezione di prova|improyoung/.test(t);
    }
    if(!wsIds.length){
      wsIds=keys.filter(function(k){return !excludedOtherProject(k,eventMap[k])&&isWorkshop(k,eventMap[k]);}).sort(sortIds);
    }
    if(!evIds.length){
      evIds=keys.filter(function(k){return !excludedOtherProject(k,eventMap[k])&&isShow(k,eventMap[k]);}).sort(sortIds);
    }

    var legacyWs=["rif-workshop-1","rif-workshop-2","rif-workshop-3","rif-workshop-4"];
    var legacyEv=["rif-spettacolo-venerdi","rif-spettacolo-sabato","rif-spettacolo-domenica"];
    if(!wsIds.length) wsIds=legacyWs;
    if(!evIds.length) evIds=legacyEv;

    var wsData=wsIds.map(function(id,i){
      return {id:id,label:labelFor(id,"Workshop "+(i+1)),sub:subFor(id,"Caricamento dal gestionale…")};
    });
    var evData=evIds.map(function(id,i){
      return {id:id,label:labelFor(id,"Spettacolo "+(i+1)),sub:subFor(id,"Caricamento dal gestionale…")};
    });

    var ws = st.ws || 0, ev = st.ev || 0;
    if(ws>=wsData.length) ws=0;
    if(ev>=evData.length) ev=0;

    var wsRem=wsData.map(function(w){return freeFor(w.id);});
    var evRem=evData.map(function(e){return freeFor(e.id);});

    var isShow = type === 2, isWs = !isShow;
    var rem = isShow ? evRem[ev] : wsRem[ws];
    var capacityReady = rem !== null && rem !== undefined;
    var maxAllowed = capacityReady ? Math.min(rem,maxPer) : maxPer;
    var seats = isShow ? Math.max(1,Math.min(st.seats||2,Math.max(1,maxAllowed))) : 1;
    var pay = st.pay == null ? 0 : st.pay;

    var types=typeNames.map(function(l,i){
      return Object.assign({label:l,pick:function(){self.setState({type:i});}},self.chip(i===type));
    });

    var wsMeta=[["#2CA8E0","#0F4A66"],["#F09000","#5C3700"],["#941880","#4A1040"],["#28B4A8","#0E4A45"]];
    var wsCards=wsData.map(function(w,i){
      var m=wsMeta[i%wsMeta.length], on=!isShow&&i===ws, n=wsRem[i], full=n===0;
      var a=(n===null||n===undefined)?{left:"Caricamento…",leftColor:"#555D64",leftWeight:500}:self.avail(n);
      return Object.assign({
        n:i+1,label:w.label,color:m[0],tint:m[1],border:on?"#13181D":"#E4DED2",
        btnLabel:full?"Completo · lista d’attesa":(on?"Selezionato":"Scegli questo workshop"),
        btnBg:on?"#13181D":"#FFFFFF",btnFg:on?"#FFFFFF":"#13181D",
        pick:function(){self.setState({ws:i,type:type===2?1:type});}
      },a);
    });

    var workshops=wsData.map(function(w,i){
      var n=wsRem[i];
      var a=(n===null||n===undefined)?{left:"Caricamento…",leftColor:"#555D64",leftWeight:500}:self.avail(n);
      return Object.assign({label:w.label,sub:w.sub,pick:function(){self.setState({ws:i});}},a,self.row(i===ws));
    });

    var evenings=evData.map(function(e,i){
      var n=evRem[i];
      var a=(n===null||n===undefined)?{left:"Caricamento…",leftColor:"#555D64",leftWeight:500}:self.avail(n);
      return Object.assign({label:e.label,sub:e.sub,pick:function(){self.setState({ev:i});}},a,self.row(i===ev));
    });

    var payOpts=["Paga l’iscrizione · 10 € e salda prima del Festival","Paga tutto · 20 €"].map(function(l,i){
      return Object.assign({label:l,pick:function(){self.setState({pay:i});}},self.chip(i===pay));
    });

    var eventId=isShow?evData[ev].id:wsData[ws].id;
    var what=isShow
      ? (seats===1?"1 posto":seats+" posti")+" per "+evData[ev].label
      : typeNames[type]+" · "+wsData[ws].label;
    var wa="https://wa.me/393271881956?text="+encodeURIComponent("Ciao! Vorrei prenotare al Roma Improv Festival: "+what+".");

    return {
      accent:this.props.accent ?? "#F09000",
      eventId:eventId,
      bookingSeats:seats,
      wsCards:wsCards,
      types:types,workshops:workshops,evenings:evenings,payOpts:payOpts,
      isWs:isWs,isShow:isShow,showStepper:isShow,
      seats:seats,
      maxNote:!capacityReady?"Dato in arrivo LIVE…":(rem<=maxPer?"Restano "+rem+" posti":"Massimo "+maxPer+" a prenotazione"),
      plusOpacity:capacityReady&&seats>=maxAllowed?0.35:1,
      available:capacityReady&&rem>0,
      soldOut:capacityReady&&rem===0,
      capacityPending:!capacityReady,
      soldTitle:isShow?"Serata esaurita":"Workshop completo",
      paymentMode:pay===0?"Iscrizione 10 € + saldo prima del Festival":"Pagamento completo 20 €",
      paymentAmount:pay===0?10:20,
      payNote:pay===0
        ?"Paghi ora 10 € di iscrizione con PayPal a info@artyouroma.it e saldi il restante importo prima del Festival."
        :"Paghi ora l’intero importo di 20 € con PayPal a info@artyouroma.it.",
      ctaLabel:"Conferma e paga con PayPal",
      wa:wa,
      waWait:"https://wa.me/393271881956?text="+encodeURIComponent("Ciao! "+what+" è al completo: potete mettermi in lista d’attesa?"),
      confirmed:!!st.confirmed,notConfirmed:!st.confirmed,
      doneTitle:"Prenotazione confermata!",
      summary:"Roma Improv Festival · "+what+".",
      doneNote:"Ti abbiamo inviato un’email con i dettagli della prenotazione.",
      minus:function(){self.setState({seats:Math.max(1,seats-1)});},
      plus:function(){self.setState({seats:Math.min(maxAllowed,seats+1)});},
      confirm:function(){self.setState({confirmed:true});},
      edit:function(){self.setState({confirmed:false});}
    };

  }
}

return Component;
};
