/*
 * Map page data. Joins to GYF_DATA.programs by `id`: for programs already in data.js, the name, base,
 * tracks and link come from there, and this file only adds where they are on the map.
 *
 * Every coordinate is a neighborhood- or town-level approximation (approx: true). Never put a street address here.
 * Programs with `id: null` are not in the main program list yet (seedOnly); their details came from the
 * seed list for the map and still need sources before they join data.js.
 */
(function () {
  const J = "Jerusalem", TLV = "Tel Aviv-Yafo";
  window.GYF_MAP = {
    // Six map types. Color is never the only signal: each pin also carries the letter, and cards spell out the type.
    types: {
      pluralistic: { label: "Pluralistic/Secular", letter: "P", color: "#8fb0ff" },
      orthodox: { label: "Orthodox Yeshiva/Midrasha", letter: "O", color: "#c4a8ff" },
      mechina: { label: "Mechina", letter: "M", color: "#6fd39a" },
      university: { label: "University", letter: "U", color: "#f2b544" },
      movement: { label: "Youth Movement", letter: "Y", color: "#ff9a76" },
      kibbutz: { label: "Kibbutz/Volunteer", letter: "K", color: "#5fd4d4" },
    },

    programs: [
      { id: "hevruta", mapType: "pluralistic",
        sites: [{ label: "German Colony, " + J, lat: 31.765, lng: 35.219, approx: true }] },
      { id: "year-course", mapType: "movement",
        sites: [
          { label: J + " semester (Machon dorms)", lat: 31.769, lng: 35.205, approx: true },
          { label: TLV + " semester", lat: 32.072, lng: 34.781, approx: true },
          { label: "Kibbutz Ketura, Arava", lat: 29.97, lng: 35.06, approx: true },
        ] },
      { id: "aardvark", mapType: "pluralistic",
        sites: [
          { label: "Near Machane Yehuda, " + J, lat: 31.785, lng: 35.212, approx: true },
          { label: "Florentin, " + TLV, lat: 32.057, lng: 34.770, approx: true },
        ] },
      { id: "nativ", mapType: "movement", note: "Relaunching for 2026-27.",
        sites: [
          { label: J + " (fall)", lat: 31.781, lng: 35.218, approx: true },
          { label: "Florentin, " + TLV + " (spring)", lat: 32.0565, lng: 34.7715, approx: true },
        ] },
      { id: "kivunim", mapType: "pluralistic",
        tracks: ["Travel to up to 12 countries", "Hebrew and Arabic"],
        sites: [{ label: "Mishkenot Sha'ananim, " + J, lat: 31.772, lng: 35.225, approx: true }] },
      { id: "bar-ilan-xp", mapType: "university",
        sites: [{ label: "Bar-Ilan campus, Ramat Gan", lat: 32.069, lng: 34.843, approx: true }] },
      { id: null, seedOnly: true, key: "bina", name: "BINA Gap Year", mapType: "pluralistic",
        base: "South Tel Aviv", website: "https://www.bina.org.il",
        tracks: ["Secular yeshiva", "Lives in an Israeli mechina"],
        sites: [{ label: "South Tel Aviv", lat: 32.049, lng: 34.775, approx: true }] },
      { id: null, seedOnly: true, key: "kivun", name: "World Bnei Akiva Kivun", mapType: "movement",
        base: "Apartments in " + J, website: "https://www.worldbneiakiva.org",
        sites: [{ label: "Apartments in " + J, lat: 31.776, lng: 35.209, approx: true }] },
      { id: "bnei-akiva-mechina", mapType: "mechina",
        sites: [{ label: "Beit Bnei Akiva, " + J, lat: 31.779, lng: 35.201, approx: true }] },
      { id: "kol-ami", mapType: "mechina",
        sites: [
          { label: "Kiryat Anavim (" + J + " area)", lat: 31.81, lng: 35.12, approx: true },
          { label: "Kibbutz Amir", lat: 33.183, lng: 35.616, approx: true },
          { label: "Carmiel", lat: 32.915, lng: 35.295, approx: true },
        ] },
      { id: "habonim-workshop", mapType: "movement",
        sites: [
          { label: "Kibbutz Ein HaShofet", lat: 32.603, lng: 35.097, approx: true },
          { label: TLV, lat: 32.08, lng: 34.78, approx: true },
          { label: "Kibbutz Ravid (farm work)", lat: 32.85, lng: 35.47, approx: true },
        ] },
      { id: "hannaton", mapType: "mechina",
        sites: [{ label: "Kibbutz Hannaton, Lower Galilee", lat: 32.78, lng: 35.25, approx: true }] },
      { id: "haemek", mapType: "mechina",
        sites: [{ label: "Kibbutz Kfar Ruppin", lat: 32.46, lng: 35.55, approx: true }] },
      { id: "tavor", mapType: "mechina",
        sites: [
          { label: "Nof HaGalil", lat: 32.71, lng: 35.32, approx: true },
          { label: "Ramat HaShofet", lat: 32.61, lng: 35.09, approx: true },
          { label: "Kiryat Shmona", lat: 33.207, lng: 35.57, approx: true },
        ] },
      { id: null, seedOnly: true, key: "ein-prat", name: "Ein Prat", mapType: "mechina",
        base: "Kfar Adumim", website: null,
        sites: [{ label: "Kfar Adumim", lat: 31.82, lng: 35.34, approx: true }] },
      { id: "har-etzion", mapType: "orthodox",
        sites: [{ label: "Alon Shvut, Gush Etzion", lat: 31.655, lng: 35.125, approx: true }] },
      { id: "migdal-oz", mapType: "orthodox",
        sites: [{ label: "Kibbutz Migdal Oz, Gush Etzion", lat: 31.636, lng: 35.152, approx: true }] },
      { id: "hakotel", mapType: "orthodox",
        sites: [{ label: "Old City, " + J, lat: 31.775, lng: 35.233, approx: true }] },
      { id: "harova", mapType: "orthodox",
        sites: [{ label: "Jewish Quarter, Old City, " + J, lat: 31.7755, lng: 35.2312, approx: true }] },
      { id: "lindenbaum", mapType: "orthodox",
        sites: [{ label: "Talpiot, " + J, lat: 31.744, lng: 35.221, approx: true }] },
      { id: "nishmat", mapType: "orthodox",
        sites: [{ label: "Pat, " + J, lat: 31.751, lng: 35.203, approx: true }] },
      { id: null, seedOnly: true, key: "bgu", name: "BGU Gap Year", mapType: "university",
        base: "Be'er Sheva and Sde Boker", website: null,
        sites: [
          { label: "Be'er Sheva", lat: 31.262, lng: 34.801, approx: true },
          { label: "Sde Boker", lat: 30.85, lng: 34.78, approx: true },
        ] },
      { id: null, seedOnly: true, key: "livnot", name: "Livnot U'Lehibanot", mapType: "kibbutz",
        base: "Tzfat Old City", website: null, tag: "Not a classic post-high school year",
        tracks: ["Short programs", "Mostly for people in their 20s"],
        sites: [{ label: "Old City, Tzfat", lat: 32.965, lng: 35.497, approx: true }] },
      // No single base: listed in the panel, never pinned.
      { id: "kibbutz-ulpan", mapType: "kibbutz", panelLabel: "Multiple kibbutzim",
        tracks: ["5 months", "Hebrew ulpan and kibbutz work"], sites: [] },
    ],

    // Zoom presets. City and kibbutz presets fly in tilted, so the 3D buildings stand up; the two wide
    // presets (several kibbutzim far apart) stay higher and list their places to fly into.
    presets: [
      { name: "Jerusalem", sub: "Old City, German Colony, Talpiot, Machane Yehuda", center: [31.768, 35.222], zoom: 14.6, pitch: 58, bearing: -20,
        places: ["old-city", "german-colony", "talpiot", "machane-yehuda", "mishkenot", "pat"] },
      { name: "Tel Aviv-Yafo", sub: "Florentin, South Tel Aviv", center: [32.054, 34.773], zoom: 15.6, pitch: 60, bearing: 25, places: ["florentin", "south-tlv"] },
      { name: "Ramat Gan", sub: "Bar-Ilan", center: [32.069, 34.843], zoom: 15.6, pitch: 60, bearing: -15, places: ["bar-ilan"] },
      { name: "Tzfat", sub: "Old City", center: [32.965, 35.497], zoom: 16, pitch: 60, bearing: 30, places: ["tzfat"] },
      { name: "Gush Etzion", sub: "Alon Shvut, Migdal Oz", center: [31.645, 35.138], zoom: 14.4, pitch: 55, bearing: -10, places: ["alon-shvut", "migdal-oz"] },
      { name: "Lower Galilee kibbutzim", sub: "Hannaton, Ravid", center: [32.80, 35.36], zoom: 11, pitch: 40, bearing: 0, places: ["hannaton", "ravid"] },
      { name: "Jordan Valley kibbutzim", sub: "Kfar Ruppin", center: [32.46, 35.55], zoom: 16, pitch: 60, bearing: 20, places: ["kfar-ruppin"] },
      { name: "Be'er Sheva", sub: "", center: [31.256, 34.797], zoom: 15, pitch: 58, bearing: -25, places: ["beer-sheva"] },
      { name: "Sde Boker / Ramon", sub: "Sde Boker, Ramon Crater", center: [30.72, 34.80], zoom: 10, pitch: 45, bearing: 0, places: ["sde-boker"] },
      { name: "Arava", sub: "Kibbutz Ketura", center: [29.97, 35.06], zoom: 16, pitch: 60, bearing: -30, places: ["ketura"] },
    ],

    // Places: neighborhoods, kibbutzim and towns. Named on the map from zoom 13; each one flies you in to 3D.
    places: [
      { id: "old-city", name: "Old City", kind: "neighborhood", lat: 31.7767, lng: 35.2345 },
      { id: "german-colony", name: "German Colony", kind: "neighborhood", lat: 31.763, lng: 35.2205 },
      { id: "talpiot", name: "Talpiot", kind: "neighborhood", lat: 31.742, lng: 35.224 },
      { id: "machane-yehuda", name: "Machane Yehuda", kind: "neighborhood", lat: 31.7855, lng: 35.2125 },
      { id: "mishkenot", name: "Mishkenot Sha'ananim", kind: "neighborhood", lat: 31.7712, lng: 35.2262 },
      { id: "pat", name: "Pat", kind: "neighborhood", lat: 31.7505, lng: 35.2015 },
      { id: "florentin", name: "Florentin", kind: "neighborhood", lat: 32.0565, lng: 34.7695 },
      { id: "south-tlv", name: "South Tel Aviv", kind: "neighborhood", lat: 32.0485, lng: 34.7765 },
      { id: "bar-ilan", name: "Bar-Ilan, Ramat Gan", kind: "neighborhood", lat: 32.0705, lng: 34.8435 },
      { id: "tzfat", name: "Tzfat Old City", kind: "neighborhood", lat: 32.9655, lng: 35.4955 },
      { id: "beer-sheva", name: "Be'er Sheva", kind: "town", lat: 31.2525, lng: 34.7915 },
      { id: "alon-shvut", name: "Alon Shvut", kind: "town", lat: 31.6565, lng: 35.1265 },
      { id: "migdal-oz", name: "Migdal Oz", kind: "kibbutz", lat: 31.6345, lng: 35.1505 },
      { id: "kfar-adumim", name: "Kfar Adumim", kind: "town", lat: 31.8215, lng: 35.3415 },
      { id: "kiryat-anavim", name: "Kiryat Anavim", kind: "kibbutz", lat: 31.8115, lng: 35.1185 },
      { id: "hannaton", name: "Hannaton", kind: "kibbutz", lat: 32.7815, lng: 35.2515 },
      { id: "ravid", name: "Ravid", kind: "kibbutz", lat: 32.8515, lng: 35.4715 },
      { id: "ein-hashofet", name: "Ein HaShofet", kind: "kibbutz", lat: 32.6045, lng: 35.0985 },
      { id: "ramat-hashofet", name: "Ramat HaShofet", kind: "kibbutz", lat: 32.6115, lng: 35.0915 },
      { id: "kfar-ruppin", name: "Kfar Ruppin", kind: "kibbutz", lat: 32.4615, lng: 35.5515 },
      { id: "amir", name: "Amir", kind: "kibbutz", lat: 33.1845, lng: 35.6175 },
      { id: "carmiel", name: "Carmiel", kind: "town", lat: 32.9165, lng: 35.2965 },
      { id: "nof-hagalil", name: "Nof HaGalil", kind: "town", lat: 32.7115, lng: 35.3215 },
      { id: "kiryat-shmona", name: "Kiryat Shmona", kind: "town", lat: 33.2085, lng: 35.5715 },
      { id: "sde-boker", name: "Sde Boker", kind: "kibbutz", lat: 30.8515, lng: 34.7815 },
      { id: "ketura", name: "Ketura", kind: "kibbutz", lat: 29.9715, lng: 35.0615 },
    ],
  };
})();
