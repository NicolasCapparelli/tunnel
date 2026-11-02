import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  ToastAndroid,
  Pressable,
  ScrollView,
  FlatList,
  type FlatListProps,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import Svg, {
  Defs,
  Pattern,
  Circle,
  Rect,
  LinearGradient,
  Stop,
} from "react-native-svg";
import { ChevronLeft, ChevronRight, Copy, Send, X } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import * as FS from "expo-file-system/legacy";
import type { Attachment } from "@tunnel/shared";

// Observe touches without taking the responder from selectable text or vertical scrolling.
// A right swipe drags the card over an accent "Tunnel" layer so the send is visible.
export function HoldSurface({
  children,
  onCopy,
  onTunnel,
  accent = "#6fe0c2",
  onAccent = "#102e28",
  style,
}: {
  children: ReactNode;
  onCopy: () => void;
  onTunnel?: () => void;
  accent?: string;
  onAccent?: string;
  style?: ViewStyle;
}) {
  const start = useRef({ x: 0, y: 0, held: false, swiping: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef(new Animated.Value(0)).current;
  const width = useRef(320);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancel, []);
  const settle = () =>
    Animated.spring(drag, {
      toValue: 0,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  // Fly the card out, send it, then bring it back in from the left.
  const send = () =>
    Animated.timing(drag, {
      toValue: width.current,
      duration: 170,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      onTunnel?.();
      drag.setValue(-width.current * 0.2);
      settle();
    });
  const end = () => {
    if (start.current.swiping) settle();
    start.current.swiping = false;
  };
  const surface = StyleSheet.flatten(style) ?? {};
  return (
    <View
      onLayout={(e) => (width.current = e.nativeEvent.layout.width)}
      accessible={false}
      accessibilityActions={[
        { name: "copy", label: "Copy" },
        ...(onTunnel
          ? [{ name: "tunnel", label: "Tunnel to selected devices" }]
          : []),
      ]}
      onAccessibilityAction={({ nativeEvent }) =>
        nativeEvent.actionName === "copy" ? onCopy() : onTunnel?.()
      }
      onTouchStart={(e) => {
        cancel();
        start.current = {
          x: e.nativeEvent.pageX,
          y: e.nativeEvent.pageY,
          held: false,
          swiping: false,
        };
        timer.current = setTimeout(() => {
          start.current.held = true;
          onCopy();
        }, 380);
      }}
      onTouchMove={(e) => {
        const dx = e.nativeEvent.pageX - start.current.x;
        const dy = e.nativeEvent.pageY - start.current.y;
        if (Math.hypot(dx, dy) > 8) cancel();
        if (!onTunnel || start.current.held) return;
        if (
          !start.current.swiping &&
          dx > 12 &&
          Math.abs(dx) > Math.abs(dy) * 1.6
        )
          start.current.swiping = true;
        if (start.current.swiping) drag.setValue(Math.max(0, dx));
      }}
      onTouchEnd={(e) => {
        cancel();
        const dx = e.nativeEvent.pageX - start.current.x;
        const dy = e.nativeEvent.pageY - start.current.y;
        if (!start.current.held && onTunnel && dx > 70 && Math.abs(dy) < 40) {
          start.current.swiping = false;
          send();
        } else end();
      }}
      onTouchCancel={() => {
        cancel();
        end();
      }}
    >
      {onTunnel && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            borderRadius: surface.borderRadius ?? 0,
            backgroundColor: accent,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingLeft: 20,
            opacity: drag.interpolate({
              inputRange: [0, 24, 70],
              outputRange: [0, 0.6, 1],
              extrapolate: "clamp",
            }),
          }}
        >
          <Send size={18} color={onAccent} />
          <Text
            style={{
              color: onAccent,
              fontFamily: "DMSans_600SemiBold",
              fontSize: 13,
            }}
          >
            Tunnel
          </Text>
        </Animated.View>
      )}
      <Animated.View style={[surface, { transform: [{ translateX: drag }] }]}>
        {children}
      </Animated.View>
    </View>
  );
}

export async function copyPhoto(photo: Attachment) {
  if (!photo.uri) throw new Error("This photo is unavailable.");
  const base64 = await FS.readAsStringAsync(photo.uri, {
    encoding: FS.EncodingType.Base64,
  });
  await Clipboard.setImageAsync(base64);
}

export function DotField({
  trigger,
  ink,
  accent,
}: {
  trigger: number | string;
  ink: string;
  accent: string;
}) {
  const sweep = useRef(new Animated.Value(0)).current;
  const [height, setHeight] = useState(700);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!live || reduced) return;
      sweep.setValue(0);
      Animated.timing(sweep, {
        toValue: 1,
        duration: 2600,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      live = false;
      sweep.stopAnimation();
    };
  }, [trigger]);
  return (
    <View
      pointerEvents="none"
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      style={{ position: "absolute", inset: 0, overflow: "hidden" }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id="dots"
            width={18}
            height={18}
            patternUnits="userSpaceOnUse"
          >
            <Circle cx={9} cy={9} r={1} fill={ink} opacity={0.28} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#dots)" />
      </Svg>
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: height * 0.34,
          opacity: sweep.interpolate({
            inputRange: [0, 0.18, 1],
            outputRange: [0, 0.12, 0],
          }),
          transform: [
            {
              translateY: sweep.interpolate({
                inputRange: [0, 1],
                outputRange: [height, -height * 0.36],
              }),
            },
          ],
        }}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={accent} stopOpacity={0} />
              <Stop offset="0.5" stopColor={accent} stopOpacity={1} />
              <Stop offset="1" stopColor={accent} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#sheen)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

export function PhotoStack({
  photos,
  composer = false,
  large = false,
  onOpen,
  onRemove,
}: {
  photos: Attachment[];
  composer?: boolean;
  large?: boolean;
  onOpen?: (index: number) => void;
  onRemove?: (photo: Attachment) => void;
}) {
  const [fanned, setFanned] = useState(false);
  const fan = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!live) return;
      Animated.timing(fan, {
        toValue: fanned ? 1 : 0,
        duration: reduced ? 0 : 380,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      live = false;
      fan.stopAnimation();
    };
  }, [fanned]);
  if (!photos.length) return null;
  // Composer prints grow when photos are the whole quanta.
  const printW = composer ? (large ? 196 : 140) : 66;
  const printH = composer ? (large ? 240 : 172) : 80;
  const spread = printW / 108;
  return (
    <View style={{ width: composer ? "100%" : 116 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          composer
            ? `${fanned ? "Gather" : "Spread"} ${photos.length} photos`
            : `Open ${photos.length} photos`
        }
        onPress={() => (composer ? setFanned(!fanned) : onOpen?.(0))}
        style={{
          height: composer ? printH + 44 : 100,
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {photos.slice(0, 3).map((photo, index, shown) => (
          <Animated.View
            key={`${photo.uri}-${index}`}
            pointerEvents="none"
            // A hardware layer is filtered when rotated, which softens Android's aliased edges.
            renderToHardwareTextureAndroid
            style={{
              position: "absolute",
              width: printW,
              height: printH,
              padding: composer ? 5 : 3,
              paddingBottom: composer ? 14 : 8,
              borderRadius: 5,
              backgroundColor: "#f7f5f1",
              elevation: 4,
              shadowColor: "#0a1018",
              shadowOpacity: 0.28,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 8 },
              transform: [
                {
                  translateX:
                    index === shown.length - 1
                      ? 0
                      : fan.interpolate({
                          inputRange: [0, 1],
                          outputRange: [
                            (index % 2 ? 1 : -1) * 12 * spread,
                            (index % 2 ? 1 : -1) * 56 * spread,
                          ],
                        }),
                },
                {
                  rotate:
                    index === shown.length - 1
                      ? "0deg"
                      : index % 2
                        ? "5deg"
                        : "-6deg",
                },
              ],
            }}
          >
            <Image
              source={{ uri: photo.uri }}
              resizeMode="cover"
              style={{ flex: 1, width: "100%", borderRadius: 3 }}
            />
            {index === shown.length - 1 && (
              <Text
                style={{
                  position: "absolute",
                  right: 5,
                  bottom: 0,
                  color: "#4c453e",
                  fontSize: 10,
                  fontFamily: "DMSans_600SemiBold",
                }}
              >
                {photos.length}
              </Text>
            )}
          </Animated.View>
        ))}
      </Pressable>
      {composer && fanned && (
        <View style={{ gap: 4 }}>
          {photos.map((photo, index) => (
            <Pressable
              key={photo.uri ?? index}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${photo.name}`}
              onPress={() => onRemove?.(photo)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 8,
                borderRadius: 10,
                backgroundColor: "#f7f5f1",
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  color: "#4c453e",
                  fontFamily: "DMSans_400Regular",
                  fontSize: 12,
                }}
              >
                {photo.name}
              </Text>
              <X size={16} color="#4c453e" />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => live && setReduced(value),
    );
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

// Short, self-dismissing confirmation that also shows above modals.
export function quickToast(message: string, fallback?: (m: string) => void) {
  if (Platform.OS === "android") ToastAndroid.show(message, ToastAndroid.SHORT);
  else fallback?.(message);
}

export function PhotoViewer({
  photos,
  onClose,
  onMessage,
}: {
  photos: Attachment[];
  onClose: () => void;
  onMessage: (value: string) => void;
}) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [aspect, setAspect] = useState(3 / 4);
  const presence = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const viewport = useWindowDimensions();
  const touch = useRef(0);
  const turn = (delta: number) => {
    const next = Math.max(0, Math.min(items.length - 1, index + delta));
    if (next === index) return;
    setDirection(delta);
    setIndex(next);
  };
  useEffect(() => {
    if (photos.length) {
      setItems(photos);
      setIndex(0);
      setDirection(0);
      slide.setValue(1);
      presence.setValue(reduced ? 1 : 0);
      if (!reduced)
        Animated.timing(presence, {
          toValue: 1,
          duration: 340,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
    } else if (items.length) {
      if (reduced) setItems([]);
      else
        Animated.timing(presence, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(() => setItems([]));
    }
  }, [photos]);
  useEffect(() => {
    if (!direction) return;
    slide.setValue(reduced ? 1 : 0);
    if (!reduced)
      Animated.timing(slide, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
  }, [index]);
  const uri = items[index]?.uri;
  useEffect(() => {
    if (!uri) return;
    let live = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (live && w > 0 && h > 0) setAspect(w / h);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [uri]);
  const copy = () => {
    const photo = items[index];
    if (!photo) return;
    void copyPhoto(photo)
      .then(() => quickToast("Photo copied", onMessage))
      .catch((e: Error) => quickToast(e.message, onMessage));
  };
  // Fit the print to the photo instead of letterboxing it in a fixed box.
  const pad = 8;
  const bar = 48;
  const maxW = viewport.width - 24 - pad * 2;
  const maxH = viewport.height * 0.84 - bar - pad;
  const imageW = Math.min(maxW, maxH * aspect);
  const imageH = imageW / aspect;
  const many = items.length > 1;
  return (
    <Modal
      visible={items.length > 0}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(14,20,28,.78)",
          opacity: presence,
        }}
      />
      <Pressable
        accessibilityLabel="Close photo viewer"
        onPress={onClose}
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <Animated.View
          style={{
            width: imageW + pad * 2,
            padding: pad,
            paddingBottom: 0,
            borderRadius: 8,
            backgroundColor: "#f7f5f1",
            elevation: 14,
            shadowColor: "#0a1018",
            shadowOpacity: 0.35,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 14 },
            opacity: Animated.multiply(
              presence,
              slide.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
            ),
            transform: [
              {
                translateY: presence.interpolate({
                  inputRange: [0, 1],
                  outputRange: [28, 0],
                }),
              },
              {
                scale: presence.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
              {
                translateX: slide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [direction * 26, 0],
                }),
              },
            ],
          }}
        >
          <Pressable onPress={(e) => e.stopPropagation()} accessible={false}>
            <View
              onTouchStart={(e) => {
                touch.current = e.nativeEvent.pageX;
              }}
              onTouchEnd={(e) => {
                const dx = e.nativeEvent.pageX - touch.current;
                if (Math.abs(dx) > 45) turn(dx < 0 ? 1 : -1);
              }}
            >
              <HoldSurface onCopy={copy}>
                <Image
                  source={{ uri }}
                  resizeMode="cover"
                  style={{ width: imageW, height: imageH, borderRadius: 4 }}
                />
              </HoldSurface>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                height: bar,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  paddingLeft: 4,
                  color: "#6e655c",
                  fontFamily: "DMSans_600SemiBold",
                  fontSize: 12,
                }}
              >
                {many ? `${index + 1}/${items.length}` : ""}
              </Text>
              <View style={{ flexDirection: "row", gap: 4 }}>
                {many &&
                  [
                    {
                      Icon: ChevronLeft,
                      label: "Previous photo",
                      delta: -1,
                      disabled: index === 0,
                    },
                    {
                      Icon: ChevronRight,
                      label: "Next photo",
                      delta: 1,
                      disabled: index === items.length - 1,
                    },
                  ].map(({ Icon, label, delta, disabled }) => (
                    <Pressable
                      key={label}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      disabled={disabled}
                      hitSlop={6}
                      onPress={() => turn(delta)}
                      style={{ padding: 10, opacity: disabled ? 0.3 : 1 }}
                    >
                      <Icon size={18} color="#4c453e" />
                    </Pressable>
                  ))}
              </View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Copy photo"
                  hitSlop={6}
                  onPress={copy}
                  style={{ padding: 10 }}
                >
                  <Copy size={17} color="#4c453e" />
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// Android draws ScrollView fading edges at full strength even at the scroll limits,
// so fade an edge only while more content lies past it.
function useFadeEdges({
  horizontal,
  onScroll,
  onLayout,
  onContentSizeChange,
}: ScrollViewProps) {
  const metrics = useRef({ offset: 0, view: 0, content: 0 });
  const [edges, setEdges] = useState({ start: false, end: false });
  const update = () => {
    const { offset, view, content } = metrics.current;
    const start = offset > 2;
    const end = content - view - offset > 2;
    setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
  };
  return {
    horizontal,
    fadingEdgeLength: { start: edges.start ? 16 : 0, end: edges.end ? 16 : 0 },
    scrollEventThrottle: 32,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
      metrics.current = horizontal
        ? {
            offset: contentOffset.x,
            view: layoutMeasurement.width,
            content: contentSize.width,
          }
        : {
            offset: contentOffset.y,
            view: layoutMeasurement.height,
            content: contentSize.height,
          };
      update();
      onScroll?.(e);
    },
    onLayout: (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      metrics.current.view = horizontal ? width : height;
      update();
      onLayout?.(e);
    },
    onContentSizeChange: (w: number, h: number) => {
      metrics.current.content = horizontal ? w : h;
      update();
      onContentSizeChange?.(w, h);
    },
  };
}

export function FadeScroll(props: ScrollViewProps) {
  return <ScrollView {...props} {...useFadeEdges(props)} />;
}

export function FadeList<T>(props: FlatListProps<T>) {
  return <FlatList {...props} {...useFadeEdges(props)} />;
}
