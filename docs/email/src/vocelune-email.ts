/**
 * Vocelune email templates · Standalone TypeScript (no rendering dependencies)
 * Compatible with NestJS + Resend REST + SMTP/Nodemailer.
 * All user-controlled content is HTML escaped. Only http(s) URLs with safe origins are accepted.
 */

export type VoceluneEmail = {
  kind: 'welcome' | 'study-reminder' | 'daily-summary' | 'weekly-digest' | 'password-reset';
  subject: string;
  html: string;
  text: string;
};

export interface BaseEmailInput {
  displayName: string;
  /** Site origin, e.g. https://vocelune.nguyenminhtruc.site */
  appOrigin: string;
}
export interface StudyReminderInput extends BaseEmailInput {
  dateLabel: string;
  dueCards: number;
  newCardsAvailable: number;
}
export interface DailySummaryInput extends BaseEmailInput {
  dateLabel: string;
  reviewCount: number;
  goodEasyCount: number;
  uniqueWordsReviewed: number;
  addedWords: number;
  /** A few words reviewed; optional and not required for an email to render. */
  words?: string[];
}
export interface WeeklyDigestInput extends BaseEmailInput {
  weekLabel: string;
  reviewCount: number;
  activeDays: number;
  wordsReviewed: number;
  /** 7 days, ordered chronologically. e.g. {day:'T2', reviews:12}. */
  dailyActivity: { day: string; reviews: number }[];
}
export interface PasswordResetInput extends BaseEmailInput {
  resetUrl: string;
  expiresInMinutes: number;
}

const C = {
  primary: '#5949E8', primarySoft: '#EAE8FF', ink: '#17213B', canvas: '#F7F8FC',
  secondary: '#59647D', border: '#E5E9F2', mint: '#D8F7F1', success: '#1B786E', white: '#FFFFFF',
  subdued: '#8992A7',
};
const sans = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function safeUrl(url: string): string {
  const parsed = new URL(url);
  const isLocal = (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') && parsed.protocol === 'http:';
  if (parsed.protocol !== 'https:' && !isLocal) throw new Error('Email links must be HTTPS (or local development HTTP)');
  if (parsed.username || parsed.password) throw new Error('Credentials in email URLs are forbidden');
  return parsed.toString();
}
function route(origin: string, path: string) {
  const u = new URL(safeUrl(origin));
  return safeUrl(new URL(path, u.origin).toString());
}
function number(value: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) throw new Error('Email metrics must be nonnegative integers');
  return value;
}
function nameOf(name: string): string { return (name?.trim() || 'bạn').slice(0, 100); }
function paragraph(content: string): string {
  return `<p style="font-family:${sans};font-size:15px;line-height:25px;color:${C.secondary};margin:0 0 18px">${content}</p>`;
}
function heading(title: string): string {
  return `<h1 style="font-family:${sans};font-size:30px;line-height:39px;letter-spacing:-0.8px;color:${C.ink};font-weight:750;margin:0 0 16px">${escapeHtml(title)}</h1>`;
}
function sectionLabel(label: string): string {
  return `<p style="font-family:${sans};font-size:11px;letter-spacing:1.9px;line-height:16px;font-weight:800;color:${C.primary};text-transform:uppercase;margin:0 0 14px">${escapeHtml(label)}</p>`;
}
function button(label: string, href: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;margin:24px 0 10px"><tr><td bgcolor="${C.primary}" style="background:${C.primary};border-radius:12px;text-align:center"><a href="${escapeHtml(safeUrl(href))}" style="display:inline-block;padding:16px 25px;border-radius:12px;text-decoration:none;font-family:${sans};font-size:14px;line-height:20px;font-weight:700;color:#ffffff">${escapeHtml(label)}</a></td></tr></table>`;
}
function subtleLink(text: string, href: string): string {
  return `<a href="${escapeHtml(safeUrl(href))}" style="color:${C.primary};font-weight:650;text-decoration:underline">${escapeHtml(text)}</a>`;
}
function stat(label: string, value: number | string, detail?: string): string {
  const val = typeof value === 'number' ? number(value).toLocaleString('vi-VN') : escapeHtml(value);
  return `<td class="mobile-stat" valign="top" width="50%" style="padding:0 6px 10px 0;vertical-align:top"><table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="border:1px solid ${C.border};border-radius:14px;background:#ffffff"><tr><td style="padding:20px 18px"><div style="font-family:${sans};font-size:30px;line-height:36px;letter-spacing:-0.5px;font-weight:750;color:${C.ink}">${val}</div><div style="font-family:${sans};font-size:12px;line-height:19px;color:${C.secondary};margin-top:7px">${escapeHtml(label)}</div>${detail ? `<div style="font-family:${sans};font-size:11px;line-height:17px;color:${C.subdued};margin-top:3px">${escapeHtml(detail)}</div>` : ''}</td></tr></table></td>`;
}
function statsRow(a: string, av: number | string, b: string, bv: number | string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 4px"><tr>${stat(a,av)}${stat(b,bv)}</tr></table>`;
}
function note(content: string, tone: 'violet' | 'mint' = 'violet'): string {
  const bg = tone === 'violet' ? C.primarySoft : C.mint;
  const ink = tone === 'violet' ? C.ink : C.success;
  return `<table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:separate;margin:20px 0 5px"><tr><td style="background:${bg};border-radius:12px;padding:17px 19px;color:${ink};font-family:${sans};font-size:13px;line-height:21px">${content}</td></tr></table>`;
}
function emailShell(opts: {preheader:string; label:string; body:string; footerUrl?:string}): string {
  const preference = opts.footerUrl
    ? `<a href="${escapeHtml(safeUrl(opts.footerUrl))}" style="color:${C.secondary};text-decoration:underline">Quản lý thông báo</a>`
    : 'Đây là email liên quan đến bảo mật tài khoản của bạn.';
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="color-scheme" content="light"/><title>Vocelune</title>
<style>@media screen and (max-width:640px){.container{width:100%!important}.content{padding:30px 22px!important}.header{padding:23px 22px!important}.mobile-stat{display:block!important;width:100%!important;padding:0 0 10px!important}.mobile-pull{padding:0 14px!important}}a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}</style></head>
<body style="background:${C.canvas};margin:0;padding:0;font-family:${sans};-webkit-font-smoothing:antialiased">
<div style="display:none;font-size:1px;color:${C.canvas};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${escapeHtml(opts.preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${C.canvas}" style="background:${C.canvas};border-collapse:collapse"><tr><td align="center" class="mobile-pull" style="padding:36px 16px 42px">
<table role="presentation" width="600" class="container" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:600px;overflow:hidden;border:1px solid ${C.border};border-radius:18px;border-collapse:separate;background:#ffffff">
<tr><td style="height:5px;background:${C.primary};font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td class="header" style="padding:29px 40px 25px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td valign="middle" width="38" height="38" align="center" bgcolor="${C.primary}" style="background:${C.primary};border-radius:11px;color:white;font-family:${sans};font-weight:800;font-size:21px">V</td><td valign="middle" style="padding-left:11px;font-family:${sans};font-weight:800;letter-spacing:-0.45px;font-size:20px;color:${C.ink}">Vocelune</td></tr></table></td>
<td valign="middle" align="right" style="font-family:${sans};font-size:10px;line-height:15px;letter-spacing:1.5px;font-weight:700;color:${C.subdued};text-transform:uppercase">${escapeHtml(opts.label)}</td></tr></table></td></tr>
<tr><td style="padding:0 40px"><div style="border-top:1px solid ${C.border}"></div></td></tr>
<tr><td class="content" style="padding:34px 40px 35px">${opts.body}</td></tr>
<tr><td style="background:${C.canvas};border-top:1px solid ${C.border};padding:23px 40px 26px;text-align:center"><p style="font-family:${sans};font-size:12px;line-height:19px;color:${C.secondary};margin:0 0 6px">Vocelune · Mỗi từ, một nhịp nhớ.</p><p style="font-family:${sans};font-size:11px;line-height:18px;color:${C.secondary};margin:0">${preference}</p></td></tr>
</table><p style="font-family:${sans};font-size:11px;line-height:17px;color:${C.subdued};margin:20px 0 0">© Vocelune · Thư gửi tự động từ hệ thống học từ vựng</p>
</td></tr></table></body></html>`;
}

export function welcomeEmail(input: BaseEmailInput): VoceluneEmail {
  const display = nameOf(input.displayName), library = route(input.appOrigin, '/library');
  const subject = 'Chào mừng bạn đến với Vocelune';
  const body = sectionLabel('WELCOME TO VOCELUNE') + heading('Một nhịp học mới bắt đầu.')
    + paragraph(`Chào <strong style="color:${C.ink}">${escapeHtml(display)}</strong>,`)
    + paragraph('Vocelune giúp bạn xây dựng thư viện từ vựng, luyện tự gợi nhớ và ôn tập theo lịch thích ứng. Bạn có thể bắt đầu với một vài từ quen thuộc trước khi mở rộng kho học.')
    + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border:1px solid ${C.border};border-radius:14px"><tr><td style="padding:20px 22px">${[ ['01','Thêm từ vào thư viện','Nhập từ theo nghĩa hoặc dùng bộ từ sẵn có.'],['02','Tự gợi nhớ trước khi xem đáp án','Thử nhớ lại nghĩa trước khi lật thẻ.'],['03','Ôn tập khi đến hạn','Lịch SRS được điều chỉnh theo kết quả ôn của bạn.'] ].map(([n,title,desc],i)=>`<table role="presentation" cellpadding="0" cellspacing="0" width="100%" ${i?'style="margin-top:17px"':''}><tr><td width="36" valign="top" style="font-family:${sans};font-size:13px;font-weight:800;color:${C.primary};padding-top:2px">${n}</td><td><div style="font-family:${sans};font-size:14px;line-height:20px;font-weight:750;color:${C.ink}">${title}</div><div style="font-family:${sans};font-size:12px;line-height:19px;color:${C.secondary};margin-top:3px">${desc}</div></td></tr></table>`).join('')}</td></tr></table>`
    + button('Khám phá thư viện', library)
    + paragraph('Bạn có thể điều chỉnh mục tiêu thẻ mới và tùy chọn email trong trang Hồ sơ.');
  return {kind:'welcome',subject,html:emailShell({preheader:'Thêm từ, luyện tự nhớ và tạo nhịp ôn tập đầu tiên của bạn.',label:'WELCOME',body,footerUrl:route(input.appOrigin,'/profile')}),text:`Chào ${display},\n\nChào mừng bạn đến với Vocelune!\n\n1. Thêm từ vào thư viện.\n2. Tự gợi nhớ trước khi xem đáp án.\n3. Ôn tập theo lịch thích ứng.\n\nMở thư viện: ${library}\n\nVocelune — Mỗi từ, một nhịp nhớ.`};
}

export function studyReminderEmail(input: StudyReminderInput): VoceluneEmail {
  const display=nameOf(input.displayName), due=number(input.dueCards), fresh=number(input.newCardsAvailable), study=route(input.appOrigin,'/study');
  const subject=due ? `Vocelune · ${due} thẻ đến hạn ôn hôm nay` : 'Vocelune · Kế hoạch học từ vựng hôm nay';
  const main=due ? `Bạn có <strong style="color:${C.ink}">${due} thẻ đến hạn ôn tập</strong>.` : 'Hôm nay chưa có thẻ ôn tập đến hạn.';
  const body=sectionLabel('YOUR DAILY RECALL')+heading(due?'Những từ đã học đang chờ bạn ôn lại.':'Một phiên học mới, theo nhịp của bạn.')
    + paragraph(`Chào <strong style="color:${C.ink}">${escapeHtml(display)}</strong>,`)
    + paragraph(`${main} Vocelune đã cập nhật danh sách thẻ theo lịch học hiện tại của bạn.`)
    + statsRow('Thẻ đến hạn',due,'Thẻ mới khả dụng',fresh)
    + note('Gợi ý: đọc câu hỏi, tự nhớ đáp án rồi mới lật thẻ. Việc đánh giá Again / Hard / Good / Easy sẽ giúp cập nhật lịch ôn tiếp theo.')
    + button(due?'Bắt đầu ôn tập':'Mở phiên học',study)
    + `<p style="font-family:${sans};font-size:12px;line-height:20px;color:${C.subdued};margin:17px 0 0">Thời điểm thống kê: ${escapeHtml(input.dateLabel)}. Số thẻ có thể thay đổi khi bạn học hoặc chỉnh sửa thư viện.</p>`;
  return {kind:'study-reminder',subject,html:emailShell({preheader:`${due} thẻ đến hạn và ${fresh} thẻ mới khả dụng.`,label:'DAILY RECALL',body,footerUrl:route(input.appOrigin,'/profile')}),text:`Chào ${display},\n\nLịch học ${input.dateLabel}:\n- Thẻ đến hạn: ${due}\n- Thẻ mới khả dụng: ${fresh}\n\nTự gợi nhớ đáp án trước khi lật thẻ để cập nhật lịch SRS.\n\nBắt đầu: ${study}\nQuản lý thông báo: ${route(input.appOrigin,'/profile')}\n\nVocelune — Mỗi từ, một nhịp nhớ.`};
}

export function dailySummaryEmail(input: DailySummaryInput): VoceluneEmail {
  const display=nameOf(input.displayName), reviews=number(input.reviewCount), good=number(input.goodEasyCount), unique=number(input.uniqueWordsReviewed), added=number(input.addedWords);
  if (good>reviews) throw new Error('goodEasyCount must not exceed reviewCount');
  const ratio=reviews?`${Math.round(100*good/reviews)}%`:'—';
  const analytics=route(input.appOrigin,'/analytics');
  const shown=(input.words||[]).slice(0,6);
  const words=shown.length?`<div style="font-family:${sans};font-size:12px;font-weight:800;color:${C.ink};margin:27px 0 11px">MỘT SỐ TỪ ĐÃ ÔN</div><div style="padding:15px 17px;border:1px solid ${C.border};border-radius:12px;font-family:${sans};font-size:13px;line-height:25px;color:${C.ink}">${shown.map(w=>`<span style="display:inline-block;border-radius:7px;background:${C.canvas};border:1px solid ${C.border};padding:3px 10px;margin:3px 5px 3px 0">${escapeHtml(w)}</span>`).join('')}</div>`:'';
  const body=sectionLabel('DAILY LEARNING SUMMARY')+heading(reviews?'Một ngày học tập, được ghi lại.':'Hôm nay chưa có lượt ôn nào.')
    + paragraph(`Chào <strong style="color:${C.ink}">${escapeHtml(display)}</strong>, đây là bản tổng kết ngày ${escapeHtml(input.dateLabel)} từ dữ liệu hoạt động của bạn trên Vocelune.`)
    + statsRow('Lượt ôn đã ghi nhận',reviews,'Đánh giá Good / Easy',ratio)
    + statsRow('Từ duy nhất đã ôn',unique,'Từ mới đã thêm',added)
    + note('Chỉ số Good / Easy là tỷ lệ lượt tự đánh giá mức độ nhớ từ 3–4 trên tổng số lượt ôn trong ngày; không phải phép đo trực tiếp khả năng ghi nhớ.', 'mint')
    + words + button('Xem phân tích chi tiết',analytics);
  const lines=shown.length?`\nMột số từ đã ôn: ${shown.join(', ')}\n`:'';
  return {kind:'daily-summary',subject:`Vocelune · Tổng kết học tập ${input.dateLabel}`,html:emailShell({preheader:`${reviews} lượt ôn, ${ratio} đánh giá Good/Easy.`,label:'DAILY SUMMARY',body,footerUrl:route(input.appOrigin,'/profile')}),text:`Chào ${display},\n\nTổng kết ${input.dateLabel}:\n- Lượt ôn: ${reviews}\n- Tỷ lệ Good / Easy: ${ratio}\n- Từ duy nhất đã ôn: ${unique}\n- Từ mới đã thêm: ${added}\n${lines}\nChỉ số Good/Easy không phải phép đo trực tiếp khả năng ghi nhớ.\n\nXem phân tích: ${analytics}\nQuản lý thông báo: ${route(input.appOrigin,'/profile')}\n\nVocelune — Mỗi từ, một nhịp nhớ.`};
}

export function weeklyDigestEmail(input: WeeklyDigestInput): VoceluneEmail {
  const display=nameOf(input.displayName), reviews=number(input.reviewCount), days=number(input.activeDays), words=number(input.wordsReviewed);
  if(days>7) throw new Error('activeDays must be <= 7');
  if(input.dailyActivity.length!==7) throw new Error('dailyActivity must include exactly 7 days');
  input.dailyActivity.forEach(d=>number(d.reviews));
  const max=Math.max(1,...input.dailyActivity.map(d=>d.reviews));
  const chart=`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 5px"><tr>${input.dailyActivity.map(d=>{const height=d.reviews?Math.max(9,Math.round(d.reviews/max*72)):4;return `<td width="14.28%" valign="bottom" align="center" style="padding:0 4px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td height="82" valign="bottom" style="height:82px;vertical-align:bottom"><div title="${escapeHtml(d.day)}: ${d.reviews} lượt" style="background:${d.reviews?C.primary:C.primarySoft};height:${height}px;border-radius:7px 7px 4px 4px;font-size:0">&nbsp;</div></td></tr><tr><td style="padding-top:8px;font-family:${sans};font-size:11px;text-align:center;color:${C.secondary}">${escapeHtml(d.day)}</td></tr><tr><td style="padding-top:4px;font-family:${sans};font-size:10px;text-align:center;color:${C.ink}">${d.reviews}</td></tr></table></td>`}).join('')}</tr></table>`;
  const body=sectionLabel('WEEKLY LEARNING REPORT')+heading('Bảy ngày, một bức tranh tiến độ.')
    + paragraph(`Chào <strong style="color:${C.ink}">${escapeHtml(display)}</strong>, dưới đây là hoạt động học từ vựng của bạn trong tuần ${escapeHtml(input.weekLabel)}.`)
    + statsRow('Tổng lượt ôn',reviews,'Ngày có hoạt động',`${days}/7`)
    + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:11px 0"><tr><td style="border:1px solid ${C.border};border-radius:12px;padding:16px 19px"><div style="font-family:${sans};font-size:13px;color:${C.secondary}">Số từ duy nhất đã ôn trong tuần</div><div style="font-family:${sans};font-size:24px;font-weight:800;margin-top:4px;color:${C.ink}">${words.toLocaleString('vi-VN')}</div></td></tr></table>`
    + `<div style="font-family:${sans};font-size:12px;font-weight:800;color:${C.ink};margin:25px 0 0">LƯỢT ÔN THEO NGÀY</div>`+chart
    + note('Báo cáo thể hiện hoạt động đã ghi nhận, không phải xếp hạng năng lực học. Bạn có thể điều chỉnh mục tiêu thẻ mới theo quỹ thời gian của mình.')
    + button('Xem tiến độ đầy đủ',route(input.appOrigin,'/analytics'));
  return {kind:'weekly-digest',subject:`Vocelune · Báo cáo tuần ${input.weekLabel}`,html:emailShell({preheader:`${reviews} lượt ôn trong ${days} ngày hoạt động tuần qua.`,label:'WEEKLY INSIGHTS',body,footerUrl:route(input.appOrigin,'/profile')}),text:`Chào ${display},\n\nBáo cáo tuần ${input.weekLabel}:\n- Tổng lượt ôn: ${reviews}\n- Số ngày có hoạt động: ${days}/7\n- Số từ duy nhất đã ôn: ${words}\n- Theo ngày: ${input.dailyActivity.map(x=>`${x.day} ${x.reviews}`).join(' · ')}\n\nXem chi tiết: ${route(input.appOrigin,'/analytics')}\nQuản lý thông báo: ${route(input.appOrigin,'/profile')}\n\nVocelune — Mỗi từ, một nhịp nhớ.`};
}

export function passwordResetEmail(input: PasswordResetInput): VoceluneEmail {
  const display=nameOf(input.displayName), url=safeUrl(input.resetUrl), expiry=number(input.expiresInMinutes);
  const body=sectionLabel('ACCOUNT SECURITY')+heading('Đặt lại mật khẩu Vocelune')
    + paragraph(`Chào <strong style="color:${C.ink}">${escapeHtml(display)}</strong>,`)
    + paragraph('Vocelune đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Sử dụng nút bên dưới để tiếp tục.')
    + button('Đặt lại mật khẩu',url)
    + note(`<strong>Liên kết có hiệu lực trong ${expiry} phút</strong> kể từ khi được tạo và chỉ được sử dụng một lần.`)
    + paragraph('Nếu bạn không yêu cầu thao tác này, bạn có thể bỏ qua email. Mật khẩu sẽ không thay đổi nếu không hoàn tất bước đặt lại.')
    + `<div style="font-family:${sans};font-size:12px;line-height:19px;color:${C.secondary};margin-top:20px">Nút không hoạt động? Sao chép liên kết sau vào trình duyệt:<div style="overflow-wrap:anywhere;word-break:break-all;margin-top:7px">${subtleLink(url,url)}</div></div>`;
  return {kind:'password-reset',subject:'Vocelune · Yêu cầu đặt lại mật khẩu',html:emailShell({preheader:`Liên kết đặt lại mật khẩu có hiệu lực trong ${expiry} phút.`,label:'SECURITY',body}),text:`Chào ${display},\n\nVocelune đã nhận được yêu cầu đặt lại mật khẩu.\n\nMở liên kết: ${url}\n\nLiên kết có hiệu lực ${expiry} phút kể từ khi được tạo và chỉ dùng một lần.\nNếu bạn không thực hiện yêu cầu này, có thể bỏ qua email.\n\nVocelune — Mỗi từ, một nhịp nhớ.`};
}
