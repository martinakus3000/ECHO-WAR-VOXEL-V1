"use client";

import { useEffect, useRef, useState } from "react";

type Screen = "menu" | "briefing" | "playing" | "dead" | "won";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<{ start: () => void; reset: () => void; destroy: () => void } | null>(null);
  const [screen, setScreen] = useState<Screen>("menu");
  const [run, setRun] = useState(1);
  const [echoes, setEchoes] = useState(0);
  const [status, setStatus] = useState("Infiltra't al nucli temporal");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    engineRef.current = createGame(canvas, {
      onDeath: (nextRun, echoCount) => { setRun(nextRun); setEchoes(echoCount); setScreen("dead"); },
      onWin: () => setScreen("won"),
      onStatus: setStatus,
    });
    return () => engineRef.current?.destroy();
  }, []);

  const begin = () => { setScreen("playing"); setTimeout(() => engineRef.current?.start(), 30); };
  const retry = () => { setScreen("playing"); setTimeout(() => engineRef.current?.reset(), 30); };

  return (
    <main className="game-shell">
      <canvas ref={canvasRef} id="game" tabIndex={0} aria-label="ECHO WAR, joc d'acció en primera persona" />
      <div className="scanlines" />
      {screen === "playing" && <div className="mission"><span>RUN {String(run).padStart(2,"0")}</span><b>{status}</b><em>{echoes} ecos actius</em></div>}

      {screen === "menu" && <section className="overlay hero">
        <div className="kicker">ANOMALIA T-09 · BUILD 0.1</div>
        <h1>ECHO<span>//</span>WAR</h1>
        <p className="tagline">LA MORT NO ÉS UN REINICI.<br/>ÉS UN ALTRE MOVIMENT A LA LÍNIA TEMPORAL.</p>
        <div className="menu-actions">
          <button onClick={() => setScreen("briefing")}>INICIAR INCURSIÓ <i>↗</i></button>
          <button className="ghost" onClick={() => setScreen("briefing")}>COM CONTROLO EL TEMPS?</button>
        </div>
        <div className="footer-line"><span>FPS ROGUELIKE</span><span>BUCLE DETERMINISTA</span><span>PROTOTIP JUGABLE</span></div>
      </section>}

      {screen === "briefing" && <section className="overlay briefing">
        <div className="panel-code">ORDRE D'OPERACIONS // 09</div>
        <h2>ENTRA. APRÈN.<br/><span>REESCRIU LA BATALLA.</span></h2>
        <p>Arriba al nucli cyan abans que s'esgoti el temps. Si caus, la teva ruta queda gravada: a la pròxima incursió, un eco hologràfic repetirà exactament els teus moviments i dispars.</p>
        <div className="controls">
          <div><kbd>W A S D</kbd><span>Moure's</span></div><div><kbd>RATOLÍ</kbd><span>Mirar</span></div>
          <div><kbd>CLIC</kbd><span>Disparar</span></div><div><kbd>SHIFT</kbd><span>Esprintar</span></div>
          <div><kbd>R</kbd><span>Recarregar</span></div><div><kbd>1 · 2 · 3</kbd><span>Canviar arma</span></div>
        </div>
        <button onClick={begin}>DESPLEGAR <i>→</i></button>
        <small>Fes clic al joc per capturar el ratolí · ESC per alliberar-lo</small>
      </section>}

      {screen === "dead" && <section className="overlay result death">
        <div className="glitch">LÍNIA TEMPORAL COL·LAPSADA</div><h2>HAS CAIGUT.<br/><span>PERÒ ENCARA ETS AQUÍ.</span></h2>
        <p>La incursió anterior ara lluitarà al teu costat. Utilitza el teu eco com a distracció i prova una ruta diferent.</p>
        <div className="run-stat"><b>{String(echoes).padStart(2,"0")}</b><span>ECOS GRAVATS</span></div>
        <button onClick={retry}>REPETIR LÍNIA TEMPORAL <i>↻</i></button>
      </section>}

      {screen === "won" && <section className="overlay result victory">
        <div className="panel-code">CAUSALITAT TRENCADA</div><h2>NUCLI<br/><span>ASSEGURAT.</span></h2>
        <p>Has convertit els teus errors en una esquadra. Aquesta és només la primera cambra de l'anomalia.</p>
        <button onClick={() => location.reload()}>NOVA OPERACIÓ <i>→</i></button>
      </section>}
    </main>
  );
}

type Hooks = { onDeath:(run:number, echoes:number)=>void; onWin:()=>void; onStatus:(s:string)=>void };
type Vec = {x:number;y:number};
type Frame = Vec & {a:number; fire:boolean; t:number};
type Enemy = Vec & {hp:number; alive:boolean; cooldown:number; hit:number};

function createGame(canvas: HTMLCanvasElement, hooks: Hooks) {
  const ctx = canvas.getContext("2d")!;
  const map = [
    "111111111111111111",
    "100000000000000001",
    "102220011110022001",
    "100000010000000001",
    "100110010011110001",
    "100100000010000001",
    "100100110010011101",
    "100000100000010001",
    "101110100111010001",
    "100000000100000001",
    "100111100100111001",
    "100000000000000001",
    "100001111110000001",
    "100000000000000001",
    "111111111111111111",
  ];
  const spawnPoint = {x:2.5,y:12.5,a:-Math.PI/2};
  let player={...spawnPoint,hp:100,ammo:18,reserve:72,pulse:100};
  let enemies:Enemy[]=[]; let recordings:Frame[][]=[]; let current:Frame[]=[];
  let keys:Record<string,boolean>={}; let active=false; let raf=0; let last=0; let begun=0; let run=1;
  let muzzle=0; let hurt=0; let shake=0; let kills=0; let timeLeft=90; let reload=0; let pulseFx=0; let weapon=0;
  const weapons=[{name:"BALLESTA",damage:2,mag:8,color:"#b8c5ca"},{name:"ARC RÀPID",damage:1,mag:24,color:"#e2ac4f"},{name:"CANÓ DE BLOC",damage:3,mag:5,color:"#8c65bc"}];
  const FOV=Math.PI/3; const goal={x:15.4,y:2.4};

  function resize(){ canvas.width=innerWidth*devicePixelRatio; canvas.height=innerHeight*devicePixelRatio; }
  const wall=(x:number,y:number)=> map[Math.floor(y)]?.[Math.floor(x)] !== "0";
  const spawn=()=> enemies=[{x:4.5,y:11.5,hp:2,alive:true,cooldown:1,hit:0},{x:6.5,y:9.5,hp:2,alive:true,cooldown:1,hit:0},{x:9.5,y:11.5,hp:2,alive:true,cooldown:1,hit:0},{x:10.5,y:8.5,hp:3,alive:true,cooldown:1,hit:0},{x:14.5,y:7.5,hp:2,alive:true,cooldown:1,hit:0},{x:12.5,y:5.5,hp:3,alive:true,cooldown:1,hit:0},{x:14.5,y:3.5,hp:3,alive:true,cooldown:1,hit:0},{x:13.5,y:2.5,hp:4,alive:true,cooldown:1,hit:0}];
  function lineClear(a:Vec,b:Vec){const d=Math.hypot(b.x-a.x,b.y-a.y), n=Math.ceil(d*8);for(let i=1;i<n;i++){const q=i/n;if(wall(a.x+(b.x-a.x)*q,a.y+(b.y-a.y)*q))return false;}return true;}

  function shoot(x=player.x,y=player.y,a=player.a,echo=false){
    if(!echo){ if(reload>0||player.ammo<=0){if(player.ammo<=0) startReload();return;} player.ammo--; muzzle=.09; shake=7; }
    let best:Enemy|undefined, bestD=99;
    for(const e of enemies) if(e.alive){const d=Math.hypot(e.x-x,e.y-y), da=Math.abs(angle(Math.atan2(e.y-y,e.x-x)-a)); if(da<.07+.12/d&&d<bestD&&lineClear({x,y},e)){best=e;bestD=d;}}
    if(best){best.hp-=echo?1:weapons[weapon].damage;best.hit=.16;if(best.hp<=0){best.alive=false;kills++;hooks.onStatus(kills>=5?"Accedeix al portal morat":"Bot eliminat · continua avançant");}}
  }
  function startReload(){const mag=weapons[weapon].mag;if(reload<=0&&player.ammo<mag&&player.reserve>0)reload=1.1;}
  function damage(n:number){player.hp-=n;hurt=.35;shake=12;if(player.hp<=0) die();}
  function die(){if(!active)return;active=false;document.exitPointerLock?.();if(current.length>10)recordings.push(current);run++;hooks.onDeath(run,recordings.length);}

  function reset(){ weapon=0;player={...spawnPoint,hp:100,ammo:weapons[0].mag,reserve:72,pulse:100};current=[];kills=0;timeLeft=90;reload=0;pulseFx=0;spawn();active=true;begun=performance.now();last=performance.now();canvas.focus();raf=requestAnimationFrame(loop); }
  function start(){recordings=[];run=1;reset();}
  function update(dt:number,now:number){
    timeLeft-=dt;if(timeLeft<=0){die();return;} if(reload>0){reload-=dt;if(reload<=0){const n=Math.min(weapons[weapon].mag-player.ammo,player.reserve);player.ammo+=n;player.reserve-=n;}}
    player.pulse=Math.min(100,player.pulse+dt*5);muzzle=Math.max(0,muzzle-dt);hurt=Math.max(0,hurt-dt);pulseFx=Math.max(0,pulseFx-dt);shake*=.84;
    let speed=(keys.ShiftLeft||keys.ShiftRight)?3.5:2.25; let dx=0,dy=0;
    if(keys.KeyW||keys.ArrowUp){dx+=Math.cos(player.a)*speed*dt;dy+=Math.sin(player.a)*speed*dt}if(keys.KeyS||keys.ArrowDown){dx-=Math.cos(player.a)*speed*dt;dy-=Math.sin(player.a)*speed*dt}
    if(keys.KeyA||keys.ArrowLeft){dx+=Math.cos(player.a-Math.PI/2)*speed*dt;dy+=Math.sin(player.a-Math.PI/2)*speed*dt}if(keys.KeyD||keys.ArrowRight){dx+=Math.cos(player.a+Math.PI/2)*speed*dt;dy+=Math.sin(player.a+Math.PI/2)*speed*dt}
    if(!wall(player.x+dx,player.y))player.x+=dx;if(!wall(player.x,player.y+dy))player.y+=dy;
    const elapsed=now-begun; if(current.length===0||elapsed-current[current.length-1].t>55)current.push({x:player.x,y:player.y,a:player.a,fire:false,t:elapsed});
    recordings.forEach(rec=>{const i=findFrame(rec,elapsed);const f=rec[i];if(f?.fire&&(!rec[i-1]||!rec[i-1].fire))shoot(f.x,f.y,f.a,true);});
    for(const e of enemies)if(e.alive){e.hit=Math.max(0,e.hit-dt);e.cooldown-=dt;const d=Math.hypot(player.x-e.x,player.y-e.y);if(d<8&&lineClear(e,player)){if(d>2.6){const vx=(player.x-e.x)/d*.55*dt,vy=(player.y-e.y)/d*.55*dt;if(!wall(e.x+vx,e.y))e.x+=vx;if(!wall(e.x,e.y+vy))e.y+=vy;}if(e.cooldown<=0){e.cooldown=.75+Math.random()*.7;if(Math.random()<.58)damage(7+Math.random()*5);}}}
    if(Math.hypot(player.x-goal.x,player.y-goal.y)<.75&&kills>=5){active=false;document.exitPointerLock?.();hooks.onWin();}
  }

  function render(now:number){
    const W=canvas.width,H=canvas.height;ctx.imageSmoothingEnabled=false;ctx.fillStyle="#78b9ee";ctx.fillRect(0,0,W,H*.53);const px=24*devicePixelRatio;ctx.fillStyle="#eaf7ff";for(let c=0;c<6;c++){const cx=((c*293+performance.now()*.002)%1400)/1400*W,cy=(.09+(c%3)*.1)*H;ctx.fillRect(cx,cy,px*4,px);ctx.fillRect(cx+px,cy-px,px*2,px);ctx.fillRect(cx+px*3,cy+px,px*2,px);}ctx.fillStyle="#5f9f3f";ctx.fillRect(0,H*.5,W,H*.5);for(let y=H*.53;y<H;y+=32*devicePixelRatio){ctx.fillStyle=y%64<10?"rgba(35,87,38,.28)":"rgba(121,165,65,.12)";ctx.fillRect(0,y,W,2*devicePixelRatio);}for(let x=0;x<W;x+=64*devicePixelRatio){ctx.fillStyle="rgba(45,78,35,.12)";ctx.fillRect(x,H*.5,2*devicePixelRatio,H*.5);}
    const rays=Math.min(420,Math.floor(W/4)),col=W/rays,depths:number[]=[];for(let i=0;i<rays;i++){const ra=player.a-FOV/2+(i/rays)*FOV;let d=0,hit="1";while(d<20){d+=.04;const x=player.x+Math.cos(ra)*d,y=player.y+Math.sin(ra)*d;if(wall(x,y)){hit=map[Math.floor(y)][Math.floor(x)];break;}}d*=Math.cos(ra-player.a);depths[i]=d;const h=Math.min(H,H/(d*.72)),shade=Math.max(45,190-d*8);ctx.fillStyle=hit==="2"?`rgb(${shade*.2},${shade*.75},${shade*.72})`:`rgb(${shade*.62},${shade*.61},${shade*.56})`;ctx.fillRect(i*col,(H-h)/2,col+1,h);const blockH=Math.max(8*devicePixelRatio,h/7);for(let by=(H-h)/2;by<(H+h)/2;by+=blockH){ctx.fillStyle="rgba(25,30,24,.16)";ctx.fillRect(i*col,by,col+1,2*devicePixelRatio);}if(i%18===0){ctx.fillStyle="rgba(255,255,255,.12)";ctx.fillRect(i*col,(H-h)/2,2*devicePixelRatio,h);}if(hit==="2"){ctx.fillStyle="rgba(70,255,230,.45)";ctx.fillRect(i*col,(H-h)/2,col*.35,h);}}
    const sprites:{x:number;y:number;color:string;kind:string;hp?:number}[]=[];enemies.forEach(e=>e.alive&&sprites.push({...e,color:e.hit>0?"#ffffff":"#52a83d",kind:"enemy",hp:e.hp}));recordings.forEach(rec=>{const f=rec[findFrame(rec,now-begun)];if(f)sprites.push({...f,color:"#62ecff",kind:"echo"});});sprites.push({...goal,color:"#b66cff",kind:"goal"});
    sprites.sort((a,b)=>Math.hypot(b.x-player.x,b.y-player.y)-Math.hypot(a.x-player.x,a.y-player.y));for(const s of sprites){const d=Math.hypot(s.x-player.x,s.y-player.y),ang=angle(Math.atan2(s.y-player.y,s.x-player.x)-player.a);if(Math.abs(ang)>FOV*.7||d<.2)continue;const sx=(.5+ang/FOV)*W,sz=Math.min(H*.8,H/(d*.82));const ri=Math.floor(sx/col);if(depths[ri]&&depths[ri]<d*.88)continue;ctx.save();ctx.globalAlpha=s.kind==="echo"?.45:1;ctx.shadowBlur=s.kind==="goal"?35:16;ctx.shadowColor=s.color;ctx.fillStyle=s.color;if(s.kind==="goal"){ctx.fillRect(sx-sz*.08,H/2-sz*.55,sz*.16,sz*.6);ctx.beginPath();ctx.arc(sx,H/2-sz*.55,sz*.16,0,Math.PI*2);ctx.fill();}else{ctx.fillRect(sx-sz*.12,H/2-sz*.42,sz*.24,sz*.48);ctx.beginPath();ctx.arc(sx,H/2-sz*.53,sz*.1,0,Math.PI*2);ctx.fill();ctx.fillRect(sx-sz*.25,H/2-sz*.35,sz*.5,sz*.07);if(s.kind==="echo"){ctx.strokeStyle="#b9fbff";for(let j=0;j<4;j++){ctx.globalAlpha=.12;ctx.strokeRect(sx-sz*.15-j*3,H/2-sz*.65+j*8,sz*.3+j*6,sz*.75);}}}ctx.restore();}
    drawWeapon(W,H);drawHud(W,H);if(hurt){ctx.fillStyle=`rgba(255,20,10,${hurt*.55})`;ctx.fillRect(0,0,W,H);}if(pulseFx){ctx.strokeStyle=`rgba(80,240,255,${pulseFx})`;ctx.lineWidth=12;ctx.beginPath();ctx.arc(W/2,H/2,(1-pulseFx)*W*.7,0,Math.PI*2);ctx.stroke();}
  }
  function drawWeapon(W:number,H:number){const d=devicePixelRatio,bob=Math.sin(performance.now()*.009)*4*d,ox=shake*(Math.random()-.5),w=weapons[weapon];ctx.save();ctx.translate(W*.5+ox,H+bob);ctx.imageSmoothingEnabled=false;ctx.fillStyle="#6f421f";ctx.fillRect(-W*.025,-H*.17,W*.065,H*.18);ctx.fillStyle=weapon===2?"#4d3b57":"#8b5a2b";ctx.fillRect(-W*.08,-H*.23,W*(weapon===1?.18:.21),H*.065);ctx.fillStyle=w.color;ctx.fillRect(-W*.055,-H*.255,W*(weapon===2?.21:.17),H*(weapon===2?.065:.045));ctx.fillStyle="#35434a";ctx.fillRect(W*.095,-H*.235,W*.055,H*.025);ctx.fillStyle=weapon===1?"#ffd84a":"#35e8ff";ctx.fillRect(W*.03,-H*.245,W*.02,H*.02);if(muzzle){ctx.fillStyle="#fff28a";ctx.fillRect(W*.14,-H*.265,H*.09*muzzle/.09,H*.09*muzzle/.09);}ctx.restore();}
  function drawHud(W:number,H:number){const d=devicePixelRatio;ctx.save();ctx.imageSmoothingEnabled=false;ctx.strokeStyle="#171717";ctx.lineWidth=2*d;ctx.strokeRect(W/2-7*d,H/2-7*d,14*d,14*d);ctx.fillStyle="#fff";ctx.fillRect(W/2-1*d,H/2-6*d,2*d,12*d);ctx.fillRect(W/2-6*d,H/2-1*d,12*d,2*d);const hearts=Math.ceil(player.hp/10);ctx.font=`bold ${20*d}px monospace`;for(let i=0;i<10;i++){ctx.fillStyle=i<hearts?"#e3262e":"#4a2626";ctx.fillText("♥",W/2-110*d+i*22*d,H-62*d);}const slot=42*d,total=slot*5;for(let i=0;i<5;i++){ctx.fillStyle=i===weapon?"#e8e8e8":"#777";ctx.fillRect(W/2-total/2+i*slot,H-51*d,slot-3*d,slot-3*d);ctx.strokeStyle="#202020";ctx.lineWidth=(i===weapon?4:2)*d;ctx.strokeRect(W/2-total/2+i*slot,H-51*d,slot-3*d,slot-3*d);}for(let i=0;i<3;i++){ctx.fillStyle=weapons[i].color;ctx.fillRect(W/2-total/2+i*slot+8*d,H-42*d,24*d,18*d);ctx.fillStyle="#222";ctx.font=`bold ${10*d}px monospace`;ctx.fillText(String(i+1),W/2-total/2+i*slot+3*d,H-17*d);}ctx.font=`bold ${14*d}px monospace`;ctx.fillStyle="#fff";ctx.textAlign="right";ctx.fillText(`${player.ammo}/${player.reserve}`,W/2+total/2,H-15*d);ctx.fillStyle=timeLeft<15?"#ff4040":"#fff";ctx.fillText(`T-${Math.ceil(timeLeft)}`,W-24*d,34*d);ctx.textAlign="left";ctx.fillStyle="#65efff";ctx.fillText(`BOTS: ${enemies.filter(e=>e.alive).length}  ECOS: ${recordings.length}`,24*d,34*d);ctx.textAlign="center";ctx.fillStyle="#ffff55";ctx.fillText(weapons[weapon].name,W/2,H-76*d);if(reload>0){ctx.fillStyle="#fff";ctx.fillText("RECARREGANT...",W/2,H*.7);}ctx.restore();}
  function loop(now:number){if(!active)return;const dt=Math.min(.035,(now-last)/1000||.016);last=now;update(dt,now);render(now);raf=requestAnimationFrame(loop);}
  function mouse(e:MouseEvent){if(active&&document.pointerLockElement===canvas)player.a+=e.movementX*.0022;}
  function down(e:KeyboardEvent){if(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();keys[e.code]=true;if(e.code==="KeyR")startReload();if(e.code==="Digit1"||e.code==="Digit2"||e.code==="Digit3"){weapon=Number(e.code.at(-1))-1;player.ammo=Math.min(player.ammo,weapons[weapon].mag);hooks.onStatus(`Arma: ${weapons[weapon].name}`);}if(e.code==="KeyE"&&player.pulse>=100){player.pulse=0;pulseFx=1;enemies.forEach(x=>{if(x.alive&&Math.hypot(x.x-player.x,x.y-player.y)<5){x.hit=.5;x.cooldown+=3;}});}}
  function up(e:KeyboardEvent){keys[e.code]=false;}
  function click(){if(!active)return;if(document.pointerLockElement!==canvas){canvas.requestPointerLock?.();return;}shoot();const f=current[current.length-1];if(f)f.fire=true;}
  addEventListener("resize",resize);addEventListener("mousemove",mouse);addEventListener("keydown",down);addEventListener("keyup",up);canvas.addEventListener("mousedown",click);resize();spawn();render(performance.now());
  return {start,reset,destroy(){active=false;cancelAnimationFrame(raf);removeEventListener("resize",resize);removeEventListener("mousemove",mouse);removeEventListener("keydown",down);removeEventListener("keyup",up);canvas.removeEventListener("mousedown",click);}};
}
function angle(a:number){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;}
function findFrame(rec:Frame[],t:number){let lo=0,hi=rec.length-1;while(lo<hi){const m=Math.ceil((lo+hi)/2);if(rec[m].t<=t)lo=m;else hi=m-1;}return lo;}
