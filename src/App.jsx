import { useState, useEffect, useRef } from 'react';

const SB_URL = "https://ncqsuxqxujyfekjbgzch.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcXN1eHF4dWp5ZmVramJnemNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM3MDczMjYsImV4cCI6MjA1OTI4MzMyNn0.xgwXSHE8dijOa7dtnzZ-CEG1_sP6L3yFvp3JYJ7LE3w";
const HUB = "https://wylvex-backend-production.up.railway.app";

async function sbInsert(table, data) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method:"POST",
      headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}`, "Content-Type":"application/json", Prefer:"return=representation" },
      body: JSON.stringify(data),
    });
    if(!r.ok){ console.error("[sbInsert]", r.status, await r.text().catch(()=>"")); return false; }
    return true;
  } catch(e){ console.error("[sbInsert]", e.message); return false; }
}

async function sbQuery(table, query) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}${query}`, {
      headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}` }
    });
    if(!r.ok) return [];
    return await r.json();
  } catch { return []; }
}

function san(s){ return (s||"").replace(/<[^>]*>/g,"").trim().slice(0,200); }
function fbTrack(e,d){try{window.fbq&&window.fbq("track",e,d||{});}catch{}}

/* ─── SLOTS ─── */
function gerarSlots(){
  const slots=[];const now=new Date();
  const HORAS=["09:00","10:00","11:00","13:00","14:00","15:00"];
  for(let d=1;d<=6;d++){
    const date=new Date(now);date.setDate(now.getDate()+d);
    const dow=date.getDay();
    if(dow===0)continue;
    const MESES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    const DIAS=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
    for(const h of HORAS){
      slots.push({
        dateStr:date.toISOString().slice(0,10),
        hora:h,
        dia:DIAS[dow],
        diaNum:date.getDate(),
        mes:MESES[date.getMonth()],
      });
    }
  }
  return slots;
}

/* ─── AGENDADOR ─── */
function Agendador({leadData}){
  const todos=gerarSlots();
  const [diasUniq]=useState(()=>{const seen=new Set();return todos.filter(s=>{if(seen.has(s.dateStr))return false;seen.add(s.dateStr);return true;});});
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
      clinica_id:"wylvex",
      nome:leadData?.nome||"",
      clinica:leadData?.clinica||"",
      whatsapp:leadData?.whatsapp||"",
      data:diaSel,hora:horaSel,
      dia:diaLabel,
      score:leadData?.score||0,
      perda:leadData?.perda||0,
      status:"agendada",
      origem:"lp",
    });
    fetch(`${HUB}/api/confirm-lead`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        phone:"55"+((leadData?.whatsapp||"").replace(/\D/g,"")),
        nome:leadData?.nome,clinica:leadData?.clinica,
        perda:leadData?.perda,data:diaLabel,hora:horaSel,
      }),
    }).catch(()=>{});
    fbTrack("Schedule",{content_name:"Demo Ritual"});
    setStatus("done");
  };

  const diaObj=diasUniq.find(d=>d.dateStr===diaSel);
  const horasDoDia=diaSel?todos.filter(s=>s.dateStr===diaSel&&!bloq[s.hora]):[];

  if(status==="done")return(
    <div style={{background:"rgba(16,185,129,.05)",border:"1px solid rgba(16,185,129,.18)",borderRadius:16,padding:"28px 22px",textAlign:"center"}}>
      <div style={{fontSize:40,marginBottom:12}}>✅</div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:"#f0d9cc",marginBottom:8}}>Demonstração confirmada!</div>
      <div style={{fontSize:15,color:"#10b981",fontWeight:600,marginBottom:6}}>{diaObj?.dia}, {diaObj?.diaNum} de {diaObj?.mes} · {horaSel}</div>
      <div style={{fontSize:12,color:"rgba(255,255,255,.3)",lineHeight:1.7}}>Nossa equipe entra em contato pelo WhatsApp para confirmar o link da call.</div>
    </div>
  );

  return(
    <div>
      <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:6,marginBottom:14,scrollbarWidth:"none"}}>
        {diasUniq.map(d=>{
          const sel=diaSel===d.dateStr;
          return(
            <button key={d.dateStr} onClick={()=>{setDiaSel(d.dateStr);setHoraSel("");}}
              style={{flexShrink:0,background:sel?"rgba(201,149,108,.12)":"rgba(255,255,255,.03)",
                border:`1.5px solid ${sel?"rgba(201,149,108,.4)":"rgba(255,255,255,.08)"}`,
                borderRadius:10,padding:"9px 14px",cursor:"pointer",textAlign:"center",minWidth:60}}>
              <div style={{fontSize:9,color:sel?"#c9956c":"rgba(255,255,255,.4)",letterSpacing:1}}>{d.dia}</div>
              <div style={{fontSize:16,fontWeight:700,color:sel?"#c9956c":"rgba(255,255,255,.7)",fontFamily:"'Cormorant Garamond',serif"}}>{d.diaNum}</div>
            </button>
          );
        })}
      </div>
      <div className="slots-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
        {horasDoDia.map(s=>{
          const sel=horaSel===s.hora;
          return(
            <button key={s.hora} onClick={()=>setHoraSel(s.hora)}
              style={{background:sel?"rgba(201,149,108,.12)":"rgba(255,255,255,.03)",
                border:`1.5px solid ${sel?"rgba(201,149,108,.4)":"rgba(255,255,255,.08)"}`,
                borderRadius:9,padding:"10px 6px",cursor:"pointer",
                fontSize:13,fontWeight:sel?700:400,
                color:sel?"#c9956c":"rgba(255,255,255,.6)"}}>
              {s.hora}
            </button>
          );
        })}
      </div>
      <button onClick={confirmar} disabled={!horaSel||status==="loading"}
        style={{width:"100%",background:horaSel?"linear-gradient(135deg,#c9956c,#b8845b)":"rgba(255,255,255,.05)",
          border:"none",color:"white",borderRadius:10,padding:"14px",cursor:horaSel?"pointer":"not-allowed",
          fontSize:14,fontWeight:700,opacity:horaSel?1:.5,transition:"all .2s"}}>
        {status==="loading"?"Confirmando...":horaSel?`Confirmar demo · ${horaSel} →`:"Selecione um horário"}
      </button>
    </div>
  );
}

/* ─── MAIN ─── */
export default function App(){
  const [fase,setFase]=useState("hero");
  const [step,setStep]=useState(0);
  const [res,setRes]=useState({});
  const [form,setForm]=useState({nome:"",clinica:"",whatsapp:"",email:""});
  const [loading,setLoading]=useState(false);
  const [savedLead,setSavedLead]=useState(null);
  const topo=useRef(null);

  useEffect(()=>{fbTrack("ViewContent",{content_name:"LP Ritual"});},[]);

  const perda=Math.round((res.pacientes||20)*(
    res.ticket==="Até R$500"?400:res.ticket==="R$500–1.000"?750:res.ticket==="R$1.000–2.000"?1500:2500
  )*0.18);

  const ETAPAS=[
    {id:"pacientes",tipo:"slider",titulo:"Quantas pacientes você atende por mês?",sub:"Para calcular sua perda real."},
    {id:"ticket",tipo:"cards",titulo:"Qual seu ticket médio por procedimento?",sub:"Botox, preenchimento, bioestimulador...",
      ops:[{ic:"💉",l:"Até R$500"},{ic:"💎",l:"R$500–1.000"},{ic:"✨",l:"R$1.000–2.000"},{ic:"👑",l:"Acima de R$2.000"}]},
    {id:"dor",tipo:"cards",titulo:"O que mais trava sua clínica hoje?",sub:"Uma resposta. A que mais dói.",
      ops:[{ic:"👻",l:"Pacientes somem sem retornar"},{ic:"📱",l:"Fico dependendo de indicação"},{ic:"⏰",l:"Não tenho tempo pra fazer follow-up"},{ic:"📉",l:"Agenda com buracos toda semana"}]},
    {id:"contato",tipo:"form",titulo:"Última etapa.",sub:"Para onde enviamos o diagnóstico?"},
  ];

  const etapa=ETAPAS[step];

  const goNext=(val,campo)=>{
    if(campo)setRes(p=>({...p,[campo]:val}));
    if(step<ETAPAS.length-1)setStep(s=>s+1);
  };

  const submit=async()=>{
    if(!form.nome.trim()||form.whatsapp.replace(/\D/g,"").length<10)return;
    setLoading(true);
    const dados={...res,...form,nome:san(form.nome),clinica:san(form.clinica),whatsapp:san(form.whatsapp),
      perda,score:Math.min(95,70+(perda>5000?15:5)+(res.dor?10:0)),clinica_id:"wylvex",origem:"lp"};
    await sbInsert("leads",dados);
    setSavedLead(dados);
    if(dados.whatsapp){
      fetch(`${HUB}/api/confirm-lead`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({phone:"55"+dados.whatsapp.replace(/\D/g,""),
          nome:dados.nome,email:dados.email,perda:dados.perda,clinica:dados.clinica}),
      }).catch(()=>{});
    }
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
    wrap:{maxWidth:480,margin:"0 auto",padding:"0 20px"},
    btn:{background:"linear-gradient(135deg,#c9956c,#b8845b)",border:"none",color:"white",borderRadius:10,padding:"15px 24px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%",transition:"all .2s"},
    inp:{background:"rgba(255,255,255,.04)",border:"1.5px solid rgba(255,255,255,.08)",color:"#f0d9cc",padding:"13px 14px",borderRadius:10,fontSize:14,width:"100%",outline:"none",fontFamily:"'Plus Jakarta Sans',sans-serif",marginBottom:10},
  };

  const GS=`
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{overflow-x:hidden;-webkit-overflow-scrolling:touch}
  input,button,textarea{-webkit-appearance:none;appearance:none}
  input::placeholder{color:rgba(240,217,204,.2)!important}
  ::-webkit-scrollbar{width:2px}
  ::-webkit-scrollbar-thumb{background:rgba(201,149,108,.3)}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  @keyframes pulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.4)}}
  button{-webkit-tap-highlight-color:transparent}
  input:focus{border-color:rgba(201,149,108,.45)!important;background:rgba(201,149,108,.03)!important}
  @media(min-width:600px){
    .lp-wrap{max-width:560px!important;padding:0 32px!important}
    .hero-headline{font-size:52px!important}
    .stats-grid{grid-template-columns:repeat(4,1fr)!important}
    .compare-grid{grid-template-columns:1fr 1fr!important}
    .slots-grid{grid-template-columns:repeat(4,1fr)!important}
  }
  @media(min-width:900px){
    .lp-wrap{max-width:680px!important}
    .hero-headline{font-size:64px!important}
  }
`;

  /* ── HERO ── */
  if(fase==="hero")return(
    <div ref={topo} style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=Plus+Jakarta+Sans:wght@300;400;600;700&display=swap" rel="stylesheet"/>
      <style>{GS}</style>

      {/* HERO */}
      <div className="lp-wrap" style={{...S.wrap,paddingTop:60,paddingBottom:64}}>
        <div style={{textAlign:"center",marginBottom:48}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:42,fontWeight:700,fontStyle:"italic",color:"rgba(240,217,204,.9)",letterSpacing:2,marginBottom:4}}>ritual</div>
          <div style={{fontSize:9,color:"rgba(201,149,108,.4)",letterSpacing:4,textTransform:"uppercase"}}>by wylvex</div>
        </div>
        <div style={{textAlign:"center",marginBottom:32,animation:"fadeUp .6s ease both"}}>
          <div className="hero-headline" style={{fontFamily:"'Cormorant Garamond',serif",fontSize:40,fontWeight:700,lineHeight:1.1,color:"rgba(240,217,204,.95)",marginBottom:16}}>
            Sua clínica está<br/><span style={{color:"#c9956c",fontStyle:"italic"}}>perdendo pacientes</span><br/>toda semana.
          </div>
          <div style={{fontSize:15,color:"rgba(255,255,255,.4)",lineHeight:1.75}}>Não porque ficaram insatisfeitas.<br/>Porque ninguém lembrou delas.</div>
        </div>
        <div className="stats-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:32,animation:"fadeUp .6s .1s ease both"}}>
          {[["18%","somem sem retornar"],["65%","voltam quando lembradas"],["R$4.800","setup único"],["30 dias","garantia total"]].map(([v,l])=>(
            <div key={l} style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12,padding:"18px 14px",textAlign:"center"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,color:"#c9956c",fontStyle:"italic"}}>{v}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginTop:4}}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{animation:"fadeUp .6s .2s ease both"}}>
          <button style={S.btn} onClick={()=>{setFase("form");fbTrack("ViewContent",{content_name:"Diagnóstico"});}}>
            Calcular minha perda mensal →
          </button>
          <div style={{textAlign:"center",marginTop:10,fontSize:11,color:"rgba(255,255,255,.2)"}}>Gratuito · 3 minutos · sem compromisso</div>
        </div>
      </div>

      {/* COMO FUNCIONA */}
      <div style={{borderTop:"1px solid rgba(255,255,255,.05)",padding:"56px 0"}}>
        <div style={S.wrap}>
          <div style={{textAlign:"center",marginBottom:36}}>
            <div style={{fontSize:9,color:"rgba(201,149,108,.4)",letterSpacing:4,textTransform:"uppercase",marginBottom:12}}>como funciona</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,fontWeight:700,color:"rgba(240,217,204,.8)",fontStyle:"italic"}}>O Ritual trabalha enquanto você atende.</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {[
              ["01","Monitora","Aprende o ciclo de retorno de cada paciente automaticamente."],
              ["02","Identifica","No momento exato, sabe quem precisa voltar hoje."],
              ["03","Envia","Mensagem personalizada no WhatsApp — automático ou 1 clique."],
              ["04","Aprende","Melhora a cada interação. Fica mais preciso todo dia."],
            ].map(([n,t,d])=>(
              <div key={n} style={{display:"flex",gap:16,alignItems:"flex-start",background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:12,padding:"18px 16px",borderLeft:"2px solid rgba(201,149,108,.3)"}}>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,color:"rgba(201,149,108,.3)",fontStyle:"italic",flexShrink:0,width:32}}>{n}</div>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:"#f0d9cc",marginBottom:4}}>{t}</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.35)",lineHeight:1.6}}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ANTES vs DEPOIS */}
      <div style={{borderTop:"1px solid rgba(255,255,255,.05)",padding:"56px 0",background:"rgba(201,149,108,.02)"}}>
        <div style={S.wrap}>
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{fontSize:9,color:"rgba(201,149,108,.4)",letterSpacing:4,textTransform:"uppercase",marginBottom:12}}>a diferença real</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,color:"rgba(240,217,204,.8)",fontStyle:"italic",lineHeight:1.2}}>Sem sistema vs. Com Ritual</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{background:"rgba(239,68,68,.04)",border:"1px solid rgba(239,68,68,.1)",borderRadius:12,padding:"20px 16px"}}>
              <div style={{fontSize:10,letterSpacing:2,color:"rgba(239,68,68,.4)",textTransform:"uppercase",marginBottom:14}}>Sem sistema</div>
              {["Paciente vai embora e esquece","Retorno depende dela lembrar","3 meses depois: resultado se deteriorando","Ela foi pra clínica que ligou primeiro"].map(t=>(
                <div key={t} style={{display:"flex",gap:8,marginBottom:10,alignItems:"flex-start"}}>
                  <div style={{width:4,height:4,borderRadius:"50%",background:"rgba(239,68,68,.3)",flexShrink:0,marginTop:6}}/>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.3)",lineHeight:1.5}}>{t}</div>
                </div>
              ))}
            </div>
            <div style={{background:"rgba(16,185,129,.04)",border:"1px solid rgba(16,185,129,.15)",borderRadius:12,padding:"20px 16px"}}>
              <div style={{fontSize:10,letterSpacing:2,color:"rgba(16,185,129,.5)",textTransform:"uppercase",marginBottom:14}}>Com Ritual</div>
              {["Sistema monitora cada paciente","Mensagem automática no momento certo","Paciente responde, marca, retorna","Você recupera a receita sem esforço"].map(t=>(
                <div key={t} style={{display:"flex",gap:8,marginBottom:10,alignItems:"flex-start"}}>
                  <div style={{width:4,height:4,borderRadius:"50%",background:"#10b981",flexShrink:0,marginTop:6}}/>
                  <div style={{fontSize:12,color:"rgba(240,217,204,.6)",lineHeight:1.5}}>{t}</div>
                </div>
              ))}
              <div style={{marginTop:12,background:"rgba(16,185,129,.06)",borderRadius:8,padding:"10px 12px"}}>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:"#10b981",fontStyle:"italic"}}>R$ 4.200</div>
                <div style={{fontSize:10,color:"rgba(16,185,129,.5)",marginTop:2}}>recuperados em 45 dias · Clínica SP</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PROVA SOCIAL */}
      <div style={{borderTop:"1px solid rgba(255,255,255,.05)",padding:"56px 0"}}>
        <div style={S.wrap}>
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{fontSize:9,color:"rgba(201,149,108,.4)",letterSpacing:4,textTransform:"uppercase",marginBottom:12}}>resultados reais</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {[
              ["\"Sistema avisou. Ela voltou.\"","R$ 4.200 recuperados em 45 dias","Clínica de Harmonização · SP"],
              ["\"Primeira semana, 3 retornos automáticos.\"","R$ 2.700 sem fazer nada","Dra. responsável · RJ"],
              ["\"Nunca mais perco paciente sem saber por quê.\"","Pipeline 100% visível","Clínica Premium · Curitiba"],
            ].map(([q,r,s])=>(
              <div key={q} style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12,padding:"20px 16px",borderLeft:"2px solid rgba(201,149,108,.25)"}}>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontStyle:"italic",color:"rgba(240,217,204,.8)",marginBottom:10,lineHeight:1.5}}>{q}</div>
                <div style={{fontSize:14,fontWeight:700,color:"#c9956c",marginBottom:3}}>{r}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>{s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* GARANTIA */}
      <div style={{borderTop:"1px solid rgba(255,255,255,.05)",padding:"56px 0",background:"rgba(201,149,108,.02)"}}>
        <div style={{...S.wrap,textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:16}}>🛡️</div>
          <div style={{fontSize:9,color:"rgba(201,149,108,.4)",letterSpacing:4,textTransform:"uppercase",marginBottom:12}}>garantia total</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:700,color:"rgba(240,217,204,.9)",fontStyle:"italic",lineHeight:1.1,marginBottom:16}}>
            30 dias.<br/>Resultado ou devolvo.
          </div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.4)",lineHeight:1.8,marginBottom:28}}>
            Se o Ritual não trouxer nenhuma paciente de volta em 30 dias —<br/>
            <strong style={{color:"#f0d9cc"}}>devolvo o setup inteiro. Sem pergunta.</strong>
          </div>
          <button style={S.btn} onClick={()=>{setFase("form");fbTrack("ViewContent",{content_name:"Diagnóstico CTA Garantia"});}}>
            Ver diagnóstico gratuito →
          </button>
          <div style={{textAlign:"center",marginTop:10,fontSize:11,color:"rgba(255,255,255,.2)"}}>3 minutos · sem compromisso</div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{borderTop:"1px solid rgba(255,255,255,.04)",padding:"32px 0",textAlign:"center"}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontStyle:"italic",color:"rgba(201,149,108,.3)",marginBottom:6}}>ritual</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,.15)",letterSpacing:2}}>by wylvex · wylvex.tech</div>
      </div>
    </div>
  );

  /* ── FORM / DIAGNÓSTICO ── */
  if(fase==="form")return(
    <div ref={topo} style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=Plus+Jakarta+Sans:wght@300;400;600;700&display=swap" rel="stylesheet"/>
      <style>{GS}</style>
      <div className="lp-wrap" style={{...S.wrap,paddingTop:48,paddingBottom:80}}>
        {/* Progress */}
        <div style={{display:"flex",gap:5,marginBottom:32}}>
          {ETAPAS.map((_,i)=>(
            <div key={i} style={{flex:1,height:3,borderRadius:2,background:i<=step?"#c9956c":"rgba(255,255,255,.06)",transition:"background .3s"}}/>
          ))}
        </div>
        <div style={{animation:"fadeUp .4s ease both"}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:700,color:"#f0d9cc",marginBottom:8,lineHeight:1.2}}>{etapa.titulo}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.35)",marginBottom:24}}>{etapa.sub}</div>
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
          {etapa.tipo==="cards"&&(
            <div style={{display:"flex",flexDirection:"column",gap:9}}>
              {etapa.ops.map(op=>(
                <button key={op.l} onClick={()=>{setRes(p=>({...p,[etapa.id]:op.v||op.l}));setTimeout(()=>goNext(op.v||op.l,etapa.id),150);}}
                  style={{background:"rgba(255,255,255,.03)",border:"1.5px solid rgba(255,255,255,.08)",borderRadius:10,padding:"14px 16px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10,color:"rgba(240,217,204,.75)",fontSize:14,transition:"all .15s"}}>
                  {op.ic&&<span style={{fontSize:20}}>{op.ic}</span>}
                  {op.l}
                </button>
              ))}
            </div>
          )}
          {etapa.tipo==="form"&&(
            <div>
              <div style={{background:"rgba(201,149,108,.05)",border:"1px solid rgba(201,149,108,.12)",borderRadius:12,padding:"16px 14px",marginBottom:20,textAlign:"center"}}>
                <div style={{fontSize:11,color:"rgba(201,149,108,.5)",marginBottom:4}}>Sua perda estimada</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontWeight:700,color:"#c9956c",fontStyle:"italic"}}>R$ {perda.toLocaleString("pt-BR")}<span style={{fontSize:16,color:"rgba(201,149,108,.5)"}}>/mês</span></div>
              </div>
              <input type="text" autoComplete="name" style={S.inp} placeholder="Seu nome" value={form.nome} onChange={e=>setForm(p=>({...p,nome:e.target.value}))}/>
              <input type="text" style={S.inp} placeholder="Nome da clínica" value={form.clinica} onChange={e=>setForm(p=>({...p,clinica:e.target.value}))}/>
              <input type="tel" autoComplete="tel" style={{...S.inp}} placeholder="WhatsApp (com DDD)" value={form.whatsapp} onChange={e=>setForm(p=>({...p,whatsapp:e.target.value}))} type="tel"/>
              <input style={S.inp} placeholder="Email (opcional)" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} type="email"/>
              <button style={{...S.btn,opacity:loading?.7:1}} onClick={submit} disabled={loading}>
                {loading?"Calculando...":"Ver diagnóstico e agendar demo →"}
              </button>
              <p style={{fontSize:10,color:"rgba(255,255,255,.2)",textAlign:"center",marginTop:10}}>Seus dados são confidenciais e não serão compartilhados.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  /* ── RESULTADO ── */
  return(
    <div ref={topo} style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=Plus+Jakarta+Sans:wght@300;400;600;700&display=swap" rel="stylesheet"/>
      <style>{GS}</style>
      <div className="lp-wrap" style={{...S.wrap,paddingTop:48,paddingBottom:80}}>
        <div style={{animation:"fadeUp .5s ease both"}}>
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,fontStyle:"italic",color:"rgba(240,217,204,.6)",letterSpacing:2}}>ritual</div>
          </div>
          <div style={{background:"rgba(201,149,108,.05)",border:"1px solid rgba(201,149,108,.15)",borderRadius:14,padding:"22px 18px",marginBottom:20,textAlign:"center"}}>
            <div style={{fontSize:10,color:"rgba(201,149,108,.5)",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Perda estimada</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:46,fontWeight:700,color:"#c9956c",fontStyle:"italic"}}>R$ {perda.toLocaleString("pt-BR")}<span style={{fontSize:18,color:"rgba(201,149,108,.5)"}}>/mês</span></div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginTop:6}}>em pacientes que somem antes do retorno</div>
          </div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.5)",lineHeight:1.75,marginBottom:24,textAlign:"center"}}>
            <strong style={{color:"#f0d9cc"}}>{(savedLead?.nome||"").split(" ")[0]}</strong>, nossa equipe entra em contato pelo WhatsApp em breve.<br/>Enquanto isso, escolha um horário para a demonstração:
          </div>
          <div style={{marginBottom:28}}>
            <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,.6)",marginBottom:12}}>📅 Agendar demonstração gratuita</div>
            <Agendador leadData={savedLead}/>
          </div>
          <div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12,padding:"18px 16px"}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,.25)",letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>O que acontece agora</div>
            {[["📱","WhatsApp em breve","Nossa equipe entra em contato para confirmar"],["🎯","Demo de 30min","Mostramos o Ritual com os dados da sua clínica"],["🛡️","30 dias de garantia","Resultado ou devolução total do setup"]].map(([ic,t,d])=>(
              <div key={t} style={{display:"flex",gap:12,marginBottom:12,alignItems:"flex-start"}}>
                <div style={{fontSize:20,flexShrink:0}}>{ic}</div>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"#f0d9cc"}}>{t}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
