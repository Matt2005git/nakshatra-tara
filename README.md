# Nakshatra and Tara (Sydney)

Live page: https://matt2005git.github.io/nakshatra-tara/

Shows the Moon Nakshatra for any date in local time for a chosen place (default Sydney; 22 preset cities or custom coordinates and time zone, daylight saving handled automatically), with start and end times, and the Tara counted from a chosen birth Nakshatra (remembered per device). Also shows sunrise, sunset and Rahu Kaal for the day, and a Planets tab (current time by default, or any chosen date and time) with sidereal positions, Nakshatra and pada, and a North Indian Lagna chart for Sydney.

- Sidereal Moon, Lahiri ayanamsa, Meeus lunar series, computed in the browser.
- Checked against Swiss Ephemeris (within 10 arcseconds, 1900 to 2100) and all 362 Nakshatra changes in the Astroved 2026 calendar (within 1 minute).
- Planets, Ascendant and Rahu (true node) via astronomy-engine, checked against Swiss Ephemeris 1950 to 2100: typical error under 10 arcseconds, worst case about 1 arcminute.
- Sunrise and sunset use the Sun's upper edge with refraction, the Drik Panchang convention. Rahu Kaal matches Drik for Sydney. The Astroved calendar uses the Sun's centre without refraction, so its New York times differ by a few minutes.
- Range: 1900 to 2100.

`index.html` is the bundled page. `src/` holds the calculation module and React component it was built from.
