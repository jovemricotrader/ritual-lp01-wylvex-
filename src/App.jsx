import{useState,useEffect,useRef}from"react";

const SB_URL="https://ncqsuxqxujyfekjbgzch.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcXN1eHF4dWp5ZmVramJnemNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIzMjQ3NTgsImV4cCI6MjA1NzkwMDc1OH0.xgwXSHE8dijOa7dtnzZ-CEG1_sP6L3yFvp3JYJ7LE3w";
const HUB="https://wylvex-backend-production.up.railway.app";

/* ── Supabase ── */
async function sbInsert(table,data){
  try{
    const r=await fetch(`${SB_URL}/rest/v1/${table}`,{
      method:"POST",
      headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`,"Content-Type":"application/json",Prefer:"return=minimal"},
      body:JSON.stringify(data),
    });
    if(!r.ok){console.error("[sbInsert]",r.status,table);return false;}
    return true;
  }catch(e){console.error("[sbInsert]",e.message);return false;}
}
async function sbQuery(table,query){
  try{
    const r=await fetch(`${SB_URL}/rest/v1/${table}${query}`,{headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`}});
    if(!r.ok)return[];
    return await r.json();
  }catch{return[];}
}

/* ── Sanitize ── */
const san=(s)=>String(s||"").replace(/<[^>]*>/g,"").trim().slice(0,200);

/* ── Pixel ── */
const fbTrack=(e,d)=>{try{window.fbq&&window.fbq("track",e,d||{});}catch{}}

/* ── Ic ── */
function Ic({n,size=20,col="currentColor",style={}}){
  return <span className="material-symbols-outlined" style={{fontSize:size,color:col,display:"inline-flex",alignItems:"center",lineHeight:1,...style}}>{n}</span>;
}

/* ── Slots ── */
function gerarSlots(){
  const HORAS=["09:00","10:00","11:00","13:00","14:00","15:00"];
  const MESES=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const DIAS_S=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const slots=[];
  const d=new Date();d.setHours(0,0,0,0);
  let tentativas=0;
  while(slots.length<36&&tentativas<14){
    tentativas++;d.setDate(d.getDate()+1);
    if(d.getDay()===0)continue;
    const dateStr=d.toISOString().slice(0,10);
    HORAS.forEach(h=>{
      slots.push({dateStr,hora:h,diaNum:d.getDate(),mes:MESES[d.getMonth()],dia:DIAS_S[d.getDay()]});
    });
  }
  return slots;
}

/* ═══ AGENDADOR ═══ */
function Agendador({leadData}){
  const todos=gerarSlots();
  const [diasUniq]=useState(()=>{
    const seen=new Set();
    return todos.filter(s=>{if(seen.has(s.dateStr))return false;seen.add(s.dateStr);return true;});
  });
  const [diaSel,setDiaSel]=useState(null);
  const [horaSel,setHoraSel]=useState(null);
  const [bloq,setBloq]=useState({});
  const [status,setStatus]=useState("idle"); // idle | loading | done | error

  useEffect(()=>{
    if(!diaSel)return;
    setHoraSel(null);
    (async()=>{
      const rows=await sbQuery("reunioes",`?data=eq.${diaSel}&clinica_id=eq.wylvex&select=hora`);
      const b={};(rows||[]).forEach(r=>{b[r.hora]=true;});setBloq(b);
    })();
  },[diaSel]);

  const confirmar=async()=>{
    if(!diaSel||!horaSel||status==="loading")return;
    setStatus("loading");
    const slot=todos.find(s=>s.dateStr===diaSel&&s.hora===horaSel);
    const diaLabel=`${slot?.dia}, ${slot?.diaNum} de ${slot?.mes}`;
    // Salva no Supabase
    await sbInsert("reunioes",{
      clinica_id:"wylvex",
      nome:leadData?.nome||"",
      clinica:leadData?.clinica||"",
      whatsapp:leadData?.whatsapp||"",
      data:diaSel,
      hora:horaSel,
      dia:diaLabel,
      score:leadData?.score||0,
      perda:leadData?.perda||0,
      status:"agendada",
      origem:"lp",
    });
    // Notifica equipe via Hub (sem await — não bloqueia UX)
    fetch(`${HUB}/api/confirm-lead`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        phone:"55"+((leadData?.whatsapp||"").replace(/\D/g,"")),
        nome:leadData?.nome,clinica:leadData?.clinica,
        perda:leadData?.perda,data:diaLabel,hora:horaSel,
        message:`Oi ${(leadData?.nome||"").split(" ")[0]}! Sua demo do Ritual está confirmada para ${diaLabel} às ${horaSel} 🎯\n\nNossa equipe vai entrar em contato com o link da call em breve.`,
      }),
    }).catch(()=>{});
    fbTrack("Schedule",{content_name:"Demo Ritual"});
    setStatus("done");
  };

  const diaObj=diasUniq.find(d=>d.dateStr===diaSel);
  const horasDoDia=diaSel?todos.filter(s=>s.dateStr===diaSel&&!bloq[s.hora]):[];

  if(status==="done")return(
    <div style={{background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.2)",borderRadius:14,padding:"28px 22px",textAlign:"center"}}>
      <div style={{fontSize:44,marginBottom:12}}>✨</div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"#f0d9cc",marginBottom:8}}>Call confirmada!</div>
      <div style={{fontSize:14,color:"#10b981",fontWeight:600,marginBottom:6,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{diaObj?.dia}, {diaObj?.diaNum} de {diaObj?.mes} · {horaSel}</div>
      <div style={{fontSize:12,color:"rgba(255,255,255,.35)",lineHeight:1.7,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Você vai receber a confirmação no WhatsApp.<br/>Nossa equipe estará pronta com seu diagnóstico.</div>
    </div>
  );

  return(
    <div style={{background:"rgba(201,149,108,.04)",border:"1px solid rgba(201,149,108,.14)",borderRadius:14,padding:"20px 18px"}}>
      <div style={{fontSize:9,color:"#c9956c",fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:12,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Escolha um horário</div>
      {/* Dias */}
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:14,scrollbarWidth:"none"}}>
        {diasUniq.slice(0,7).map(d=>(
          <button key={d.dateStr} onClick={()=>setDiaSel(d.dateStr)}
            style={{flexShrink:0,background:diaSel===d.dateStr?"rgba(201,149,108,.15)":"rgba(255,255,255,.04)",border:`1px solid ${diaSel===d.dateStr?"rgba(201,149,108,.4)":"rgba(255,255,255,.08)"}`,borderRadius:10,padding:"10px 14px",cursor:"pointer",textAlign:"center",minWidth:68}}>
            <div style={{fontSize:9,color:diaSel===d.dateStr?"#c9956c":"rgba(255,255,255,.3)",letterSpacing:1,textTransform:"uppercase",fontFamily:"'Plus Jakarta Sans',sans-serif",marginBottom:3}}>{d.dia}</div>
            <div style={{fontSize:18,fontWeight:700,color:diaSel===d.dateStr?"#f0d9cc":"rgba(255,255,255,.5)",fontFamily:"'Cormorant Garamond',serif",lineHeight:1}}>{d.diaNum}</div>
            <div style={{fontSize:9,color:"rgba(255,255,255,.25)",fontFamily:"'Plus Jakarta Sans',sans-serif",marginTop:2}}>{d.mes}</div>
          </button>
        ))}
      </div>
      {/* Horas */}
      {diaSel&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7,marginBottom:16}}>
          {horasDoDia.length===0
            ?<div style={{gridColumn:"1/-1",textAlign:"center",fontSize:12,color:"rgba(255,255,255,.25)",padding:"12px",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Sem horários disponíveis neste dia</div>
            :horasDoDia.map(s=>(
              <button key={s.hora} onClick={()=>setHoraSel(s.hora)}
                style={{background:horaSel===s.hora?"rgba(201,149,108,.18)":"rgba(255,255,255,.04)",border:`1px solid ${horaSel===s.hora?"rgba(201,149,108,.5)":"rgba(255,255,255,.08)"}`,borderRadius:9,padding:"11px 6px",cursor:"pointer",fontSize:13,fontWeight:horaSel===s.hora?700:400,color:horaSel===s.hora?"#c9956c":"rgba(255,255,255,.5)",fontFamily:"'Plus Jakarta Sans',sans-serif",transition:"all .15s"}}>
                {s.hora}
              </button>
          ))}
        </div>
      )}
      {/* Botão */}
      <button onClick={confirmar} disabled={!diaSel||!horaSel||status==="loading"}
        style={{width:"100%",background:(!diaSel||!horaSel)?"rgba(255,255,255,.05)":"linear-gradient(135deg,#c9956c,#b8845b)",border:"none",color:"white",borderRadius:10,padding:"14px",cursor:(!diaSel||!horaSel)?"not-allowed":"pointer",fontSize:13,fontWeight:700,fontFamily:"'Plus Jakarta Sans',sans-serif",opacity:(!diaSel||!horaSel)?.4:1,transition:"all .2s"}}>
        {status==="loading"?"Confirmando...":horaSel?`Confirmar · ${horaSel} →`:"Selecione dia e horário"}
      </button>
    </div>
  );
}

/* ═══ MAIN ═══ */
export default function App(){
  const topo=useRef(null);
  const [fase,setFase]=useState("hero"); // hero | form | resultado
  const [step,setStep]=useState(0);
  const [res,setRes]=useState({});
  const [form,setForm]=useState({nome:"",clinica:"",whatsapp:"",email:""});
  const [loading,setLoading]=useState(false);
  const [savedLead,setSavedLead]=useState(null);

  const ETAPAS=[
    {id:"pacientes",tipo:"slider",titulo:"Quantas pacientes você atende por mês?",sub:"Calculamos sua perda real com esse número."},
    {id:"ticket",tipo:"cards",titulo:"Qual seu ticket médio por procedimento?",sub:"Para calcular exatamente quanto você está perdendo.",
      ops:[{l:"Até R$300",v:250},{l:"R$300–500",v:400},{l:"R$500–800",v:650},{l:"R$800–1.200",v:1000},{l:"Acima de R$1.200",v:1400}]},
    {id:"dor",tipo:"cards",titulo:"O que mais trava sua clínica hoje?",sub:"Uma resposta. A que mais dói.",
      ops:[{ic:"👻",l:"Pacientes somem depois do procedimento"},{ic:"📅",l:"Agenda com buracos todo mês"},{ic:"🔁",l:"Retornos que não acontecem"},{ic:"😶",l:"Pacientes que vão pra outra clínica"}]},
    {id:"contato",tipo:"form",titulo:"Última etapa.",sub:"Para onde enviamos o diagnóstico?"},
  ];

  const etapa=ETAPAS[step];
  const pacientes=res.pacientes||20;
  const ticket=typeof res.ticket==="number"?res.ticket:400;
  const perda=Math.round(pacientes*ticket*0.18);

  const goNext=(val,campo)=>{
    if(campo)setRes(p=>({...p,[campo]:val}));
    if(step<ETAPAS.length-1)setStep(s=>s+1);
  };

  const submit=async()=>{
    if(!form.nome.trim()||form.whatsapp.replace(/\D/g,"").length<10)return;
    setLoading(true);
    const dados={
      ...res,...form,
      nome:san(form.nome),clinica:san(form.clinica),whatsapp:san(form.whatsapp),
      perda,score:Math.min(95,70+(perda>5000?15:5)+(res.dor?10:0)),
      clinica_id:"wylvex",origem:"lp",
      closer:"Thaynah",status:"aquisicao",
    };
    // Salva lead
    await sbInsert("leads",dados);
    setSavedLead(dados);
    // Zap automático
    if(dados.whatsapp){
      const tel="55"+dados.whatsapp.replace(/\D/g,"");
      const nome1=dados.nome.split(" ")[0]||"";
      const perdaFmt=perda.toLocaleString("pt-BR");
      const msgs=[
        `Oi, ${nome1}! Vi seu diagnóstico aqui 👋\n\nCalculei que você pode estar perdendo R$ ${perdaFmt}/mês em retornos que não acontecem.\n\nConsigo te mostrar como o Ritual resolve isso numa call de 30min. Faz sentido?`,
        `${nome1}, recebi seu diagnóstico agora.\n\nO número que calculei foi R$ ${perdaFmt}/mês — é bastante coisa.\n\nQuando posso te mostrar ao vivo?`,
        `Oi ${nome1}! Aqui é da equipe Wylvex 🎯\n\nSeu diagnóstico chegou — perda estimada de R$ ${perdaFmt}/mês. Tem 30min essa semana pra eu te mostrar como resolver?`,
      ];
      fetch(`${HUB}/api/confirm-lead`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({phone:tel,message:msgs[Math.floor(Date.now()/1000)%msgs.length],nome:dados.nome,email:dados.email,perda,clinica:dados.clinica}),
      }).catch(()=>{});
    }
    // Email
    if(dados.email){
      fetch(`${HUB}/api/confirm-email`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({to:dados.email,nome:dados.nome,perda,clinica:dados.clinica}),
      }).catch(()=>{});
    }
    fbTrack("Lead",{content_name:"Diagnóstico Ritual",currency:"BRL",value:0});
    setLoading(false);
    setFase("resultado");
    setTimeout(()=>topo.current?.scrollIntoView({behavior:"smooth"}),100);
  };

  const S={
    page:{fontFamily:"'Plus Jakarta Sans',sans-serif",background:"#080407",color:"#e8d8cc",minHeight:"100vh"},
    wrap:{maxWidth:440,margin:"0 auto",padding:"0 20px"},
    btn:{background:"linear-gradient(135deg,#c9956c,#b8845b)",border:"none",color:"white",borderRadius:10,padding:"14px 24px",cursor:"pointer",fontSize:14,fontWeight:700,width:"100%",transition:"all .2s"},
    inp:{background:"rgba(255,255,255,.04)",border:"1.5px solid rgba(255,255,255,.08)",color:"#f0d9cc",padding:"13px 14px",borderRadius:10,fontSize:14,width:"100%",outline:"none",fontFamily:"'Plus Jakarta Sans',sans-serif",marginBottom:10},
  };

  /* ── HERO ── */
  if(fase==="hero")return(
    <div ref={topo} style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=Plus+Jakarta+Sans:wght@300;400;600;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}input::placeholder{color:rgba(240,217,204,.2)!important}`}</style>
      <div style={{...S.wrap,paddingTop:60,paddingBottom:80}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:48}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:42,fontWeight:700,fontStyle:"italic",color:"#f0d9cc",letterSpacing:4}}>ritual</div>
          <div style={{fontSize:9,color:"rgba(201,149,108,.4)",letterSpacing:4,textTransform:"uppercase",marginTop:4}}>by Wylvex</div>
        </div>
        {/* Headline */}
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:38,fontWeight:700,lineHeight:1.1,color:"#f0d9cc",marginBottom:12}}>
            Sua clínica está<br/><span style={{color:"#c9956c",fontStyle:"italic"}}>perdendo pacientes</span><br/>toda semana.
          </div>
          <div style={{fontSize:15,color:"rgba(255,255,255,.4)",lineHeight:1.7}}>Não porque ficaram insatisfeitas.<br/>Porque ninguém lembrou delas.</div>
        </div>
        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:32}}>
          {[["18%","somem sem retornar"],["65%","voltam quando lembradas"],["R$4.800","setup único"],["30 dias","garantia total"]].map(([n,l])=>(
            <div key={l} style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12,padding:"16px",textAlign:"center"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,color:"#c9956c",fontStyle:"italic"}}>{n}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginTop:4}}>{l}</div>
            </div>
          ))}
        </div>
        {/* CTA */}
        <button style={S.btn} onClick={()=>{setFase("form");fbTrack("ViewContent",{content_name:"Diagnóstico"});setTimeout(()=>topo.current?.scrollIntoView({behavior:"smooth"}),50);}}>
          Calcular minha perda mensal →
        </button>
        <div style={{textAlign:"center",marginTop:10,fontSize:11,color:"rgba(255,255,255,.2)"}}>Gratuito · 3 minutos · sem compromisso</div>
      </div>
    </div>
  );

  /* ── FORM / DIAGNÓSTICO ── */
  if(fase==="form")return(
    <div ref={topo} style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=Plus+Jakarta+Sans:wght@300;400;600;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}input::placeholder{color:rgba(240,217,204,.2)!important}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
      <div style={{...S.wrap,paddingTop:48,paddingBottom:80}}>
        {/* Progress */}
        <div style={{display:"flex",gap:5,marginBottom:32}}>
          {ETAPAS.map((_,i)=>(
            <div key={i} style={{flex:1,height:3,borderRadius:2,background:i<=step?"#c9956c":"rgba(255,255,255,.08)",transition:"background .3s"}}/>
          ))}
        </div>

        <div style={{animation:"fadeUp .4s ease both"}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:700,color:"#f0d9cc",marginBottom:6,lineHeight:1.2}}>{etapa.titulo}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.35)",marginBottom:24}}>{etapa.sub}</div>

          {/* Slider */}
          {etapa.tipo==="slider"&&(
            <div>
              <div style={{textAlign:"center",marginBottom:20}}>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:56,fontWeight:700,color:"#c9956c",fontStyle:"italic"}}>{res.pacientes||20}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>pacientes/mês</div>
              </div>
              <input type="range" min={5} max={200} value={res.pacientes||20}
                onChange={e=>setRes(p=>({...p,pacientes:+e.target.value}))}
                style={{width:"100%",accentColor:"#c9956c",marginBottom:24}}/>
              <button style={S.btn} onClick={()=>goNext(res.pacientes||20,"pacientes")}>Continuar →</button>
            </div>
          )}

          {/* Cards */}
          {etapa.tipo==="cards"&&(
            <div style={{display:"flex",flexDirection:"column",gap:9}}>
              {etapa.ops.map(op=>(
                <button key={op.l} onClick={()=>{setRes(p=>({...p,[etapa.id]:op.v||op.l}));setTimeout(()=>goNext(op.v||op.l,etapa.id),120);}}
                  style={{background:"rgba(255,255,255,.03)",border:"1.5px solid rgba(255,255,255,.08)",borderRadius:12,padding:"15px 16px",cursor:"pointer",textAlign:"left",fontSize:14,color:"rgba(240,217,204,.8)",fontFamily:"'Plus Jakarta Sans',sans-serif",display:"flex",alignItems:"center",gap:10,transition:"all .15s"}}>
                  {op.ic&&<span style={{fontSize:20}}>{op.ic}</span>}
                  {op.l}
                </button>
              ))}
            </div>
          )}

          {/* Form contato */}
          {etapa.tipo==="form"&&(
            <div>
              {perda>0&&(
                <div style={{background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.15)",borderRadius:12,padding:"16px",marginBottom:20,textAlign:"center"}}>
                  <div style={{fontSize:11,color:"rgba(239,68,68,.5)",letterSpacing:1,marginBottom:4}}>PERDA ESTIMADA</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:38,fontWeight:700,color:"#ef4444",fontStyle:"italic"}}>R$ {perda.toLocaleString("pt-BR")}<span style={{fontSize:16,color:"rgba(239,68,68,.5)"}}>/mês</span></div>
                </div>
              )}
              <input style={S.inp} placeholder="Seu nome *" value={form.nome} onChange={e=>setForm(p=>({...p,nome:e.target.value}))}/>
              <input style={S.inp} placeholder="Nome da clínica" value={form.clinica} onChange={e=>setForm(p=>({...p,clinica:e.target.value}))}/>
              <input style={S.inp} placeholder="WhatsApp * (DDD + número)" value={form.whatsapp} onChange={e=>setForm(p=>({...p,whatsapp:e.target.value}))} type="tel"/>
              <input style={{...S.inp,marginBottom:20}} placeholder="E-mail (opcional)" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} type="email"/>
              <button style={{...S.btn,opacity:loading?0.6:1}} disabled={loading} onClick={submit}>
                {loading?"Calculando...":"Ver diagnóstico e agendar demo →"}
              </button>
              <div style={{textAlign:"center",marginTop:8,fontSize:10,color:"rgba(255,255,255,.18)"}}>Seus dados são privados e não serão compartilhados</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  /* ── RESULTADO ── */
  return(
    <div ref={topo} style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=Plus+Jakarta+Sans:wght@300;400;600;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
      <div style={{...S.wrap,paddingTop:48,paddingBottom:80}}>
        <div style={{animation:"fadeUp .5s ease both"}}>
          {/* Logo */}
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,fontStyle:"italic",color:"rgba(201,149,108,.4)",letterSpacing:4}}>ritual</div>
          </div>
          {/* Perda */}
          <div style={{background:"rgba(201,149,108,.05)",border:"1px solid rgba(201,149,108,.15)",borderRadius:14,padding:"24px 20px",textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:10,color:"rgba(201,149,108,.5)",letterSpacing:2,textTransform:"uppercase",marginBottom:8,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Diagnóstico · {savedLead?.clinica||"Sua clínica"}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:46,fontWeight:700,color:"#c9956c",fontStyle:"italic",lineHeight:1}}>R$ {perda.toLocaleString("pt-BR")}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginTop:6,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>perdidos por mês em retornos que não acontecem</div>
          </div>
          {/* Mensagem */}
          <div style={{fontSize:14,color:"rgba(255,255,255,.5)",lineHeight:1.75,marginBottom:24,textAlign:"center",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
            <strong style={{color:"#f0d9cc"}}>{(savedLead?.nome||"").split(" ")[0]}</strong>, nossa equipe vai entrar em contato no WhatsApp em breve para confirmar sua demo.
          </div>
          {/* Agendador */}
          <div style={{marginBottom:28}}>
            <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,.6)",marginBottom:12,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Agilize sua demo — escolha um horário:</div>
            <Agendador leadData={savedLead}/>
          </div>
          {/* O que esperar */}
          <div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12,padding:"18px"}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,.25)",letterSpacing:2,textTransform:"uppercase",marginBottom:12,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>O que acontece agora</div>
            {[["📱","WhatsApp em breve","Nossa equipe entra em contato para confirmar"],["🎯","Demo de 30min","Mostramos o Ritual com os dados da sua clínica"],["✅","Sem compromisso","Você decide depois de ver funcionando"]].map(([ic,t,d])=>(
              <div key={t} style={{display:"flex",gap:12,marginBottom:12,alignItems:"flex-start"}}>
                <div style={{fontSize:20,flexShrink:0}}>{ic}</div>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"#f0d9cc",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{t}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.3)",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
