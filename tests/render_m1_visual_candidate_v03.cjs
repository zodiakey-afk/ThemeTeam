const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output', 'm1-visual-candidate-v0.3');
const runtimeModules = process.env.CODEX_NODE_MODULES || 'C:/Users/z00654528/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifestPath = path.join(output, 'candidate-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const pngData = name => `data:image/png;base64,${fs.readFileSync(path.join(output, name)).toString('base64')}`;

const html = String.raw`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#b9c5cb}canvas{display:block}</style></head><body>
<img id="agentsImg" src="${pngData('office-agents.v0.3.png')}" hidden>
<img id="propsImg" src="${pngData('office-props.v0.3.png')}" hidden>
<canvas id="characters" width="1320" height="590"></canvas>
<canvas id="furniture" width="1320" height="760"></canvas>
<canvas id="desktop" width="1440" height="900"></canvas>
<canvas id="mobile" width="390" height="844"></canvas>
<script>
const agentFrames=${JSON.stringify(manifest.agentFrames)};
const propFrames=${JSON.stringify(manifest.propFrames)};
const agentsImg=document.querySelector('#agentsImg'),propsImg=document.querySelector('#propsImg');
const canvases=['characters','furniture','desktop','mobile'].map(id=>document.querySelector('#'+id));
for(const canvas of canvases)canvas.getContext('2d').imageSmoothingEnabled=false;
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function line(c,x1,y1,x2,y2,color='#607987',width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
function text(c,value,x,y,size=16,color='#20313b',weight=600,align='left'){c.fillStyle=color;c.font=weight+' '+size+'px Arial';c.textAlign=align;c.fillText(value,x,y);}
function panel(c,x,y,w,h,fill='#f3f6f7',stroke='#9fafb7',radius=0){rect(c,x,y,w,h,fill);c.strokeStyle=stroke;c.lineWidth=1;c.strokeRect(x+.5,y+.5,w-1,h-1);}
function agentFrame(id){const frame=agentFrames.find(item=>item.id===id);if(!frame)throw new Error('Missing agent '+id);return frame;}
function propFrame(id){const frame=propFrames.find(item=>item.id===id);if(!frame)throw new Error('Missing prop '+id);return frame;}
function drawAgent(c,id,x,y,scale=1){const f=agentFrame(id);c.drawImage(agentsImg,f.x,f.y,f.width,f.height,Math.round(x-f.pivotX*scale),Math.round(y-f.pivotY*scale),Math.round(f.width*scale),Math.round(f.height*scale));}
function drawProp(c,id,x,y,scale=1){const f=propFrame(id);c.drawImage(propsImg,f.x,f.y,f.width,f.height,Math.round(x-f.pivotX*scale),Math.round(y-f.pivotY*scale),Math.round(f.width*scale),Math.round(f.height*scale));}
function diamond(c,cx,cy,w,h,fill,stroke){c.fillStyle=fill;c.strokeStyle=stroke;c.lineWidth=1;c.beginPath();c.moveTo(cx,cy-h/2);c.lineTo(cx+w/2,cy);c.lineTo(cx,cy+h/2);c.lineTo(cx-w/2,cy);c.closePath();c.fill();c.stroke();}
function isoFloor(c,ox,oy,cols,rows){for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const x=ox+(col-row)*32,y=oy+(col+row)*16;diamond(c,x,y,64,32,(col+row)%2?'#bfded5':'#c9e4dc','#96bdb6');}}

function renderCharacters(){
  const canvas=document.querySelector('#characters'),c=canvas.getContext('2d');rect(c,0,0,1320,590,'#e8eef1');
  text(c,'v0.3 CHARACTER ATLAS CANDIDATE',34,42,22,'#20313b',700);text(c,'60 production frames · 64 × 96 · transparent',1286,40,14,'#5f7681',600,'right');
  const roleInfo=[['PM','pm','#2b78bd'],['DEVELOPER','developer','#2c9951'],['QA','tester','#e99c2d']];
  const dirs=['NE','SE','SW','NW'],states=['idle','walk1','walk2','sit','work'];
  for(let r=0;r<3;r++){
    const sx=26+r*430;panel(c,sx,64,410,500,'#f8fafb','#aab8bf');rect(c,sx,64,410,42,'#344b58');text(c,roleInfo[r][0],sx+20,91,15,'#ffffff',700);
    for(let col=0;col<5;col++)text(c,['IDLE','WALK A','WALK B','SEATED','WORK'][col],sx+94+col*63,126,10,'#617783',700,'center');
    for(let row=0;row<4;row++){
      text(c,dirs[row],sx+25,178+row*100,12,'#526b77',700);
      for(let col=0;col<5;col++){
        const cellX=sx+57+col*67,cellY=140+row*100;rect(c,cellX,cellY,62,94,(row+col)%2?'#edf2f4':'#e5ecef');
        drawAgent(c,roleInfo[r][1]+'-'+states[col]+'-'+dirs[row],cellX+31,cellY+92,.96);
      }
    }
    rect(c,sx+20,538,370,4,roleInfo[r][2]);
  }
}

function renderFurniture(){
  const canvas=document.querySelector('#furniture'),c=canvas.getContext('2d');rect(c,0,0,1320,760,'#e8eef1');
  text(c,'v0.3 WORKSTATION & FURNITURE ATLAS CANDIDATE',34,42,22,'#20313b',700);text(c,'17 production frames · 192 × 128 · transparent',1286,40,14,'#5f7681',600,'right');
  const labels=['MINT FLOOR','BLUE FLOOR','NW WALL','NE WALL','WORKSTATION BASE','ERGONOMIC CHAIR','CRT + INPUT','6-SEAT MEETING','WHITEBOARD','EXECUTIVE CONSOLE','COFFEE COUNTER','WATER COOLER','PLANT','SELECTED','INVALID TARGET','PATH','OPEN DOOR'];
  for(let index=0;index<17;index++){
    const col=index%5,row=Math.floor(index/5),x=26+col*258,y=66+row*168;
    panel(c,x,y,240,150,(row+col)%2?'#f6f9fa':'#eef3f5','#aab8bf');text(c,labels[index],x+12,y+22,11,'#526b77',700);
    const frame=propFrames[index];drawProp(c,frame.id,x+120,y+140,.9);
  }
  panel(c,800,570,492,150,'#f6f9fa','#aab8bf');text(c,'LAYERED WORKSTATION ASSEMBLY',820,595,12,'#526b77',700);
  drawProp(c,'selection',910,704,.7);drawProp(c,'desk',930,705,.76);drawProp(c,'crt',930,688,.76);drawProp(c,'chair',930,720,.7);drawAgent(c,'developer-work-NE',930,709,.86);
  text(c,'desk + CRT + chair + seated developer',1060,655,14,'#20313b',600);text(c,'shared ground pivot and explicit depth layers',1060,682,12,'#617783',500);
}

function renderDesktop(){
  const canvas=document.querySelector('#desktop'),c=canvas.getContext('2d');rect(c,0,0,1440,900,'#dce5e9');
  rect(c,0,0,1440,58,'#f3f6f7');rect(c,0,57,1440,2,'#263a44');text(c,'ThemeTeam',54,37,24,'#162832',700);text(c,'OFFICE',1198,34,14,'#34734c',700);text(c,'TEAM',1280,34,14,'#526b77',600);text(c,'TASKS',1350,34,14,'#526b77',600);
  rect(c,0,59,150,841,'#263945');rect(c,0,83,150,54,'#356e9f');text(c,'OFFICE',32,116,16,'#ffffff',700);text(c,'TEAM',32,174,16,'#dbe4e7',600);text(c,'TASKS',32,228,16,'#dbe4e7',600);
  rect(c,150,59,1015,682,'#accbc7');isoFloor(c,648,162,12,10);
  // Boundaries establish the close-range office/meeting composition.
  rect(c,202,105,602,8,'#315d67');rect(c,202,105,8,244,'#315d67');rect(c,804,105,8,244,'#315d67');
  rect(c,838,105,280,8,'#315d67');rect(c,1110,105,8,270,'#315d67');
  // Workstation island: props share the same pivot, with the chair and person above the desk base.
  drawProp(c,'desk',410,410,1.12);drawProp(c,'crt',400,385,.82);drawProp(c,'chair',445,435,.77);drawProp(c,'selection',446,444,.58);drawAgent(c,'developer-work-NE',445,428,1.02);
  drawProp(c,'desk',662,525,1.06);drawProp(c,'crt',652,501,.78);drawProp(c,'chair',695,548,.73);drawAgent(c,'tester-sit-NW',695,541,.96);
  drawProp(c,'coffee-counter',940,570,.78);drawProp(c,'water-cooler',1080,560,.67);drawProp(c,'plant',1020,387,.66);
  // Meeting area uses the substantial six-seat asset and seated roles.
  drawProp(c,'whiteboard',968,222,.88);drawProp(c,'meeting-table',960,360,1.12);drawAgent(c,'pm-sit-SE',860,341,.92);drawAgent(c,'tester-sit-SW',1050,370,.92);
  drawProp(c,'path-dot',584,392,.58);drawAgent(c,'developer-walk1-SE',582,376,1.02);
  panel(c,1165,59,275,682,'#f1f5f6','#9dafb8');text(c,'SELECTED AGENT',1190,93,12,'#5d737d',700);drawAgent(c,'developer-idle-SE',1228,222,1.18);text(c,'Dev',1305,151,26,'#182a34',700);text(c,'Developer',1305,179,15,'#34734c',600);
  line(c,1190,210,1415,210,'#bdc9ce');text(c,'CURRENT TASK',1190,242,12,'#5d737d',700);text(c,'Build feature',1190,278,18,'#182a34',600);
  line(c,1190,307,1415,307,'#bdc9ce');text(c,'STATE',1190,339,12,'#5d737d',700);text(c,'Walking to workstation',1190,376,15,'#182a34',600);
  line(c,1190,405,1415,405,'#bdc9ce');text(c,'VISUAL CONTRACT',1190,437,12,'#5d737d',700);text(c,'64 × 96 character frame',1190,472,14,'#182a34',600);text(c,'Layered furniture pivots',1190,500,14,'#182a34',600);text(c,'Normal close-range zoom',1190,528,14,'#182a34',600);
  rect(c,150,741,1290,159,'#f3f6f7');text(c,'RUNNING WORK',176,777,13,'#5d737d',700);for(let i=0;i<4;i++)panel(c,176+i*280,794,260,80,'#ffffff','#bac7cc');text(c,'Build feature',192,827,16,'#182a34',600);text(c,'Write tests',472,827,16,'#182a34',600);text(c,'UI review',752,827,16,'#182a34',600);text(c,'Done',1032,827,16,'#182a34',600);
}

function renderMobile(){
  const canvas=document.querySelector('#mobile'),c=canvas.getContext('2d');rect(c,0,0,390,844,'#dfe7ea');rect(c,0,0,390,52,'#f3f6f7');text(c,'ThemeTeam',18,33,20,'#172932',700);text(c,'OFFICE',315,31,12,'#34734c',700);
  rect(c,0,52,390,500,'#accbc7');isoFloor(c,195,112,7,7);
  drawProp(c,'desk',97,270,.67);drawProp(c,'crt',93,255,.49);drawProp(c,'chair',116,286,.46);drawProp(c,'selection',116,291,.38);drawAgent(c,'developer-work-NE',116,282,.7);
  drawProp(c,'meeting-table',284,212,.62);drawAgent(c,'tester-sit-SW',324,222,.62);drawProp(c,'path-dot',205,339,.38);drawAgent(c,'pm-walk1-SE',208,331,.7);
  rect(c,0,535,390,309,'#f6f8f9');rect(c,166,546,58,5,'#aab8bf');text(c,'Dev',24,593,24,'#172932',700);text(c,'Developer · working',24,622,15,'#34734c',600);drawAgent(c,'developer-idle-SE',322,626,.86);
  line(c,24,651,366,651,'#c4ced2');text(c,'CURRENT TASK',24,683,12,'#5d737d',700);text(c,'Build feature',24,717,18,'#172932',600);
  panel(c,24,749,342,67,'#eaf3ed','#88ad96');text(c,'Docked at workstation',44,790,16,'#2c623f',700);
}

Promise.all([agentsImg.decode(),propsImg.decode()]).then(()=>{renderCharacters();renderFurniture();renderDesktop();renderMobile();window.ready=true;});
</script></body></html>`;

async function main() {
  const { chromium } = require(require.resolve('playwright', { paths: [runtimeModules] }));
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  let result;
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForFunction(() => window.ready === true);
    result = await page.evaluate(() => Object.fromEntries(['characters','furniture','desktop','mobile'].map(id => [id, document.querySelector('#'+id).toDataURL('image/png')])));
  } finally {
    await browser.close();
  }
  const outputs = {
    characters: 'candidate-characters-preview.png',
    furniture: 'candidate-furniture-preview.png',
    desktop: 'runtime-closeup-desktop.png',
    mobile: 'runtime-closeup-mobile.png'
  };
  for (const [key, name] of Object.entries(outputs)) fs.writeFileSync(path.join(output, name), Buffer.from(result[key].split(',')[1], 'base64'));
  for (const name of Object.values(outputs)) {
    let file = manifest.files.find(item => item.name === name);
    if (!file) { file = { name }; manifest.files.push(file); }
    file.sha256 = sha256(path.join(output, name));
    file.bytes = fs.statSync(path.join(output, name)).size;
  }
  manifest.commands = [
    'node tests/generate_m1_visual_candidate_v03.cjs',
    'node tests/pack_m1_agent_atlas_v03.cjs',
    'node tests/pack_m1_prop_atlas_v03.cjs',
    'node tests/render_m1_visual_candidate_v03.cjs'
  ];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ status: manifest.status, outputs: Object.values(outputs).map(name => ({ name, sha256: sha256(path.join(output, name)) })) }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
