# Product questions

Questions to keep in mind while building the finder (saved 2026-11-25). The "Site now" lines say what the site already covers and where it's still thin.

## 1. Market size
- **How many students go each year?** Partly answered: about 4,000 North Americans, mostly Orthodox yeshiva and seminary students. Non-Orthodox participation is under 5%.
- **How many consider a gap year but don't go?** That gap is the audience. Still open.
- **Which programs should the finder cover first?** Started: Hevruta, Year Course, Aardvark, Israel XP and Kivunim.
  - *Site now:* 38 programs. Nine of them are built for other countries or for people making aliyah, and their cards and pages say so (for example "UK-specific" or "Must be making aliyah").

## 2. Program data (what the finder shows)
- **What's each program's weekly schedule?** Partly answered: Aardvark and the Year Course Pardes track publish one. Hevruta, Israel XP and Kivunim need emails.
  - *Site now:* `public/js/time.js` holds approximate hours a week per category for 37 programs, shown as charts. Only some numbers come from published schedules (Aardvark internships, Torah Tech, Bar-Ilan XP, Hakotel, Migdal HaTorah, YTVA, Hevruta's intern/volunteer slots, Arevim); the rest are estimates marked ≈. Real schedules from program emails should replace them.
  - *Site now:* The "Daily life" section on program pages (`public/js/details.js`) has a typical week from each program's own site for most programs, including Hevruta, Kivunim and Israel XP's sample schedule. Confirm these by email. Nativ's two sources conflict.
- **What tracks does each program offer, and what do they cost?** Mostly answered, except Israel XP's tracks.
  - *Site now:* Israel XP shows only its TorahPlus track.
- **What's the real cost after Masa grants, aid, flights and insurance?** Partly answered (2026-11-26).
  - *Site now:* Each program page has a "Real cost" calculator (`public/js/cost.js`). It applies Masa's 2026–27 North American grant table by age and program type (under 22: academic gap $600–$800, academic $1,250, career $1,000–$2,000, youth movement $0–$200, and no base grant for Jewish studies, meaning yeshiva and seminary). It skips the grant when the price is already "after Masa", reads the program's "included" text to add flights (Masa's 2026 fare ranges by city), insurance and food when they're extra, and converts shekel and pound prices at an editable rate. Students type in need-based aid, program scholarships and community grants. A "Ways to pay" list covers Federations (Atlanta up to $10,000), JNF, free loans, NCSY's list and FAFSA/529 through YU, Touro or HTC.
  - *Still open:* Which programs are Masa-recognized and under which Masa type (the calculator guesses from the program type and lets the student change it); real program scholarship amounts; several "Ways to pay" amounts come from NCSY's 2023 list and are marked "confirm".
- **How many credits does each program give, and which colleges accept them?** Still open.
  - *Site now:* The Colleges page shows each college's rule on gap-year credit (76 colleges with sourced policies, mostly from Hillel's top 100). Per-program credit counts are only partial.
- **What are the cohort size and mix, and how much free time is there?** Still open.
- **What internships are available, especially finance and business?** Still open.
  - *Site now:* The "Internships & tracks" sections list sectors where programs publish them. Torah Tech lists finance; Aardvark lists startups and marketing; TAU has entrepreneurship workshops; Year Course lists entrepreneurship.

## 3. How students decide
- Where do they find programs now, and when do they decide?
- Which filters matter most: cost, religious level, academics vs. internships, location, social scene?
- Who makes the final call, the student or the parents?

## 4. Data sourcing
- **How do you collect and update program info?** Answered for now: rep calls and emails, plus Jina Reader or Crawl4AI for scraping.
- **How often does it need updating?** Tuition, deadlines and tracks change every year.

## 5. Your edge
- **Why would a student use this finder over Masa's program search?** Answer this one well and the rest follows.
  - *Site now:* Candidates: the head-to-head Compare page (up to three programs side by side, with the leader in each row in bold); Time breakdown charts (hours a week of religious study, academics, internships and volunteering); a quiz with weighted matching; college deferral rules tied to each program's credit; and a per-program application tracker.
