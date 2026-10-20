import {jsPDF} from 'jspdf';
import type {Data,Entry} from './domain';
const TL:Record<string,string>={BREAK:'Istirahat',ASSEMBLY:'Upacara',RELIGIOUS:'Religi',OTHER:'Kegiatan Lain'};
const safe=(s:string)=>s.replace(/[^\w-]+/g,'_');
export function buatPdf(kind:'kelas'|'guru'|'sekolah',who:string|null,d:Data,es:Entry[],label:string){
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),rm=new Map(d.requirements.map(r=>[r.id,r])),days=d.activeDays;
 const items=kind==='sekolah'?d.classes:[who as string];
 items.forEach((it,p)=>{if(p)doc.addPage();
  const isT=kind==='guru',mine=es.filter(e=>isT?rm.get(e.reqId)?.teacher===it:e.classId===it);
  doc.setFont('helvetica','bold').setFontSize(14).text(`${d.school}`,12,14);
  doc.setFont('helvetica','normal').setFontSize(11).text(`Jadwal ${isT?'Guru':'Kelas'} ${it}${isT?` (${mine.length} JP KBM)`:''}  |  ${label}`,12,21);
  const x0=12,y0=27,w0=20,cw=(297-24-w0)/days.length,rh=Math.min(20,(210-y0-14)/(d.slots.length+1));
  doc.setFillColor(221,235,231).rect(x0,y0,w0+cw*days.length,rh*0.7,'F').setFont('helvetica','bold').setFontSize(9);
  doc.text('Jam',x0+2,y0+5);days.forEach((day,i)=>doc.text(day,x0+w0+cw*i+2,y0+5));
  d.slots.forEach((s,r)=>{const y=y0+rh*0.7+rh*r;const nt=s.type!=='TEACHING';
   if(nt)doc.setFillColor(241,243,240).rect(x0,y,w0+cw*days.length,rh,'F');
   doc.setDrawColor(200).rect(x0,y,w0,rh).setFont('helvetica','bold').setFontSize(9).text(String(s.index),x0+2,y+5);
   if(s.start||s.end)doc.setFont('helvetica','normal').setFontSize(7).text(`${s.start}-${s.end}`,x0+2,y+9);
   days.forEach((day,i)=>{const x=x0+w0+cw*i;doc.rect(x,y,cw,rh);
    if(nt){doc.setFont('helvetica','italic').setFontSize(8).text(TL[s.type]??'',x+2,y+5);return}
    const e=mine.find(m=>m.day===day&&m.slot===s.index),r2=e&&rm.get(e.reqId);if(!r2)return;
    doc.setFont('helvetica','bold').setFontSize(8).text(doc.splitTextToSize(r2.subject,cw-4).slice(0,2),x+2,y+5);
    doc.setFont('helvetica','normal').setFontSize(7).text(doc.splitTextToSize(isT?`Kelas ${e!.classId}`:r2.teacher,cw-4).slice(0,1),x+2,y+rh-3)})});
  doc.setFontSize(7).setTextColor(100).text(`Dicetak ${new Date().toLocaleString('id-ID')}`,12,205).setTextColor(0)});
 doc.save(`jadwal-${kind}${kind==='sekolah'?'':'-'+safe(who as string)}.pdf`)}
