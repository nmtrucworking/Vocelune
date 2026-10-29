const assert = require('node:assert/strict');
const t = require('../dist/src/vocelune-email.js');
const base={displayName:'<script>alert("x")</script>',appOrigin:'https://vocelune.nguyenminhtruc.site'};
const cases=[
  t.welcomeEmail(base),
  t.studyReminderEmail({...base,dateLabel:'30/10/2026',dueCards:12,newCardsAvailable:5}),
  t.dailySummaryEmail({...base,dateLabel:'30/10/2026',reviewCount:5,goodEasyCount:3,uniqueWordsReviewed:3,addedWords:2,words:['hello<script>','world']}),
  t.weeklyDigestEmail({...base,weekLabel:'26/10–01/11',reviewCount:30,activeDays:5,wordsReviewed:18,dailyActivity:Array.from({length:7},(_,i)=>({day:'T'+(i+2),reviews:i}))}),
  t.passwordResetEmail({...base,resetUrl:'https://vocelune.nguyenminhtruc.site/reset-password#token=demo',expiresInMinutes:30})
];
for (const mail of cases) {
  assert.match(mail.html,/<!doctype html>/i);
  assert.match(mail.html,/Vocelune/);
  assert.ok(!mail.html.includes('<script>alert'));
  assert.ok(mail.html.includes('&lt;script&gt;alert'));
  assert.ok(mail.text.length>60);
  assert.ok(mail.html.length>3000);
}
assert.throws(()=>t.passwordResetEmail({...base,resetUrl:'javascript:alert(1)',expiresInMinutes:30}));
assert.throws(()=>t.dailySummaryEmail({...base,dateLabel:'x',reviewCount:1,goodEasyCount:2,uniqueWordsReviewed:1,addedWords:0}));
console.log('All 5 templates pass baseline validation.');
