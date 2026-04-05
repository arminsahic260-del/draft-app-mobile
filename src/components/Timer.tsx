// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface TimerProps {
  seconds: number;
  isActive: boolean;
  onExpire?: () => void;
}

function getTimerStyle(seconds: number, isActive: boolean) {
  if (!isActive || seconds > 20) {
    return { stroke: '#22c55e', textColor: 'text-green-500', urgent: false };
  }
  if (seconds > 10) {
    return { stroke: '#eab308', textColor: 'text-yellow-400', urgent: false };
  }
  if (seconds > 5) {
    return { stroke: '#ef4444', textColor: 'text-red-500', urgent: false };
  }
  // <= 5 — URGENT
  return { stroke: '#ef4444', textColor: 'text-red-500', urgent: true };
}

const TOTAL_SECONDS = 30;
const RADIUS = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function Timer({ seconds, isActive, onExpire }: TimerProps) {
  const hasExpiredRef = useRef(false);
  const [pulseVisible, setPulseVisible] = useState(true);

  useEffect(() => {
    if (isActive && seconds <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      onExpire?.();
    }
    if (seconds > 0) hasExpiredRef.current = false;
  }, [seconds, isActive, onExpire]);

  // Pulse effect for low time — replaces CSS animate-pulse which doesn't work in RN
  const shouldPulse = isActive && seconds <= 10 && seconds > 0;
  useEffect(() => {
    if (!shouldPulse) {
      setPulseVisible(true);
      return;
    }
    const interval = setInterval(() => {
      setPulseVisible((v) => !v);
    }, 500);
    return () => clearInterval(interval);
  }, [shouldPulse]);

  const clamped = Math.max(0, seconds);
  const progress = clamped / TOTAL_SECONDS;
  const offset = CIRCUMFERENCE - progress * CIRCUMFERENCE;
  const ts = getTimerStyle(clamped, isActive);
  const pulseOpacity = shouldPulse ? (pulseVisible ? 1 : 0.5) : 1;

  return (
    <View
      className="relative items-center justify-center"
      style={{ opacity: pulseOpacity }}
      accessibilityLabel={`${clamped} seconds remaining`}
      accessibilityRole="timer"
    >
      {/* Pulsing danger ring */}
      {ts.urgent && isActive && (
        <View
          className="absolute inset-0 rounded-full border-2 border-red-500/70"
          style={{ opacity: pulseVisible ? 0.7 : 0 }}
        />
      )}

      <Svg
        width={44}
        height={44}
        viewBox="0 0 88 88"
        fill="none"
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        {/* Background track */}
        <Circle
          cx={44}
          cy={44}
          r={RADIUS}
          stroke="#1a1f2e"
          strokeWidth={6}
        />
        {/* Progress arc */}
        <Circle
          cx={44}
          cy={44}
          r={RADIUS}
          stroke={ts.stroke}
          strokeWidth={ts.urgent ? 8 : 6}
          strokeDasharray={`${CIRCUMFERENCE}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </Svg>

      {/* Centre text */}
      <View className="absolute inset-0 items-center justify-center">
        <Text
          className={`text-sm font-black leading-none ${ts.textColor}`}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {clamped > 0 ? clamped : '\u23F0'}
        </Text>
        {clamped > 0 && (
          <Text
            className={`text-[9px] uppercase tracking-widest mt-0.5 ${
              ts.urgent ? 'text-red-500 font-bold' : 'text-gray-400'
            }`}
          >
            {ts.urgent ? 'HURRY!' : isActive ? 'sec' : 'paused'}
          </Text>
        )}
      </View>

      {/* Inactive overlay */}
      {!isActive && (
        <View className="absolute inset-0 rounded-full bg-gray-900/50" />
      )}
    </View>
  );
}
