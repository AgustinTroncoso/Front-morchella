import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform ,
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { analyzeImageWithTFLite } from '@/services/morchellaModel';

type AnalysisResult = {
  id: string;
  imageUri: string;
  resultText: string;
  createdAt: string;
  usedRemote: boolean;
};

const HISTORY_STORAGE_KEY = '@imageAnalyzerHistory';

export default function HomeScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [lastResult, setLastResult] = useState<AnalysisResult | null>(null);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const persistHistory = async (items: AnalysisResult[]) => {
    try {
      setHistory(items);
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.warn('Error saving history', error);
    }
  };

  const clearHistoryAsync = useCallback(async () => {
    setIsClearing(true);
    try {
      const localUris = history
        .map((it) => it.imageUri)
        .filter((u) => !!u && (u.startsWith('file://') || u.startsWith('file:') || u.startsWith('content://')));

      for (const uri of localUris) {
        try {
          console.log('Borrando archivo local:', uri);
          await FileSystem.deleteAsync(uri, { idempotent: true });
        } catch (err) {
          console.warn('No se pudo borrar archivo local:', uri, err);
        }
      }

      await persistHistory([]);
      setHistory([]);
      setLastResult(null);
      setShowHistory(false);
      Alert.alert('Historial borrado', 'El historial y las imágenes locales han sido eliminados.');
    } catch (e) {
      console.warn('Error borrando historial', e);
      Alert.alert('Error', 'No se pudo borrar el historial.');
    } finally {
      setIsClearing(false);
    }
  }, [history, persistHistory]);

  useEffect(() => {
    void loadHistory();
    void checkNetworkStatus();
  }, []);

  const loadHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        const parsed: AnalysisResult[] = JSON.parse(stored);
        setHistory(parsed);
      }
    } catch (error) {
      console.warn('Error loading history', error);
    }
  };

  const checkNetworkStatus = async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
    } catch (error) {
      console.warn('Error obteniendo estado de red', error);
      setIsOnline(null);
    }
  };

  

  const handlePickImage = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitas dar permiso a la galería para continuar.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error al seleccionar imagen', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen.');
    }
  }, []);

  // Ref para el input de cámara en web
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const handleTakePhoto = useCallback(async () => {
    if (Platform.OS === 'web') {
      // Disparar input file oculto en web
      cameraInputRef.current?.click();
      return;
    }
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitas dar permiso a la cámara para continuar.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error al tomar foto', error);
      Alert.alert('Error', 'No se pudo tomar la foto.');
    }
  }, []);

  // Handler para input file en web
  const handleWebCameraChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageUri(url);
    } else {
      Alert.alert(
        'Cámara no soportada',
        'Tu navegador no permite abrir la cámara directamente. Se abrirá el selector de archivos.'
      );
    }
  }, []);

  const analyzeWithRemoteApi = async (uri: string): Promise<string> => {
    /**
     * TODO: Aquí debes llamar a tu API remota.
     * Ejemplo:
     *
     * const formData = new FormData();
     * formData.append('file', {
     *   uri,
     *   name: 'image.jpg',
     *   type: 'image/jpeg',
     * });
     *
     * const response = await fetch('https://tu-api.com/analyze', {
     *   method: 'POST',
     *   body: formData,
     *   headers: { 'Authorization': 'Bearer TU_TOKEN' },
     * });
     * const json = await response.json();
     * return json.resultado; // adapta esto a tu respuesta
     */
    // Placeholder temporal:
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return 'Resultado de ejemplo desde API remota (reemplaza esta función con tu implementación).';
  };

  const analyzeWithLocalModel = async (uri: string): Promise<string> => {
    try {
      // Usar el modelo TFLite para analizar la imagen
      const result = await analyzeImageWithTFLite(uri);

      // Formatear el resultado
      const morchellaText = result.isMorchella ? 'SÍ es una morchella' : 'NO es una morchella';
      const probabilityPercent = (result.probability * 100).toFixed(1);
      const confidencePercent = (result.confidence * 100).toFixed(1);

      return `${morchellaText}\n\nProbabilidad: ${probabilityPercent}%\nConfianza del modelo: ${confidencePercent}%`;
    } catch (error) {
      console.error('Error al analizar con modelo local:', error);
      // Si el modelo no está disponible, devolver mensaje informativo
      if (error instanceof Error && error.message.includes('No se pudo cargar el modelo')) {
        return 'Modelo no disponible. Por favor, verifica que el archivo morchella_classifier_small.tflite esté en assets/models/';
      }
      throw error;
    }
  };

  const handleAnalyze = useCallback(async () => {
    if (!imageUri) {
      Alert.alert('Sin imagen', 'Primero selecciona o toma una imagen.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const networkState = await Network.getNetworkStateAsync();
      const onlineNow = !!networkState.isConnected && !!networkState.isInternetReachable;
      setIsOnline(onlineNow);

      let usedRemote = false;
      let resultText = '';

      // Intentar primero con el modelo local (usa el .tflite incluido).
      // Si falla y hay conexión a Internet, intentar la API remota.
      try {
        resultText = await analyzeWithLocalModel(imageUri);
        usedRemote = false;
      } catch (localError) {
        console.warn('Modelo local falló:', localError);
        if (onlineNow) {
          try {
            resultText = await analyzeWithRemoteApi(imageUri);
            usedRemote = true;
          } catch (remoteError) {
            console.warn('Fallo API remota también:', remoteError);
            // Ambos fallaron — mostrar un mensaje de error al usuario
            throw new Error('No se pudo analizar con el modelo local ni con la API remota.');
          }
        } else {
          throw new Error('No hay conexión y el modelo local falló.');
        }
      }

      const newResult: AnalysisResult = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        imageUri,
        resultText,
        createdAt: new Date().toISOString(),
        usedRemote,
      };

      setLastResult(newResult);
      await persistHistory([newResult, ...history]);
    } catch (error) {
      console.error('Error durante el análisis', error);
      Alert.alert('Error', 'Ocurrió un error al analizar la imagen.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [imageUri, history]);

  const handleClearHistory = useCallback(() => {
    const message = '¿Quieres borrar todo el historial? Esto eliminará también las imágenes guardadas localmente.';
    if (Platform.OS === 'web') {
      // window.confirm funciona mejor en web que Alert.alert
       
      const ok = confirm(message);
      if (ok) void clearHistoryAsync();
      return;
    }

    Alert.alert('Borrar historial', message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => void clearHistoryAsync(),
      },
    ]);
  }, [clearHistoryAsync]);

  const renderHistoryItem = ({ item }: { item: AnalysisResult }) => {
    return (
      <ThemedView style={styles.historyItem}>
        <View style={styles.historyHeader}>
          <ThemedText type="defaultSemiBold" style={styles.historyDate}>
            {new Date(item.createdAt).toLocaleString()}
          </ThemedText>
          <ThemedText style={styles.historyTag}>
            {item.usedRemote ? 'API remota' : 'Modelo local'}
          </ThemedText>
        </View>
        <View style={styles.historyContent}>
          <Image source={{ uri: item.imageUri }} style={styles.historyImage} contentFit="cover" />
          <ThemedText style={styles.historyText} numberOfLines={4}>
            {item.resultText}
          </ThemedText>
        </View>
      </ThemedView>
    );
  };

  const backgroundColor = useThemeColor({}, 'background');

  return (
    <ScrollView style={[styles.scroll, { backgroundColor }]} contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.screenContainer}>
        <View style={styles.headerBar}>
          <ThemedText type="title" style={styles.headerTitle}>
            Morchellap
          </ThemedText>
          <View style={styles.headerRight}>
            <View
              style={[
                styles.statusPill,
                isOnline === null
                  ? styles.statusUnknown
                  : isOnline
                  ? styles.statusOnline
                  : styles.statusOffline,
              ]}>
              <View
                style={[
                  styles.statusDot,
                  isOnline === null
                    ? styles.statusDotUnknown
                    : isOnline
                    ? styles.statusDotOnline
                    : styles.statusDotOffline,
                ]}
              />
              <ThemedText style={styles.statusText}>
                {isOnline === null ? 'Verificando' : isOnline ? 'Online' : 'Offline'}
              </ThemedText>
            </View>
            <Pressable
              style={[styles.historyButton, showHistory && styles.historyButtonActive]}
              onPress={() => setShowHistory((prev) => !prev)}>
              <Ionicons
                name="time-outline"
                size={16}
                color={showHistory ? '#ffffff' : '#3d2817'}
              />
              <ThemedText
                style={[
                  styles.historyButtonText,
                  showHistory && styles.historyButtonTextActive,
                ]}>
                Historial
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {!showHistory && (
          <>
            <ThemedView style={styles.actionsContainer}>
              <Pressable style={styles.actionCard} onPress={handleTakePhoto}>
                <View style={styles.actionContent}>
                  <Ionicons name="camera-outline" size={22} color="#3d2817" />
                  <ThemedText style={styles.actionText}>Tomar Foto</ThemedText>
                </View>
                {/* Input oculto solo para web */}
                {Platform.OS === 'web' && (
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onClick={e => {
                      // Forzar reinicio del input para permitir tomar varias fotos seguidas
                      (e.target as HTMLInputElement).value = '';
                    }}
                    onChange={handleWebCameraChange}
                  />
                )}
              </Pressable>

              <Pressable style={styles.actionCard} onPress={handlePickImage}>
                <View style={styles.actionContent}>
                  <Ionicons name="image-outline" size={22} color="#3d2817" />
                  <ThemedText style={styles.actionText}>Subir Imagen</ThemedText>
                </View>
              </Pressable>
            </ThemedView>

            <ThemedView style={styles.imageContainer}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.previewImage} contentFit="cover" />
              ) : (
                <ThemedText style={styles.placeholderText}>
                  No hay imagen seleccionada todavía.
                </ThemedText>
              )}
            </ThemedView>

            <Pressable
              style={[styles.analyzeButton, !imageUri && styles.analyzeButtonDisabled]}
              onPress={handleAnalyze}
              disabled={!imageUri || isAnalyzing}>
              {isAnalyzing ? (
                <ActivityIndicator color="#f5ebe0" />
              ) : (
                <ThemedText style={styles.analyzeButtonText}>Analizar imagen</ThemedText>
              )}
            </Pressable>

            {lastResult && (
              <ThemedView style={styles.resultCard}>
                <ThemedText type="subtitle" style={styles.resultTitle}>
                  Último resultado
                </ThemedText>
                <ThemedText style={[styles.resultMeta, styles.resultMetaDark]}>
                  {new Date(lastResult.createdAt).toLocaleString()} ·{' '}
                  {lastResult.usedRemote ? 'API remota' : 'Modelo local'}
                </ThemedText>
                <ThemedText style={styles.resultText}>{lastResult.resultText}</ThemedText>
              </ThemedView>
            )}
          </>
        )}

        {showHistory && (
          <>
            <View style={styles.historyHeaderRow}>
              <ThemedText type="subtitle" style={styles.historyTitle}>
                Historial de análisis
              </ThemedText>
              {history.length > 0 && (
                <Pressable style={styles.clearButton} onPress={handleClearHistory} disabled={isClearing}>
                  {isClearing ? (
                    <ActivityIndicator size="small" color="#3d2817" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={16} color="#3d2817" />
                      <ThemedText style={styles.clearButtonText}>Limpiar historial</ThemedText>
                    </>
                  )}
                </Pressable>
              )}
            </View>

            {history.length === 0 ? (
              <ThemedText style={styles.emptyHistoryText}>
                Aún no hay análisis guardados. Analiza una imagen para comenzar.
              </ThemedText>
            ) : (
              <FlatList
                data={history}
                keyExtractor={(item) => item.id}
                renderItem={renderHistoryItem}
                scrollEnabled={false}
                contentContainerStyle={styles.historyList}
              />
            )}
          </>
        )}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  screenContainer: {
    flex: 1,
    gap: 16,
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  statusOnline: {
    backgroundColor: '#dcfce7',
  },
  statusOffline: {
    backgroundColor: '#fee2e2',
  },
  statusUnknown: {
    backgroundColor: '#e5e7eb',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 6,
    backgroundColor: '#6b7280',
  },
  statusDotOnline: {
    backgroundColor: '#22c55e',
  },
  statusDotOffline: {
    backgroundColor: '#ef4444',
  },
  statusDotUnknown: {
    backgroundColor: '#6b7280',
  },
  statusText: {
    fontSize: 12,
    color: '#3d2817',
    fontWeight: '600',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#d4a574',
  },
  historyButtonActive: {
    backgroundColor: '#3d2817',
  },
  historyButtonText: {
    fontSize: 13,
    color: '#3d2817',
    fontWeight: '600',
  },
  historyButtonTextActive: {
    color: '#ffffff',
  },
  actionsContainer: {
    gap: 12,
  },
  actionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#b8956a',
    paddingVertical: 22,
    paddingHorizontal: 16,
    backgroundColor: '#faf5f0',
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 16,
    color: '#3d2817',
    fontWeight: '500',
  },
  imageContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: 260,
  },
  placeholderText: {
    opacity: 0.7,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    flex: 1,
    backgroundColor: '#4b5563',
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  analyzeButton: {
    marginTop: 4,
    backgroundColor: '#6b5238',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzeButtonDisabled: {
    opacity: 0.5,
  },
  analyzeButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  resultCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f5ebe0',
    borderWidth: 1,
    borderColor: '#d4a574',
    gap: 4,
  },
  resultTitle: {
    marginBottom: 4,
  },
  resultMeta: {
    fontSize: 12,
    opacity: 0.7,
  },
  resultMetaDark: {
    color: '#2d1a06',
    opacity: 1,
    fontWeight: '600',
  },
  resultText: {
    marginTop: 4,
    color: '#2d1a06', // más oscuro
    fontWeight: '600',
  },
  historyHeaderRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyTitle: {
    marginBottom: 0,
  },
  clearHistoryText: {
    fontSize: 13,
    color: '#8b4513',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fdeedc',
  },
  clearButtonText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#3d2817',
    fontWeight: '600',
  },
  emptyHistoryText: {
    opacity: 0.7,
  },
  historyList: {
    gap: 8,
  },
  historyItem: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d4a574',
    backgroundColor: '#faf5f0',
    gap: 6,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyTag: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#d4a574',
    color: '#3d2817',
  },
  historyContent: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  historyImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  historyText: {
    flex: 1,
    fontSize: 13,
    color: '#2d1a06',
    fontWeight: '600',
  },
  historyDate: {
    color: '#2d1a06',
    fontWeight: '600',
  },
});
