// Kollisionsarmes, rechtwinkliges SVG-Routing ohne externe Laufzeit-Abhängigkeiten.
// Die Knotenpositionen kommen weiterhin aus den fachlichen Layouts in diagrams.mjs.
const rnd = n => Math.round(n * 10) / 10;
const center = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const between = (v, a, b) => v > a + 0.01 && v < b - 0.01;
const cross = (a, b, c, d) => {
  if (a.x === b.x && c.y === d.y) return between(a.x, Math.min(c.x, d.x), Math.max(c.x, d.x)) && between(c.y, Math.min(a.y, b.y), Math.max(a.y, b.y));
  if (a.y === b.y && c.x === d.x) return between(c.x, Math.min(a.x, b.x), Math.max(a.x, b.x)) && between(a.y, Math.min(c.y, d.y), Math.max(c.y, d.y));
  return false;
};
const overlap = (a, b, c, d) => {
  if (a.y === b.y && c.y === d.y && a.y === c.y) return Math.max(0, Math.min(Math.max(a.x,b.x), Math.max(c.x,d.x)) - Math.max(Math.min(a.x,b.x), Math.min(c.x,d.x)));
  if (a.x === b.x && c.x === d.x && a.x === c.x) return Math.max(0, Math.min(Math.max(a.y,b.y), Math.max(c.y,d.y)) - Math.max(Math.min(a.y,b.y), Math.min(c.y,d.y)));
  return 0;
};
const inside = (p, b, margin = 0) => p.x > b.x - margin && p.x < b.x + b.w + margin && p.y > b.y - margin && p.y < b.y + b.h + margin;
const length = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
// Nur freie Korridore: zwei freie Gitterpunkte allein garantieren noch keine freie Strecke.
const blocked = (a,b,boxes,margin) => boxes.some(box => a.x===b.x
  ? a.x>box.x-margin&&a.x<box.x+box.w+margin && Math.min(a.y,b.y)<box.y+box.h+margin && Math.max(a.y,b.y)>box.y-margin
  : a.y>box.y-margin&&a.y<box.y+box.h+margin && Math.min(a.x,b.x)<box.x+box.w+margin && Math.max(a.x,b.x)>box.x-margin);
class Heap {
  a = [];
  push(v) { const a = this.a; a.push(v); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (a[p][0] <= v[0]) break; a[i] = a[p]; i = p; } a[i] = v; }
  pop() { const a = this.a, top = a[0], tail = a.pop(); if (a.length) { let i = 0; while (2 * i + 1 < a.length) { let c = 2 * i + 1; if (c + 1 < a.length && a[c+1][0] < a[c][0]) c++; if (a[c][0] >= tail[0]) break; a[i] = a[c]; i = c; } a[i] = tail; } return top; }
}
const dirs = { top: [0,-1], bottom: [0,1], left: [-1,0], right: [1,0] };
const sideFor = (a,b,mode) => {
  const dx = center(b).x - center(a).x, dy = center(b).y - center(a).y;
  // Aufbau: Ebenen werden über Ober- und Unterkante verbunden.
  if (mode === 'structure' && Math.abs(a.y - b.y) > 1) return dy > 0 ? 'bottom' : 'top';
  if (Math.abs(dx) > Math.abs(dy) * 0.95) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'bottom' : 'top';
};
const port = (b, side, fraction) => ({ x: rnd(side === 'left' ? b.x : side === 'right' ? b.x + b.w : b.x + b.w * fraction), y: rnd(side === 'top' ? b.y : side === 'bottom' ? b.y + b.h : b.y + b.h * fraction) });
const shift = (p, side, by) => ({ x: rnd(p.x + dirs[side][0] * by), y: rnd(p.y + dirs[side][1] * by) });
const uniq = arr => [...new Set(arr.map(rnd))].sort((a,b) => a-b);
function findPath(start, end, boxes, routed, width, height, clearance) {
  const xs = uniq([5, width-5, start.x, end.x, ...boxes.flatMap(b => [b.x-clearance-2, b.x+b.w+clearance+2])].filter(v => v >= 3 && v <= width-3));
  const ys = uniq([5, height-5, start.y, end.y, ...boxes.flatMap(b => [b.y-clearance-2, b.y+b.h+clearance+2])].filter(v => v >= 3 && v <= height-3));
  const nx = xs.length, ny = ys.length, valid = new Uint8Array(nx*ny);
  for(let y=0;y<ny;y++) for(let x=0;x<nx;x++) valid[y*nx+x] = +!boxes.some(b=>inside({x:xs[x], y:ys[y]},b,clearance));
  const ix = xs.indexOf(start.x), iy = ys.indexOf(start.y), tx = xs.indexOf(end.x), ty = ys.indexOf(end.y);
  if (ix < 0 || iy < 0 || tx < 0 || ty < 0) return [start,end];
  const from = (iy*nx+ix)*3, target = ty*nx+tx, nstates=nx*ny*3;
  const dist = new Float64Array(nstates).fill(Infinity), prev = new Int32Array(nstates).fill(-1), heap = new Heap();
  dist[from] = 0; heap.push([length(start,end), 0, from]); let last=-1;
  while(heap.a.length) {
    const [estimate,cost,state] = heap.pop(); if(cost !== dist[state])continue;
    const v=Math.floor(state/3), direct=state%3, x=v%nx, y=Math.floor(v/nx);
    if(v===target){last=state;break;}
    for(const [mx,my,nd] of [[x-1,y,1],[x+1,y,1],[x,y-1,2],[x,y+1,2]]) {
      if(mx<0||mx>=nx||my<0||my>=ny)continue;
      const nv=my*nx+mx;if(!valid[nv])continue;
      const a={x:xs[x],y:ys[y]},b={x:xs[mx],y:ys[my]};
      if(blocked(a,b,boxes,clearance))continue;
      let penalty=0;for(const [c,d] of routed){if(cross(a,b,c,d))penalty+=100;if(overlap(a,b,c,d)>0)penalty+=55+overlap(a,b,c,d)*0.4;}
      const nc=cost+length(a,b)+(direct && direct!==nd ? 24:0)+penalty, ns=nv*3+nd;
      if(nc < dist[ns]-0.001){dist[ns]=nc;prev[ns]=state;heap.push([nc+length(b,end),nc,ns]);}
    }
  }
  if(last<0){
    // Selbst bei stark beengtem Platz keine diagonale Notverbindung zeichnen.
    const a={x:start.x,y:end.y},b={x:end.x,y:start.y};
    const score=p=>+blocked(start,p,boxes,clearance) + +blocked(p,end,boxes,clearance);
    return score(a)<=score(b)?[start,a,end]:[start,b,end];
  }
  const pts=[];for(let s=last;s>=0;s=prev[s]){const v=Math.floor(s/3);pts.push({x:xs[v%nx],y:ys[Math.floor(v/nx)]});if(s===from)break;}
  pts.reverse();
  const compact=[];for(const p of pts){if(compact.length>1){const a=compact.at(-2),b=compact.at(-1);if((a.x===b.x && b.x===p.x)||(a.y===b.y && b.y===p.y)){compact.pop();}}compact.push(p);}
  return compact;
}
function labelPosition(points,label,boxes,claimed,allLines,width,height) {
  if(!label)return {lx:0,ly:0};
  const half=Math.max(15,label.length*3.5+6), options=[];
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1], len=length(a,b);
    for(const t of [0.5,0.3,0.7])for(const sign of [-1,1]){
      const hor=a.y===b.y, p={x:rnd(a.x+(b.x-a.x)*t+(hor?0:sign*(half+8))),y:rnd(a.y+(b.y-a.y)*t+(hor?sign*13:0))};
      const rect={x:p.x-half,y:p.y-10,w:2*half,h:20};
      if(rect.x<4||rect.y<4||rect.x+rect.w>width-4||rect.y+rect.h>height-4)continue;
      if(boxes.some(box=>rect.x<box.x+box.w+6&&rect.x+rect.w>box.x-6&&rect.y<box.y+box.h+6&&rect.y+rect.h>box.y-6))continue;
      if(claimed.some(box=>rect.x<box.x+box.w+4&&rect.x+rect.w>box.x-4&&rect.y<box.y+box.h+4&&rect.y+rect.h>box.y-4))continue;
      const overlaps=allLines.filter(([c,d])=>Math.min(c.x,d.x)<rect.x+rect.w&&Math.max(c.x,d.x)>rect.x&&Math.min(c.y,d.y)<rect.y+rect.h&&Math.max(c.y,d.y)>rect.y).length;
      options.push({p,rect,score:overlaps*35 + (hor ? 0:12) + (len<2*half ? 40:0) - Math.min(len,240)*0.1 + Math.abs(t-0.5)*8});
    }
  }
  options.sort((a,b)=>a.score-b.score);const best=options[0];
  if(best){claimed.push(best.rect);return {lx:best.p.x,ly:best.p.y};}
  // Auch bei sehr kurzen Verbindungen einen freien Beschriftungsplatz suchen.
  // Die Beschriftung darf niemals als Notlösung in einem fremden Kasten landen.
  const middle=points[Math.floor(points.length/2)]||points[0];
  let fallback=null;
  for(let y=18;y<height-18;y+=12) for(let x=Math.ceil(half+8);x<width-half-8;x+=16){
    const rect={x:x-half,y:y-10,w:2*half,h:20};
    if(boxes.some(box=>rect.x<box.x+box.w+6&&rect.x+rect.w>box.x-6&&rect.y<box.y+box.h+6&&rect.y+rect.h>box.y-6))continue;
    if(claimed.some(box=>rect.x<box.x+box.w+4&&rect.x+rect.w>box.x-4&&rect.y<box.y+box.h+4&&rect.y+rect.h>box.y-4))continue;
    const overlaps=allLines.filter(([a,b])=>Math.min(a.x,b.x)<rect.x+rect.w&&Math.max(a.x,b.x)>rect.x&&Math.min(a.y,b.y)<rect.y+rect.h&&Math.max(a.y,b.y)>rect.y).length;
    const score=Math.abs(x-middle.x)+Math.abs(y-middle.y)*1.2+overlaps*35;
    if(!fallback||score<fallback.score)fallback={x,y,rect,score};
  }
  if(fallback){claimed.push(fallback.rect);return {lx:fallback.x,ly:fallback.y};}
  return {lx:middle.x,ly:middle.y};
}
/**
 * Leitet die Verbindungen mit verteilten Ports und knotenfreien, orthogonalen Wegen.
 * Beschriftungen werden auf freie Flächen statt auf Linienkreuzungen gelegt.
 */
export function routeDiagram(boxes, edges, {width,height,mode='data',clearance=8}={}) {
  const byId=new Map(boxes.map(b=>[b.id,b])), uses=new Map();
  edges.forEach((edge,i)=>{const a=byId.get(edge.from),b=byId.get(edge.to);if(!a||!b)return;
    const s1=sideFor(a,b,mode),s2=sideFor(b,a,mode);
    for(const [id,side,other,end] of [[a.id,s1,b,0],[b.id,s2,a,1]]){
      const k=id+'|'+side; if(!uses.has(k))uses.set(k,[]);
      uses.get(k).push({i,end,other: center(other)});
    }
  });
  const ports=new Map();for(const [k,items] of uses){const [id,side]=k.split('|'), box=byId.get(id);
    items.sort((a,b)=>((side==='top'||side==='bottom')? a.other.x-b.other.x : a.other.y-b.other.y)||a.i-b.i);
    // Kennungs-Badges der Aufbau-Knoten sitzen links oben; Anschlüsse bleiben auf der rechten Hälfte.
    const refs=mode==='structure'&&box.refs?.length&&side==='top';
    items.forEach((it,j)=>ports.set(it.i+'|'+it.end,{side,p:port(box,side,refs ? 0.42+0.5*(j+0.5)/items.length : 0.17+0.66*(j+0.5)/items.length)}));
  }
  const routed=[], claimed=[], results=new Array(edges.length);
  const indices=edges.map((e,i)=>({i,len:length(center(byId.get(e.from)),center(byId.get(e.to)))})).sort((a,b)=>a.len-b.len||a.i-b.i);
  for(const {i} of indices){const e=edges[i], start=ports.get(i+'|0'),end=ports.get(i+'|1');if(!start||!end)continue;
    const a=shift(start.p,start.side,clearance+4),b=shift(end.p,end.side,clearance+4);
    const path=findPath(a,b,boxes,routed,width,height,clearance);
    const pts=[start.p,...path,end.p];
    // Nur benachbarte identische Punkte entfernen.
    const compact=pts.filter((p,j)=>!j||p.x!==pts[j-1].x||p.y!==pts[j-1].y);
    for(let j=0;j<compact.length-1;j++)routed.push([compact[j],compact[j+1]]);
    results[i]={...e,d:compact.map((p,j)=>(j?'L':'M')+p.x+','+p.y).join(' '),points:compact};
  }
  for(let i=0;i<edges.length;i++){
    const r=results[i];if(!r)continue;
    const pos=labelPosition(r.points,r.label,boxes,claimed,routed,width,height);
    r.lx=pos.lx;r.ly=pos.ly;
    if(mode==='data'){
      const [a,b]=r.points, q=r.points.at(-1),prev=r.points.at(-2);
      const mark=(p,next)=>{const dx=Math.sign(next.x-p.x),dy=Math.sign(next.y-p.y);return {x:rnd(p.x+dx*13-dy*9),y:rnd(p.y+dy*13+dx*9+4)};};
      [r.ca,r.cb]=r.kind==='1:1'?['1','1']:r.kind==='n:m'?['n','m']:['1','n'];
      r.pa=mark(a,b);r.pb=mark(q,prev);
    }
  }
  return results;
}
