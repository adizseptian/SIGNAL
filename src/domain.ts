export type Day='SEN'|'SEL'|'RAB'|'KAM'|'JUM'|'SAB';
export const DAYS:Day[]=['SEN','SEL','RAB','KAM','JUM','SAB'];
export type SlotType='TEACHING'|'ASSEMBLY'|'BREAK'|'RELIGIOUS'|'OTHER';
export interface Slot{index:number;type:SlotType;start:string;end:string}
export interface Req{id:string;classId:string;subject:string;teacher:string;jp:number}
export interface Data{school:string;activeDays:Day[];maxJPPerDay:Partial<Record<Day,number>>;slots:Slot[];classes:string[];requirements:Req[];qualifications?:Record<string,string[]>;teacherMax?:Record<string,number>}
export interface Entry{classId:string;day:Day;slot:number;reqId:string}
export interface Issue{severity:'error'|'warn';rule:string;msg:string;classId?:string;day?:Day;slot?:number}
export type GenStatus='SUCCESS'|'SEARCH_LIMIT_REACHED'|'INVALID_INPUT'|'INFEASIBLE';
export const teachingSlots=(d:Data)=>d.slots.filter(s=>s.type==='TEACHING').map(s=>s.index);
const reqMap=(d:Data)=>new Map(d.requirements.map(r=>[r.id,r]));

export function validate(d:Data,es:Entry[]):Issue[]{
 const out:Issue[]=[],rm=reqMap(d),T=new Set(teachingSlots(d)),seenC=new Set<string>(),seenT=new Map<string,string>();
 for(const e of es){const r=rm.get(e.reqId);
  if(!r){out.push({severity:'error',rule:'REF',msg:'Pelajaran tidak dikenal',...e});continue}
  if(!d.activeDays.includes(e.day)||!T.has(e.slot))out.push({severity:'error',rule:'SLOT_BLOKIR',msg:`${r.subject} ada di jam yang tidak untuk belajar (${e.day} jam ${e.slot})`,classId:e.classId,day:e.day,slot:e.slot});
  const kc=`${e.classId}|${e.day}|${e.slot}`;if(seenC.has(kc))out.push({severity:'error',rule:'KELAS_GANDA',msg:`Kelas ${e.classId} punya dua pelajaran di ${e.day} jam ${e.slot}`,classId:e.classId,day:e.day,slot:e.slot});seenC.add(kc);
  const kt=`${r.teacher}|${e.day}|${e.slot}`;if(seenT.has(kt))out.push({severity:'error',rule:'GURU_BENTROK',msg:`${r.teacher} bentrok di ${e.day} jam ${e.slot} (${seenT.get(kt)} dan ${e.classId})`,classId:e.classId,day:e.day,slot:e.slot});seenT.set(kt,e.classId)}
 for(const r of d.requirements){const n=es.filter(e=>e.reqId===r.id).length;
  if(n!==r.jp)out.push({severity:'error',rule:'KEBUTUHAN_JP',msg:`${r.classId} ${r.subject}: terisi ${n} dari ${r.jp} JP`,classId:r.classId})}
 for(const c of d.classes)for(const day of d.activeDays){
  const cell=es.filter(e=>e.classId===c&&e.day===day),max=d.maxJPPerDay[day]??10;
  if(cell.length>max)out.push({severity:'error',rule:'MAKS_JP_HARI',msg:`${c} ${day}: ${cell.length} JP melebihi batas ${max}`,classId:c,day});
  const bySubj=new Map<string,number[]>();for(const e of cell){const s=rm.get(e.reqId)?.subject??'?';bySubj.set(s,[...(bySubj.get(s)??[]),e.slot])}
  const ts=teachingSlots(d);
  for(const[s,sl]of bySubj){const pos=sl.map(x=>ts.indexOf(x)).sort((a,b)=>a-b);let run=1,blocks3=0;
   for(let i=1;i<=pos.length;i++){if(i<pos.length&&pos[i]===pos[i-1]+1)run++;else{if(run>3)out.push({severity:'error',rule:'BLOK_MAKS_3',msg:`${c} ${day}: ${s} berturut-turut ${run} JP (maks 3)`,classId:c,day});if(run===3)blocks3++;run=1}}
   if(blocks3>1)out.push({severity:'error',rule:'BLOK_MAKS_3',msg:`${c} ${day}: ${s} punya lebih dari satu blok 3 JP`,classId:c,day})}}
 const br=d.slots.find(x=>x.type==='BREAK')?.index;
 if(br!==undefined){const LIM:Record<number,number>={1:3,2:2,3:1};
  const subj=new Map<string,Set<string>>();for(const r of d.requirements)subj.set(r.teacher,(subj.get(r.teacher)??new Set()).add(r.subject));
  const ts2=teachingSlots(d),pre=ts2.filter(x=>x<br),post=ts2.filter(x=>x>br);
  for(const[t,ss]of subj){if(ss.size<2)continue;
   for(const day of d.activeDays){const has=(sl:number)=>es.some(e=>e.day===day&&e.slot===sl&&rm.get(e.reqId)?.teacher===t);
    let n=0;for(let i=pre.length-1;i>=0&&has(pre[i]);i--)n++;
    let m=0;for(let i=0;i<post.length&&has(post[i]);i++)m++;
    if(n>0&&m>(LIM[n]??0))out.push({severity:'error',rule:'GURU_MULTIMAPEL',msg:`${t} ${day}: ${n} JP sebelum istirahat, ${m} JP sesudah (maks ${LIM[n]??0})`,day})}}}
 return out}

export function checkData(d:Data):Issue[]{const o:Issue[]=[],tot=new Map<string,number>();
 for(const r of d.requirements){const q=d.qualifications?.[r.teacher];tot.set(r.teacher,(tot.get(r.teacher)??0)+r.jp);
  if(q&&!q.includes(r.subject))o.push({severity:'error',rule:'KUALIFIKASI',msg:`${r.teacher} tidak layak mengajar ${r.subject} (${r.classId})`,classId:r.classId})}
 for(const[t,n]of tot){const m=d.teacherMax?.[t];if(m&&n>m)o.push({severity:'error',rule:'BEBAN_GURU_MAKS',msg:`${t}: beban ${n} JP melebihi batas ${m} JP`})}
 return o}

export function generate(d:Data,limit=300000):{status:GenStatus;entries:Entry[];tries:number}{
 const ts=teachingSlots(d);if(!d.classes.length||!ts.length||!d.activeDays.length)return{status:'INVALID_INPUT',entries:[],tries:0};
 if(checkData(d).length)return{status:'INVALID_INPUT',entries:[],tries:0};
 for(const c of d.classes){const need=d.requirements.filter(r=>r.classId===c).reduce((a,r)=>a+r.jp,0);
  if(need>ts.length*d.activeDays.length)return{status:'INFEASIBLE',entries:[],tries:0}}
 const units:Req[]=[...d.requirements].sort((a,b)=>b.jp-a.jp).flatMap(r=>Array.from({length:r.jp},()=>r));
 const usedC=new Set<string>(),usedT=new Set<string>(),es:Entry[]=[],cnt=new Map<string,number>();let tries=0;
 const dayMax=(day:Day)=>d.maxJPPerDay[day]??10;
 const dayLoad=(c:string,day:Day)=>es.filter(e=>e.classId===c&&e.day===day).length;
 const rec=(i:number):boolean=>{if(i===units.length)return true;if(++tries>limit)return false;
  const u=units[i];const cand:[Day,number,number][]=[];
  for(const day of d.activeDays)for(const s of ts){if(usedC.has(`${u.classId}|${day}|${s}`)||usedT.has(`${u.teacher}|${day}|${s}`))continue;
   cand.push([day,s,(cnt.get(`${u.id}|${day}`)??0)*100+dayLoad(u.classId,day)*10+ts.indexOf(s)/100])}
  cand.sort((a,b)=>a[2]-b[2]);
  for(const[day,s]of cand){if(dayLoad(u.classId,day)>=dayMax(day))continue;
   const e:Entry={classId:u.classId,day,slot:s,reqId:u.id};es.push(e);
   if(validate({...d,requirements:d.requirements.map(r=>({...r,jp:r.jp}))},es).filter(x=>x.rule!=='KEBUTUHAN_JP').length===0){
    usedC.add(`${u.classId}|${day}|${s}`);usedT.add(`${u.teacher}|${day}|${s}`);cnt.set(`${u.id}|${day}`,(cnt.get(`${u.id}|${day}`)??0)+1);
    if(rec(i+1))return true;
    usedC.delete(`${u.classId}|${day}|${s}`);usedT.delete(`${u.teacher}|${day}|${s}`);cnt.set(`${u.id}|${day}`,(cnt.get(`${u.id}|${day}`)??1)-1)}
   es.pop()}
  return false};
 const ok=rec(0);
 if(ok&&validate(d,es).length===0)return{status:'SUCCESS',entries:[...es],tries};
 return{status:tries>limit?'SEARCH_LIMIT_REACHED':'INFEASIBLE',entries:[],tries}}

export const sampleData:Data={school:'MTs Contoh (data sintetis)',activeDays:['SEN','SEL','RAB','KAM','JUM','SAB'],maxJPPerDay:{JUM:10},
 slots:[1,2,3].map(i=>({index:i,type:'TEACHING' as SlotType,start:'',end:''})).concat([{index:4,type:'BREAK' as SlotType,start:'',end:''}],[5,6,7,8].map(i=>({index:i,type:'TEACHING' as SlotType,start:'',end:''}))),
 classes:['7A','7B'],
 requirements:[['MTK','Guru A',4],['IPA','Guru B',3],['BIN','Guru C',4],['BIG','Guru D',3],['IPS','Guru E',3]].flatMap(([s,t,jp])=>['7A','7B'].map(c=>({id:`${c}-${s}`,classId:c,subject:s as string,teacher:t as string,jp:jp as number})))};
