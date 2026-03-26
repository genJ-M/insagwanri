import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

interface Props {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingScreen({ message, fullScreen = false }: Props) {
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size="large" color="#2563EB" />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

export function LoadingRow() {
  return (
    <View style={styles.row}>
      <ActivityIndicator size="small" color="#2563EB" />
    </View>
  );
}

/** 스켈레톤 바 (react-native용 pulse 없이 단순 회색 블록) */
export function SkeletonBox({ width, height, style }: { width?: number | string; height: number; style?: object }) {
  return <View style={[styles.skeleton, { width: width as number, height }, style]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  message: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  row: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  skeleton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
});
