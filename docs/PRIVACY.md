# Public/private — captain ke controls

Launch defaults PUBLIC hain. Player login future privacy use ke liye ready hai; visitors bina login public content dekh sakte hain.

| Control                                        | Asar                                                            |
| ---------------------------------------------- | --------------------------------------------------------------- |
| Site controls → Profile default Public/Private | Inherit profiles ka default                                     |
| Site controls → Stats default Public/Private   | Inherit statistics ka default                                   |
| Player edit → Profile visibility               | Inherit / Public / Private per player                           |
| Player edit → Stats visibility                 | Inherit / Public / Private per player                           |
| Force all profiles and stats private           | Public overrides ko bhi override karke own-player + admins only |
| Match audience Public                          | Published summary/allowed scorecard all visitors                |
| Match audience Team                            | Sirf approved linked active/published team players + admins     |
| Match audience Admin                           | Sirf team admins                                                |
| Draft match/player                             | Admin-only, irrespective of audience                            |

Stats private aur profile public: name/photo/role visible, individual stats hidden. Profile private ho to stats bhi private. Linked player apna published/non-removed profile aur allowed matches ke apne stats dekh sakta hai. Doosre players ki private statistics access nahi kar sakta. Admin dono dekh sakta hai.

Match audience aur player privacy **dono** enforce hoti hain: team-only match player login se khul sakta hai, lekin doosre player ki private stats phir bhi hidden hain. Admin-only matches ka personal score history bhi players ko publish nahi hota.

## Private player account ka workflow

1. Player record publish karein. Player access → exact email choose → Create invitation link.
2. Generated link privately usi player ko dein. App invitation automatically email nahi karti.
3. Player link khol kar apni email/password se account banaye aur email confirm kare.
4. Usi confirmed email se sign in → Accept invitation.
5. Player login / My profile mein apne records dekhega; captains ke admin menus nahi milenge.

Invite 48 hours, single use, email-bound hai. New invite purane invite ko replace karti hai. Remove player access connection ko revoke karta hai, historical stats delete nahi karta. Player accounts two-admin limit mein count nahi hote. An approved admin who also plays can have a player link without losing admin authority.

## Photos and live data

Player Upload file protected `hm-portraits` bucket use karta hai. Har download par RLS effective profile permission check karti hai. Purane public/external Photo URLs ko private banane se pehle protected upload karein ya URL clear karein; app invalid privacy change reject karti hai.

Generated leaderboards, scorecard rows and live player figures authorized records se bante hain. Hidden figures zero ke taur par pretend nahi kiye jate. Raw live events/states sirf admins read kar sakte hain; public live RPC filtered response deta hai. Hidden home-player figures/IDs aur recent-ball detail omit hoti hai. Team match totals aur opponent figures match audience ke mutabiq visible reh sakte hain. Agar poora match score confidential chahiye to match audience Team/Admin karein.

Public pages policy changes approximately 15 seconds mein refresh karti hain; live viewer every 5 seconds authorized fetch karta hai. Previously downloaded public images/data ki copies ko retrospectively erase nahi kiya ja sakta. Gallery captions, media and manually written match summaries independent published content hain; personal privacy switch unke text/photos ko automatically redact nahi karta.

Page/feature switches presentation controls hain. Confidentiality ke liye above visibility/audience controls use karein. Developer popup visibility/config ordinary admins ke control mein nahi.
