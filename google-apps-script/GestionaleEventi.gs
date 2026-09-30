const GEST_CFG = {
  SHEET_ID_PROPERTY: "ARTYOU_SHEET_ID",
  PIN_PROPERTY: "ARTYOU_GESTIONALE_PIN",
  IMAGE_FOLDER_PROPERTY: "ARTYOU_EVENT_IMAGES_FOLDER_ID",
  SHEET_SITE: "EventiSito",
  SHEET_BOOKING: "Eventi"
};

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = String(p.action || "public").toLowerCase();

    // Piano Operativo: autenticazione tramite email registrata / admin.
    if (action === "po_session") {
      const poEmail = PO_emailFromGoogleToken_(p.token);
      return gestJson_(PO_session(poEmail));
    }
    if (action === "po_list") {
      const poEmail = PO_emailFromGoogleToken_(p.token);
      return gestJson_({ok:true, events:PO_listEvents(poEmail, String(p.from||""), String(p.to||""))});
    }
    if (action === "po_people") {
      const poEmail = PO_emailFromGoogleToken_(p.token);
      const poUser = PO_requireUser_(poEmail);
      return gestJson_({ok:true, people:PO_listPeople(), admin:!!poUser.admin, accessLevel:poUser.accessLevel||"Docente"});
    }

    if (action === "public") {
      return gestJson_({ok:true, events: gestPublicEvents_()});
    }

    gestRequirePin_(p.pin);

    if (action === "list") {
      return gestJson_({ok:true, events: gestAdminEvents_()});
    }

    if (action === "ping") {
      return gestJson_({ok:true, message:"Gestionale Artyou attivo"});
    }

    return gestJson_({ok:false, errore:"azione_non_valida"});
  } catch (err) {
    return gestJson_({ok:false, errore:String(err && err.message || err)});
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(data.action || "").toLowerCase();

    // Piano Operativo usa l'email autorizzata, non il PIN del gestionale.
    // Piano Operativo: verifica anche nel backend Apps Script il token Google.
    let poEmail = "";
    if (action.indexOf("po_")===0) poEmail = PO_emailFromGoogleToken_(data.token);
    if (action === "po_list") {
      return gestJson_({ok:true, events:PO_listEvents(poEmail, String(data.from||""), String(data.to||""))});
    }
    if (action === "po_save") {
      const saved = PO_saveTask(poEmail, data.event || {});
      return gestJson_({ok:true, event:saved});
    }
    if (action === "po_delete") {
      PO_deleteTask(poEmail, String(data.id || ""));
      return gestJson_({ok:true});
    }
    if (action === "po_people") {
      const poUser = PO_requireUser_(poEmail);
      return gestJson_({ok:true, people:PO_listPeople(), admin:!!poUser.admin, accessLevel:poUser.accessLevel||"Docente"});
    }
    if (action === "po_save_person") {
      const person = PO_savePerson(poEmail, data.person || {});
      return gestJson_({ok:true, person:person});
    }
    if (action === "po_delete_person") {
      PO_deletePerson(poEmail, String(data.id || ""));
      return gestJson_({ok:true});
    }
    if (action === "po_generate_plan") {
      return gestJson_(PO_generatePlanForSiteEvent(poEmail, String(data.siteEventId || ""), Number(data.siteDateIndex || 0)));
    }

    gestRequirePin_(data.pin);

    if (action === "save") {
      const saved = gestSaveEvent_(data.event || {});
      return gestJson_({ok:true, event:saved});
    }

    if (action === "delete") {
      gestDeleteEvent_(String(data.id || ""));
      return gestJson_({ok:true});
    }

    if (action === "uploadimage") {
      const url = gestUploadImage_(data);
      return gestJson_({ok:true, url:url});
    }

    return gestJson_({ok:false, errore:"azione_non_valida"});
  } catch (err) {
    return gestJson_({ok:false, errore:String(err && err.message || err)});
  } finally {
    lock.releaseLock();
  }
}

function setupGestionale() {
  const ss = gestSpreadsheet_();
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty(GEST_CFG.IMAGE_FOLDER_PROPERTY)) {
    const folder = DriveApp.createFolder("Artyou Eventi - Immagini");
    props.setProperty(GEST_CFG.IMAGE_FOLDER_PROPERTY, folder.getId());
  }
  gestEnsureSheet_(ss, GEST_CFG.SHEET_SITE, [
    "ID","Slug","Titolo","Categoria","Descrizione","Poster","Luogo","Indirizzo",
    "Maps","Prezzo","PagaOnline","Capienza","DateJSON","CastJSON","TBD","Attivo",
    "Ordine","Aggiornato"
  ]);
  gestEnsureSheet_(ss, GEST_CFG.SHEET_BOOKING, [
    "Evento","Titolo","Data","Capienza","Prezzo","Attivo"
  ]);
}

function gestSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = String(props.getProperty(GEST_CFG.SHEET_ID_PROPERTY) || "1yFCurleYqseZGab3RQOznaBhqDSNRXTNIRN1ZeD9YBQ").trim();
  if (!id) throw new Error("Configura la Script Property ARTOYOU_SHEET_ID");
  return SpreadsheetApp.openById(id);
}

function gestRequirePin_(pin) {
  const expected = PropertiesService.getScriptProperties().getProperty(GEST_CFG.PIN_PROPERTY);
  if (!expected) throw new Error("Configura la Script Property ARTOYOU_GESTIONALE_PIN");
  if (String(pin || "") !== String(expected)) throw new Error("pin_non_valido");
}

function gestEnsureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
  return sh;
}

function gestAdminEvents_() {
  const ss = gestSpreadsheet_();
  const sh = gestEnsureSheet_(ss, GEST_CFG.SHEET_SITE, [
    "ID","Slug","Titolo","Categoria","Descrizione","Poster","Luogo","Indirizzo",
    "Maps","Prezzo","PagaOnline","Capienza","DateJSON","CastJSON","TBD","Attivo",
    "Ordine","Aggiornato"
  ]);
  if (sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const h = values[0];
  return values.slice(1).filter(r=>r.some(v=>String(v)!=="")).map(r=>gestRowToObj_(h,r))
    .sort((a,b)=>(Number(a.ordine)||9999)-(Number(b.ordine)||9999));
}

function gestPublicEvents_() {
  return gestAdminEvents_().filter(e=>e.attivo).map(e=>({
    slug:e.slug,title:e.title,cat:e.cat,poster:e.poster,desc:e.desc,venue:e.venue,
    addr:e.addr,maps:e.maps,price:e.price,pagaOnline:e.pagaOnline,
    capienza:e.capienza,dates:e.dates,cast:e.cast,tbd:e.tbd
  }));
}

function gestRowToObj_(h,r) {
  const o={}; h.forEach((k,i)=>o[k]=r[i]);
  return {
    id:String(o.ID||""),
    slug:String(o.Slug||""),
    title:String(o.Titolo||""),
    cat:String(o.Categoria||"Improvvisazione"),
    desc:String(o.Descrizione||""),
    poster:String(o.Poster||""),
    venue:String(o.Luogo||""),
    addr:String(o.Indirizzo||""),
    maps:String(o.Maps||""),
    price:o.Prezzo===""?"":Number(o.Prezzo),
    pagaOnline:gestBool_(o.PagaOnline),
    capienza:Math.max(0,parseInt(o.Capienza||0,10)||0),
    dates:gestParseJson_(o.DateJSON,[]),
    cast:gestParseJson_(o.CastJSON,[]),
    tbd:gestBool_(o.TBD),
    attivo:gestBool_(o.Attivo),
    ordine:Number(o.Ordine)||9999,
    aggiornato:o.Aggiornato
  };
}

function gestSaveEvent_(e) {
  const ss=gestSpreadsheet_();
  const headers=["ID","Slug","Titolo","Categoria","Descrizione","Poster","Luogo","Indirizzo","Maps","Prezzo","PagaOnline","Capienza","DateJSON","CastJSON","TBD","Attivo","Ordine","Aggiornato"];
  const sh=gestEnsureSheet_(ss,GEST_CFG.SHEET_SITE,headers);

  const id=String(e.id||Utilities.getUuid());
  const slug=gestSlug_(e.slug||e.title);
  if(!slug) throw new Error("slug_mancante");
  if(!String(e.title||"").trim()) throw new Error("titolo_mancante");

  const dates=Array.isArray(e.dates)?e.dates:[];
  if(!dates.length) dates.push({label:"Data da definire",sold:0});

  const obj={
    ID:id,Slug:slug,Titolo:String(e.title||"").trim(),Categoria:String(e.cat||"Improvvisazione"),
    Descrizione:String(e.desc||""),Poster:String(e.poster||""),Luogo:String(e.venue||""),
    Indirizzo:String(e.addr||""),Maps:String(e.maps||""),Prezzo:e.price===""?"":Number(e.price||0),
    PagaOnline:!!e.pagaOnline,Capienza:Math.max(0,parseInt(e.capienza||0,10)||0),
    DateJSON:JSON.stringify(dates),CastJSON:JSON.stringify(Array.isArray(e.cast)?e.cast:[]),
    TBD:!!e.tbd,Attivo:e.attivo!==false,Ordine:Number(e.ordine)||9999,Aggiornato:new Date()
  };

  const values=sh.getDataRange().getValues();
  const idx=values[0].indexOf("ID");
  let row=-1;
  for(let i=1;i<values.length;i++) if(String(values[i][idx])===id){row=i+1;break;}
  const arr=headers.map(k=>obj[k]);
  if(row>0) sh.getRange(row,1,1,headers.length).setValues([arr]);
  else sh.appendRow(arr);

  gestSyncBooking_(obj,dates);
  return gestAdminEvents_().filter(x=>x.id===id)[0];
}

function gestSyncBooking_(obj, dates) {
  const ss=gestSpreadsheet_();
  const headers=["Evento","Titolo","Data","Capienza","Prezzo","Attivo"];
  const sh=gestEnsureSheet_(ss,GEST_CFG.SHEET_BOOKING,headers);
  const values=sh.getDataRange().getValues();
  const h=values[0], idxEvento=h.indexOf("Evento");
  const ids=dates.map((d,i)=>dates.length>1?obj.Slug+"-"+i:obj.Slug);

  // update/add current dates
  ids.forEach((evId,i)=>{
    let row=-1;
    for(let r=1;r<values.length;r++) if(String(values[r][idxEvento]||"")===evId){row=r+1;break;}
    const line=[evId,obj.Titolo,dates[i].label||"",obj.Capienza,obj.Prezzo,obj.Attivo];
    if(row>0) sh.getRange(row,1,1,headers.length).setValues([line]); else sh.appendRow(line);
  });

  // deactivate obsolete date rows with same slug prefix
  const fresh=sh.getDataRange().getValues();
  for(let r=1;r<fresh.length;r++){
    const evId=String(fresh[r][idxEvento]||"");
    const belongs=evId===obj.Slug || evId.indexOf(obj.Slug+"-")===0;
    if(belongs && ids.indexOf(evId)===-1) sh.getRange(r+1,6).setValue(false);
  }
}

function gestDeleteEvent_(id) {
  if(!id) throw new Error("id_mancante");
  const ss=gestSpreadsheet_();
  const sh=ss.getSheetByName(GEST_CFG.SHEET_SITE);
  if(!sh) return;
  const v=sh.getDataRange().getValues(), idx=v[0].indexOf("ID"), idxSlug=v[0].indexOf("Slug");
  let slug="";
  for(let i=1;i<v.length;i++){
    if(String(v[i][idx])===id){slug=String(v[i][idxSlug]||"");sh.deleteRow(i+1);break;}
  }
  if(slug){
    const bk=ss.getSheetByName(GEST_CFG.SHEET_BOOKING);
    if(bk && bk.getLastRow()>1){
      const b=bk.getDataRange().getValues(), ie=b[0].indexOf("Evento"), ia=b[0].indexOf("Attivo");
      for(let i=1;i<b.length;i++){
        const ev=String(b[i][ie]||"");
        if(ev===slug || ev.indexOf(slug+"-")===0) bk.getRange(i+1,ia+1).setValue(false);
      }
    }
  }
}

function gestUploadImage_(data) {
  const raw = String(data.base64 || "");
  const mime = String(data.mime || "image/jpeg");
  const original = String(data.name || "locandina");
  if (!raw) throw new Error("immagine_mancante");
  const allowed = ["image/jpeg","image/png","image/webp"];
  if (allowed.indexOf(mime) === -1) throw new Error("formato_immagine_non_valido");
  const bytes = Utilities.base64Decode(raw);
  if (bytes.length > 5 * 1024 * 1024) throw new Error("immagine_troppo_grande");
  const folderId = PropertiesService.getScriptProperties().getProperty(GEST_CFG.IMAGE_FOLDER_PROPERTY);
  if (!folderId) throw new Error("cartella_immagini_non_configurata");
  const clean = gestSlug_(original.replace(/\.[^.]+$/,"")) || "locandina";
  const ext = mime === "image/png" ? ".png" : (mime === "image/webp" ? ".webp" : ".jpg");
  const file = DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(bytes, mime, clean + "-" + Date.now() + ext));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/uc?export=view&id=" + file.getId();
}

function gestSlug_(s){
  return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
}
function gestParseJson_(s,f){try{return JSON.parse(String(s||""))}catch(e){return f}}
function gestBool_(v){return v===true || /^(true|1|si|sì|yes)$/i.test(String(v||"").trim())}
function gestJson_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
