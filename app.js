'use strict';
const TOTAL=20;
let language='ja',currentRows=[],currentConfig={},currentLoading=true,noticeKeys=[];
const words={
 ja:{page:'動画ドラフトレビュー',forKeiko:'Keiko様 確認用',episodes:'エピソード',list:'リスト表示',thumbnail:'サムネイル表示',number:'番号',column:'エピソード / ご希望の場所',status:'ステータス',review:'確認',footer:'動画ドラフト · クライアントレビュー',title:'タイトル未設定',locations:'場所は未設定',requested:'ご希望の場所',loading:'読み込み中',production:'制作中',ready:'レビュー待ち',watch:'動画を見る',close:'動画を閉じる',youtube:'YouTubeで開く',badLink:'動画リンクを修正してください。該当する再生ボタンは利用できません。',unavailable:'データを読み込めませんでした。表示中の20枠は仮表示です。ページを再読み込みしてください。',local:'データを読み込むには、公開したページを開いてください。設定方法は同梱のガイドをご確認ください。',imageMissing:'サムネイルを表示できません',view:'表示方法',language:'表示言語',episode:'エピソード'},
 ko:{page:'영상 초안 검토',forKeiko:'Keiko님 검토용',episodes:'에피소드',list:'목록 보기',thumbnail:'썸네일 보기',number:'번호',column:'에피소드 / 요청 장소',status:'상태',review:'검토',footer:'영상 초안 · 클라이언트 검토',title:'제목 미등록',locations:'장소 미등록',requested:'요청 장소',loading:'불러오는 중',production:'제작 중',ready:'검토 준비 완료',watch:'영상 보기',close:'영상 닫기',youtube:'YouTube에서 열기',badLink:'영상 링크를 수정해 주세요. 해당 재생 버튼은 일시적으로 사용할 수 없습니다.',unavailable:'데이터를 불러오지 못했습니다. 현재 20개 슬롯은 임시 표시입니다. 페이지를 새로고침해 주세요.',local:'데이터를 불러오려면 게시한 페이지를 열어 주세요. 동봉한 안내서에서 설정 방법을 확인할 수 있습니다.',imageMissing:'썸네일을 불러올 수 없습니다',view:'보기 방식',language:'표시 언어',episode:'에피소드'}
};
function t(key){return words[language][key]||key;}
function localized(value){
 if(value&&typeof value==='object'&&!Array.isArray(value))return String(value[language]||value.ja||value.ko||'').trim();
 const raw=Array.isArray(value)?value.join(' · '):String(value||'');const split=raw.indexOf('||');
 if(split<0)return raw.trim();const ja=raw.slice(0,split).trim(),ko=raw.slice(split+2).trim();return (language==='ja'?ja:ko)||ja||ko;
}
function episodeTitle(ep){return localized(ep.title)||t('title');}
function updateLanguage(){
 document.documentElement.lang=language;document.title=`KINDAI REGIONAL ROLLER COASTER — ${t('page')}`;
 document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n);});
 document.querySelectorAll('[data-lang]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.lang===language)));
 document.querySelector('.views').setAttribute('aria-label',t('view'));document.querySelector('.languages').setAttribute('aria-label',t('language'));
 document.querySelector('section').setAttribute('aria-label',t('review'));document.querySelector('#notice').textContent=noticeKeys.map(t).join(' ');
}

function blanks(){return Array.from({length:TOTAL},(_,i)=>({number:i+1,title:'',youtubeUrl:'',requestedLocations:''}));}
function videoId(value){
 try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol))return null;
 const host=u.hostname.toLowerCase();let id;
 if(host==='youtu.be')id=u.pathname.split('/')[1];
 else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(host))id=u.pathname==='/watch'?u.searchParams.get('v'):(/^\/(shorts|embed|live)\//.test(u.pathname)?u.pathname.split('/')[2]:null);
 return /^[\w-]{11}$/.test(id||'')?id:null;
 }catch{return null;}
}
function parseCSV(raw){
 const text=raw.replace(/^\uFEFF/,'');let rows=[],row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||cell===''){quoted=!quoted;}else throw Error('Invalid CSV quoting');}
 else if(c===','&&!quoted){row.push(cell);cell='';}
 else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
 else cell+=c;}
 if(quoted)throw Error('Unclosed CSV quote');if(cell||row.length){row.push(cell);rows.push(row);}
 const headers=(rows.shift()||[]).map(x=>x.trim());const keys=['number','title','youtubeUrl','requestedLocations'];
 if(keys.some(x=>!headers.includes(x)))throw Error('Missing sheet columns');
 return rows.filter(r=>r.some(x=>x.trim())).map(r=>Object.fromEntries(keys.map(k=>[k,r[headers.indexOf(k)]||''])));
}
function normalize(rows){
 if(!Array.isArray(rows))throw Error('Episodes must be an array');const out=blanks(),seen=new Set();
 for(const r of rows){const n=Number(r.number);if(!Number.isInteger(n)||n<1||n>TOTAL||seen.has(n))throw Error('Episode numbers must be unique, from 1 to 20');seen.add(n);
 const loc=r.requestedLocations||'';
 out[n-1]={number:n,title:r.title||'',youtubeUrl:String(r.youtubeUrl||'').trim(),requestedLocations:loc};}
 return out;
}
function element(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function action(label,cls,url,reason){const el=element(url?'a':'button',cls,label);if(url){el.href=url;el.target='_blank';el.rel='noopener noreferrer';}else{el.disabled=true;el.title=reason;el.setAttribute('aria-label',`${label}: ${reason}`);}return el;}
function watchAction(label,cls,ep,config,reason){
 if(!videoId(ep.youtubeUrl))return action(label,cls,null,reason);
 const button=element('button',cls,label);button.type='button';button.setAttribute('aria-haspopup','dialog');
 button.addEventListener('click',()=>openPlayer(ep,config,button));return button;
}
let playerDialog=null;
function openPlayer(ep,config,trigger){
 const id=videoId(ep.youtubeUrl);if(!id)return;
 if(playerDialog)playerDialog.close();
 const dialog=element('dialog','video-dialog');playerDialog=dialog;dialog.setAttribute('aria-labelledby','player-title');
 const panel=element('div','player-panel'),header=element('div','player-header');
 const title=element('h2','',`${t('episode')} ${String(ep.number).padStart(2,'0')} — ${episodeTitle(ep)}`);title.id='player-title';
 const close=element('button','player-close','×');close.type='button';close.setAttribute('aria-label',t('close'));close.autofocus=true;close.addEventListener('click',()=>dialog.close());header.append(title,close);
 const frame=element('iframe','player-frame');frame.title=`${t('watch')}: ${episodeTitle(ep)}`;frame.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
 frame.src=`https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0`;
 const actions=element('div','player-actions');
 actions.append(action(t('youtube'),'external-link',ep.youtubeUrl));
 panel.append(header,frame,actions);dialog.append(panel);document.body.append(dialog);
 const scrollStyle=document.body.style.overflow;document.body.style.overflow='hidden';
 dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();});
 let outsideDown=false;
 dialog.addEventListener('pointerdown',event=>{outsideDown=event.target===dialog;});
 dialog.addEventListener('click',event=>{if(outsideDown&&event.target===dialog)dialog.close();outsideDown=false;});
 dialog.addEventListener('close',()=>{frame.removeAttribute('src');frame.remove();dialog.remove();document.body.style.overflow=scrollStyle;if(playerDialog===dialog)playerDialog=null;if(trigger?.isConnected)trigger.focus({preventScroll:true});},{once:true});
 dialog.showModal();close.focus();
}
function render(rows,config={},loading=false){
 currentRows=rows;currentConfig=config;currentLoading=loading;
 const holder=document.querySelector('#episodes');holder.replaceChildren();holder.setAttribute('aria-busy',String(loading));
 for(const ep of rows){const num=String(ep.number).padStart(2,'0'),id=videoId(ep.youtubeUrl),hasURL=Boolean(ep.youtubeUrl),label=episodeTitle(ep);
 const card=element('article',`episode${hasURL?'':' empty'}`);card.setAttribute('aria-labelledby',`episode-${num}`);
 const media=id?watchAction('', 'media',ep,config):element('div','media');if(id)media.setAttribute('aria-label',`${t('watch')} ${num}: ${label}`);
 const center=element('span','center-title',label);center.setAttribute('aria-hidden','true');media.append(center);
 if(id){center.hidden=true;const img=element('img');img.src=`https://i.ytimg.com/vi/${id}/hqdefault.jpg`;img.alt=label;img.loading='lazy';img.decoding='async';img.addEventListener('error',()=>{img.remove();center.hidden=false;},{once:true});media.append(img,element('span','play','▶'));}
 const details=element('div','details'),title=element('h3','',label);title.id=`episode-${num}`;
 details.append(title,element('span','location-label',t('requested')),element('p','locations',localized(ep.requestedLocations)||t('locations')));
 const status=element('span',`status${hasURL&&!loading?' ready':''}`,t(loading?'loading':hasURL?'ready':'production'));
 const actions=element('div','actions');actions.append(watchAction(t('watch'),'watch',loading?{...ep,youtubeUrl:''}:ep,config,t(loading?'loading':hasURL?'badLink':'production')));
 const info=element('div','card-info');info.append(element('div','number',num),details,status,actions);card.append(media,info);holder.append(card);}
}
function notify(...keys){noticeKeys=keys;const box=document.querySelector('#notice');box.textContent=keys.map(t).join(' ');box.hidden=!keys.length;}
async function request(url){const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);try{const res=await fetch(url,{cache:'no-store',signal:ctrl.signal});if(!res.ok)throw Error('Data unavailable');return await res.text();}finally{clearTimeout(timer);}}
async function init(){
 updateLanguage();
 document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>{language=button.dataset.lang;updateLanguage();render(currentRows,currentConfig,currentLoading);}));
 render(blanks(),{},true);
 document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{const mode=button.dataset.view;document.querySelector('#episodes').className=`episodes ${mode}`;document.querySelector('.column-head').hidden=mode!=='list';document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));
 let config;
 try{config=JSON.parse(await request('./data.json'));}catch{render(blanks());notify(location.protocol==='file:'?'local':'unavailable');return;}
 try{let rows;
 if(config.googleSheetCsvUrl){const u=new URL(config.googleSheetCsvUrl);if(u.protocol!=='https:'||u.hostname!=='docs.google.com'||!u.pathname.startsWith('/spreadsheets/'))throw Error('Invalid sheet URL');rows=parseCSV(await request(u.href));if(!rows.length)throw Error('Empty published sheet');}
 else rows=config.episodes;
 const eps=normalize(rows);render(eps,config);
 const notes=[];if(eps.some(e=>e.youtubeUrl&&!videoId(e.youtubeUrl)))notes.push('badLink');
 notify(...notes);
 }catch{render(blanks());notify('unavailable');}
}
if(typeof document!=='undefined')init();
if(typeof module!=='undefined')module.exports={videoId,parseCSV,normalize,localized};
