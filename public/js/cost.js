// Net cost calculator: what a year actually costs after grants and aid, plus the costs tuition leaves out.
// Every grant figure here is sourced (see FUNDING and MASA below). Unknowns stay blank for the student to fill in;
// nothing is guessed. window.GYF_COST = { masaFor, compute, render, summary, funding }.
(function () {
  const CHECKED = "2026-11-26";

  // Masa Israel Journey, North American grants for 2026/2027, programs of 4–10 months.
  // Source: Masa's own cost guide, "based on the official Masa 2026/2027 grants document".
  const MASA_SRC = "https://www.masaisrael.org/cost-to-travel-to-israel/";
  const MASA_RULES = "https://www.masaisrael.org/funding/masa-israel-grants/";
  const MASA_CATS = {
    "academic-gap": { label: "Academic gap year", u22: [600, 800], o22: [1400, 3500] },
    academic: { label: "Academic (university program)", u22: [1250, 1250], o22: [3000, 3000] },
    career: { label: "Career development / internships", u22: [1000, 2000], o22: [2400, 4500] },
    "jewish-studies": { label: "Jewish studies (yeshiva, seminary)", u22: [0, 0], o22: [1400, 3500], u22Note: "Masa's 2026–27 table lists no base grant for Jewish studies programs for students under 22. Need-based aid can still apply." },
    movement: { label: "Youth movement", u22: [0, 200], o22: [1400, 3500] },
    unsure: { label: "Not sure / not Masa-recognized", u22: [0, 0], o22: [0, 0], u22Note: "Check the program's Masa page or Masa's funding calculator, then pick the type here.", o22Note: "Check the program's Masa page or Masa's funding calculator, then pick the type here." },
  };
  const DEFAULT_CAT = { gap: "academic-gap", university: "academic", movement: "movement", yeshiva: "jewish-studies", seminary: "jewish-studies" };
  const NEED_HINT = "If your family qualifies: up to about $2,880 for a 10-month program at the lowest incomes, less for shorter programs. Apply before the program starts.";

  // Round-trip fares to Tel Aviv, 2026 (Masa's cost guide). We count the middle of the range; change it if you have a quote.
  const FLIGHTS = {
    nyc: ["New York", 750, 1200], lax: ["Los Angeles", 900, 1500], ord: ["Chicago", 850, 1400],
    mia: ["Miami", 800, 1300], yyz: ["Toronto", 850, 1300], other: ["Somewhere else", 750, 1400],
  };
  // Exchange rates for programs priced in shekels or pounds. Editable in the calculator.
  const RATES = { ils: 3.34, ilsAsOf: "Nov 26, 2026", gbp: 1.32, gbpAsOf: "Nov 18, 2026" };

  // Ways to pay beyond Masa. "asOf" is when the amount was published; older ones are flagged to confirm.
  const T = (ts) => (p) => ts.indexOf(p.type) >= 0;
  const ALL = () => true;
  const FUNDING = [
    { name: "Your local Jewish Federation", amount: "Often $250–$3,000; varies by city", who: "Most North American Federations fund Israel programs for local teens. NCSY's guide says to call the office, not email.", url: "https://www.jewishfederations.org/", asOf: "2023", applies: ALL },
    { name: "Atlanta Israel Gap Year Fellowship", amount: "Up to $10,000", who: "Jewish graduating seniors in Greater Atlanta, for the year right after high school. Applications open each fall.", url: "https://jewishatlanta.org/initiative/gap-year-fellowship/", asOf: "2026", applies: ALL },
    { name: "JUF Israel Experience scholarship (Chicago)", amount: "Need-based", who: "Chicago-area students on approved Israel programs, including post-high school years.", url: "https://www.juf.org/travel-with-juf/access-affordability/", asOf: "2026", applies: ALL },
    { name: "Jewish Federation of Greater Ann Arbor", amount: "Up to $1,000", who: "Ann Arbor students on a gap year or other program of 28+ days from an approved provider.", url: "https://www.jewishannarbor.org/engagement/israel/scholarships/", asOf: "2026", applies: ALL },
    { name: "Foundation for Jewish Philanthropies (Western New York)", amount: "$1,000–$3,000", who: "Students who live and went to high school in Western New York.", url: "https://jewishphilanthropies.org/israel-scholarships/", asOf: "2023", applies: ALL },
    { name: "JNF Plant Your Way to Israel", amount: "50% of what you raise", who: "Raise money for JNF and half of it comes back as a scholarship for any Israel trip.", url: "https://www.jnf.org/pyw", asOf: "2023", applies: ALL },
    { name: "Hebrew Free Loan societies", amount: "Interest-free loans", who: "Local Jewish free-loan societies lend without interest. Find yours in the association's directory.", url: "https://www.iajfl.org/", asOf: "2026", applies: ALL },
    { name: "Morris J. & Betty Kaplun essay contest", amount: "$500–$1,800", who: "An essay contest listed in NCSY's gap year aid guide.", url: "https://www.kaplunfoundation.org/essay-contest", asOf: "2023", applies: ALL },
    { name: "Hilda Spector Morgenstern merit scholarship", amount: "$2,500 toward tuition", who: "A merit scholarship toward tuition, listed in NCSY's gap year aid guide.", url: "http://morgensternscholarship.org/", asOf: "2023", applies: ALL },
    { name: "Helyn B. Reich memorial scholarship", amount: "$750–$1,500", who: "From the American Zionist Movement; listed in NCSY's gap year aid guide.", url: "https://azm.org/hbr", asOf: "2023", applies: ALL },
    { name: "Jeff Seidel airfare scholarship", amount: "$400 toward flights ($250 returning students)", who: "Apply about two months before you arrive in Israel.", url: "https://www.jeffseidel.com/", asOf: "2023", applies: T(["yeshiva", "seminary"]) },
    { name: "NCSY Torah Fund", amount: "Varies", who: "NCSY's scholarship fund for a year of Torah study in Israel. Your local NCSY region may have its own fund too.", url: "https://ncsy.org/torahfund", asOf: "2023", applies: T(["yeshiva", "seminary"]) },
    { name: "Oorah Israel scholarship", amount: "$3,500 toward tuition + $100 a month", who: "Students connected to Oorah's programs or The Zone, and Jewish public high school students.", url: "http://oorah.org/israelstudents/", asOf: "2023", applies: T(["yeshiva", "seminary"]) },
    { name: "Nechomas Yisrael", amount: "$600–$2,000", who: "Students from public or non-denominational schools going to a yeshiva or seminary. Call 718-851-0340.", url: null, asOf: "2023", applies: T(["yeshiva", "seminary"]) },
    { name: "World Mizrachi gap year campaigns", amount: "Varies", who: "Crowdfunding and scholarship campaigns for participating yeshivot and seminaries. You can apply to as many as you like.", url: "https://israelnextyear.org/world-mizrachi", asOf: "2026", applies: T(["yeshiva", "seminary"]) },
    { name: "American Jewish League for Israel", amount: "$4,000–$6,000", who: "For Bar-Ilan's Israel Experience program only.", url: "https://www.americanjewishleague.com/scholarships", asOf: "2023", applies: (p) => p.id === "bar-ilan-xp" },
    { name: "Federal aid and 529 savings, through a US college", amount: "FAFSA aid; 529 savings; up to a $2,500 tax credit", who: "If you enroll through Yeshiva University's S. Daniel Abraham Israel Program, Touro's Israel option or Hebrew Theological College, the year counts as college: FAFSA aid and 529 savings can be used, and you may qualify for the American Opportunity Credit.", url: "https://ncsy.org/gap/financial-aid-resources/", asOf: "2023", applies: T(["yeshiva", "seminary"]) },
  ];

  const num = (v) => { const n = parseFloat(String(v == null ? "" : v).replace(/[^\d.]/g, "")); return isFinite(n) ? n : null; };
  const val = (v, d) => (v == null || v === "" ? d : v);

  function masaFor(p, age, cat) {
    const c = MASA_CATS[cat] || MASA_CATS.unsure, r = age === "22" ? c.o22 : c.u22;
    return { lo: r[0], hi: r[1], label: c.label, note: age === "22" ? c.o22Note : c.u22Note };
  }
  const defaultCat = (p) => DEFAULT_CAT[p.type] || "unsure";
  function compactMasa(p) { // for Compare: the under-22 range for the program's usual type
    const m = masaFor(p, "u22", defaultCat(p));
    if (afterMasa(p)) return "In the price";
    if (defaultCat(p) === "unsure") return "Check with Masa";
    return m.hi ? (m.lo === m.hi ? "$" + m.lo.toLocaleString() : "$" + m.lo.toLocaleString() + "–$" + m.hi.toLocaleString()) : "$0 base";
  }
  const afterMasa = (p) => /after (the )?(standard )?masa/i.test(p.costText || "");

  // What the published price already covers, read from the program's own "included" text.
  function covers(p, det) {
    const inc = ((det && det.included) || "") + " " + (p.costText || "");
    const meals = (det && det.meals) || "";
    const flightsIn = /(round-trip airfare|includes [^.]*flights|flights included|airfare included|all-inclusive \(flights)/i.test(inc) && !/(airfare|flights)[^.]{0,40}(isn't|aren't|not included|extra)/i.test(inc);
    const insNamed = /(medical|health) insurance/i.test(inc);
    const insOut = /insurance[^.]{0,60}(billed separately|extra|isn't|not included|aren't)/i.test(inc);
    const mealsOut = /^not included/i.test(meals) || /meals[^.]{0,30}(aren't|isn't|not) included/i.test(inc);
    const mealsIn = !mealsOut && (/(meals|food|board|meal plan)/i.test(inc) || /^(included|all meals|breakfast, lunch)/i.test(meals));
    return {
      known: !!(det && det.included),
      flights: flightsIn ? "in" : /(airfare|flights)/i.test(inc) ? "out" : "unknown",
      insurance: insNamed && !insOut ? "in" : insOut ? "out" : "unknown",
      meals: mealsIn ? "in" : mealsOut ? "out" : "unknown",
      mealsNote: mealsOut ? meals : "",
    };
  }

  function listedPrice(p) {
    if (p.costUSD != null) return { usd: p.costUSD, cur: "usd" };
    const nis = /₪\s?([\d,]+)|NIS\s?([\d,]+)/.exec(p.costText || "");
    if (nis) return { amount: +(nis[1] || nis[2]).replace(/,/g, ""), cur: "ils" };
    const gbp = /£\s?([\d,]+)/.exec(p.costText || "");
    if (gbp) return { amount: +gbp[1].replace(/,/g, ""), cur: "gbp" };
    return { cur: null };
  }

  // c = the student's saved inputs for this program (state.p[id].cost)
  function compute(p, det, c) {
    c = c || {};
    const cov = covers(p, det), lp = listedPrice(p);
    const rate = num(c.rate) || (lp.cur === "gbp" ? RATES.gbp : RATES.ils);
    const converted = lp.cur === "ils" ? Math.round(lp.amount / rate) : lp.cur === "gbp" ? Math.round(lp.amount * rate) : null;
    const tuition = num(c.tuition) != null ? num(c.tuition) : lp.cur === "usd" ? lp.usd : converted;
    const age = c.age === "22" ? "22" : "u22", cat = c.cat || defaultCat(p);
    const m = masaFor(p, age, cat), inPrice = afterMasa(p);
    const masa = inPrice || c.masaOff ? 0 : m.lo;
    const city = FLIGHTS[c.city] ? c.city : "nyc", fr = FLIGHTS[city];
    const flightsOn = val(c.flightsOn, cov.flights !== "in");
    const flights = flightsOn ? (num(c.flights) != null ? num(c.flights) : Math.round((fr[1] + fr[2]) / 2 / 10) * 10) : 0;
    const extras = [["insurance", "Health insurance"], ["meals", "Food not covered"], ["spending", "Spending money"], ["otherCost", "Other costs"]]
      .map((x) => ({ key: x[0], label: x[1], amount: num(c[x[0]]) || 0 }));
    const aid = [["need", "Masa need-based aid"], ["prog", "Program scholarship"], ["community", "Federation or community grant"], ["otherAid", "Other scholarships"]]
      .map((x) => ({ key: x[0], label: x[1], amount: num(c[x[0]]) || 0 }));
    const costs = (tuition || 0) + flights + extras.reduce((a, x) => a + x.amount, 0);
    const grants = masa + aid.reduce((a, x) => a + x.amount, 0);
    return { cov, lp, rate, converted, tuition, age, cat, masaRange: m, masa, inPrice, city, flightsOn, flights, extras, aid, costs, grants, net: Math.max(0, costs - grants), tuitionKnown: tuition != null };
  }

  function render(p, det, c, h) {
    const esc = h.esc, money = (n) => "$" + Math.round(n).toLocaleString("en-US"), r = compute(p, det, c);
    c = c || {};
    const id = p.id;
    const inp = (key, label, value, hint, extra) =>
      '<label class="field cc-field">' + label + '<span class="cc-money"><span aria-hidden="true">$</span><input class="input" inputmode="numeric" data-cost="' + key + '" data-id="' + id + '" value="' + esc(value == null ? "" : String(value)) + '" placeholder="0"' + (extra || "") + "></span>" + (hint ? '<span class="small muted">' + hint + "</span>" : "") + "</label>";
    const covLine = (k, what) => r.cov[k] === "in" ? '<span class="chip ok">' + what + " included</span>" : r.cov[k] === "out" ? '<span class="chip warn">' + what + " not included</span>" : '<span class="chip">' + what + ": not stated</span>";
    const lpNote = r.lp.cur === "ils" ? "Listed as ₪" + r.lp.amount.toLocaleString("en-US") + ", converted at ₪" + r.rate + " to the dollar (" + RATES.ilsAsOf + ")."
      : r.lp.cur === "gbp" ? "Listed as £" + r.lp.amount.toLocaleString("en-US") + ", converted at $" + r.rate + " to the pound (" + RATES.gbpAsOf + ")."
      : r.lp.cur === "usd" ? "From the program's published price: " + esc(p.costText) : "This program hasn't published its price. Enter it once you have it.";
    const catOpts = Object.keys(MASA_CATS).map((k) => '<option value="' + k + '"' + (k === r.cat ? " selected" : "") + ">" + esc(MASA_CATS[k].label) + "</option>").join("");
    const cityOpts = Object.keys(FLIGHTS).map((k) => '<option value="' + k + '"' + (k === r.city ? " selected" : "") + ">" + FLIGHTS[k][0] + " ($" + FLIGHTS[k][1].toLocaleString() + "–$" + FLIGHTS[k][2].toLocaleString() + ")</option>").join("");
    const progAid = (p.app && p.app.aid && p.app.aid.program) || [];
    const ways = FUNDING.filter((f) => f.applies(p));
    return '<div class="costcalc" data-cost-for="' + id + '">' +
      '<div class="cc-grid"><div class="cc-inputs">' +
      '<fieldset class="cc-group"><legend>The price</legend>' +
      inp("tuition", "Tuition", c.tuition != null && c.tuition !== "" ? c.tuition : r.tuition, esc(lpNote)) +
      (r.lp.cur === "ils" || r.lp.cur === "gbp" ? '<label class="field cc-field">' + (r.lp.cur === "ils" ? "Shekels per dollar" : "Dollars per pound") + '<input class="input" inputmode="decimal" data-cost="rate" data-id="' + id + '" value="' + esc(String(c.rate || r.rate)) + '"></label>' : "") +
      '<div class="chips cc-cov">' + covLine("flights", "Flights") + covLine("insurance", "Health insurance") + covLine("meals", "Meals") + "</div>" +
      (r.cov.known ? "" : '<p class="small muted">The program doesn\'t say what its price includes, so check before you budget.</p>') +
      "</fieldset>" +
      '<fieldset class="cc-group"><legend>Masa grant</legend>' +
      (r.inPrice ? '<p class="small">The listed price already takes off the standard Masa grant, so it isn\'t subtracted again.</p>' :
        '<div class="cc-row"><label class="field cc-field">Your age when the program starts<select class="select" data-cost="age" data-id="' + id + '"><option value="u22"' + (r.age === "u22" ? " selected" : "") + '>Under 22</option><option value="22"' + (r.age === "22" ? " selected" : "") + ">22 or older</option></select></label>" +
        '<label class="field cc-field">Masa program type<select class="select" data-cost="cat" data-id="' + id + '">' + catOpts + "</select></label></div>" +
        '<p class="small">' + (r.masaRange.hi ? "Masa's 2026–27 grant for this type: <strong>" + money(r.masaRange.lo) + (r.masaRange.hi !== r.masaRange.lo ? "–" + money(r.masaRange.hi) : "") + "</strong>. We count " + money(r.masaRange.lo) + " to be safe." : "<strong>No base grant counted.</strong> " + esc(r.masaRange.note || "")) + "</p>" +
        '<label class="check small"><input type="checkbox" data-cost="masaOff" data-id="' + id + '"' + (c.masaOff ? " checked" : "") + "> This program isn't Masa-recognized (don't count the grant)</label>") +
      inp("need", "Masa need-based aid", c.need, NEED_HINT) +
      '<p class="small muted"><a href="' + MASA_RULES + '" target="_blank" rel="noopener">Masa\'s eligibility rules ↗</a> · <a href="' + MASA_SRC + '" target="_blank" rel="noopener">2026–27 amounts ↗</a></p>' +
      "</fieldset>" +
      '<fieldset class="cc-group"><legend>Other aid you\'ve been offered</legend>' +
      inp("prog", "Program scholarship", c.prog, progAid.length ? esc(progAid.join(" · ")) : "Ask the program's admissions office.") +
      inp("community", "Federation or community grant", c.community, "See \"Ways to pay\" below for who to ask.") +
      inp("otherAid", "Other scholarships", c.otherAid, "") +
      "</fieldset>" +
      '<fieldset class="cc-group"><legend>Costs the price leaves out</legend>' +
      '<label class="check small"><input type="checkbox" data-cost="flightsOn" data-id="' + id + '"' + (r.flightsOn ? " checked" : "") + "> Add round-trip flights</label>" +
      (r.flightsOn ? '<div class="cc-row"><label class="field cc-field">Flying from<select class="select" data-cost="city" data-id="' + id + '">' + cityOpts + "</select></label>" +
        inp("flights", "Flights", c.flights != null && c.flights !== "" ? c.flights : r.flights, "Middle of Masa's 2026 fare range. Change it if you have a quote.") + "</div>" : "") +
      (r.cov.insurance !== "in" ? inp("insurance", "Health insurance", c.insurance, r.cov.insurance === "out" ? "The program bills this separately or leaves it to you." : "Ask whether it's included.") : "") +
      (r.cov.meals !== "in" ? inp("meals", "Food not covered", c.meals, r.cov.mealsNote ? esc(r.cov.mealsNote) : "") : "") +
      inp("spending", "Spending money", c.spending, "Trips, phone, laundry and weekends out. Ask current students what they spent.") +
      inp("otherCost", "Other costs", c.otherCost, "Application fees, optional trips, a college transcript fee.") +
      "</fieldset></div>" +
      '<div class="cc-out" aria-live="polite">' + summary(p, det, c, h) + "</div></div>" +
      '<details class="cc-ways"><summary>Ways to pay (' + ways.length + ")</summary>" +
      '<p class="small muted">Amounts change every year. Ones marked "confirm" come from older lists. Check the current amount before counting on it.</p>' +
      '<ul class="cc-list">' + ways.map((f) => "<li><div><strong>" + (f.url ? '<a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.name) + " ↗</a>" : esc(f.name)) + "</strong> · " + esc(f.amount) +
        (f.asOf < "2026" ? ' <span class="chip warn">confirm</span>' : "") + '</div><div class="small muted">' + esc(f.who) + "</div></li>").join("") + "</ul></details>" +
      '<p class="small muted cc-foot">Grant figures checked ' + CHECKED.slice(5, 7).replace(/^0/, "") + "/" + CHECKED.slice(8) + "/" + CHECKED.slice(0, 4) + ". This is an estimate: confirm every number with the program and with Masa before you commit.</p>" +
      "</div>";
  }

  function summary(p, det, c, h) {
    const esc = h.esc, money = (n) => "$" + Math.round(n).toLocaleString("en-US"), r = compute(p, det, c);
    const line = (label, n, sign) => '<div class="cc-line"><span>' + esc(label) + "</span><span>" + (sign || "") + money(n) + "</span></div>";
    const pct = r.costs ? Math.min(100, Math.round((r.grants / r.costs) * 100)) : 0;
    return '<div class="card cc-card">' +
      '<div class="cc-label">Your estimated cost</div>' +
      '<div class="cc-net">' + (r.tuitionKnown ? money(r.net) : "—") + "</div>" +
      (r.tuitionKnown ? '<div class="small muted">' + (r.grants ? money(r.grants) + " in grants and aid covers " + pct + "% of " + money(r.costs) : "Before any grants or aid") + "</div>" +
        '<div class="cc-bar" role="img" aria-label="' + pct + '% covered by grants and aid"><span style="width:' + pct + '%"></span></div>'
        : '<div class="small muted">Enter the tuition to see your total.</div>') +
      '<div class="cc-lines">' +
      line("Tuition", r.tuition || 0) +
      (r.flights ? line("Flights", r.flights, "+ ") : "") +
      r.extras.filter((x) => x.amount).map((x) => line(x.label, x.amount, "+ ")).join("") +
      (r.masa ? line("Masa grant", r.masa, "− ") : "") +
      r.aid.filter((x) => x.amount).map((x) => line(x.label, x.amount, "− ")).join("") +
      '<div class="cc-line cc-total"><span>Estimated cost</span><span>' + (r.tuitionKnown ? money(r.net) : "—") + "</span></div></div></div>";
  }

  window.GYF_COST = { masaFor, defaultCat, compactMasa, compute, render, summary, funding: FUNDING, rates: RATES, flights: FLIGHTS, cats: MASA_CATS, checked: CHECKED };
})();
