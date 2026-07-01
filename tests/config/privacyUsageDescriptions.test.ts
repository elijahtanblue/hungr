import fs from "fs";
import path from "path";

const contactsText = "hungr uses your contacts to find friends who are already here. We only send scrambled (hashed) versions, never the numbers themselves.";
const photosText = "hungr lets you attach photos from your library to your own restaurant reviews.";

test("Expo config declares the iOS contacts usage description", () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "app.json"), "utf8"));
  expect(appJson.expo.ios.infoPlist.NSContactsUsageDescription).toBe(contactsText);
});

test("Generated iOS project contains the contacts usage description", () => {
  const plist = fs.readFileSync(path.join(process.cwd(), "ios", "hungr", "Info.plist"), "utf8");
  expect(plist).toContain("<key>NSContactsUsageDescription</key>");
  expect(plist).toContain(`<string>${contactsText}</string>`);
});

test("Expo config declares the iOS photo library usage description", () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "app.json"), "utf8"));
  expect(appJson.expo.ios.infoPlist.NSPhotoLibraryUsageDescription).toBe(photosText);
});

test("Generated iOS project contains the photo library usage description", () => {
  const plist = fs.readFileSync(path.join(process.cwd(), "ios", "hungr", "Info.plist"), "utf8");
  expect(plist).toContain("<key>NSPhotoLibraryUsageDescription</key>");
  expect(plist).toContain(`<string>${photosText}</string>`);
});
