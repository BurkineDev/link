import { safeNextPath } from "@/lib/validations/next-path";

describe("safeNextPath", () => {
  it("accepte un chemin interne", () => {
    expect(safeNextPath("/pricing")).toBe("/pricing");
    expect(safeNextPath("/dashboard/page?tab=1")).toBe("/dashboard/page?tab=1");
  });

  it("refuse une URL absolue", () => {
    expect(safeNextPath("https://evil.com")).toBeNull();
    expect(safeNextPath("http://evil.com")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
  });

  it("refuse une adresse relative au protocole", () => {
    expect(safeNextPath("//evil.com")).toBeNull();
  });

  it("refuse les antislashs, que des navigateurs normalisent en /", () => {
    expect(safeNextPath("/\\evil.com")).toBeNull();
    expect(safeNextPath("\\\\evil.com")).toBeNull();
  });

  it("refuse les caractères de contrôle et les espaces", () => {
    expect(safeNextPath("/pricing\n")).toBeNull();
    expect(safeNextPath("/pricing ")).toBeNull();
    expect(safeNextPath("/pri\u0000cing")).toBeNull();
  });

  it("refuse une valeur absente ou démesurée", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath("/" + "a".repeat(600))).toBeNull();
  });
});
