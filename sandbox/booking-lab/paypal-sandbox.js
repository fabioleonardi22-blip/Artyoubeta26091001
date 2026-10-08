"use strict";
const BASE="https://api-m.sandbox.paypal.com";
function money(cents){return (cents/100).toFixed(2);}
function cents(value){
  if(!/^\d+(\.\d{1,2})?$/.test(String(value)))throw new Error("invalid_provider_amount");
  return Math.round(Number(value)*100);
}
function createPayPal(env=process.env,fetcher=globalThis.fetch){
  const id=String(env.ARTYOU_BOOKING_LAB_PAYPAL_CLIENT_ID||"");
  const secret=String(env.ARTYOU_BOOKING_LAB_PAYPAL_SECRET||"");
  if(!id||!secret)throw new Error("sandbox_paypal_not_configured");
  let token=null,expires=0;
  async function auth(){
    if(token&&Date.now()<expires)return token;
    const response=await fetcher(BASE+"/v1/oauth2/token",{
      method:"POST",headers:{"Authorization":"Basic "+Buffer.from(id+":"+secret).toString("base64"),
        "Content-Type":"application/x-www-form-urlencoded"},
      body:"grant_type=client_credentials",signal:AbortSignal.timeout(10000)});
    const data=await response.json();
    if(!response.ok||!data.access_token)throw new Error("paypal_sandbox_auth_failed");
    token=data.access_token;
    expires=Date.now()+Math.max(30,Number(data.expires_in||120)-60)*1000;
    return token;
  }
  async function api(method,path,body,requestId){
    if(!/^\/v2\/(checkout\/orders|payments\/captures|payments\/refunds)\b/.test(path))
      throw new Error("paypal_path_not_allowed");
    const headers={"Authorization":"Bearer "+await auth(),"Content-Type":"application/json"};
    if(requestId)headers["PayPal-Request-Id"]=requestId;
    const response=await fetcher(BASE+path,{method,headers,
      body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      const e=new Error("paypal_sandbox_request_failed");
      e.httpStatus=response.status;
      e.providerName=String(data.name||"");
      throw e;
    }
    return data;
  }
  function captureDetails(order){
    const capture=order?.purchase_units?.[0]?.payments?.captures?.[0];
    if(!capture)return null;
    return {id:capture.id,status:capture.status,currency:capture.amount?.currency_code,
      amountCents:cents(capture.amount?.value)};
  }
  return {
    createOrder:async b=>api("POST","/v2/checkout/orders",{
      intent:"CAPTURE",
      purchase_units:[{reference_id:b.id,custom_id:b.id,
        amount:{currency_code:"EUR",value:money(b.amountCents)}}]
    },"lab-create-"+b.id),
    getOrder:id=>api("GET","/v2/checkout/orders/"+encodeURIComponent(id)),
    captureOrder:async(id,bookingId)=>{
      const result=await api("POST","/v2/checkout/orders/"+encodeURIComponent(id)+"/capture",{},
        "lab-capture-"+bookingId);
      return {orderId:result.id,capture:captureDetails(result)};
    },
    captureDetails,
    refund:async(b)=>{
      const result=await api("POST","/v2/payments/captures/"+encodeURIComponent(b.captureId)+"/refund",{
        amount:{currency_code:"EUR",value:money(b.amountCents)}
      },"lab-refund-"+b.id);
      return {id:result.id,status:result.status,currency:result.amount?.currency_code,
        amountCents:cents(result.amount?.value)};
    },
    getRefund:async id=>{
      const result=await api("GET","/v2/payments/refunds/"+encodeURIComponent(id));
      return {id:result.id,status:result.status,currency:result.amount?.currency_code,
        amountCents:cents(result.amount?.value)};
    }
  };
}
module.exports={createPayPal};
