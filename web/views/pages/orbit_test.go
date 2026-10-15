package pages

import (
	"encoding/json"
	"strings"
	"testing"
	"uuid"
	"workshop/internal/domain/sighting"
	"workshop/internal/domain/species"
)

func TestBuildOrbit(t *testing.T) {
	items := []sighting.Sighting{
		{ID: uuid.New(), Species: species.Species{GBIFKey: 5220086, ScientificName: "Megaptera novaeangliae", VernacularName: "Humpback whale"}, Media: []sighting.Media{
			{Type: "StillImage", URL: "javascript:alert(1)"},
			{Type: "StillImage", URL: "https://example.com/whale.jpg", Creator: "Photographer"},
		}, ReferenceURL: "javascript:alert(1)", RecordedBy: "Observer"},
		{ID: uuid.New(), Species: species.Species{ScientificName: "Panthera leo"}},
	}
	got := BuildOrbit(items)
	if got.Total != 2 || got.Species != 2 || len(got.Records) != 1 || len(got.Initial) != 1 {
		t.Fatalf("unexpected totals: %+v", got)
	}
	r := got.Records[0]
	if !r.Aquatic || r.Photo.URL != "https://example.com/whale.jpg" || r.Source != "" || r.Observer != "Observer" {
		t.Fatalf("unexpected presentation: %+v", r)
	}
}

func TestBuildOrbitEmptyAndSafeJSON(t *testing.T) {
	empty := BuildOrbit(nil)
	b, err := json.Marshal(empty)
	if err != nil || !strings.Contains(string(b), `"records":[]`) || !strings.Contains(string(b), `"countries":[]`) {
		t.Fatalf("empty data not arrays: %s, %v", b, err)
	}
	data := BuildOrbit([]sighting.Sighting{{ID: uuid.New(), Species: species.Species{VernacularName: "</script><script>alert(1)</script>"}, Media: []sighting.Media{{Type: "StillImage", URL: "https://example.com/image.jpg"}}}})
	b, err = json.Marshal(data)
	if err != nil || strings.Contains(string(b), "</script>") {
		t.Fatalf("unescaped script boundary: %s, %v", b, err)
	}
}

func TestOrbitImageSize(t *testing.T) {
	cases := []struct{ raw, want string }{
		{"https://inaturalist-open-data.s3.amazonaws.com/photos/123/original.jpg", "https://inaturalist-open-data.s3.amazonaws.com/photos/123/medium.jpg"},
		{"https://static.inaturalist.org/photos/123/original.jpeg", "https://static.inaturalist.org/photos/123/medium.jpeg"},
		{"https://example.com/photos/123/original.jpg", "https://example.com/photos/123/original.jpg"},
		{"javascript:alert(1)", ""},
	}
	for _, c := range cases {
		if got := orbitImageSize(c.raw, "medium"); got != c.want {
			t.Errorf("%s: got %s, want %s", c.raw, got, c.want)
		}
	}
}
