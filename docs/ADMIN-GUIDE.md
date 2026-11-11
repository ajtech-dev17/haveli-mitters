# Captain's desk: rozana ka workflow

Admin URL `/admin.html` hai. Public header/footer mein admin login button nahi hai. Login email + password se hota hai. Register karne se khud-ba-khud admin permission nahi milti.

## Players

**Players → Add player**

Name, jersey, role, batting/bowling style aur photo add karein. Urdu fields optional hain; blank hone par English text dikhega. Active players ke jersey numbers unique honge.

- **Save draft**: public ko record nahi dikhega.
- **Publish**: public squad/profile mein dikhega.
- **Retired**: history ke saath player public reh sakta hai.
- **Removed**: public se hide hoga, database history preserve hogi.
- History wale player ko delete karna blocked hai. Removed use karein.

Search name, jersey aur record text par kaam karti hai. Public side role filters aur most runs/wickets/jersey sorting available hai.

## New v3 controls

- **Our team** page: Players edit mein Captain / Vice captain / Player aur Display order set karein. Ek active captain allowed hai. Captain change karte waqt pehle current captain ko Player banayein, phir naya Captain select karein. Captain ki card/photo bari hai; full squad 11 se zyada ho sakta hai.
- **Player access**: email-bound invitations, linked player accounts, revoke. See [PRIVACY.md](PRIVACY.md).
- **Live scoring**: ball-by-ball scorer desk with corrections/audience. See [LIVE-SCORING.md](LIVE-SCORING.md).
- **Appearance**: dark/light colors aur supported fonts, contrast validation, live preview, Restore Haveli Default, draft/publish.
- **AJTech.dev** developer popup fixed hai; admin ke settings mein usay remove/change karne ka option nahi.

## Fixtures and manual scorecards

**Matches → Add match** mein opponent, venue, date, toss aur season set karein. Date/time input aapke device ka local time hai; public display Site controls ke timezone mein hoti hai.

Upcoming match complete hone par **usi record ko Edit** karein; naya duplicate match na banayein. Status Completed aur correct result choose karein.

Score table mein:

- **Played** har participating player ke liye tick karein, chahe uske sab stats zero hon.
- **Batted** sirf batting ki ho to tick karein. Na ki ho to runs/balls/boundaries zero aur Not out unticked rakhein.
- Runs, balls faced, fours, sixes, wickets, bowling overs, conceded runs aur fielding fill karein.
- `3.4 overs = 22 balls`. Last digit 0–5 valid hai; `3.6` invalid hai. `4.0` likhein.
- Team total mein extras included ho sakte hain. Player runs team total se zyada nahi ho sakte.
- Bowler wickets opponent lost wickets se zyada nahi ho sakti; run-outs separate fielding records hain.
- **Publish** ke baad career/season totals source scorecards se recalculate hote hain. Match edit/delete double totals create nahi karta.

Save and Publish dialog ke fixed footer mein rehte hain; score table horizontally scroll hoti hai. Ek hi match doosra admin edit kare to stale revision save reject hota hai; page reload kar ke current record edit karein.

Batting average runs/dismissals hai; all-not-out average “—” hai. Economy conceded × 6 / legal balls hai. 3W category exactly 3–4 wickets aur 5W category 5+ wickets hai. Recent form last five **player appearances** se banti hai, last five team matches se nahi.

## Gallery and media

**Gallery**: Kind Moment, title, category aur image. Upload file use karne par URL manually dena zaroori nahi. Winning/special/team/training default categories hain; Site controls se comma-separated categories change kar sakte hain.

**Media & social**:

- Audio: team-song title aur MP3/M4A/OGG/WAV upload/link.
- Video: YouTube link, MP4/WebM file/link. Other video/social URLs safe outbound links ki tarah khulte hain.
- Social link: Instagram, TikTok, Facebook waghera ka actual profile URL.
- Thumbnail optional. Sort order chhota ho to pehle dikhega.
- Media autoplay nahi hota. Ek native audio/video play hone par doosra pause hota hai. YouTube playback apne embedded player mein independent hai.

Sirf woh media publish karein jiska team ko istemal ka haq hai. Large videos external video hosting par rakhna Supabase storage/bandwidth bachata hai. Public Storage mein uploaded file URL-accessible hai even if its database record is Draft; confidential assets yahan upload na karein.

## Site controls

Brand/home text, logo, privacy defaults, office location, default language/theme aur pages/features ko control kar sakte hain.

- **Save draft** settings ko admin draft mein rakhta hai.
- **Publish** visitor configuration update karta hai.
- Shared settings draft dono admins dekh sakte hain; ek waqt mein ek admin branding edit kare.
- Publish exact current form data use karta hai. Concurrent publish par revision mismatch ko reload se resolve karein.
- Public pages generally settings/policy change ke 15 seconds ke andar reload hoti hain; live score 5 seconds mein refresh hota hai.
- Language/theme choice visitor device par remember hoti hai. Admin default un visitors par apply hota hai jinhon ne apni preference save nahi ki.
- Page disable hone par link nav se hatta hai aur direct page URL unavailable state dikhata hai. Database privacy ke liye record ko Draft/Removed karein; page toggle alone privacy control nahi.

Toggle search se specific controls dhoond sakte hain. Mobile par admin section menu horizontal scroll hota hai; active section highlighted rehta hai. Desktop par sidebar sticky hai.

## Locations

Permanent Haveli office address/Maps link Site controls mein set karein.

Temporary location ke liye **Location**:

1. Label aur 1–240 minute expiry enter karein.
2. Coordinates manually enter karein, ya **Share device location** se device coordinates fill karein.
3. **Publish location** one-time location publish karta hai.
4. **Start live sharing** explicit permission/confirmation ke baad isi admin device ki location update karta hai. Tab khula aur browser geolocation allowed hona chahiye. Updates maximum approximately once per minute; public page approximately every 30 seconds refresh karta hai.
5. **Stop sharing** latest public location bhi delete karta hai.

Admin section change ya tab close karne par continuous watch rukti hai. Last published location apni expiry tak reh sakti hai; immediately hatane ke liye Stop sharing dabayein. Mobile OS background tab ko pause kar sakta hai. Ye all-player tracking system nahi hai.

## Account and backup

My account se display name/email/password change karein. New email confirmation complete karein; display name login username nahi hai.

Dashboard → Export backup se settings + players + matches + stats + media metadata + live state/lineups/events ka JSON milta hai. Original media files, Auth users, admin membership, invitations, private settings drafts aur temporary locations is export mein included nahi. Inki separate controlled backup/ownership planning developer kare.
