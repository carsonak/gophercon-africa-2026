package pages

import (
	"cmp"
	"net/url"
	"slices"
	"strings"
	"workshop/internal/domain/sighting"
	"workshop/internal/domain/species"
)

type OrbitPhoto struct {
	URL          string `json:"url"`
	Thumb        string `json:"thumb"`
	Large        string `json:"large"`
	Creator      string `json:"creator"`
	License      string `json:"license"`
	RightsHolder string `json:"rightsHolder"`
}

type OrbitRecord struct {
	ID          string     `json:"id"`
	Species     string     `json:"species"`
	Name        string     `json:"name"`
	Scientific  string     `json:"scientific"`
	Country     string     `json:"country"`
	CountryCode string     `json:"countryCode"`
	Place       string     `json:"place"`
	Lat         float64    `json:"lat"`
	Lng         float64    `json:"lng"`
	Date        string     `json:"date"`
	Observer    string     `json:"observer"`
	Count       *int       `json:"count"`
	Remarks     string     `json:"remarks"`
	Source      string     `json:"source"`
	Temperature float64    `json:"temperature"`
	FeelsLike   float64    `json:"feelsLike"`
	Humidity    int        `json:"humidity"`
	Rain        float64    `json:"rain"`
	Wind        float64    `json:"wind"`
	Condition   string     `json:"condition"`
	Aquatic     bool       `json:"aquatic"`
	Photo       OrbitPhoto `json:"photo"`
}

type OrbitCountry struct {
	Code string `json:"code"`
	Name string `json:"name"`
}
type OrbitPage struct {
	Records   []OrbitRecord  `json:"records"`
	Countries []OrbitCountry `json:"countries"`
	Total     int            `json:"total"`
	Species   int            `json:"species"`
	Initial   []OrbitRecord  `json:"-"`
}

// BuildOrbit prepares safe, compact presentation data without fetching external resources.
func BuildOrbit(items []sighting.Sighting) OrbitPage {
	out := OrbitPage{Records: []OrbitRecord{}, Countries: []OrbitCountry{}, Total: len(items)}
	water := map[int]bool{}
	for _, animal := range species.Animals() {
		name := animal.String()
		if strings.Contains(name, "whale") || strings.Contains(name, "dolphin") || strings.Contains(name, "shark") || strings.Contains(name, "penguin") || strings.Contains(name, "seal") || slices.Contains([]string{"orca", "beluga", "narwhal", "walrus", "sea_otter", "green_turtle", "leatherback_turtle"}, name) {
			for _, key := range animal.TaxonKeys() {
				water[key] = true
			}
		}
	}
	countries := map[string]string{}
	seenSpecies := map[string]bool{}
	for _, s := range items {
		seenSpecies[s.Species.ScientificName] = true
		var photo OrbitPhoto
		for _, m := range s.Media {
			if m.Type == "StillImage" && safeOrbitURL(m.URL) != "" {
				photo = OrbitPhoto{URL: safeOrbitURL(m.URL), Thumb: orbitImageSize(m.URL, "medium"), Large: orbitImageSize(m.URL, "large"), Creator: m.Creator, License: m.License, RightsHolder: m.RightsHolder}
				break
			}
		}
		if photo.URL == "" {
			continue
		}
		parts := []string{}
		for _, part := range []string{s.Location.Locality, s.Location.StateProvince, s.Location.Country} {
			if part != "" {
				parts = append(parts, part)
			}
		}
		r := OrbitRecord{
			ID: s.ID.String(), Species: cmp.Or(s.Species.ScientificName, s.Species.CanonicalName, s.Species.ID.String()),
			Name: cmp.Or(s.Species.VernacularName, s.Species.CanonicalName, s.Species.ScientificName, "Unknown species"), Scientific: s.Species.ScientificName,
			Country: s.Location.Country, CountryCode: s.Location.CountryCode.String(), Place: cmp.Or(strings.Join(parts, ", "), "Location not recorded"),
			Lat: s.Location.Latitude, Lng: s.Location.Longitude, Date: s.HappenedAt.Format("2 January 2006"), Observer: s.RecordedBy,
			Count: s.IndividualCount, Remarks: s.Remarks, Source: safeOrbitURL(s.ReferenceURL),
			Temperature: s.Weather.Temperature.Actual, FeelsLike: s.Weather.Temperature.Apparent, Humidity: s.Weather.Humidity, Rain: s.Weather.Precipitation.Rain,
			Wind: s.Weather.Wind.Speed, Condition: s.Weather.Condition.Description, Aquatic: water[s.Species.GBIFKey], Photo: photo,
		}
		out.Records = append(out.Records, r)
		if r.CountryCode != "" {
			countries[r.CountryCode] = cmp.Or(r.Country, r.CountryCode)
		}
	}
	out.Species = len(seenSpecies)
	for code, name := range countries {
		out.Countries = append(out.Countries, OrbitCountry{code, name})
	}
	slices.SortFunc(out.Countries, func(a, b OrbitCountry) int { return strings.Compare(a.Name, b.Name) })
	used := map[string]bool{}
	for _, r := range out.Records {
		if !used[r.Species] && len(out.Initial) < 6 {
			out.Initial = append(out.Initial, r)
			used[r.Species] = true
		}
	}
	for _, r := range out.Records {
		if len(out.Initial) >= min(6, len(out.Records)) {
			break
		}
		if !slices.ContainsFunc(out.Initial, func(x OrbitRecord) bool { return x.ID == r.ID }) {
			out.Initial = append(out.Initial, r)
		}
	}
	return out
}

func safeOrbitURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || (u.Scheme != "https" && u.Scheme != "http") {
		return ""
	}
	return u.String()
}

// orbitImageSize uses published iNaturalist sizes while retaining other source URLs.
func orbitImageSize(raw, size string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	if u.Host == "inaturalist-open-data.s3.amazonaws.com" || u.Host == "static.inaturalist.org" {
		parts := strings.Split(u.Path, "/")
		if len(parts) == 4 && parts[1] == "photos" && strings.HasPrefix(parts[3], "original.") {
			parts[3] = size + strings.TrimPrefix(parts[3], "original")
			u.Path = strings.Join(parts, "/")
		}
	}
	return safeOrbitURL(u.String())
}
