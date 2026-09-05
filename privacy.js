// Only a redacted display label is stored. Never accept IP identity from the tracker payload.
export function validMaskedIp(value) {
  if (typeof value !== 'string') return null;
  const v4=value.match(/^(\d{1,3})\.\*\.\*\.(\d{1,3})$/);
  if(v4&&Number(v4[1])<=255&&Number(v4[2])<=255)return value;
  return /^[a-f0-9]{1,4}:\*:\*:[a-f0-9]{1,4}$/i.test(value)?value:null;
}
export function maskIp(value) {
  if(typeof value!=='string'||value.length>45)return null;
  const parts=value.split('.');
  if(parts.length===4&&parts.every(p=>/^\d{1,3}$/.test(p)&&Number(p)<=255))return `${Number(parts[0])}.*.*.${Number(parts[3])}`;
  if(!value.includes(':')||!/^[0-9a-f:.]+$/i.test(value))return null;
  try {
    const host=new URL(`http://[${value}]/`).hostname.slice(1,-1);
    const [left,right]=host.split('::'),l=left?left.split(':'):[],r=right?right.split(':'):[];
    const expanded=right!==undefined?[...l,...Array(8-l.length-r.length).fill('0'),...r]:l;
    if(expanded.length!==8)return null;
    return `${expanded[0]}:*:*:${expanded[7]}`;
  }catch{return null;}
}
