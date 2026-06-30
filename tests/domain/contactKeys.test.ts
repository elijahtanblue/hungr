import { normalizeEmail, normalizePhone, contactIdentifiers } from "../../src/domain/contactKeys";

test("normalizeEmail lowercases and trims", () => {
  expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
});

test("normalizePhone keeps digits only and drops short numbers", () => {
  expect(normalizePhone("+61 (412) 345-678")).toBe("61412345678");
  expect(normalizePhone("12345")).toBeNull();
});

test("contactIdentifiers flattens and de-duplicates emails and phones", () => {
  const out = contactIdentifiers([
    { emails: ["A@b.com"], phones: ["0412 345 678"] },
    { emails: ["a@b.com"], phones: ["123"] }, // dup email, too-short phone
    { phones: ["0412345678"] },               // same digits as first phone
  ]);
  expect(out.sort()).toEqual(["0412345678", "a@b.com"]);
});
