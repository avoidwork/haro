const e=[8,9,"a","b"];function t(e){return JSON.parse(JSON.stringify(e,null,0))}function r(e,t){for(const r of e.entries())t(r[1],r[0]);return e}function s(e="",t="|",r={}){return e.split(t).reduce(((e,s,i)=>{const n=[];return(Array.isArray(r[s])?r[s]:[r[s]]).forEach((r=>0===i?n.push(r):e.forEach((e=>n.push(`${e}${t}${r}`))))),n}),[])}function i(e,t,i,n,a){e.forEach((e=>{const h=t.get(e);r(e.includes(i)?s(e,i,a):Array.isArray(a[e])?a[e]:[a[e]],(e=>{if(h.has(e)){const t=h.get(e);t.delete(n),0===t.size&&h.delete(e)}}))}))}function n(e,t){return e instanceof Object&&t instanceof Object?r(Object.keys(t),(r=>{e[r]instanceof Object&&t[r]instanceof Object?e[r]=n(e[r],t[r]):Array.isArray(e[r])&&Array.isArray(t[r])?e[r]=e[r].concat(t[r]):e[r]=t[r]})):e=Array.isArray(e)&&Array.isArray(t)?e.concat(t):t,e}function a(){return(65536*(Math.random()+1)|0).toString(16).substring(1)}function h(e,t,i,n,a,h){r(null===h?e:[h],(e=>{const h=t.get(e);e.includes(i)?r(s(e,i,a),(e=>{!1===h.has(e)&&h.set(e,new Set),h.get(e).add(n)})):r(Array.isArray(a[e])?a[e]:[a[e]],(e=>{!1===h.has(e)&&h.set(e,new Set),h.get(e).add(n)}))}))}function o(){return a()+a()+"-"+a()+"-4"+a().substr(0,3)+"-"+e[Math.floor(4*Math.random())]+a().substr(0,3)+"-"+a()+a()+a()}class c{constructor({delimiter:e="|",id:t=o(),index:r=[],key:s="",versioning:i=!1}={}){return this.data=new Map,this.delimiter=e,this.id=t,this.index=r,this.indexes=new Map,this.key=s,this.versions=new Map,this.versioning=i,Object.defineProperty(this,"registry",{enumerable:!0,get:()=>Array.from(this.data.keys())}),Object.defineProperty(this,"size",{enumerable:!0,get:()=>this.data.size}),this.reindex()}batch(e,t="set"){const r="del"===t?e=>this.del(e,!0):e=>this.set(null,e,!0,!0);let s;return s=this.beforeBatch(e,t).map(r),s=this.onbatch(s,t),s}beforeBatch(e){return e}beforeClear(){}beforeDelete(){}beforeSet(){}clear(){return this.beforeClear(),this.data.clear(),this.indexes.clear(),this.versions.clear(),this.reindex().onclear(),this}del(e,t=!1){if(!1===this.has(e))throw new Error("Record not found");const r=this.get(e,!0);this.beforeDelete(e,t),i(this.index,this.indexes,this.delimiter,e,r),this.data.delete(e),this.ondelete(e,t),this.versioning&&this.versions.delete(e)}dump(e="records"){let t;return t="records"===e?Array.from(this.entries()):Array.from(this.indexes).map((e=>(e[1]=Array.from(e[1]).map((e=>(e[1]=Array.from(e[1]),e))),e))),t}entries(){return this.data.entries()}find(e={},t=!1){const r=Object.keys(e).sort(((e,t)=>e.localeCompare(t))).join(this.delimiter),i=this.indexes.get(r)||new Map;let n=[];if(i.size>0){const a=s(r,this.delimiter,e);n=Array.from(a.reduce(((e,t)=>(i.has(t)&&i.get(t).forEach((t=>e.add(t))),e)),new Set)).map((e=>this.get(e,t)))}return t?n:this.list(...n)}filter(e=(()=>{}),t=!1){const r=t?(e,t)=>t:(e,t)=>Object.freeze([e,Object.freeze(t)]),s=this.reduce(((t,s,i,n)=>(e.call(n,s)&&t.push(r(i,s)),t)),[]);return t?s:Object.freeze(s)}forEach(e,r){return this.data.forEach(((r,s)=>e(t(r),t(s))),r||this.data),this}get(e,r=!1){const s=t(this.data.get(e)||null);return r?s:this.list(e,s)}has(e){return this.data.has(e)}keys(){return this.data.keys()}limit(e=0,t=0,r=!1){const s=this.registry.slice(e,e+t).map((e=>this.get(e,r)));return r?s:this.list(...s)}list(...e){return Object.freeze(e.map((e=>Object.freeze(e))))}map(e,t=!1){const r=[];return this.forEach(((t,s)=>r.push(e(t,s)))),t?r:this.list(...r)}onbatch(e){return e}onclear(){}ondelete(){}onoverride(){}onset(){}override(e,t="records"){if("indexes"===t)this.indexes=new Map(e.map((e=>[e[0],new Map(e[1].map((e=>[e[0],new Set(e[1])])))])));else{if("records"!==t)throw new Error("Invalid type");this.indexes.clear(),this.data=new Map(e)}return this.onoverride(t),!0}reduce(e,t,r=!1){let s=t||this.data.keys().next().value;return this.forEach(((t,i)=>{s=e(s,t,i,this,r)}),this),s}reindex(e){const t=e?[e]:this.index;return e&&!1===this.index.includes(e)&&this.index.push(e),r(t,(e=>this.indexes.set(e,new Map))),this.forEach(((e,s)=>r(t,(t=>h(this.index,this.indexes,this.delimiter,s,e,t))))),this}search(e,t,s=!1){const i=new Map,n="function"==typeof e,a=e&&"function"==typeof e.test;return e&&r(t?Array.isArray(t)?t:[t]:this.index,(t=>{let r=this.indexes.get(t);r&&r.forEach(((r,h)=>{switch(!0){case n&&e(h,t):case a&&e.test(Array.isArray(h)?h.join(", "):h):case h===e:r.forEach((e=>{!1===i.has(e)&&this.has(e)&&i.set(e,this.get(e,s))}))}}))})),s?Array.from(i.values()):this.list(...Array.from(i.values()))}set(e,r,s=!1,a=!1){let c,d,l=t(r);return null==e&&(e=this.key&&void 0!==l[this.key]?l[this.key]:o()),this.beforeSet(e,r,s,a),!1===this.has(e)?this.versioning&&this.versions.set(e,new Set):(c=this.get(e,!0),i(this.index,this.indexes,this.delimiter,e,c),this.versioning&&this.versions.get(e).add(Object.freeze(t(c))),!1===a&&(l=n(t(c),l))),this.data.set(e,l),h(this.index,this.indexes,this.delimiter,e,l,null),d=this.get(e),this.onset(d,s),d}sort(e,t=!0){return t?Object.freeze(this.limit(0,this.data.size,!0).sort(e).map((e=>Object.freeze(e)))):this.limit(0,this.data.size,!0).sort(e)}sortBy(e,t=!1){const s=[],i=[];let n;return!1===this.indexes.has(e)&&this.reindex(e),n=this.indexes.get(e),n.forEach(((e,t)=>i.push(t))),r(i.sort(),(e=>n.get(e).forEach((e=>s.push(this.get(e,t)))))),t?s:this.list(...s)}toArray(e=!0){const t=Array.from(this.data.values());return e&&(r(t,(e=>Object.freeze(e))),Object.freeze(t)),t}values(){return this.data.values()}where(e,t=!1,r="||"){const s=this.index.filter((t=>t in e));return s.length>0?this.filter(new Function("a",`return (${s.map((t=>{let s;if(Array.isArray(e[t]))s=`Array.isArray(a['${t}']) ? ${e[t].map((e=>`a['${t}'].includes(${"string"==typeof e?`'${e}'`:e})`)).join(` ${r} `)} : (${e[t].map((e=>`a['${t}'] === ${"string"==typeof e?`'${e}'`:e}`)).join(` ${r} `)})`;else if(e[t]instanceof RegExp)s=`Array.isArray(a['${t}']) ? a['${t}'].filter(i => ${e[t]}.test(a['${t}'])).length > 0 : ${e[t]}.test(a['${t}'])`;else{const r="string"==typeof e[t]?`'${e[t]}'`:e[t];s=`Array.isArray(a['${t}']) ? a['${t}'].includes(${r}) : a['${t}'] === ${r}`}return s})).join(") && (")});`),t):[]}}function d(e=null,t={}){const r=new c(t);return Array.isArray(e)&&r.batch(e,"set"),r}export{d as haro};