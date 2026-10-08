import { useRef, useState } from "react";
import { Animated, PanResponder, Text, View } from "react-native";
import { ArrowUp, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";

export default function SendRail({
  ready,
  busy,
  onSend,
  c,
}: {
  ready: boolean;
  busy: boolean;
  onSend: () => void;
  c: {
    primary: string;
    onPrimary: string;
    line: string;
    paper: string;
    muted: string;
  };
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [height, setHeight] = useState(360);
  const [armed, setArmed] = useState(false);
  const current = useRef({ ready, busy, onSend, height, armed });
  current.current = { ready, busy, onSend, height, armed };
  const accessibilityProgress = useRef(0);
  const reset = () => {
    setArmed(false);
    accessibilityProgress.current = 0;
    Animated.spring(progress, { toValue: 0, useNativeDriver: true }).start();
  };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () =>
        current.current.ready && !current.current.busy,
      onMoveShouldSetPanResponder: (_, g) =>
        current.current.ready && !current.current.busy && Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        const p = Math.max(
          0,
          Math.min(1, -g.dy / (current.current.height - 84)),
        );
        progress.setValue(p);
        const next = p >= 0.8;
        if (next && !current.current.armed)
          void Haptics.selectionAsync().catch(() => {});
        setArmed(next);
      },
      onPanResponderRelease: (_, g) => {
        const done = -g.dy / (current.current.height - 84) >= 0.8;
        reset();
        if (done && current.current.ready && !current.current.busy)
          current.current.onSend();
      },
      onPanResponderTerminate: () => reset(),
    }),
  ).current;
  return (
    <View
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Slide up to send quanta"
      accessibilityHint="Swipe up along the rail, or use the send accessibility action."
      accessibilityState={{ disabled: !ready || busy }}
      accessibilityActions={[
        { name: "increment", label: "Move up to send" },
        { name: "activate", label: "Send quanta" },
      ]}
      onAccessibilityAction={(e) => {
        if (!ready || busy) return;
        if (e.nativeEvent.actionName === "activate") {
          onSend();
          return;
        }
        accessibilityProgress.current += 0.25;
        if (accessibilityProgress.current >= 1) {
          reset();
          onSend();
        } else progress.setValue(accessibilityProgress.current);
      }}
      style={{
        width: 50,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 22,
        backgroundColor: c.paper,
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: 31,
          height: 31,
          borderWidth: 1,
          borderColor: armed ? c.primary : c.line,
          borderRadius: 18,
          marginTop: 12,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {armed ? (
          <Check size={17} color={c.primary} />
        ) : (
          <ArrowUp size={17} color={c.muted} />
        )}
      </View>
      <View
        style={{
          position: "absolute",
          top: 62,
          bottom: 76,
          justifyContent: "space-between",
        }}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <View
            key={i}
            style={{
              width: 3,
              height: 3,
              backgroundColor: c.primary,
              opacity: 0.25 + i * 0.03,
              borderRadius: 2,
            }}
          />
        ))}
      </View>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: "50%",
          width: 150,
          transform: [{ rotate: "-90deg" }],
        }}
      >
        <Text
          style={{
            color: c.muted,
            fontFamily: "DMSans_600SemiBold",
            fontSize: 8,
            letterSpacing: 2,
            textAlign: "center",
            backgroundColor: c.paper,
            padding: 9,
          }}
        >
          {busy ? "TUNNELING" : "SLIDE TO SEND"}
        </Text>
      </View>
      <Animated.View
        style={{
          position: "absolute",
          bottom: 12,
          width: 34,
          height: 48,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: ready ? c.primary : c.line,
          backgroundColor: ready ? c.primary : c.paper,
          justifyContent: "center",
          alignItems: "center",
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -(height - 84)],
              }),
            },
          ],
        }}
      >
        <ArrowUp size={24} color={ready ? c.onPrimary : c.muted} />
      </Animated.View>
    </View>
  );
}
