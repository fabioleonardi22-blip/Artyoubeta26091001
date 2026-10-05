(function(){
  var via='email';
  function form(){return document.getElementById('company-form');}
  document.addEventListener('click',function(e){
    var pick=e.target.closest&&e.target.closest('[data-percorso]');
    if(pick&&form()){var r=form().querySelector('input[name="percorso"][value="'+pick.getAttribute('data-percorso')+'"]');if(r)r.checked=true;}
    var b=e.target.closest&&e.target.closest('#company-form button[data-via]');
    if(b)via=b.getAttribute('data-via');
  });
  document.addEventListener('input',function(e){if(e.target.closest&&e.target.closest('#company-form'))e.target.removeAttribute('aria-invalid');});
  document.addEventListener('submit',function(e){
    var f=e.target;if(!f||f.id!=='company-form')return;
    e.preventDefault();
    var status=document.getElementById('form-status'),bad=[];
    f.querySelectorAll('[required]').forEach(function(x){
      var v=x.value.trim(),ok=v!==''&&(x.type!=='email'||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
      x.setAttribute('aria-invalid',ok?'false':'true');if(!ok)bad.push(x);
    });
    if(bad.length){status.className='err';status.textContent='Mancano alcuni campi obbligatori: azienda, nome e ruolo, email valida e obiettivo.';bad[0].focus();return;}
    var d=new FormData(f);
    var rows=[['Azienda','azienda'],['Nome e ruolo','nome'],['Email','email'],['Interesse','percorso'],['Persone','persone'],['Periodo e luogo','periodo'],['Obiettivo','obiettivo']].map(function(r){return r[0]+': '+((d.get(r[1])||'').toString().trim()||'Da definire');});
    var body=['Salve Artyou! Volevamo avere informazioni per organizzare un evento di formazione nella nostra azienda, possiamo avere informazioni?',''].concat(rows).join('\n');
    status.className='';
    if(via==='whatsapp'){window.open('https://wa.me/393384821128?text='+encodeURIComponent(body),'_blank','noopener');status.textContent='Richiesta pronta su WhatsApp: premi Invia nella chat per mandarcela.';}
    else{window.location.href='mailto:info@artyouroma.it?subject='+encodeURIComponent('Formazione aziendale Artyou, '+d.get('azienda'))+'&body='+encodeURIComponent(body);status.textContent='Richiesta pronta nella tua app email: premi Invia per mandarcela. Se non si apre, scrivi a info@artyouroma.it.';}
  });
})();
