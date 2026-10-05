# AGENTS.md

## Regola generale: ogni modifica deve essere SEO friendly

Ogni modifica effettuata in questo repository, anche se riguarda esclusivamente grafica, layout, responsive, JavaScript, backend, form, menu, immagini, traduzioni, performance o nuove funzionalità, deve **preservare o migliorare la SEO esistente**.

La SEO è un requisito obbligatorio di accettazione della modifica, non un'attività separata da fare in seguito.

## Checklist SEO obbligatoria per ogni modifica

Prima di considerare completato qualunque intervento:

1. **Non peggiorare indicizzazione e crawlability**
   - Non rimuovere o alterare accidentalmente `title`, `meta description`, canonical, robots meta, hreflang o dati strutturati.
   - Non aggiungere `noindex` a pagine pubbliche indicizzabili.
   - Le pagine tecniche/private possono restare `noindex` quando previsto.
   - Non bloccare risorse o pagine utili tramite `robots.txt`.

2. **Preservare URL e link**
   - Evitare modifiche agli URL già pubblici.
   - Se un URL deve cambiare, prevedere un redirect permanente 301 verso la nuova destinazione.
   - Non lasciare link interni rotti, anchor inesistenti o percorsi relativi errati.
   - I nuovi contenuti importanti devono essere raggiungibili tramite link interni contestuali.

3. **HTML semantico**
   - Mantenere un solo `<h1>` principale per pagina, salvo casi motivati.
   - Usare `h2`, `h3`, ecc. con una gerarchia logica, senza scegliere i tag solo per ragioni grafiche.
   - Usare elementi semantici quando appropriato: `header`, `nav`, `main`, `section`, `article`, `footer`.
   - I link di navigazione devono essere veri `<a href="...">` quando portano a una pagina o sezione indicizzabile.

4. **Titoli e metadati**
   - Ogni nuova pagina pubblica deve avere un `<title>` unico e descrittivo.
   - Ogni nuova pagina pubblica deve avere una meta description utile e coerente con il contenuto.
   - Evitare title e description duplicati tra pagine differenti.
   - Mantenere canonical coerenti con l'URL definitivo del sito.

5. **Contenuti**
   - Non nascondere ai motori di ricerca contenuti importanti caricandoli esclusivamente dopo interazioni non necessarie.
   - Il testo principale deve essere presente nel DOM e leggibile.
   - Evitare duplicazioni inutili di contenuto tra pagine.
   - Le modifiche ai testi devono mantenere naturalezza: niente keyword stuffing.

6. **Immagini**
   - Ogni immagine informativa deve avere un attributo `alt` descrittivo e pertinente.
   - Le immagini decorative devono usare `alt=""`.
   - Non utilizzare immagini molto più grandi del necessario.
   - Preferire formati moderni e compressi quando possibile.
   - Usare lazy loading per immagini non above-the-fold quando non compromette LCP.

7. **Performance e Core Web Vitals**
   - Non introdurre JavaScript, CSS, font, immagini o librerie pesanti senza necessità.
   - Evitare layout shift causati da immagini, banner, menu o contenuti caricati senza dimensioni riservate.
   - Proteggere soprattutto LCP, CLS e INP.
   - Le modifiche responsive devono funzionare senza overflow orizzontale e senza contenuti tagliati.

8. **Mobile-first**
   - Ogni modifica deve essere verificata anche su viewport mobile.
   - Menu, CTA, testi e link devono rimanere utilizzabili e visibili.
   - Il contenuto SEO importante non deve essere rimosso dalla versione mobile.

9. **Accessibilità che supporta la SEO**
   - Mantenere testi leggibili, label dei form, nomi accessibili dei pulsanti e contrasto adeguato.
   - Non sostituire testo significativo con sole icone prive di etichetta accessibile.

10. **Dati strutturati**
    - Preservare eventuali JSON-LD già presenti.
    - Se si aggiungono eventi, corsi, organizzazioni, articoli o breadcrumb, valutare e implementare lo schema.org appropriato quando utile.
    - I dati strutturati devono rispecchiare contenuti realmente visibili nella pagina.

11. **Sitemap e robots**
    - Quando viene aggiunta, rimossa o rinominata una pagina pubblica indicizzabile, aggiornare `sitemap.xml` se la sitemap è gestita staticamente.
    - Non inserire nella sitemap pagine tecniche, private, duplicate o marcate `noindex`.
    - Verificare che `robots.txt` non contraddica le direttive delle pagine.

12. **Open Graph e condivisione**
    - Per nuove pagine rilevanti, mantenere o aggiungere metadata Open Graph coerenti con titolo, descrizione, URL e immagine.
    - Non rompere i metadata social già presenti durante refactor del `<head>`.

## Regola per modifiche grafiche

Una modifica apparentemente solo visuale non deve:
- eliminare testo utile dall'HTML;
- trasformare link navigabili in elementi JavaScript non crawlable;
- duplicare heading o contenuti;
- nascondere contenuti importanti con `display:none` in modo permanente;
- peggiorare prestazioni o stabilità visiva;
- creare overflow, elementi sovrapposti o CTA non cliccabili su mobile.

## Regola per nuove pagine

Ogni nuova pagina pubblica deve essere consegnata con:
- title unico;
- meta description;
- canonical;
- heading H1 coerente;
- struttura heading corretta;
- internal linking;
- immagini ottimizzate con alt;
- metadata Open Graph quando appropriato;
- schema.org quando pertinente;
- presenza in sitemap, se indicizzabile;
- responsive mobile verificato.

## Regola per pagine tecniche e gestionali

Pagine come gestionali, scanner, login, aree docenti, prenotazioni tecniche e strumenti interni non devono competere in SERP con le pagine pubbliche. Quando appropriato devono utilizzare `noindex,follow` e restare escluse dalla sitemap.

La loro modifica non deve comunque danneggiare asset condivisi, routing, header, footer, canonical, robots o performance delle pagine pubbliche.

## Verifica finale obbligatoria

Dopo ogni modifica significativa controllare almeno:
- assenza di errori HTML/JS che impediscano il rendering;
- link e CTA interessati dalla modifica;
- visualizzazione desktop e mobile;
- title, description, canonical e robots della pagina toccata;
- heading principali;
- immagini e alt text modificati;
- eventuali dati strutturati;
- sitemap/robots quando la struttura URL cambia;
- assenza di regressioni SEO evidenti.

Se una richiesta dell'utente rischia di peggiorare la SEO, implementare la soluzione visiva o funzionale richiesta scegliendo l'alternativa tecnicamente più SEO-friendly e segnalare eventuali compromessi solo quando realmente necessari.

## Principio operativo

**Non considerare mai una modifica completata se funziona visivamente ma introduce una regressione SEO.**
