import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView } from "expo-camera";
import * as FS from "expo-file-system/legacy";
import { Camera, ScanText, X } from "lucide-react-native";
import { nativeColor, useAuroraTokens } from "@aurora/react-native";
import OcrCrop, { type CapturedPhoto } from "./OcrCrop";
import type { Crop } from "./crop";

export type CaptureMode = "photo" | "ocr";

/** Owns temporary photos until the caller has copied the photo or extracted its text. */
export default function CaptureCamera({
  mode,
  onCapture,
  onClose,
  onMessage,
}: {
  mode: CaptureMode;
  onCapture: (uri: string, crop?: Crop) => Promise<void>;
  onClose: () => void;
  onMessage: (message: string) => void;
}) {
  const tokens = useAuroraTokens();
  const surface = nativeColor(tokens.surface);
  const ink = nativeColor(tokens.onSurface);
  const primary = nativeColor(tokens.primary);
  const onPrimary = nativeColor(tokens.onPrimary);
  const camera = useRef<CameraView>(null);
  const locked = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [captured, setCaptured] = useState<CapturedPhoto | null>(null);
  const retainedPhoto = useRef<string | null>(null);
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
      setReady(false);
    });
    return () => sub.remove();
  }, []);
  useEffect(
    () => () => {
      if (retainedPhoto.current)
        void FS.deleteAsync(retainedPhoto.current, { idempotent: true }).catch(
          () => {},
        );
    },
    [],
  );
  const retake = () => {
    if (locked.current) return;
    if (retainedPhoto.current)
      void FS.deleteAsync(retainedPhoto.current, { idempotent: true }).catch(
        () => {},
      );
    retainedPhoto.current = null;
    setCaptured(null);
    setReady(false);
  };
  const recognize = async (crop: Crop) => {
    if (locked.current || !captured) return;
    locked.current = true;
    setBusy(true);
    try {
      await onCapture(captured.uri, crop);
      onClose();
    } catch (error) {
      onMessage(
        error instanceof Error
          ? error.message
          : "Could not recognize text. Adjust the crop or retake the photo.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const close = () => {
    if (!locked.current) onClose();
  };
  const capture = async () => {
    if (locked.current || !ready || !camera.current) return;
    locked.current = true;
    setBusy(true);
    let uri: string | undefined;
    try {
      const photo = await camera.current.takePictureAsync({
        quality: 0.9,
        exif: false,
      });
      uri = photo?.uri;
      if (!uri) throw new Error("Could not take the photo. Try again.");
      if (mode === "ocr") {
        retainedPhoto.current = uri;
        setCaptured({ uri, width: photo.width, height: photo.height });
        uri = undefined;
        return;
      }
      await onCapture(uri);
      onClose();
    } catch (error) {
      onMessage(
        error instanceof Error ? error.message : "Could not process the photo.",
      );
    } finally {
      if (uri) await FS.deleteAsync(uri, { idempotent: true }).catch(() => {});
      locked.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <SafeAreaView style={[s.screen, { backgroundColor: surface }]}>
        <View style={s.heading}>
          <Text style={[s.title, { color: ink }]}>
            {captured
              ? "Crop for text"
              : mode === "ocr"
                ? "Scan text"
                : "Take a photo"}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close camera"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={close}
            style={s.close}
          >
            <X size={24} color={ink} />
          </Pressable>
        </View>
        {captured ? (
          <OcrCrop
            photo={captured}
            busy={busy}
            onContinue={(crop) => void recognize(crop)}
            onRetake={retake}
            onMessage={onMessage}
          />
        ) : (
          <>
            {active && (
              <CameraView
                ref={camera}
                style={{ flex: 1 }}
                facing="back"
                mode="picture"
                animateShutter={false}
                flash="off"
                onCameraReady={() => setReady(true)}
                onMountError={() => {
                  onMessage(
                    "Could not open the camera. Check camera access in Settings.",
                  );
                  onClose();
                }}
              />
            )}
            <Text
              accessibilityLiveRegion="polite"
              style={[s.hint, { color: ink }]}
            >
              {busy
                ? mode === "ocr"
                  ? "Recognizing text…"
                  : "Adding photo…"
                : mode === "ocr"
                  ? "Keep the text clear and inside the frame."
                  : "The photo will be added to your quanta."}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                mode === "ocr" ? "Capture text" : "Take photo"
              }
              accessibilityState={{ disabled: !ready || busy || !active, busy }}
              disabled={!ready || busy || !active}
              onPress={() => void capture()}
              style={[
                s.shutter,
                {
                  backgroundColor: primary,
                  opacity: ready && !busy && active ? 1 : 0.45,
                },
              ]}
            >
              {mode === "ocr" ? (
                <ScanText size={28} color={onPrimary} />
              ) : (
                <Camera size={28} color={onPrimary} />
              )}
            </Pressable>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  title: { fontFamily: "DMSans_600SemiBold", fontSize: 22 },
  close: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    textAlign: "center",
    padding: 16,
  },
  shutter: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
});
