import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, set, get, child, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const firebaseApp = firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Elements
const canvas=document.getElementById('pixelCanvas');
const ctx=canvas.getContext('2d',{alpha:false});
const container=document.getElementById('canvasContainer');
const sidebar=document.getElementById('sidebar');
const pixelList=document.getElementById('pixelList');
const totalCostEl=document.getElementById('totalCost');
const buyButton=document.getElementById('buyButton');
const messageBar=document.getElementById('messageBar');
const optionsForAll=document.getElementById('optionsForAll');
const applyUrlAllBtn=document.getElementById('applyUrlAll');
const applyImageAllBtn=document.getElementById('applyImageAll');
const checkoutBtn=document.getElementById('checkout');
const clearSelectionBtn=document.getElementById('clearSelection');

const cols=1000, rows=1000;
let purchasedPixels={}; // loaded from firebase
let selectedPixels=[];
let hoveredCell=null;
let buyMode=false;
let scale=1, offsetX=0, offsetY=0, isDragging=false, dragStartX=0, dragStartY=0, rectStart=null;

// --- Canvas Resize ---
function resizeCanvas(){
  const dpr = Math.max(1, window.devicePixelRatio||1);
  const w = container.clientWidth, h = container.clientHeight;
  canvas.width = Math.floor(w*dpr);
  canvas.height = Math.floor(h*dpr);
  canvas.style.width = w+'px';
  canvas.style.height = h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  scale = Math.min(w/cols, h/rows);
  offsetX = (w - cols*scale)/2;
  offsetY = (h - rows*scale)/2;
  draw();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- Draw Function ---
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Grid background
  ctx.fillStyle = '#eee';
  ctx.fillRect(0,0,cols,rows);

  // Draw purchased pixels
  for(const key in purchasedPixels){
    const [r,c] = key.split(',').map(Number);
    const data = purchasedPixels[key];
    ctx.fillStyle = 'green';
    ctx.fillRect(c,r,1,1);
  }

  // Selected pixels
  for(const p of selectedPixels){
    ctx.fillStyle = 'yellow';
    ctx.fillRect(p.col,p.row,1,1);
  }

  // Hovered
  if(hoveredCell){
    ctx.fillStyle='rgba(0,163,255,0.5)';
    ctx.fillRect(hoveredCell.col, hoveredCell.row,1,1);
  }

  ctx.restore();
}

// --- Utilities ---
function screenToWorld(x,y){
  const rect = canvas.getBoundingClientRect();
  return {
    col: Math.floor((x - rect.left - offsetX)/scale),
    row: Math.floor((y - rect.top - offsetY)/scale)
  };
}
function key(r,c){return `${r},${c}`;}

// --- Load purchased pixels ---
get(ref(database,'pixels')).then(snapshot=>{
  if(snapshot.exists()){ purchasedPixels=snapshot.val(); draw(); }
});

// --- Buy Mode Toggle ---
buyButton.addEventListener('click',()=>{
  buyMode=!buyMode;
  sidebar.classList.toggle('open', buyMode);
  messageBar.textContent = buyMode? "Select pixels to buy" : "Visit mode active";
  selectedPixels=[]; draw(); updateSidebar();
});

// --- Canvas Interaction ---
canvas.addEventListener('pointerdown', e=>{
  isDragging=true;
  dragStartX=e.clientX; dragStartY=e.clientY;
  rectStart=screenToWorld(e.clientX,e.clientY);
});
canvas.addEventListener('pointermove', e=>{
  const pos=screenToWorld(e.clientX,e.clientY);
  hoveredCell=pos;
  if(isDragging && buyMode){
    const current = pos;
    // rectangle selection
    selectedPixels=[];
    const r1=Math.min(rectStart.row, current.row);
    const r2=Math.max(rectStart.row, current.row);
    const c1=Math.min(rectStart.col, current.col);
    const c2=Math.max(rectStart.col, current.col);
    for(let r=r1;r<=r2;r++){
      for(let c=c1;c<=c2;c++){
        if(!purchasedPixels[key(r,c)]) selectedPixels.push({row:r,col:c,url:'',img:null});
      }
    }
    updateSidebar();
  }
  draw();
});
canvas.addEventListener('pointerup', e=>{
  isDragging=false; rectStart=null;
});
canvas.addEventListener('click', e=>{
  const pos=screenToWorld(e.clientX,e.clientY);
  const k=key(pos.row,pos.col);
  if(!buyMode){
    if(purchasedPixels[k] && purchasedPixels[k].url) window.open(purchasedPixels[k].url,'_blank');
    return;
  }
  // single select
  if(!purchasedPixels[k]){
    const exists = selectedPixels.find(p=>p.row===pos.row && p.col===pos.col);
    if(!exists) selectedPixels.push({row:pos.row,col:pos.col,url:'',img:null});
    updateSidebar();
  }
  draw();
});

// --- Sidebar ---
function updateSidebar(){
  pixelList.innerHTML='';
  if(selectedPixels.length>1) optionsForAll.style.display='block';
  else optionsForAll.style.display='none';
  selectedPixels.forEach((p,i)=>{
    const div=document.createElement('div'); div.className='pixelSection';
    div.innerHTML=`
      <div class="pixelMeta">
        <div>Pixel ${p.row},${p.col}</div>
        <label>URL<input type="url" value="${p.url||''}" data-i="${i}" class="urlInput"/></label>
        <label>Image<input type="file" data-i="${i}" class="imgInput"/></label>
      </div>
    `;
    pixelList.appendChild(div);
  });

  totalCostEl.textContent = 'Total Cost: '+(selectedPixels.length*1)+' JOD';
}

// --- Apply All ---
applyUrlAllBtn.addEventListener('click', ()=>{
  const url = prompt('Enter URL for all selected pixels:');
  if(!url) return;
  selectedPixels.forEach(p=>p.url=url);
  updateSidebar();
});
applyImageAllBtn.addEventListener('click', ()=>{
  const imgFile = prompt('Enter image URL for all selected pixels:');
  if(!imgFile) return;
  selectedPixels.forEach(p=>p.img=imgFile);
  updateSidebar();
});

// --- Checkout ---
checkoutBtn.addEventListener('click', ()=>{
  selectedPixels.forEach(p=>{
    const k = key(p.row,p.col);
    purchasedPixels[k]={...p, locked:true};
    set(ref(database,'pixels/'+k),purchasedPixels[k]);
  });
  selectedPixels=[];
  updateSidebar(); draw();
  alert('Purchase recorded!');
});

// --- Clear Selection ---
clearSelectionBtn.addEventListener('click', ()=>{
  selectedPixels=[]; updateSidebar(); draw();
});

// --- Zoom & Drag ---
canvas.addEventListener('wheel', e=>{
  e.preventDefault();
  const zoom = e.deltaY<0?1.1:0.9;
  scale*=zoom;
  draw();
});
