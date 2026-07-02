import { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, Image, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMyProfile, setUsername, updateMyProfile } from "../../src/api/social";
import { uploadAvatar } from "../../src/api/avatars";
import { colors, radius, space } from "../../src/theme";

const BIO_LIMIT = 160;

export default function EditProfile() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [handle, setHandle] = useState("");
  const [originalHandle, setOriginalHandle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyProfile()
      .then((p) => {
        setHandle(p?.username ?? "");
        setOriginalHandle(p?.username ?? "");
        setBio(p?.bio ?? "");
        setAvatarUrl(p?.avatarUrl ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function changePhoto() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const url = await uploadAvatar({ uri: result.assets[0].uri });
      setAvatarUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload that photo.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const trimmedHandle = handle.trim().toLowerCase();
      if (trimmedHandle !== originalHandle) {
        const res = await setUsername(trimmedHandle);
        if (!res.ok) {
          setError(res.error);
          return;
        }
      }
      const ok = await updateMyProfile({ bio, avatarUrl });
      if (!ok) {
        setError("Could not save your profile. Try again.");
        return;
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>Edit profile</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accentPress} style={s.loading} />
      ) : (
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={changePhoto} style={s.avatarWrap} accessibilityRole="button" accessibilityLabel="Change profile photo">
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarEmpty]}>
                <Ionicons name="person" size={40} color={colors.accentPress} />
              </View>
            )}
            <View style={s.avatarBadge}>
              {uploading ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Ionicons name="camera" size={16} color={colors.onAccent} />}
            </View>
          </Pressable>
          <Text style={s.changePhoto}>Change photo</Text>

          <Text style={s.label}>Username</Text>
          <View style={s.handleField}>
            <Text style={s.at}>@</Text>
            <TextInput
              style={s.handleInput}
              value={handle}
              onChangeText={setHandle}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="handle"
              placeholderTextColor={colors.muted}
              maxLength={20}
            />
          </View>
          <Text style={s.hint}>3-20 letters, numbers, or underscores.</Text>

          <Text style={s.label}>Bio</Text>
          <TextInput
            style={s.bioInput}
            value={bio}
            onChangeText={(t) => setBio(t.slice(0, BIO_LIMIT))}
            placeholder="Tell people what you're into."
            placeholderTextColor={colors.muted}
            multiline
          />
          <Text style={s.hint}>{bio.length}/{BIO_LIMIT}</Text>

          {error && <Text style={s.error}>{error}</Text>}

          <Pressable style={[s.save, saving && s.saveOff]} onPress={save} disabled={saving} accessibilityRole="button">
            {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={s.saveTxt}>Save</Text>}
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm, borderBottomColor: colors.hair, borderBottomWidth: 1, backgroundColor: colors.surface },
  back: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  loading: { paddingVertical: space.xxl },
  content: { padding: space.lg, alignItems: "stretch", gap: space.xs },
  avatarWrap: { alignSelf: "center", marginTop: space.sm },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface },
  avatarEmpty: { alignItems: "center", justifyContent: "center", borderColor: colors.hair, borderWidth: 1 },
  avatarBadge: { position: "absolute", right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accentPress, alignItems: "center", justifyContent: "center", borderColor: colors.canvas, borderWidth: 2 },
  changePhoto: { alignSelf: "center", color: colors.accentPress, fontWeight: "700", fontSize: 14, marginTop: space.xs, marginBottom: space.md },
  label: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: space.md },
  handleField: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, marginTop: space.xs },
  at: { color: colors.muted, fontSize: 16, fontWeight: "700" },
  handleInput: { flex: 1, color: colors.ink, fontSize: 16, paddingVertical: space.md, paddingLeft: 2 },
  bioInput: { minHeight: 88, backgroundColor: colors.surface, borderColor: colors.hair, borderWidth: 1, borderRadius: radius.md, padding: space.md, color: colors.ink, fontSize: 15, lineHeight: 21, marginTop: space.xs, textAlignVertical: "top" },
  hint: { fontSize: 12, color: colors.muted, marginTop: 4 },
  error: { fontSize: 14, color: colors.avoid, marginTop: space.sm, fontWeight: "600" },
  save: { backgroundColor: colors.accentPress, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingVertical: space.md, marginTop: space.lg, minHeight: 48 },
  saveOff: { opacity: 0.7 },
  saveTxt: { color: colors.onAccent, fontWeight: "800", fontSize: 16 },
});
