import type {Data,Entry} from './domain';
export interface Version{n:number;at:string;data:Data;entries:Entry[]}
export interface State{data:Data;entries:Entry[];versions?:Version[];updatedAt:string;schemaVersion:1}
const open=()=>new Promise<IDBDatabase>((res,rej)=>{const r=indexedDB.open('signal',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
export interface ScheduleRepository{load():Promise<State|null>;save(s:State):Promise<void>}
export const repo:ScheduleRepository={
 async load(){const db=await open();return new Promise(res=>{const q=db.transaction('kv').objectStore('kv').get('state');q.onsuccess=()=>res((q.result as State)??null);q.onerror=()=>res(null)})},
 async save(s){const db=await open();return new Promise((res,rej)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(s,'state');t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}};
