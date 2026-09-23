const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output', 'm1-visual-candidate-v0.3');
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const pageHtml = String.raw`<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#cbd5dc;font-family:Arial,sans-serif}
  canvas{display:block}
</style></head><body>
<canvas id="agents" width="480" height="432"></canvas>
<canvas id="props" width="960" height="512"></canvas>
<canvas id="desktop" width="1440" height="900"></canvas>
<canvas id="mobile" width="390" height="844"></canvas>
<script>
const agents = document.querySelector('#agents');
const props = document.querySelector('#props');
const desktop = document.querySelector('#desktop');
const mobile = document.querySelector('#mobile');
for (const canvas of [agents, props, desktop, mobile]) canvas.getContext('2d').imageSmoothingEnabled = false;

const agentFrames = [];
const propFrames = [];
const roles = ['pm','developer','tester'];
const directions = ['NE','SE','SW','NW'];
const states = ['idle','walk1','walk2','sit','work'];
const rolePalette = {
  pm:{coat:'#2876bd',coatHi:'#55a5e1',coatDark:'#164569',accent:'#f2f5ec',hair:'#14242d',skin:'#e2a271',shoe:'#2b241f'},
  developer:{coat:'#26864b',coatHi:'#55ba72',coatDark:'#155632',accent:'#49d2e5',hair:'#16252d',skin:'#d99a69',shoe:'#24313a'},
  tester:{coat:'#e59a27',coatHi:'#ffc45a',coatDark:'#915617',accent:'#4d9e65',hair:'#2a211f',skin:'#8f512f',shoe:'#2a2928'}
};

function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function pixelDiamond(c,cx,cy,w,h,fill,outline){
  const halfH=Math.floor(h/2);
  if(outline){
    for(let iy=-halfH;iy<=halfH;iy++){
      const span=Math.floor((1-Math.abs(iy)/Math.max(1,halfH))*w/2);
      rect(c,cx-span-1,cy+iy,span*2+2,1,outline);
    }
  }
  for(let iy=-halfH+1;iy<halfH;iy++){
    const span=Math.floor((1-Math.abs(iy)/Math.max(1,halfH))*w/2)-1;
    if(span>0) rect(c,cx-span,cy+iy,span*2,1,fill);
  }
}
function agentBase(c, role, direction, state){
  const p=rolePalette[role];
  const west=direction==='NW'||direction==='SW';
  const back=direction==='NW'||direction==='NE';
  const seated=state==='sit'||state==='work';
  const working=state==='work';
  const walking=state==='walk1'||state==='walk2';
  const phase=state==='walk2'?-1:1;
  c.save();
  if(west){c.translate(24,0);c.scale(-1,1);}
  pixelDiamond(c,12,34,12,4,'rgba(29,48,55,.25)','rgba(29,48,55,.08)');
  const bob=walking&&state==='walk2'?1:0;
  const hip=seated?27:25+bob;
  if(seated){
    rect(c,5,26,6,5,'#263948');rect(c,13,26,6,5,'#263948');
    rect(c,5,30,7,3,p.shoe);rect(c,15,30,6,3,p.shoe);
  }else{
    rect(c,6+(walking?phase:0),hip,5,7,'#263948');
    rect(c,13-(walking?phase:0),hip,5,7,'#263948');
    rect(c,4+(walking?phase:0),31,7,3,p.shoe);
    rect(c,13-(walking?phase:0),31,7,3,p.shoe);
    rect(c,5+(walking?phase:0),31,5,1,'#71808a');
    rect(c,14-(walking?phase:0),31,5,1,'#71808a');
  }
  const torsoY=(seated?18:17)+bob;
  rect(c,5,torsoY,14,seated?10:11,p.coatDark);
  rect(c,6,torsoY,12,seated?9:10,p.coat);
  rect(c,7,torsoY+1,2,8,p.coatHi);
  if(role==='pm'){
    rect(c,10,torsoY,5,9,p.accent);rect(c,12,torsoY+1,1,7,'#d34c42');
    rect(c,3,torsoY+4,3,7,'#d8e5e7');rect(c,3,torsoY+5,2,4,'#638ba0');
  }else if(role==='developer'){
    rect(c,11,torsoY+1,1,8,'#dcf4e2');rect(c,13,torsoY+2,1,7,'#dcf4e2');
    rect(c,7,torsoY+2,2,1,p.accent);
  }else{
    rect(c,10,torsoY+1,5,2,'#ffe2a0');rect(c,13,torsoY+4,2,2,p.accent);
    rect(c,11,torsoY+3,1,5,'#f4eee0');
  }
  const armY=torsoY+2;
  if(working){
    rect(c,2,armY,4,3,p.coatDark);rect(c,18,armY,4,3,p.coatDark);
    rect(c,1,armY+2,7,2,p.skin);rect(c,16,armY+2,7,2,p.skin);
  }else{
    const swing=walking?phase:0;
    rect(c,3,armY+swing,3,8,p.coatDark);rect(c,18,armY-swing,3,8,p.coatDark);
    rect(c,3,armY+7+swing,3,2,p.skin);rect(c,18,armY+7-swing,3,2,p.skin);
  }
  const headY=(seated?7:6)+bob;
  rect(c,6,headY+3,12,10,'#9d623f');
  rect(c,7,headY+3,10,9,p.skin);rect(c,8,headY+4,3,1,'#f3c091');
  rect(c,5,headY,14,5,p.hair);rect(c,6,headY-1,11,2,p.hair);
  rect(c,5,headY+4,3,5,p.hair);if(back)rect(c,15,headY+3,4,7,p.hair);
  if(!back){rect(c,9,headY+6,1,1,'#17252b');rect(c,15,headY+6,1,1,'#17252b');rect(c,12,headY+9,3,1,'#8b4c39');}
  if(role==='pm'){
    rect(c,4,headY+4,2,7,'#275f87');rect(c,4,headY+6,1,3,'#71b9e7');
  }else if(role==='developer'){
    rect(c,4,headY+3,2,7,p.accent);rect(c,18,headY+3,2,7,p.accent);
    rect(c,5,headY+2,2,1,p.accent);rect(c,7,headY+1,9,1,p.accent);
    rect(c,19,headY+8,3,1,p.accent);
  }else{
    rect(c,9,headY-4,8,4,'#4b352d');rect(c,11,headY-6,6,3,'#4b352d');
    rect(c,10,headY-5,4,1,'#765142');
  }
  if(role==='tester'&&working){rect(c,19,armY,4,5,'#f3f5ea');rect(c,20,armY+1,2,1,'#55a46e');}
  c.restore();
}

const ac=agents.getContext('2d');
let agentIndex=0;
for(const role of roles)for(const direction of directions)for(const state of states){
  const x=(agentIndex%10)*48,y=Math.floor(agentIndex/10)*72;
  ac.save();ac.translate(x,y);ac.scale(2,2);agentBase(ac,role,direction,state);ac.restore();
  agentFrames.push({id:role+'-'+state+'-'+direction,x,y,width:48,height:72,pivotX:24,pivotY:68,kind:'agent'});
  agentIndex++;
}

const pc=props.getContext('2d');
let propIndex=0;
function prop(id,kind,draw){
  const x=(propIndex%5)*192,y=Math.floor(propIndex/5)*128;
  pc.save();pc.translate(x,y);pc.scale(2,2);draw(pc);pc.restore();
  propFrames.push({id,x,y,width:192,height:128,pivotX:96,pivotY:120,kind});propIndex++;
}
function isoTop(c,cx,cy,w,h,fill,edge='#263c45'){
  c.fillStyle=fill;c.strokeStyle=edge;c.lineWidth=1;
  c.beginPath();c.moveTo(cx,cy-h/2);c.lineTo(cx+w/2,cy);c.lineTo(cx,cy+h/2);c.lineTo(cx-w/2,cy);c.closePath();c.fill();c.stroke();
}
function deskAssembly(c,variant='work'){
  rect(c,14,49,70,3,'rgba(29,40,42,.18)');
  isoTop(c,48,38,72,24,'#b96f35','#3d3029');
  rect(c,13,38,70,4,'#7d4526');rect(c,16,39,64,2,'#de9650');
  rect(c,17,41,5,18,'#445660');rect(c,73,41,5,18,'#445660');
  rect(c,24,43,14,17,'#7d8e94');rect(c,26,45,10,4,'#aab7b8');rect(c,26,51,10,1,'#4c5d63');
  rect(c,57,42,14,18,'#87969b');rect(c,59,44,10,4,'#b8c3c1');rect(c,59,50,10,1,'#506168');rect(c,59,55,10,1,'#506168');
  rect(c,11,20,74,4,'#397484');rect(c,12,10,3,26,'#496b73');rect(c,82,10,3,26,'#496b73');
  rect(c,15,12,67,9,'#82b7bf');rect(c,17,13,63,2,'#bfe3e3');
  rect(c,22,16,7,3,'#f4c34c');rect(c,31,15,8,4,'#e6e0bf');rect(c,68,15,8,4,'#6cb76f');
  if(variant==='executive'){rect(c,38,42,20,17,'#6f3d25');rect(c,40,44,16,5,'#9e6239');}
}
function crt(c,dx=0,dy=0,color='#55bee0'){
  rect(c,32+dx,18+dy,31,26,'#273943');rect(c,35+dx,20+dy,25,19,'#68818d');
  rect(c,38+dx,22+dy,19,14,'#247ca3');rect(c,40+dx,24+dy,15,2,'#d7fbff');
  rect(c,40+dx,28+dy,11,1,color);rect(c,40+dx,31+dy,14,1,'#b5eff7');
  rect(c,44+dx,44+dy,8,5,'#35464f');rect(c,38+dx,49+dy,20,2,'#263840');
  rect(c,57+dx,37+dy,2,2,'#f0b73e');
}
function chair(c,dx=0,dy=0){
  rect(c,36+dx,25+dy,25,22,'#174f7e');rect(c,39+dx,27+dy,19,17,'#2d77b2');rect(c,41+dx,28+dy,3,13,'#65a6d1');
  rect(c,40+dx,47+dy,18,9,'#1f6194');rect(c,37+dx,49+dy,4,3,'#233a47');rect(c,58+dx,49+dy,4,3,'#233a47');
  rect(c,47+dx,55+dy,4,7,'#293d47');rect(c,39+dx,61+dy,20,2,'#293d47');
  rect(c,38+dx,63+dy,4,2,'#172a32');rect(c,56+dx,63+dy,4,2,'#172a32');
}

prop('floor-mint','tile',c=>{pixelDiamond(c,48,45,42,22,'#b9dcd1','#648e8c');rect(c,47,34,1,22,'#d9eee7');rect(c,27,44,42,1,'#91bbb2');});
prop('floor-blue','tile',c=>{pixelDiamond(c,48,45,42,22,'#a8cbd8','#607f91');rect(c,47,34,1,22,'#d8e9ef');rect(c,27,44,42,1,'#829fac');});
prop('wall-nw','propFront',c=>{rect(c,15,16,4,45,'#44626c');rect(c,19,21,63,39,'#327787');rect(c,20,23,61,3,'#86c6c7');rect(c,19,57,63,5,'#d4e1dd');rect(c,23,28,55,25,'#2e6a78');});
prop('wall-ne','propFront',c=>{rect(c,14,21,63,39,'#327787');rect(c,77,16,4,45,'#44626c');rect(c,15,23,61,3,'#86c6c7');rect(c,14,57,63,5,'#d4e1dd');rect(c,18,28,55,25,'#2e6a78');});
prop('desk','propBack',c=>{deskAssembly(c);});
prop('chair','propFront',c=>{chair(c);});
prop('crt','propBack',c=>{crt(c);rect(c,26,52,35,4,'#e8ece7');for(let i=0;i<8;i++)rect(c,28+i*4,53,2,1,'#77898f');rect(c,67,51,8,6,'#d9ddd6');rect(c,71,50,3,2,'#eef3ed');});
prop('meeting-table','propBack',c=>{
  rect(c,8,53,80,4,'rgba(34,44,45,.2)');rect(c,20,36,5,26,'#5f3824');rect(c,71,36,5,26,'#5f3824');
  isoTop(c,48,34,88,34,'#b96e32','#3f3027');rect(c,8,34,80,4,'#774324');rect(c,13,34,69,2,'#df9650');
  rect(c,24,29,11,4,'#f3efe0');rect(c,61,37,9,4,'#4b91ad');rect(c,46,22,5,7,'#e7c651');
});
prop('whiteboard','propBack',c=>{rect(c,15,8,67,45,'#334c55');rect(c,18,11,61,38,'#f4f6ee');rect(c,20,13,57,2,'#dfe7e4');rect(c,25,20,16,2,'#55a9c4');rect(c,25,26,31,2,'#e99255');rect(c,25,32,22,2,'#4d9f78');rect(c,25,38,38,2,'#65a7c7');rect(c,18,53,5,11,'#344a52');rect(c,75,53,5,11,'#344a52');rect(c,13,63,18,2,'#344a52');rect(c,67,63,18,2,'#344a52');});
prop('boss-console','propBack',c=>{deskAssembly(c,'executive');crt(c,-14,-1,'#83d8e8');crt(c,17,-1,'#83d8e8');rect(c,39,53,18,4,'#e9ece5');});
prop('coffee-counter','propBack',c=>{rect(c,12,35,72,27,'#77898c');rect(c,14,37,68,22,'#a8b5b5');rect(c,10,31,76,6,'#a76135');rect(c,12,31,72,2,'#e09a51');rect(c,22,18,22,14,'#35464d');rect(c,25,21,16,8,'#6c7f83');rect(c,29,24,8,5,'#2a3032');rect(c,47,24,8,7,'#f3efe6');rect(c,57,24,6,7,'#f3efe6');rect(c,67,23,9,8,'#f3efe6');rect(c,16,41,20,16,'#87999d');rect(c,39,41,18,16,'#87999d');rect(c,60,41,20,16,'#87999d');});
prop('water-cooler','propBack',c=>{rect(c,37,27,24,34,'#d7e1df');rect(c,40,6,18,24,'#2c9dd0');rect(c,43,8,12,17,'#65c8ed');rect(c,45,9,8,5,'#bdeefa');rect(c,40,34,18,9,'#eef2ed');rect(c,43,37,5,3,'#36687b');rect(c,51,37,4,3,'#d94e49');rect(c,41,53,16,6,'#7e9297');rect(c,61,29,5,25,'#e8efeb');});
prop('plant','propFront',c=>{rect(c,39,45,20,17,'#d5cfb6');rect(c,41,47,16,12,'#efe6cc');rect(c,47,24,4,23,'#296c3f');const leaves=[[35,27,14,6],[46,19,8,17],[52,24,15,6],[37,17,9,16],[56,15,8,15],[45,12,8,14]];for(const l of leaves){rect(c,...l,'#2f954d');rect(c,l[0]+2,l[1]+1,2,Math.max(2,l[3]-2),'#65bf63');}});
prop('selection','effect',c=>{pixelDiamond(c,48,43,34,18,'rgba(76,210,74,.20)','#4bd44c');rect(c,47,31,2,3,'#d8f05d');});
prop('error-target','effect',c=>{pixelDiamond(c,48,43,34,18,'rgba(232,69,64,.18)','#e64944');rect(c,40,29,4,4,'#e64944');rect(c,52,29,4,4,'#e64944');rect(c,44,33,8,4,'#e64944');});
prop('path-dot','effect',c=>{for(let i=0;i<5;i++)pixelDiamond(c,27+i*10,48-i*4,6,3,'#63d15c','#329845');});
prop('door-open','propFront',c=>{rect(c,29,10,5,51,'#314952');rect(c,68,10,5,51,'#314952');rect(c,34,10,34,5,'#dbe4df');rect(c,35,14,4,45,'#8ac5c7');rect(c,39,15,29,43,'#9b592f');rect(c,41,17,25,35,'#b86d39');rect(c,43,20,21,12,'#74b8ca');rect(c,45,22,17,8,'#bde5e7');rect(c,62,39,3,3,'#e7c270');});

function drawAgentFrame(c,id,x,y,scale=1){const f=agentFrames.find(v=>v.id===id);c.drawImage(agents,f.x,f.y,f.width,f.height,x,y,f.width*scale,f.height*scale);}
function drawPropFrame(c,id,x,y,scale=.72){const f=propFrames.find(v=>v.id===id);c.drawImage(props,f.x,f.y,f.width,f.height,x,y,f.width*scale,f.height*scale);}
function drawIsoFloor(c,ox,oy,cols,rows){
  for(let r=0;r<rows;r++)for(let col=0;col<cols;col++){
    const x=ox+(col-r)*32,y=oy+(col+r)*16;
    c.fillStyle=(col+r)%2?'#b9d9d1':'#c3e1d9';c.strokeStyle='#99beb8';c.lineWidth=1;
    c.beginPath();c.moveTo(x,y-16);c.lineTo(x+32,y);c.lineTo(x,y+16);c.lineTo(x-32,y);c.closePath();c.fill();c.stroke();
  }
}
function panel(c,x,y,w,h,fill='#edf2f4',stroke='#9babb4'){rect(c,x,y,w,h,fill);c.strokeStyle=stroke;c.lineWidth=1;c.strokeRect(x+.5,y+.5,w-1,h-1);}
function label(c,text,x,y,size=16,color='#20303b',weight=600){c.fillStyle=color;c.font=weight+' '+size+'px Arial';c.fillText(text,x,y);}
function desktopPreview(){
  const c=desktop.getContext('2d');rect(c,0,0,1440,900,'#dde5e9');
  rect(c,0,0,1440,58,'#edf2f4');rect(c,0,57,1440,2,'#253943');label(c,'ThemeTeam',58,37,24,'#14242d',700);label(c,'OFFICE / LIVE',1195,35,14,'#2f6f48',700);
  rect(c,0,59,150,841,'#263844');const nav=[['OFFICE',110],['TEAM',166],['TASKS',222]];for(const [t,y] of nav){if(t==='OFFICE')rect(c,0,y-36,150,52,'#356ea4');label(c,t,32,y,16,'#f3f7f7',700);}
  const ox=645,oy=174;rect(c,150,59,1015,682,'#a9c8c5');drawIsoFloor(c,ox,oy,12,10);
  // glass office boundaries and meeting zone
  rect(c,250,112,560,9,'#315e68');rect(c,804,112,9,218,'#315e68');rect(c,812,112,292,9,'#315e68');rect(c,1095,112,9,278,'#315e68');
  drawPropFrame(c,'whiteboard',848,123,.92);drawPropFrame(c,'meeting-table',825,235,1.05);
  // two rich workstation islands
  drawPropFrame(c,'desk',258,270,.88);drawPropFrame(c,'crt',258,270,.88);drawPropFrame(c,'chair',258,300,.88);
  drawPropFrame(c,'desk',475,382,.88);drawPropFrame(c,'crt',475,382,.88);drawPropFrame(c,'chair',475,412,.88);
  drawPropFrame(c,'desk',660,475,.88);drawPropFrame(c,'crt',660,475,.88);drawPropFrame(c,'chair',660,505,.88);
  drawPropFrame(c,'plant',920,470,.72);drawPropFrame(c,'water-cooler',990,435,.72);
  drawPropFrame(c,'selection',516,517,.7);drawAgentFrame(c,'developer-walk1-SE',544,463,1.45);
  drawAgentFrame(c,'pm-idle-SW',760,250,1.35);drawAgentFrame(c,'tester-sit-NE',910,267,1.35);
  panel(c,1165,59,275,682,'#eef3f5');label(c,'SELECTED AGENT',1190,94,13,'#55707d',700);
  drawAgentFrame(c,'developer-idle-SE',1192,106,1.65);label(c,'Dev',1280,145,26,'#1b2b34',700);label(c,'Developer',1280,173,16,'#2f6f48',600);
  rect(c,1190,205,225,1,'#bdc9cf');label(c,'CURRENT TASK',1190,237,13,'#55707d',700);label(c,'Build feature',1190,273,19,'#1b2b34',600);
  rect(c,1190,303,225,1,'#bdc9cf');label(c,'STATE',1190,336,13,'#55707d',700);label(c,'Walking to workstation',1190,373,16,'#1b2b34',600);
  rect(c,1190,409,225,1,'#bdc9cf');label(c,'VISUAL SCALE',1190,442,13,'#55707d',700);label(c,'Character 1.45x',1190,479,16,'#1b2b34',600);label(c,'Furniture 0.88x',1190,508,16,'#1b2b34',600);
  rect(c,150,741,1290,159,'#f2f5f6');label(c,'RUNNING WORK',176,777,15,'#526b77',700);panel(c,176,793,264,82,'#ffffff');panel(c,456,793,264,82,'#ffffff');panel(c,736,793,264,82,'#ffffff');panel(c,1016,793,264,82,'#ffffff');label(c,'Build feature',192,827,17,'#1d2c35',600);label(c,'Write tests',472,827,17,'#1d2c35',600);label(c,'UI review',752,827,17,'#1d2c35',600);label(c,'Done',1032,827,17,'#1d2c35',600);
}
function mobilePreview(){
  const c=mobile.getContext('2d');rect(c,0,0,390,844,'#dfe7ea');rect(c,0,0,390,52,'#f1f5f6');label(c,'ThemeTeam',18,33,20,'#172832',700);label(c,'OFFICE',315,31,12,'#2e7048',700);
  rect(c,0,52,390,505,'#a9c8c5');drawIsoFloor(c,195,118,7,7);
  drawPropFrame(c,'desk',22,188,.62);drawPropFrame(c,'crt',22,188,.62);drawPropFrame(c,'chair',22,207,.62);
  drawPropFrame(c,'desk',190,278,.62);drawPropFrame(c,'crt',190,278,.62);drawPropFrame(c,'chair',190,297,.62);
  drawPropFrame(c,'selection',134,348,.55);drawAgentFrame(c,'developer-walk2-SE',151,308,1.2);drawAgentFrame(c,'tester-idle-SW',271,206,1.12);
  rect(c,0,540,390,304,'#f5f7f8');rect(c,166,550,58,5,'#a9b7bd');label(c,'Dev',24,596,24,'#172832',700);label(c,'Developer · walking',24,624,15,'#357650',600);drawAgentFrame(c,'developer-idle-SE',302,561,1.25);
  rect(c,24,650,342,1,'#c8d1d5');label(c,'CURRENT TASK',24,682,12,'#5b707a',700);label(c,'Build feature',24,716,18,'#172832',600);
  panel(c,24,748,342,68,'#e9f2ec','#8db19b');label(c,'Moving to workstation',44,790,16,'#285b3a',700);
}
desktopPreview();mobilePreview();
window.result={agentFrames,propFrames,agents:agents.toDataURL('image/png'),props:props.toDataURL('image/png'),desktop:desktop.toDataURL('image/png'),mobile:mobile.toDataURL('image/png')};
</script></body></html>`;

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const runtimeModules = process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
  const { chromium } = require(require.resolve('playwright', { paths: [runtimeModules] }));
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  let generated;
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
    await page.setContent(pageHtml, { waitUntil: 'load' });
    generated = await page.evaluate(() => window.result);
  } finally {
    await browser.close();
  }
  const writeDataUrl = (name, value) => fs.writeFileSync(path.join(output, name), Buffer.from(value.split(',')[1], 'base64'));
  writeDataUrl('office-agents.v0.3.png', generated.agents);
  writeDataUrl('office-props.v0.3.png', generated.props);
  writeDataUrl('runtime-closeup-desktop.png', generated.desktop);
  writeDataUrl('runtime-closeup-mobile.png', generated.mobile);

  const files = ['character-source-board.png','furniture-source-board.png','office-agents.v0.3.png','office-props.v0.3.png','runtime-closeup-desktop.png','runtime-closeup-mobile.png'];
  const manifest = {
    version: '0.3-candidate',
    status: 'awaiting-user-visual-approval-not-runtime-enabled',
    createdAt: new Date().toISOString(),
    source: {
      characterBoard: 'Built-in image generation using approved VIS-01/VIS-02/VIS-06 as style references',
      furnitureBoard: 'Built-in image generation using approved VIS-01/VIS-02/VIS-06 as style references',
      atlasesAndPreviews: 'Project-local deterministic Canvas generator; no original Theme Hospital assets imported'
    },
    runtimeAssetsModified: false,
    topologyChanged: false,
    frameGeometryChanged: true,
    proposedContract: {
      agentAtlas: { width: 480, height: 432, frameWidth: 48, frameHeight: 72, frameCount: 60 },
      propAtlas: { width: 960, height: 512, frameWidth: 192, frameHeight: 128, frameCount: 17 },
      compatibility: 'Frame IDs, role/direction/state topology and animation IDs remain stable; loader geometry, origins, display scale and prop placement require an approved v0.3 manifest change.'
    },
    files: files.map(name => ({ name, sha256: sha256(path.join(output, name)), bytes: fs.statSync(path.join(output, name)).size })),
    agentFrames: generated.agentFrames,
    propFrames: generated.propFrames,
    approvalRequiredBeforePromotion: true
  };
  fs.writeFileSync(path.join(output, 'candidate-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ output, status: manifest.status, files: manifest.files, agentFrames: generated.agentFrames.length, propFrames: generated.propFrames.length }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
