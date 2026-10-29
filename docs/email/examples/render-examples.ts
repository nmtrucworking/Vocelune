import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { welcomeEmail, studyReminderEmail, dailySummaryEmail, weeklyDigestEmail, passwordResetEmail } from '../src/vocelune-email';

const appOrigin = 'https://vocelune.nguyenminhtruc.site';
const displayName = 'Người học Vocelune';
const common = { appOrigin, displayName };
const samples = [
  welcomeEmail(common),
  studyReminderEmail({...common,dateLabel:'30/10/2026',dueCards:12,newCardsAvailable:5}),
  dailySummaryEmail({...common,dateLabel:'30/10/2026',reviewCount:27,goodEasyCount:21,uniqueWordsReviewed:18,addedWords:6,words:['retain','navigate','clarify','resilient','evaluate','consistent']}),
  weeklyDigestEmail({...common,weekLabel:'26/10 – 01/11/2026',reviewCount:129,activeDays:6,wordsReviewed:73,dailyActivity:[{day:'T2',reviews:18},{day:'T3',reviews:23},{day:'T4',reviews:15},{day:'T5',reviews:31},{day:'T6',reviews:0},{day:'T7',reviews:24},{day:'CN',reviews:18}]}),
  passwordResetEmail({...common,resetUrl:`${appOrigin}/reset-password#token=DEMO-DO-NOT-USE`,expiresInMinutes:30}),
];
const out = resolve(process.cwd(), 'preview');
mkdirSync(out,{recursive:true});
for(const mail of samples){
  writeFileSync(resolve(out,`${mail.kind}.html`),mail.html,'utf8');
  writeFileSync(resolve(out,`${mail.kind}.txt`),mail.text,'utf8');
}
const cards = [
  ['welcome','Chào mừng','Giới thiệu 3 bước bắt đầu học'],
  ['study-reminder','Nhắc ôn tập','Dựa trên số thẻ đến hạn'],
  ['daily-summary','Tổng kết ngày','Chỉ số hoạt động và từ đã ôn'],
  ['weekly-digest','Báo cáo tuần','Nhịp học và phân bố 7 ngày'],
  ['password-reset','Đặt lại mật khẩu','Email bảo mật giao dịch'],
];
writeFileSync(resolve(out,'index.html'),`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vocelune — Email templates preview</title><style>
:root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f1f3fa;color:#17213b}*{box-sizing:border-box}body{margin:0}header{padding:32px 28px 24px;background:#fff;border-bottom:1px solid #e6e9f1}h1{font-size:25px;margin:0 0 5px;letter-spacing:-.7px}p{margin:0;color:#59647d;font-size:14px;line-height:22px}.shell{max-width:1450px;margin:0 auto}.layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:20px;padding:24px}.menu{display:grid;gap:10px;align-content:start}.item{background:#fff;border:1px solid #e0e4ee;border-radius:14px;padding:16px;text-align:left;cursor:pointer;color:#17213b;font:inherit}.item.active{border-color:#5949e8;background:#eeedff;box-shadow:0 0 0 1px #5949e8}.item strong{display:block;font-size:14px;margin-bottom:4px}.item span{font-size:12px;line-height:19px;color:#59647d}.viewer{background:#fff;border:1px solid #e0e4ee;border-radius:16px;overflow:hidden}.toolbar{padding:15px 20px;border-bottom:1px solid #e8eaf2;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.toolbar strong{font-size:14px}.toolbar a{font-size:13px;text-decoration:none;color:#5949e8;font-weight:650}iframe{width:100%;height:930px;border:none;background:#f7f8fc}.hint{padding:14px 20px;font-size:12px;color:#59647d;border-top:1px solid #e8eaf2}@media(max-width:800px){.layout{display:block;padding:12px}.menu{grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:12px}.item{padding:12px}header{padding:22px 16px}iframe{height:950px}}@media(max-width:450px){.menu{grid-template-columns:1fr}}
</style></head><body><header><div class="shell"><h1>Vocelune / Email Design System</h1><p>5 mẫu email HTML responsive · giao diện demo với dữ liệu giả định · không gửi email thực</p></div></header><main class="shell layout"><nav class="menu">${cards.map(([id,title,detail],i)=>`<button class="item${i?'':' active'}" data-mail="${id}"><strong>${String(i+1).padStart(2,'0')}. ${title}</strong><span>${detail}</span></button>`).join('')}</nav><section class="viewer"><div class="toolbar"><strong id="heading">Chào mừng</strong><a id="newtab" target="_blank" href="welcome.html" rel="noopener noreferrer">Mở template riêng</a></div><iframe id="frame" src="welcome.html" title="Email template preview"></iframe><div class="hint">Đây là bản xem trước trên trình duyệt. Email thực có thể hiển thị khác nhau giữa Gmail, Outlook và Apple Mail.</div></section></main><script>const items=[...document.querySelectorAll('[data-mail]')],frame=document.querySelector('#frame'),heading=document.querySelector('#heading'),newtab=document.querySelector('#newtab');items.forEach(btn=>btn.addEventListener('click',()=>{items.forEach(x=>x.classList.toggle('active',x===btn));const id=btn.dataset.mail;frame.src=id+'.html';heading.textContent=btn.querySelector('strong').textContent;newtab.href=id+'.html'}));</script></body></html>`,'utf8');
console.log(`Generated ${samples.length} HTML + text samples and preview/index.html`);
