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
