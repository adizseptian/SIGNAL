import {DAYS,checkData,teachingSlots,type Data,type Day,type Entry,type Slot,type SlotType,type Req} from './domain';
const DN:Record<Day,string>={SEN:'Senin',SEL:'Selasa',RAB:'Rabu',KAM:'Kamis',JUM:'Jumat',SAB:'Sabtu'};
const TLAB:Record<SlotType,string>={TEACHING:'Belajar Mengajar',ASSEMBLY:'Upacara',BREAK:'Istirahat',RELIGIOUS:'Religi',OTHER:'Kegiatan Lain'};
const TYPE=Object.fromEntries(Object.entries(TLAB).map(([k,v])=>[v.toLowerCase(),k as SlotType]));
const p2=(n:number)=>String(n).padStart(2,'0');
const t=(v:any):string=>{if(v==null)return'';if(v instanceof Date)return`${p2(v.getUTCHours())}:${p2(v.getUTCMinutes())}`;if(typeof v==='object'){if(v.richText)return v.richText.map((x:any)=>x.text).join('').trim();if('result'in v)return t(v.result);return v.text!=null?String(v.text).trim():''}return String(v).trim()};
const int=(s:string)=>/^\d+$/.test(s)?+s:NaN;
const MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function buatXlsx(d:Data,es:Entry[],template:boolean):Promise<Blob>{
 const X:any=(await import('exceljs')).default,wb=new X.Workbook();
 const add=(name:string,cols:string[],rows:(string|number)[][],w:number[])=>{const ws=wb.addWorksheet(name);ws.addRow(cols);rows.forEach(r=>ws.addRow(r));
  ws.getRow(1).font={bold:true};ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFDDEBE7'}};w.forEach((x,i)=>ws.getColumn(i+1).width=x);ws.views=[{state:'frozen',ySplit:1}];return ws};
 const list=(ws:any,col:string,items:string,n:number)=>{for(let r=2;r<=n;r++)ws.getCell(`${col}${r}`).dataValidation={type:'list',allowBlank:true,formulae:[`"${items}"`]}};
 add('Petunjuk',['Petunjuk'],[
  [template?'Template SIGNAL. Baris contoh berisi data sintetis: ganti dengan data sekolah Anda.':'Ekspor data SIGNAL.'],
  ['Isi tiap sheet sesuai segmennya: Pengaturan (hari aktif), Jam, Kelas, Beban JP, Guru.'],
  ['Jangan ubah nama sheet dan judul kolom baris 1. Sheet Jadwal (jika ada) hanya laporan dan diabaikan saat impor.'],
  ['Kelas di Beban JP harus ada di sheet Kelas. Guru di sheet Guru harus ada di Beban JP.'],
  ['Mapel layak: dipisah koma, kosong = bebas. Maks JP guru: kosong = tanpa batas. Jam mulai/selesai format HH:MM, boleh kosong.'],
  ['Impor mengganti seluruh data dan mengosongkan jadwal draft. Riwayat versi tetap ada.']],[110]);
 const a=add('Pengaturan',['Hari','Aktif','Maks JP'],DAYS.map(x=>[DN[x],d.activeDays.includes(x)?'YA':'TIDAK',d.maxJPPerDay[x]??10]),[14,10,10]);list(a,'B','YA,TIDAK',7);
 const j=add('Jam',['Jam','Jenis','Mulai','Selesai'],d.slots.map(s=>[s.index,TLAB[s.type],s.start,s.end]),[8,22,10,10]);list(j,'B',Object.values(TLAB).join(','),40);
 add('Kelas',['Kelas'],d.classes.map(c=>[c]),[14]);
 add('Beban JP',['Kelas','Mapel','Guru','JP'],d.requirements.map(r=>[r.classId,r.subject,r.teacher,r.jp]),[10,22,22,8]);
 add('Guru',['Guru','Mapel layak','Maks JP'],[...new Set(d.requirements.map(r=>r.teacher))].map(g=>[g,(d.qualifications?.[g]??[]).join(', '),d.teacherMax?.[g]??'']),[22,36,10]);
 if(!template&&es.length){const rm=new Map(d.requirements.map(r=>[r.id,r]));
  add('Jadwal',['Kelas','Hari','Jam','Mapel','Guru'],[...es].sort((x,y)=>x.classId.localeCompare(y.classId)||DAYS.indexOf(x.day)-DAYS.indexOf(y.day)||x.slot-y.slot).map(e=>[e.classId,DN[e.day],e.slot,rm.get(e.reqId)?.subject??'',rm.get(e.reqId)?.teacher??'']),[10,10,8,22,22])}
 return new Blob([await wb.xlsx.writeBuffer()],{type:MIME})}

export async function bacaXlsx(file:File):Promise<{data?:Data;errors:string[];info:string[]}>{
 const X:any=(await import('exceljs')).default,wb=new X.Workbook();await wb.xlsx.load(await file.arrayBuffer());
 const err:string[]=[];
 const rows=(name:string,need:string[])=>{const ws=wb.getWorksheet(name);if(!ws){err.push(`Sheet "${name}" tidak ditemukan.`);return[]}
  const h=new Map<string,number>();ws.getRow(1).eachCell((c:any,i:number)=>h.set(t(c.value).toLowerCase(),i));
  const miss=need.filter(n=>!h.has(n));if(miss.length){err.push(`Sheet "${name}": kolom ${miss.join(', ')} tidak ada.`);return[]}
  const out:{r:number;v:Record<string,string>}[]=[];
  for(let r=2;r<=ws.rowCount;r++){const v:Record<string,string>={};let any=false;for(const[k,i]of h){const x=t(ws.getRow(r).getCell(i).value);v[k]=x;if(x)any=true}if(any)out.push({r,v})}
  return out};
 const E=(s:string,r:number,m:string)=>err.push(`${s} baris ${r}: ${m}`);
 const byName=new Map<string,Day>(DAYS.flatMap(k=>[[DN[k].toLowerCase(),k],[k.toLowerCase(),k]] as [string,Day][]));
 const act=new Set<Day>(),maxJP:Partial<Record<Day,number>>={},seenD=new Set<Day>();
 for(const{r,v}of rows('Pengaturan',['hari','aktif','maks jp'])){const day=byName.get(v.hari.toLowerCase());if(!day){E('Pengaturan',r,`hari "${v.hari}" tidak dikenal`);continue}
  if(seenD.has(day))E('Pengaturan',r,`hari ${v.hari} ganda`);seenD.add(day);const a=v.aktif.toUpperCase();
  if(a!=='YA'&&a!=='TIDAK'){E('Pengaturan',r,'Aktif harus YA atau TIDAK');continue}
  if(a==='YA'){const n=int(v['maks jp']);if(!(n>=1&&n<=14))E('Pengaturan',r,'Maks JP harus 1 sampai 14');else{act.add(day);maxJP[day]=n}}}
 if(!act.size&&!err.some(x=>x.startsWith('Sheet "Pengaturan"')))err.push('Pengaturan: minimal satu hari aktif.');
 const slots:Slot[]=[];const tm=(s:string,r:number)=>{if(!s)return'';const m=/^(\d{1,2})[:.](\d{2})$/.exec(s);if(!m||+m[1]>23||+m[2]>59){E('Jam',r,`waktu "${s}" tidak valid (HH:MM)`);return''}return`${p2(+m[1])}:${m[2]}`};
 for(const{r,v}of rows('Jam',['jam','jenis','mulai','selesai'])){const i=int(v.jam),ty=TYPE[v.jenis.toLowerCase()];
  if(i!==slots.length+1)E('Jam',r,`nomor jam harus berurutan mulai 1 (seharusnya ${slots.length+1})`);
  if(!ty)E('Jam',r,`jenis "${v.jenis}" tidak dikenal`);
  const s=tm(v.mulai,r),e=tm(v.selesai,r);if(s&&e&&e<=s)E('Jam',r,'selesai harus setelah mulai');
  slots.push({index:slots.length+1,type:ty??'OTHER',start:s,end:e})}
 if(slots.length&&!slots.some(x=>x.type==='TEACHING'))err.push('Jam: minimal satu jam Belajar Mengajar.');
 const classes:string[]=[];for(const{r,v}of rows('Kelas',['kelas'])){if(classes.includes(v.kelas))E('Kelas',r,`kelas ${v.kelas} ganda`);else classes.push(v.kelas)}
 if(classes.length<1||classes.length>10)err.push('Kelas: isi 1 sampai 10 kelas.');
 const reqs:Req[]=[],seenR=new Set<string>();
 for(const{r,v}of rows('Beban JP',['kelas','mapel','guru','jp'])){const jp=int(v.jp);
  if(!classes.includes(v.kelas))E('Beban JP',r,`kelas "${v.kelas}" tidak ada di sheet Kelas`);
  if(!v.mapel||!v.guru)E('Beban JP',r,'Mapel dan Guru wajib diisi');
  if(!(jp>=1&&jp<=20))E('Beban JP',r,'JP harus 1 sampai 20');
  const k=`${v.kelas}|${v.mapel}`;if(seenR.has(k))E('Beban JP',r,`${v.kelas} ${v.mapel} ganda`);seenR.add(k);
  reqs.push({id:`${v.kelas}-${v.mapel}`,classId:v.kelas,subject:v.mapel,teacher:v.guru,jp})}
 const qual:Record<string,string[]>={},tmax:Record<string,number>={},teachers=new Set(reqs.map(x=>x.teacher));
 for(const{r,v}of rows('Guru',['guru','mapel layak','maks jp'])){
  if(!teachers.has(v.guru))E('Guru',r,`guru "${v.guru}" tidak ada di Beban JP`);
  const q=v['mapel layak'].split(',').map(x=>x.trim()).filter(Boolean);if(q.length)qual[v.guru]=q;
  if(v['maks jp']){const n=int(v['maks jp']);if(!(n>=1))E('Guru',r,'Maks JP harus angka positif atau kosong');else tmax[v.guru]=n}}
 const d:Data={school:'Hasil impor spreadsheet',activeDays:DAYS.filter(x=>act.has(x)),maxJPPerDay:maxJP,slots,classes,requirements:reqs,qualifications:qual,teacherMax:tmax};
 if(!err.length){const kap=teachingSlots(d).length*d.activeDays.length;
  for(const c of classes){const n=reqs.filter(x=>x.classId===c).reduce((a,x)=>a+x.jp,0);if(n>kap)err.push(`Beban JP: kelas ${c} ${n} JP melebihi kapasitas ${kap} JP`)}
  err.push(...checkData(d).map(x=>x.msg))}
 return{data:err.length?undefined:d,errors:err,info:[`${d.activeDays.length} hari aktif, ${slots.length} jam, ${classes.length} kelas`,`${reqs.length} baris beban JP, ${teachers.size} guru`]}}
