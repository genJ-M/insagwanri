import { useState } from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

export function useLocation() {
  const [locating, setLocating] = useState(false);

  const getCoords = async (): Promise<Coords | null> => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('위치 권한 필요', '출퇴근 기록을 위해 위치 권한이 필요합니다.');
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
      };
    } finally {
      setLocating(false);
    }
  };

  return { locating, getCoords };
}
