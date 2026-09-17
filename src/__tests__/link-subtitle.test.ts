import { linkSubtitle } from "@/lib/links/subtitle";

describe("linkSubtitle", () => {
  test("réseaux : l'identifiant", () => {
    expect(linkSubtitle("https://www.youtube.com/@la_philosophia", "Youtube")).toBe("@la_philosophia");
    expect(linkSubtitle("https://youtube.com/c/MaChaine/videos", "YouTube")).toBe("@MaChaine");
    expect(linkSubtitle("https://instagram.com/philo_sophia_", "Instagram")).toBe("@philo_sophia_");
    expect(linkSubtitle("https://www.tiktok.com/@philo_sophia_?lang=fr", "TikTok")).toBe("@philo_sophia_");
    expect(linkSubtitle("https://x.com/wendtech", "Twitter")).toBe("@wendtech");
    expect(linkSubtitle("https://facebook.com/philosophia", "Facebook")).toBe("@philosophia");
  });

  test("pages génériques ou identifiant illisible : le domaine", () => {
    expect(linkSubtitle("https://www.facebook.com/profile.php?id=123", "Facebook")).toBe("facebook.com");
    expect(linkSubtitle("https://www.tiktok.com/", "TikTok")).toBe("tiktok.com");
    expect(linkSubtitle("https://maboutique.example.com/catalogue", "Catalogue")).toBe("maboutique.example.com");
  });

  test("rien quand ça répète le titre ou que ce n'est pas une adresse web", () => {
    expect(linkSubtitle("https://instagram.com/philosophia", "PhiloSophia")).toBeNull();
    expect(linkSubtitle("https://www.youtube.com/@la_philosophia", "la_philosophia")).toBeNull();
    expect(linkSubtitle("mailto:contact@example.com", "Écris-moi")).toBeNull();
    expect(linkSubtitle("tel:+22670000000", "Appelle-moi")).toBeNull();
    expect(linkSubtitle("pas une url", "Lien")).toBeNull();
  });
});
