"use strict";
(function(){
 const BookingLab=window.ArtyouBookingLab.BookingLab;
 let lab=new BookingLab({capacity:5,priceCents:1500});
 const output=document.getElementById("output");
 const render=()=>{const s=lab.snapshot();for(const k of ["capacity","booked","remaining"])document.getElementById(k).textContent=s[k];};
 const print=(title,data)=>{output.textContent=title+"\n"+JSON.stringify(data,null,2);render();};
 const bind=(id,fn)=>document.getElementById(id).addEventListener("click",async()=>{try{lab=new BookingLab({capacity:5,priceCents:1500});await fn();}catch(e){print("ERRORE",e.message);}});
 bind("race",async()=>{const results=await Promise.all(Array.from({length:40},(_,i)=>lab.reserve({requestKey:"race-"+i,seats:1})));print("40 richieste simultanee, capienza 5",{accepted:results.filter(x=>x.ok).length,rejected:results.filter(x=>!x.ok).length,remaining:lab.remaining()});});
 bind("soldout",async()=>{const a=await lab.reserve({requestKey:"a",seats:5});const b=await lab.reserve({requestKey:"b",seats:1});print("Capienza esaurita",{first:a,second:b});});
 bind("fail",async()=>{const a=await lab.reserve({requestKey:"a",seats:2});await lab.fail(a.booking.id);print("Pagamento simulato fallito: posti nuovamente disponibili",lab.snapshot());});
 bind("refund",async()=>{const a=await lab.reserve({requestKey:"a",seats:2});await lab.capture(a.booking.id,"FAKE-CAPTURE-1",3000);await lab.refund(a.booking.id,"FAKE-REFUND-1");const before=lab.snapshot();await lab.cancel(a.booking.id);print("Rimborso simulato e cancellazione esplicita",{afterRefund:before,afterCancellation:lab.snapshot()});});
 bind("expiry",async()=>{await lab.reserve({requestKey:"a",seats:3});lab.advance(11);print("Scadenza hold dopo 11 minuti",lab.snapshot());});
 bind("manager",async()=>{await lab.reserve({requestKey:"a",seats:2});print("Confronto dati con gestionale FITTIZIO",{matching:lab.managerComparison({capacity:5,booked:2,remaining:3}),mismatch:lab.managerComparison({capacity:5,booked:1,remaining:4})});});
 document.getElementById("reset").addEventListener("click",()=>{lab=new BookingLab({capacity:5,priceCents:1500});print("Simulazione azzerata",lab.snapshot());});
 render();
})();
