import { MODES, lerp, wrap, clamp } from './config.js';

function spline(a,b,c,d,t) { return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t); }
export class Course {
  constructor(id) {
    this.id = id; Object.assign(this, MODES[id]);
    this.nodes = []; this.length = 0;
    const p = this.points, n = p.length;
    for (let i = 0; i <= 960; i++) {
      const u = i / 960 * n, j = Math.floor(u), t = u-j;
      const xyz = [0,1,2].map(k => spline(p[wrap(j-1,n)][k],p[j%n][k],p[(j+1)%n][k],p[(j+2)%n][k],t));
      const node = {x:xyz[0], y:xyz[1], z:xyz[2], s:this.length};
      if (i) { const prev = this.nodes[i-1]; this.length += Math.hypot(node.x-prev.x,node.z-prev.z); node.s = this.length; }
      this.nodes.push(node);
    }
    for (let i=0;i<960;i++) { const a=this.nodes[i],b=this.nodes[i+1],d=Math.hypot(b.x-a.x,b.z-a.z); a.tx=(b.x-a.x)/d; a.tz=(b.z-a.z)/d; a.heading=Math.atan2(a.tx,a.tz); a.slope=(b.y-a.y)/d; }
    Object.assign(this.nodes[960], {tx:this.nodes[0].tx,tz:this.nodes[0].tz,heading:this.nodes[0].heading,slope:this.nodes[0].slope});
    this.spacing = this.length / this.gates;
  }
  at(s, offset=0) {
    s = wrap(s,this.length); let lo=0,hi=960;
    while (hi-lo>1) { const m=(lo+hi)>>1; if(this.nodes[m].s>s) hi=m; else lo=m; }
    const a=this.nodes[lo],b=this.nodes[hi],t=(s-a.s)/(b.s-a.s);
    return {x:lerp(a.x,b.x,t)+a.tz*offset,y:lerp(a.y,b.y,t),z:lerp(a.z,b.z,t)-a.tx*offset,heading:a.heading,tx:a.tx,tz:a.tz,slope:a.slope,index:lo,s};
  }
  project(x,z, hint) {
    let best=Infinity,result=null;
    const find=(start,end)=>{for(let j=start;j<end;j++) {
      const i=wrap(j,960),a=this.nodes[i],b=this.nodes[i+1],dx=b.x-a.x,dz=b.z-a.z;
      const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1),px=a.x+dx*t,pz=a.z+dz*t;
      const dist=(x-px)**2+(z-pz)**2;
      if(dist<best) { best=dist; result={x:px,z:pz,y:lerp(a.y,b.y,t),s:lerp(a.s,b.s,t),offset:(x-px)*a.tz-(z-pz)*a.tx,heading:a.heading,tx:a.tx,tz:a.tz,slope:a.slope,index:i,dist:Math.sqrt(dist)}; }
    }};
    if(Number.isInteger(hint)) { find(hint-35,hint+36); if(best>2500) find(0,960); } else find(0,960);
    return result;
  }
}
export const courses = Object.fromEntries(Object.keys(MODES).map(id=>[id,new Course(id)]));
