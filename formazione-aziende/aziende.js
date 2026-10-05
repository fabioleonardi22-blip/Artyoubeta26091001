(function(){
  var form=document.getElementById('company-form');
  var status=document.getElementById('form-status');
  var via='email';
  document.querySelectorAll('[data-percorso]').forEach(function(link){
    link.addEventListener('click',function(){
      var r=form.querySelector('input[name="percorso"][value="'+link.dataset.percorso+'"]');
      if(r)r.checked=true;
    });
  });
  form.querySelectorAll('button[data-via]').forEach(function(b){
    b.addEventListener('click',function(){via=b.dataset.via;});
  });
  form.querySelectorAll('input,textarea').forEach(function(f){
    f.addEventListener('input',function(){f.removeAttribute('aria-invalid');});
  });
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var bad=[];
    form.querySelectorAll('[required]').forEach(function(f){
      var ok=f.value.trim()!=='' && (f.type!=='email'||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim()));
      f.setAttribute('aria-invalid',ok?'false':'true');
      if(!ok)bad.push(f);
    });
    if(bad.length){
      status.className='err';
      status.textContent='Mancano alcuni campi obbligatori: azienda, nome e ruolo, email valida e obiettivo.';
      bad[0].focus();return;
    }
    var d=new FormData(form);
    var rows=[['Azienda','azienda'],['Nome e ruolo','nome'],['Email','email'],['Interesse','percorso'],['Persone','persone'],['Periodo e luogo','periodo'],['Obiettivo','obiettivo']]
      .map(function(r){return r[0]+': '+((d.get(r[1])||'').toString().trim()||'Da definire');});
    var body=['Buongiorno Artyou, vorremmo una proposta per la nostra azienda.',''].concat(rows).join('\n');
    status.className='';
    if(via==='whatsapp'){
      window.open('https://wa.me/393271881956?text='+encodeURIComponent(body),'_blank','noopener');
      status.textContent='Richiesta pronta su WhatsApp: premi Invia nella chat per mandarcela.';
    }else{
      window.location.href='mailto:info@artyouroma.it?subject='+encodeURIComponent('Formazione aziendale Artyou, '+d.get('azienda'))+'&body='+encodeURIComponent(body);
      status.textContent='Richiesta pronta nella tua app email: premi Invia per mandarcela. Se non si apre, scrivi a info@artyouroma.it.';
    }
  });
})();
