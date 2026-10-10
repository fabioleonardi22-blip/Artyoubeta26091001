// Azione "registra" per lo Script Google delle prenotazioni in produzione.
//
// ATTENZIONE: lo script in produzione NON coincide con google-apps-script/Code.gs
// di questo repository (quello è una versione vecchia e non va incollato).
// Lo script reale ha scheda Capienza, scanner, piano operativo e gestionale.
//
// Integrazione nello script reale (10/10/2026):
// 1. in doPost, subito prima del blocco "PRENOTAZIONE NORMALE", aggiungere:
//
//      if (azioneScanner === 'registra') {
//        return registraPrenotazioneMysql_(dati, lock);
//      }
//
// 2. aggiungere in fondo al file le funzioni qui sotto.
//
// Usa funzioni già presenti nello script reale: SCANNER_SECRET, risposta,
// normalizzaCodiceScanner_, schedaPrenotazioni_, trovaRigaPrenotazione_,
// nomeSchedaSicuro_, normalizzaRisorsePrenotazione_, schedaCapienza_,
// trovaRigaCapienza_, aggiornaRigaCapienza_, datiEventoDaRiga_,
// scriviPrenotazione_, scriviRiga, aggiornaContatti, aggiornaDashboard_,
// inviaEmailArtyou, inviaEmailConferma, normalizzaSlug_.



// ============================================================
// COPIA DI PRENOTAZIONI DECISE DA MYSQL
// ============================================================
//
// Usata dal sito quando su Vercel ARTYOU_BOOKING_PRIMARY=mysql.
// MySQL ha già controllato i posti: qui NON si ricontrolla la
// capienza e la prenotazione non può essere rifiutata per posti.
// Si fa tutto il resto come una prenotazione normale:
// - riga in Prenotazioni (stesso codice, QR e scanner funzionano)
// - riga nella scheda del modulo e nei Contatti
// - contatore Prenotati della scheda Capienza (anche risorse YEP)
// - Dashboard
// - email ad Artyou e al cliente, con QR
//
// Se il codice è già presente non scrive e non rimanda le email:
// il sito può ripetere l'invio senza creare doppioni.
// Protetta dallo stesso segreto dello scanner Vercel.

function registraPrenotazioneMysql_(
  dati,
  lock
) {

  if (
    String(dati.scannerSecret || '') !==
    SCANNER_SECRET
  ) {

    return risposta({
      ok: false,
      errore: 'non_autorizzato'
    });

  }


  var codice =
    normalizzaCodiceScanner_(
      dati.ID
    );

  if (!codice) {

    return risposta({
      ok: false,
      errore: 'codice_non_valido'
    });

  }


  var schedaPren =
    schedaPrenotazioni_();

  if (
    trovaRigaPrenotazione_(
      schedaPren,
      codice
    ) >= 0
  ) {

    return risposta({
      ok: true,
      codice: codice,
      gia_presente: true
    });

  }


  // Campi tecnici che non devono finire nelle schede.
  [
    'scannerSecret',
    'adminSecret',
    'action',
    'ID',
    'Stato',
    'ScadenzaHold',
    'liberi',
    '_hp'
  ].forEach(
    function(k) {
      delete dati[k];
    }
  );


  var adesso =
    new Date();

  var modulo =
    nomeSchedaSicuro_(
      dati.Modulo ||
      'Prenotazione'
    );

  var posti =
    Math.max(
      1,
      parseInt(
        dati.Posti,
        10
      ) || 1
    );

  dati.Posti =
    posti;

  dati['Codice prenotazione'] =
    codice;


  // Contatori Capienza: evento + eventuali risorse YEP.
  var risorse =
    normalizzaRisorsePrenotazione_(
      dati
    );

  var infoEvento =
    null;

  risorse.forEach(
    function(slug) {

      var info =
        aggiungiPostiSenzaControllo_(
          slug,
          posti
        );

      if (
        info &&
        !infoEvento
      ) {

        infoEvento =
          info;

      }

    }
  );

  if (
    risorse.length
  ) {

    dati.Risorse =
      JSON.stringify(
        risorse
      );

  }


  if (infoEvento) {

    if (!dati.Tipo) {
      dati.Tipo = infoEvento.tipo;
    }

    if (!dati.Titolo) {
      dati.Titolo = infoEvento.titolo;
    }

    if (!dati['Data evento']) {
      dati['Data evento'] = infoEvento.data;
    }

    if (!dati['Ora evento']) {
      dati['Ora evento'] = infoEvento.ora;
    }

  }


  scriviPrenotazione_(
    codice,
    dati,
    modulo,
    adesso,
    infoEvento
  );

  scriviRiga(
    modulo,
    dati,
    adesso
  );

  aggiornaContatti(
    dati,
    modulo,
    adesso
  );

  aggiornaDashboard_();


  // Libera prima delle email, come le prenotazioni normali.
  try {

    lock.releaseLock();

  } catch (x) {}


  var emailArtyou = true;

  try {

    inviaEmailArtyou(
      modulo,
      dati,
      adesso
    );

  } catch (mailErr1) {

    emailArtyou = false;

    console.error(
      'Errore email Artyou (MySQL): ' +
      mailErr1
    );

  }


  var emailCliente = true;

  try {

    inviaEmailConferma(
      modulo,
      dati
    );

  } catch (mailErr2) {

    emailCliente = false;

    console.error(
      'Errore email cliente (MySQL): ' +
      mailErr2
    );

  }


  return risposta({
    ok: true,
    codice: codice,
    emailArtyou: emailArtyou,
    emailCliente: emailCliente
  });

}


// Aumenta Prenotati nella scheda Capienza senza controllare i posti
// (li ha già controllati MySQL). Se lo slug non è in Capienza non fa
// nulla, come prenotaPosti().

function aggiungiPostiSenzaControllo_(
  slugGrezzo,
  quantita
) {

  var slug =
    normalizzaSlug_(
      slugGrezzo
    );

  var s =
    schedaCapienza_();

  var riga =
    trovaRigaCapienza_(
      s,
      slug
    );

  if (
    riga < 0
  ) {

    return null;

  }

  var prenotati =
    Number(
      s.getRange(
        riga,
        4
      ).getValue()
    ) || 0;

  s.getRange(
    riga,
    4
  ).setValue(
    prenotati +
    Math.max(
      0,
      Number(quantita) || 0
    )
  );

  aggiornaRigaCapienza_(
    s,
    riga
  );

  return datiEventoDaRiga_(
    s,
    riga
  );

}
