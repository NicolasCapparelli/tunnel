import { useRef, useState, useEffect } from "react";
import {
  Easing,
  Animated,
  PanResponder,
  Text,
  View,
  AccessibilityInfo,
} from "react-native";
import { ArrowUp, ArrowRight } from "lucide-react-native";
import { shouldLaunchQuanta } from "@tunnel/shared/composer";
import * as Haptics from "expo-haptics";
export default function SendRail({
  ready,
  busy,
  onSend,
  onUse,
  c,
  horizontal = false,
}: {
  ready: boolean;
  busy: boolean;
  onSend: () => void;
  onUse?: () => void;
  horizontal?: boolean;
  c: {
    primary: string;
    onPrimary: string;
    line: string;
    paper: string;
    muted: string;
  };
}) {
  const progress = useRef(new Animated.Value(0)).current,
    fade = useRef(new Animated.Value(1)).current,
    burst = useRef(new Animated.Value(1)).current;
  const [length, setLength] = useState(360);
  const [armed, setArmed] = useState(false);
  const launching = useRef(false);
  const reduced = useRef(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reduced.current = v;
    });
  }, []);
  const current = useRef({
    ready,
    busy,
    onSend,
    onUse,
    length,
    horizontal,
    armed,
  });
  current.current = { ready, busy, onSend, onUse, length, horizontal, armed };
  const reset = () => {
    setArmed(false);
    Animated.timing(progress, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };
  const launch = () => {
    if (launching.current || !current.current.ready || current.current.busy)
      return;
    launching.current = true;
    Animated.timing(progress, {
      toValue: 1,
      duration: reduced.current ? 0 : 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        launching.current = false;
        reset();
        return;
      }
      current.current.onSend();
      Animated.parallel([
        Animated.timing(burst, {
          toValue: 1.5,
          duration: reduced.current ? 0 : 320,
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 0,
          duration: reduced.current ? 0 : 320,
          useNativeDriver: true,
        }),
      ]).start(() => {
        progress.setValue(0);
        burst.setValue(1);
        setArmed(false);
        Animated.timing(fade, {
          toValue: 1,
          duration: reduced.current ? 0 : 280,
          useNativeDriver: true,
        }).start(() => {
          launching.current = false;
        });
      });
    });
  };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () =>
        current.current.ready && !current.current.busy && !launching.current,
      onMoveShouldSetPanResponder: (_, g) =>
        current.current.ready &&
        !current.current.busy &&
        !launching.current &&
        Math.abs(current.current.horizontal ? g.dx : g.dy) > 5,
      onPanResponderMove: (_, g) => {
        const distance = current.current.horizontal ? g.dx : -g.dy;
        const velocity = current.current.horizontal ? -g.vx : g.vy;
        progress.setValue(
          Math.max(
            0,
            Math.min(1, distance / Math.max(1, travel(current.current.length, current.current.horizontal))),
          ),
        );
        const next = shouldLaunchQuanta(
          distance,
          travel(current.current.length, current.current.horizontal),
          velocity,
        );
        if (next && !current.current.armed)
          void Haptics.selectionAsync().catch(() => {});
        setArmed(next);
      },
      onPanResponderGrant: () => current.current.onUse?.(),
      onPanResponderRelease: (_, g) => {
        if (
          shouldLaunchQuanta(
            current.current.horizontal ? g.dx : -g.dy,
            travel(current.current.length, current.current.horizontal),
            current.current.horizontal ? -g.vx : g.vy,
          )
        )
          launch();
        else reset();
      },
      onPanResponderTerminate: reset,
    }),
  ).current;
  const Icon = horizontal ? ArrowRight : ArrowUp;
  return (
    <View
      onLayout={(e) =>
        setLength(
          horizontal ? e.nativeEvent.layout.width : e.nativeEvent.layout.height,
        )
      }
      {...responder.panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={
        horizontal ? "Slide right to tunnel" : "Flick up to tunnel"
      }
      accessibilityState={{ disabled: !ready || busy }}
      accessibilityActions={[{ name: "activate", label: "Tunnel quanta" }]}
      onAccessibilityAction={launch}
      style={{
        width: horizontal ? "100%" : 56,
        height: horizontal ? 60 : undefined,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: horizontal ? 30 : 22,
        backgroundColor: c.paper,
      }}
    >
      {horizontal ? (
        <Animated.Text
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 60,
            right: 16,
            top: 0,
            bottom: 0,
            textAlign: "center",
            textAlignVertical: "center",
            lineHeight: 58,
            fontSize: 11,
            fontFamily: "DMSans_600SemiBold",
            letterSpacing: 2.4,
            color: ready ? c.primary : c.muted,
            opacity: progress.interpolate({
              inputRange: [0, 0.5],
              outputRange: [1, 0],
              extrapolate: "clamp",
            }),
          }}
        >
          {busy ? "TUNNELING" : "SLIDE TO SEND"}
        </Animated.Text>
      ) : (
        <>
          <View
            style={{
              position: "absolute",
              top: 62,
              bottom: 76,
              left: 25,
              justifyContent: "space-between",
            }}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <View
                key={i}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: c.primary,
                  opacity: 0.5,
                }}
              />
            ))}
          </View>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: "50%",
              left: -48,
              width: 150,
              transform: [{ rotate: "-90deg" }],
            }}
          >
            <Text
              style={{
                fontSize: 8,
                fontFamily: "DMSans_600SemiBold",
                letterSpacing: 2,
                color: ready ? c.primary : c.muted,
                textAlign: "center",
                backgroundColor: c.paper,
                padding: 7,
              }}
            >
              {busy ? "TUNNELING" : "SLIDE TO SEND"}
            </Text>
          </View>
        </>
      )}
      <Animated.View
        style={{
          position: "absolute",
          ...(horizontal
            ? { left: 6, top: 6, width: 46, height: 46, borderRadius: 23 }
            : { bottom: 12, left: 10, width: 34, height: 48, borderRadius: 20 }),
          backgroundColor: ready ? c.primary : c.line,
          alignItems: "center",
          justifyContent: "center",
          opacity: fade,
          transform: [
            horizontal
              ? {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.max(0, travel(length, horizontal))],
                  }),
                }
              : {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -Math.max(0, travel(length, horizontal))],
                  }),
                },
            { scale: burst },
          ],
        }}
      >
        <Icon size={22} color={ready ? c.onPrimary : c.muted} />
      </Animated.View>
    </View>
  );
}

// Distance the handle can travel inside the rail.
function travel(length: number, horizontal: boolean) {
  return length - (horizontal ? 62 : 84);
}
