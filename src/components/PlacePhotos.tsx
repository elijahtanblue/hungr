import { useEffect, useState } from "react";
import { Image, ScrollView, Text, StyleSheet } from "react-native";
import { getPhotoUri } from "../api/placePhotos";
import type { ReviewPhoto } from "../api/community";
import { colors, radius, space } from "../theme";

// A single gallery combining live Google photos and approved first-party hungr review photos.
// Google entries are still fetched live via resource name; hungr entries are signed URLs.
export function PlacePhotos({ names, reviewPhotos = [] }: { names: string[]; reviewPhotos?: ReviewPhoto[] }) {
  const [uris, setUris] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all(names.slice(0, 6).map((n) => getPhotoUri(n).catch(() => null)))
      .then((res) => { if (active) setUris(res.filter((u): u is string => !!u)); });
    return () => { active = false; };
  }, [names]);

  const combined = [
    ...reviewPhotos.map((photo) => ({ key: `hungr-${photo.id}`, uri: photo.uri })),
    ...uris.map((uri, i) => ({ key: `google-${i}`, uri })),
  ];

  if (combined.length === 0) return null;

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {combined.map((photo) => (
          <Image key={photo.key} source={{ uri: photo.uri }} style={s.photo} accessibilityIgnoresInvertColors />
        ))}
      </ScrollView>
      <Text style={s.caption}>{reviewPhotos.length > 0 ? "Photos from hungr and Google" : "Photos by Google"}</Text>
    </>
  );
}

const s = StyleSheet.create({
  row: { gap: space.sm, paddingVertical: space.xs },
  photo: { width: 220, height: 150, borderRadius: radius.md, backgroundColor: colors.hair },
  caption: { fontSize: 11, color: colors.muted, marginTop: 2 },
});
