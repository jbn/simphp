// Emscripten JS library overrides for the PHP 4.1.1 build.
//
// These replace emscripten's browser-flavoured libc time/zone primitives with
// behaviour matching the platform PHP 4.1.1 shipped on (glibc, i686 Linux):
//   * microsecond gettimeofday() resolution
//   * the TZ environment variable is honoured (putenv("TZ=...") in scripts,
//     or TZ passed in the CGI environment), including POSIX TZ strings
//   * real zone abbreviations (PST/PDT, CET/CEST ...) for date('T')
//   * 32-bit time_t range for mktime(), like a 2001 i386 box
addToLibrary({
  // Linux gettimeofday() has microsecond resolution; Date.now() only has ms,
  // which breaks microtime() and makes back-to-back uniqid() calls collide.
  // Use the high-resolution clock, and never return the same microsecond twice.
  $simphpClock: { last: 0 },
  emscripten_date_now__deps: ['$simphpClock'],
  emscripten_date_now: () => {
    var now = (typeof performance != 'undefined' && performance.timeOrigin)
      ? performance.timeOrigin + performance.now() : Date.now();
    now = Math.floor(now * 1000) / 1000;
    if (now <= simphpClock.last) now = simphpClock.last + 0.001;
    simphpClock.last = now;
    return now;
  },

  // ---------------------------------------------------------------------------
  // CPU time accounting for max_execution_time (ITIMER_PROF semantics: time
  // spent in sleep() does not count).
  // ---------------------------------------------------------------------------
  $simphpSleep: { total: 0, sab: null },
  simphp_cpu_ms__deps: ['$simphpSleep'],
  simphp_cpu_ms: () => performance.now() - simphpSleep.total,
  simphp_sleep_ms__deps: ['$simphpSleep'],
  simphp_sleep_ms: (ms) => {
    var start = performance.now();
    if (ms > 0) {
      var waited = false;
      if (typeof SharedArrayBuffer != 'undefined' && typeof Atomics != 'undefined') {
        try {
          if (!simphpSleep.sab) simphpSleep.sab = new Int32Array(new SharedArrayBuffer(4));
          while (performance.now() - start < ms) {
            Atomics.wait(simphpSleep.sab, 0, 0, ms - (performance.now() - start));
          }
          waited = true;
        } catch (e) {}
      }
      if (!waited) while (performance.now() - start < ms) {}
    }
    simphpSleep.total += performance.now() - start;
  },

  // ---------------------------------------------------------------------------
  // Time zones
  // ---------------------------------------------------------------------------
  // A zone is { info(ms) -> { off: seconds east of UTC, dst: bool, abbr } }.
  // Zone abbreviations as glibc/tzdata prints them (Intl lacks many, e.g. JST),
  // generated from an i386 Debian box: zone -> "STD" or "STD/DST".
  $simphpZoneAbbr: {"Africa/Abidjan":"GMT","Africa/Accra":"GMT","Africa/Addis_Ababa":"EAT","Africa/Algiers":"CET","Africa/Asmera":"EAT","Africa/Bamako":"GMT","Africa/Bangui":"WAT","Africa/Banjul":"GMT","Africa/Bissau":"GMT","Africa/Blantyre":"CAT","Africa/Brazzaville":"WAT","Africa/Bujumbura":"CAT","Africa/Cairo":"EET/EEST","Africa/Casablanca":"+01","Africa/Ceuta":"CET/CEST","Africa/Conakry":"GMT","Africa/Dakar":"GMT","Africa/Dar_es_Salaam":"EAT","Africa/Djibouti":"EAT","Africa/Douala":"WAT","Africa/El_Aaiun":"+01","Africa/Freetown":"GMT","Africa/Gaborone":"CAT","Africa/Harare":"CAT","Africa/Johannesburg":"SAST","Africa/Juba":"CAT","Africa/Kampala":"EAT","Africa/Khartoum":"CAT","Africa/Kigali":"CAT","Africa/Kinshasa":"WAT","Africa/Lagos":"WAT","Africa/Libreville":"WAT","Africa/Lome":"GMT","Africa/Luanda":"WAT","Africa/Lubumbashi":"CAT","Africa/Lusaka":"CAT","Africa/Malabo":"WAT","Africa/Maputo":"CAT","Africa/Maseru":"SAST","Africa/Mbabane":"SAST","Africa/Mogadishu":"EAT","Africa/Monrovia":"GMT","Africa/Nairobi":"EAT","Africa/Ndjamena":"WAT","Africa/Niamey":"WAT","Africa/Nouakchott":"GMT","Africa/Ouagadougou":"GMT","Africa/Porto-Novo":"WAT","Africa/Sao_Tome":"GMT","Africa/Tripoli":"EET","Africa/Tunis":"CET","Africa/Windhoek":"CAT","America/Adak":"HST/HDT","America/Anchorage":"AKST/AKDT","America/Anguilla":"AST","America/Antigua":"AST","America/Araguaina":"-03","America/Argentina/La_Rioja":"-03","America/Argentina/Rio_Gallegos":"-03","America/Argentina/Salta":"-03","America/Argentina/San_Juan":"-03","America/Argentina/San_Luis":"-03","America/Argentina/Tucuman":"-03","America/Argentina/Ushuaia":"-03","America/Aruba":"AST","America/Asuncion":"-03","America/Bahia":"-03","America/Bahia_Banderas":"CST","America/Barbados":"AST","America/Belem":"-03","America/Belize":"CST","America/Blanc-Sablon":"AST","America/Boa_Vista":"-04","America/Bogota":"-05","America/Boise":"MST/MDT","America/Buenos_Aires":"-03","America/Cambridge_Bay":"MST/MDT","America/Campo_Grande":"-04","America/Cancun":"EST","America/Caracas":"-04","America/Catamarca":"-03","America/Cayenne":"-03","America/Cayman":"EST","America/Chicago":"CST/CDT","America/Chihuahua":"CST","America/Ciudad_Juarez":"MST/MDT","America/Coral_Harbour":"EST","America/Cordoba":"-03","America/Costa_Rica":"CST","America/Coyhaique":"-03","America/Creston":"MST","America/Cuiaba":"-04","America/Curacao":"AST","America/Danmarkshavn":"GMT","America/Dawson":"MST","America/Dawson_Creek":"MST","America/Denver":"MST/MDT","America/Detroit":"EST/EDT","America/Dominica":"AST","America/Edmonton":"MST/MDT","America/Eirunepe":"-05","America/El_Salvador":"CST","America/Fort_Nelson":"MST","America/Fortaleza":"-03","America/Glace_Bay":"AST/ADT","America/Godthab":"-02/-01","America/Goose_Bay":"AST/ADT","America/Grand_Turk":"EST/EDT","America/Grenada":"AST","America/Guadeloupe":"AST","America/Guatemala":"CST","America/Guayaquil":"-05","America/Guyana":"-04","America/Halifax":"AST/ADT","America/Havana":"CST/CDT","America/Hermosillo":"MST","America/Indiana/Knox":"CST/CDT","America/Indiana/Marengo":"EST/EDT","America/Indiana/Petersburg":"EST/EDT","America/Indiana/Tell_City":"CST/CDT","America/Indiana/Vevay":"EST/EDT","America/Indiana/Vincennes":"EST/EDT","America/Indiana/Winamac":"EST/EDT","America/Indianapolis":"EST/EDT","America/Inuvik":"MST/MDT","America/Iqaluit":"EST/EDT","America/Jamaica":"EST","America/Jujuy":"-03","America/Juneau":"AKST/AKDT","America/Kentucky/Monticello":"EST/EDT","America/Kralendijk":"AST","America/La_Paz":"-04","America/Lima":"-05","America/Los_Angeles":"PST/PDT","America/Louisville":"EST/EDT","America/Lower_Princes":"AST","America/Maceio":"-03","America/Managua":"CST","America/Manaus":"-04","America/Marigot":"AST","America/Martinique":"AST","America/Matamoros":"CST/CDT","America/Mazatlan":"MST","America/Mendoza":"-03","America/Menominee":"CST/CDT","America/Merida":"CST","America/Metlakatla":"AKST/AKDT","America/Mexico_City":"CST","America/Miquelon":"-03/-02","America/Moncton":"AST/ADT","America/Monterrey":"CST","America/Montevideo":"-03","America/Montserrat":"AST","America/Nassau":"EST/EDT","America/New_York":"EST/EDT","America/Nome":"AKST/AKDT","America/Noronha":"-02","America/North_Dakota/Beulah":"CST/CDT","America/North_Dakota/Center":"CST/CDT","America/North_Dakota/New_Salem":"CST/CDT","America/Ojinaga":"CST/CDT","America/Panama":"EST","America/Paramaribo":"-03","America/Phoenix":"MST","America/Port-au-Prince":"EST/EDT","America/Port_of_Spain":"AST","America/Porto_Velho":"-04","America/Puerto_Rico":"AST","America/Punta_Arenas":"-03","America/Rankin_Inlet":"CST/CDT","America/Recife":"-03","America/Regina":"CST","America/Resolute":"CST/CDT","America/Rio_Branco":"-05","America/Santarem":"-03","America/Santiago":"-04/-03","America/Santo_Domingo":"AST","America/Sao_Paulo":"-03","America/Scoresbysund":"-02/-01","America/Sitka":"AKST/AKDT","America/St_Barthelemy":"AST","America/St_Johns":"NST/NDT","America/St_Kitts":"AST","America/St_Lucia":"AST","America/St_Thomas":"AST","America/St_Vincent":"AST","America/Swift_Current":"CST","America/Tegucigalpa":"CST","America/Thule":"AST/ADT","America/Tijuana":"PST/PDT","America/Toronto":"EST/EDT","America/Tortola":"AST","America/Vancouver":"PST/PDT","America/Whitehorse":"MST","America/Winnipeg":"CST/CDT","America/Yakutat":"AKST/AKDT","Antarctica/Casey":"+08","Antarctica/Davis":"+07","Antarctica/DumontDUrville":"+10","Antarctica/Macquarie":"AEST/AEDT","Antarctica/Mawson":"+05","Antarctica/McMurdo":"NZST/NZDT","Antarctica/Palmer":"-03","Antarctica/Rothera":"-03","Antarctica/Syowa":"+03","Antarctica/Troll":"+00/+02","Antarctica/Vostok":"+05","Arctic/Longyearbyen":"CET/CEST","Asia/Aden":"+03","Asia/Almaty":"+05","Asia/Amman":"+03","Asia/Anadyr":"+12","Asia/Aqtau":"+05","Asia/Aqtobe":"+05","Asia/Ashgabat":"+05","Asia/Atyrau":"+05","Asia/Baghdad":"+03","Asia/Bahrain":"+03","Asia/Baku":"+04","Asia/Bangkok":"+07","Asia/Barnaul":"+07","Asia/Beirut":"EET/EEST","Asia/Bishkek":"+06","Asia/Brunei":"+08","Asia/Calcutta":"IST","Asia/Chita":"+09","Asia/Colombo":"+0530","Asia/Damascus":"+03","Asia/Dhaka":"+06","Asia/Dili":"+09","Asia/Dubai":"+04","Asia/Dushanbe":"+05","Asia/Famagusta":"EET/EEST","Asia/Gaza":"EET/EEST","Asia/Hebron":"EET/EEST","Asia/Hong_Kong":"HKT","Asia/Hovd":"+07","Asia/Irkutsk":"+08","Asia/Jakarta":"WIB","Asia/Jayapura":"WIT","Asia/Jerusalem":"IST/IDT","Asia/Kabul":"+0430","Asia/Kamchatka":"+12","Asia/Karachi":"PKT","Asia/Katmandu":"+0545","Asia/Khandyga":"+09","Asia/Krasnoyarsk":"+07","Asia/Kuala_Lumpur":"+08","Asia/Kuching":"+08","Asia/Kuwait":"+03","Asia/Macau":"CST","Asia/Magadan":"+11","Asia/Makassar":"WITA","Asia/Manila":"PST","Asia/Muscat":"+04","Asia/Nicosia":"EET/EEST","Asia/Novokuznetsk":"+07","Asia/Novosibirsk":"+07","Asia/Omsk":"+06","Asia/Oral":"+05","Asia/Phnom_Penh":"+07","Asia/Pontianak":"WIB","Asia/Pyongyang":"KST","Asia/Qatar":"+03","Asia/Qostanay":"+05","Asia/Qyzylorda":"+05","Asia/Rangoon":"+0630","Asia/Riyadh":"+03","Asia/Saigon":"+07","Asia/Sakhalin":"+11","Asia/Samarkand":"+05","Asia/Seoul":"KST","Asia/Shanghai":"CST","Asia/Singapore":"+08","Asia/Srednekolymsk":"+11","Asia/Taipei":"CST","Asia/Tashkent":"+05","Asia/Tbilisi":"+04","Asia/Tehran":"+0330","Asia/Thimphu":"+06","Asia/Tokyo":"JST","Asia/Tomsk":"+07","Asia/Ulaanbaatar":"+08","Asia/Urumqi":"+06","Asia/Ust-Nera":"+10","Asia/Vientiane":"+07","Asia/Vladivostok":"+10","Asia/Yakutsk":"+09","Asia/Yekaterinburg":"+05","Asia/Yerevan":"+04","Atlantic/Azores":"-01/+00","Atlantic/Bermuda":"AST/ADT","Atlantic/Canary":"WET/WEST","Atlantic/Cape_Verde":"-01","Atlantic/Faeroe":"WET/WEST","Atlantic/Madeira":"WET/WEST","Atlantic/Reykjavik":"GMT","Atlantic/South_Georgia":"-02","Atlantic/St_Helena":"GMT","Atlantic/Stanley":"-03","Australia/Adelaide":"ACST/ACDT","Australia/Brisbane":"AEST","Australia/Broken_Hill":"ACST/ACDT","Australia/Darwin":"ACST","Australia/Eucla":"+0845","Australia/Hobart":"AEST/AEDT","Australia/Lindeman":"AEST","Australia/Lord_Howe":"+1030/+11","Australia/Melbourne":"AEST/AEDT","Australia/Perth":"AWST","Australia/Sydney":"AEST/AEDT","CET":"CET/CEST","CST6CDT":"CST/CDT","Cuba":"CST/CDT","EET":"EET/EEST","EST":"EST","EST5EDT":"EST/EDT","Egypt":"EET/EEST","Eire":"GMT/IST","Europe/Amsterdam":"CET/CEST","Europe/Andorra":"CET/CEST","Europe/Astrakhan":"+04","Europe/Athens":"EET/EEST","Europe/Belgrade":"CET/CEST","Europe/Berlin":"CET/CEST","Europe/Bratislava":"CET/CEST","Europe/Brussels":"CET/CEST","Europe/Bucharest":"EET/EEST","Europe/Budapest":"CET/CEST","Europe/Busingen":"CET/CEST","Europe/Chisinau":"EET/EEST","Europe/Copenhagen":"CET/CEST","Europe/Dublin":"GMT/IST","Europe/Gibraltar":"CET/CEST","Europe/Guernsey":"GMT/BST","Europe/Helsinki":"EET/EEST","Europe/Isle_of_Man":"GMT/BST","Europe/Istanbul":"+03","Europe/Jersey":"GMT/BST","Europe/Kaliningrad":"EET","Europe/Kiev":"EET/EEST","Europe/Kirov":"MSK","Europe/Lisbon":"WET/WEST","Europe/Ljubljana":"CET/CEST","Europe/London":"GMT/BST","Europe/Luxembourg":"CET/CEST","Europe/Madrid":"CET/CEST","Europe/Malta":"CET/CEST","Europe/Mariehamn":"EET/EEST","Europe/Minsk":"+03","Europe/Monaco":"CET/CEST","Europe/Moscow":"MSK","Europe/Oslo":"CET/CEST","Europe/Paris":"CET/CEST","Europe/Podgorica":"CET/CEST","Europe/Prague":"CET/CEST","Europe/Riga":"EET/EEST","Europe/Rome":"CET/CEST","Europe/Samara":"+04","Europe/San_Marino":"CET/CEST","Europe/Sarajevo":"CET/CEST","Europe/Saratov":"+04","Europe/Simferopol":"MSK","Europe/Skopje":"CET/CEST","Europe/Sofia":"EET/EEST","Europe/Stockholm":"CET/CEST","Europe/Tallinn":"EET/EEST","Europe/Tirane":"CET/CEST","Europe/Ulyanovsk":"+04","Europe/Vaduz":"CET/CEST","Europe/Vatican":"CET/CEST","Europe/Vienna":"CET/CEST","Europe/Vilnius":"EET/EEST","Europe/Volgograd":"MSK","Europe/Warsaw":"CET/CEST","Europe/Zagreb":"CET/CEST","Europe/Zurich":"CET/CEST","GB":"GMT/BST","GMT":"GMT","HST":"HST","Hongkong":"HKT","Iceland":"GMT","Indian/Antananarivo":"EAT","Indian/Chagos":"+06","Indian/Christmas":"+07","Indian/Cocos":"+0630","Indian/Comoro":"EAT","Indian/Kerguelen":"+05","Indian/Mahe":"+04","Indian/Maldives":"+05","Indian/Mauritius":"+04","Indian/Mayotte":"EAT","Indian/Reunion":"+04","Iran":"+0330","Israel":"IST/IDT","Jamaica":"EST","Japan":"JST","Libya":"EET","MET":"MET/MEST","MST":"MST","MST7MDT":"MST/MDT","NZ":"NZST/NZDT","Navajo":"MST/MDT","PRC":"CST","PST8PDT":"PST/PDT","Pacific/Apia":"+13","Pacific/Auckland":"NZST/NZDT","Pacific/Bougainville":"+11","Pacific/Chatham":"+1245/+1345","Pacific/Easter":"-06/-05","Pacific/Efate":"+11","Pacific/Enderbury":"+13","Pacific/Fakaofo":"+13","Pacific/Fiji":"+12","Pacific/Funafuti":"+12","Pacific/Galapagos":"-06","Pacific/Gambier":"-09","Pacific/Guadalcanal":"+11","Pacific/Guam":"ChST","Pacific/Honolulu":"HST","Pacific/Kiritimati":"+14","Pacific/Kosrae":"+11","Pacific/Kwajalein":"+12","Pacific/Majuro":"+12","Pacific/Marquesas":"-0930","Pacific/Midway":"SST","Pacific/Nauru":"+12","Pacific/Niue":"-11","Pacific/Norfolk":"+11/+12","Pacific/Noumea":"+11","Pacific/Pago_Pago":"SST","Pacific/Palau":"+09","Pacific/Pitcairn":"-08","Pacific/Ponape":"+11","Pacific/Port_Moresby":"+10","Pacific/Rarotonga":"-10","Pacific/Saipan":"ChST","Pacific/Tahiti":"-10","Pacific/Tarawa":"+12","Pacific/Tongatapu":"+13","Pacific/Truk":"+10","Pacific/Wake":"+12","Pacific/Wallis":"+12","Poland":"CET/CEST","Portugal":"WET/WEST","ROK":"KST","Singapore":"+08","Turkey":"+03","US/Alaska":"AKST/AKDT","US/Central":"CST/CDT","US/Eastern":"EST/EDT","US/Hawaii":"HST","US/Mountain":"MST/MDT","US/Pacific":"PST/PDT","UTC":"UTC","Universal":"UTC","WET":"WET/WEST","Zulu":"UTC"},
  $simphpMakeZone__deps: ['$simphpZoneAbbr'],
  $simphpMakeZone: (tz) => {
    var HOUR = 3600;
    var fixedZone = (off, abbr) => ({ info: () => ({ off: off, dst: false, abbr: abbr }) });

    var numericAbbr = (off) => {
      var a = Math.abs(off), s = off < 0 ? '-' : '+';
      var h = String(Math.floor(a / 3600)).padStart(2, '0');
      var m = Math.floor((a % 3600) / 60);
      return s + h + (m ? String(m).padStart(2, '0') : '');
    };

    var intlZone = (name) => {
      var fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: name, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric', era: 'short',
      });
      var locales = ['en-US', 'en-GB', 'en-AU', 'en-IN', 'en-NZ', 'en-CA', 'en-IE', 'en-ZA', 'en-SG'];
      var nameFmts = {};
      var abbrCache = {};
      var offsetAt = (ms) => {
        var p = {};
        for (var part of fmt.formatToParts(new Date(ms))) p[part.type] = part.value;
        var y = +p.year;
        if (p.era && /^B/.test(p.era)) y = 1 - y;
        var d = new Date(0);
        d.setUTCFullYear(y, +p.month - 1, +p.day);
        d.setUTCHours(+p.hour, +p.minute, +p.second, 0);
        return Math.round((d.getTime() - Math.floor(ms / 1000) * 1000) / 1000);
      };
      var canonical = name;
      try { canonical = new Intl.DateTimeFormat('en-US', { timeZone: name }).resolvedOptions().timeZone; } catch (e) {}
      var tbl = simphpZoneAbbr[name] || simphpZoneAbbr[canonical];
      var abbrFor = (ms, off, dst) => {
        var key = off + '|' + dst;
        if (abbrCache[key]) return abbrCache[key];
        if (tbl) {
          var parts = tbl.split('/');
          return (abbrCache[key] = dst && parts[1] ? parts[1] : parts[0]);
        }
        var found = null;
        for (var loc of locales) {
          try {
            var f = nameFmts[loc] || (nameFmts[loc] = new Intl.DateTimeFormat(loc, { timeZone: name, timeZoneName: 'short' }));
            var n = f.formatToParts(new Date(ms)).find((x) => x.type === 'timeZoneName').value;
            if (n && !/^(GMT|UTC)[+−-]/.test(n) && /^[A-Z]{2,6}$/.test(n)) { found = n; break; }
          } catch (e) {}
        }
        if (!found) found = off === 0 ? (/^(Etc\/)?(UTC|UCT|Universal|Zulu)$/.test(name) ? 'UTC' : 'GMT') : numericAbbr(off);
        if (found === 'UTC' && !/UTC|UCT|Universal|Zulu/.test(name)) found = 'GMT';
        return (abbrCache[key] = found);
      };
      var stdCache = {};
      var stdOffset = (ms) => {
        var y = new Date(ms).getUTCFullYear();
        if (stdCache[y] === undefined) {
          stdCache[y] = Math.min(offsetAt(Date.UTC(y, 0, 1)), offsetAt(Date.UTC(y, 6, 1)));
        }
        return stdCache[y];
      };
      return {
        info: (ms) => {
          var off = offsetAt(ms);
          var dst = off > stdOffset(ms);
          return { off: off, dst: dst, abbr: abbrFor(ms, off, dst) };
        },
      };
    };

    // POSIX TZ: std offset [dst [offset] [,start[/time],end[/time]]]
    var posixZone = (s) => {
      var m = s.match(/^(<[^>]+>|[A-Za-z]{3,})([+-]?\d{1,2}(?::\d{1,2}){0,2})(?:(<[^>]+>|[A-Za-z]{3,})([+-]?\d{1,2}(?::\d{1,2}){0,2})?(?:,([^,]+),([^,]+))?)?$/);
      if (!m) return null;
      var hms = (v) => {
        var sign = 1;
        if (v[0] === '-') { sign = -1; v = v.slice(1); } else if (v[0] === '+') v = v.slice(1);
        var p = v.split(':');
        return sign * ((+p[0] || 0) * 3600 + (+p[1] || 0) * 60 + (+p[2] || 0));
      };
      var strip = (n) => n.replace(/^<|>$/g, '');
      var stdName = strip(m[1]), stdOff = -hms(m[2]);
      if (!m[3]) return fixedZone(stdOff, stdName);
      var dstName = strip(m[3]);
      var dstOff = m[4] ? -hms(m[4]) : stdOff + HOUR;
      var parseRule = (r) => {
        var parts = r.split('/');
        var time = parts[1] !== undefined ? hms(parts[1]) : 2 * HOUR;
        var x = parts[0], mm;
        if ((mm = x.match(/^M(\d+)\.(\d)\.(\d)$/))) return { kind: 'M', m: +mm[1], w: +mm[2], d: +mm[3], time: time };
        if ((mm = x.match(/^J(\d+)$/))) return { kind: 'J', n: +mm[1], time: time };
        if ((mm = x.match(/^(\d+)$/))) return { kind: 'n', n: +mm[1], time: time };
        return null;
      };
      var rules = m[5] ? [parseRule(m[5]), parseRule(m[6])] : null;
      if (rules && (!rules[0] || !rules[1])) return fixedZone(stdOff, stdName);
      // With no rules, glibc falls back to posixrules (America/New_York).
      var usRules = (y) => y < 2007
        ? [{ kind: 'M', m: 4, w: 1, d: 0, time: 7200 }, { kind: 'M', m: 10, w: 5, d: 0, time: 7200 }]
        : [{ kind: 'M', m: 3, w: 2, d: 0, time: 7200 }, { kind: 'M', m: 11, w: 1, d: 0, time: 7200 }];
      var leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      var ruleDay = (r, y) => { // ms (UTC-based) of local midnight of the rule's day
        if (r.kind === 'M') {
          var first = new Date(Date.UTC(y, r.m - 1, 1)).getUTCDay();
          var day = 1 + ((r.d - first + 7) % 7) + (r.w - 1) * 7;
          var dim = new Date(Date.UTC(y, r.m, 0)).getUTCDate();
          while (day > dim) day -= 7;
          return Date.UTC(y, r.m - 1, day);
        }
        if (r.kind === 'J') return Date.UTC(y, 0, 1) + (r.n - 1 + (leap(y) && r.n >= 60 ? 1 : 0)) * 86400000;
        return Date.UTC(y, 0, 1) + r.n * 86400000;
      };
      return {
        info: (ms) => {
          var y = new Date(ms + stdOff * 1000).getUTCFullYear();
          var rr = rules || usRules(y);
          var start = ruleDay(rr[0], y) + rr[0].time * 1000 - stdOff * 1000;
          var end = ruleDay(rr[1], y) + rr[1].time * 1000 - dstOff * 1000;
          var inDst = start < end ? (ms >= start && ms < end) : !(ms >= end && ms < start);
          return inDst ? { off: dstOff, dst: true, abbr: dstName } : { off: stdOff, dst: false, abbr: stdName };
        },
      };
    };

    // TZ unset: the machine's local zone.
    if (tz === null) {
      var sys = null;
      try { sys = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
      if (sys) { try { return intlZone(sys); } catch (e) {} }
      return {
        info: (ms) => {
          var d = new Date(ms), y = d.getFullYear();
          var jan = -new Date(y, 0, 1).getTimezoneOffset() * 60, jul = -new Date(y, 6, 1).getTimezoneOffset() * 60;
          var off = -d.getTimezoneOffset() * 60;
          return { off: off, dst: off > Math.min(jan, jul), abbr: numericAbbr(off) };
        },
      };
    }
    if (tz[0] === ':') tz = tz.slice(1);
    if (tz === '') return fixedZone(0, 'UTC');
    if (/^(Etc\/)?(GMT|Greenwich|GMT0|GMT\+0|GMT-0)$/.test(tz)) return fixedZone(0, 'GMT');
    if (/^(Etc\/)?(UTC|UCT|Universal|Zulu)$/.test(tz)) return fixedZone(0, 'UTC');
    // Zone names are file names under /usr/share/zoneinfo: letters first, and
    // case-sensitive on Linux.
    if (/^[A-Za-z][A-Za-z0-9_+\-\/]*$/.test(tz)) {
      try {
        var resolved = new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone;
        if (resolved && (tz.indexOf('/') < 0 || tz.split('/').every((p) => /^[A-Z0-9]/.test(p)))) return intlZone(tz);
      } catch (e) {}
    }
    var pz = posixZone(tz);
    if (pz) return pz;
    // glibc: unparseable TZ -> UTC, abbreviation taken from the string.
    var nm = tz.match(/^[A-Za-z]{3,}/);
    return fixedZone(0, nm ? nm[0].slice(0, 6) : 'UTC');
  },

  $simphpTZ: { ptrs: null, key: undefined, zone: null },
  $simphpZone__deps: ['$simphpTZ', '$simphpMakeZone', 'getenv', '$UTF8ToString', '$stringToUTF8',
    '$stackSave', '$stackRestore', '$stringToUTF8OnStack'],
  $simphpZone: () => {
    var sp = stackSave();
    var p = _getenv(stringToUTF8OnStack('TZ'));
    stackRestore(sp);
    var tz = p ? UTF8ToString(p) : null;
    var S = simphpTZ;
    if (S.zone && S.key === tz) return S.zone;
    S.key = tz;
    S.zone = simphpMakeZone(tz);
    // refresh tzname[] / timezone / daylight like tzset() would
    if (S.ptrs) {
      var y = new Date().getUTCFullYear();
      var a = S.zone.info(Date.UTC(y, 0, 1)), b = S.zone.info(Date.UTC(y, 6, 1));
      var std = a.off <= b.off ? a : b, dst = a.off <= b.off ? b : a;
      {{{ makeSetValue('S.ptrs.timezone', '0', '-std.off', '*') }}};
      {{{ makeSetValue('S.ptrs.daylight', '0', 'Number(a.off != b.off)', 'i32') }}};
      stringToUTF8(std.abbr, S.ptrs.std, 7);
      stringToUTF8(a.off != b.off ? dst.abbr : std.abbr, S.ptrs.dst, 7);
    }
    return S.zone;
  },

  _tzset_js__deps: ['$simphpTZ', '$simphpZone'],
  _tzset_js: (timezone, daylight, std_name, dst_name) => {
    simphpTZ.ptrs = { timezone: timezone, daylight: daylight, std: std_name, dst: dst_name };
    simphpTZ.zone = null;
    simphpZone();
  },

  $simphpFillTm__deps: ['$simphpZone'],
  $simphpFillTm: (secs, tmPtr, info) => {
    var d = new Date((secs + info.off) * 1000);
    if (isNaN(d.getTime())) return 1;
    {{{ makeSetValue('tmPtr', C_STRUCTS.tm.tm_sec, 'd.getUTCSeconds()', 'i32') }}};
    {{{ makeSetValue('tmPtr', C_STRUCTS.tm.tm_min, 'd.getUTCMinutes()', 'i32') }}};
    {{{ makeSetValue('tmPtr', C_STRUCTS.tm.tm_hour, 'd.getUTCHours()', 'i32') }}};
    {{{ makeSetValue('tmPtr', C_STRUCTS.tm.tm_mday, 'd.getUTCDate()', 'i32') }}};
    {{{ makeSetValue('tmPtr', C_STRUCTS.tm.tm_mon, 'd.getUTCMonth()', 'i32') }}};
    {{{ makeSetValue('tmPtr', C_STRUCTS.tm.tm_year, 'd.getUTCFullYear()-1900', 'i32') }}};
    {{{ makeSetValue('tmPtr', C_STRUCTS.tm.tm_wday, 'd.getUTCDay()', 'i32') }}};
    var yday = Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000);
    {{{ makeSetValue('tmPtr', C_STRUCTS.tm.tm_yday, 'yday', 'i32') }}};
    {{{ makeSetValue('tmPtr', C_STRUCTS.tm.tm_gmtoff, 'info.off', LONG_TYPE) }}};
    {{{ makeSetValue('tmPtr', C_STRUCTS.tm.tm_isdst, 'info.dst ? 1 : 0', 'i32') }}};
    return 0;
  },

  _localtime_js__i53abi: true,
  _localtime_js__deps: ['$simphpZone', '$simphpFillTm'],
  _localtime_js: (time, tmPtr) => {
    if (!isFinite(time)) return 1;
    var info = simphpZone().info(time * 1000);
    return simphpFillTm(time, tmPtr, info);
  },

  _mktime_js__i53abi: true,
  _mktime_js__deps: ['$simphpZone', '$simphpFillTm'],
  _mktime_js: (tmPtr) => {
    var z = simphpZone();
    var d = new Date(0);
    d.setUTCFullYear({{{ makeGetValue('tmPtr', C_STRUCTS.tm.tm_year, 'i32') }}} + 1900,
                     {{{ makeGetValue('tmPtr', C_STRUCTS.tm.tm_mon, 'i32') }}},
                     {{{ makeGetValue('tmPtr', C_STRUCTS.tm.tm_mday, 'i32') }}});
    d.setUTCHours({{{ makeGetValue('tmPtr', C_STRUCTS.tm.tm_hour, 'i32') }}},
                  {{{ makeGetValue('tmPtr', C_STRUCTS.tm.tm_min, 'i32') }}},
                  {{{ makeGetValue('tmPtr', C_STRUCTS.tm.tm_sec, 'i32') }}}, 0);
    var L = d.getTime(); // wall-clock time expressed as if it were UTC
    if (isNaN(L)) return -1;
    var dst = {{{ makeGetValue('tmPtr', C_STRUCTS.tm.tm_isdst, 'i32') }}};
    var t = L - z.info(L).off * 1000;
    var info = z.info(t);
    t = L - info.off * 1000;
    var info2 = z.info(t);
    if (info2.off !== info.off) { t = L - info2.off * 1000; info2 = z.info(t); }
    if (t + info2.off * 1000 !== L) {
      // L falls in a spring-forward gap: glibc applies the offset from before
      // the transition (the smaller one), so 02:30 becomes 03:30 local time.
      var before = z.info(t - 43200000).off, after = z.info(t + 43200000).off;
      t = L - Math.min(before, after) * 1000;
      info2 = z.info(t);
    }
    if (dst >= 0 && (dst > 0) !== info2.dst) {
      // caller insists on (non-)DST: reinterpret using the other offset.
      // glibc assumes a one-hour DST shift even in zones that have no DST.
      var y = new Date(L).getUTCFullYear();
      var a = z.info(Date.UTC(y, 0, 1)).off, b = z.info(Date.UTC(y, 6, 1)).off;
      var delta = (a !== b ? Math.abs(a - b) : 3600) * 1000;
      t += dst > 0 ? -delta : delta;
    }
    var secs = Math.floor(t / 1000);
    // i386 glibc: time_t is 32 bits; out-of-range dates fail.
    if (secs < -2147483648 || secs > 2147483647) return -1;
    simphpFillTm(secs, tmPtr, z.info(secs * 1000));
    return secs;
  },

  // ---------------------------------------------------------------------------
  // Local network services (the simulated mysqld). The service object comes
  // from the embedder as Module.simphpServices = { connect(path, port) -> conn },
  // conn = { write(Uint8Array), read(max) -> Uint8Array, close(), closed }.
  // A connection the service closed reads EOF and fails writes (EPIPE).
  // ---------------------------------------------------------------------------
  $simphpConns: {},
  simphp_service_connect__deps: ['$simphpConns', '$UTF8ToString'],
  simphp_service_connect: (fd, pathPtr, port) => {
    var svc = Module['simphpServices'];
    if (!svc) return 0;
    var conn = svc.connect(pathPtr ? UTF8ToString(pathPtr) : null, port);
    if (!conn) return 0;
    simphpConns[fd] = conn;
    return 1;
  },
  simphp_service_read__deps: ['$simphpConns'],
  simphp_service_read: (fd, buf, size) => {
    var c = simphpConns[fd];
    if (!c) return 0;
    var data = c.read(size);
    HEAPU8.set(data, buf);
    return data.length;
  },
  simphp_service_write__deps: ['$simphpConns'],
  simphp_service_write: (fd, buf, size) => {
    var c = simphpConns[fd];
    if (!c || c.closed) return -1;
    c.write(HEAPU8.slice(buf, buf + size));
    return size;
  },
  simphp_service_close__deps: ['$simphpConns'],
  simphp_service_close: (fd) => {
    var c = simphpConns[fd];
    if (c) { try { c.close(); } catch (e) {} }
    delete simphpConns[fd];
  },
});
