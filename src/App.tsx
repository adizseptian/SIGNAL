import {useEffect,useMemo,useState,type CSSProperties} from 'react';
import {DAYS,checkData,generate,sampleData,teachingSlots,validate,type Data,type Entry,type Issue} from './domain';
import {repo,type Version} from './storage';
const TITLE:Record<string,string>={jadwal:'Jadwal Pelajaran',guru:'Beban Guru',atur:'Hari & Jam',sheet:'Impor & Ekspor',beban:'Beban JP',versi:'Versi',data:'Data (JSON)'};
const hue=(x:string)=>[...x].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7)%360;
export default function App(){
 const [data,setData]=useState<Data>(sampleData),[entries,setEntries]=useState<Entry[]>([]),[cls,setCls]=useState(sampleData.classes[0]);
 const [issues,setIssues]=useState<Issue[]|null>(null),[msg,setMsg]=useState(''),[json,setJson]=useState(''),[over,setOver]=useState(''),[imp,setImp]=useState<{data?:Data;errors:string[];info:string[];name:string}|null>(null),[vers,setVers]=useState<Version[]>([]),[tab,setTab]=useState<'jadwal'|'guru'|'atur'|'sheet'|'beban'|'versi'|'data'>('jadwal'),[undo,setUndo]=useState<Entry[][]>([]),[sel,setSel]=useState<Entry|null>(null),[to,setTo]=useState({day:'SEN',slot:1});
 useEffect(()=>{repo.load().then(s=>{if(s){setData(s.data);setEntries(s.entries);setCls(s.data.classes[0]);setVers(s.versions??[])}}).catch(()=>setMsg('Penyimpanan lokal tidak tersedia. Ekspor backup secara berkala.'))},[]);
 const persist=(d:Data,e:Entry[],v:Version[]=vers)=>repo.save({data:d,entries:e,versions:v,updatedAt:new Date().toISOString(),schemaVersion:1}).catch(()=>setMsg('Gagal menyimpan ke browser.'));
 const rm=useMemo(()=>new Map(data.requirements.map(r=>[r.id,r])),[data]);
 const ts=teachingSlots(data);
 const buat=()=>{const r=generate(data);setMsg(r.status==='SUCCESS'?`Jadwal dibuat (${r.tries} percobaan). Tekan Periksa Jadwal.`:`Status: ${r.status}. ${r.status==='SEARCH_LIMIT_REACHED'?'Pencarian berhenti di batas, bukan bukti mustahil.':r.status==='INVALID_INPUT'?(checkData(data)[0]?.msg??''):''}`);
  if(r.status==='SUCCESS'){setEntries(r.entries);setIssues(null);persist(data,r.entries)}};
 const pindah=(from:Entry,day:Entry['day'],slot:number)=>{
  if(from.day===day&&from.slot===slot)return;
  if(!ts.includes(slot)||!data.activeDays.includes(day)){setMsg('Ditolak: jam itu bukan jam belajar.');return}
  const tgt=entries.find(e=>e.classId===from.classId&&e.day===day&&e.slot===slot);
  const next=entries.map(e=>e===from?{...e,day,slot}:e===tgt?{...e,day:from.day,slot:from.slot}:e);
  const before=validate(data,entries).length,after=validate(data,next);
  if(after.length>before){setMsg('Ditolak: '+after.find(x=>!validate(data,entries).some(y=>y.msg===x.msg))?.msg);return}
  setUndo([...undo,entries]);setEntries(next);setSel(null);setIssues(null);setMsg('Dipindahkan.');persist(data,next)};
 const batal=()=>{const u=undo[undo.length-1];if(!u)return;setUndo(undo.slice(0,-1));setEntries(u);persist(data,u)};
 const stat=useMemo(()=>{const m=new Map<string,{jp:number;day:Record<string,number>}>();
  for(const e of entries){const t=rm.get(e.reqId)?.teacher??'?';const v=m.get(t)??{jp:0,day:{}};v.jp++;v.day[e.day]=(v.day[e.day]??0)+1;m.set(t,v)}
  return[...m].sort((a,b)=>b[1].jp-a[1].jp)},[entries,rm]);
const unduh=(b:Blob,n:string)=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;a.click()};
 const tmpl=async()=>{const{buatXlsx}=await import('./sheet');unduh(await buatXlsx(sampleData,[],true),'SIGNAL_template.xlsx')};
 const eks=async()=>{const{buatXlsx}=await import('./sheet');unduh(await buatXlsx(data,entries,false),'SIGNAL_data.xlsx')};
 const pilih=async(f:File)=>{try{const{bacaXlsx}=await import('./sheet');setImp({...await bacaXlsx(f),name:f.name})}catch{setImp({errors:['File tidak bisa dibaca. Gunakan file .xlsx dari template.'],info:[],name:f.name})}};
 const terap=()=>{if(!imp?.data||imp.errors.length)return;if(!window.confirm('Mengganti seluruh data dan mengosongkan jadwal draft. Riwayat versi tetap ada. Lanjut?'))return;
  setUndo([]);upd(imp.data,[]);setCls(imp.data.classes[0]);setImp(null);setMsg('Data dari spreadsheet diterapkan. Tekan Buat Jadwal.')};
 const sheetTab=<div className="wrap pad"><h3>Template &amp; ekspor</h3><div className="bar"><button className="pri" onClick={tmpl}>Unduh Template</button><button onClick={eks}>Ekspor Data{entries.length?' + Jadwal':''}</button></div>
  <small>Sheet: Petunjuk, Pengaturan, Jam, Kelas, Beban JP, Guru. Isi tiap sheet sesuai segmennya.</small>
  <h3>Impor</h3><input type="file" accept=".xlsx" onChange={e=>{const f=e.target.files?.[0];if(f)pilih(f);e.target.value=''}}/>
  {imp&&<div className={'note '+(imp.errors.length?'bad':'ok')}><b>{imp.name}</b>{imp.errors.length?` — ${imp.errors.length} masalah. Perbaiki file lalu impor ulang:`:' — siap diterapkan:'}
   <ul>{(imp.errors.length?imp.errors.slice(0,30):imp.info).map((x,i)=><li key={i}>{x}</li>)}</ul>{imp.errors.length>30&&<small>…dan {imp.errors.length-30} lainnya</small>}
   <div className="bar"><button className="pri" disabled={!!imp.errors.length||!imp.data} onClick={terap}>Terapkan (ganti semua data)</button><button onClick={()=>setImp(null)}>Batal</button></div></div>}</div>;
 const cek=()=>[...checkData(data),...validate(data,entries)];
 const pdf=async(k:'kelas'|'guru'|'sekolah',who:string|null)=>{const src=vers.length?vers[vers.length-1]:null,es=src?src.entries:entries;if(!es.length){setMsg('Belum ada jadwal.');return}
  setMsg(!src?'PDF dari draft (belum diterbitkan).':bedaDraft?`PDF dari Versi ${src.n}; perubahan draft belum ikut.`:`PDF dari Versi ${src.n}.`);
  const {buatPdf}=await import('./pdf');buatPdf(k,who,src?src.data:data,es,src?`Versi ${src.n}`:'DRAFT')};
 const upd=(d:Data,es:Entry[]=entries)=>{setData(d);setEntries(es);setIssues(null);persist(d,es)};
 const TL:Record<string,string>={TEACHING:'Belajar Mengajar',ASSEMBLY:'Upacara',BREAK:'Istirahat',RELIGIOUS:'Religi',OTHER:'Kegiatan Lain'};
 const setSlot=(i:number,patch:object)=>upd({...data,slots:data.slots.map(x=>x.index===i?{...x,...patch}:x)});
 const setReq=(id:string,patch:object)=>upd({...data,requirements:data.requirements.map(r=>r.id===id?{...r,...patch}:r)});
 const terbit=()=>{const iss=cek();if(!entries.length||iss.length){setMsg(!entries.length?'Belum ada jadwal.':`Tidak bisa terbit: ada ${iss.length} masalah. Tekan Periksa Jadwal.`);return}
  const v=[...vers,{n:vers.length+1,at:new Date().toISOString(),data,entries}];setVers(v);persist(data,entries,v);setMsg(`Versi ${v.length} diterbitkan.`)};
 const pulihkan=(v:Version)=>{if(validate(v.data,v.entries).length){setMsg('Snapshot tidak lolos validasi.');return}setUndo([...undo,entries]);upd(v.data,v.entries);setCls(v.data.classes[0]);setMsg(`Versi ${v.n} dipulihkan sebagai draft. Riwayat tetap utuh.`)};
 const bedaDraft=vers.length>0&&JSON.stringify(entries)!==JSON.stringify(vers[vers.length-1].entries);
 const atur=<div className="wrap pad"><h3>Hari aktif</h3><div className="bar">{DAYS.map(d=><label key={d}><input type="checkbox" checked={data.activeDays.includes(d)} onChange={()=>upd({...data,activeDays:DAYS.filter(x=>x===d?!data.activeDays.includes(d):data.activeDays.includes(x))})}/> {d}</label>)}</div>
  <h3>Maks JP per hari</h3><div className="bar">{data.activeDays.map(d=><label key={d}>{d} <input type="number" min={1} max={14} value={data.maxJPPerDay[d]??10} onChange={e=>upd({...data,maxJPPerDay:{...data.maxJPPerDay,[d]:+e.target.value}})}/></label>)}</div>
  <h3>Jam ke-</h3><table><thead><tr><th>Jam</th><th>Jenis</th><th>Mulai</th><th>Selesai</th></tr></thead><tbody>{data.slots.map(x=><tr key={x.index}><th>{x.index}</th>
  <td><select value={x.type} onChange={e=>setSlot(x.index,{type:e.target.value})}>{Object.entries(TL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></td>
  <td><input type="time" value={x.start} onChange={e=>setSlot(x.index,{start:e.target.value})}/></td>
  <td><input type="time" value={x.end} onChange={e=>setSlot(x.index,{end:e.target.value})}/>{x.start&&x.end&&x.end<=x.start&&<small className="err"> selesai harus setelah mulai</small>}</td></tr>)}</tbody></table>
  <div className="bar"><button onClick={()=>upd({...data,slots:[...data.slots,{index:data.slots.length+1,type:'TEACHING',start:'',end:''}]})}>Tambah jam</button><button disabled={data.slots.length<2} onClick={()=>{const i=data.slots.length;upd({...data,slots:data.slots.slice(0,-1)},entries.filter(e=>e.slot!==i))}}>Hapus jam terakhir</button></div>
  <small>Jam non-belajar tidak boleh berisi pelajaran. Setelah mengubah struktur, tekan Buat Jadwal atau Periksa Jadwal.</small></div>;
 const kap=ts.length*data.activeDays.length;
 const beban=<div className="wrap pad"><label>Kelas (pisahkan koma): <input defaultValue={data.classes.join(', ')} onBlur={e=>{const c=e.target.value.split(',').map(x=>x.trim()).filter(Boolean);if(c.length&&c.length<=10){upd({...data,classes:c,requirements:data.requirements.filter(r=>c.includes(r.classId))},entries.filter(x=>c.includes(x.classId)));setCls(c[0])}else setMsg('Isi 1 sampai 10 kelas.')}}/></label>
  <table><thead><tr><th>Kelas</th><th>Mapel</th><th>Guru</th><th>JP</th><th/></tr></thead><tbody>{data.requirements.map(r=><tr key={r.id}>
  <td><select value={r.classId} onChange={e=>setReq(r.id,{classId:e.target.value})}>{data.classes.map(c=><option key={c}>{c}</option>)}</select></td>
  <td><input value={r.subject} onChange={e=>setReq(r.id,{subject:e.target.value})}/></td><td><input value={r.teacher} onChange={e=>setReq(r.id,{teacher:e.target.value})}/></td>
  <td><input type="number" min={1} max={20} value={r.jp} onChange={e=>setReq(r.id,{jp:Math.max(1,+e.target.value)})}/></td>
  <td><button onClick={()=>upd({...data,requirements:data.requirements.filter(x=>x.id!==r.id)},entries.filter(e=>e.reqId!==r.id))}>Hapus</button></td></tr>)}</tbody></table>
  <div className="bar"><button onClick={()=>upd({...data,requirements:[...data.requirements,{id:'r'+Date.now(),classId:data.classes[0],subject:'Mapel baru',teacher:'Guru baru',jp:2}]})}>Tambah baris</button></div>
  <p>{data.classes.map(c=>{const t=data.requirements.filter(r=>r.classId===c).reduce((a,r)=>a+r.jp,0);return <span key={c} className={t>kap?'err':''}>{c}: {t}/{kap} JP &nbsp;</span>})}</p>
  <h3>Guru: kelayakan &amp; batas beban</h3><table><thead><tr><th>Guru</th><th>Mapel layak (koma; kosong = bebas)</th><th>Maks JP</th><th>Beban</th></tr></thead><tbody>{[...new Set(data.requirements.map(r=>r.teacher))].map(t=>{const tot=data.requirements.filter(r=>r.teacher===t).reduce((a,r)=>a+r.jp,0),mx=data.teacherMax?.[t];
  return <tr key={t+(data.qualifications?.[t]?.join()??'')+(mx??'')}><th>{t}</th><td><input defaultValue={(data.qualifications?.[t]??[]).join(', ')} onBlur={e=>{const l=e.target.value.split(',').map(x=>x.trim()).filter(Boolean);const q={...(data.qualifications??{})};if(l.length)q[t]=l;else delete q[t];upd({...data,qualifications:q})}}/></td>
  <td><input type="number" min={0} defaultValue={mx??''} onBlur={e=>{const m={...(data.teacherMax??{})};const n=+e.target.value;if(n>0)m[t]=n;else delete m[t];upd({...data,teacherMax:m})}}/></td><td className={mx&&tot>mx?'err':''}>{tot}</td></tr>})}</tbody></table>
  {checkData(data).map((x,i)=><div key={i} className="note bad">{x.msg}</div>)}
  <small>Ubah JP lalu tekan Buat Jadwal. Jadwal lama yang tidak sesuai akan ditandai saat Periksa Jadwal.</small></div>;
 const versi=<div className="wrap pad"><div className="bar"><button className="pri" onClick={terbit}>Terbitkan sekarang</button></div>{bedaDraft&&<div className="note">Draft berbeda dari versi aktif (Versi {vers.length}).</div>}
  <table><thead><tr><th>Versi</th><th>Waktu</th><th>JP</th><th/></tr></thead><tbody>{[...vers].reverse().map(v=><tr key={v.n}><th>{v.n}{v.n===vers.length?' (aktif)':''}</th><td>{new Date(v.at).toLocaleString('id-ID')}</td><td>{v.entries.length}</td><td><button onClick={()=>pulihkan(v)}>Pulihkan jadi draft</button></td></tr>)}</tbody></table>{!vers.length&&<small>Belum ada versi.</small>}</div>;
 const periksa=()=>setIssues(cek());
 const ekspor=()=>{const b=new Blob([JSON.stringify({formatName:'signal-backup',schemaVersion:1,exportedAt:new Date().toISOString(),payload:{data,entries}},null,1)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='signal-backup.json';a.click()};
 const terapkan=()=>{try{const p=JSON.parse(json);const d=(p.payload?.data??p) as Data;if(!d.classes||!d.requirements||!d.slots)throw 0;setData(d);setEntries(p.payload?.entries??[]);setCls(d.classes[0]);persist(d,p.payload?.entries??[]);setMsg('Data diterapkan.');setTab('jadwal')}catch{setMsg('JSON tidak valid. Data lama tidak diubah.')}};
 return <div className="app"><aside><h1>SIGNAL</h1><p>Penyusun jadwal pelajaran</p>
  <button className={tab==='jadwal'?'on':''} onClick={()=>setTab('jadwal')}>Jadwal</button>
  <button className={tab==='atur'?'on':''} onClick={()=>setTab('atur')}>Hari &amp; Jam</button>
  <button className={tab==='beban'?'on':''} onClick={()=>setTab('beban')}>Beban JP</button>
  <button className={tab==='sheet'?'on':''} onClick={()=>setTab('sheet')}>Impor/Ekspor</button>
  <button className={tab==='versi'?'on':''} onClick={()=>setTab('versi')}>Versi</button>
  <button className={tab==='guru'?'on':''} onClick={()=>setTab('guru')}>Beban Guru</button>
  <button className={tab==='data'?'on':''} onClick={()=>{setJson(JSON.stringify(data,null,1));setTab('data')}}>Data</button>
  <small>Aplikasi publik tanpa login. Data tersimpan di browser ini; ekspor backup berkala. Risiko diterima operator.</small></aside>
 <main><header className="top"><div><p className="eyebrow">{data.school}</p><h2>{TITLE[tab]}</h2></div><span className={'pill '+(vers.length&&!bedaDraft?'live':'draft')}>{!vers.length?'Draft':bedaDraft?`Draft · dasar Versi ${vers.length}`:`Versi ${vers.length} aktif`}</span></header><div className="bar dock"><button className="pri" onClick={buat}>Buat Jadwal</button><button onClick={terbit} disabled={!entries.length}>Terbitkan</button><button onClick={periksa} disabled={!entries.length}>Periksa Jadwal</button><button onClick={batal} disabled={!undo.length}>Urungkan</button><button onClick={ekspor}>Ekspor Backup</button><button onClick={()=>pdf('kelas',cls)}>PDF Kelas {cls}</button><button onClick={()=>pdf('sekolah',null)}>PDF Semua Kelas</button><button onClick={()=>window.print()}>Cetak</button></div>
 {msg&&<div className="note" role="status">{msg}</div>}
 {issues&&<div className={'note '+(issues.length?'bad':'ok')}>{issues.length?`Ada ${issues.length} masalah`:'Lolos: semua aturan wajib terpenuhi'}<ul>{issues.slice(0,20).map((x,i)=><li key={i}>[{x.rule}] {x.msg}</li>)}</ul></div>}
 {tab==='sheet'?sheetTab:tab==='atur'?atur:tab==='beban'?beban:tab==='versi'?versi:tab==='guru'?<div className="wrap"><table><thead><tr><th>Guru</th><th>JP KBM</th>{data.activeDays.map(d=><th key={d}>{d}</th>)}<th/></tr></thead><tbody>{stat.map(([t,v])=><tr key={t}><th>{t}</th><td>{v.jp}{data.teacherMax?.[t]?`/${data.teacherMax[t]}`:''}</td>{data.activeDays.map(d=><td key={d}>{v.day[d]??0}</td>)}<td><button onClick={()=>pdf('guru',t)}>PDF</button></td></tr>)}</tbody></table></div>:tab==='jadwal'?<>{!entries.length&&<div className="empty"><h3>Belum ada jadwal</h3><p>Data siap. Satu langkah: susun jadwal otomatis.</p><button className="pri" onClick={buat}>Buat Jadwal</button></div>}<div className="tabs">{data.classes.map(c=><button key={c} className={c===cls?'on':''} onClick={()=>setCls(c)}>{c}</button>)}</div>
  <div className="wrap"><table><thead><tr><th>Jam</th>{data.activeDays.map(d=><th key={d}>{d}</th>)}</tr></thead><tbody>
  {data.slots.map(s=><tr key={s.index} className={s.type!=='TEACHING'?'brk':''}><th>{s.index}</th>{data.activeDays.map(day=>{const e=entries.find(x=>x.classId===cls&&x.day===day&&x.slot===s.index);const r=e&&rm.get(e.reqId);
   return <td key={day} className={(sel&&sel===e?'sel ':'')+(over===day+'|'+s.index?'over':'')} onDragEnter={()=>setOver(day+'|'+s.index)} onDragLeave={()=>setOver('')} onDragOver={ev=>ev.preventDefault()} onDrop={ev=>{ev.preventDefault();setOver('');try{const f=JSON.parse(ev.dataTransfer.getData('text'));const src=entries.find(x=>x.classId===f.c&&x.day===f.d&&x.slot===f.s);if(src)pindah(src,day,s.index)}catch{}}}>{s.type!=='TEACHING'?s.type==='BREAK'?'Istirahat':s.type:r?<span className="chip" style={{'--h':hue(r.subject)} as CSSProperties} draggable tabIndex={0} onClick={()=>{setSel(e);setTo({day:e.day,slot:e.slot})}} onDragStart={ev=>ev.dataTransfer.setData('text',JSON.stringify({c:e.classId,d:e.day,s:e.slot}))}><b>{r.subject}</b><br/><small>{r.teacher}</small></span>:ts.includes(s.index)?'':''}</td>})}</tr>)}</tbody></table></div>{sel&&<div className="note">Pindahkan {rm.get(sel.reqId)?.subject}: <select value={to.day} onChange={e=>setTo({...to,day:e.target.value})}>{data.activeDays.map(d=><option key={d}>{d}</option>)}</select> <select value={to.slot} onChange={e=>setTo({...to,slot:+e.target.value})}>{ts.map(x=><option key={x}>{x}</option>)}</select> <button className="pri" onClick={()=>pindah(sel,to.day as Entry['day'],to.slot)}>Pindahkan</button> <button onClick={()=>setSel(null)}>Batal</button></div>}</>
 :<><textarea value={json} onChange={e=>setJson(e.target.value)} spellCheck={false}/><div className="bar"><button className="pri" onClick={terapkan}>Terapkan Data</button></div></>}
 </main></div>}
