import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { nativeColor, useAuroraTokens } from "@aurora/react-native";
import { ArrowRight, Camera, Scan } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import {
  dragCrop,
  fitImage,
  fullCrop,
  type Crop,
  type CropHandle,
} from "./crop";

export type CapturedPhoto = { uri: string; width: number; height: number };

function Handle({
  kind,
  crop,
  width,
  height,
  disabled,
  onChange,
  color,
}: {
  kind: CropHandle;
  crop: Crop;
  width: number;
  height: number;
  disabled: boolean;
  onChange: (crop: Crop) => void;
  color: string;
}) {
  const latest = useRef({ crop, disabled, onChange });
  latest.current = { crop, disabled, onChange };
  const start = useRef(crop);
  const move = (base: Crop, dx: number, dy: number) => {
    if (!latest.current.disabled)
      latest.current.onChange(
        dragCrop(
          base,
          kind,
          dx,
          dy,
          Math.min(1, 48 / width),
          Math.min(1, 48 / height),
        ),
      );
  };
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !latest.current.disabled,
        onMoveShouldSetPanResponder: () => !latest.current.disabled,
        onPanResponderGrant: () => {
          start.current = latest.current.crop;
        },
        onPanResponderMove: (_, gesture) =>
          move(start.current, gesture.dx / width, gesture.dy / height),
        onPanResponderTerminationRequest: () => false,
      }),
    [kind, width, height],
  );
  const left = crop.x * width,
    top = crop.y * height,
    w = crop.width * width,
    h = crop.height * height;
  const isLeft = kind.endsWith("l"),
    isTop = kind.startsWith("t");
  const label =
    kind === "move"
      ? "Move selection"
      : `${isTop ? "Top" : "Bottom"} ${isLeft ? "left" : "right"} crop corner`;
  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint="Use the adjustment actions to move this part of the selection."
      accessibilityState={{ disabled }}
      accessibilityValue={{
        text: `${Math.round(crop.width * 100)} percent wide, ${Math.round(crop.height * 100)} percent tall`,
      }}
      accessibilityActions={[
        { name: "left", label: "Move left" },
        { name: "right", label: "Move right" },
        { name: "up", label: "Move up" },
        { name: "down", label: "Move down" },
      ]}
      onAccessibilityAction={({ nativeEvent: { actionName } }) =>
        move(
          latest.current.crop,
          actionName === "left" ? -0.02 : actionName === "right" ? 0.02 : 0,
          actionName === "up" ? -0.02 : actionName === "down" ? 0.02 : 0,
        )
      }
      style={
        kind === "move"
          ? {
              position: "absolute",
              left: left + 16,
              top: top + 16,
              width: Math.max(0, w - 32),
              height: Math.max(0, h - 32),
            }
          : [
              s.handle,
              {
                left: left + (isLeft ? 0 : w) - 24,
                top: top + (isTop ? 0 : h) - 24,
              },
            ]
      }
    >
      {kind !== "move" && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: isLeft ? 24 : 2,
            top: isTop ? 24 : 2,
            width: 22,
            height: 22,
            borderColor: color,
            borderTopWidth: isTop ? 4 : 0,
            borderBottomWidth: isTop ? 0 : 4,
            borderLeftWidth: isLeft ? 4 : 0,
            borderRightWidth: isLeft ? 0 : 4,
            backgroundColor: "transparent",
          }}
        />
      )}
    </View>
  );
}

export default function OcrCrop({
  photo,
  busy,
  onContinue,
  onRetake,
  onMessage,
}: {
  photo: CapturedPhoto;
  busy: boolean;
  onContinue: (crop: Crop) => void;
  onRetake: () => void;
  onMessage: (message: string) => void;
}) {
  const tokens = useAuroraTokens();
  const ink = nativeColor(tokens.onSurface),
    muted = nativeColor(tokens.onSurfaceVariant);
  const primary = nativeColor(tokens.primary),
    onPrimary = nativeColor(tokens.onPrimary);
  const inset = nativeColor(tokens.surfaceContainerLow),
    tint = nativeColor(tokens.primaryContainer),
    tintInk = nativeColor(tokens.onPrimaryContainer);
  const [crop, setCrop] = useState<Crop>(fullCrop);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [loaded, setLoaded] = useState(false);
  const image = fitImage(
    photo.width,
    photo.height,
    Math.max(0, area.width - 48),
    Math.max(0, area.height - 48),
  );
  const x = crop.x * image.width,
    y = crop.y * image.height,
    w = crop.width * image.width,
    h = crop.height * image.height;
  return (
    <>
      <View style={s.instructions}>
        <Text style={[s.intro, { color: ink }]}>Choose the text to keep</Text>
        <Text style={[s.hint, { color: muted }]}>
          Drag the corners to crop. Leave the full image selected to scan
          everything.
        </Text>
      </View>
      <View
        style={[s.stage, { backgroundColor: inset }]}
        onLayout={({ nativeEvent: { layout } }) =>
          setArea({ width: layout.width, height: layout.height })
        }
      >
        {image.width > 0 && image.height > 0 && (
          <View style={{ width: image.width, height: image.height }}>
            <Image
              source={{ uri: photo.uri }}
              resizeMode="contain"
              style={StyleSheet.absoluteFill}
              onLoad={() => setLoaded(true)}
              onError={() => {
                setLoaded(false);
                onMessage("Could not load the photo. Retake it to try again.");
              }}
              accessible={false}
            />
            <Svg
              pointerEvents="none"
              width={image.width}
              height={image.height}
              style={StyleSheet.absoluteFill}
            >
              <Path
                d={`M0 0H${image.width}V${image.height}H0Z M${x} ${y}H${x + w}V${y + h}H${x}Z`}
                fill={inset}
                fillOpacity={0.75}
                fillRule="evenodd"
              />
            </Svg>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: w,
                height: h,
                borderWidth: 1.5,
                borderColor: primary,
              }}
            />
            {(["move", "tl", "tr", "bl", "br"] as const).map((kind) => (
              <Handle
                key={kind}
                kind={kind}
                crop={crop}
                width={image.width}
                height={image.height}
                disabled={busy || !loaded}
                onChange={setCrop}
                color={primary}
              />
            ))}
          </View>
        )}
      </View>
      <View style={s.footer}>
        <View style={s.tools}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            accessibilityState={{ disabled: busy }}
            accessibilityLabel="Retake photo"
            accessibilityHint="Take a new photo."
            onPress={onRetake}
            style={({ pressed }) => [
              s.tool,
              {
                backgroundColor: tint,
                opacity: busy ? 0.45 : pressed ? 0.7 : 1,
              },
            ]}
          >
            <Camera size={22} color={tintInk} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            accessibilityState={{ disabled: busy }}
            accessibilityLabel="Reset crop"
            accessibilityHint="Select the full image."
            onPress={() => setCrop(fullCrop)}
            style={({ pressed }) => [
              s.tool,
              {
                backgroundColor: tint,
                opacity: busy ? 0.45 : pressed ? 0.7 : 1,
              },
            ]}
          >
            <Scan size={22} color={tintInk} />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy || !loaded, busy }}
          disabled={busy || !loaded}
          onPress={() => onContinue(crop)}
          style={[
            s.continue,
            { backgroundColor: primary, opacity: busy || !loaded ? 0.5 : 1 },
          ]}
        >
          {busy ? <ActivityIndicator color={onPrimary} /> : null}
          <Text
            accessibilityLiveRegion="polite"
            style={[s.buttonText, { color: onPrimary }]}
          >
            {busy ? "Recognizing text…" : "Continue"}
          </Text>
          {!busy && <ArrowRight size={20} color={onPrimary} />}
        </Pressable>
      </View>
    </>
  );
}
const s = StyleSheet.create({
  instructions: { paddingHorizontal: 20, paddingBottom: 16, gap: 6 },
  intro: { fontFamily: "DMSans_600SemiBold", fontSize: 18 },
  hint: { fontFamily: "DMSans_400Regular", fontSize: 14, lineHeight: 20 },
  stage: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  handle: {
    position: "absolute",
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: { padding: 16, gap: 12 },
  tools: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
  },
  tool: {
    height: 48,
    width: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: { fontFamily: "DMSans_600SemiBold", fontSize: 15 },
  continue: {
    minHeight: 60,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
});
