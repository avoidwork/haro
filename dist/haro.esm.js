const e=[8,9,"a","b"];function t(e=new ArrayBuffer(0)){return JSON.parse((new TextDecoder).decode(e))}function r(e=""){return(new TextEncoder).encode(JSON.stringify(e))}function s(e,t){for(const r of e.entries())t(r[1],r[0]);return e}function i(e="",t="|",r={}){return e.split(t).reduce(((e,s,i)=>{const n=[];return(Array.isArray(r[s])?r[s]:[r[s]]).forEach((r=>0===i?n.push(r):e.forEach((e=>n.push(`${e}${t}${r}`))))),n}),[])}function n(e,t,r,n,a){e.forEach((e=>{const h=t.get(e);s(e.includes(r)?i(e,r,a):Array.isArray(a[e])?a[e]:[a[e]],(e=>{if(h.has(e)){const t=h.get(e);t.delete(n),0===t.size&&h.delete(e)}}))}))}function a(e,t){return e instanceof Object&&t instanceof Object?s(Object.keys(t),(r=>{e[r]instanceof Object&&t[r]instanceof Object?e[r]=a(e[r],t[r]):Array.isArray(e[r])&&Array.isArray(t[r])?e[r]=e[r].concat(t[r]):e[r]=t[r]})):e=Array.isArray(e)&&Array.isArray(t)?e.concat(t):t,e}function h(){return(65536*(Math.random()+1)|0).toString(16).substring(1)}function o(e,t,r,n,a,h){s(null===h?e:[h],(e=>{const h=t.get(e);e.includes(r)?s(i(e,r,a),(e=>{!1===h.has(e)&&h.set(e,new Set),h.get(e).add(n)})):s(Array.isArray(a[e])?a[e]:[a[e]],(e=>{!1===h.has(e)&&h.set(e,new Set),h.get(e).add(n)}))}))}function c(){return h()+h()+"-"+h()+"-4"+h().substr(0,3)+"-"+e[Math.floor(4*Math.random())]+h().substr(0,3)+"-"+h()+h()+h()}class d{constructor({delimiter:e="|",id:t=c(),index:r=[],key:s="",versioning:i=!1}={}){return this.data=new Map,this.delimiter=e,this.id=t,this.index=r,this.indexes=new Map,this.key=s,this.size=0,this.versions=new Map,this.versioning=i,Object.defineProperty(this,"registry",{enumerable:!0,get:()=>Array.from(this.data.keys())}),this.reindex()}async batch(e,t="set",r=!1){let s;try{const i="del"===t?e=>this.del(e,!0,r):e=>this.set(null,e,!0,!0,r);s=await Promise.all(this.beforeBatch(e,t).map(i)),s=this.onbatch(s,t)}catch(e){throw this.onerror("batch",e),e}return s}beforeBatch(e){return e}beforeClear(){}beforeDelete(){}beforeSet(){}clear(){return this.beforeClear(),this.size=0,this.data.clear(),this.indexes.clear(),this.versions.clear(),this.reindex().onclear(),this}del(e,t=!1,r=!1,s=!1){if(!1===this.has(e))throw new Error("Record not found");const i=this.get(e,!0);this.beforeDelete(e,t,r,s),n(this.index,this.indexes,this.delimiter,e,i),this.data.delete(e),--this.size,this.ondelete(e,t,s,r),this.versioning&&this.versions.delete(e)}dump(e="records"){let t;return t="records"===e?Array.from(this.entries()):Array.from(this.indexes).map((e=>(e[1]=Array.from(e[1]).map((e=>(e[1]=Array.from(e[1]),e))),e))),t}entries(){return this.data.entries()}find(e={},t=!1){const r=Object.keys(e).sort(((e,t)=>e.localeCompare(t))).join(this.delimiter),s=this.indexes.get(r)||new Map;let n=[];if(s.size>0){const a=i(r,this.delimiter,e);n=Array.from(a.reduce(((e,t)=>(s.has(t)&&s.get(t).forEach((t=>e.add(t))),e)),new Set)).map((e=>this.get(e,t)))}return t?n:this.list(...n)}filter(e=(()=>{}),t=!1){const r=t?(e,t)=>t:(e,t)=>Object.freeze([e,Object.freeze(t)]),s=this.reduce(((t,s,i,n)=>(e.call(n,s,i)&&t.push(r(i,s)),t)),[]);return t?s:Object.freeze(s)}forEach(e,r){return this.data.forEach(((r,s)=>e(t(r),s)),r||this.data),this}get(e,r=!1){const s=this.has(e)?t(this.data.get(e)):null;return r?s:this.list(e,s)}has(e){return this.data.has(e)}keys(){return this.data.keys()}limit(e=0,t=0,r=!1){const s=this.registry.slice(e,e+t).map((e=>this.get(e,r)));return r?s:this.list(...s)}list(...e){return Object.freeze(e.map((e=>Object.freeze(e))))}map(e,t=!1){const r=[];return this.forEach(((t,s)=>r.push(e(t,s)))),t?r:this.list(...r)}onbatch(e){return e}onclear(){}ondelete(){}onerror(){}onset(){}async override(e,t="records"){if("indexes"===t)this.indexes=new Map(e.map((e=>[e[0],new Map(e[1].map((e=>[e[0],new Set(e[1])])))])));else{if("records"!==t)throw new Error("Invalid type");this.indexes.clear(),this.data=new Map(e.map((e=>[e[0],r(e[1])]))),this.size=this.data.size}return!0}reduce(e,t,r=!1){let s=t||this.data.keys().next().value;return this.forEach(((t,i)=>{s=e(s,t,i,this,r)}),this),s}reindex(e){const t=e?[e]:this.index;return e&&!1===this.index.includes(e)&&this.index.push(e),s(t,(e=>this.indexes.set(e,new Map))),this.forEach(((e,r)=>s(t,(t=>o(this.index,this.indexes,this.delimiter,r,e,t))))),this}search(e,t,r=!1){const i=new Map,n="function"==typeof e,a=e&&"function"==typeof e.test;return e&&s(t?Array.isArray(t)?t:[t]:this.index,(t=>{let s=this.indexes.get(t);s&&s.forEach(((s,h)=>{switch(!0){case n&&e(h,t):case a&&e.test(Array.isArray(h)?h.join(", "):h):case h===e:s.forEach((e=>{!1===i.has(e)&&this.has(e)&&i.set(e,this.get(e,r))}))}}))})),r?Array.from(i.values()):this.list(...Array.from(i.values()))}async set(e,t,s=!1,i=!1,h=!1,d=!1){let l,u,f=t;return null==e&&(e=this.key&&void 0!==f[this.key]?f[this.key]:c()),this.beforeSet(e,t,s,i,h,d),!1===this.has(e)?(++this.size,this.versioning&&this.versions.set(e,new Set)):(l=this.get(e,!0),n(this.index,this.indexes,this.delimiter,e,l),this.versioning&&this.versions.get(e).add(Object.freeze(this.get(e,!0))),!1===i&&(f=a(l,f))),this.data.set(e,r(f)),o(this.index,this.indexes,this.delimiter,e,f,null),u=this.get(e),this.onset(u,s,d,h),u}sort(e,t=!0){return t?Object.freeze(this.limit(0,this.size,!0).sort(e).map((e=>Object.freeze(e)))):this.limit(0,this.size,!0).sort(e)}sortBy(e,t=!1){const r=[],i=[];let n;return!1===this.indexes.has(e)&&this.reindex(e),n=this.indexes.get(e),n.forEach(((e,t)=>i.push(t))),s(i.sort(),(e=>n.get(e).forEach((e=>r.push(this.get(e,t)))))),t?r:this.list(...r)}toArray(e=!0){const r=Array.from(this.data.values()).map(t);return e&&(s(r,(e=>Object.freeze(e))),Object.freeze(r)),r}values(){return this.data.values()}where(e,t=!1,r="||"){const s=this.index.filter((t=>t in e));return s.length>0?this.filter(new Function("a",`return (${s.map((t=>{let s;if(Array.isArray(e[t]))s=`Array.isArray(a['${t}']) ? ${e[t].map((e=>`a['${t}'].includes(${"string"==typeof e?`'${e}'`:e})`)).join(` ${r} `)} : (${e[t].map((e=>`a['${t}'] === ${"string"==typeof e?`'${e}'`:e}`)).join(` ${r} `)})`;else if(e[t]instanceof RegExp)s=`Array.isArray(a['${t}']) ? a['${t}'].filter(i => ${e[t]}.test(a['${t}'])).length > 0 : ${e[t]}.test(a['${t}'])`;else{const r="string"==typeof e[t]?`'${e[t]}'`:e[t];s=`Array.isArray(a['${t}']) ? a['${t}'].includes(${r}) : a['${t}'] === ${r}`}return s})).join(") && (")});`),t):[]}}function l(e=null,t={}){const r=new d(t);return Array.isArray(e)&&r.batch(e,"set"),r}export{l as haro};