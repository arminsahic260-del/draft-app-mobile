// Copyright (c) 2026 Armin Sahic. All rights reserved.
// Proprietary and confidential. See LICENSE for details.

import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center bg-lol-dark px-6">
          <Text className="text-lol-gold text-xl font-bold mb-2">Something went wrong</Text>
          <Text className="text-lol-text text-xs text-center mb-4">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </Text>
          <Pressable
            onPress={this.handleReset}
            className="px-6 py-2.5 rounded-lg bg-lol-gold"
          >
            <Text className="text-lol-dark font-bold text-sm">Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
