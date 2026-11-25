/*
 * How a typical program week splits up, in approximate structured hours a week (averaged over the year).
 * Free time isn't counted.
 *
 *   rel    = religious / Jewish text study (shiurim, sedarim, beit midrash, Talmud, Jewish thought)
 *   acad   = academic classes (university courses, ulpan, Israel / Middle East studies)
 *   intern = internships and work placements
 *   vol    = volunteering and service
 *   other  = other structured time: trips, seminars, fitness, army training, group programming
 *
 * `pub` lists the categories whose hours come from a published schedule (see details.js sources).
 * Every other number is OUR ESTIMATE from what the program describes, and the site shows it with ≈.
 * Update these whenever a program sends a real weekly schedule.
 */
window.GYF_TIME = {
  "year-course":  { rel: 1, acad: 12, intern: 12, vol: 3, other: 6, pub: [], note: "Jerusalem semester is mostly classes; in Tel Aviv your track runs four days a week (internship shown; MDA, Marva and kibbutz tracks shift those hours to volunteering)." },
  aardvark:       { rel: 0, acad: 3, intern: 18, vol: 0, other: 5, pub: ["intern"], note: "Published: about 16–20 hours a week at your placement. Plus ulpan and a weekly trip; the Service track swaps internship hours for volunteering." },
  nativ:          { rel: 5, acad: 10, intern: 0, vol: 12, other: 5, pub: [], note: "Fall is study, spring is volunteering. Nativ's sources currently disagree on the spring setup, so treat this as rough." },
  kivunim:        { rel: 3, acad: 20, intern: 0, vol: 3, other: 10, pub: [], note: "A 30-credit academic program in Jerusalem plus weekly field trips and a service project, and 8–10 weeks abroad." },
  hevruta:        { rel: 12, acad: 6, intern: 4, vol: 4, other: 6, pub: ["intern", "vol"], note: "Published: one morning interning and one afternoon volunteering each week. Beit midrash and seminar hours are estimated." },
  "kol-ami":      { rel: 2, acad: 12, intern: 0, vol: 12, other: 10, pub: [], note: "One to two volunteering days a week and fitness three times a week (published); class hours estimated." },
  "bnei-akiva-mechina": { rel: 10, acad: 6, intern: 6, vol: 4, other: 12, pub: [], note: "Torah classes, fitness three times a week and themed out-weeks; internships only in the third semester (three days a week)." },
  "bnei-akiva-kadima":  { rel: 3, acad: 2, intern: 8, vol: 8, other: 12, pub: [], note: "Built in modules (kibbutz, work placement, MDA or Marva, hiking, seminars), so the split changes through the year." },
  "habonim-workshop":   { rel: 0, acad: 6, intern: 0, vol: 15, other: 10, pub: [], note: "Shorashim: ulpan and Sipur Ami; Anafim: volunteering three days a week; Adama: camp and farm work." },
  "tau-eli":      { rel: 0, acad: 16, intern: 0, vol: 2, other: 6, pub: [], note: "At least four for-credit TAU courses plus workshops, group activities and trips." },
  "huji-first-year": { rel: 0, acad: 20, intern: 0, vol: 0, other: 3, pub: [], note: "A full first year of university courses." },
  "bar-ilan-xp":  { rel: 12, acad: 15, intern: 0, vol: 2, other: 6, pub: ["rel", "acad"], note: "Published sample week: Judaic studies 9–12 and general studies 12–4, Monday to Thursday. Plus a leadership afternoon and trips every other week." },
  maccabi:        { rel: 0, acad: 6, intern: 0, vol: 10, other: 15, pub: [], note: "Stages: Machon course, kibbutz work, Magen David Adom ambulance shifts and Marva army training." },
  "torah-tech":   { rel: 29, acad: 0, intern: 23, vol: 0, other: 2, pub: ["rel", "intern"], note: "Published schedule: internships Sunday, Tuesday and Thursday, 10:15–6:00; morning seder daily, two full learning days, and night seder." },
  arevim:         { rel: 1, acad: 2, intern: 0, vol: 28, other: 3, pub: ["vol"], note: "Published: volunteering four days a week. Plus a weekly Israel-update talk or trip." },
  "shnat-netzer": { rel: 3, acad: 6, intern: 0, vol: 10, other: 10, pub: [], note: "Machon learning in Jerusalem, kibbutz work and volunteering at Harduf." },
  "har-etzion":   { rel: 45, acad: 0, intern: 0, vol: 0, other: 3, pub: [], note: "A full-day yeshiva schedule (morning, afternoon and night seder). Har Etzion's own schedule is published only as an image." },
  hakotel:        { rel: 47, acad: 0, intern: 0, vol: 0, other: 3, pub: ["rel"], note: "Published schedule: seder and shiurim from 7:15 a.m. to about 10:30 p.m. with breaks." },
  orayta:         { rel: 40, acad: 0, intern: 0, vol: 0, other: 4, pub: [], note: "A full-day yeshiva schedule; daily times aren't published." },
  "migdal-hatorah": { rel: 45, acad: 0, intern: 0, vol: 0, other: 3, pub: ["rel"], note: "Published schedule: learning from 9:00 a.m. to 10:00 p.m. with breaks." },
  kby:            { rel: 45, acad: 0, intern: 0, vol: 0, other: 2, pub: [], note: "Morning, afternoon and night seder with a daily shiur; exact times aren't published." },
  ashreinu:       { rel: 25, acad: 0, intern: 0, vol: 6, other: 8, pub: ["rel", "vol"], note: "Published schedule: chaburot and shiurim, chessed most afternoons, a full tiyul day each week, and night seder." },
  ytva:           { rel: 45, acad: 0, intern: 0, vol: 0, other: 2, pub: ["rel"], note: "Published schedule: three sedarim a day from 9:00 a.m. to about 10:30 p.m." },
  "migdal-oz":    { rel: 35, acad: 0, intern: 0, vol: 3, other: 3, pub: [], note: "Flexible schedule: Gemara three or four mornings, afternoon classes, evening bekiut; afternoons can include chessed." },
  nishmat:        { rel: 35, acad: 0, intern: 0, vol: 2, other: 3, pub: [], note: "A full learning schedule with tiyulim; weekly hours aren't published." },
  "ein-hanetziv": { rel: 35, acad: 0, intern: 0, vol: 3, other: 3, pub: [], note: "Sunday–Thursday classes from morning to 10 p.m., with group activities and volunteering." },
  michlalah:      { rel: 35, acad: 0, intern: 0, vol: 0, other: 3, pub: [], note: "Text-based classes in Tanach, Halacha, Mussar and Machshava; weekly hours aren't published." },
  lindenbaum:     { rel: 35, acad: 0, intern: 0, vol: 3, other: 3, pub: [], note: "Modular Gemara or Tanach mornings, afternoon and evening learning, plus a chessed program." },
  "fzy-year-course": { rel: 1, acad: 12, intern: 12, vol: 3, other: 6, pub: [], note: "Same shape as Year Course: Jerusalem semester of classes, then a Tel Aviv track (internship shown; the MDA track shifts hours to volunteering)." },
  "ba-torani":    { rel: 30, acad: 0, intern: 0, vol: 3, other: 6, pub: [], note: "Most of the year at a partner yeshiva or midrasha, plus Bnei Akiva seminars and a kibbutz stint." },
  "ba-mta":       { rel: 30, acad: 0, intern: 0, vol: 4, other: 6, pub: [], note: "Intensive learning at partner institutions, plus seminars, Sar-El and summer volunteering." },
  mtva:           { rel: 25, acad: 0, intern: 4, vol: 6, other: 6, pub: [], note: "Beit midrash learning plus service learning, internships, kibbutz and Learn-and-Tour days." },
  "yachad-mechinot": { rel: 2, acad: 10, intern: 0, vol: 10, other: 12, pub: [], note: "Discussion-based learning (in Hebrew), community volunteering, seminars and running the group." },
  "tzofim-sherut":   { rel: 0, acad: 0, intern: 0, vol: 30, other: 4, pub: [], note: "A full-time service placement in schools, community centers or a Tzofim chapter." },
  "garin-tzabar":    { rel: 0, acad: 10, intern: 0, vol: 0, other: 12, pub: [], note: "Hebrew study and aliyah/IDF preparation before enlisting." },
  "shnat-betar":     { rel: 2, acad: 12, intern: 0, vol: 6, other: 12, pub: [], note: "A four-month leadership course, then Marva, seminars and volunteering." },
  "hdoz-shnat":      { rel: 0, acad: 8, intern: 0, vol: 10, other: 10, pub: [], note: "Leadership course, kibbutz and communal living, and volunteering." },
};
