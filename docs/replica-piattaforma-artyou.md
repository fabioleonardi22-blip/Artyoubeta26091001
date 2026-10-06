# Replica piattaforma Artyou — analisi del 5 ottobre 2026

## Perimetro verificato
Accesso riuscito come docente. Osservati home, pannello docente, corso, iscrizioni, dettaglio iscrizione, profilo, rendiconto e tutorial. Nessuna modifica ai dati originali. Non disponibili codice backend, schema database o accesso amministratore/socio. Non copiare credenziali o dati personali nel repository pubblico.

## Mappa delle funzioni
- Ruoli: socio, docente, amministratore (dichiarati dalla guida; verificato solo docente).
- Dashboard: corsi assegnati, studenti totali, iscrizioni attive.
- Corso: nome, sede, anno, capienza, stato pubblicazione, inizio/fine, giorni e orario.
- Calendario: vista mensile, selezione giorno, lezioni del giorno e prossimi corsi.
- Registro: matrice studente/data, checkbox presenza, aggiunta data, rimozione data. Salvataggio non collaudato per evitare mutazioni reali.
- Iscrizioni: studente/email, corso, piano, importo, stato, data iscrizione. Nuova iscrizione disabilitata nel ruolo docente.
- Pagamenti: mensile, annuale unico, annuale tre rate; rata pagata, scadenza successiva, rate e ritardi. Registrazione disabilitata per gli iscritti osservati: causa da verificare.
- Profilo: nome/cognome/email, telefoni, taglia, immagine e modifica.
- Rendiconto: rimborso lezione amministrato, incassi per corso, numero lezioni/pagamenti, saldo, altri rimborsi, trasferimenti. Saldo positivo = docente deve restituire; negativo = deve ricevere.
- Guida: verifica email, recupero password e notifiche automatiche dichiarati, non collaudati.

## Anomalie o aspetti da verificare
Date del registro includono 24/31 dicembre. Visuale mensile pagamenti senza testo/celle valorizzate nella lettura del browser; non confermato il significato visuale. Etichetta tecnica monthly. Tutorial dichiara staging con dati esempio: non assumere che i dati siano fittizi. Stato di autenticazione intermittente e blocco del browser per protezione credenziali: causa non determinata.

## Prima implementazione
/piattaforma-replica/index.html è una demo isolata con dati inventati: navigazione, date aggiuntive, presenze per lezione, ricerca studenti e dettagli. Stato solo in memoria. Nessun login, dato personale o operazione finanziaria reale. Noindex, esclusione dalla sitemap, nessuna modifica a pagine o asset condivisi.

## Modello dati proposto (non estratto dall’originale)
Utenti e ruoli; sedi; corsi e docenti assegnati; iscrizioni; lezioni; presenze univoche per iscrizione/lezione; piani e rate; pagamenti e relativa allocazione; rimborsi; trasferimenti; registro audit. Separare debito maturato, incasso e trasferimento per evitare conteggi duplicati.

## Passi successivi
1. Esaminare area amministratore e socio con accessi autorizzati.
2. Integrare l’autenticazione esistente e permessi verificati sul server, limitando ogni docente ai propri corsi.
3. Implementare migrazioni MySQL e API con validazione, transazioni e audit; nessuna connessione al DB originale disponibile.
4. Collegare demo a dati reali solo dopo test di autorizzazione e calcoli finanziari.
5. Aggiungere export, notifiche e recupero credenziali dopo verifica dei flussi originali.

## Verifica
Controllo sintassi JS e struttura HTML/metadati. Verifica visuale desktop/mobile ancora da eseguire. La demo non costituisce replica completa né backend operativo.

## Analisi amministratore — 6 ottobre 2026
Accesso amministratore verificato. Dashboard con 364 utenti, 133 tesserati, 22 corsi e 54 pagamenti al momento della lettura; questi numeri non sono importati nella demo.

### Funzioni osservate
- Utenti: nome/email, ruolo, anno corso, indicatore foto, azioni e allegati; esportazione CSV e paginazione. Moduli delle azioni senza etichetta non esaminati.
- Tesserati: numero tessera, utente, importo, stato, date. Aggiunta con selezione utente/campagna.
- Campagne: nome, descrizione, importo, valuta, date, stato; aggiunta verificata.
- Corsi: nome, sede, anno minimo opzionale, capienza, requisito tessera, descrizione, date, orario, prezzi mensile/tre rate/annuale, giorni, stato, docente. Comandi modifica/duplica/calendario visibili.
- Pagamenti: utente, corso, importo, data, tipo, note. Il modulo iniziale chiede l’utente; passaggi successivi non esaminati. Storico contiene pagamenti Stripe e contanti.
- Finanza: periodo, bilancio mensile e totale; bilancio corso; elenco movimenti con metodo e registrante; CSV. Spesa generale o ripartita tra corsi, nome, importo, mese, note.
- Comunicazioni: titolo, corpo, tutti gli account/tesserati attivi/docenti/partecipanti corso/copia a sé, anteprima destinatari, invio. Nessun invio effettuato.
- Report docenti: corso, sede, iscritti, sospesi, date svolte/previste, media presenze. Report pagamenti: piano, stato, importo, partenza, scadenza, rate, ritardi; esclude gratuiti e utenti rimossi. CSV.
- Avanzate: etichetta, data taglio, note e calcolo anteprima archiviazione anno sociale. Guida dichiara archivi consultabili in finanza e ripristino ultimo archivio. Operazioni non eseguite.

### Blocco rilevato
Pagina avanzate: errore caricamento archivi. Ritorno amministrazione: errore caricamento dati; un solo reload restituisce 502 Bad Gateway / Connection refused. Non identificato come blocco anti-bot.

### Implementazione nella branch
`piattaforma-replica/admin.html`: gestione locale con dati inventati, CRUD, ricerca/ordinamento, CSV, duplicazione corso in bozza, tessere/iscrizioni, calendario/presenze, registrazione pagamenti dimostrativi, spese/rimborsi/trasferimenti, bilanci/report, bozze comunicazioni, fotografia archivio e ripristino locale. Stato persistito nel browser con fallback in memoria. Gli allegati memorizzano solo nome/dimensione, nessun upload. I piani rateali e allocazioni contabili sono regole proposte, da validare con l’originale. La preesistente area docente è ancora una demo separata in memoria.

Non implementati come servizi reali: login/ruoli server, MySQL, Stripe, email, file storage, backup DB e notifiche. Nessuna migrazione o copia dei dati reali. L’archiviazione è sperimentale e richiede backup locale; i trasferimenti registrati non muovono denaro.

### Validazione
Sintassi JS verificata. Test modello per duplicati tessere/date, periodo lezioni, calendario rate, ritardi, bilancio in centesimi, separazione spese generali/corso e fotografia archivio. Verifica visuale e test end-to-end non ancora completati.
