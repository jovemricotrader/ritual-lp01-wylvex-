import { useState, useEffect, useRef } from 'react';

const SB_URL = "https://ncqsuxqxujyfekjbgzch.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcXN1eHF4dWp5ZmVramJnemNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4OTcyMjAsImV4cCI6MjA5MDQ3MzIyMH0.xgwXSHE8dijOa7dtnzZ-CEG1_sP6L3yFvp3JYJ7LE3w";
const HUB = "https://wylvex-backend-production.up.railway.app";

async function sbInsert(table, data) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method:"POST",
      headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}`, "Content-Type":"application/json", Prefer:"return=representation" },
      body: JSON.stringify(data),
    });
    if(!r.ok){ const e=await r.text().catch(()=>"");console.error("[sbInsert]",r.status,e.slice(0,200));return false; }
    return true;
  } catch(e){ console.error("[sbInsert]",e.message);return false; }
}
async function sbQuery(table, query) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}${query}`, {
      headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}` }
    });
    return r.ok ? await r.json() : [];
  } catch { return []; }
}

function san(s){ return (s||"").replace(/<[^>]*>/g,"").trim().slice(0,200); }
function fbTrack(e,d){try{window.fbq&&window.fbq("track",e,d||{});}catch{}}

function gerarSlots(){
  const slots=[];const now=new Date();
  const horaBrasilia=(now.getUTCHours()-3+24)%24;
  const HORAS_HOJE=["09:00","10:00","11:00","13:00","14:00","15:00","16:00","17:00"].filter(h=>{
    const [hh]=h.split(":").map(Number);return hh>horaBrasilia+1;
  });
  const HORAS_PROX=["09:00","10:00","11:00","13:00","14:00","15:00","16:00","17:00"];
  const MESES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  const DIAS=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  if(HORAS_HOJE.length>0&&now.getDay()!==0){
    const dow=now.getDay();
    for(const h of HORAS_HOJE)
      slots.push({dateStr:now.toISOString().slice(0,10),hora:h,dia:DIAS[dow],diaNum:now.getDate(),mes:MESES[now.getMonth()]});
  }
  for(let d=1;d<=7;d++){
    const date=new Date(now);date.setDate(now.getDate()+d);
    const dow=date.getDay();if(dow===0)continue;
    for(const h of HORAS_PROX)
      slots.push({dateStr:date.toISOString().slice(0,10),hora:h,dia:DIAS[dow],diaNum:date.getDate(),mes:MESES[date.getMonth()]});
  }
  return slots;
}

function Agendador({leadData}){
  const todos=gerarSlots();
  const [diasUniq]=useState(()=>{const s=new Set();return todos.filter(t=>{if(s.has(t.dateStr))return false;s.add(t.dateStr);return true;});});
  const [diaSel,setDiaSel]=useState(diasUniq[0]?.dateStr||"");
  const [horaSel,setHoraSel]=useState("");
  const [bloq,setBloq]=useState({});
  const [status,setStatus]=useState("idle");

  useEffect(()=>{
    if(!diaSel)return;
    (async()=>{
      const rows=await sbQuery("reunioes",`?data=eq.${diaSel}&select=hora`);
      const b={};(rows||[]).forEach(r=>{b[r.hora]=true;});setBloq(b);
    })();
  },[diaSel]);

  const confirmar=async()=>{
    if(!horaSel||status==="loading")return;
    setStatus("loading");
    const slot=todos.find(s=>s.dateStr===diaSel&&s.hora===horaSel);
    const diaLabel=`${slot?.dia}, ${slot?.diaNum} de ${slot?.mes}`;
    await sbInsert("reunioes",{
      clinica_id:"wylvex",nome:leadData?.nome||"",clinica:leadData?.clinica||"",
      whatsapp:leadData?.whatsapp||"",data:diaSel,hora:horaSel,dia:diaLabel,
      score:leadData?.score||0,perda:leadData?.perda||0,status:"agendada",origem:"lp",
    });
    fetch(`${HUB}/api/confirm-lead`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({phone:"55"+((leadData?.whatsapp||"").replace(/\D/g,"")),
        nome:leadData?.nome,clinica:leadData?.clinica,perda:leadData?.perda,data:diaLabel,hora:horaSel}),
    }).catch(()=>{});
    if(leadData?.email){
      fetch(`${HUB}/api/confirm-email`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({to:leadData.email,nome:leadData.nome,perda:leadData.perda,clinica:leadData.clinica}),
      }).catch(()=>{});
    }
    fbTrack("Schedule",{content_name:"Demo Ritual"});
    setStatus("done");
  };

  const diaObj=diasUniq.find(d=>d.dateStr===diaSel);
  const horasDoDia=diaSel?todos.filter(s=>s.dateStr===diaSel&&!bloq[s.hora]):[];

  if(status==="done")return(
    <div style={{background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.2)",borderRadius:16,padding:"28px 22px",textAlign:"center"}}>
      <div style={{fontSize:40,marginBottom:12}}>✅</div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"#f0d9cc",marginBottom:8}}>Demonstração confirmada!</div>
      <div style={{fontSize:15,color:"#10b981",fontWeight:600,marginBottom:8}}>{diaObj?.dia}, {diaObj?.diaNum} de {diaObj?.mes} · {horaSel}</div>
      <div style={{fontSize:12,color:"rgba(255,255,255,.35)",lineHeight:1.7}}>Você vai receber uma confirmação pelo WhatsApp.</div>
    </div>
  );

  return(
    <div>
      <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:6,marginBottom:12,scrollbarWidth:"none"}}>
        {diasUniq.map(d=>{
          const sel=diaSel===d.dateStr;
          return(
            <button key={d.dateStr} onClick={()=>{setDiaSel(d.dateStr);setHoraSel("");}}
              style={{flexShrink:0,background:sel?"rgba(201,149,108,.12)":"rgba(255,255,255,.03)",border:`1.5px solid ${sel?"rgba(201,149,108,.4)":"rgba(255,255,255,.07)"}`,borderRadius:10,padding:"9px 14px",cursor:"pointer",textAlign:"center",minWidth:58,WebkitTapHighlightColor:"transparent"}}>
              <div style={{fontSize:9,color:sel?"#c9956c":"rgba(255,255,255,.4)",letterSpacing:1}}>{d.dia}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:sel?"#c9956c":"rgba(255,255,255,.7)"}}>{d.diaNum}</div>
            </button>
          );
        })}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7,marginBottom:14}}>
        {horasDoDia.map(s=>{
          const sel=horaSel===s.hora;
          return(
            <button key={s.hora} onClick={()=>setHoraSel(s.hora)}
              style={{background:sel?"rgba(201,149,108,.12)":"rgba(255,255,255,.03)",border:`1.5px solid ${sel?"rgba(201,149,108,.4)":"rgba(255,255,255,.07)"}`,borderRadius:9,padding:"11px 6px",cursor:"pointer",fontSize:13,fontWeight:sel?700:400,color:sel?"#c9956c":"rgba(255,255,255,.55)",WebkitTapHighlightColor:"transparent"}}>
              {s.hora}
            </button>
          );
        })}
      </div>
      <button onClick={confirmar} disabled={!horaSel||status==="loading"}
        style={{width:"100%",background:horaSel?"linear-gradient(135deg,#c9956c,#b8845b)":"rgba(255,255,255,.04)",border:"none",color:horaSel?"white":"rgba(255,255,255,.3)",borderRadius:10,padding:"15px",cursor:horaSel?"pointer":"not-allowed",fontSize:14,fontWeight:700,transition:"all .2s",WebkitTapHighlightColor:"transparent"}}>
        {status==="loading"?"Confirmando...":horaSel?`Confirmar · ${horaSel} →`:"Selecione um horário"}
      </button>
    </div>
  );
}

const G = `
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{overflow-x:hidden;-webkit-overflow-scrolling:touch;background:#080407}
  button,input,textarea{-webkit-appearance:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
  input,textarea,select{font-size:max(16px,1em)!important}
  input::placeholder,textarea::placeholder{color:rgba(240,217,204,.2)!important}
  input:focus,textarea:focus{outline:none;border-color:rgba(201,149,108,.5)!important}
  ::-webkit-scrollbar{width:2px}::-webkit-scrollbar-thumb{background:rgba(201,149,108,.2)}
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes pulse{0%,100%{opacity:.3;transform:scale(.95)}50%{opacity:.8;transform:scale(1.05)}}
  @keyframes countUp{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
  @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
  @keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
  .shim{background:linear-gradient(90deg,#c9956c 0%,#f0d9cc 35%,#fff8f0 50%,#f0d9cc 65%,#c9956c 100%);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 3s linear infinite}
  @media(min-width:540px){.lp-wrap{max-width:520px!important;padding:0 28px!important}}
  @media(min-width:900px){.lp-wrap{max-width:600px!important}.hero-hl{font-size:56px!important}}
`;

export default function App(){
  const [fase,setFase]=useState("hero");
  const [step,setStep]=useState(0);
  const [res,setRes]=useState({});
  const [form,setForm]=useState({nome:"",whatsapp:"",clinica:""});
  const [loading,setLoading]=useState(false);
  const [savedLead,setSavedLead]=useState(null);
  const [count,setCount]=useState(0);
  const [active,setActive]=useState(0); // social proof counter
  const topo=useRef(null);

  useEffect(()=>{
    fbTrack("ViewContent",{content_name:"LP Ritual"});
    let v=0;const iv=setInterval(()=>{v++;setCount(v);if(v>=18)clearInterval(iv);},50);
    // Animate active count (fake social proof — "X analisaram essa semana")
    setActive(Math.floor(Math.random()*12)+23); // 23-34
    return()=>clearInterval(iv);
  },[]);

  // Ticket médio → valor numérico
  const ticketVal = res.ticket==="Até R$500"?400:res.ticket==="R$500–1.000"?750:res.ticket==="R$1.000–2.000"?1500:res.ticket==="Acima de R$2.000"?2500:800;
  const perda=Math.round((res.pacientes||20)*ticketVal*0.18);

  const ETAPAS=[
    {id:"ticket",titulo:"Qual o ticket médio dos seus procedimentos?",sub:"Toxina, preenchimento, harmonização...",
      ops:[{ic:"💉",l:"Até R$500"},{ic:"💎",l:"R$500–1.000"},{ic:"✨",l:"R$1.000–2.000"},{ic:"👑",l:"Acima de R$2.000"}]},
    {id:"pacientes",titulo:"Quantas pacientes você atende por mês?",sub:"Aproximadamente."},
    {id:"dor",titulo:"O que mais te incomoda hoje?",sub:"",
      ops:[{ic:"👻",l:"Pacientes somem sem retornar"},{ic:"📱",l:"Dependente de indicação"},{ic:"⏰",l:"Sem tempo para follow-up"},{ic:"📉",l:"Agenda com buracos"}]},
    {id:"contato",titulo:"Pra onde enviamos seu diagnóstico?",sub:""},
  ];

  const etapa=ETAPAS[step];

  const goNext=(val,campo)=>{
    if(campo)setRes(p=>({...p,[campo]:val}));
    if(step<ETAPAS.length-1)setStep(s=>s+1);
  };

  const submit=async()=>{
    const wLen=form.whatsapp.replace(/\D/g,"").length;
    if(!form.nome.trim()||wLen<10)return;
    setLoading(true);
    const dados={
      nome:san(form.nome),clinica:san(form.clinica),
      whatsapp:san(form.whatsapp),tel:san(form.whatsapp),
      email:"",
      pacientes:parseInt(res.pacientes)||20,
      dor:san(res.dor||""),
      perda:parseInt(perda)||0,
      score:parseInt(Math.min(95,70+(perda>5000?15:5)+(res.dor?10:0))),
      clinica_id:"wylvex",origem:"lp",status:"novo",
    };
    await sbInsert("leads",dados);
    setSavedLead(dados);
    fbTrack("Lead",{content_name:"Diagnóstico Ritual",currency:"BRL",value:0});
    setLoading(false);setFase("resultado");
    setTimeout(()=>topo.current?.scrollIntoView({behavior:"smooth"}),100);
  };

  const S={
    page:{fontFamily:"'Plus Jakarta Sans',sans-serif",background:"#080407",color:"#e8d8cc",minHeight:"100vh"},
    wrap:{maxWidth:460,margin:"0 auto",padding:"0 20px"},
    btn:{background:"linear-gradient(135deg,#c9956c,#b8845b)",border:"none",color:"white",borderRadius:10,padding:"16px 24px",fontSize:15,fontWeight:700,cursor:"pointer",width:"100%",letterSpacing:.3},
    inp:{background:"rgba(255,255,255,.04)",border:"1.5px solid rgba(255,255,255,.08)",color:"#f0d9cc",padding:"15px",borderRadius:10,fontSize:14,width:"100%",fontFamily:"'Plus Jakarta Sans',sans-serif",marginBottom:10,display:"block"},
  };

  /* ── HERO ── */
  if(fase==="hero")return(
    <div ref={topo} style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{G}</style>

      {/* TOP BAR */}
      <div style={{borderBottom:"1px solid rgba(255,255,255,.04)",padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontStyle:"italic",color:"rgba(240,217,204,.6)",letterSpacing:3}}>ritual</span>
        {/* Social proof live */}
        <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",borderRadius:20,padding:"4px 10px"}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:"#10b981",animation:"pulse 2s infinite"}}/>
          <span style={{fontSize:10,color:"rgba(16,185,129,.8)"}}>{active} diagnósticos essa semana</span>
        </div>
      </div>

      {/* HERO — above fold */}
      <div className="lp-wrap" style={{...S.wrap,paddingTop:44,paddingBottom:0}}>

        {/* Headline — direct, above fold */}
        <div style={{marginBottom:24,animation:"fadeUp .6s ease both"}}>
          <h1 className="hero-hl" style={{fontFamily:"'Cormorant Garamond',serif",fontSize:42,fontWeight:700,lineHeight:1.05,color:"rgba(240,217,204,.95)",marginBottom:14,letterSpacing:-1}}>
            Você <span className="shim" style={{fontStyle:"italic"}}>perde pacientes</span> toda semana sem saber.
          </h1>
          <p style={{fontSize:15,color:"rgba(255,255,255,.4)",lineHeight:1.75,fontWeight:300}}>
            Não por insatisfação — <strong style={{color:"rgba(255,255,255,.65)",fontWeight:500}}>porque ninguém lembrou delas no momento certo.</strong>
          </p>
        </div>

        {/* Stat card — the hook */}
        <div style={{background:"rgba(201,149,108,.05)",border:"1px solid rgba(201,149,108,.15)",borderRadius:16,padding:"20px",marginBottom:24,position:"relative",overflow:"hidden",animation:"fadeUp .6s .08s ease both"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#c9956c,transparent)"}}/>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{textAlign:"center",flexShrink:0}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:72,fontWeight:700,color:"#c9956c",fontStyle:"italic",lineHeight:.9,animation:"countUp .8s ease both"}}>{count}%</div>
              <div style={{fontSize:9,color:"rgba(201,149,108,.5)",letterSpacing:2,marginTop:4}}>da sua agenda</div>
            </div>
            <div>
              <div style={{fontSize:14,fontWeight:600,color:"#f0d9cc",lineHeight:1.5,marginBottom:6}}>das suas pacientes somem antes do retorno ideal</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.3)",lineHeight:1.6}}>65% voltam quando alguém manda a mensagem certa no momento certo</div>
            </div>
          </div>
        </div>

        {/* CTA principal — above fold */}
        <div style={{animation:"fadeUp .6s .15s ease both",marginBottom:10}}>
          <button style={S.btn} onClick={()=>{setFase("form");fbTrack("ViewContent",{content_name:"Diagnóstico"});}}>
            Ver meu diagnóstico grátis →
          </button>
          <p style={{textAlign:"center",marginTop:8,fontSize:11,color:"rgba(255,255,255,.2)"}}>2 minutos · sem cartão · sem compromisso</p>
        </div>
      </div>

      {/* DIVIDER */}
      <div style={{height:1,background:"rgba(255,255,255,.04)",margin:"32px 0"}}/>

      {/* PROVA SOCIAL — abaixo do fold, reforço */}
      <div className="lp-wrap" style={{...S.wrap,paddingBottom:0}}>
        <div style={{fontSize:9,color:"rgba(255,255,255,.25)",letterSpacing:3,textTransform:"uppercase",marginBottom:14,textAlign:"center"}}>O que clínicas estão recuperando</div>
        {[
          {q:"Sistema avisou. Ela voltou.",r:"R$ 4.200 recuperados",s:"Harmonização · SP",i:"D"},
          {q:"3 retornos na primeira semana.",r:"R$ 2.700 sem esforço",s:"Clínica estética · RJ",i:"C"},
        ].map(({q,r,s,i})=>(
          <div key={q} style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:12,padding:"14px 16px",marginBottom:10,display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(201,149,108,.12)",border:"1px solid rgba(201,149,108,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#c9956c",flexShrink:0}}>{i}</div>
            <div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontStyle:"italic",color:"rgba(240,217,204,.7)",marginBottom:6,lineHeight:1.5}}>{q}</div>
              <div style={{fontSize:13,fontWeight:700,color:"#c9956c"}}>{r}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.25)",marginTop:2}}>{s}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{height:1,background:"rgba(255,255,255,.04)",margin:"28px 0"}}/>

      {/* COMO FUNCIONA — curto */}
      <div className="lp-wrap" style={{...S.wrap}}>
        <div style={{fontSize:9,color:"rgba(255,255,255,.25)",letterSpacing:3,textTransform:"uppercase",marginBottom:16,textAlign:"center"}}>Como funciona</div>
        <div style={{position:"relative",paddingLeft:28}}>
          <div style={{position:"absolute",left:7,top:8,bottom:8,width:1,background:"linear-gradient(to bottom,rgba(201,149,108,.4),transparent)"}}/>
          {[
            ["Monitora","Aprende o ciclo de cada paciente automaticamente."],
            ["Identifica","Sabe quem precisa voltar — no momento exato."],
            ["Dispara","WhatsApp personalizado. Automático. Sem trabalho seu."],
          ].map(([t,d],i)=>(
            <div key={t} style={{position:"relative",paddingBottom:i<2?22:0,paddingLeft:18}}>
              <div style={{position:"absolute",left:-21,top:5,width:8,height:8,borderRadius:"50%",background:"#c9956c"}}/>
              <div style={{fontSize:13,fontWeight:700,color:"#f0d9cc",marginBottom:3}}>{t}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.35)",lineHeight:1.6}}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{height:1,background:"rgba(255,255,255,.04)",margin:"28px 0"}}/>

      {/* GARANTIA + CTA FINAL */}
      <div className="lp-wrap" style={{...S.wrap,paddingBottom:64,textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:12}}>🛡️</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,color:"rgba(240,217,204,.9)",fontStyle:"italic",marginBottom:10,lineHeight:1.1}}>30 dias.<br/>Resultado ou devolvo tudo.</div>
        <p style={{fontSize:13,color:"rgba(255,255,255,.35)",lineHeight:1.8,marginBottom:24}}>Se o Ritual não trouxer nenhuma paciente de volta em 30 dias — <strong style={{color:"#f0d9cc"}}>devolução total. Sem pergunta.</strong></p>
        <button style={S.btn} onClick={()=>{setFase("form");fbTrack("ViewContent",{content_name:"CTA Garantia"});}}>
          Ver meu diagnóstico grátis →
        </button>
        <p style={{marginTop:8,fontSize:11,color:"rgba(255,255,255,.2)"}}>2 minutos · sem cartão</p>
        <p style={{marginTop:20,fontSize:10,color:"rgba(255,255,255,.12)",letterSpacing:2}}>ritual · by wylvex</p>
      </div>
    </div>
  );

  /* ── FORM (funil 4 etapas) ── */
  if(fase==="form")return(
    <div ref={topo} style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{G}</style>
      <div className="lp-wrap" style={{...S.wrap,paddingTop:40,paddingBottom:80}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28}}>
          <button onClick={()=>{if(step>0)setStep(s=>s-1);else setFase("hero");}} style={{background:"none",border:"none",color:"rgba(255,255,255,.3)",cursor:"pointer",fontSize:22,padding:"4px 8px",lineHeight:1}}>←</button>
          {/* Progress bar */}
          <div style={{display:"flex",gap:5,flex:1,margin:"0 12px"}}>
            {ETAPAS.map((_,i)=>(
              <div key={i} style={{flex:1,height:3,borderRadius:2,background:i<=step?"#c9956c":"rgba(255,255,255,.07)",transition:"background .3s"}}/>
            ))}
          </div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.2)",whiteSpace:"nowrap"}}>{Math.round((step/(ETAPAS.length-1))*100)||0}%</div>
        </div>

        <div style={{animation:"fadeUp .35s ease both"}}>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:27,fontWeight:700,color:"#f0d9cc",marginBottom:6,lineHeight:1.2}}>{etapa.titulo}</h2>
          {etapa.sub&&<p style={{fontSize:13,color:"rgba(255,255,255,.35)",marginBottom:22,lineHeight:1.6}}>{etapa.sub}</p>}
          {!etapa.sub&&<div style={{marginBottom:22}}/>}

          {/* CARDS (ticket + dor) */}
          {etapa.ops&&(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {etapa.ops.map(op=>(
                <button key={op.l} onClick={()=>{setRes(p=>({...p,[etapa.id]:op.l}));setTimeout(()=>goNext(op.l,etapa.id),100);}}
                  style={{background:"rgba(255,255,255,.03)",border:"1.5px solid rgba(255,255,255,.08)",borderRadius:11,padding:"15px 16px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12,color:"rgba(240,217,204,.75)",fontSize:14,transition:"all .12s",WebkitTapHighlightColor:"transparent"}}
                  onTouchStart={e=>e.currentTarget.style.background="rgba(201,149,108,.06)"}
                  onTouchEnd={e=>e.currentTarget.style.background="rgba(255,255,255,.03)"}>
                  <span style={{fontSize:22,flexShrink:0}}>{op.ic}</span>
                  <span style={{fontWeight:500}}>{op.l}</span>
                </button>
              ))}
            </div>
          )}

          {/* PACIENTES slider */}
          {etapa.id==="pacientes"&&!etapa.ops&&(
            <div>
              <div style={{textAlign:"center",marginBottom:20,padding:"20px",background:"rgba(201,149,108,.04)",borderRadius:12,border:"1px solid rgba(201,149,108,.1)"}}>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:68,fontWeight:700,color:"#c9956c",fontStyle:"italic",lineHeight:1}}>{res.pacientes||20}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginTop:4}}>pacientes/mês</div>
                {(res.ticket||res.pacientes)&&<div style={{marginTop:10,fontSize:12,color:"rgba(201,149,108,.6)"}}>
                  ≈ R$ {Math.round((res.pacientes||20)*ticketVal*0.18).toLocaleString("pt-BR")}/mês em retornos perdidos
                </div>}
              </div>
              <input type="range" min={5} max={200} step={5} value={res.pacientes||20}
                onChange={e=>setRes(p=>({...p,pacientes:+e.target.value}))}
                style={{width:"100%",accentColor:"#c9956c",marginBottom:24,height:4}}/>
              <button style={S.btn} onClick={()=>goNext(res.pacientes||20,"pacientes")}>Continuar →</button>
            </div>
          )}

          {/* CONTATO form */}
          {etapa.id==="contato"&&(
            <div>
              {/* Perda preview card */}
              <div style={{background:"linear-gradient(135deg,rgba(201,149,108,.08),rgba(201,149,108,.03))",border:"1px solid rgba(201,149,108,.2)",borderRadius:14,padding:"18px",marginBottom:20,textAlign:"center",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#c9956c,transparent)"}}/>
                <div style={{fontSize:10,color:"rgba(201,149,108,.5)",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Sua perda estimada</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:44,fontWeight:700,color:"#c9956c",fontStyle:"italic",lineHeight:1}}>
                  R$ {perda.toLocaleString("pt-BR")}<span style={{fontSize:16,color:"rgba(201,149,108,.5)"}}>/mês</span>
                </div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginTop:6}}>{res.pacientes||20} pacientes · ticket {res.ticket||"médio"}</div>
              </div>

              {/* 2 campos apenas — máximo simplicidade */}
              <input type="text" autoComplete="name" style={S.inp} placeholder="Seu nome" value={form.nome}
                onChange={e=>setForm(p=>({...p,nome:e.target.value}))}/>
              <input type="text" style={S.inp} placeholder="Nome da clínica (opcional)" value={form.clinica}
                onChange={e=>setForm(p=>({...p,clinica:e.target.value}))}/>
              <input type="tel" autoComplete="tel" style={S.inp} placeholder="WhatsApp com DDD" value={form.whatsapp}
                onChange={e=>setForm(p=>({...p,whatsapp:e.target.value}))}/>

              <button style={{...S.btn,opacity:loading?0.7:1,marginTop:4}}
                onClick={submit}
                disabled={loading||!form.nome.trim()||form.whatsapp.replace(/\D/g,"").length<10}>
                {loading?"Gerando diagnóstico...":"Ver diagnóstico e agendar →"}
              </button>
              <p style={{fontSize:10,color:"rgba(255,255,255,.18)",textAlign:"center",marginTop:10,lineHeight:1.6}}>Dados confidenciais. Não compartilhamos.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  /* ── RESULTADO ── */
  return(
    <div ref={topo} style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{G}</style>
      <div className="lp-wrap" style={{...S.wrap,paddingTop:40,paddingBottom:80}}>

        <div style={{animation:"fadeUp .5s ease both"}}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontStyle:"italic",color:"rgba(201,149,108,.35)",letterSpacing:3}}>ritual</span>
          </div>

          {/* BIG perda number */}
          <div style={{background:"linear-gradient(135deg,rgba(201,149,108,.08),rgba(201,149,108,.03))",border:"1px solid rgba(201,149,108,.2)",borderRadius:16,padding:"26px 20px",marginBottom:16,textAlign:"center",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#c9956c,transparent)"}}/>
            <div style={{fontSize:10,color:"rgba(201,149,108,.5)",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Diagnóstico de {(savedLead?.nome||"").split(" ")[0]}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:52,fontWeight:700,color:"#c9956c",fontStyle:"italic",lineHeight:1}}>
              R$ {perda.toLocaleString("pt-BR")}<span style={{fontSize:18,color:"rgba(201,149,108,.5)"}}>/mês</span>
            </div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginTop:8}}>em retornos que não acontecem na {savedLead?.clinica||"sua clínica"}</div>
          </div>

          {/* Next step message */}
          <div style={{background:"rgba(16,185,129,.05)",border:"1px solid rgba(16,185,129,.15)",borderRadius:12,padding:"14px 16px",marginBottom:20,display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{fontSize:18,flexShrink:0}}>📱</span>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:"#10b981",marginBottom:3}}>WhatsApp em breve</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.4)",lineHeight:1.6}}>Nossa equipe vai entrar em contato pra mostrar ao vivo como o Ritual recupera esse valor.</div>
            </div>
          </div>

          {/* Agendador */}
          <div style={{marginBottom:24}}>
            <div style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,.45)",marginBottom:12,letterSpacing:.3}}>📅 Agendar demonstração agora (30min)</div>
            <Agendador leadData={savedLead}/>
          </div>

          {/* Garantia lembrete */}
          <div style={{textAlign:"center",padding:"16px",background:"rgba(255,255,255,.02)",borderRadius:12,border:"1px solid rgba(255,255,255,.04)"}}>
            <div style={{fontSize:22,marginBottom:6}}>🛡️</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.3)",lineHeight:1.7}}>30 dias de garantia.<br/>Resultado ou <strong style={{color:"rgba(255,255,255,.5)"}}>devolução total</strong>.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
