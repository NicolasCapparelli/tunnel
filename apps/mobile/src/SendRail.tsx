import { useRef, useState, useEffect } from "react";
import {
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
  c,
  horizontal = false,
}: {
  ready: boolean;
  busy: boolean;
  onSend: () => void;
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
  const current = useRef({ ready, busy, onSend, length, horizontal, armed });
  current.current = { ready, busy, onSend, length, horizontal, armed };
  const reset = () => {
    setArmed(false);
    Animated.timing(progress, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start();
  };
  const launch = () => {
    if (launching.current || !current.current.ready || current.current.busy)
      return;
    launching.current = true;
    Animated.timing(progress, {
      toValue: 1,
      duration: reduced.current ? 0 : 180,
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
          toValue: 1.8,
          duration: reduced.current ? 0 : 140,
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 0,
          duration: reduced.current ? 0 : 140,
          useNativeDriver: true,
        }),
      ]).start(() => {
        progress.setValue(0);
        burst.setValue(1);
        setArmed(false);
        Animated.timing(fade, {
          toValue: 1,
          duration: reduced.current ? 0 : 160,
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
            Math.min(1, distance / Math.max(1, current.current.length - 84)),
          ),
        );
        const next = shouldLaunchQuanta(
          distance,
          current.current.length - 84,
          velocity,
        );
        if (next && !current.current.armed)
          void Haptics.selectionAsync().catch(() => {});
        setArmed(next);
      },
      onPanResponderRelease: (_, g) => {
        if (
          shouldLaunchQuanta(
            current.current.horizontal ? g.dx : -g.dy,
            current.current.length - 84,
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
        borderRadius: 22,
        backgroundColor: c.paper,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",
          ...(horizontal
            ? { left: 62, right: 68, top: 28, flexDirection: "row" as const }
            : { top: 62, bottom: 76, left: 25 }),
          justifyContent: "space-between",
        }}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <View
            key={i}
            style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: c.primary,
              opacity: 0.3,
            }}
          />
        ))}
      </View>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          ...(horizontal
            ? { left: 0, right: 0, top: 18 }
            : {
                top: "50%",
                left: -48,
                width: 150,
                transform: [{ rotate: "-90deg" }],
              }),
        }}
      >
        <Text
          style={{
            fontSize: 8,
            fontFamily: "DMSans_600SemiBold",
            letterSpacing: 2,
            color: c.muted,
            textAlign: "center",
            backgroundColor: c.paper,
            padding: 7,
          }}
        >
          {busy ? "TUNNELING" : "SLIDE TO SEND"}
        </Text>
      </View>
      <Animated.View
        style={{
          position: "absolute",
          ...(horizontal
            ? { left: 12, top: 12, width: 38, height: 36 }
            : { bottom: 12, left: 10, width: 34, height: 48 }),
          borderRadius: 20,
          backgroundColor: ready ? c.primary : c.paper,
          borderWidth: 1,
          borderColor: ready ? c.primary : c.line,
          alignItems: "center",
          justifyContent: "center",
          opacity: fade,
          transform: [
            horizontal
              ? {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.max(0, length - 84)],
                  }),
                }
              : {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -Math.max(0, length - 84)],
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
